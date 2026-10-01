import { ESSENCE_IDS, clamp, round, type ArtifactEvaluation, type Contract, type EssenceId, type EvidenceTier, type FormQualities, type ProductionRecipe, type RealmObjective } from "@ender/shared";
import { EVIDENCE_MULTIPLIER, artifactPower, tierRank, technicalScore as scoreOf } from "@ender/domain";
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
): { ok: boolean; failures: string[]; gaps: ContractGap[] } {
  const r = c.requirement;
  const gaps: ContractGap[] = [];
  if (r.minTier && tierRank(f.tier) < tierRank(r.minTier)) gaps.push({ kind: "tier", have: f.tier, need: r.minTier });
  if (r.minPower !== undefined && f.power < r.minPower) gaps.push({ kind: "power", have: f.power, need: r.minPower });
  for (const x of r.maxEssence ?? []) {
    const q = essenceQty(f.recipe, x.essence);
    if (q > x.qty) gaps.push({ kind: "essence", essence: x.essence, have: q, need: x.qty });
  }
  for (const b of r.qualityBounds ?? []) {
    const v = f.qualities[b.quality];
    if (b.min !== undefined && v < b.min) gaps.push({ kind: "quality", quality: b.quality, have: v, need: b.min, dir: "min" });
    if (b.max !== undefined && v > b.max) gaps.push({ kind: "quality", quality: b.quality, have: v, need: b.max, dir: "max" });
  }
  if (r.minEfficiency !== undefined && f.efficiency < r.minEfficiency) gaps.push({ kind: "efficiency", have: f.efficiency, need: r.minEfficiency });
  if (r.maxCost !== undefined && f.cost > r.maxCost) gaps.push({ kind: "cost", have: f.cost, need: r.maxCost });
  const failures = gaps.map((g) =>
    g.kind === "tier" ? `must be ${g.need}` : g.kind === "essence" ? `${g.essence} ${g.have} > ${g.need}` : g.kind === "quality" ? `${g.quality} ${g.have} ${g.dir === "min" ? "<" : ">"} ${g.need}` : g.kind === "cost" ? `cost ${g.have} > ${g.need}` : `${g.kind} ${g.have} < ${g.need}`,
  );
  return { ok: gaps.length === 0, failures, gaps };
}

/** One way a Form falls short of a Contract, with what it has and what is needed. */
export type ContractGap =
  | { kind: "tier"; have: EvidenceTier; need: EvidenceTier }
  | { kind: "power" | "efficiency" | "cost"; have: number; need: number }
  | { kind: "essence"; essence: string; have: number; need: number }
  | { kind: "quality"; quality: string; have: number; need: number; dir: "min" | "max" };

/** What Salvagers pay for a Form without it being produced. */
export const salvageValue = (score: number) => round(10 + 0.35 * score);
