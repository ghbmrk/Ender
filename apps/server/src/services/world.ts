import { ESSENCE_IDS, noise, round, type Contract, type EssenceId, type WorldSnapshot } from "@weave/shared";
import { ESSENCE_MARKET_SERIES } from "@weave/content";
import {
  essencePrice,
  essencePrices,
  generateContracts,
  localDemandFactor,
  merchantDecay,
  npcEssenceDemand,
  type LocalDemandState,
  type MarketContext,
} from "@weave/economy";
import { all, get, now, run, tx } from "../db";
import type { Ctx } from "./context";

const zeroPressure = (): LocalDemandState => Object.fromEntries(ESSENCE_IDS.map((e) => [e, 0])) as LocalDemandState;

export function getState<T>(ctx: Ctx, key: string, fallback: T): T {
  const row = get<{ value: string }>(ctx.db, "SELECT value FROM world_state WHERE key = ?", key);
  return row ? (JSON.parse(row.value) as T) : fallback;
}
export function setState(ctx: Ctx, key: string, value: unknown) {
  run(ctx.db, "INSERT INTO world_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, JSON.stringify(value));
}

/** Persist snapshots and their market observations once; idempotent. */
export function ensureWorld(ctx: Ctx) {
  const count = get<{ n: number }>(ctx.db, "SELECT COUNT(*) AS n FROM world_snapshots")!.n;
  if (count !== ctx.world.snapshots.length) {
    tx(ctx.db, () => {
      run(ctx.db, "DELETE FROM world_snapshots");
      const ins = ctx.db.prepare("INSERT INTO world_snapshots (id, idx, date, data) VALUES (?, ?, ?, ?)");
      const obs = ctx.db.prepare("INSERT OR IGNORE INTO market_observations (id, essence, series_key, obs_date, value, source) VALUES (?, ?, ?, ?, ?, ?)");
      for (const s of ctx.world.snapshots) {
        ins.run(s.id, s.index, s.date, JSON.stringify(s));
        const bd = ctx.world.breakdowns[s.id]!;
        for (const e of ESSENCE_IDS) {
          obs.run(`${e}@${bd[e].obsDate}`, e, ESSENCE_MARKET_SERIES[e].seriesKey, bd[e].obsDate, 1 / bd[e].value, "ECB reference rate");
        }
      }
    });
  }
  if (!getState<string | null>(ctx, "current_snapshot", null)) activateSnapshot(ctx, snapshotForDate(ctx, ctx.config.startDate).id);
}

export function snapshotForDate(ctx: Ctx, date: string): WorldSnapshot {
  const list = ctx.world.snapshots;
  let best = list[0]!;
  for (const s of list) if (s.date <= date) best = s;
  return best;
}

export function currentSnapshot(ctx: Ctx): WorldSnapshot {
  const id = getState<string | null>(ctx, "current_snapshot", null);
  const s = id ? ctx.snapshotById.get(id) : undefined;
  if (!s) throw new Error("world not initialized");
  return s;
}

export const nextSnapshot = (ctx: Ctx, s: WorldSnapshot) => ctx.world.snapshots[s.index + 1];

export const pressure = (ctx: Ctx): LocalDemandState => getState(ctx, "pressure", zeroPressure());

export function addPressure(ctx: Ctx, e: EssenceId, delta: number) {
  const p = pressure(ctx);
  p[e] = round(p[e] + delta, 4);
  setState(ctx, "pressure", p);
  recordNpcDemand(ctx, currentSnapshot(ctx), p);
}

function recordNpcDemand(ctx: Ctx, s: WorldSnapshot, p: LocalDemandState) {
  for (const e of ESSENCE_IDS) {
    run(
      ctx.db,
      "INSERT INTO npc_demand (snapshot_id, essence, pressure, npc_factor) VALUES (?, ?, ?, ?) ON CONFLICT(snapshot_id, essence) DO UPDATE SET pressure = excluded.pressure, npc_factor = excluded.npc_factor",
      s.id,
      e,
      p[e],
      localDemandFactor(s, e, p[e]),
    );
  }
}

export const currentPrices = (ctx: Ctx) => essencePrices(currentSnapshot(ctx), pressure(ctx));

export function smithAppetite(s: WorldSnapshot) {
  return round(1 + 0.2 * noise(`${s.id}:smith-appetite`), 3);
}

export function activeContracts(ctx: Ctx, s = currentSnapshot(ctx)): Contract[] {
  return all<{ data: string; status: string; snapshot_id: string }>(
    ctx.db,
    "SELECT c.data, c.status, c.snapshot_id FROM contracts c JOIN world_snapshots w ON w.id = c.snapshot_id WHERE c.status = 'open' AND w.idx <= ? AND c.expires_index >= ? ORDER BY w.idx DESC, c.id",
    s.index,
    s.index,
  ).map((r) => ({ ...(JSON.parse(r.data) as Contract), status: r.status as Contract["status"] }));
}

export function marketContext(ctx: Ctx): MarketContext {
  const s = currentSnapshot(ctx);
  return {
    prices: currentPrices(ctx),
    scarcity: s.essenceScarcity,
    contracts: activeContracts(ctx, s),
    referenceCost: ctx.referenceCost,
    smithAppetite: smithAppetite(s),
  };
}

export const CONTRACT_LIFETIME = 3;

/** Make a snapshot current: record prices + NPC demand, generate contracts and Bazaar stock, settle prophecies. */
export function activateSnapshot(ctx: Ctx, id: string, opts: { decay?: boolean } = {}) {
  const s = ctx.snapshotById.get(id);
  if (!s) throw new Error(`unknown snapshot ${id}`);
  tx(ctx.db, () => {
    const p = opts.decay ? merchantDecay(pressure(ctx)) : pressure(ctx);
    setState(ctx, "pressure", p);
    setState(ctx, "current_snapshot", s.id);
    recordNpcDemand(ctx, s, p);
    for (const e of ESSENCE_IDS) {
      const b = essencePrice(s, e, p[e]);
      run(
        ctx.db,
        "INSERT INTO essence_prices (snapshot_id, essence, price, scarcity, breakdown) VALUES (?, ?, ?, ?, ?) ON CONFLICT(snapshot_id, essence) DO UPDATE SET price = excluded.price, breakdown = excluded.breakdown",
        s.id,
        e,
        b.price,
        s.essenceScarcity[e],
        JSON.stringify({ ...b, npc: npcEssenceDemand(s, e) }),
      );
    }
    const existing = get<{ n: number }>(ctx.db, "SELECT COUNT(*) AS n FROM contracts WHERE snapshot_id = ?", s.id)!.n;
    if (!existing) {
      for (const c of generateContracts({ snapshot: s, prices: essencePrices(s, p), corpus: ctx.reality.all(), referenceCost: ctx.referenceCost })) {
        run(ctx.db, "INSERT OR IGNORE INTO contracts (id, snapshot_id, data, status, expires_index) VALUES (?, ?, ?, 'open', ?)", c.id, s.id, JSON.stringify(c), s.index + CONTRACT_LIFETIME - 1);
      }
    }
  });
}

export function priceHistory(ctx: Ctx, n = 10) {
  const s = currentSnapshot(ctx);
  const from = Math.max(0, s.index - n + 1);
  const snaps = ctx.world.snapshots.slice(from, s.index + 1);
  return snaps.map((snap) => {
    const recorded = all<{ essence: EssenceId; price: number }>(ctx.db, "SELECT essence, price FROM essence_prices WHERE snapshot_id = ?", snap.id);
    const prices = snap.id === s.id ? currentPrices(ctx) : essencePrices(snap);
    for (const r of recorded) if (snap.id !== s.id) prices[r.essence] = r.price;
    return { snapshotId: snap.id, date: snap.date, prices, scarcity: snap.essenceScarcity };
  });
}

export function advanceWorld(ctx: Ctx, steps = 1) {
  const s = currentSnapshot(ctx);
  const target = ctx.world.snapshots[Math.min(ctx.world.snapshots.length - 1, s.index + steps)]!;
  if (target.id === s.id) return s;
  activateSnapshot(ctx, target.id, { decay: true });
  return target;
}

export function nowIso() {
  return now();
}
