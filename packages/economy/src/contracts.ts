import { ESSENCE_IDS, clamp, percentile, rng, round, type Candidate, type Contract, type EssenceId, type WorldSnapshot } from "@ender/shared";
import { ESSENCES, REALMS } from "@ender/content";
import { technicalScore } from "@ender/domain";
import { costShare, essenceQty, productionCost } from "./recipe";
import { efficiencyScore } from "./valuation";

export type ContractGenInput = {
  snapshot: WorldSnapshot;
  prices: Record<EssenceId, number>;
  corpus: Candidate[];
  referenceCost: number;
  extraRoyal?: number;
};

const priceRatio = (s: WorldSnapshot, prices: Record<EssenceId, number>, e: EssenceId) => prices[e] / s.essenceBasePrice[e];

/** Best technical score of a candidate across the Realm objectives. */
const bestScore = (c: Candidate) => Math.max(...REALMS.map((r) => technicalScore(c.qualities, r.objective)));

/**
 * Contracts emerge from market conditions:
 *   detect expensive Essence → find recipes dependent on it → substitution objective → Crown reward.
 * Plus a few rotating commissions whose thresholds are calibrated on the candidate corpus.
 */
export function generateContracts(inp: ContractGenInput): Contract[] {
  const { snapshot, prices, corpus } = inp;
  const r = rng(`contracts:${snapshot.id}`);
  const ranked = [...ESSENCE_IDS].sort((a, b) => priceRatio(snapshot, prices, b) - priceRatio(snapshot, prices, a));
  const out: Contract[] = [];

  const substitution = (e: EssenceId, idx: number, issuer: Contract["issuer"]): Contract => {
    const ratio = priceRatio(snapshot, prices, e);
    const dependent = corpus.filter((c) => costShare(c.recipe, prices, e) > 0.25).length / Math.max(1, corpus.length);
    const eligible = corpus.filter((c) => essenceQty(c.recipe, e) === 0).map(bestScore).sort((a, b) => a - b);
    const minPower = round(clamp(percentile(eligible, 0.6), 45, 75));
    const reward = round(clamp(150 + 200 * (ratio - 1) + 100 * dependent, 150, 450) / 10) * 10;
    return {
      id: `${snapshot.id}:sub:${e}:${idx}`,
      snapshotId: snapshot.id,
      issuer,
      title: `${issuer === "royal" ? "Royal" : "Noble"} Contract: ${ESSENCES[e].name}-free Form`,
      description: `Deliver a Trialed Form with Power ≥ ${minPower} that needs no ${ESSENCES[e].name}.`,
      requirement: { minPower, maxEssence: [{ essence: e, qty: 0 }], minTier: "trialed" },
      reward,
      reason: `${ESSENCES[e].name} costs ×${round(ratio, 2)} its usual price; ${Math.round(dependent * 100)}% of known recipes lean on it.`,
      targetEssence: e,
      status: "open",
    };
  };

  // 1. The primary substitution contract always targets the most expensive Essence.
  out.push(substitution(ranked[0]!, 0, "royal"));
  // A second one appears when another Essence is also clearly overpriced.
  if (priceRatio(snapshot, prices, ranked[1]!) > 1.35) out.push(substitution(ranked[1]!, 1, "noble"));
  for (let i = 0; i < (inp.extraRoyal ?? 0); i++) out.push(substitution(ranked[Math.min(i + 1, 5)]!, 10 + i, "royal"));

  // 2. Rotating commissions.
  const pool: (() => Contract)[] = [
    () => ({
      id: `${snapshot.id}:light`,
      snapshotId: snapshot.id,
      issuer: "noble",
      title: "Noble Commission: a light, potent Form",
      description: "Deliver a Trialed Form with Burden below 35 and Power above 60.",
      requirement: { minPower: 60, qualityBounds: [{ quality: "burden", max: 35 }], minTier: "trialed" },
      reward: 220,
      reason: "House Veyl wants something that travels well.",
      status: "open",
    }),
    () => {
      const knotted = corpus.filter((c) => c.qualities.knots >= 70).map((c) => productionCost(c.recipe, prices)).sort((a, b) => a - b);
      const maxCost = round(percentile(knotted, 0.4));
      return {
        id: `${snapshot.id}:knots`,
        snapshotId: snapshot.id,
        issuer: "smith",
        title: "Smiths' Order: cheap intricacy",
        description: `Deliver a Trialed Form with Knots ≥ 70 costing no more than ${maxCost} Crowns to produce.`,
        requirement: { qualityBounds: [{ quality: "knots", min: 70 }], maxCost, minTier: "trialed" },
        reward: 190,
        reason: "The forges need intricate work they can afford this turning.",
        status: "open",
      };
    },
    () => {
      const effs = corpus.map((c) => efficiencyScore(bestScore(c), productionCost(c.recipe, prices), inp.referenceCost)).sort((a, b) => a - b);
      const minEfficiency = round(clamp(percentile(effs, 0.75), 55, 80));
      return {
        id: `${snapshot.id}:eff`,
        snapshotId: snapshot.id,
        issuer: "scholar",
        title: "Scholars' Request: an economical Form",
        description: `Deliver a Trialed Form with efficiency ≥ ${minEfficiency}.`,
        requirement: { minEfficiency, minTier: "trialed" },
        reward: 180,
        reason: "The Collegium rewards value per Crown, not raw might.",
        status: "open",
      };
    },
    () => {
      const e = ranked[1]!;
      return {
        id: `${snapshot.id}:witness:${e}`,
        snapshotId: snapshot.id,
        issuer: "noble",
        title: `Witnessed Form using little ${ESSENCES[e].name}`,
        description: `Deliver a Witnessed Form using at most 2 ${ESSENCES[e].name}.`,
        requirement: { maxEssence: [{ essence: e, qty: 2 }], minTier: "witnessed" },
        reward: 240,
        reason: `${ESSENCES[e].name} is dear; proof and thrift are both wanted.`,
        targetEssence: e,
        status: "open",
      };
    },
  ];
  const order = pool.map((_, i) => i).sort(() => r.next() - 0.5);
  for (const i of order.slice(0, 2)) out.push(pool[i]!());
  return out;
}

/** Total Crown demand for Forms free of an Essence. */
export const essenceFreeDemand = (contracts: Contract[], e: EssenceId) =>
  contracts
    .filter((c) => c.status === "open" && c.requirement.maxEssence?.some((x) => x.essence === e && x.qty === 0))
    .reduce((s, c) => s + c.reward, 0);
