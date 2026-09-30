// §71 unit tests: normalization, objective scoring, power, XP, levels, Mastery, Work Units, forecasts, SearchPolicy.
import { describe, expect, it } from "vitest";
import type { FormRealityData, RealmObjective } from "@ender/shared";
import {
  FOCUS_COST,
  PRESET_POLICIES,
  WORK_UNITS,
  artifactPower,
  brierQuality,
  computeBands,
  computeCombatStats,
  effectivePolicy,
  emptyMastery,
  levelForXp,
  masteryConfidence,
  masteryDisplay,
  masteryPosterior,
  normalize,
  normalizePolicy,
  recordMastery,
  scoreObjective,
  weaknesses,
  xpAwardKey,
  xpForWorkUnits,
  xpRequired,
} from "../src";

const rec = (mw: number): FormRealityData =>
  ({ source: "pubchem", externalId: String(mw), molecularWeight: mw, xlogp: 1, tpsa: 20, complexity: 50, rotatableBondCount: 2, hBondDonorCount: 1, hBondAcceptorCount: 1 }) as FormRealityData;

describe("normalization", () => {
  it("maps p05 → 0 and p95 → 100, clamps outside, and 50 for missing", () => {
    const band = { p05: 100, p95: 300 };
    expect(normalize(100, band)).toBe(0);
    expect(normalize(300, band)).toBe(100);
    expect(normalize(200, band)).toBe(50);
    expect(normalize(20, band)).toBe(0);
    expect(normalize(900, band)).toBe(100);
    expect(normalize(undefined, band)).toBe(50);
  });
  it("computes bands from the corpus percentiles", () => {
    const corpus = Array.from({ length: 101 }, (_, i) => rec(100 + i * 2));
    const b = computeBands(corpus).burden;
    expect(b.p05).toBeCloseTo(110, 0);
    expect(b.p95).toBeCloseTo(290, 0);
  });
});

describe("objective scoring", () => {
  const o: RealmObjective = {
    id: "t",
    constraints: [
      { quality: "burden", mode: "minimize", weight: 1 },
      { quality: "knots", mode: "maximize", weight: 1 },
      { quality: "veil", mode: "target", target: 40, tolerance: 10, weight: 2 },
    ],
  };
  const q = { burden: 20, veil: 40, reach: 0, knots: 60, flex: 0, bond: 0 };
  it("combines maximize, minimize and target modes by normalized weight", () => {
    // 0.25·80 + 0.25·60 + 0.5·100 = 85
    expect(scoreObjective(q, o).technicalScore).toBe(85);
  });
  it("target satisfaction falls off as a Gaussian", () => {
    const off = scoreObjective({ ...q, veil: 50 }, o).contributions.find((c) => c.quality === "veil")!;
    expect(off.satisfaction).toBeCloseTo(60.7, 1);
  });
  it("weaknesses are ordered by points lost", () => {
    expect(weaknesses(q, o)[0]!.quality).toBe("knots");
  });
});

describe("artifact power", () => {
  it("scales technical score by evidence tier", () => {
    expect(artifactPower(80, "veiled")).toBe(56);
    expect(artifactPower(80, "attuned")).toBe(68);
    expect(artifactPower(80, "trialed")).toBe(80);
    expect(artifactPower(80, "witnessed")).toBe(88);
  });
  it("an equipped blade raises attack damage", () => {
    const base = computeCombatStats({ level: 1, equippedPower: {}, passive: { damagePct: 0, healthFlat: 0, critChance: 0 } });
    const armed = computeCombatStats({ level: 1, equippedPower: { blade: 80 }, passive: { damagePct: 0, healthFlat: 0, critChance: 0 } });
    expect(armed.attackDamage).toBeGreaterThan(base.attackDamage);
  });
});

describe("XP, levels and Work Units", () => {
  it("XP = round(20 × WU^0.72)", () => {
    expect(xpForWorkUnits(1)).toBe(20);
    expect(xpForWorkUnits(3)).toBe(Math.round(20 * 3 ** 0.72));
    expect(xpForWorkUnits(0)).toBe(0);
  });
  it("level threshold = round(100 × (L−1)^1.55), capped at 30", () => {
    expect(xpRequired(1)).toBe(0);
    expect(xpRequired(2)).toBe(100);
    expect(xpRequired(3)).toBe(Math.round(100 * 2 ** 1.55));
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(1e9)).toBe(30);
  });
  it("Work Units and Focus are fixed per action; Trial is free", () => {
    expect(WORK_UNITS).toMatchObject({ attune: 1, fracture: 1, temper: 3, trial: 0, mirror: 3, "deep-trial": 5 });
    expect(FOCUS_COST.trial).toBe(0);
  });
  it("XP is keyed once per (character, artifact revision, action)", () => {
    expect(xpAwardKey("c", "a", 1, "attune")).not.toBe(xpAwardKey("c", "a", 2, "attune"));
    expect(xpAwardKey("c", "a", 1, "attune")).toBe(xpAwardKey("c", "a", 1, "attune"));
  });
});

describe("Mastery (Bayesian)", () => {
  it("starts at a neutral prior with zero confidence", () => {
    const m = emptyMastery().craft;
    expect(masteryPosterior(m)).toBe(0.5);
    expect(masteryConfidence(m)).toBe(0);
    expect(masteryDisplay(m)).toBe(0);
  });
  it("successes raise it, failures lower it, and confidence grows with opportunities", () => {
    let good = emptyMastery().craft;
    let bad = emptyMastery().craft;
    for (let i = 0; i < 10; i++) {
      good = recordMastery(good, 1);
      bad = recordMastery(bad, 0);
    }
    expect(masteryPosterior(good)).toBeGreaterThan(0.8);
    expect(masteryPosterior(bad)).toBeLessThan(0.2);
    expect(masteryDisplay(good)).toBeGreaterThan(masteryDisplay(bad));
    expect(masteryConfidence(good)).toBeGreaterThan(0.5);
  });
});

describe("forecast scoring", () => {
  it("Brier loss rewards calibrated confidence", () => {
    expect(brierQuality(0.9, 1).loss).toBeCloseTo(0.01);
    expect(brierQuality(0.9, 0).loss).toBeCloseTo(0.81);
    expect(brierQuality(0.5, 1).loss).toBe(0.25);
  });
});

describe("SearchPolicy weighting", () => {
  it("normalizes to weights summing to 1", () => {
    const n = normalizePolicy(PRESET_POLICIES.merchant);
    expect(Object.values(n).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 3);
    expect(n.arbitrage).toBeGreaterThan(n.exploration);
  });
  it("passives shift the effective policy", () => {
    const base = PRESET_POLICIES.smith;
    expect(effectivePolicy(base, [])).toEqual(base);
    const forged = effectivePolicy(base, ["tempered-purpose", "narrow-search"]);
    expect(forged.optimization).toBe(1); // 0.9 + 0.35, clamped
    expect(forged.exploration).toBeCloseTo(0.05, 3);
  });
});
