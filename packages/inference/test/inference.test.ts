// §71 unit tests: candidate ranking, fixture hashing, fixture validation, provider selection.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRESET_POLICIES } from "@weave/domain";
import { REALMS } from "@weave/content";
import {
  ChatGPTPlanInferenceProvider,
  FixtureInferenceProvider,
  FixtureRequired,
  rankCandidates,
  requestHash,
  ruleTransform,
  validateFixture,
  type TransformRequest,
} from "../src";

const objective = REALMS[0]!.objective;
const q = (burden: number, knots: number, veil: number) => ({ burden, knots, veil, reach: 20, flex: 20, bond: 20 });
const scarcity = { ember: 50, tide: 50, storm: 50, root: 50, glass: 50, ash: 50 };
const request = (policy = PRESET_POLICIES.smith, costWeight = 0): TransformRequest => ({
  artifact: { fantasyId: "form-a", qualities: q(50, 30, 45), predictedTechnicalScore: 50, productionCost: 60 },
  realmObjective: objective,
  candidates: [
    { candidateId: "best", qualities: q(30, 50, 45), predictedTechnicalScore: 80, productionCost: 300, marketValue: 400, distance: 30, efficiency: 20, lore: "unsynced" },
    { candidateId: "far", qualities: q(90, 10, 90), predictedTechnicalScore: 35, productionCost: 150, marketValue: 180, distance: 95, efficiency: 18, lore: "unsynced" },
    { candidateId: "cheap", qualities: q(45, 40, 45), predictedTechnicalScore: 58, productionCost: 10, marketValue: 90, distance: 12, efficiency: 85, lore: "unsynced" },
    { candidateId: "near", qualities: q(48, 33, 44), predictedTechnicalScore: 52, productionCost: 60, marketValue: 100, distance: 5, efficiency: 45, lore: "unsynced" },
  ],
  marketContext: { productionCost: 60, currentDemand: 1, essenceScarcity: scarcity },
  buildPolicy: policy,
  costWeight,
  count: 1,
});

describe("candidate ranking", () => {
  it("different builds pick different candidates from the same set", () => {
    expect(rankCandidates(request(PRESET_POLICIES.smith))[0]!.candidate.candidateId).toBe("best");
    expect(rankCandidates(request(PRESET_POLICIES.explorer))[0]!.candidate.candidateId).toBe("far");
    expect(rankCandidates(request(PRESET_POLICIES.merchant))[0]!.candidate.candidateId).toBe("cheap");
  });
  it("Lean Forge cost weight pushes ranking toward cheaper Forms", () => {
    const plain = rankCandidates(request(PRESET_POLICIES.smith, 0)).find((r) => r.candidate.candidateId === "cheap")!.utility;
    const lean = rankCandidates(request(PRESET_POLICIES.smith, 1)).find((r) => r.candidate.candidateId === "cheap")!.utility;
    expect(lean).toBeGreaterThan(plain);
  });
  it("rule transform only returns IDs from the request", () => {
    for (const c of ruleTransform({ ...request(), count: 3 }).choices) expect(["best", "far", "cheap", "near"]).toContain(c.candidateId);
  });
});

describe("fixture hashing", () => {
  it("is stable under key order and differs by kind and content", () => {
    expect(requestHash("attune", { a: 1, b: { c: 2, d: 3 } })).toBe(requestHash("attune", { b: { d: 3, c: 2 }, a: 1 }));
    expect(requestHash("attune", { a: 1 })).not.toBe(requestHash("critique", { a: 1 }));
    expect(requestHash("attune", { a: 1 })).not.toBe(requestHash("attune", { a: 2 }));
    expect(requestHash("attune", { a: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("fixture validation", () => {
  const req = request();
  const good = { requestHash: requestHash("transform", req), result: { choices: [{ candidateId: "cheap", emphasis: "economize", rationale: "Nearly free to make." }], summary: "Frugal." } };
  it("accepts a well-formed fixture", () => expect(validateFixture("transform", req, good)).toEqual([]));
  it("rejects invented candidate IDs", () => {
    const bad = { ...good, result: { ...good.result, choices: [{ candidateId: "ghost", emphasis: "improve", rationale: "x y" }] } };
    expect(validateFixture("transform", req, bad).join()).toMatch(/invented candidate id ghost/);
  });
  it("rejects invented numbers", () => {
    const bad = { ...good, result: { ...good.result, summary: "It will score 97." } };
    expect(validateFixture("transform", req, bad).join()).toMatch(/number 97/);
  });
  it("accepts numbers present in the request", () => {
    const ok = { ...good, result: { ...good.result, summary: "It should score near 80." } };
    expect(validateFixture("transform", req, ok)).toEqual([]);
  });
  it("rejects hash mismatches and schema violations", () => {
    expect(validateFixture("transform", req, { ...good, requestHash: "0".repeat(64) }).join()).toMatch(/hash mismatch/);
    expect(validateFixture("transform", req, { ...good, result: { choices: [] } }).join()).toMatch(/schema/);
  });
});

describe("providers", () => {
  it("strict fixture mode throws FixtureRequired and records the request", async () => {
    const dir = mkdtempSync(join(tmpdir(), "weave-fx-"));
    const p = new FixtureInferenceProvider({ fixturesDir: join(dir, "f"), requestsDir: join(dir, "r"), strict: true });
    await expect(p.transform(request())).rejects.toBeInstanceOf(FixtureRequired);
  });
  it("non-strict mode falls back to rules", async () => {
    const dir = mkdtempSync(join(tmpdir(), "weave-fx-"));
    const p = new FixtureInferenceProvider({ fixturesDir: join(dir, "f"), requestsDir: join(dir, "r"), recordMissing: false });
    const out = await p.transform(request());
    expect(out.provenance.provider).toBe("rule");
  });
  it("the future ChatGPT provider is a stub that refuses to run", async () => {
    await expect(new ChatGPTPlanInferenceProvider().transform(request())).rejects.toThrow();
  });
});
