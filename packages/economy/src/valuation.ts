import { ESSENCE_IDS, clamp, round, type ArtifactEvaluation, type Contract, type EssenceId, type EvidenceTier, type FormQualities, type ProductionRecipe, type RealmObjective } from "@weave/shared";
import { EVIDENCE_MULTIPLIER, artifactPower, tierRank, technicalScore as scoreOf } from "@weave/domain";
import { essenceQty, productionCost } from "./recipe";

export type MarketContext = {
  prices: Record<EssenceId, number>;
  scarcity: Record<EssenceId, number>;
  contracts: Contract[];
  /** Median production cost of the corpus at base prices; anchors efficiency. */
  referenceCost: number;
  /** Smith appetite for raw power this turning (≈0.8–1.2). */
  smithAppetite?: number;
};

export type ValueBreakdown = {
  technical: number;
  demand: number;
  scarcityAvoidance: number;
  evidencePremium: number;
  total: number;
};

/**
 * marketValue = technical component + demand component + scarcity component + evidence premium.
 * - technical: 3 × technicalScore
 * - demand: Smiths pay 2 × (score − 55)⁺ × appetite; +50 per open contract whose Essence limits the recipe meets
 * - scarcity avoidance: +2 × (scarcity − 55) for each scarce Essence (>55) the recipe does not need
 * - evidence premium: technical × (evidence multiplier − 1)
 */
export function marketValue(
  score: number,
  recipe: ProductionRecipe,
  tier: EvidenceTier,
  m: MarketContext,
): ValueBreakdown {
  const technical = 3 * score;
  let demand = 2 * Math.max(0, score - 55) * (m.smithAppetite ?? 1);
  for (const c of m.contracts) {
    if (c.status !== "open" || !c.requirement.maxEssence?.length) continue;
    if (c.requirement.maxEssence.every((x) => essenceQty(recipe, x.essence) <= x.qty)) demand += 50;
  }
  let scarcityAvoidance = 0;
  for (const e of ESSENCE_IDS) {
    if (m.scarcity[e] > 55 && essenceQty(recipe, e) === 0) scarcityAvoidance += 2 * (m.scarcity[e] - 55);
  }
  const evidencePremium = technical * (EVIDENCE_MULTIPLIER[tier] - 1);
  const total = round(Math.max(0, technical + demand + scarcityAvoidance + evidencePremium));
  return { technical: round(technical), demand: round(demand), scarcityAvoidance: round(scarcityAvoidance), evidencePremium: round(evidencePremium), total };
}

/**
 * Efficiency = technical utility per normalized production cost, bounded to 0–100:
 *   ratio = (score/100) / (max(cost,1)/referenceCost);  efficiency = 100·ratio/(ratio+1)
 */
export function efficiencyScore(score: number, cost: number, referenceCost: number): number {
  const ratio = score / 100 / (Math.max(cost, 1) / Math.max(referenceCost, 1));
  return round(clamp((100 * ratio) / (ratio + 1), 0, 100), 1);
}

export function evaluateForm(
  q: FormQualities,
  recipe: ProductionRecipe,
  objective: RealmObjective,
  tier: EvidenceTier,
  m: MarketContext,
): ArtifactEvaluation & { value: ValueBreakdown; power: number } {
  const technicalScore = scoreOf(q, objective);
  const cost = productionCost(recipe, m.prices);
  const value = marketValue(technicalScore, recipe, tier, m);
  return {
    technicalScore,
    productionCost: cost,
    estimatedMarketValue: value.total,
    efficiencyScore: efficiencyScore(technicalScore, cost, m.referenceCost),
    marginPotential: round(value.total - cost),
    value,
    power: artifactPower(technicalScore, tier),
  };
}

/** Does an evaluated Form satisfy a contract? */
export function meetsContract(
  c: Contract,
  f: { qualities: FormQualities; recipe: ProductionRecipe; tier: EvidenceTier; power: number; cost: number; efficiency: number },
): { ok: boolean; failures: string[] } {
  const r = c.requirement;
  const failures: string[] = [];
  if (r.minTier && tierRank(f.tier) < tierRank(r.minTier)) failures.push(`must be ${r.minTier}`);
  if (r.minPower !== undefined && f.power < r.minPower) failures.push(`power ${f.power} < ${r.minPower}`);
  for (const x of r.maxEssence ?? []) {
    const q = essenceQty(f.recipe, x.essence);
    if (q > x.qty) failures.push(`${x.essence} ${q} > ${x.qty}`);
  }
  for (const b of r.qualityBounds ?? []) {
    const v = f.qualities[b.quality];
    if (b.min !== undefined && v < b.min) failures.push(`${b.quality} ${v} < ${b.min}`);
    if (b.max !== undefined && v > b.max) failures.push(`${b.quality} ${v} > ${b.max}`);
  }
  if (r.minEfficiency !== undefined && f.efficiency < r.minEfficiency) failures.push(`efficiency ${f.efficiency} < ${r.minEfficiency}`);
  if (r.maxCost !== undefined && f.cost > r.maxCost) failures.push(`cost ${f.cost} > ${r.maxCost}`);
  return { ok: failures.length === 0, failures };
}

/** What Salvagers pay for a Form without it being produced. */
export const salvageValue = (score: number) => round(10 + 0.35 * score);
