import { ESSENCE_IDS, clamp, mean, percentileRank, round, std, type EssenceId } from "@weave/shared";
import { ESSENCE_MARKET_SERIES } from "@weave/content";

export type SeriesObs = [date: string, value: number];
export type MarketSeed = { source: string; unit: string; series: Record<string, SeriesObs[]> };

export type WeeklyPoint = { date: string; value: number; obsDate: string };

/** ISO-week Fridays between the first and last observation. */
export function weeklyFridays(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() + 1);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

/** Last observation on or before each Friday. Value is the currency's strength (EUR per unit = 1 / rate). */
export function weeklySeries(obs: SeriesObs[], fridays: string[]): WeeklyPoint[] {
  const out: WeeklyPoint[] = [];
  let j = 0;
  for (const f of fridays) {
    while (j + 1 < obs.length && obs[j + 1]![0] <= f) j++;
    const o = obs[j]!;
    if (o[0] > f) continue;
    out.push({ date: f, value: 1 / o[1], obsDate: o[0] });
  }
  return out;
}

export type ScarcityBreakdown = {
  latestReturn: number;
  zAbsReturn: number;
  volatility8: number;
  sigma52: number;
  zVolatility: number;
  percentile52: number;
  scarcity: number;
};

/**
 * Transparent, deterministic scarcity index in [0,100]:
 *   50 + 15·(|r|/σ52 − 0.8) + 10·zVol + 45·(pct52 − 0.5)
 * where r is the latest weekly log-return, σ52 the trailing 52-week return std,
 * zVol = (σ8/σ52 − 1)/0.35 and pct52 the value's percentile within 52 weeks.
 * A game-feel index, not financial analysis.
 */
export function scarcityAt(points: WeeklyPoint[], i: number): ScarcityBreakdown {
  const window = points.slice(Math.max(0, i - 52), i + 1);
  const rets: number[] = [];
  for (let k = 1; k < window.length; k++) rets.push(Math.log(window[k]!.value / window[k - 1]!.value));
  const r = rets.length ? rets[rets.length - 1]! : 0;
  const sigma52 = std(rets) || 1e-6;
  const vol8 = std(rets.slice(-8));
  const zAbs = Math.abs(r) / sigma52;
  const zVol = clamp((vol8 / sigma52 - 1) / 0.35, -3, 3);
  const pct = percentileRank(window.map((p) => p.value), points[i]!.value);
  const scarcity = clamp(50 + 15 * (zAbs - 0.8) + 10 * zVol + 45 * (pct - 0.5), 0, 100);
  return {
    latestReturn: round(r, 5),
    zAbsReturn: round(zAbs, 3),
    volatility8: round(vol8, 5),
    sigma52: round(sigma52, 5),
    zVolatility: round(zVol, 3),
    percentile52: round(pct, 3),
    scarcity: round(scarcity, 1),
  };
}

export type SnapshotSeries = {
  dates: string[];
  byEssence: Record<EssenceId, WeeklyPoint[]>;
};

/** Align six weekly series on shared Fridays; first 52 weeks are warm-up. */
export function buildWeekly(seed: MarketSeed): SnapshotSeries {
  const all = Object.values(seed.series).flat();
  const first = all.reduce((m, o) => (o[0] < m ? o[0] : m), "9999");
  const last = all.reduce((m, o) => (o[0] > m ? o[0] : m), "0000");
  const fridays = weeklyFridays(first, last);
  const byEssence = {} as Record<EssenceId, WeeklyPoint[]>;
  for (const e of ESSENCE_IDS) {
    const obs = seed.series[ESSENCE_MARKET_SERIES[e].seriesKey];
    if (!obs) throw new Error(`market seed missing ${ESSENCE_MARKET_SERIES[e].seriesKey}`);
    byEssence[e] = weeklySeries(obs, fridays);
  }
  const common = byEssence.ember.map((p) => p.date).filter((d) => ESSENCE_IDS.every((e) => byEssence[e].some((p) => p.date === d)));
  for (const e of ESSENCE_IDS) byEssence[e] = byEssence[e].filter((p) => common.includes(p.date));
  return { dates: common, byEssence };
}

export const averageScarcity = (s: Record<EssenceId, number>) => mean(ESSENCE_IDS.map((e) => s[e]));
