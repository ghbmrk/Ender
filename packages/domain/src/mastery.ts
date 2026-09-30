import { MASTERY_DOMAINS, clamp, round, type MasteryDomain, type MasteryState } from "@ender/shared";

export const emptyMastery = (): Record<MasteryDomain, MasteryState> =>
  Object.fromEntries(MASTERY_DOMAINS.map((d) => [d, { successes: 0, failures: 0, opportunities: 0 }])) as Record<
    MasteryDomain,
    MasteryState
  >;

export const masteryPosterior = (m: MasteryState) => (m.successes + 2) / (m.successes + m.failures + 4);
export const masteryConfidence = (m: MasteryState) => 1 - Math.exp(-m.opportunities / 12);
export const masteryDisplay = (m: MasteryState) => round(100 * masteryPosterior(m) * masteryConfidence(m), 1);

/** Record one opportunity. `success` may be fractional (e.g. Prophecy quality). */
export function recordMastery(m: MasteryState, success: number): MasteryState {
  const s = clamp(success, 0, 1);
  return { successes: m.successes + s, failures: m.failures + (1 - s), opportunities: m.opportunities + 1 };
}

/** Mastery effects — specialized, never global DPS. */
export function masteryEffects(mastery: Record<MasteryDomain, MasteryState>) {
  const d = (k: MasteryDomain) => masteryDisplay(mastery[k]);
  return {
    /** Elite Form drop percentile bonus (max +15). */
    discoveryPercentile: round(Math.min(15, d("discovery") * 0.15), 1),
    /** Extra neighbours considered by Temper. */
    craftNeighborhood: Math.floor(d("craft") / 12),
    /** Ward damage multiplier vs. the Bound King. */
    proofWardMultiplier: round(1 + d("proof") / 200, 3),
    /** Bazaar forecast band shrink (0..0.5). */
    prophecyBandShrink: round(Math.min(0.5, d("prophecy") / 150), 3),
    /** Crowns per unused Focus at Realm start. */
    focusConversion: round(2 + d("efficiency") / 10, 1),
    /** Transaction spread (fraction). */
    spread: round(0.08 * (1 - Math.min(0.6, d("commerce") / 120)), 4),
  };
}

/** Brier-based quality for a probabilistic forecast. */
export function brierQuality(p: number, outcome: 0 | 1) {
  const loss = (p - outcome) ** 2;
  return { loss: round(loss, 4), quality: round(1 - loss, 4) };
}
