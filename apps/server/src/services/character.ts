import { grantStarterKit } from "./loom";
import { ESSENCE_IDS, MASTERY_DOMAINS, type Character, type EssenceId, type MasteryDomain, type MasteryState, type SearchPolicy } from "@ender/shared";
import { boardRadius, capacityForRank } from "@ender/battle";
import {
  BASE_FOCUS,
  DEFAULT_POLICY,
  PRESET_POLICIES,
  emptyMastery,
  levelForXp,
  masteryDisplay,
  masteryEffects,
  recordMastery,
  xpRequired,
  LEVEL_CAP,
} from "@ender/domain";
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
  build_policy: string;
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
  grantStarterKit(ctx, id);
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
    buildPolicy: JSON.parse(r.build_policy),
  };
}

export const charRow = (ctx: Ctx, id: string) => get<CharRow>(ctx.db, "SELECT * FROM characters WHERE id = ?", id)!;

/** The Familiar's search policy. There is no passive tree any more (§90), so it is the character's own policy. */
export function policyFor(ctx: Ctx, id: string): SearchPolicy {
  return getCharacter(ctx, id).buildPolicy;
}

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
  run(ctx.db, "UPDATE characters SET xp = ?, level = ? WHERE id = ?", newXp, newLevel, charId);
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

/** Score the Binder believes an untrialed Form has (from Attuned readings). */
export function estimatedScore(ctx: Ctx, artifactId: string): number {
  const a = get<{ readings: string | null; objective_id: string }>(ctx.db, "SELECT readings, objective_id FROM artifacts WHERE id = ?", artifactId);
  if (!a?.readings) return 0;
  return (JSON.parse(a.readings) as { predictedScore: number }).predictedScore ?? 0;
}

/**
 * The character's structural progression: Loom Rank (the old level, capped at 20, §56), Loom Capacity and board size.
 * No gear, no passive points, no +stat nodes (§47, §90); power comes from the Root, the crafted Loom and Mastery.
 */
export function characterView(ctx: Ctx, charId: string) {
  const c = getCharacter(ctx, charId);
  return {
    ...c,
    rank: c.level,
    capacity: capacityForRank(c.level),
    boardRadius: boardRadius(c.level),
    xpForNext: c.level >= LEVEL_CAP ? null : xpRequired(c.level + 1),
    xpForLevel: xpRequired(c.level),
    effectivePolicy: c.buildPolicy,
    masteryDisplay: Object.fromEntries(MASTERY_DOMAINS.map((d) => [d, masteryDisplay(c.mastery[d])])),
    masteryEffects: masteryEffects(c.mastery),
    essences: essences(ctx, charId),
    currencies: currencies(ctx, charId),
    mirrorCharges: itemQty(ctx, charId, "charge", "mirror"),
    maxFocus: BASE_FOCUS,
    world: { snapshotId: currentSnapshot(ctx).id, date: currentSnapshot(ctx).date },
  };
}
