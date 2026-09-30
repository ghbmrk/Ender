import { round } from "@weave/shared";
import { FOCUS_COST } from "@weave/domain";
import { all, get } from "../db";
import type { Ctx } from "./context";

const avg = (xs: number[]) => (xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length, 2) : null);

export function analytics(ctx: Ctx) {
  const runs = all<{ id: string; character_id: string; realm_id: string; status: string; result: string | null }>(ctx.db, "SELECT id, character_id, realm_id, status, result FROM runs");
  const results = runs.map((r) => ({ ...r, res: r.result ? JSON.parse(r.result) : null }));
  const finished = results.filter((r) => r.status !== "active");
  const kills = finished.reduce((s, r) => s + Object.values((r.res?.kills ?? {}) as Record<string, number>).reduce((a, b) => a + b, 0), 0);
  const inf = all<{ run_id: string | null; action: string; work_units: number; xp_awarded: number }>(ctx.db, "SELECT run_id, action, work_units, xp_awarded FROM inference_events");
  const runCount = Math.max(1, finished.length);
  const wu = inf.reduce((s, e) => s + e.work_units, 0);
  const xp = inf.reduce((s, e) => s + e.xp_awarded, 0);
  const focus = inf.reduce((s, e) => s + (FOCUS_COST[e.action as keyof typeof FOCUS_COST] ?? 0), 0);
  const mastery = all<{ domain: string; success: number; reason: string; level: number; character_id: string }>(ctx.db, "SELECT domain, success, reason, level, character_id FROM mastery_events");
  const craft = mastery.filter((m) => m.domain === "craft");
  const tx = all<{ asset_type: string; side: string; quantity: number; unit_price: number; details: string | null }>(ctx.db, "SELECT asset_type, side, quantity, unit_price, details FROM market_transactions");
  const essenceTx = tx.filter((t) => t.asset_type === "essence");
  const profits = tx.filter((t) => t.asset_type === "artifact" && t.side === "sell").map((t) => (t.details ? JSON.parse(t.details).profit ?? 0 : 0));
  const chars = all<{ id: string; preset: string | null; crowns: number; level: number }>(ctx.db, "SELECT id, preset, crowns, level FROM characters");
  const byDomain: Record<string, { successes: number; failures: number }> = {};
  for (const m of mastery) {
    byDomain[m.domain] ??= { successes: 0, failures: 0 };
    byDomain[m.domain]!.successes += m.success;
    byDomain[m.domain]!.failures += 1 - m.success;
  }
  const byBuild: Record<string, { opportunities: number; successRate: number | null }> = {};
  for (const c of chars) {
    const ms = mastery.filter((m) => m.character_id === c.id);
    const k = c.preset ?? "custom";
    byBuild[k] = { opportunities: (byBuild[k]?.opportunities ?? 0) + ms.length, successRate: avg(ms.map((m) => m.success)) };
  }
  const byLevel: Record<number, number | null> = {};
  for (const lvl of [...new Set(mastery.map((m) => m.level))].sort()) byLevel[lvl] = avg(mastery.filter((m) => m.level === lvl).map((m) => m.success));
  const starts = all<{ payload: string; run_id: string }>(ctx.db, "SELECT run_id, payload FROM run_events WHERE type = 'start'");
  const realmChoice = starts.map((s) => ({ runId: s.run_id, ...JSON.parse(s.payload) }));
  return {
    combat: {
      runs: finished.length,
      avgDurationSec: avg(finished.map((r) => (r.res?.durationMs ?? 0) / 1000).filter((x) => x > 0)),
      deaths: finished.filter((r) => r.status === "death").length,
      enemyKills: kills,
      bossCompletions: finished.filter((r) => r.status === "victory").length,
    },
    inference: {
      calls: inf.length,
      focusPerRun: round(focus / runCount, 2),
      wuPerRun: round(wu / runCount, 2),
      xpPerWu: wu ? round(xp / wu, 2) : null,
      repeatedActionSuppressed: inf.filter((e) => e.xp_awarded === 0 && e.work_units > 0).length,
      byProvider: all(ctx.db, "SELECT provider, COUNT(*) AS n FROM inference_events GROUP BY provider"),
    },
    craft: {
      transformsPerRun: round(inf.filter((e) => e.action === "temper").length / runCount, 2),
      improvements: craft.filter((m) => m.success >= 1).length,
      failedTransforms: craft.filter((m) => m.success < 1).length,
      efficiencyImprovements: mastery.filter((m) => m.domain === "efficiency" && m.success > 0).length,
    },
    economy: {
      essenceTurnover: essenceTx.reduce((s, t) => s + t.quantity, 0),
      avgBuy: avg(essenceTx.filter((t) => t.side === "buy").map((t) => t.unit_price)),
      avgSell: avg(essenceTx.filter((t) => t.side === "sell").map((t) => t.unit_price)),
      wealth: chars.map((c) => ({ id: c.id, crowns: c.crowns, delta: round(c.crowns - 250, 2) })),
      contractsCompleted: get<{ n: number }>(ctx.db, "SELECT COUNT(*) AS n FROM contracts WHERE status = 'fulfilled'")!.n,
      realizedProfit: round(profits.reduce((a, b) => a + b, 0), 2),
      realmChoice,
    },
    mastery: { byDomain, byBuild, byLevel },
  };
}
