import { ESSENCE_IDS, MASTERY_DOMAINS, type Character, type EssenceId, type GearSlot, type MasteryDomain, type MasteryState, type SearchPolicy } from "@weave/shared";
import {
  BASE_FOCUS,
  DEFAULT_POLICY,
  PRESET_POLICIES,
  aggregatePassives,
  artifactPower,
  computeCombatStats,
  effectivePolicy,
  emptyMastery,
  levelForXp,
  masteryDisplay,
  masteryEffects,
  recordMastery,
  xpRequired,
  LEVEL_CAP,
} from "@weave/domain";
import { all, get, now, run, tx } from "../db";
import type { Ctx } from "./context";
import { currentSnapshot } from "./world";

export type Preset = keyof typeof PRESET_POLICIES;

type CharRow = {
  id: string;
  name: string;
  preset: string | null;
  level: number;
  xp: number;
  crowns: number;
  focus: number;
  free_attunes_used: number;
  passive_points: number;
  build_policy: string;
  equipped: string;
  runs_started: number;
};

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export const STARTING_CROWNS = 250;
export const STARTING_ESSENCES: Partial<Record<EssenceId, number>> = { ember: 6, tide: 6, storm: 6, root: 6, glass: 6, ash: 10 };

export function createCharacter(ctx: Ctx, opts: { name?: string; preset?: Preset } = {}): Character {
  const n = get<{ n: number }>(ctx.db, "SELECT COUNT(*) AS n FROM characters")!.n + 1;
  const id = `binder-${n}`;
  const policy: SearchPolicy = opts.preset ? PRESET_POLICIES[opts.preset] : DEFAULT_POLICY;
  tx(ctx.db, () => {
    run(ctx.db, "UPDATE characters SET active = 0");
    run(
      ctx.db,
      "INSERT INTO characters (id, name, preset, level, xp, crowns, focus, passive_points, build_policy, equipped, active, created_at) VALUES (?, ?, ?, 1, 0, ?, ?, 0, ?, '{}', 1, ?)",
      id,
      opts.name ?? (opts.preset ? `${opts.preset[0]!.toUpperCase()}${opts.preset.slice(1)}` : "Binder"),
      opts.preset ?? null,
      STARTING_CROWNS,
      BASE_FOCUS,
      JSON.stringify(policy),
      now(),
    );
    for (const d of MASTERY_DOMAINS) run(ctx.db, "INSERT INTO character_mastery VALUES (?, ?, 0, 0, 0)", id, d);
    for (const [e, q] of Object.entries(STARTING_ESSENCES)) addItem(ctx, id, "essence", e, q!);
  });
  return getCharacter(ctx, id);
}

export function activeCharacterId(ctx: Ctx): string {
  const row = get<{ id: string }>(ctx.db, "SELECT id FROM characters WHERE active = 1 ORDER BY created_at DESC LIMIT 1");
  if (row) return row.id;
  return createCharacter(ctx).id;
}

export function getMastery(ctx: Ctx, id: string): Record<MasteryDomain, MasteryState> {
  const m = emptyMastery();
  for (const r of all<{ domain: MasteryDomain; successes: number; failures: number; opportunities: number }>(
    ctx.db,
    "SELECT domain, successes, failures, opportunities FROM character_mastery WHERE character_id = ?",
    id,
  ))
    m[r.domain] = { successes: r.successes, failures: r.failures, opportunities: r.opportunities };
  return m;
}

export function passiveIds(ctx: Ctx, id: string): string[] {
  return all<{ passive_id: string }>(ctx.db, "SELECT passive_id FROM passive_allocations WHERE character_id = ? ORDER BY allocated_at", id).map((r) => r.passive_id);
}

export function getCharacter(ctx: Ctx, id: string): Character {
  const r = get<CharRow>(ctx.db, "SELECT * FROM characters WHERE id = ?", id);
  if (!r) throw new HttpError(404, `no character ${id}`);
  return {
    id: r.id,
    name: r.name,
    level: r.level,
    xp: r.xp,
    crowns: Math.round(r.crowns * 100) / 100,
    focus: r.focus,
    mastery: getMastery(ctx, id),
    passivePointsAvailable: r.passive_points,
    buildPolicy: JSON.parse(r.build_policy),
    equipped: JSON.parse(r.equipped),
  };
}

export const charRow = (ctx: Ctx, id: string) => get<CharRow>(ctx.db, "SELECT * FROM characters WHERE id = ?", id)!;

export function policyFor(ctx: Ctx, id: string): SearchPolicy {
  return effectivePolicy(getCharacter(ctx, id).buildPolicy, passiveIds(ctx, id));
}

export const passivesFor = (ctx: Ctx, id: string) => aggregatePassives(passiveIds(ctx, id));

export function adjustCrowns(ctx: Ctx, id: string, delta: number) {
  const c = charRow(ctx, id);
  if (c.crowns + delta < -1e-6) throw new HttpError(400, "not enough Crowns");
  run(ctx.db, "UPDATE characters SET crowns = ? WHERE id = ?", Math.round((c.crowns + delta) * 100) / 100, id);
}

export function spendFocus(ctx: Ctx, id: string, cost: number) {
  if (cost <= 0) return;
  const c = charRow(ctx, id);
  if (c.focus < cost) throw new HttpError(400, `needs ${cost} Focus (have ${c.focus})`);
  run(ctx.db, "UPDATE characters SET focus = focus - ? WHERE id = ?", cost, id);
}

export function itemQty(ctx: Ctx, id: string, type: string, itemId: string): number {
  return get<{ quantity: number }>(ctx.db, "SELECT quantity FROM inventory WHERE character_id = ? AND item_type = ? AND item_id = ?", id, type, itemId)?.quantity ?? 0;
}

export function addItem(ctx: Ctx, id: string, type: string, itemId: string, qty: number) {
  const have = itemQty(ctx, id, type, itemId);
  if (have + qty < -1e-9) throw new HttpError(400, `not enough ${itemId}`);
  run(
    ctx.db,
    "INSERT INTO inventory (character_id, item_type, item_id, quantity) VALUES (?, ?, ?, ?) ON CONFLICT(character_id, item_type, item_id) DO UPDATE SET quantity = excluded.quantity",
    id,
    type,
    itemId,
    have + qty,
  );
}

export function essences(ctx: Ctx, id: string): Record<EssenceId, number> {
  return Object.fromEntries(ESSENCE_IDS.map((e) => [e, itemQty(ctx, id, "essence", e)])) as Record<EssenceId, number>;
}

export function currencies(ctx: Ctx, id: string) {
  return all<{ item_id: string; quantity: number }>(ctx.db, "SELECT item_id, quantity FROM inventory WHERE character_id = ? AND item_type = 'currency' AND quantity > 0", id);
}

/** Award XP at most once per (character, artifact revision, action). Returns XP granted. */
export function awardXp(ctx: Ctx, charId: string, key: string, xp: number): { xp: number; levelsGained: number } {
  if (xp <= 0) return { xp: 0, levelsGained: 0 };
  const exists = get(ctx.db, "SELECT 1 FROM xp_awards WHERE award_key = ?", key);
  if (exists) return { xp: 0, levelsGained: 0 };
  run(ctx.db, "INSERT INTO xp_awards (award_key, xp, created_at) VALUES (?, ?, ?)", key, xp, now());
  const c = charRow(ctx, charId);
  const newXp = c.xp + xp;
  const newLevel = Math.min(LEVEL_CAP, levelForXp(newXp));
  const gained = newLevel - c.level;
  run(ctx.db, "UPDATE characters SET xp = ?, level = ?, passive_points = passive_points + ? WHERE id = ?", newXp, newLevel, Math.max(0, gained), charId);
  return { xp, levelsGained: Math.max(0, gained) };
}

export function recordMasteryEvent(ctx: Ctx, charId: string, domain: MasteryDomain, success: number, reason: string) {
  const m = getMastery(ctx, charId)[domain];
  const next = recordMastery(m, success);
  run(ctx.db, "UPDATE character_mastery SET successes = ?, failures = ?, opportunities = ? WHERE character_id = ? AND domain = ?", next.successes, next.failures, next.opportunities, charId, domain);
  run(ctx.db, "INSERT INTO mastery_events (character_id, domain, success, reason, level, created_at) VALUES (?, ?, ?, ?, ?, ?)", charId, domain, success, reason, charRow(ctx, charId).level, now());
  return { domain, success, reason, before: masteryDisplay(m), after: masteryDisplay(next) };
}
export type MasteryChange = ReturnType<typeof recordMasteryEvent>;

export function equippedPowers(ctx: Ctx, charId: string): Partial<Record<GearSlot, number>> {
  const eq = getCharacter(ctx, charId).equipped;
  const out: Partial<Record<GearSlot, number>> = {};
  for (const [slot, aid] of Object.entries(eq) as [GearSlot, string][]) {
    const a = get<{ technical_score: number | null; evidence_tier: string; readings: string | null }>(ctx.db, "SELECT technical_score, evidence_tier, readings FROM artifacts WHERE id = ?", aid);
    if (!a) continue;
    out[slot] = artifactPower(a.technical_score ?? estimatedScore(ctx, aid), a.evidence_tier as never);
  }
  return out;
}

/** Score the Binder believes an untrialed Form has (from Attuned readings). */
export function estimatedScore(ctx: Ctx, artifactId: string): number {
  const a = get<{ readings: string | null; objective_id: string }>(ctx.db, "SELECT readings, objective_id FROM artifacts WHERE id = ?", artifactId);
  if (!a?.readings) return 0;
  return (JSON.parse(a.readings) as { predictedScore: number }).predictedScore ?? 0;
}

export function combatStatsFor(ctx: Ctx, charId: string) {
  const c = getCharacter(ctx, charId);
  const p = passivesFor(ctx, charId);
  const stats = computeCombatStats({
    level: c.level,
    equippedPower: equippedPowers(ctx, charId),
    passive: { damagePct: p.damagePct ?? 0, healthFlat: p.healthFlat ?? 0, critChance: p.critChance ?? 0 },
  });
  const me = masteryEffects(c.mastery);
  return { ...stats, wardMultiplier: Math.round(me.proofWardMultiplier * p.wardDamage * 1000) / 1000 };
}

export function characterView(ctx: Ctx, charId: string) {
  const c = getCharacter(ctx, charId);
  const passives = passiveIds(ctx, charId);
  const agg = aggregatePassives(passives);
  return {
    ...c,
    xpForNext: c.level >= LEVEL_CAP ? null : xpRequired(c.level + 1),
    xpForLevel: xpRequired(c.level),
    effectivePolicy: effectivePolicy(c.buildPolicy, passives),
    masteryDisplay: Object.fromEntries(MASTERY_DOMAINS.map((d) => [d, masteryDisplay(c.mastery[d])])),
    masteryEffects: masteryEffects(c.mastery),
    passives,
    passiveEffects: agg,
    stats: combatStatsFor(ctx, charId),
    essences: essences(ctx, charId),
    currencies: currencies(ctx, charId),
    maxFocus: BASE_FOCUS + (agg.bonusFocus ?? 0),
    world: { snapshotId: currentSnapshot(ctx).id, date: currentSnapshot(ctx).date },
  };
}
