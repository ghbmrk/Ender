import { QUALITY_KEYS, hash32, round, type EvidenceTier, type FormQualities, type GearSlot, type QualityKey } from "@weave/shared";
import { realmById } from "@weave/content";
import { READING_NOISE, artifactPower, readQualities, revealedQualityKeys, scoreObjective } from "@weave/domain";
import { evaluateForm, productionCost, productionRecipe } from "@weave/economy";
import { all, get, now, run } from "../db";
import type { Ctx } from "./context";
import { HttpError, passivesFor } from "./character";
import { currentSnapshot, marketContext } from "./world";

export type ArtifactRow = {
  id: string;
  character_id: string;
  reality_source: string;
  reality_id: string;
  revision: number;
  objective_id: string;
  fantasy_name: string | null;
  epithet: string | null;
  evidence_tier: EvidenceTier;
  revealed: string;
  readings: string | null;
  technical_score: number | null;
  production_cost: number | null;
  market_value: number | null;
  efficiency_score: number | null;
  origin: string;
  run_id: string | null;
  acquisition_cost: number;
  acquisition_value: number | null;
  status: string;
  equipped_slot: GearSlot | null;
  bound: number;
  familiar: string | null;
  created_at: string;
};

export type Readings = { qualities: FormQualities; predictedScore: number; noise: number };

export const fantasyIdFor = (realityId: string) => `form-${hash32(`weave:${realityId}`).toString(36)}`;

let counter = 0;
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

export function getArtifact(ctx: Ctx, id: string, charId?: string): ArtifactRow {
  const a = get<ArtifactRow>(ctx.db, "SELECT * FROM artifacts WHERE id = ?", id);
  if (!a || (charId && a.character_id !== charId)) throw new HttpError(404, `no artifact ${id}`);
  return a;
}

export const trueQualities = (ctx: Ctx, a: Pick<ArtifactRow, "reality_id">) => ctx.reality.candidateSync(a.reality_id).qualities;
export const objectiveOf = (a: Pick<ArtifactRow, "objective_id">) => realmById(a.objective_id).objective;

/** Deterministic artifact ids so a fresh world replays identically (and fixtures match). */
export function nextArtifactId(ctx: Ctx, charId: string) {
  const n = get<{ n: number }>(ctx.db, "SELECT COUNT(*) AS n FROM artifacts WHERE character_id = ?", charId)!.n + 1;
  return `${charId}-f${n}`;
}

export function createArtifact(
  ctx: Ctx,
  charId: string,
  opts: { realityId: string; realmId: string; origin: "drop" | "temper" | "bazaar" | "seed"; runId?: string; acquisitionCost?: number; tier?: EvidenceTier; parentId?: string },
): ArtifactRow {
  const id = nextArtifactId(ctx, charId);
  const extra = passivesFor(ctx, charId).extraReveal ?? 0;
  const revealCount = 1 + (hash32(`${id}:count`) % 2) + extra;
  const revealed = revealedQualityKeys(`${charId}:${opts.realityId}`, revealCount);
  const q = trueQualities(ctx, { reality_id: opts.realityId });
  const ev = evaluateForm(q, productionRecipe(q), realmById(opts.realmId).objective, "trialed", marketContext(ctx));
  run(
    ctx.db,
    `INSERT INTO artifacts (id, character_id, reality_source, reality_id, revision, objective_id, evidence_tier, revealed, origin, run_id, acquisition_cost, acquisition_value, status, created_at)
     VALUES (?, ?, 'pubchem', ?, 1, ?, ?, ?, ?, ?, ?, ?, 'held', ?)`,
    id,
    charId,
    opts.realityId,
    opts.realmId,
    opts.tier ?? "veiled",
    JSON.stringify(revealed),
    opts.origin,
    opts.runId ?? null,
    opts.acquisitionCost ?? 0,
    ev.estimatedMarketValue,
    now(),
  );
  run(ctx.db, "INSERT INTO artifact_revisions (artifact_id, revision, evidence_tier, note, created_at) VALUES (?, 1, ?, ?, ?)", id, opts.tier ?? "veiled", `created (${opts.origin})`, now());
  if (opts.parentId) run(ctx.db, "INSERT INTO artifact_lineage (child_id, parent_id, action, created_at) VALUES (?, ?, 'temper', ?)", id, opts.parentId, now());
  return getArtifact(ctx, id);
}

/** Readings the Binder perceives once a Form is Attuned (noise keyed by observer + Form). */
export function makeReadings(ctx: Ctx, a: ArtifactRow, noiseMult: number): Readings {
  const q = readQualities(trueQualities(ctx, a), `${a.character_id}:${a.reality_id}`, noiseMult);
  return { qualities: q, predictedScore: scoreObjective(q, objectiveOf(a)).technicalScore, noise: round(READING_NOISE * noiseMult, 1) };
}

/** Authoritative deterministic evaluation at current market conditions. */
export function trueEvaluation(ctx: Ctx, a: ArtifactRow, tier: EvidenceTier = a.evidence_tier) {
  const q = trueQualities(ctx, a);
  const recipe = productionRecipe(q);
  const ev = evaluateForm(q, recipe, objectiveOf(a), tier, marketContext(ctx));
  return { ...ev, qualities: q, recipe, contributions: scoreObjective(q, objectiveOf(a)).contributions };
}

export function setTier(ctx: Ctx, a: ArtifactRow, tier: EvidenceTier, note: string) {
  run(ctx.db, "UPDATE artifacts SET evidence_tier = ? WHERE id = ?", tier, a.id);
  run(ctx.db, "INSERT INTO artifact_revisions (artifact_id, revision, evidence_tier, note, created_at) VALUES (?, ?, ?, ?, ?)", a.id, a.revision, tier, note, now());
}

export function lineage(ctx: Ctx, id: string): { id: string; parentId: string; action: string }[] {
  const out: { id: string; parentId: string; action: string }[] = [];
  let cur = id;
  for (let i = 0; i < 50; i++) {
    const p = get<{ parent_id: string; action: string }>(ctx.db, "SELECT parent_id, action FROM artifact_lineage WHERE child_id = ?", cur);
    if (!p) break;
    out.push({ id: cur, parentId: p.parent_id, action: p.action });
    cur = p.parent_id;
  }
  return out;
}

/** What the player may see. Veiled: revealed qualities only. Attuned: readings (≈). Trialed+: exact. */
export function artifactView(ctx: Ctx, a: ArtifactRow) {
  const tier = a.evidence_tier;
  const trueQ = trueQualities(ctx, a);
  const m = marketContext(ctx);
  const revealed = JSON.parse(a.revealed) as QualityKey[];
  const readings = a.readings ? (JSON.parse(a.readings) as Readings) : null;
  let qualities: Partial<Record<QualityKey, { value: number; exact: boolean; uncertainty?: number }>> = {};
  if (tier === "veiled") for (const k of revealed) qualities[k] = { value: trueQ[k], exact: true };
  else if (tier === "attuned" && readings) {
    for (const k of QUALITY_KEYS)
      qualities[k] = revealed.includes(k) ? { value: trueQ[k], exact: true } : { value: readings.qualities[k], exact: false, uncertainty: readings.noise };
  } else for (const k of QUALITY_KEYS) qualities[k] = { value: trueQ[k], exact: true };

  let evaluation: Record<string, unknown> | null = null;
  if (tier === "trialed" || tier === "witnessed") {
    const ev = trueEvaluation(ctx, a);
    evaluation = {
      exact: true,
      technicalScore: ev.technicalScore,
      power: ev.power,
      productionCost: ev.productionCost,
      marketValue: ev.estimatedMarketValue,
      efficiency: ev.efficiencyScore,
      margin: ev.marginPotential,
      valueBreakdown: ev.value,
      contributions: ev.contributions,
      recipe: ev.recipe.essenceCosts,
    };
  } else if (tier === "attuned" && readings) {
    const merged = { ...readings.qualities };
    for (const k of revealed) merged[k] = trueQ[k];
    const recipe = productionRecipe(merged);
    const ev = evaluateForm(merged, recipe, objectiveOf(a), "attuned", m);
    evaluation = {
      exact: false,
      technicalScore: ev.technicalScore,
      power: artifactPower(ev.technicalScore, "attuned"),
      productionCost: ev.productionCost,
      marketValue: ev.estimatedMarketValue,
      efficiency: ev.efficiencyScore,
      margin: ev.marginPotential,
      recipe: recipe.essenceCosts,
      uncertainty: readings.noise,
    };
  }
  const parent = get<{ parent_id: string }>(ctx.db, "SELECT parent_id FROM artifact_lineage WHERE child_id = ?", a.id);
  return {
    id: a.id,
    fantasyId: fantasyIdFor(a.reality_id),
    name: a.fantasy_name ?? "Veiled Form",
    epithet: a.epithet,
    tier,
    realmId: a.objective_id,
    realmName: realmById(a.objective_id).name,
    qualities,
    evaluation,
    familiar: a.familiar ? JSON.parse(a.familiar) : null,
    status: a.status,
    equippedSlot: a.equipped_slot,
    bound: !!a.bound,
    origin: a.origin,
    acquisitionCost: a.acquisition_cost,
    parentId: parent?.parent_id ?? null,
    createdAt: a.created_at,
    snapshotId: currentSnapshot(ctx).id,
  };
}
export type ArtifactView = ReturnType<typeof artifactView>;

export function heldArtifacts(ctx: Ctx, charId: string) {
  return all<ArtifactRow>(ctx.db, "SELECT * FROM artifacts WHERE character_id = ? AND status IN ('held','equipped') ORDER BY rowid", charId);
}

export const recipeCostNow = (ctx: Ctx, a: ArtifactRow) => productionCost(productionRecipe(trueQualities(ctx, a)), marketContext(ctx).prices);
