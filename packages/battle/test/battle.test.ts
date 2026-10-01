import { describe, expect, it } from "vitest";
import {
  AttackTracker,
  Battle,
  DefenseTracker,
  FOES,
  ROOTS,
  affinitiesOf,
  capacityForRank,
  compileLoom,
  diffLooms,
  nodePotency,
  simulate,
  type Affinity,
  type CompiledLoom,
  type Defense,
  type Evidence,
  type FoeKind,
  type LoomNode,
  type Role,
} from "../src";

let nid = 0;
const node = (role: Role, q: number, r: number, aff: [Affinity, Affinity], score = 60, evidence: Evidence = "trialed"): LoomNode => ({
  id: `n${++nid}`,
  formId: `f${nid}`,
  name: `Form ${nid}`,
  role,
  q,
  r,
  affinities: aff,
  technicalScore: score,
  evidence,
});
const EMPTY = (rank = 1) => compileLoom([], rank);
const party = (looms: Partial<Record<"iron" | "quick" | "bond", CompiledLoom>> = {}, hp?: Partial<Record<string, number>>) =>
  (["iron", "bond", "quick"] as const).map((root) => ({ root, loom: looms[root] ?? EMPTY(), hp: hp?.[root] }));

describe("timing (§64, §67–69)", () => {
  it("grades attack presses: Perfect ±70, Good ±150, else Miss", () => {
    const t = new AttackTracker([600, 900, 1200]);
    expect(t.press(600 + 69)).toEqual({ index: 0, grade: "perfect" });
    expect(t.press(900 - 149)).toEqual({ index: 1, grade: "good" });
    expect(t.press(1200 + 160)).toBeNull(); // beat already passed: it expires as a miss
    expect(t.expire(1400)).toEqual([2]);
    expect(t.result()).toEqual(["perfect", "good", "miss"]);
  });
  it("Dodge −260..+100, Parry −90..+70, Perfect Parry −45..+35", () => {
    const d = new DefenseTracker([1000, 2000, 3000, 4000]);
    expect(d.press(1000 - 250, "dodge")).toEqual({ index: 0, result: "dodge" });
    expect(d.press(2000 + 60, "parry")).toEqual({ index: 1, result: "parry" });
    expect(d.press(3000 - 40, "parry")).toEqual({ index: 2, result: "perfect-parry" });
    expect(d.press(4000 - 150, "parry")).toEqual({ index: 3, result: "hit" });
  });
  it("a mistimed input is consumed: no second try on that impact", () => {
    const d = new DefenseTracker([1000, 1600]);
    expect(d.press(700, "parry")).toEqual({ index: 0, result: "hit" });
    // The next press goes to the next impact, not back to the first.
    expect(d.press(1300, "parry")).toEqual({ index: 1, result: "hit" });
    expect(d.result()).toEqual(["hit", "hit"]);
  });
  it("a tap long before any window is ignored rather than spending the defence", () => {
    const d = new DefenseTracker([1000]);
    expect(d.press(500, "dodge")).toBeNull();
    expect(d.press(1000, "parry")).toEqual({ index: 0, result: "perfect-parry" });
  });
});

describe("the Loom (§6–13, §84)", () => {
  it("affinities are the two strongest qualities", () => {
    expect(affinitiesOf({ burden: 31, veil: 67, reach: 83, knots: 42, flex: 71, bond: 25 })).toEqual(["reach", "flex"]);
  });
  it("capacity and board size follow Loom Rank", () => {
    expect([1, 2, 3, 8, 12, 19, 20, 30].map(capacityForRank)).toEqual([6, 6, 7, 9, 11, 15, 16, 16]);
    const outer = node("modifier", 2, 0, ["burden", "veil"]);
    const inner = node("modifier", 1, 0, ["burden", "veil"]);
    expect(compileLoom([inner, outer], 1).dormancy[outer.id]).toBe("locked cell");
    expect(compileLoom([inner, outer], 8).activeNodeIds).toContain(outer.id);
  });
  it("the Root anchors the first ring; beyond it links need a shared Affinity", () => {
    const a = node("action", 1, 0, ["burden", "knots"]);
    const m1 = node("modifier", 2, 0, ["knots", "flex"]); // shares Knots with a
    const m2 = node("modifier", 2, -1, ["veil", "reach"]); // adjacent to a, shares nothing
    const l = compileLoom([a, m1, m2], 8);
    expect(l.activeNodeIds.sort()).toEqual([a.id, m1.id].sort());
    expect(l.dormancy[m2.id]).toBe("disconnected");
    expect(l.links).toContainEqual({ a: a.id, b: m1.id, affinity: "knots" });
    expect(l.links).toContainEqual({ a: "root", b: a.id, affinity: "root" });
  });
  it("over capacity: the farthest node goes dormant first", () => {
    const a = node("action", 1, 0, ["burden", "knots"]); // 3
    const b = node("action", 0, 1, ["reach", "flex"]); // 3 → 6 = capacity at rank 1
    const c = node("modifier", -1, 1, ["bond", "veil"]); // 1 → over
    const l = compileLoom([a, b, c], 1);
    // All three are 1 step away; priority keeps lower q then lower r, so the dropped node has the highest q: a (1,0).
    expect(l.usedCapacity).toBe(4);
    expect(l.dormancy[a.id]).toBe("over capacity");
    expect(l.activeNodeIds.sort()).toEqual([b.id, c.id].sort());
  });
  it("role limits: at most 4 Actions, 2 Reactions, 1 Keystone; closest wins", () => {
    const ring1 = [
      [1, 0],
      [1, -1],
      [0, -1],
      [-1, 0],
      [-1, 1],
      [0, 1],
    ] as const;
    const reactions = ring1.slice(0, 3).map(([q, r]) => node("reaction", q, r, ["burden", "bond"]));
    const l = compileLoom(reactions, 20);
    expect(l.reactions).toHaveLength(2);
    expect(Object.values(l.dormancy)).toContain("role limit");
    const actions = ring1.map(([q, r]) => node("action", q, r, ["flex", "bond"]));
    expect(compileLoom(actions, 20).actions).toHaveLength(4);
  });
  it("a Keystone needs Witnessed evidence and a score of at least 80", () => {
    const weak = node("keystone", 1, 0, ["knots", "flex"], 79, "witnessed");
    const unproven = node("keystone", 0, 1, ["knots", "flex"], 90, "trialed");
    const real = node("keystone", -1, 0, ["knots", "flex"], 85, "witnessed");
    const l = compileLoom([weak, unproven, real], 20);
    expect(l.keystone?.nodeId).toBe(real.id);
    expect(l.keystone?.name).toBe("Living Pattern");
    expect(l.dormancy[weak.id]).toBe("keystone not eligible");
  });
  it("the board is executable: moving a Modifier next to an Action changes that Action", () => {
    const a = node("action", 1, 0, ["burden", "knots"]);
    const far = node("modifier", -1, 0, ["burden", "flex"]);
    const near = { ...far, q: 1, r: -1 };
    const before = compileLoom([a, far], 8);
    const after = compileLoom([a, near], 8);
    expect(before.actions[0]!.name).toBe("Crush");
    expect(after.actions[0]!.breakTotal).toBeGreaterThan(before.actions[0]!.breakTotal);
    expect(diffLooms(before, after).some((s) => s.startsWith("Crush: Break"))).toBe(true);
    // Replacing the Action's Form with a Reach one swaps Crush for Lance (§87).
    const lance = compileLoom([{ ...a, affinities: ["reach", "knots"] }, near], 8);
    expect(lance.actions[0]!.name).toBe("Lance");
  });
  it("only the strongest Reaction per trigger executes", () => {
    const weak = node("reaction", 1, 0, ["burden", "veil"], 50);
    const strong = node("reaction", 0, 1, ["veil", "burden"], 90, "witnessed");
    const l = compileLoom([weak, strong], 8);
    expect(l.reactions.find((r) => r.nodeId === strong.id)!.executes).toBe(true);
    expect(l.reactions.find((r) => r.nodeId === weak.id)!.executes).toBe(false);
  });
  it("compilation is deterministic regardless of input order", () => {
    const ns = [node("action", 1, 0, ["flex", "bond"]), node("modifier", 2, -1, ["bond", "veil"]), node("reaction", 0, 1, ["bond", "reach"]), node("modifier", 1, 1, ["flex", "knots"])];
    expect(compileLoom([...ns].reverse(), 12)).toEqual(compileLoom(ns, 12));
  });
});

describe("§99 reality progression: outcome quality produces power", () => {
  it("a Witnessed 82 out-powers an Attuned 61 of the same template at the same rank", () => {
    expect(nodePotency(50, "attuned")).toBe(1);
    expect(nodePotency(75, "trialed")).toBe(1.15);
    expect(nodePotency(100, "witnessed")).toBe(1.3);
    const a = compileLoom([node("action", 1, 0, ["burden", "veil"], 61, "attuned")], 5).actions[0]!;
    const b = compileLoom([node("action", 1, 0, ["burden", "veil"], 82, "witnessed")], 5).actions[0]!;
    expect(b.template).toBe(a.template);
    expect(b.nodePotency).toBeGreaterThan(a.nodePotency);
    expect(b.damagePct).toBeGreaterThan(a.damagePct);
    expect(b.breakTotal).toBeGreaterThan(a.breakTotal);
  });
});

describe("combat rules (§61–72)", () => {
  it("turn order sorts by speed each round; ties go to the party, then by id", () => {
    const b = new Battle({ seed: "o", party: party(), waves: [["hound", "keeper"]], difficulty: 1 });
    const first = b.nextTurn();
    const order = b.order.map((id) => b.unit(id));
    for (let i = 1; i < order.length; i++) expect(b.effectiveSpeed(order[i - 1]!)).toBeGreaterThanOrEqual(b.effectiveSpeed(order[i]!));
    expect(order[0]!.id).toBe("hound-1"); // 120 beats Quick's 110
    expect(first.actor.id).toBe("hound-1");
  });
  it("foeScale softens practice foes without touching the party", () => {
    const full = new Battle({ seed: "fs", party: party(), waves: [["husk"]], difficulty: 1 });
    const soft = new Battle({ seed: "fs", party: party(), waves: [["husk"]], difficulty: 1, foeScale: { hp: 0.5, atk: 0.4 } });
    expect(soft.unit("husk-1").maxHp).toBe(Math.round(full.unit("husk-1").maxHp * 0.5));
    expect(soft.unit("husk-1").power).toBeCloseTo(full.unit("husk-1").power * 0.4);
    expect(soft.party().map((u) => u.maxHp)).toEqual(full.party().map((u) => u.maxHp));
  });
  it("rage moves come only once a foe has enraged", () => {
    const b = new Battle({ seed: "rg", party: party(), waves: [["husk"]], difficulty: 1 });
    const calm = Array.from({ length: 40 }, () => b.planFoe("husk-1").attack);
    expect(calm.some((a) => a.rage)).toBe(false);
    b.unit("husk-1").enraged = true;
    const angry = Array.from({ length: 40 }, () => b.planFoe("husk-1").attack);
    expect(angry.some((a) => a.rage)).toBe(true);
    for (const def of Object.values(FOES)) if (def.tier !== "boss") expect(def.attacks.some((a) => a.rage)).toBe(true);
  });
  it("a calm battle (the prologue) never enrages its foes", () => {
    for (const calm of [false, true]) {
      const b = new Battle({ seed: "cm", party: party(), waves: [["keeper"]], difficulty: 1, calm });
      const k = b.unit("keeper-1");
      k.hp = Math.floor(k.maxHp * 0.3);
      b.settle();
      expect(!!k.enraged).toBe(!calm);
    }
  });
  it("AP: start 3, +1 at the start of your turn, Basic +2, max 9", () => {
    const b = new Battle({ seed: "ap", party: party(), waves: [["keeper"]], difficulty: 1 });
    let t = b.nextTurn();
    while (t.actor.side !== "party") {
      b.resolveFoe(b.planFoe(t.actor.id), []);
      t = b.nextTurn();
    }
    expect(t.actor.ap).toBe(4);
    b.resolveHero({ actor: t.actor.id, command: "basic", target: "keeper-1", grades: ["good"] });
    expect(t.actor.ap).toBe(6);
  });
  it("Perfect timing hits harder than Good, which beats Miss", () => {
    const dmg = (g: "perfect" | "good" | "miss") => {
      const b = new Battle({ seed: "same", party: party(), waves: [["keeper"]], difficulty: 1 });
      b.rng.chance = () => false; // no crits
      b.resolveHero({ actor: "iron", command: "basic", target: "keeper-1", grades: [g] });
      return b.unit("keeper-1").maxHp - b.unit("keeper-1").hp;
    };
    expect(dmg("perfect")).toBe(50);
    expect(dmg("good")).toBe(40);
    expect(dmg("miss")).toBe(32);
  });
  it("Parry: no damage, +1 AP, +10 Break to the attacker (Iron +20%); full Parry counters at 65% Basic", () => {
    const b = new Battle({ seed: "p", party: party(), waves: [["husk"]], difficulty: 1 });
    const husk = b.unit("husk-1");
    const plan = { actor: husk.id, attack: FOES.husk.attacks[0]!, targets: ["iron"] };
    const iron = b.unit("iron");
    const ev = b.resolveFoe(plan, ["parry", "perfect-parry"]);
    expect(iron.hp).toBe(iron.maxHp);
    expect(iron.ap).toBe(5);
    expect(ev.some((e) => e.type === "counter")).toBe(true);
    expect(husk.breakVal).toBeCloseTo(24, 5);
    expect(husk.hp).toBeLessThan(husk.maxHp);
  });
  it("Dodge takes no damage and earns nothing; getting hit hurts", () => {
    const b = new Battle({ seed: "d", party: party(), waves: [["husk"]], difficulty: 1 });
    const plan = { actor: "husk-1", attack: FOES.husk.attacks[0]!, targets: ["quick"] };
    b.resolveFoe(plan, ["dodge", "perfect-dodge"]);
    expect(b.unit("quick").hp).toBe(ROOTS.quick.hp);
    expect(b.unit("quick").ap).toBe(3);
    b.resolveFoe(plan, ["hit", "hit"]);
    expect(b.unit("quick").hp).toBeLessThan(ROOTS.quick.hp);
  });
  it("Bond Root: a successful Parry gives 1 AP to the party member with the least AP", () => {
    const b = new Battle({ seed: "bond", party: party(), waves: [["husk"]], difficulty: 1 });
    b.unit("quick").ap = 0;
    b.resolveFoe({ actor: "husk-1", attack: FOES.husk.attacks[1]!, targets: ["bond"] }, ["parry"]);
    expect(b.unit("quick").ap).toBe(1);
  });
  it("Break at 100: the foe loses its next turn, takes +25%, then recovers with an empty gauge", () => {
    const b = new Battle({ seed: "br", party: party(), waves: [["husk", "wisp"]], difficulty: 1 });
    const husk = b.unit("husk-1");
    husk.breakVal = 95;
    b.resolveHero({ actor: "iron", command: "basic", target: husk.id, grades: ["good"] });
    expect(husk.broken).not.toBeNull();
    let skipped = false;
    for (let i = 0; i < 12 && !skipped; i++) {
      const t = b.nextTurn();
      if (t.actor.id === husk.id) skipped = t.skipped;
    }
    expect(skipped).toBe(true);
    // Still Broken for the rest of that round, recovered at the next.
    expect(husk.broken).not.toBeNull();
    const r = b.round;
    while (b.round === r) b.nextTurn();
    expect(husk.broken).toBeNull();
    expect(husk.breakVal).toBe(0);
  });
  it("a boss is Broken for one of its turns only", () => {
    const b = new Battle({ seed: "bb", party: party(), waves: [["king"]], difficulty: 1 });
    const k = b.unit("king-1");
    k.breakVal = 99;
    b.resolveHero({ actor: "iron", command: "basic", target: k.id, grades: ["perfect"] });
    expect(k.broken).not.toBeNull();
    let t = b.nextTurn();
    while (t.actor.id !== k.id) t = b.nextTurn();
    expect(t.skipped).toBe(true);
    expect(k.broken).toBeNull();
  });
  it("statuses: Burn and Poison tick at turn start, Slow cuts Speed by 20%", () => {
    const b = new Battle({ seed: "st", party: party(), waves: [["seer"]], difficulty: 1 });
    const q = b.unit("quick");
    const base = b.effectiveSpeed(q);
    b.resolveFoe({ actor: "seer-1", attack: { ...FOES.seer.attacks[0]!, hits: [{ t: 0, power: 0.1, status: "burn" }, { t: 1, power: 0.1, status: "slow" }] }, targets: ["quick"] }, ["hit", "hit"]);
    expect(q.status.burn).not.toBeNull();
    expect(b.effectiveSpeed(q)).toBeCloseTo(base * 0.8, 5);
  });
  it("a volatile elite's death burst plays before victory", () => {
    const b = new Battle({ seed: "vol", party: party(), waves: [["cinder"]], difficulty: 1 });
    b.unit("cinder-1").hp = 1;
    b.resolveHero({ actor: "quick", command: "basic", target: "cinder-1", grades: ["good"] });
    b.settle();
    expect(b.outcome).toBe("ongoing");
    const plan = b.reactions.shift()!;
    b.resolveFoe(plan, ["dodge"]);
    b.settle();
    expect(b.outcome).toBe("victory");
  });
  it("bosses summon at their phase thresholds, and their fall ends the fight", () => {
    const b = new Battle({ seed: "king", party: party(), waves: [["king"]], difficulty: 1 });
    const k = b.unit("king-1");
    k.hp = Math.floor(k.maxHp * 0.6);
    expect(b.settle().some((e) => e.type === "summon")).toBe(true);
    expect(b.living("foe").length).toBe(3);
    k.hp = 1;
    b.resolveHero({ actor: "iron", command: "basic", target: k.id, grades: ["good"] });
    b.settle();
    expect(b.outcome).toBe("victory");
  });
  it("is deterministic for a seed and inputs", () => {
    const run = () => {
      const b = new Battle({ seed: "det", party: party(), waves: [["husk", "hound", "wisp"]], difficulty: 2 });
      simulate(b, { grade: "good", defend: (k) => (k % 2 ? "dodge" : "hit") });
      return JSON.stringify(b.units) + b.outcome;
    };
    expect(run()).toBe(run());
  });
  it("a normal fight is winnable with decent timing and losable without defending", () => {
    const waves: FoeKind[][] = [["husk", "hound", "wisp"]];
    let good = 0;
    let bad = 0;
    for (let i = 0; i < 20; i++) {
      const a = new Battle({ seed: `n${i}`, party: party(), waves, difficulty: 3 });
      simulate(a, { grade: "good", defend: (k) => (k % 3 === 2 ? "hit" : k % 3 ? "dodge" : "parry") });
      if (a.outcome === "victory") good++;
      const c = new Battle({ seed: `n${i}`, party: party(), waves: [["keeper", "seer", "hound", "husk", "swarm"]], difficulty: 3 });
      simulate(c, { grade: "miss", defend: () => "hit" });
      if (c.outcome === "victory") bad++;
    }
    expect(good).toBe(20);
    expect(bad).toBeLessThan(20);
  });
});

describe("§97 required design test: builds differ materially", () => {
  // Same Loom Rank, same pool of Forms, same encounters, same execution. Only the arrangement differs.
  const rank = 9;
  const buildA = (): CompiledLoom =>
    compileLoom(
      [
        node("action", 1, 0, ["burden", "knots"], 70),
        node("modifier", 2, -1, ["knots", "burden"], 70),
        node("modifier", 1, 1, ["burden", "knots"], 70),
        node("reaction", 0, 1, ["burden", "knots"], 70),
      ],
      rank,
    );
  const buildB = (): CompiledLoom =>
    compileLoom(
      [
        node("action", 1, 0, ["flex", "bond"], 70),
        node("modifier", 2, -1, ["bond", "flex"], 70),
        node("modifier", 1, 1, ["flex", "bond"], 70),
        node("reaction", 0, 1, ["bond", "flex"], 70),
      ],
      rank,
    );
  const measure = (loom: () => CompiledLoom) => {
    let brk = 0;
    let ap = 0;
    const encounters: FoeKind[][] = [["husk", "hound"], ["keeper"], ["wisp", "seer", "swarm"], ["ironbound"], ["husk", "husk", "wisp"]];
    for (const [i, w] of encounters.entries())
      for (let s = 0; s < 6; s++) {
        const b = new Battle({ seed: `d97-${i}-${s}`, party: party({ iron: loom(), quick: loom(), bond: loom() }), waves: [w], difficulty: 2 });
        simulate(b, { grade: "perfect", defend: (k) => (k % 2 ? "parry" : "perfect-parry") });
        brk += b.stats.breakDealt;
        ap += b.stats.apTransferred + b.stats.apRefunded;
      }
    return { brk, ap };
  };
  it("Burden/Knots deals ≥25% more Break; Flex/Bond moves ≥20% more AP", () => {
    const a = measure(buildA);
    const b = measure(buildB);
    expect(a.brk).toBeGreaterThanOrEqual(1.25 * b.brk);
    expect(b.ap).toBeGreaterThanOrEqual(1.2 * a.ap);
    expect(buildA().actions[0]!.name).toBe("Crush");
    expect(buildB().actions[0]!.name).toBe("Flurry");
  });
});
