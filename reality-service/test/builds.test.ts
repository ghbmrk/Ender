// Spec §97 — required build test: Explorer / Smith / Inquisitor / Merchant presets facing the
// identical candidate context (same Form, same Realm, same neighbours, same world turning) must
// rank and choose meaningfully differently. Exercised through POST /transform (fixture → rule).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Ctx } from "@ender/server/services/context";
import { buildRealityService } from "../src/app";

const PRESETS = ["explorer", "smith", "inquisitor", "merchant"] as const;
const REALM_IDS = ["ashen-vault", "glass-fen", "hollow-keep"] as const;
const pairs = PRESETS.flatMap((a, i) => PRESETS.slice(i + 1).map((b) => [a, b] as const));

let app: FastifyInstance;
let ctx: Ctx;

async function ranking(candidateId: string, realmId: string, preset: string): Promise<string[]> {
  const r = await app.inject({ method: "POST", url: "/transform", payload: { candidateId, realmId, preset, count: 4 } });
  expect(r.statusCode, r.body).toBe(200);
  return r.json().result.choices.map((c: { candidateId: string }) => c.candidateId);
}

beforeAll(async () => {
  ({ app, ctx } = await buildRealityService({ dbPath: ":memory:", recordMissing: false, strictFixtures: false, startDate: "2023-08-04" }));
});
afterAll(async () => {
  await app.close();
});

describe("builds diverge on identical candidate context (§97)", () => {
  it("one Form, one Realm: all four presets pick a different top Form", async () => {
    const byPreset = Object.fromEntries(await Promise.all(PRESETS.map(async (p) => [p, await ranking("1031", "ashen-vault", p)] as const)));
    for (const [a, b] of pairs) {
      expect(byPreset[a]![0], `${a} vs ${b} top pick`).not.toBe(byPreset[b]![0]);
      expect(byPreset[a], `${a} vs ${b} ordering`).not.toEqual(byPreset[b]);
    }
  });

  it("across many contexts every pair of presets usually disagrees on the top pick and almost always on the ordering", async () => {
    const contexts = ctx.reality
      .all()
      .slice(0, 20)
      .flatMap((c) => REALM_IDS.map((r) => ({ c: c.id, r })));
    const rankings = await Promise.all(contexts.map(async ({ c, r }) => Object.fromEntries(await Promise.all(PRESETS.map(async (p) => [p, await ranking(c, r, p)] as const)))));
    for (const [a, b] of pairs) {
      const topDiffers = rankings.filter((x) => x[a]![0] !== x[b]![0]).length / rankings.length;
      const orderDiffers = rankings.filter((x) => JSON.stringify(x[a]) !== JSON.stringify(x[b])).length / rankings.length;
      expect(topDiffers, `${a} vs ${b}: top pick differs in ${Math.round(topDiffers * 100)}% of contexts`).toBeGreaterThanOrEqual(0.5);
      expect(orderDiffers, `${a} vs ${b}: ordering differs in ${Math.round(orderDiffers * 100)}% of contexts`).toBeGreaterThanOrEqual(0.9);
    }
  });
});
