import { POLICY_KEYS, round, type SearchPolicy } from "@ender/shared";

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
