// §76–78: the branching expedition map and its loot cadence, through the real services and HTTP API.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { REALMS } from "@ender/content";
import { FOES } from "../../packages/battle/src";
import { generateRunPlan, normalLootClass, rollNodeLoot, type MapNode, type RunPlan } from "../../apps/server/src/services/runs";
import { harness } from "./harness";

let h: Awaited<ReturnType<typeof harness>>;
beforeAll(async () => {
  h = await harness();
});
afterAll(async () => h?.close());

const SEEDS = Array.from({ length: 60 }, (_, i) => `seed-${i}`);
const plan = (realmId: string, seed: string, snapshotId = h.ctx.world.snapshots[10]!.id) => generateRunPlan(h.ctx, { runId: `r-${seed}`, snapshotId, realmId, seed });
const LAYER_KINDS: MapNode["kind"][][] = [
  ["combat"],
  ["mystery", "shrine", "combat"],
  ["combat", "mystery"],
  ["attunement", "shrine", "mystery"],
  ["elite", "combat"],
  ["contract", "shrine", "mystery"],
  ["boss"],
];

describe("expedition map (§76–77)", () => {
  it("is deterministic from (snapshot, realm, seed) and varies with each", () => {
    expect(plan("glass-fen", "a")).toEqual(plan("glass-fen", "a"));
    expect(JSON.stringify(plan("glass-fen", "a").map)).not.toBe(JSON.stringify(plan("glass-fen", "b").map));
    expect(JSON.stringify(plan("glass-fen", "a").map)).not.toBe(JSON.stringify(plan("ashen-vault", "a").map));
  });

  it("follows the §76 structure: encounter → choice → encounter → craft → elite → market → boss", () => {
    for (const realm of REALMS)
      for (const seed of SEEDS) {
        const p = plan(realm.id, seed);
        expect(p.map.layers.length).toBe(7);
        p.map.layers.forEach((layer, l) => {
          if (l === 6) expect(layer.length).toBe(1);
          else expect(layer.length).toBeGreaterThanOrEqual(2);
          expect(layer.length).toBeLessThanOrEqual(3);
          for (const n of layer) expect(LAYER_KINDS[l]).toContain(n.kind);
        });
        expect(p.map.layers[3]!.map((n) => n.kind)).toEqual(expect.arrayContaining(["attunement", "shrine"]));
        expect(p.map.layers[4]!.map((n) => n.kind)).toEqual(expect.arrayContaining(["elite", "combat"]));
        // The Bazaar is open from the map between fights, so the route's market layer holds a Contract and a Shrine.
        expect(p.map.layers[5]!.map((n) => n.kind)).toEqual(expect.arrayContaining(["contract", "shrine"]));
        expect(p.boss).toBe(realm.boss);
        expect(p.map.layers[6]![0]!.encounter!.waves).toEqual([[realm.boss]]);
      }
    expect(REALMS.map((r) => r.boss)).toEqual(["king", "wyrm", "king"]);
  });

  it("links never cross and every node is reachable and leads on", () => {
    for (const realm of REALMS)
      for (const seed of SEEDS) {
        const layers = plan(realm.id, seed).map.layers;
        for (let l = 0; l < layers.length - 1; l++) {
          const from = layers[l]!;
          const to = layers[l + 1]!;
          const idx = (id: string) => to.findIndex((x) => x.id === id);
          const edges = from.flatMap((n, i) => n.links.map((id) => [i, idx(id)] as const));
          expect(edges.every(([, j]) => j >= 0)).toBe(true);
          for (const [i, j] of edges) for (const [i2, j2] of edges) if (i < i2) expect(j2).toBeGreaterThanOrEqual(j);
          for (const n of from) {
            expect(n.links.length).toBeGreaterThan(0);
            expect(n.links.map(idx)).toEqual([...n.links.map(idx)].sort((a, b) => a - b));
          }
          for (let j = 0; j < to.length; j++) expect(edges.some(([, x]) => x === j)).toBe(true);
        }
        expect(layers[6]![0]!.links).toEqual([]);
      }
  });

  it("encounters are one foe each: a normal, an elite alone, or the Realm boss", () => {
    const normals = ["husk", "wisp", "hound", "keeper", "seer", "swarm"];
    for (const realm of REALMS)
      for (const seed of SEEDS)
        for (const n of plan(realm.id, seed).map.layers.flat()) {
          if (!n.encounter) {
            expect(["shrine", "attunement", "bazaar", "contract", "mystery"]).toContain(n.kind);
            continue;
          }
          expect(n.encounter.difficulty).toBe(realm.difficulty);
          for (const w of n.encounter.waves) for (const f of w) expect(FOES[f]).toBeDefined();
          // Every fight is one on one (Mark, 2026-10-01).
          expect(n.encounter.waves.flat().length).toBe(1);
          if (n.kind === "combat" || n.kind === "mystery") expect(normals).toContain(n.encounter.waves[0]![0]);
          if (n.kind === "elite") expect(["ironbound", "cinder", "matron"]).toContain(n.encounter.waves[0]![0]);
        }
  });
});

describe("loot cadence (§78)", () => {
  let plans: RunPlan[] = [];
  beforeAll(() => {
    plans = REALMS.flatMap((r) => Array.from({ length: 400 }, (_, i) => plan(r.id, `loot-${i}`)));
  });

  it("normal fights: ~70% Essence, ~25% a Veiled Form, ~5% both", () => {
    expect([0, 0.69, 0.7, 0.94, 0.95, 0.99].map(normalLootClass)).toEqual(["essence", "essence", "form", "form", "both", "both"]);
    const counts = { essence: 0, form: 0, both: 0 };
    for (const p of plans)
      for (const n of p.map.layers.flat().filter((x) => x.encounter && (x.kind === "combat" || x.kind === "mystery"))) {
        const l = rollNodeLoot(h.ctx, p, n);
        const e = Object.values(l.essences).reduce((a, b) => a + b!, 0) > 0;
        const f = l.forms.length > 0;
        expect(e || f).toBe(true);
        expect(l.forms.length).toBeLessThanOrEqual(1);
        expect(l.mirrorCharges).toBe(0);
        counts[e && f ? "both" : f ? "form" : "essence"]++;
      }
    const total = counts.essence + counts.form + counts.both;
    expect(total).toBeGreaterThan(2000);
    expect(counts.essence / total).toBeCloseTo(0.7, 1);
    expect(counts.form / total).toBeCloseTo(0.25, 1);
    expect(counts.both / total).toBeGreaterThan(0.03);
    expect(counts.both / total).toBeLessThan(0.07);
  });

  it("elites always drop a Veiled Form and Essences; bosses two Forms, a high-tier bundle and a Mirror charge", () => {
    for (const p of plans.slice(0, 300)) {
      for (const n of p.map.layers[4]!.filter((x) => x.kind === "elite")) {
        const l = rollNodeLoot(h.ctx, p, n);
        expect(l.forms.length).toBe(1);
        expect(Object.values(l.essences).reduce((a, b) => a + b!, 0)).toBeGreaterThanOrEqual(5);
        expect(l.mirrorCharges).toBe(0);
      }
      const b = rollNodeLoot(h.ctx, p, p.map.layers[6]![0]!);
      expect(b.forms.length).toBe(2);
      expect(b.mirrorCharges).toBe(1);
      expect(Object.values(b.essences).reduce((a, x) => a + x!, 0)).toBeGreaterThanOrEqual(12);
    }
  });

  it("loot is deterministic per node and never includes equipment", () => {
    const p = plans[0]!;
    const n = p.map.layers[0]![0]!;
    expect(rollNodeLoot(h.ctx, p, n)).toEqual(rollNodeLoot(h.ctx, p, n));
    expect(Object.keys(rollNodeLoot(h.ctx, p, p.map.layers[6]![0]!)).sort()).toEqual(["crowns", "essences", "forms", "mirrorCharges", "xp"]);
  });
});

describe("expedition API", () => {
  it("walks the map by links, grants loot and Loom Rank XP, and ends at the boss with a Mirror charge", async () => {
    const x = await harness();
    try {
      const start = await x.call("POST", "/api/runs", { realmId: "glass-fen" });
      const p = start.plan as RunPlan;
      expect(p.boss).toBe("wyrm");
      expect(start.loom.heroes).toHaveProperty("iron");
      const [l0, l1] = [p.map.layers[0]!, p.map.layers[1]!];
      // Must start in layer 0; cannot skip a fight; cannot jump to an unlinked node.
      expect((await x.raw("POST", `/api/runs/${p.runId}/node`, { nodeId: l1[0]!.id, outcome: "victory" })).status).toBe(400);
      expect((await x.raw("POST", `/api/runs/${p.runId}/node`, { nodeId: l0[0]!.id, outcome: "skip" })).status).toBe(400);
      const first = await x.call("POST", `/api/runs/${p.runId}/node`, { nodeId: l0[0]!.id, outcome: "victory", kills: { husk: 2 } });
      expect(first.rewards.xp).toBe(25);
      expect(first.character.xp).toBe(25);
      const unlinked = l1.find((n) => !l0[0]!.links.includes(n.id));
      if (unlinked) expect((await x.raw("POST", `/api/runs/${p.runId}/node`, { nodeId: unlinked.id, outcome: "skip" })).status).toBe(400);
      expect((await x.raw("POST", `/api/runs/${p.runId}/node`, { nodeId: l0[0]!.id, outcome: "victory" })).status).toBe(400);
      await x.call("POST", `/api/runs/${p.runId}/complete`, { outcome: "abandon", advanceWorld: false });

      const { runId, rewards } = await x.runExpedition("glass-fen");
      const boss = rewards.at(-1)!;
      expect(boss.node.kind).toBe("boss");
      expect(boss.mirrorCharges).toBe(1);
      expect(boss.forms.length).toBe(2);
      expect((await x.character()).mirrorCharges).toBe(1);
      const view = await x.call("GET", `/api/runs/${runId}`);
      expect(view.visited.length).toBe(7);
      const done = await x.finishRun(runId);
      expect(done.status).toBe("victory");
      expect(done.worldTurned).not.toBeNull();
    } finally {
      await x.close();
    }
  });

  it("a lost fight grants nothing; the Loom snapshot can be retaken after any node (weaving follows fights)", async () => {
    const x = await harness();
    try {
      const start = await x.call("POST", "/api/runs", { realmId: "ashen-vault" });
      const p = start.plan as RunPlan;
      await x.call("POST", `/api/runs/${p.runId}/checkpoint`, {}); // from the hub: allowed
      const lost = await x.call("POST", `/api/runs/${p.runId}/node`, { nodeId: p.map.layers[0]![0]!.id, outcome: "defeat" });
      expect(lost.rewards).toMatchObject({ crowns: 0, forms: [], mirrorCharges: 0, xp: 0 });
      expect((await x.raw("POST", `/api/runs/${p.runId}/checkpoint`, {})).status).toBe(200);
    } finally {
      await x.close();
    }
  });
});
