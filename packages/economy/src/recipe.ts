import { ESSENCE_IDS, QUALITY_KEYS, round, type EssenceId, type FormQualities, type ProductionRecipe } from "@weave/shared";
import { RECIPE_DRIVERS } from "@weave/content";

/**
 * Deterministic fantasy production recipe from a quality profile.
 * Each quality above 35 demands its Essence: qty = round((q − 25) / 4).
 * (high Burden → Ash, Knots → Glass, Veil → Tide, Reach → Root, Flex → Storm, Bond → Ember.)
 * An economic abstraction only; it does not describe chemical manufacture.
 */
export function productionRecipe(q: FormQualities): ProductionRecipe {
  const essenceCosts: Partial<Record<EssenceId, number>> = {};
  for (const k of QUALITY_KEYS) {
    const v = q[k];
    if (v >= 35) essenceCosts[RECIPE_DRIVERS[k]] = Math.round((v - 25) / 4);
  }
  // Every Form needs at least a pinch of Ash to hold together.
  if (!Object.keys(essenceCosts).length) essenceCosts.ash = 1;
  return { essenceCosts };
}

export function productionCost(recipe: ProductionRecipe, prices: Record<EssenceId, number>): number {
  let total = 0;
  for (const e of ESSENCE_IDS) total += (recipe.essenceCosts[e] ?? 0) * prices[e];
  return round(total, 1);
}

export const essenceQty = (recipe: ProductionRecipe, e: EssenceId) => recipe.essenceCosts[e] ?? 0;

/** Share of production cost attributable to one Essence. */
export function costShare(recipe: ProductionRecipe, prices: Record<EssenceId, number>, e: EssenceId): number {
  const total = productionCost(recipe, prices);
  return total > 0 ? (essenceQty(recipe, e) * prices[e]) / total : 0;
}
