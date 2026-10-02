// §51–52 and §98: Inscribe, the Loom layout API, Keystone gating, Temper keeping the Loom slot, Mirror charges.
import { afterEach, describe, expect, it } from "vitest";
import { REALMS } from "@ender/content";
import { ESSENCE_IDS } from "@ender/shared";
import { mirrorObjectives, technicalScore } from "@ender/domain";
import { productionCost, productionRecipe } from "@ender/economy";
import { affinitiesOf, compileLoom, type Affinity } from "../../packages/battle/src";
import { harness } from "./harness";

let h: Awaited<ReturnType<typeof harness>>;
afterEach(async () => h?.close());

const PLENTY = { ember: 60, tide: 60, storm: 60, root: 60, glass: 60, ash: 60 };
const grantForm = (realityId: string, realmId = "glass-fen", tier: "attuned" | "veiled" = "attuned") => h.call("POST", "/api/dev/grant-form", { realityId, realmId, tier });
const affs = (id: string) => affinitiesOf(h.ctx.reality.candidateSync(id).qualities);
const has = (a: [Affinity, Affinity], x: Affinity, y: Affinity) => a.includes(x) && a.includes(y);

describe("Inscribe (§51)", () => {
  it("needs an Attuned Form, weaves free the first time, and charges the recipe only for a different role", async () => {
    h = await harness();
    await h.call("POST", "/api/dev/grant", { essences: PLENTY });
    const c = h.ctx.reality.all()[0]!;
    const veiled = await grantForm(c.id, "glass-fen", "veiled");
    expect(veiled.affinities).toBeNull();
    expect(veiled.nodePotency).toBeNull();
    expect((await h.raw("POST", `/api/artifacts/${veiled.id}/inscribe`, { role: "action" })).status).toBe(400);

    const f = await grantForm(c.id);
    expect(f.affinities).toEqual(affinitiesOf(c.qualities));
    expect(f.inscribedRole).toBeNull();
    expect(f.loom).toBeNull();
    const recipe = productionRecipe(c.qualities).essenceCosts;
    expect(f.inscribeCost).toEqual(recipe);
    const before = (await h.character()).essences;
    const ins = await h.call("POST", `/api/artifacts/${f.id}/inscribe`, { role: "action" });
    expect(ins.artifact.inscribedRole).toBe("action");
    for (const e of Object.keys(recipe)) expect(ins.essences[e]).toBe(before[e]);

    const same = await h.raw("POST", `/api/artifacts/${f.id}/inscribe`, { role: "action" });
    expect(same.status).toBe(400);
    expect(same.body.error).toMatch(/already Inscribed/);

    await h.call("PUT", "/api/loom/iron", { nodes: [{ artifactId: f.id, q: 1, r: 0 }] });
    const again = await h.call("POST", `/api/artifacts/${f.id}/inscribe`, { role: "reaction" });
    expect(again.artifact.inscribedRole).toBe("reaction");
    expect(again.artifact.loom).toEqual({ root: "iron", q: 1, r: 0 });
    for (const [e, q] of Object.entries(recipe)) expect(again.essences[e]).toBe(before[e] - q!);
  });

  it("a first weave never waits on Essences; a change of role refuses when one runs short", async () => {
    h = await harness();
    // A Form whose recipe needs more of some Essence than the starting 6.
    const held = (await h.character()).essences;
    const need = (x: { qualities: any }) => productionRecipe(x.qualities).essenceCosts;
    const c = h.ctx.reality.all().find((x) => ESSENCE_IDS.some((e) => (need(x)[e] ?? 0) > held[e]))!;
    const short = ESSENCE_IDS.find((e) => (need(c)[e] ?? 0) > held[e]);
    const f = await grantForm(c.id);
    expect((await h.call("POST", `/api/artifacts/${f.id}/inscribe`, { role: "modifier" })).artifact.inscribedRole).toBe("modifier");
    const r = await h.raw("POST", `/api/artifacts/${f.id}/inscribe`, { role: "action" });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe(`not enough ${short}`);
    expect((await h.call("GET", `/api/artifacts/${f.id}`)).artifact.inscribedRole).toBe("modifier");
  });

  it("offers Keystone only to a Witnessed Form with technical score ≥ 80", async () => {
    h = await harness();
    await h.call("POST", "/api/dev/grant", { essences: PLENTY, focus: 20 });
    // Deterministic search of the corpus for a Form that scores ≥ 80 and passes the Mirror (tolerance 6).
    let pick: { id: string; realm: string } | null = null;
    for (const realm of REALMS)
      for (const c of h.ctx.reality.all()) {
        const s = technicalScore(c.qualities, realm.objective);
        const dev = Math.max(...mirrorObjectives(realm.objective).map((o) => Math.abs(technicalScore(c.qualities, o) - s)));
        if (!pick && s >= 80 && dev <= 6) pick = { id: c.id, realm: realm.id };
      }
    expect(pick).not.toBeNull();
    const f = await grantForm(pick!.id, pick!.realm);
    expect(f.keystoneEligible).toBe(false);
    expect((await h.raw("POST", `/api/artifacts/${f.id}/inscribe`, { role: "keystone" })).status).toBe(400);
    await h.call("POST", `/api/artifacts/${f.id}/trial`);
    expect((await h.raw("POST", `/api/artifacts/${f.id}/inscribe`, { role: "keystone" })).status).toBe(400);
    const m = await h.call("POST", `/api/artifacts/${f.id}/mirror`);
    expect(m.artifact.tier).toBe("witnessed");
    expect(m.artifact.keystoneEligible).toBe(true);
    const k = await h.call("POST", `/api/artifacts/${f.id}/inscribe`, { role: "keystone" });
    expect(k.artifact.inscribedRole).toBe("keystone");
    expect(k.artifact.nodePotency).toBeGreaterThan(1.2);

    // A Witnessed Form under 80 is still refused.
    const low = h.ctx.reality.all().find((c) => {
      const o = REALMS[0]!.objective;
      const s = technicalScore(c.qualities, o);
      return s < 70 && Math.max(...mirrorObjectives(o).map((x) => Math.abs(technicalScore(c.qualities, x) - s))) <= 6;
    })!;
    const g = await grantForm(low.id, REALMS[0]!.id);
    await h.call("POST", `/api/artifacts/${g.id}/trial`);
    expect((await h.call("POST", `/api/artifacts/${g.id}/mirror`)).artifact.tier).toBe("witnessed");
    expect((await h.raw("POST", `/api/artifacts/${g.id}/inscribe`, { role: "keystone" })).status).toBe(400);
  });
});

describe("Loom layout (PUT /api/loom/:root)", () => {
  it("validates cells and Forms, and moves a Form between heroes", async () => {
    h = await harness();
    await h.call("POST", "/api/dev/grant", { essences: PLENTY });
    const [a, b, c] = await Promise.all(h.ctx.reality.all().slice(0, 3).map((x) => grantForm(x.id)));
    await h.call("POST", `/api/artifacts/${a.id}/inscribe`, { role: "action" });
    await h.call("POST", `/api/artifacts/${b.id}/inscribe`, { role: "modifier" });
    const put = (root: string, nodes: unknown[]) => h.raw("PUT", `/api/loom/${root}`, { nodes });

    expect((await put("iron", [{ artifactId: c.id, q: 1, r: 0 }])).body.error).toMatch(/Inscribe/);
    expect((await put("iron", [{ artifactId: a.id, q: 0, r: 0 }])).status).toBe(400);
    expect((await put("iron", [{ artifactId: a.id, q: 3, r: 0 }])).status).toBe(400);
    expect((await put("iron", [{ artifactId: a.id, q: 1, r: 0 }, { artifactId: b.id, q: 1, r: 0 }])).status).toBe(400);
    expect((await put("iron", [{ artifactId: a.id, q: 1, r: 0 }, { artifactId: a.id, q: 0, r: 1 }])).status).toBe(400);
    expect((await put("nobody", [])).status).toBe(400);
    expect((await put("iron", [{ artifactId: "missing", q: 1, r: 0 }])).status).toBe(404);

    const ok = await h.call("PUT", "/api/loom/iron", { nodes: [{ artifactId: a.id, q: 1, r: 0 }, { artifactId: b.id, q: 2, r: -1 }] });
    expect(ok.rank).toBe(1);
    expect(ok.capacity).toBe(6);
    expect(ok.radius).toBe(1);
    expect(ok.heroes.iron.nodes).toHaveLength(2);
    const node = ok.heroes.iron.nodes.find((n: any) => n.id === a.id);
    expect(node).toEqual({ id: a.id, formId: a.id, name: a.name, role: "action", q: 1, r: 0, affinities: a.affinities, technicalScore: a.evaluation.technicalScore, evidence: "attuned" });
    expect(ok.heroes.iron.compiled.dormancy[b.id]).toBe("locked cell"); // radius 2 opens at Rank 8
    // (The starter kit's nodes that this layout replaced wait in the pool.)
    expect(ok.pool.filter((n: any) => [a.id, b.id].includes(n.id))).toEqual([]);

    const moved = await h.call("PUT", "/api/loom/bond", { nodes: [{ artifactId: a.id, q: -1, r: 0 }] });
    expect(moved.heroes.bond.nodes.map((n: any) => n.id)).toEqual([a.id]);
    expect(moved.heroes.iron.nodes.map((n: any) => n.id)).toEqual([b.id]);
    const cleared = await h.call("PUT", "/api/loom/iron", { nodes: [] });
    const bInPool = cleared.pool.find((n: any) => n.id === b.id);
    expect(bInPool).toBeDefined();
    expect(bInPool).not.toHaveProperty("q");
    expect((await h.call("GET", `/api/artifacts/${a.id}`)).artifact.loom).toEqual({ root: "bond", q: -1, r: 0 });
  });
});

describe("§98 Temper a Reach/Flex Action into Reach/Bond", () => {
  it("changes the Rider, a graph link, the production cost and the compiled Action while keeping the Loom slot", async () => {
    h = await harness();
    await h.call("POST", "/api/dev/grant", { essences: PLENTY, focus: 40 });
    // Deterministic search of the Temper's candidate space: the first Form with the Reach/Flex Affinity pair whose
    // Temper offers a Reach/Bond Form. (The committed corpus has no Reach-dominant/Flex-secondary Form; its one
    // Reach+Flex Form is Flex-dominant, PubChem CID 8169.)
    let start: any = null;
    let option: any = null;
    for (const realm of REALMS) {
      for (const c of h.ctx.reality.all().filter((x) => has(affs(x.id), "reach", "flex"))) {
        const f = await grantForm(c.id, realm.id);
        const t = await h.call("POST", `/api/artifacts/${f.id}/temper`, {});
        option = t.options.find((o: any) => affs(o.realityId)[0] === "reach" && affs(o.realityId)[1] === "bond");
        if (option) {
          start = f;
          break;
        }
      }
      if (start) break;
    }
    expect(start, "no Reach/Flex Form whose Temper offers Reach/Bond").not.toBeNull();
    expect(has(start.affinities, "reach", "flex")).toBe(true);

    // A Bond/Knots Modifier on the neighbouring cell: no shared Affinity with Reach/Flex, so no thread joins them.
    const bondKnots = h.ctx.reality.all().find((x) => affs(x.id)[0] === "bond" && affs(x.id)[1] === "knots")!;
    const mod = await grantForm(bondKnots.id, start.realmId);
    await h.call("POST", `/api/artifacts/${start.id}/inscribe`, { role: "action" });
    await h.call("POST", `/api/artifacts/${mod.id}/inscribe`, { role: "modifier" });
    const cells = [{ artifactId: start.id, q: 1, r: 0 }, { artifactId: mod.id, q: 1, r: -1 }];
    const before = await h.call("PUT", "/api/loom/quick", { nodes: cells });
    const cBefore = before.heroes.quick.compiled;
    const joined = (links: any[]) => links.find((l) => [l.a, l.b].includes(mod.id) && l.affinity !== "root");
    expect(joined(cBefore.links)).toBeUndefined();
    const actBefore = cBefore.actions[0];

    const ch = await h.call("POST", `/api/artifacts/${start.id}/temper`, { choice: option.candidateId });
    const child = ch.artifact;
    expect(child.affinities).toEqual(["reach", "bond"]);
    // Same underlying Loom slot stays occupied, by the child, with the same inscribed role.
    expect(child.inscribedRole).toBe("action");
    expect(child.loom).toEqual({ root: "quick", q: 1, r: 0 });
    const after = await h.call("GET", "/api/loom");
    expect(after.heroes.quick.nodes.map((n: any) => [n.id, n.q, n.r])).toEqual([[mod.id, 1, -1], [child.id, 1, 0]]);
    expect(after.pool.filter((n: any) => [mod.id, child.id].includes(n.id))).toEqual([]);
    const cAfter = after.heroes.quick.compiled;

    // Secondary Rider changes.
    const actAfter = cAfter.actions.find((x: any) => x.nodeId === child.id);
    expect(actBefore.rider).not.toBe(actAfter.rider);
    expect(actAfter.rider).toBe("bond");
    // A graph connection changes: a Bond thread now joins the Action and the Modifier.
    expect(joined(cAfter.links)).toMatchObject({ affinity: "bond" });
    expect([joined(cAfter.links).a, joined(cAfter.links).b].sort()).toEqual([child.id, mod.id].sort());
    // Production cost changes (the Flex-driven Storm leaves the recipe).
    const pq = productionRecipe(h.ctx.reality.candidateSync(option.realityId).qualities);
    const parentRecipe = start.inscribeCost;
    expect(parentRecipe.storm ?? 0).toBeGreaterThan(0);
    expect(pq.essenceCosts.storm ?? 0).toBe(0);
    expect(pq.essenceCosts).not.toEqual(parentRecipe);
    const prices = h.ctx.world.snapshots[0]!.essenceBasePrice;
    expect(productionCost(pq, prices)).not.toBe(productionCost({ essenceCosts: parentRecipe }, prices));
    // Combat behaviour changes: the compiled Action and its summary differ.
    expect(actAfter.summary).not.toEqual(actBefore.summary);
    expect(actAfter.summary.join("\n")).toMatch(/Rider \(Bond\)/);
    expect(actAfter.template).toBe("lance");
    // The compile matches what the battle engine produces from the same nodes.
    expect(compileLoom(after.heroes.quick.nodes, after.rank)).toEqual(cAfter);
  });
});

describe("Mirror charges (§55)", () => {
  it("a held Mirror charge pays for the Mirror instead of Focus", async () => {
    h = await harness();
    await h.call("POST", "/api/dev/grant", { mirrorCharges: 1 });
    const f = await grantForm(h.ctx.reality.all()[5]!.id);
    await h.call("POST", `/api/artifacts/${f.id}/trial`);
    const focus = (await h.character()).focus;
    const m = await h.call("POST", `/api/artifacts/${f.id}/mirror`);
    expect(m.mirrorChargeSpent).toBe(true);
    expect(m.focusSpent).toBe(0);
    const c = await h.character();
    expect(c.focus).toBe(focus);
    expect(c.mirrorCharges).toBe(0);
    const m2 = await h.call("POST", `/api/artifacts/${f.id}/mirror`);
    expect(m2.mirrorChargeSpent).toBe(false);
    expect(m2.focusSpent).toBe(2);
  });
});
