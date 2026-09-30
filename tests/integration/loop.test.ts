// §72 integration tests: each arrow of the core loop, through the real HTTP API.
import { afterEach, describe, expect, it } from "vitest";
import { ESSENCE_IDS } from "@weave/shared";
import { harness } from "./harness";

let h: Awaited<ReturnType<typeof harness>>;
afterEach(async () => h?.close());

const masteryOf = (changes: any[], domain: string) => changes.filter((m) => m.domain === domain);

describe("combat → loot → crafting", () => {
  it("combat → loot: clearing rooms yields Veiled Forms, Crowns and Essences", async () => {
    h = await harness();
    const before = await h.character();
    const { runId, forms } = await h.runToShrine();
    expect(forms.length).toBeGreaterThan(0);
    expect(forms.every((f) => f.tier === "veiled")).toBe(true);
    const done = await h.finishRun(runId);
    expect(done.loot.crowns).toBeGreaterThan(0);
    expect(Object.values(done.loot.essences as Record<string, number>).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    const after = await h.character();
    expect(after.crowns).toBeGreaterThan(before.crowns);
    const inv = await h.call("GET", "/api/inventory");
    expect(inv.artifacts.length).toBeGreaterThanOrEqual(forms.length);
  });

  it("loot → Attune → XP, awarded once per artifact revision", async () => {
    h = await harness();
    const { forms } = await h.runToShrine();
    const xp0 = (await h.character()).xp;
    const at = await h.call("POST", `/api/artifacts/${forms[0].id}/attune`);
    expect(at.artifact.tier).toBe("attuned");
    expect(at.inference.workUnits).toBe(1);
    expect(at.inference.xp).toBe(20);
    expect((await h.character()).xp).toBe(xp0 + 20);
    await expect(h.call("POST", `/api/artifacts/${forms[0].id}/attune`)).rejects.toThrow();
    expect((await h.character()).xp).toBe(xp0 + 20);
  });

  it("Attune → Trial → artifact power rises with evidence", async () => {
    h = await harness();
    const { forms } = await h.runToShrine();
    const at = await h.call("POST", `/api/artifacts/${forms[0].id}/attune`);
    const tr = await h.call("POST", `/api/artifacts/${forms[0].id}/trial`);
    expect(tr.artifact.tier).toBe("trialed");
    expect(tr.evaluation.power).toBeCloseTo(tr.evaluation.technicalScore, 0);
    expect(tr.artifact.evaluation.power).toBeGreaterThan(at.artifact.evaluation.power);
  });

  it("Temper → improved technical score ⇔ Craft Mastery success", async () => {
    h = await harness({ preset: "smith" });
    let improved = 0;
    for (const realm of ["ashen-vault", "glass-fen"]) {
      const { runId, forms } = await h.runToShrine(realm);
      await h.finishRun(runId);
      await h.call("POST", "/api/dev/grant", { focus: 20 });
      for (const f of forms) {
        await h.call("POST", `/api/artifacts/${f.id}/attune`);
        const t = await h.call("POST", `/api/artifacts/${f.id}/temper`, {});
        const best = [...t.options].sort((a: any, b: any) => b.predictedTechnicalScore - a.predictedTechnicalScore)[0];
        const ch = await h.call("POST", `/api/artifacts/${f.id}/temper`, { choice: best.candidateId });
        const craft = masteryOf(ch.mastery, "craft")[0];
        expect(craft.success).toBe(ch.outcome.improved ? 1 : 0);
        if (ch.outcome.improved) improved++;
        const eff = masteryOf(ch.mastery, "efficiency");
        if (ch.outcome.improved || ch.outcome.efficiencyImproved) expect(eff.length).toBe(1);
      }
    }
    expect(improved).toBeGreaterThan(0);
  });

  it("Temper → improved efficiency → Ledger/Commerce progression", async () => {
    h = await harness({ preset: "merchant" });
    let commerce = 0;
    for (const realm of ["ashen-vault", "glass-fen", "hollow-keep"]) {
      const { runId, forms } = await h.runToShrine(realm);
      await h.finishRun(runId);
      await h.call("POST", "/api/dev/grant", { focus: 20 });
      for (const f of forms) {
        await h.call("POST", `/api/artifacts/${f.id}/attune`);
        const t = await h.call("POST", `/api/artifacts/${f.id}/temper`, {});
        const cheapest = [...t.options].sort((a: any, b: any) => b.efficiency - a.efficiency)[0];
        const ch = await h.call("POST", `/api/artifacts/${f.id}/temper`, { choice: cheapest.candidateId });
        commerce += masteryOf(ch.mastery, "commerce").filter((m) => m.success === 1).length;
      }
    }
    expect(commerce).toBeGreaterThan(0);
    expect((await h.character()).mastery.commerce.opportunities).toBeGreaterThan(0);
  });

  it("Fracture → correct weakness → Proof Mastery", async () => {
    h = await harness();
    const { forms } = await h.runToShrine();
    let proofs = 0;
    for (const f of forms) {
      await h.call("POST", `/api/artifacts/${f.id}/attune`);
      const fr = await h.call("POST", `/api/artifacts/${f.id}/fracture`);
      expect(fr.critique.weakness.text.length).toBeGreaterThan(1);
      const proof = masteryOf(fr.mastery, "proof");
      expect(proof.length).toBe(1);
      proofs += proof[0].success;
    }
    expect(proofs).toBeGreaterThan(0);
    expect((await h.character()).mastery.proof.opportunities).toBe(forms.length);
  });
});

describe("economy", () => {
  const priceMap = (w: any) => Object.fromEntries(w.essences.map((e: any) => [e.id, e.price]));

  it("market shock → Essence price change → production cost change → value ranking change", async () => {
    h = await harness({ startDate: "2023-08-04" });
    const w1 = await h.call("GET", "/api/world");
    await h.call("POST", "/api/world/replay-date", { date: "2024-09-06" });
    const w2 = await h.call("GET", "/api/world");
    const p1 = priceMap(w1);
    const p2 = priceMap(w2);
    expect(ESSENCE_IDS.some((e) => Math.abs(p1[e] - p2[e]) / p1[e] > 0.2)).toBe(true);

    // Same corpus, two price vectors: production costs move and margin rankings reorder.
    const cands = h.ctx.reality.all().slice(0, 80);
    const cost = (c: any, p: any) => Object.entries(c.recipe.essenceCosts as Record<string, number>).reduce((s, [e, q]) => s + q * p[e], 0);
    const costs1 = cands.map((c) => cost(c, p1));
    const costs2 = cands.map((c) => cost(c, p2));
    expect(costs1.some((c, i) => Math.abs(c - costs2[i]!) > 1)).toBe(true);
    const order = (costs: number[]) => cands.map((c, i) => ({ id: c.id, m: 300 - costs[i]! })).sort((a, b) => b.m - a.m).map((x) => x.id).join();
    expect(order(costs1)).not.toBe(order(costs2));
  });

  it("market shock → contract generation targets the dear Essence", async () => {
    h = await harness({ startDate: "2023-08-04" });
    const w = await h.call("GET", "/api/world");
    const dearest = [...w.essences].sort((a: any, b: any) => b.priceRatio - a.priceRatio)[0].id;
    const substitution = w.contracts.filter((c: any) => c.targetEssence);
    expect(substitution[0].targetEssence).toBe(dearest);
    expect(substitution[0].requirement.maxEssence).toEqual([{ essence: dearest, qty: 0 }]);
    await h.call("POST", "/api/world/advance", { steps: 4 });
    const w2 = await h.call("GET", "/api/world");
    const ids = (x: any) => x.contracts.map((c: any) => c.id).join();
    expect(ids(w2)).not.toBe(ids(w));
  });

  it("sell artifact → Crowns", async () => {
    h = await harness();
    const { runId, forms } = await h.runToShrine();
    await h.finishRun(runId);
    await h.call("POST", `/api/artifacts/${forms[0].id}/attune`);
    const before = (await h.character()).crowns;
    const s = await h.call("POST", "/api/bazaar/sell", { assetType: "artifact", assetId: forms[0].id });
    expect(s.payout).toBeGreaterThan(0);
    const after = (await h.character()).crowns;
    expect(after).toBeCloseTo(before + s.payout - (s.shortfallCost ?? 0), 0);
    expect(after).not.toBe(before);
  });

  it("Prophecy → settlement → Prophecy Mastery (Brier)", async () => {
    h = await harness();
    const p = await h.call("POST", "/api/prophecies", { essence: "storm", probability: 0.7 });
    const r = await h.call("POST", `/api/prophecies/${p.id}/resolve`);
    expect([0, 1]).toContain(r.outcome ? 1 : 0);
    expect(r.loss).toBeCloseTo((0.7 - (r.outcome ? 1 : 0)) ** 2, 3);
    expect(r.mastery.domain).toBe("prophecy");
    expect((await h.character()).mastery.prophecy.opportunities).toBe(1);
  });
});
