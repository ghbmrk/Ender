import { ESSENCE_IDS, clamp, rng, round, type EssenceId, type Rng } from "@weave/shared";
import { BOSS, CURRENCIES, REALMS, realmById, type CurrencyId, type EliteModifier, type EnemyKind, type RealmTemplate } from "@weave/content";
import { BASE_FOCUS, masteryEffects, technicalScore } from "@weave/domain";
import { all, get, now, run, tx } from "../db";
import type { Ctx } from "./context";
import { HttpError, addItem, adjustCrowns, charRow, combatStatsFor, getMastery, passivesFor } from "./character";
import { artifactView, createArtifact, getArtifact } from "./artifacts";
import { currentSnapshot } from "./world";

export const ARENA = { width: 1600, height: 1000 };

export type RoomKind = "combat" | "shrine" | "elite" | "boss";
export type PlannedEnemy = { kind: EnemyKind; x: number; y: number; elite?: EliteModifier };
export type RoomLoot = {
  crowns: number;
  essences: Partial<Record<EssenceId, number>>;
  forms: { realityId: string }[];
  currency?: CurrencyId;
};
export type PlannedRoom = {
  index: number;
  kind: RoomKind;
  obstacles: { x: number; y: number; w: number; h: number }[];
  waves: PlannedEnemy[][];
  loot: RoomLoot;
};
export type RunPlan = {
  runId: string;
  realmId: string;
  snapshotId: string;
  seed: string;
  difficulty: number;
  rooms: PlannedRoom[];
  boss: { name: string; hp: number; wardTargets: readonly number[] };
};

const ENEMY_COST: Record<EnemyKind, number> = { husk: 1, wisp: 1, hound: 1, keeper: 3, seer: 2, swarm: 2 };

function obstacles(r: Rng, kind: RoomKind) {
  if (kind === "shrine") return [];
  const out: PlannedRoom["obstacles"] = [];
  const n = kind === "boss" ? 4 : r.int(3, 6);
  for (let i = 0; i < n; i++) {
    const w = r.int(60, 160);
    const h = r.int(60, 160);
    let x = r.int(150, ARENA.width - 150 - w);
    let y = r.int(150, ARENA.height - 150 - h);
    // keep the entry lane (left-centre) and the arena centre clear
    if (Math.abs(x + w / 2 - ARENA.width / 2) < 220 && Math.abs(y + h / 2 - ARENA.height / 2) < 180) x = x < ARENA.width / 2 ? x - 260 : x + 260;
    if (x < 320 && Math.abs(y + h / 2 - ARENA.height / 2) < 200) y = y < ARENA.height / 2 ? y - 220 : y + 220;
    out.push({ x: clamp(x, 100, ARENA.width - 100 - w), y: clamp(y, 100, ARENA.height - 100 - h), w, h });
  }
  return out;
}

function spawnPoint(r: Rng) {
  // Enemies enter from the right two-thirds of the arena, away from the player's entry.
  return { x: r.int(Math.round(ARENA.width * 0.45), ARENA.width - 120), y: r.int(120, ARENA.height - 120) };
}

function composeWave(r: Rng, realm: RealmTemplate, budget: number): PlannedEnemy[] {
  const kinds = Object.keys(realm.enemyWeights) as EnemyKind[];
  const weights = kinds.map((k) => realm.enemyWeights[k]!);
  const out: PlannedEnemy[] = [];
  let left = budget;
  let guard = 0;
  while (left > 0 && guard++ < 50) {
    const k = r.weighted(kinds, weights);
    if (ENEMY_COST[k] > left && left < 3) continue;
    left -= ENEMY_COST[k];
    const p = spawnPoint(r);
    if (k === "swarm") for (let i = 0; i < 5; i++) out.push({ kind: "swarm", x: p.x + r.int(-40, 40), y: p.y + r.int(-40, 40) });
    else out.push({ kind: k, ...p });
  }
  return out;
}

function essenceDrop(r: Rng, realm: RealmTemplate, units: number, glut: Partial<Record<EssenceId, number>>) {
  const es = ESSENCE_IDS.filter((e) => realm.essenceDrops[e]);
  const w = es.map((e) => realm.essenceDrops[e]! * (glut[e] ?? 1));
  const out: Partial<Record<EssenceId, number>> = {};
  for (let i = 0; i < units; i++) {
    const e = r.weighted(es, w);
    out[e] = (out[e] ?? 0) + 1;
  }
  return out;
}

/**
 * Deterministic Realm generation from (worldSnapshotId, realmTemplate, runSeed).
 * Loot quality also depends on explicit bonuses (Charm power, Discovery mastery).
 */
export function generateRunPlan(
  ctx: Ctx,
  inp: { runId: string; snapshotId: string; realmId: string; seed: string; lootPercentileBonus: number; elitePercentileBonus: number },
): RunPlan {
  const realm = realmById(inp.realmId);
  const snapshot = ctx.snapshotById.get(inp.snapshotId)!;
  const r = rng(`${inp.snapshotId}|${realm.id}|${inp.seed}`);
  const glut: Partial<Record<EssenceId, number>> = {};
  for (const m of snapshot.realmModifiers) if (m.realmId === realm.id && m.factor < 1) glut[m.essence] = 1.6;

  const ranked = ctx.reality
    .all()
    .map((c) => ({ id: c.id, s: technicalScore(c.qualities, realm.objective) }))
    .sort((a, b) => a.s - b.s || a.id.localeCompare(b.id));
  const pickForm = (draws: number, bonus: number) => {
    let u = 0;
    for (let i = 0; i < draws; i++) u = Math.max(u, r.next());
    const p = clamp(u ** 0.85 + bonus / 100, 0, 0.995);
    return { realityId: ranked[Math.floor(p * ranked.length)]!.id };
  };

  const d = realm.difficulty;
  const rooms: PlannedRoom[] = [];
  for (let i = 0; i < 5; i++) {
    const waves = [composeWave(r, realm, 5 + 2 * i + 2 * d)];
    if (i >= 2) waves.push(composeWave(r, realm, 3 + i + d));
    rooms.push({
      index: i,
      kind: "combat",
      obstacles: obstacles(r, "combat"),
      waves,
      loot: {
        crowns: r.int(8, 15) + 3 * d,
        essences: essenceDrop(r, realm, r.int(3, 6), glut),
        forms: i === 0 || r.chance(0.45) ? [pickForm(1, inp.lootPercentileBonus)] : [],
      },
    });
  }
  rooms.push({ index: 5, kind: "shrine", obstacles: [], waves: [], loot: { crowns: 0, essences: {}, forms: [] } });
  const eliteKind: EnemyKind = r.pick(["keeper", "hound", "seer"] as const);
  const eliteMod: EliteModifier = r.pick(["hardened", "volatile"] as const);
  rooms.push({
    index: 6,
    kind: "elite",
    obstacles: obstacles(r, "elite"),
    waves: [[{ kind: eliteKind, x: ARENA.width - 300, y: ARENA.height / 2, elite: eliteMod }, ...composeWave(r, realm, 4 + d)]],
    loot: {
      crowns: 25 + 5 * d,
      essences: essenceDrop(r, realm, 8, glut),
      forms: [pickForm(2, inp.lootPercentileBonus + inp.elitePercentileBonus)],
      currency: r.chance(0.6) ? r.pick(Object.keys(CURRENCIES) as CurrencyId[]) : undefined,
    },
  });
  rooms.push({
    index: 7,
    kind: "boss",
    obstacles: obstacles(r, "boss"),
    waves: [],
    loot: {
      crowns: 60 + 15 * d,
      essences: essenceDrop(r, realm, 12, glut),
      forms: [pickForm(3, inp.lootPercentileBonus + inp.elitePercentileBonus), pickForm(2, inp.lootPercentileBonus)],
      currency: r.pick(Object.keys(CURRENCIES) as CurrencyId[]),
    },
  });
  return {
    runId: inp.runId,
    realmId: realm.id,
    snapshotId: inp.snapshotId,
    seed: inp.seed,
    difficulty: d,
    rooms,
    boss: { name: BOSS.name, hp: Math.round(BOSS.hp * (1 + 0.25 * (d - 1))), wardTargets: BOSS.wardTargets },
  };
}

/** What the client receives: layouts and enemies, not which real Forms hide in the loot. */
export function clientPlan(plan: RunPlan) {
  return {
    ...plan,
    rooms: plan.rooms.map((rm) => ({
      ...rm,
      loot: { crowns: rm.loot.crowns, essences: rm.loot.essences, veiledForms: rm.loot.forms.length, currency: rm.loot.currency ?? null },
    })),
  };
}

export function startRun(ctx: Ctx, charId: string, realmId: string) {
  realmById(realmId);
  return tx(ctx.db, () => {
    run(ctx.db, "UPDATE runs SET status = 'abandoned', completed_at = ? WHERE character_id = ? AND status = 'active'", now(), charId);
    const c = charRow(ctx, charId);
    const passives = passivesFor(ctx, charId);
    const me = masteryEffects(getMastery(ctx, charId));
    // Unused Focus converts to Crowns at the start of the next Realm.
    let converted = 0;
    if (c.runs_started > 0 && c.focus > 0) {
      converted = round(c.focus * me.focusConversion * passives.focusConversion);
      adjustCrowns(ctx, charId, converted);
    }
    const n = c.runs_started + 1;
    const focus = BASE_FOCUS + (passives.bonusFocus ?? 0);
    run(ctx.db, "UPDATE characters SET focus = ?, free_attunes_used = 0, runs_started = ? WHERE id = ?", focus, n, charId);
    const runId = `${charId}-run${n}`;
    const snapshot = currentSnapshot(ctx);
    const stats = combatStatsFor(ctx, charId);
    const plan = generateRunPlan(ctx, {
      runId,
      snapshotId: snapshot.id,
      realmId,
      seed: `${charId}:${n}`,
      lootPercentileBonus: stats.lootPercentileBonus,
      elitePercentileBonus: me.discoveryPercentile,
    });
    run(
      ctx.db,
      "INSERT INTO runs (id, character_id, realm_id, snapshot_id, seed, plan, status, rooms_granted, started_at) VALUES (?, ?, ?, ?, ?, ?, 'active', '[]', ?)",
      runId,
      charId,
      realmId,
      snapshot.id,
      plan.seed,
      JSON.stringify(plan),
      now(),
    );
    run(ctx.db, "INSERT INTO run_events (run_id, type, payload, created_at) VALUES (?, 'start', ?, ?)", runId, JSON.stringify({ realmId, focus, converted }), now());
    return { plan: clientPlan(plan), focus, focusConverted: converted, stats };
  });
}

type RunRow = { id: string; character_id: string; realm_id: string; plan: string; status: string; rooms_granted: string; started_at: string };

function getRun(ctx: Ctx, charId: string, runId: string) {
  const r = get<RunRow>(ctx.db, "SELECT * FROM runs WHERE id = ? AND character_id = ?", runId, charId);
  if (!r) throw new HttpError(404, `no run ${runId}`);
  return r;
}

function grantRooms(ctx: Ctx, charId: string, r: RunRow, rooms: number[]) {
  const plan = JSON.parse(r.plan) as RunPlan;
  const granted = new Set(JSON.parse(r.rooms_granted) as number[]);
  const loot = { crowns: 0, essences: {} as Partial<Record<EssenceId, number>>, artifacts: [] as string[], currencies: [] as string[] };
  for (const idx of [...new Set(rooms)].sort((a, b) => a - b)) {
    const room = plan.rooms[idx];
    if (!room || granted.has(idx)) continue;
    granted.add(idx);
    loot.crowns += room.loot.crowns;
    if (room.loot.crowns) adjustCrowns(ctx, charId, room.loot.crowns);
    for (const [e, q] of Object.entries(room.loot.essences)) {
      addItem(ctx, charId, "essence", e, q!);
      loot.essences[e as EssenceId] = (loot.essences[e as EssenceId] ?? 0) + q!;
    }
    for (const f of room.loot.forms) loot.artifacts.push(createArtifact(ctx, charId, { realityId: f.realityId, realmId: plan.realmId, origin: "drop", runId: r.id }).id);
    if (room.loot.currency) {
      addItem(ctx, charId, "currency", room.loot.currency, 1);
      loot.currencies.push(room.loot.currency);
    }
  }
  run(ctx.db, "UPDATE runs SET rooms_granted = ? WHERE id = ?", JSON.stringify([...granted].sort((a, b) => a - b)), r.id);
  return loot;
}

/** Bank loot from cleared rooms mid-run (e.g. on reaching the shrine), so Forms can be Attuned there. */
export function checkpointRun(ctx: Ctx, charId: string, runId: string, roomsCleared: number[]) {
  const r = getRun(ctx, charId, runId);
  if (r.status !== "active") throw new HttpError(400, `run is ${r.status}`);
  return tx(ctx.db, () => {
    const loot = grantRooms(ctx, charId, r, roomsCleared.filter((i) => i < 7));
    run(ctx.db, "INSERT INTO run_events (run_id, type, payload, created_at) VALUES (?, 'checkpoint', ?, ?)", runId, JSON.stringify({ roomsCleared, loot }), now());
    return { loot, artifacts: loot.artifacts.map((id) => artifactView(ctx, getArtifact(ctx, id))) };
  });
}

export type RunCompletion = {
  outcome: "victory" | "death" | "abandon";
  roomsCleared: number[];
  kills?: Partial<Record<string, number>>;
  durationMs?: number;
  deaths?: number;
  bossPhaseMs?: number[];
  wardBreaks?: number;
};

export function completeRun(ctx: Ctx, charId: string, runId: string, body: RunCompletion) {
  const r = getRun(ctx, charId, runId);
  if (r.status !== "active") throw new HttpError(400, `run is ${r.status}`);
  return tx(ctx.db, () => {
    // Boss loot only on victory; loot from cleared rooms is kept on death.
    const rooms = body.roomsCleared.filter((i) => i < 7 || (i === 7 && body.outcome === "victory"));
    const loot = grantRooms(ctx, charId, r, rooms);
    const status = body.outcome === "victory" ? "victory" : body.outcome === "death" ? "death" : "abandoned";
    const all_ = get<{ rooms_granted: string }>(ctx.db, "SELECT rooms_granted FROM runs WHERE id = ?", runId)!;
    const result = { ...body, lootThisCall: loot, roomsGranted: JSON.parse(all_.rooms_granted) };
    run(ctx.db, "UPDATE runs SET status = ?, result = ?, completed_at = ? WHERE id = ?", status, JSON.stringify(result), now(), runId);
    run(ctx.db, "INSERT INTO run_events (run_id, type, payload, created_at) VALUES (?, 'complete', ?, ?)", runId, JSON.stringify(body), now());
    const artifacts = all<{ id: string }>(ctx.db, "SELECT id FROM artifacts WHERE run_id = ? AND origin = 'drop' ORDER BY rowid", runId).map((x) => artifactView(ctx, getArtifact(ctx, x.id)));
    return { status, loot, runArtifacts: artifacts };
  });
}

export function realmsOverview() {
  return REALMS.map((r) => ({ id: r.id, name: r.name, difficulty: r.difficulty }));
}
