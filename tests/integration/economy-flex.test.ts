// §100 Required economy test: the same Loom build under two price worlds. When Storm is cheap a Flex (Storm-driven)
// Form is an efficient build; when Storm is scarce it is not, and a Storm-free substitute with an equal or lower
// technical score becomes the better Form to Inscribe.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ESSENCE_IDS, type EssenceId, type WorldSnapshot } from "@ender/shared";
import { ESSENCES, RECIPE_DRIVERS, realmById } from "@ender/content";
import { essencePrices, evaluateForm, productionRecipe, type MarketContext } from "@ender/economy";
import { affinitiesOf } from "../../packages/battle/src";
import { harness } from "./harness";

let h: Awaited<ReturnType<typeof harness>>;
beforeAll(async () => {
  h = await harness();
});
afterAll(async () => h?.close());

const snapshot = (id: string, storm: number): WorldSnapshot => ({
  id,
  index: 0,
  date: "2025-01-03",
  essenceScarcity: Object.fromEntries(ESSENCE_IDS.map((e) => [e, e === "storm" ? storm : 50])) as Record<EssenceId, number>,
  essenceBasePrice: Object.fromEntries(ESSENCE_IDS.map((e) => [e, ESSENCES[e].basePrice])) as Record<EssenceId, number>,
  realmModifiers: [],
  marketObservationIds: [],
});

/** Economically efficient = efficiency at or above the median of the viable Forms (technical score ≥ 50) in that world. */
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
};

describe("§100 Storm cheap vs Storm scarce", () => {
  it("a viable Flex build flips from efficient to inefficient and a Storm-free substitute becomes preferable", () => {
    expect(RECIPE_DRIVERS.flex).toBe("storm");
    const worldA = snapshot("A-storm-cheap", 15);
    const worldB = snapshot("B-storm-scarce", 90);
    const ctxOf = (s: WorldSnapshot): MarketContext => ({ prices: essencePrices(s), scarcity: s.essenceScarcity, contracts: [], referenceCost: h.ctx.referenceCost, smithAppetite: 1 });
    const A = ctxOf(worldA);
    const B = ctxOf(worldB);
    expect(A.prices.storm).toBeLessThan(ESSENCES.storm.basePrice);
    expect(B.prices.storm).toBeGreaterThan(2 * ESSENCES.storm.basePrice);

    const objective = realmById("glass-fen").objective; // Glass Fen rewards Flex
    const forms = h.ctx.reality.all().map((c) => {
      const recipe = productionRecipe(c.qualities);
      return { id: c.id, affinities: affinitiesOf(c.qualities), recipe, a: evaluateForm(c.qualities, recipe, objective, "trialed", A), b: evaluateForm(c.qualities, recipe, objective, "trialed", B) };
    });
    const viable = forms.filter((f) => f.a.technicalScore >= 50);
    const effA = median(viable.map((f) => f.a.efficiencyScore));
    const effB = median(viable.map((f) => f.b.efficiencyScore));
    // Deterministic search, corpus order: the first viable Flex build that flips, with the best substitute for it.
    let found: { flex: (typeof forms)[number]; sub: (typeof forms)[number] } | null = null;
    for (const f of forms) {
      if (found) break;
      if (!f.affinities.includes("flex") || !f.recipe.essenceCosts.storm || f.a.technicalScore < 50) continue;
      if (!(f.a.efficiencyScore >= effA && f.b.efficiencyScore < effB)) continue;
      const subs = forms
        .filter((s) => !s.recipe.essenceCosts.storm && s.a.technicalScore >= 50 && s.a.technicalScore <= f.a.technicalScore)
        .filter((s) => s.a.efficiencyScore < f.a.efficiencyScore && s.b.efficiencyScore > f.b.efficiencyScore)
        .sort((x, y) => y.a.technicalScore - x.a.technicalScore || x.id.localeCompare(y.id));
      if (subs[0]) found = { flex: f, sub: subs[0] };
    }
    expect(found, "no Flex build/substitute pair in the corpus").not.toBeNull();
    const { flex, sub } = found!;

    // Technical scores do not move with prices; the Flex build is at least as strong.
    expect(flex.a.technicalScore).toBe(flex.b.technicalScore);
    expect(sub.a.technicalScore).toBeLessThanOrEqual(flex.a.technicalScore);
    // World A: the Flex build is efficient and preferable to the substitute.
    expect(flex.a.efficiencyScore).toBeGreaterThanOrEqual(effA);
    expect(flex.a.efficiencyScore).toBeGreaterThan(sub.a.efficiencyScore);
    // World B: Storm scarcity makes it inefficient; the substitute's cost barely moves and it wins.
    expect(flex.b.efficiencyScore).toBeLessThan(effB);
    expect(flex.b.productionCost).toBeGreaterThan(flex.a.productionCost);
    expect(sub.b.productionCost).toBe(sub.a.productionCost);
    expect(sub.b.efficiencyScore).toBeGreaterThan(flex.b.efficiencyScore);
    expect(sub.b.productionCost).toBeLessThan(flex.b.productionCost);
  });
});
