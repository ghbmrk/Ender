import { ESSENCE_IDS, round, type EssenceId, type WorldSnapshot } from "@ender/shared";
import { ESSENCES } from "@ender/content";
import { buildWeekly, scarcityAt, type MarketSeed, type ScarcityBreakdown } from "./scarcity";
import { worldModifiers } from "./prices";

export type BuiltWorld = {
  snapshots: WorldSnapshot[];
  breakdowns: Record<string, Record<EssenceId, ScarcityBreakdown & { value: number; obsDate: string }>>;
};

export const WARMUP_WEEKS = 52;

/** Build one WorldSnapshot per week of replayable history. */
export function buildSnapshots(seed: MarketSeed): BuiltWorld {
  const weekly = buildWeekly(seed);
  const snapshots: WorldSnapshot[] = [];
  const breakdowns: BuiltWorld["breakdowns"] = {};
  for (let i = WARMUP_WEEKS; i < weekly.dates.length; i++) {
    const date = weekly.dates[i]!;
    const id = `w-${date}`;
    const essenceScarcity = {} as Record<EssenceId, number>;
    const essenceBasePrice = {} as Record<EssenceId, number>;
    const bd = {} as BuiltWorld["breakdowns"][string];
    for (const e of ESSENCE_IDS) {
      const s = scarcityAt(weekly.byEssence[e], i);
      essenceScarcity[e] = s.scarcity;
      essenceBasePrice[e] = ESSENCES[e].basePrice;
      const p = weekly.byEssence[e][i]!;
      bd[e] = { ...s, value: round(p.value, 8), obsDate: p.obsDate };
    }
    breakdowns[id] = bd;
    snapshots.push({
      id,
      index: snapshots.length,
      date,
      essenceScarcity,
      essenceBasePrice,
      realmModifiers: worldModifiers(id),
      marketObservationIds: ESSENCE_IDS.map((e) => `${e}@${bd[e].obsDate}`),
    });
  }
  return { snapshots, breakdowns };
}
