import { ESSENCE_IDS, clamp, rng, round, type EssenceId, type Rng } from "@ender/shared";
import { CURRENCIES, REALMS, realmById, type CurrencyId, type EnemyKind, type RealmTemplate } from "@ender/content";
import { BASE_FOCUS, masteryEffects, technicalScore } from "@ender/domain";
import { FOES, type FoeKind } from "@ender/battle";
import { all, get, now, run, tx } from "../db";
import type { Ctx } from "./context";
import { HttpError, addItem, adjustCrowns, awardXp, charRow, characterView, getMastery } from "./character";
import { artifactView, createArtifact, getArtifact, type ArtifactView } from "./artifacts";
import { loomSnapshot, type LoomSnapshot } from "./loom";
import { currentSnapshot } from "./world";

// ───────────────────────────── The expedition map (§76–77) ─────────────────────────────

export type NodeKind = "combat" | "elite" | "shrine" | "attunement" | "bazaar" | "contract" | "mystery" | "boss";
export type Encounter = { waves: FoeKind[][]; difficulty: number; /** Battle seed for this node. */ seed: string };
export type MapNode = { id: string; layer: number; kind: NodeKind; links: string[]; encounter?: Encounter };
export type RunPlan = {
  runId: string;
  realmId: string;
  snapshotId: string;
  seed: string;
  difficulty: number;
  boss: FoeKind;
  map: { layers: MapNode[][] };
};

export const FIGHT_KINDS: NodeKind[] = ["combat", "elite", "boss"];
export const isFight = (n: MapNode) => !!n.encounter;

/**
 * §76 structure: Encounter → Choice → Encounter → Craft/Attune → Elite → Market/Contract → Boss → Return.
 * Each entry lists the kinds a layer may hold: `always` are placed first, the rest fill up to the node count.
 */
const LAYERS: { count: [number, number]; always: NodeKind[]; fill: NodeKind[] }[] = [
  { count: [2, 2], always: ["combat", "combat"], fill: [] },
  { count: [2, 3], always: [], fill: ["mystery", "shrine", "combat", "bazaar"] },
  { count: [2, 3], always: ["combat", "combat"], fill: ["combat", "mystery"] },
  { count: [2, 3], always: ["attunement", "shrine"], fill: ["mystery"] },
  { count: [2, 2], always: ["elite", "elite"], fill: [] },
  { count: [2, 3], always: ["bazaar", "contract"], fill: ["shrine"] },
  { count: [1, 1], always: ["boss"], fill: [] },
];

/** Non-crossing links between two ordered layers: a monotone lattice path from (0,0) to (n−1,m−1), so every node has a way in and out. */
function linkLayers(r: Rng, from: MapNode[], to: MapNode[]) {
  let i = 0;
  let j = 0;
  from[0]!.links.push(to[0]!.id);
  while (i < from.length - 1 || j < to.length - 1) {
    const canI = i < from.length - 1;
    const canJ = j < to.length - 1;
    const step = canI && canJ ? r.pick(["i", "j", "both"] as const) : canI ? "i" : "j";
    if (step !== "j") i++;
    if (step !== "i") j++;
    from[i]!.links.push(to[j]!.id);
  }
  for (const n of from) n.links = [...new Set(n.links)].sort((a, b) => to.findIndex((x) => x.id === a) - to.findIndex((x) => x.id === b));
}

const NORMAL_KINDS: EnemyKind[] = ["husk", "wisp", "hound", "keeper", "seer", "swarm"];

/** 1–3 normal foes from the Realm's weights (a Keeper counts double; a Swarm is one foe now). */
function normalWave(r: Rng, realm: RealmTemplate, max: number): FoeKind[] {
  const kinds = NORMAL_KINDS.filter((k) => realm.enemyWeights[k]);
  const weights = kinds.map((k) => realm.enemyWeights[k]!);
  const out: FoeKind[] = [];
  let left = r.int(1, max);
  for (let guard = 0; left > 0 && guard < 20; guard++) {
    const k = r.weighted(kinds, weights);
    const cost = k === "keeper" ? 2 : 1;
    if (cost > left && out.length) continue;
    out.push(k);
    left -= cost;
  }
  return out;
}

function encounterFor(r: Rng, realm: RealmTemplate, kind: NodeKind, layer: number, seed: string): Encounter | undefined {
  const difficulty = realm.difficulty;
  if (kind === "combat" || kind === "mystery") {
    const waves = [normalWave(r, realm, layer >= 2 ? 3 : 2)];
    if (layer >= 2 && r.chance(0.3)) waves.push(normalWave(r, realm, 2));
    return { waves, difficulty, seed };
  }
  if (kind === "elite") return { waves: [[r.pick(["ironbound", "cinder"] as const), ...normalWave(r, realm, 2).slice(0, 2)]], difficulty, seed };
  if (kind === "boss") return { waves: [[realm.boss]], difficulty, seed };
  return undefined;
}

/** Deterministic expedition from (worldSnapshotId, realm, runSeed). */
export function generateRunPlan(ctx: Ctx, inp: { runId: string; snapshotId: string; realmId: string; seed: string }): RunPlan {
  const realm = realmById(inp.realmId);
  const key = `${inp.snapshotId}|${realm.id}|${inp.seed}`;
  const r = rng(key);
  const layers: MapNode[][] = LAYERS.map((spec, layer) => {
    const count = r.int(spec.count[0], spec.count[1]);
    const kinds = [...spec.always];
    const fill = [...spec.fill];
    while (kinds.length < count && fill.length) kinds.push(fill.splice(Math.floor(r.next() * fill.length), 1)[0]!);
    // Shuffle so the same kind does not always sit on the same side.
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = Math.floor(r.next() * (i + 1));
      [kinds[i], kinds[j]] = [kinds[j]!, kinds[i]!];
    }
    return kinds.slice(0, count).map((kind, i) => {
      const id = `L${layer}N${i}`;
      // A Mystery resolves deterministically: 40% it is an ambush (a normal fight), otherwise a small reward.
      const fight = kind === "mystery" ? r.chance(0.4) : FIGHT_KINDS.includes(kind);
      const node: MapNode = { id, layer, kind, links: [] };
      const enc = fight ? encounterFor(r, realm, kind, layer, `${key}|${id}`) : undefined;
      if (enc) node.encounter = enc;
      return node;
    });
  });
  for (let l = 0; l < layers.length - 1; l++) linkLayers(r, layers[l]!, layers[l + 1]!);
  return {
    runId: inp.runId,
    realmId: realm.id,
    snapshotId: inp.snapshotId,
    seed: inp.seed,
    difficulty: realm.difficulty,
    boss: realm.boss,
    map: { layers },
  };
}

export const planNodes = (plan: RunPlan) => plan.map.layers.flat();
export const findNode = (plan: RunPlan, id: string) => planNodes(plan).find((n) => n.id === id);

// ───────────────────────────── Loot (§78) ─────────────────────────────

export type NodeLoot = {
  crowns: number;
  essences: Partial<Record<EssenceId, number>>;
  forms: { realityId: string }[];
  mirrorCharges: number;
  currency?: CurrencyId;
  xp: number;
};
export type LootClass = "essence" | "form" | "both";

/** §78 normal-fight cadence: 70% Essence, 25% a Veiled Form, 5% both. */
export const normalLootClass = (u: number): LootClass => (u < 0.7 ? "essence" : u < 0.95 ? "form" : "both");

export const RANK_XP: Record<"combat" | "elite" | "boss", number> = { combat: 25, elite: 60, boss: 150 };

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
 * Roll one node's loot with the run's seeded RNG (keyed per node, so the order of visits does not matter).
 * Normal: §78 cadence. Elite: a Veiled Form and Essences. Boss: two Veiled Forms, a high-tier Essence bundle and a
 * Mirror charge. No equipment ever drops.
 */
export function rollNodeLoot(ctx: Ctx, plan: RunPlan, node: MapNode, discoveryBonus = 0): NodeLoot {
  const realm = realmById(plan.realmId);
  const snapshot = ctx.snapshotById.get(plan.snapshotId)!;
  const r = rng(`${plan.snapshotId}|${plan.realmId}|${plan.seed}|loot|${node.id}`);
  const d = plan.difficulty;
  const glut: Partial<Record<EssenceId, number>> = {};
  for (const m of snapshot.realmModifiers) if (m.realmId === realm.id && m.factor < 1) glut[m.essence] = 1.6;
  const ranked = rankedCorpus(ctx, realm);
  const pickForm = (draws: number, bonus: number) => {
    let u = 0;
    for (let i = 0; i < draws; i++) u = Math.max(u, r.next());
    const p = clamp(u ** 0.85 + bonus / 100, 0, 0.995);
    return { realityId: ranked[Math.floor(p * ranked.length)]! };
  };
  const loot: NodeLoot = { crowns: 0, essences: {}, forms: [], mirrorCharges: 0, xp: 0 };
  if (node.kind === "boss") {
    loot.crowns = 50 + 15 * d;
    loot.forms = [pickForm(3, discoveryBonus), pickForm(2, discoveryBonus)];
    // High-tier bundle: the Realm's usual Essences plus the dearest Essence of this turning.
    const dearest = [...ESSENCE_IDS].sort((a, b) => snapshot.essenceScarcity[b] - snapshot.essenceScarcity[a] || a.localeCompare(b))[0]!;
    loot.essences = essenceDrop(r, realm, 8 + 2 * d, glut);
    loot.essences[dearest] = (loot.essences[dearest] ?? 0) + 4;
    loot.mirrorCharges = 1;
    loot.xp = RANK_XP.boss;
  } else if (node.kind === "elite") {
    loot.crowns = 20 + 5 * d;
    loot.forms = [pickForm(2, discoveryBonus)];
    loot.essences = essenceDrop(r, realm, r.int(5, 7), glut);
    loot.xp = RANK_XP.elite;
  } else if (node.encounter) {
    // A normal fight (including a Mystery ambush).
    loot.crowns = r.int(6, 12) + 3 * d;
    const cls = normalLootClass(r.next());
    if (cls !== "form") loot.essences = essenceDrop(r, realm, r.int(3, 5), glut);
    if (cls !== "essence") loot.forms = [pickForm(1, 0)];
    loot.xp = RANK_XP.combat;
  } else if (node.kind === "mystery") {
    // A quiet Mystery: a small cache, sometimes a curio.
    loot.crowns = r.int(10, 20);
    loot.essences = essenceDrop(r, realm, 2, glut);
    if (r.chance(0.25)) loot.currency = r.pick(Object.keys(CURRENCIES) as CurrencyId[]);
  }
  return loot;
}

const rankedCache = new WeakMap<Ctx, Map<string, string[]>>();
function rankedCorpus(ctx: Ctx, realm: RealmTemplate): string[] {
  let byRealm = rankedCache.get(ctx);
  if (!byRealm) rankedCache.set(ctx, (byRealm = new Map()));
  let ids = byRealm.get(realm.id);
  if (!ids) {
    ids = ctx.reality
      .all()
      .map((c) => ({ id: c.id, s: technicalScore(c.qualities, realm.objective) }))
      .sort((a, b) => a.s - b.s || a.id.localeCompare(b.id))
      .map((x) => x.id);
    byRealm.set(realm.id, ids);
  }
  return ids;
}

// ───────────────────────────── Runs ─────────────────────────────

type RunRow = { id: string; character_id: string; realm_id: string; plan: string; status: string; visited: string; loom_snapshot: string | null; started_at: string };

function getRun(ctx: Ctx, charId: string, runId: string) {
  const r = get<RunRow>(ctx.db, "SELECT * FROM runs WHERE id = ? AND character_id = ?", runId, charId);
  if (!r) throw new HttpError(404, `no run ${runId}`);
  return r;
}

export function runView(ctx: Ctx, charId: string, runId: string) {
  const r = getRun(ctx, charId, runId);
  return {
    plan: JSON.parse(r.plan) as RunPlan,
    status: r.status,
    visited: JSON.parse(r.visited) as string[],
    loom: r.loom_snapshot ? (JSON.parse(r.loom_snapshot) as LoomSnapshot) : null,
  };
}

export function activeRunId(ctx: Ctx, charId: string): string | null {
  return get<{ id: string }>(ctx.db, "SELECT id FROM runs WHERE character_id = ? AND status = 'active' ORDER BY rowid DESC LIMIT 1", charId)?.id ?? null;
}

export function startRun(ctx: Ctx, charId: string, realmId: string) {
  realmById(realmId);
  return tx(ctx.db, () => {
    run(ctx.db, "UPDATE runs SET status = 'abandoned', completed_at = ? WHERE character_id = ? AND status = 'active'", now(), charId);
    const c = charRow(ctx, charId);
    const me = masteryEffects(getMastery(ctx, charId));
    // Unused Focus converts to Crowns at the start of the next expedition.
    let converted = 0;
    if (c.runs_started > 0 && c.focus > 0) {
      converted = round(c.focus * me.focusConversion);
      adjustCrowns(ctx, charId, converted);
    }
    const n = c.runs_started + 1;
    const focus = BASE_FOCUS;
    run(ctx.db, "UPDATE characters SET focus = ?, free_attunes_used = 0, runs_started = ? WHERE id = ?", focus, n, charId);
    const runId = `${charId}-run${n}`;
    const snapshot = currentSnapshot(ctx);
    const plan = generateRunPlan(ctx, { runId, snapshotId: snapshot.id, realmId, seed: `${charId}:${n}` });
    // The Loom as it leaves the hub is what the first fights use (§80).
    const loom = loomSnapshot(ctx, charId);
    run(
      ctx.db,
      "INSERT INTO runs (id, character_id, realm_id, snapshot_id, seed, plan, status, rooms_granted, visited, loom_snapshot, started_at) VALUES (?, ?, ?, ?, ?, ?, 'active', '[]', '[]', ?, ?)",
      runId,
      charId,
      realmId,
      snapshot.id,
      plan.seed,
      JSON.stringify(plan),
      JSON.stringify(loom),
      now(),
    );
    run(ctx.db, "INSERT INTO run_events (run_id, type, payload, created_at) VALUES (?, 'start', ?, ?)", runId, JSON.stringify({ realmId, focus, converted }), now());
    return { plan, focus, focusConverted: converted, loom };
  });
}

/** Save the Loom snapshot that the next fights use (§80): after a Shrine, after a fight's weaving, or at the hub. */
export function checkpointRun(ctx: Ctx, charId: string, runId: string) {
  const r = getRun(ctx, charId, runId);
  if (r.status !== "active") throw new HttpError(400, `run is ${r.status}`);
  const plan = JSON.parse(r.plan) as RunPlan;
  const visited = JSON.parse(r.visited) as string[];
  const last = visited.length ? findNode(plan, visited.at(-1)!) : null;
  // Ender (Mark, 2026-10-01): weaving follows each fight, so the Loom may be re-threaded after any visited node.
  const loom = loomSnapshot(ctx, charId);
  run(ctx.db, "UPDATE runs SET loom_snapshot = ? WHERE id = ?", JSON.stringify(loom), runId);
  run(ctx.db, "INSERT INTO run_events (run_id, type, payload, created_at) VALUES (?, 'loom-snapshot', ?, ?)", runId, JSON.stringify({ at: last?.id ?? "hub" }), now());
  return { loom };
}

export type NodeOutcome = "victory" | "defeat" | "skip";

/** Resolve one map node: validate the path, roll and grant loot (§78), award Loom Rank XP, record the visit. */
export function resolveNode(ctx: Ctx, charId: string, runId: string, body: { nodeId: string; outcome: NodeOutcome; kills?: Record<string, number> }) {
  const r = getRun(ctx, charId, runId);
  if (r.status !== "active") throw new HttpError(400, `run is ${r.status}`);
  const plan = JSON.parse(r.plan) as RunPlan;
  const visited = JSON.parse(r.visited) as string[];
  const node = findNode(plan, body.nodeId);
  if (!node) throw new HttpError(404, `no node ${body.nodeId}`);
  if (visited.includes(node.id)) throw new HttpError(400, "node already visited");
  const last = visited.length ? findNode(plan, visited.at(-1)!)! : null;
  const reachable = last ? last.links.includes(node.id) : node.layer === 0;
  if (!reachable) throw new HttpError(400, `node ${node.id} is not reachable from ${last?.id ?? "the start"}`);
  if (isFight(node) && body.outcome === "skip") throw new HttpError(400, "a fight cannot be skipped");

  return tx(ctx.db, () => {
    const rewards = { crowns: 0, essences: {} as Partial<Record<EssenceId, number>>, forms: [] as ArtifactView[], mirrorCharges: 0, currency: null as CurrencyId | null, xp: 0 };
    const grant = !isFight(node) || body.outcome === "victory";
    if (grant) {
      const bonus = masteryEffects(getMastery(ctx, charId)).discoveryPercentile;
      const loot = rollNodeLoot(ctx, plan, node, bonus);
      if (loot.crowns) adjustCrowns(ctx, charId, loot.crowns);
      rewards.crowns = loot.crowns;
      for (const [e, q] of Object.entries(loot.essences) as [EssenceId, number][]) addItem(ctx, charId, "essence", e, q);
      rewards.essences = loot.essences;
      for (const f of loot.forms) rewards.forms.push(artifactView(ctx, createArtifact(ctx, charId, { realityId: f.realityId, realmId: plan.realmId, origin: "drop", runId })));
      if (loot.mirrorCharges) addItem(ctx, charId, "charge", "mirror", loot.mirrorCharges);
      rewards.mirrorCharges = loot.mirrorCharges;
      if (loot.currency) {
        addItem(ctx, charId, "currency", loot.currency, 1);
        rewards.currency = loot.currency;
      }
      rewards.xp = awardXp(ctx, charId, `node|${runId}|${node.id}`, loot.xp).xp;
    }
    visited.push(node.id);
    run(ctx.db, "UPDATE runs SET visited = ? WHERE id = ?", JSON.stringify(visited), runId);
    run(
      ctx.db,
      "INSERT INTO run_events (run_id, type, payload, created_at) VALUES (?, 'node', ?, ?)",
      runId,
      JSON.stringify({ nodeId: node.id, kind: node.kind, outcome: body.outcome, kills: body.kills ?? {}, rewards: { ...rewards, forms: rewards.forms.map((f) => f.id) } }),
      now(),
    );
    return { node: { id: node.id, kind: node.kind }, visited, rewards, character: characterView(ctx, charId) };
  });
}

export type RunCompletion = { outcome: "victory" | "death" | "abandon"; kills?: Record<string, number>; durationMs?: number };

export function completeRun(ctx: Ctx, charId: string, runId: string, body: RunCompletion) {
  const r = getRun(ctx, charId, runId);
  if (r.status !== "active") throw new HttpError(400, `run is ${r.status}`);
  return tx(ctx.db, () => {
    const status = body.outcome === "victory" ? "victory" : body.outcome === "death" ? "death" : "abandoned";
    const visited = JSON.parse(r.visited) as string[];
    const kills: Record<string, number> = { ...(body.kills ?? {}) };
    for (const e of all<{ payload: string }>(ctx.db, "SELECT payload FROM run_events WHERE run_id = ? AND type = 'node'", runId))
      for (const [k, v] of Object.entries((JSON.parse(e.payload).kills ?? {}) as Record<string, number>)) kills[k] = (kills[k] ?? 0) + v;
    const result = { outcome: body.outcome, visited, kills, durationMs: body.durationMs };
    run(ctx.db, "UPDATE runs SET status = ?, result = ?, completed_at = ? WHERE id = ?", status, JSON.stringify(result), now(), runId);
    run(ctx.db, "INSERT INTO run_events (run_id, type, payload, created_at) VALUES (?, 'complete', ?, ?)", runId, JSON.stringify(body), now());
    const artifacts = all<{ id: string }>(ctx.db, "SELECT id FROM artifacts WHERE run_id = ? AND origin = 'drop' ORDER BY rowid", runId).map((x) => artifactView(ctx, getArtifact(ctx, x.id)));
    return { status, visited, runArtifacts: artifacts };
  });
}

export function realmsOverview() {
  return REALMS.map((r) => ({ id: r.id, name: r.name, difficulty: r.difficulty, boss: r.boss, bossName: FOES[r.boss].name }));
}
