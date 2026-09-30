// §69 — Required economic scenario: Storm scarcity flips which Form is economically superior.
import { describe, expect, it } from "vitest";
import { ESSENCE_IDS, type EssenceId, type WorldSnapshot } from "@weave/shared";
import { ESSENCES } from "@weave/content";
import {
  efficiencyScore,
  essenceFreeDemand,
  essencePrices,
  generateContracts,
  marketValue,
  productionCost,
  productionRecipe,
  type MarketContext,
} from "../src";

const snapshot = (id: string, storm: number): WorldSnapshot => ({
  id,
  index: 0,
  date: "2025-01-03",
  essenceScarcity: Object.fromEntries(ESSENCE_IDS.map((e) => [e, e === "storm" ? storm : 50])) as Record<EssenceId, number>,
  essenceBasePrice: Object.fromEntries(ESSENCE_IDS.map((e) => [e, ESSENCES[e].basePrice])) as Record<EssenceId, number>,
  realmModifiers: [],
  marketObservationIds: [],
});

// Form A: technical 85, Storm-heavy. Form B: technical 78, no Storm.
const A = { score: 85, recipe: { essenceCosts: { storm: 16, glass: 8, ember: 4 } } };
const B = { score: 78, recipe: { essenceCosts: { root: 10, glass: 8, ember: 4 } } };

// A small corpus so the contract generator can reason about dependence on Storm.
const corpus = Array.from({ length: 60 }, (_, i) => {
  const q = { burden: (i * 37) % 100, veil: (i * 53) % 100, reach: (i * 71) % 100, knots: (i * 29) % 100, flex: (i * 83) % 100, bond: (i * 17) % 100 };
  return { id: `c${i}`, qualities: q, recipe: productionRecipe(q), neighbors: [] };
});

function economics(s: WorldSnapshot) {
  const prices = essencePrices(s);
  const contracts = generateContracts({ snapshot: s, prices, corpus, referenceCost: 120 });
  const m: MarketContext = { prices, scarcity: s.essenceScarcity, contracts, referenceCost: 120, smithAppetite: 1 };
  const evalOf = (f: typeof A) => {
    const cost = productionCost(f.recipe, prices);
    const value = marketValue(f.score, f.recipe, "trialed", m).total;
    return { cost, value, margin: value - cost, efficiency: efficiencyScore(f.score, cost, 120) };
  };
  return { prices, contracts, a: evalOf(A), b: evalOf(B) };
}

describe("Storm scarcity scenario (§69)", () => {
  const worldA = economics(snapshot("A", 15));
  const worldB = economics(snapshot("B", 90));

  it("Snapshot A (Storm cheap): Storm-heavy Form A is competitive or superior", () => {
    expect(worldA.prices.storm).toBeLessThan(ESSENCES.storm.basePrice);
    expect(worldA.a.margin).toBeGreaterThanOrEqual(worldA.b.margin);
    expect(worldA.a.value).toBeGreaterThan(worldA.b.value);
  });

  it("Snapshot B (Storm scarce): Storm-free Form B becomes economically superior", () => {
    expect(worldB.prices.storm).toBeGreaterThan(2 * ESSENCES.storm.basePrice);
    expect(worldB.b.margin).toBeGreaterThan(worldB.a.margin);
    expect(worldB.b.efficiency).toBeGreaterThan(worldB.a.efficiency);
    expect(worldB.b.value).toBeGreaterThan(worldB.a.value);
  });

  it("the same Forms keep their technical ranking; only economics flips", () => {
    expect(A.score).toBeGreaterThan(B.score);
    expect(worldB.a.cost).toBeGreaterThan(worldA.a.cost * 2);
    expect(Math.abs(worldB.b.cost - worldA.b.cost)).toBeLessThan(5);
  });

  it("the contract generator demands Storm-free Forms only when Storm is scarce", () => {
    expect(essenceFreeDemand(worldA.contracts, "storm")).toBe(0);
    expect(essenceFreeDemand(worldB.contracts, "storm")).toBeGreaterThan(0);
    const sub = worldB.contracts.find((c) => c.targetEssence === "storm" && c.requirement.maxEssence?.[0]?.qty === 0)!;
    expect(sub.issuer).toBe("royal");
    expect(sub.reason).toMatch(/Storm/);
  });
});
