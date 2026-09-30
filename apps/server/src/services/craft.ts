import { ESSENCE_IDS, QUALITY_KEYS, percentileRank, round, type EssenceId, type FormQualities, type QualityKey } from "@weave/shared";
import { ESSENCES, QUALITY_NAMES, realmById } from "@weave/content";
import { FOCUS_COST, WORK_UNITS, masteryEffects, mirrorObjectives, qualityDistance, readQualities, scoreObjective, technicalScore, weaknesses } from "@weave/domain";
import { costShare, efficiencyScore, essenceQty, evaluateForm, marketValue, productionCost, productionRecipe } from "@weave/economy";
import { ruleFantasyName, type AttuneRequest, type CritiqueRequest, type CritiqueResult, type TransformRequest } from "@weave/inference";
import { all, get, now, run, tx } from "../db";
import type { Ctx } from "./context";
import {
  HttpError,
  addItem,
  charRow,
  getMastery,
  itemQty,
  passivesFor,
  policyFor,
  recordMasteryEvent,
  spendFocus,
  type MasteryChange,
} from "./character";
import {
  artifactView,
  createArtifact,
  fantasyIdFor,
  getArtifact,
  makeReadings,
  newId,
  objectiveOf,
  setTier,
  trueEvaluation,
  trueQualities,
  type ArtifactRow,
  type Readings,
} from "./artifacts";
import { logInference } from "./inferenceLog";
import { currentSnapshot, marketContext } from "./world";

const latestRunId = (ctx: Ctx, charId: string) =>
  get<{ id: string }>(ctx.db, "SELECT id FROM runs WHERE character_id = ? ORDER BY started_at DESC, rowid DESC LIMIT 1", charId)?.id ?? null;

/** Qualities as the Binder currently knows them (exact after a Trial). */
function knownQualities(ctx: Ctx, a: ArtifactRow): FormQualities {
  const trueQ = trueQualities(ctx, a);
  if (a.evidence_tier === "trialed" || a.evidence_tier === "witnessed") return trueQ;
  const r = a.readings ? (JSON.parse(a.readings) as Readings).qualities : trueQ;
  const merged = { ...r };
  for (const k of JSON.parse(a.revealed) as QualityKey[]) merged[k] = trueQ[k];
  return merged;
}

function marketSummary(ctx: Ctx, q: FormQualities) {
  const m = marketContext(ctx);
  const recipe = productionRecipe(q);
  const cost = productionCost(recipe, m.prices);
  const demand = m.contracts.filter((c) => c.requirement.maxEssence?.every((x) => essenceQty(recipe, x.essence) <= x.qty)).length;
  const costByEssence: Partial<Record<EssenceId, number>> = {};
  for (const e of ESSENCE_IDS) if (essenceQty(recipe, e) > 0) costByEssence[e] = round(essenceQty(recipe, e) * m.prices[e], 1);
  return { productionCost: cost, currentDemand: demand, essenceScarcity: m.scarcity, costByEssence };
}

function requireTier(a: ArtifactRow, allowed: ArtifactRow["evidence_tier"][], action: string) {
  if (!allowed.includes(a.evidence_tier)) throw new HttpError(400, `cannot ${action} a ${a.evidence_tier} Form`);
  if (a.status !== "held" && a.status !== "equipped") throw new HttpError(400, `Form is ${a.status}`);
}

/** Record a mastery opportunity at most once per key. */
function masteryOnce(ctx: Ctx, charId: string, domain: Parameters<typeof recordMasteryEvent>[2], success: number, reason: string): MasteryChange | null {
  if (get(ctx.db, "SELECT 1 FROM mastery_events WHERE character_id = ? AND reason = ?", charId, reason)) return null;
  return recordMasteryEvent(ctx, charId, domain, success, reason);
}

// ───────────────────────────── Attune ─────────────────────────────

export async function attune(ctx: Ctx, charId: string, artifactId: string) {
  const a = getArtifact(ctx, artifactId, charId);
  requireTier(a, ["veiled"], "attune");
  const passives = passivesFor(ctx, charId);
  const c = charRow(ctx, charId);
  const free = c.free_attunes_used < (passives.freeAttunes ?? 0);
  if (free) run(ctx.db, "UPDATE characters SET free_attunes_used = free_attunes_used + 1 WHERE id = ?", charId);
  else spendFocus(ctx, charId, FOCUS_COST.attune);

  const readings = makeReadings(ctx, a, passives.readingNoise);
  const withReadings = { ...a, readings: JSON.stringify(readings), evidence_tier: "attuned" as const };
  const q = knownQualities(ctx, withReadings);
  const ms = marketSummary(ctx, q);
  const req: AttuneRequest = {
    artifact: { fantasyId: fantasyIdFor(a.reality_id), qualities: q },
    realmObjective: objectiveOf(a),
    marketContext: { productionCost: ms.productionCost, currentDemand: ms.currentDemand, essenceScarcity: ms.essenceScarcity },
    buildPolicy: policyFor(ctx, charId),
    knownEvidence: ctx.reality.evidenceSync(a.reality_id),
  };
  const env = await ctx.inference.attune(req);
  // Inference interprets only; it never changes qualities, scores, prices or tiers.
  const mastery: MasteryChange[] = [];
  const log = tx(ctx.db, () => {
    run(
      ctx.db,
      "UPDATE artifacts SET readings = ?, fantasy_name = ?, epithet = ?, familiar = ? WHERE id = ?",
      JSON.stringify({ ...readings, predictedScore: scoreObjective(q, objectiveOf(a)).technicalScore }),
      env.result.fantasyName,
      env.result.epithet,
      JSON.stringify({ attune: env.result, provider: env.provenance.provider }),
      a.id,
    );
    setTier(ctx, a, "attuned", "attuned");
    // Discovery: was this the right Form to spend Focus on? Top 25% of the run's drops.
    if (a.run_id) {
      const peers = all<{ reality_id: string; objective_id: string }>(ctx.db, "SELECT reality_id, objective_id FROM artifacts WHERE run_id = ? AND character_id = ? AND origin = 'drop'", a.run_id, charId);
      if (peers.length >= 3) {
        const scores = peers.map((p) => technicalScore(ctx.reality.candidateSync(p.reality_id).qualities, realmById(p.objective_id).objective));
        const mine = technicalScore(trueQualities(ctx, a), objectiveOf(a));
        const m = masteryOnce(ctx, charId, "discovery", percentileRank(scores, mine) >= 0.75 ? 1 : 0, `attune-choice:${a.id}`);
        if (m) mastery.push(m);
      }
    }
    return logInference(ctx, { charId, artifactId: a.id, revision: a.revision, kind: "attune", action: "attune", env, runId: latestRunId(ctx, charId) });
  });
  return { artifact: artifactView(ctx, getArtifact(ctx, a.id)), familiar: env.result, inference: log, mastery, focusSpent: free ? 0 : FOCUS_COST.attune };
}

// ───────────────────────────── Temper ─────────────────────────────

export type TemperOption = {
  candidateId: string;
  realityId: string;
  name: string;
  emphasis: string;
  rationale: string;
  predictedTechnicalScore: number;
  productionCost: number;
  marketValue: number;
  distance: number;
  efficiency: number;
};

function buildTransformRequest(ctx: Ctx, charId: string, a: ArtifactRow, wild: boolean) {
  const passives = passivesFor(ctx, charId);
  const me = charMasteryEffects(ctx, charId);
  const m = marketContext(ctx);
  const objective = objectiveOf(a);
  const trueQ = trueQualities(ctx, a);
  const neighbors = ctx.reality.neighborsSync(a.reality_id, { depth: passives.deepNeighborhood ? 2 : 1, limit: 12 + me.craftNeighborhood });
  const candidates = neighbors.map((n) => {
    const reading = readQualities(n.qualities, `${charId}:${n.id}`, passives.readingNoise);
    const recipe = productionRecipe(reading);
    const cost = productionCost(recipe, m.prices);
    const pred = technicalScore(reading, objective);
    return {
      realityId: n.id,
      c: {
        candidateId: fantasyIdFor(n.id),
        qualities: reading,
        predictedTechnicalScore: pred,
        productionCost: cost,
        marketValue: marketValue(pred, recipe, "attuned", m).total,
        distance: round(qualityDistance(trueQ, n.qualities), 1),
        efficiency: efficiencyScore(pred, cost, m.referenceCost),
        lore: ctx.reality.evidenceSync(n.id)[0]!.tier,
      },
    };
  });
  const policy = policyFor(ctx, charId);
  if (wild) policy.exploration = Math.min(1, policy.exploration + 0.3);
  const known = knownQualities(ctx, a);
  const knownRecipe = productionRecipe(known);
  const ms = marketSummary(ctx, known);
  const req: TransformRequest = {
    artifact: { fantasyId: fantasyIdFor(a.reality_id), qualities: known, predictedTechnicalScore: technicalScore(known, objective), productionCost: productionCost(knownRecipe, m.prices) },
    realmObjective: objective,
    candidates: candidates.map((x) => x.c),
    marketContext: { productionCost: ms.productionCost, currentDemand: ms.currentDemand, essenceScarcity: ms.essenceScarcity },
    buildPolicy: policy,
    costWeight: passives.costWeight ?? 0,
    count: 3,
  };
  return { req, candidates };
}

const charMasteryEffects = (ctx: Ctx, charId: string) => masteryEffects(getMastery(ctx, charId));

export async function temperOptions(ctx: Ctx, charId: string, artifactId: string, opts: { wildSigil?: boolean } = {}) {
  const a = getArtifact(ctx, artifactId, charId);
  requireTier(a, ["attuned", "trialed", "witnessed"], "temper");
  if (a.status === "equipped") throw new HttpError(400, "unequip the Form before tempering it");
  const pending = get<{ options: string }>(ctx.db, "SELECT options FROM pending_tempers WHERE artifact_id = ?", a.id);
  if (pending) return { options: JSON.parse(pending.options) as TemperOption[], familiar: null, inference: null, focusSpent: 0, pending: true };

  const wild = !!opts.wildSigil && itemQty(ctx, charId, "currency", "wild-sigil") >= 1;
  const cost = Math.max(0, FOCUS_COST.temper - (passivesFor(ctx, charId).temperDiscount ?? 0));
  spendFocus(ctx, charId, cost);
  const { req, candidates } = buildTransformRequest(ctx, charId, a, wild);
  const env = await ctx.inference.transform(req);
  const byId = new Map(candidates.map((x) => [x.c.candidateId, x]));
  const options: TemperOption[] = env.result.choices
    .filter((ch) => byId.has(ch.candidateId))
    .map((ch) => {
      const x = byId.get(ch.candidateId)!;
      return {
        candidateId: ch.candidateId,
        realityId: x.realityId,
        name: ruleFantasyName(ch.candidateId, x.c.qualities).fantasyName,
        emphasis: ch.emphasis,
        rationale: ch.rationale,
        predictedTechnicalScore: x.c.predictedTechnicalScore,
        productionCost: x.c.productionCost,
        marketValue: x.c.marketValue,
        distance: x.c.distance,
        efficiency: x.c.efficiency,
      };
    });
  const log = tx(ctx.db, () => {
    if (wild) addItem(ctx, charId, "currency", "wild-sigil", -1);
    run(
      ctx.db,
      "INSERT INTO pending_tempers (artifact_id, character_id, options, request_hash, created_at) VALUES (?, ?, ?, ?, ?)",
      a.id,
      charId,
      JSON.stringify(options),
      env.provenance.requestHash,
      now(),
    );
    return logInference(ctx, { charId, artifactId: a.id, revision: a.revision, kind: "transform", action: "temper", env, runId: latestRunId(ctx, charId) });
  });
  return {
    options,
    familiar: env.result.summary,
    inference: log,
    focusSpent: cost,
    pending: false,
    policy: req.buildPolicy,
    requestHash: env.provenance.requestHash,
    offered: candidates.length,
  };
}

/** WU already spent on a Form (and its ancestors in this lineage step). */
const wuSpentOn = (ctx: Ctx, artifactId: string) =>
  get<{ wu: number }>(ctx.db, "SELECT COALESCE(SUM(work_units),0) AS wu FROM inference_events WHERE artifact_id = ?", artifactId)!.wu;

export function temperChoose(ctx: Ctx, charId: string, artifactId: string, candidateId: string) {
  const a = getArtifact(ctx, artifactId, charId);
  const pending = get<{ options: string; request_hash: string }>(ctx.db, "SELECT options, request_hash FROM pending_tempers WHERE artifact_id = ?", a.id);
  if (!pending) throw new HttpError(400, "no Temper in progress for this Form");
  const options = JSON.parse(pending.options) as TemperOption[];
  const choice = options.find((o) => o.candidateId === candidateId);
  if (!choice) throw new HttpError(400, "that Form was not among the choices");

  return tx(ctx.db, () => {
    const child = createArtifact(ctx, charId, { realityId: choice.realityId, realmId: a.objective_id, origin: "temper", parentId: a.id, tier: "attuned", acquisitionCost: 0 });
    const passives = passivesFor(ctx, charId);
    const readings = makeReadings(ctx, child, passives.readingNoise);
    const named = ruleFantasyName(choice.candidateId, readings.qualities);
    run(ctx.db, "UPDATE artifacts SET readings = ?, fantasy_name = ?, epithet = ?, revealed = '[]', run_id = ? WHERE id = ?", JSON.stringify(readings), named.fantasyName, named.epithet, a.run_id, child.id);
    run(ctx.db, "UPDATE artifacts SET status = 'tempered' WHERE id = ?", a.id);
    run(ctx.db, "DELETE FROM pending_tempers WHERE artifact_id = ?", a.id);

    // Objective outcomes (hidden truth) drive Mastery; inference never awards it.
    const before = trueEvaluation(ctx, a, "trialed");
    const after = trueEvaluation(ctx, getArtifact(ctx, child.id), "trialed");
    const dScore = round(after.technicalScore - before.technicalScore, 1);
    const dEff = round(after.efficiencyScore - before.efficiencyScore, 1);
    const dMargin = round(after.marginPotential - before.marginPotential);
    const mastery: MasteryChange[] = [];
    const craftOk = dScore >= 5 || (!!passives.valueSmith && dEff >= 5);
    mastery.push(recordMasteryEvent(ctx, charId, "craft", craftOk ? 1 : 0, `temper:${a.id}`));

    // Discovery: chosen candidate in top 25% of the opportunity set (technical or economic).
    const objective = objectiveOf(a);
    const m = marketContext(ctx);
    const set = options.map((o) => o.realityId);
    const neighborhood = ctx.reality.neighborsSync(a.reality_id, { limit: 16 }).map((n) => n.id);
    const pool = [...new Set([...set, ...neighborhood])];
    const techs = pool.map((id) => technicalScore(ctx.reality.candidateSync(id).qualities, objective));
    const margins = pool.map((id) => {
      const q = ctx.reality.candidateSync(id).qualities;
      return evaluateForm(q, productionRecipe(q), objective, "trialed", m).marginPotential;
    });
    const top = Math.max(percentileRank(techs, after.technicalScore), percentileRank(margins, after.marginPotential));
    mastery.push(recordMasteryEvent(ctx, charId, "discovery", top >= 0.75 ? 1 : 0, `temper-choice:${a.id}`));

    // Efficiency: meaningful improvement at below-median WU spend.
    const spent = wuSpentOn(ctx, a.id);
    if (dScore >= 5 || dEff >= 5) mastery.push(recordMasteryEvent(ctx, charId, "efficiency", spent <= 5 ? 1 : 0.4, `temper-eff:${a.id}`));

    // Commerce: crafting a more profitable Form.
    if (Math.abs(dMargin) >= 20 || Math.abs(dEff) >= 5) mastery.push(recordMasteryEvent(ctx, charId, "commerce", dMargin > 0 && after.marginPotential > 0 ? 1 : 0, `temper-margin:${a.id}`));

    return {
      artifact: artifactView(ctx, getArtifact(ctx, child.id)),
      parentId: a.id,
      shattered: options.filter((o) => o.candidateId !== candidateId).map((o) => o.candidateId),
      mastery,
      outcome: { improved: dScore >= 5, efficiencyImproved: dEff >= 5 },
    };
  });
}

// ───────────────────────────── Critique (Fracture) ─────────────────────────────

function critiqueRequest(ctx: Ctx, charId: string, a: ArtifactRow, mode: CritiqueRequest["mode"], trial?: CritiqueRequest["trial"]): CritiqueRequest {
  const passives = passivesFor(ctx, charId);
  const exact = a.evidence_tier === "trialed" || a.evidence_tier === "witnessed";
  const view = exact ? trueQualities(ctx, a) : readQualities(trueQualities(ctx, a), `${charId}:${a.reality_id}:critique`, passives.critiqueNoise);
  const ms = marketSummary(ctx, view);
  return {
    mode,
    artifact: { fantasyId: fantasyIdFor(a.reality_id), qualities: view },
    realmObjective: objectiveOf(a),
    marketContext: ms,
    buildPolicy: policyFor(ctx, charId),
    trial,
    wantSecond: mode === "deep" || !!passives.secondWeakness,
  };
}

/** Proof: the named weakness is one of the two largest actual weaknesses. */
function critiqueCorrect(ctx: Ctx, a: ArtifactRow, w: CritiqueResult["weakness"]): boolean {
  const q = trueQualities(ctx, a);
  if (w.kind === "technical" && w.quality) return weaknesses(q, objectiveOf(a)).slice(0, 2).some((x) => x.quality === w.quality);
  if (w.kind === "economic" && w.essence) {
    const m = marketContext(ctx);
    const recipe = productionRecipe(q);
    return costShare(recipe, m.prices, w.essence) > 0.4 && m.scarcity[w.essence] > 55;
  }
  return false;
}

export async function fracture(ctx: Ctx, charId: string, artifactId: string) {
  const a = getArtifact(ctx, artifactId, charId);
  requireTier(a, ["attuned", "trialed", "witnessed"], "fracture");
  spendFocus(ctx, charId, FOCUS_COST.fracture);
  const req = critiqueRequest(ctx, charId, a, "fracture");
  const env = await ctx.inference.critique(req);
  return tx(ctx.db, () => {
    const fam = a.familiar ? JSON.parse(a.familiar) : {};
    run(ctx.db, "UPDATE artifacts SET familiar = ? WHERE id = ?", JSON.stringify({ ...fam, critique: env.result }), a.id);
    const mastery: MasteryChange[] = [];
    const m = masteryOnce(ctx, charId, "proof", critiqueCorrect(ctx, a, env.result.weakness) ? 1 : 0, `fracture:${a.id}`);
    if (m) mastery.push(m);
    const log = logInference(ctx, { charId, artifactId: a.id, revision: a.revision, kind: "critique", action: "fracture", env, runId: latestRunId(ctx, charId) });
    return { artifact: artifactView(ctx, getArtifact(ctx, a.id)), critique: env.result, inference: log, mastery, focusSpent: FOCUS_COST.fracture };
  });
}

// ───────────────────────────── Trial / Mirror / Deep Trial ─────────────────────────────

function recordEvaluation(ctx: Ctx, a: ArtifactRow, kind: string, details: unknown) {
  const ev = trueEvaluation(ctx, getArtifact(ctx, a.id));
  run(
    ctx.db,
    "UPDATE artifacts SET technical_score = ?, production_cost = ?, market_value = ?, efficiency_score = ? WHERE id = ?",
    ev.technicalScore,
    ev.productionCost,
    ev.estimatedMarketValue,
    ev.efficiencyScore,
    a.id,
  );
  run(
    ctx.db,
    "INSERT INTO artifact_evaluations (id, artifact_id, kind, technical_score, production_cost, market_value, efficiency_score, margin, snapshot_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    newId("eval"),
    a.id,
    kind,
    ev.technicalScore,
    ev.productionCost,
    ev.estimatedMarketValue,
    ev.efficiencyScore,
    ev.marginPotential,
    currentSnapshot(ctx).id,
    JSON.stringify(details),
    now(),
  );
  return ev;
}

/** Trial: pure deterministic evaluation. No inference, no Focus. */
export function trial(ctx: Ctx, charId: string, artifactId: string) {
  const a = getArtifact(ctx, artifactId, charId);
  requireTier(a, ["attuned", "trialed", "witnessed"], "trial");
  return tx(ctx.db, () => {
    if (a.evidence_tier === "attuned") setTier(ctx, a, "trialed", "trialed");
    const ev = recordEvaluation(ctx, a, "trial", {});
    // The Binder's earlier reading is now checked against truth.
    const readings = a.readings ? (JSON.parse(a.readings) as Readings) : null;
    return {
      artifact: artifactView(ctx, getArtifact(ctx, a.id)),
      evaluation: {
        technicalScore: ev.technicalScore,
        contributions: ev.contributions,
        productionCost: ev.productionCost,
        efficiency: ev.efficiencyScore,
        marketValue: ev.estimatedMarketValue,
        margin: ev.marginPotential,
        power: ev.power,
        valueBreakdown: ev.value,
        predictedScore: readings?.predictedScore ?? null,
      },
    };
  });
}

function mirrorCheck(ctx: Ctx, charId: string, a: ArtifactRow, extraTolerance: number) {
  const q = trueQualities(ctx, a);
  const base = technicalScore(q, objectiveOf(a));
  const mirrorScores = mirrorObjectives(objectiveOf(a)).map((o) => technicalScore(q, o));
  const tolerance = 6 + (passivesFor(ctx, charId).mirrorTolerance ?? 0) + extraTolerance;
  const maxDeviation = round(Math.max(...mirrorScores.map((s) => Math.abs(s - base))), 1);
  return { technicalScore: base, mirrorScores, tolerance, maxDeviation, consistent: maxDeviation <= tolerance };
}

export async function mirror(ctx: Ctx, charId: string, artifactId: string) {
  const a = getArtifact(ctx, artifactId, charId);
  requireTier(a, ["trialed", "witnessed"], "mirror");
  const seal = itemQty(ctx, charId, "currency", "broken-seal") >= 1;
  const cost = FOCUS_COST.mirror - (seal ? 1 : 0);
  spendFocus(ctx, charId, cost);
  const check = mirrorCheck(ctx, charId, a, 0);
  const req = critiqueRequest(ctx, charId, a, "mirror", { technicalScore: check.technicalScore, mirrorScores: check.mirrorScores, tolerance: check.tolerance });
  const env = await ctx.inference.critique(req);
  return tx(ctx.db, () => {
    if (seal) addItem(ctx, charId, "currency", "broken-seal", -1);
    if (check.consistent && a.evidence_tier === "trialed") setTier(ctx, a, "witnessed", "witnessed by Mirror");
    recordEvaluation(ctx, a, "mirror", check);
    const fam = a.familiar ? JSON.parse(a.familiar) : {};
    run(ctx.db, "UPDATE artifacts SET familiar = ? WHERE id = ?", JSON.stringify({ ...fam, mirror: env.result }), a.id);
    const log = logInference(ctx, { charId, artifactId: a.id, revision: a.revision, kind: "critique", action: "mirror", env, runId: latestRunId(ctx, charId) });
    return { artifact: artifactView(ctx, getArtifact(ctx, a.id)), mirror: check, familiar: env.result, inference: log, focusSpent: cost };
  });
}

export async function deepTrial(ctx: Ctx, charId: string, artifactId: string) {
  let a = getArtifact(ctx, artifactId, charId);
  requireTier(a, ["attuned", "trialed", "witnessed"], "deep-trial");
  spendFocus(ctx, charId, FOCUS_COST["deep-trial"]);
  if (a.evidence_tier === "attuned") {
    trial(ctx, charId, a.id);
    a = getArtifact(ctx, a.id);
  }
  const check = mirrorCheck(ctx, charId, a, 3);
  const req = critiqueRequest(ctx, charId, a, "deep", { technicalScore: check.technicalScore, mirrorScores: check.mirrorScores, tolerance: check.tolerance });
  const env = await ctx.inference.critique(req);
  // Alternative comparison: the best neighbouring Form, by the same deterministic evaluator.
  const objective = objectiveOf(a);
  const m = marketContext(ctx);
  const alts = ctx.reality
    .neighborsSync(a.reality_id, { limit: 16 })
    .map((n) => ({ id: n.id, ev: evaluateForm(n.qualities, productionRecipe(n.qualities), objective, "trialed", m) }))
    .sort((x, y) => y.ev.technicalScore - x.ev.technicalScore);
  const bestTech = alts[0]!;
  const bestMargin = [...alts].sort((x, y) => y.ev.marginPotential - x.ev.marginPotential)[0]!;
  return tx(ctx.db, () => {
    if (check.consistent && a.evidence_tier === "trialed") setTier(ctx, a, "witnessed", "witnessed by Deep Trial");
    const ev = recordEvaluation(ctx, a, "deep-trial", check);
    const fam = a.familiar ? JSON.parse(a.familiar) : {};
    run(ctx.db, "UPDATE artifacts SET familiar = ? WHERE id = ?", JSON.stringify({ ...fam, critique: env.result, mirror: env.result }), a.id);
    const mastery: MasteryChange[] = [];
    const pm = masteryOnce(ctx, charId, "proof", critiqueCorrect(ctx, a, env.result.weakness) ? 1 : 0, `deep:${a.id}`);
    if (pm) mastery.push(pm);
    const log = logInference(ctx, { charId, artifactId: a.id, revision: a.revision, kind: "critique", action: "deep-trial", env, runId: latestRunId(ctx, charId) });
    return {
      artifact: artifactView(ctx, getArtifact(ctx, a.id)),
      mirror: check,
      critique: env.result,
      alternatives: {
        strongestNeighbor: { technicalScore: bestTech.ev.technicalScore, margin: bestTech.ev.marginPotential, beatsThis: bestTech.ev.technicalScore > ev.technicalScore },
        mostProfitableNeighbor: { technicalScore: bestMargin.ev.technicalScore, margin: bestMargin.ev.marginPotential, beatsThis: bestMargin.ev.marginPotential > ev.marginPotential },
      },
      inference: log,
      mastery,
      focusSpent: FOCUS_COST["deep-trial"],
    };
  });
}

