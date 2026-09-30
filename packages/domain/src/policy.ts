import { POLICY_KEYS, clamp, round, type SearchPolicy } from "@weave/shared";
import { PASSIVES, type PassiveEffects } from "@weave/content";

export const DEFAULT_POLICY: SearchPolicy = {
  exploration: 0.35,
  optimization: 0.35,
  critique: 0.3,
  evidence: 0.3,
  efficiency: 0.3,
  arbitrage: 0.25,
};

export const PRESET_POLICIES: Record<"explorer" | "smith" | "inquisitor" | "merchant", SearchPolicy> = {
  explorer: { exploration: 0.85, optimization: 0.2, critique: 0.25, evidence: 0.25, efficiency: 0.2, arbitrage: 0.1 },
  smith: { exploration: 0.15, optimization: 0.9, critique: 0.2, evidence: 0.3, efficiency: 0.5, arbitrage: 0.2 },
  inquisitor: { exploration: 0.15, optimization: 0.25, critique: 0.9, evidence: 0.75, efficiency: 0.2, arbitrage: 0.1 },
  merchant: { exploration: 0.2, optimization: 0.4, critique: 0.2, evidence: 0.3, efficiency: 0.7, arbitrage: 0.95 },
};

/** Weights summing to 1, for ranking. */
export function normalizePolicy(p: SearchPolicy): SearchPolicy {
  const total = POLICY_KEYS.reduce((s, k) => s + Math.max(0, p[k]), 0) || 1;
  return Object.fromEntries(POLICY_KEYS.map((k) => [k, round(Math.max(0, p[k]) / total, 4)])) as SearchPolicy;
}

export function aggregatePassives(ids: string[]) {
  const nodes = PASSIVES.filter((p) => ids.includes(p.id));
  const acc: Required<Pick<PassiveEffects, "readingNoise" | "critiqueNoise" | "wardDamage" | "focusConversion">> &
    Omit<PassiveEffects, "policy"> & { policyDelta: SearchPolicy } = {
    readingNoise: 1,
    critiqueNoise: 1,
    wardDamage: 1,
    focusConversion: 1,
    extraReveal: 0,
    mirrorTolerance: 0,
    temperDiscount: 0,
    bonusFocus: 0,
    freeAttunes: 0,
    costWeight: 0,
    contrarianBonus: 0,
    patronBonus: 0,
    damagePct: 0,
    healthFlat: 0,
    critChance: 0,
    policyDelta: { exploration: 0, optimization: 0, critique: 0, evidence: 0, efficiency: 0, arbitrage: 0 },
  };
  for (const n of nodes) {
    const e = n.effects;
    for (const k of POLICY_KEYS) acc.policyDelta[k] += e.policy?.[k] ?? 0;
    if (e.readingNoise) acc.readingNoise *= e.readingNoise;
    if (e.critiqueNoise) acc.critiqueNoise *= e.critiqueNoise;
    if (e.wardDamage) acc.wardDamage *= e.wardDamage;
    if (e.focusConversion) acc.focusConversion *= e.focusConversion;
    acc.extraReveal! += e.extraReveal ?? 0;
    acc.mirrorTolerance! += e.mirrorTolerance ?? 0;
    acc.temperDiscount! += e.temperDiscount ?? 0;
    acc.bonusFocus! += e.bonusFocus ?? 0;
    acc.freeAttunes! += e.freeAttunes ?? 0;
    acc.costWeight! += e.costWeight ?? 0;
    acc.contrarianBonus! += e.contrarianBonus ?? 0;
    acc.patronBonus! += e.patronBonus ?? 0;
    acc.damagePct! += e.damagePct ?? 0;
    acc.healthFlat! += e.healthFlat ?? 0;
    acc.critChance! += e.critChance ?? 0;
    if (e.deepNeighborhood) acc.deepNeighborhood = true;
    if (e.secondWeakness) acc.secondWeakness = true;
    if (e.valueSmith) acc.valueSmith = true;
    if (e.arbitrageReveal) acc.arbitrageReveal = true;
    if (e.priceBand) acc.priceBand = true;
  }
  return acc;
}
export type PassiveAggregate = ReturnType<typeof aggregatePassives>;

/** Effective SearchPolicy = base + passive deltas, clamped to [0,1]. */
export function effectivePolicy(base: SearchPolicy, passiveIds: string[]): SearchPolicy {
  const { policyDelta } = aggregatePassives(passiveIds);
  return Object.fromEntries(POLICY_KEYS.map((k) => [k, round(clamp(base[k] + policyDelta[k], 0, 1), 3)])) as SearchPolicy;
}

export function canAllocate(id: string, allocated: string[]): { ok: boolean; reason?: string } {
  const node = PASSIVES.find((p) => p.id === id);
  if (!node) return { ok: false, reason: "unknown node" };
  if (allocated.includes(id)) return { ok: false, reason: "already allocated" };
  if (node.requires && !allocated.includes(node.requires)) return { ok: false, reason: `requires ${node.requires}` };
  return { ok: true };
}
