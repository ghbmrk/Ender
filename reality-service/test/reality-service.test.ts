// HTTP contract for the Unreal client: every reality-service endpoint, via Fastify inject.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { ESSENCE_IDS, QUALITY_KEYS } from "@ender/shared";
import type { Ctx } from "@ender/server/services/context";
import { buildRealityService } from "../src/app";

let app: FastifyInstance;
let ctx: Ctx;

async function call<T = any>(method: "GET" | "POST", url: string, payload?: unknown, status = 200): Promise<T> {
  const r = await app.inject({ method, url, payload: payload as any });
  expect(r.statusCode, `${method} ${url}: ${r.body}`).toBe(status);
  return r.json() as T;
}

function expectEnvelope(body: any, workUnits: number) {
  expect(body.result).toBeTypeOf("object");
  expect(body.result).not.toBeNull();
  expect(body.usage).toEqual({ workUnits });
  expect(["fixture", "rule"]).toContain(body.provenance.provider);
  expect(body.provenance.requestHash).toMatch(/^[0-9a-f]{64}$/);
}

const SCIENTIFIC = /pubchem|\bcid\b|formula|molecular|xlogp|tpsa|smiles|complexity|rotatable|hBond/i;
const FINANCIAL = /price|market|financ|currency|exchange|\bECB\b|\b(USD|EUR|ZAR|JPY|GBP|CHF|NOK)\b|volatil|stock|trading|interest/i;

beforeAll(async () => {
  ({ app, ctx } = await buildRealityService({ dbPath: ":memory:", recordMissing: false, strictFixtures: false, startDate: "2023-08-04" }));
  await call("POST", "/api/character/reset", { preset: "smith" });
});
afterAll(async () => {
  await app.close();
});

describe("reality service: world and Realms", () => {
  it("GET /world: replay date, six Essence scarcities 0–100 with in-game prices, world modifiers", async () => {
    const w = await call("GET", "/world");
    expect(w.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Object.keys(w.scarcity).sort()).toEqual([...ESSENCE_IDS].sort());
    expect(w.essences.map((e: any) => e.name)).toEqual(["Ember", "Tide", "Storm", "Root", "Glass", "Ash"]);
    for (const e of w.essences) {
      expect(e.scarcity).toBeGreaterThanOrEqual(0);
      expect(e.scarcity).toBeLessThanOrEqual(100);
      expect(e.price).toBeGreaterThan(0);
      // price = base × external × local × world
      const f = e.priceFactors;
      expect(e.price).toBeCloseTo(e.basePrice * f.externalScarcity * f.localSupplyDemand * f.worldModifier, 1);
      expect(w.prices[e.id]).toBe(e.price);
    }
    expect(Array.isArray(w.modifiers)).toBe(true);
  });

  it("GET /realm/:id: card in fantasy terms plus everything to preload before entering", async () => {
    const r = await call("GET", "/realm/glass-fen");
    const card = r.card;
    expect(card.difficulty).toBe(2);
    expect(card.expectedEssences.length).toBeGreaterThan(0);
    expect(card.scarcity).toHaveLength(6);
    for (const s of card.scarcity) expect(["very abundant", "abundant", "steady", "scarce", "very scarce"]).toContain(s.word);
    expect(card.formBias).toEqual(["Far Reach", "Deep Veil", "Supple Flex"]);
    // Storm is the dearest Essence at this turning: a Royal Storm-free demand shows on the card.
    expect(card.contracts.map((c: any) => c.label)).toContainEqual(expect.stringMatching(/^Royal Demand: Storm-free Forms [+−]\d+% bounty$/));
    expect(JSON.stringify(card)).not.toMatch(FINANCIAL);

    const p = r.preload;
    expect(p.runStart).toMatchObject({ method: "POST", path: "/api/runs", body: { realmId: "glass-fen" } });
    expect(p.rooms).toHaveLength(8);
    expect(p.boss.hp).toBeGreaterThan(0);
    expect(Object.keys(p.enemies).length).toBeGreaterThan(0);
    expect(p.craft.focusPerRealm).toBe(12);
    expect(p.character.stats.maxHealth).toBeGreaterThan(0);
    await call("GET", "/realm/nowhere", undefined, 404);
  });
});

describe("reality service: Realm drop pool and client-chosen drops", () => {
  it("GET /realm/:id/pool: the whole ranked corpus, fantasy ids + six qualities + technical percentile, nothing scientific", async () => {
    const p = await call("GET", "/realm/glass-fen/pool");
    expect(p.realmId).toBe("glass-fen");
    expect(p.size).toBe(ctx.reality.all().length);
    expect(p.candidates).toHaveLength(p.size);
    let prev = -1;
    for (const c of p.candidates) {
      expect(c.id).toMatch(/^form-/);
      expect(Object.keys(c.qualities)).toEqual(["burden", "veil", "reach", "knots", "flex", "bond"]);
      for (const v of Object.values(c.qualities) as number[]) expect(v >= 0 && v <= 100).toBe(true);
      expect(c.technicalPercentile).toBeGreaterThanOrEqual(0);
      expect(c.technicalPercentile).toBeLessThanOrEqual(100);
      expect(c.technicalPercentile).toBeGreaterThanOrEqual(prev);
      prev = c.technicalPercentile;
    }
    expect(JSON.stringify(p)).not.toMatch(SCIENTIFIC);
    // The seed announced for the next run is the one the server issues.
    const run = await call("POST", "/api/runs", { realmId: "glass-fen" });
    expect(run.plan.seed).toBe(p.nextRunSeed);
    await call("POST", `/api/runs/${run.plan.runId}/complete`, { outcome: "abandon", roomsCleared: [], advanceWorld: false });
    await call("GET", "/realm/nowhere/pool", undefined, 404);
  });

  it("checkpoint/complete honour client-reported forms from the pool, and reject Forms outside it", async () => {
    const pool = (await call("GET", "/realm/hollow-keep/pool")).candidates as { id: string }[];
    const top = pool.at(-1)!.id;
    const second = pool.at(-2)!.id;
    const bottom = pool[0]!.id;
    const run = await call("POST", "/api/runs", { realmId: "hollow-keep" });
    const url = (what: string) => `/api/runs/${run.plan.runId}/${what}`;

    await call("POST", url("checkpoint"), { roomsCleared: [0, 1], forms: [{ room: 0, candidateId: "form-notreal" }] }, 400);
    await call("POST", url("checkpoint"), { roomsCleared: [0, 1], forms: [{ room: 3, candidateId: top }] }, 400);
    // A rejected report grants nothing: room 0 can still be claimed.
    const cp = await call("POST", url("checkpoint"), { roomsCleared: [0, 1, 2, 3, 4], forms: [{ room: 0, candidateId: top }, { room: 2, candidateId: second }] });
    expect(cp.artifacts.map((a: any) => a.fantasyId)).toEqual([top, second]);

    const done = await call("POST", url("complete"), {
      outcome: "victory",
      roomsCleared: [0, 1, 2, 3, 4, 5, 6, 7],
      forms: [{ room: 0, candidateId: top }, { room: 7, candidateId: bottom }],
      advanceWorld: false,
    });
    // Room 0 was already banked at the checkpoint; only the boss drop is new.
    expect(done.runArtifacts.map((a: any) => a.fantasyId)).toEqual([top, second, bottom]);
  });
});

describe("reality service: Forms", () => {
  let fantasyId: string;
  const realityId = () => ctx.reality.all()[5]!.id;

  it("GET /candidate/:id hides scientific fields unless ?provenance=1", async () => {
    const c = await call("GET", `/candidate/${realityId()}`);
    fantasyId = c.id;
    expect(fantasyId).toMatch(/^form-/);
    expect(Object.keys(c.qualities).sort()).toEqual([...QUALITY_KEYS].sort());
    for (const k of QUALITY_KEYS) {
      expect(c.qualities[k]).toBeGreaterThanOrEqual(0);
      expect(c.qualities[k]).toBeLessThanOrEqual(100);
    }
    expect(c.recipe.essenceCosts).toBeTypeOf("object");
    expect(c.productionCost).toBeGreaterThan(0);
    expect(c.evaluation).toBeNull();
    expect(c.provenance).toBeUndefined();
    expect(JSON.stringify(c)).not.toMatch(SCIENTIFIC);

    const byFantasy = await call("GET", `/candidate/${fantasyId}?realm=ashen-vault`);
    expect(byFantasy.id).toBe(fantasyId);
    expect(JSON.stringify(byFantasy)).not.toMatch(SCIENTIFIC);
    for (const k of ["technicalScore", "estimatedMarketValue", "efficiencyScore", "marginPotential", "productionCost"]) expect(byFantasy.evaluation[k]).toBeTypeOf("number");
    expect(byFantasy.evaluation.evidenceTier).toBe("trialed");

    const prov = await call("GET", `/candidate/${fantasyId}?provenance=1`);
    expect(prov.provenance.source).toBe("pubchem");
    expect(prov.provenance.cid).toBe(realityId());
    expect(prov.provenance.molecularFormula).toBeTypeOf("string");
    expect(prov.provenance.molecularWeight).toBeTypeOf("number");
    expect(prov.provenance.normalization).toHaveLength(6);

    await call("GET", "/candidate/form-doesnotexist", undefined, 404);
    await call("GET", `/candidate/${fantasyId}?tier=legendary`, undefined, 400);
  });

  it("GET /candidate/:id/neighbors returns graph neighbours (fantasy ids only)", async () => {
    const n = await call("GET", `/candidate/${fantasyId}/neighbors?limit=5&realm=hollow-keep`);
    expect(n.id).toBe(fantasyId);
    expect(n.neighbors).toHaveLength(5);
    for (const x of n.neighbors) {
      expect(x.id).toMatch(/^form-/);
      expect(x.distance).toBeGreaterThanOrEqual(0);
      expect(x.technicalScore).toBeTypeOf("number");
    }
    expect(JSON.stringify(n)).not.toMatch(SCIENTIFIC);
    const p = await call("GET", `/candidate/${fantasyId}/neighbors?limit=2&provenance=1`);
    expect(p.neighbors[0].provenance.cid).toBeTypeOf("string");
  });

  it("POST /evaluate: deterministic Trial / Mirror / Deep Trial", async () => {
    const t1 = await call("POST", "/evaluate", { candidateId: fantasyId, realmId: "ashen-vault", mode: "trial" });
    const t2 = await call("POST", "/evaluate", { candidateId: fantasyId, realmId: "ashen-vault", mode: "trial" });
    expect(t1).toEqual(t2);
    expect(t1.evaluation.evidenceTier).toBe("trialed");
    expect(t1.cost).toEqual({ focus: 0, workUnits: 0 });
    const m = await call("POST", "/evaluate", { candidateId: fantasyId, realmId: "ashen-vault", mode: "mirror" });
    expect(m.mirror.mirrorScores).toHaveLength(4);
    expect(["trialed", "witnessed"]).toContain(m.evaluation.evidenceTier);
    expect(m.cost).toEqual({ focus: 2, workUnits: 3 });
    const d = await call("POST", "/evaluate", { candidateId: fantasyId, realmId: "ashen-vault", mode: "deep-trial" });
    expect(d.alternatives.strongestNeighbor.id).toMatch(/^form-/);
    expect(d.cost).toEqual({ focus: 3, workUnits: 5 });
    // Power = technical × evidence multiplier, clamped 0–110.
    const mult = { trialed: 1, witnessed: 1.1 } as Record<string, number>;
    expect(d.evaluation.power).toBeCloseTo(Math.min(110, d.evaluation.technicalScore * mult[d.evaluation.evidenceTier]!), 1);
    await call("POST", "/evaluate", { mode: "trial" }, 400);
    await call("POST", "/evaluate", { candidateId: fantasyId, realmId: "ashen-vault", mode: "gaze" }, 400);
  });
});

describe("reality service: inference envelopes (fixture → rule, zero paid inference)", () => {
  let fantasyId: string;
  beforeAll(async () => {
    fantasyId = (await call("GET", `/candidate/${ctx.reality.all()[11]!.id}`)).id;
  });

  it("POST /attune", async () => {
    const a = await call("POST", "/attune", { candidateId: fantasyId, realmId: "ashen-vault", preset: "explorer" });
    expectEnvelope(a, 1);
    expect(a.result.fantasyName).toBeTypeOf("string");
    expect(["equip", "transform", "trial", "sell"]).toContain(a.result.suggestedAction);
  });

  it("POST /transform", async () => {
    const t = await call("POST", "/transform", { candidateId: fantasyId, realmId: "glass-fen", count: 3 });
    expectEnvelope(t, 3);
    expect(t.result.choices).toHaveLength(3);
    for (const c of t.result.choices) expect(c.candidateId).toMatch(/^form-/);
  });

  it("POST /critique (Fracture 1 WU, Mirror 3 WU, Deep Trial 5 WU)", async () => {
    const f = await call("POST", "/critique", { candidateId: fantasyId, realmId: "hollow-keep", mode: "fracture" });
    expectEnvelope(f, 1);
    expect(["sound", "fragile", "flawed"]).toContain(f.result.verdict);
    expectEnvelope(await call("POST", "/critique", { candidateId: fantasyId, realmId: "hollow-keep", mode: "mirror" }), 3);
    expectEnvelope(await call("POST", "/critique", { candidateId: fantasyId, realmId: "hollow-keep", mode: "deep" }), 5);
    await call("POST", "/critique", { candidateId: fantasyId }, 400);
  });

  it("artifact mode drives the real crafting services (Focus, XP) and still answers with the envelope", async () => {
    const run = await call("POST", "/api/runs", { realmId: "ashen-vault" });
    const cp = await call("POST", `/api/runs/${run.plan.runId}/checkpoint`, { roomsCleared: [0, 1, 2, 3, 4] });
    const id = cp.artifacts[0].id as string;
    const before = await call("GET", "/api/character");

    const at = await call("POST", "/attune", { artifactId: id });
    expectEnvelope(at, 1);
    expect(at.game.artifact.tier).toBe("attuned");
    expect(at.game.xpAwarded).toBe(20); // round(20 × 1^0.72)

    const ev = await call("POST", "/evaluate", { artifactId: id, mode: "trial" });
    expect(ev.source).toBe("artifact");
    expect(ev.artifact.tier).toBe("trialed");

    const fr = await call("POST", "/critique", { artifactId: id, mode: "fracture" });
    expectEnvelope(fr, 1);

    const tr = await call("POST", "/transform", { artifactId: id });
    expectEnvelope(tr, 3);
    expect(tr.result.choices.length).toBeGreaterThan(0);
    const again = await call("POST", "/transform", { artifactId: id });
    expect(again.usage.workUnits).toBe(0);
    expect(again.provenance.requestHash).toBe(tr.provenance.requestHash);

    const after = await call("GET", "/api/character");
    expect(before.focus - after.focus).toBe(1 + 1 + 2); // Attune 1, Fracture 1, Temper 2
  });
});

describe("reality service: Bazaar, contracts, Prophecy", () => {
  it("GET /bazaar and GET /contracts", async () => {
    const b = await call("GET", "/bazaar");
    expect(b.essences).toHaveLength(6);
    expect(Array.isArray(b.offers)).toBe(true);
    const c = await call("GET", "/contracts");
    expect(c.contracts.length).toBeGreaterThan(0);
    for (const x of c.contracts) expect(x.label).toMatch(/Demand: /);
    expect(c.contracts.some((x: any) => x.targetEssence === "storm" && x.requirement.maxEssence?.[0]?.qty === 0)).toBe(true);
  });

  it("POST /prophecy + /prophecy/resolve score with Brier", async () => {
    await call("POST", "/prophecy", { essence: "storm", probability: 0.2 }, 400);
    const p = await call("POST", "/prophecy", { essence: "storm", probability: 0.7 });
    expect(p.id).toBeTypeOf("string");
    expect(p.scarcityNow).toBeTypeOf("number");
    const r = await call("POST", "/prophecy/resolve", { id: p.id });
    expect([0, 1]).toContain(r.outcome);
    expect(r.loss).toBeCloseTo((0.7 - r.outcome) ** 2, 4);
    expect(r.quality).toBeCloseTo(1 - r.loss, 4);
    expect(r.outcome).toBe(r.scarcityAfter > r.scarcityBefore ? 1 : 0);
  });

  it("keeps every /api/* route mounted on the same instance", async () => {
    expect((await call("GET", "/api/health")).ok).toBe(true);
    expect((await call("GET", "/health")).ok).toBe(true);
    expect((await call("GET", "/api/inventory")).artifacts.length).toBeGreaterThan(0);
    expect((await call("GET", "/api/passives")).branches).toBeTruthy();
    expect((await call("GET", "/api/world")).snapshot.date).toMatch(/^\d{4}-/);
  });
});
