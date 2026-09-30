// §71 unit tests: recipes, production cost, market value, efficiency, scarcity, local demand, contracts.
import { describe, expect, it } from "vitest";
import { ESSENCE_IDS, type EssenceId, type WorldSnapshot } from "@weave/shared";
import { ESSENCES, RECIPE_DRIVERS } from "@weave/content";
import {
  PRESSURE_PER_UNIT,
  efficiencyScore,
  essencePrice,
  essencePrices,
  externalScarcityFactor,
  generateContracts,
  localDemandFactor,
  marketValue,
  merchantDecay,
  productionCost,
  productionRecipe,
  salvageValue,
  scarcityAt,
  type MarketContext,
} from "../src";

const snap = (scar: Partial<Record<EssenceId, number>> = {}): WorldSnapshot => ({
  id: "s",
  index: 0,
  date: "2025-01-03",
  essenceScarcity: Object.fromEntries(ESSENCE_IDS.map((e) => [e, scar[e] ?? 50])) as Record<EssenceId, number>,
  essenceBasePrice: Object.fromEntries(ESSENCE_IDS.map((e) => [e, ESSENCES[e].basePrice])) as Record<EssenceId, number>,
  realmModifiers: [],
  marketObservationIds: [],
});

describe("production recipe", () => {
  it("each quality ≥ 35 demands its driver Essence, round((q−25)/6)", () => {
    const r = productionRecipe({ burden: 85, veil: 34, reach: 35, knots: 0, flex: 100, bond: 60 });
    expect(r.essenceCosts[RECIPE_DRIVERS.burden]).toBe(10);
    expect(r.essenceCosts[RECIPE_DRIVERS.reach]).toBe(2);
    expect(r.essenceCosts[RECIPE_DRIVERS.veil]).toBeUndefined();
  });
  it("production cost sums quantity × price", () => {
    const prices = { ember: 10, tide: 8, storm: 12, root: 9, glass: 11, ash: 7 };
    expect(productionCost({ essenceCosts: { storm: 2, glass: 3 } }, prices)).toBe(57);
  });
});

describe("prices", () => {
  it("external factor doubles every 35 scarcity points", () => {
    expect(externalScarcityFactor(50)).toBe(1);
    expect(externalScarcityFactor(85)).toBe(2);
    expect(externalScarcityFactor(15)).toBe(0.5);
  });
  it("local supply-demand: Smiths hoard scarce Essences; player pressure raises price; Merchants decay it", () => {
    expect(localDemandFactor(snap(), "tide", 0)).toBe(1);
    expect(localDemandFactor(snap(), "glass", 0)).toBe(1.05);
    expect(localDemandFactor(snap({ tide: 100 }), "tide", 0)).toBe(1.1);
    expect(localDemandFactor(snap(), "tide", 10 * PRESSURE_PER_UNIT)).toBeCloseTo(1.12);
    expect(localDemandFactor(snap(), "tide", 5)).toBe(1.4);
    expect(merchantDecay({ ember: 0.2, tide: 0, storm: -0.1, root: 0, glass: 0, ash: 0 }).ember).toBe(0.1);
  });
  it("price = base × external × local × world", () => {
    const p = essencePrice(snap({ storm: 85 }), "storm");
    expect(p.price).toBeCloseTo(ESSENCES.storm.basePrice * 2 * p.local * p.world, 1);
  });
});

describe("valuation", () => {
  const m: MarketContext = { prices: essencePrices(snap()), scarcity: snap().essenceScarcity, contracts: [], referenceCost: 100, smithAppetite: 1 };
  it("market value grows with score and evidence", () => {
    const r = { essenceCosts: { ember: 2 } };
    expect(marketValue(80, r, "trialed", m).total).toBeGreaterThan(marketValue(60, r, "trialed", m).total);
    expect(marketValue(80, r, "witnessed", m).total).toBeGreaterThan(marketValue(80, r, "trialed", m).total);
  });
  it("Forms that avoid scarce Essences are worth more", () => {
    const scarce = { ...m, scarcity: snap({ storm: 90 }).essenceScarcity };
    expect(marketValue(70, { essenceCosts: { root: 4 } }, "trialed", scarce).total).toBeGreaterThan(marketValue(70, { essenceCosts: { storm: 4 } }, "trialed", scarce).total);
  });
  it("efficiency is bounded 0–100 and falls as cost rises", () => {
    expect(efficiencyScore(100, 100, 100)).toBe(50);
    expect(efficiencyScore(60, 20, 100)).toBeGreaterThan(efficiencyScore(60, 200, 100));
    expect(efficiencyScore(100, 0, 100)).toBeLessThanOrEqual(100);
  });
  it("salvage is a small fixed fraction", () => expect(salvageValue(60)).toBe(31));
});

describe("scarcity index", () => {
  const pts = (vals: number[]) => vals.map((v, i) => ({ date: `d${i}`, obsDate: `d${i}`, value: v }));
  it("stays within 0–100 and rises when the price hits a 52-week high after a shock", () => {
    const calm = Array.from({ length: 60 }, (_, i) => 1 + 0.01 * Math.sin(i));
    const shocked = [...calm.slice(0, 59), 1.2];
    const a = scarcityAt(pts(calm), 59).scarcity;
    const b = scarcityAt(pts(shocked), 59).scarcity;
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThanOrEqual(100);
    expect(scarcityAt(pts(shocked), 59).percentile52).toBeGreaterThan(0.95);
  });
});

describe("contract generation", () => {
  const corpus = Array.from({ length: 40 }, (_, i) => {
    const q = { burden: (i * 37) % 100, veil: (i * 53) % 100, reach: (i * 71) % 100, knots: (i * 29) % 100, flex: (i * 83) % 100, bond: (i * 17) % 100 };
    return { id: `c${i}`, qualities: q, recipe: productionRecipe(q), neighbors: [] };
  });
  it("the primary substitution contract targets the most expensive Essence, and is deterministic", () => {
    const s = snap({ ash: 95 });
    const a = generateContracts({ snapshot: s, prices: essencePrices(s), corpus, referenceCost: 100 });
    const b = generateContracts({ snapshot: s, prices: essencePrices(s), corpus, referenceCost: 100 });
    expect(a[0]!.targetEssence).toBe("ash");
    expect(a[0]!.requirement.maxEssence).toEqual([{ essence: "ash", qty: 0 }]);
    expect(a).toEqual(b);
  });
});
