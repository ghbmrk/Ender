import { describe, expect, it } from "vitest";
import {
  AttackTracker,
  Battle,
  DefenseTracker,
  WINDOWS,
  autoGrades,
  autoHeroAction,
  roomEncounter,
  waveToEncounter,
  type BattleEvent,
  type Defense,
  type FoeSpec,
  type PartyStats,
} from "../src";

const STATS: PartyStats = { maxHealth: 120, attackDamage: 14, critChance: 0.05, critMultiplier: 1.75, cooldownRate: 1, areaMultiplier: 1, armor: 0, wardPower: 0, wardMultiplier: 1 };

/** Play a battle to the end with the auto party; `defend` decides each hit's defence. */
function play(b: Battle, opts: { grade?: "perfect" | "good" | "miss"; defend?: (i: number) => Defense; maxTurns?: number } = {}) {
  const log: BattleEvent[] = [];
  let n = 0;
  let hitNo = 0;
  const defend = opts.defend ?? (() => "hit");
  const react = () => {
    while (b.reactions.length && b.outcome === "ongoing") {
      const plan = b.reactions.shift()!;
      log.push(...b.resolveFoe(plan, plan.attack.hits.map(() => defend(hitNo++))), ...b.settle());
    }
  };
  while (b.outcome === "ongoing" && n++ < (opts.maxTurns ?? 400)) {
    const turn = b.nextTurn();
    log.push(...turn.events);
    if (turn.skipped) {
      log.push(...b.settle());
      continue;
    }
    const a = turn.actor;
    if (a.side === "party") {
      const act = autoHeroAction(b, a.id);
      log.push(...b.resolveHero(a.id, act.skillId, act.targetId, autoGrades(act.skillId, opts.grade ?? "good")));
    } else {
      const plan = b.planFoe(a.id);
      log.push(...b.resolveFoe(plan, plan.attack.hits.map(() => defend(hitNo++))));
    }
    log.push(...b.settle());
    react();
  }
  return { log, turns: n };
}

describe("timing", () => {
  it("grades attack presses by distance to the beat", () => {
    const t = new AttackTracker([600, 900]);
    expect(t.press(600 + WINDOWS.attack.perfect - 1)).toEqual({ index: 0, grade: "perfect" });
    expect(t.press(900 + WINDOWS.attack.good - 1)).toEqual({ index: 1, grade: "good" });
    expect(t.done).toBe(true);
  });
  it("ignores presses far too early and expires unpressed beats as misses", () => {
    const t = new AttackTracker([600]);
    expect(t.press(100)).toBeNull();
    expect(t.expire(600 + WINDOWS.attack.good + 1)).toEqual([0]);
    expect(t.result()).toEqual(["miss"]);
  });
  it("parry needs a tighter window than dodge, and a whiff locks the buttons", () => {
    const d = new DefenseTracker([1000, 1500]);
    // a parry 400 ms early claims nothing and locks both buttons
    expect(d.press(1000 - 400, "parry")).toEqual({ whiff: true });
    expect(d.press(1000 - 300, "parry")).toEqual({ locked: true });
    // after the lockout a dodge 150 ms late still works
    expect(d.press(1000 + 150, "dodge")).toEqual({ index: 0, result: "dodge" });
    expect(d.press(1500 + 40, "parry")).toEqual({ index: 1, result: "parry" });
    expect(d.result()).toEqual(["dodge", "parry"]);
  });
  it("gentle assist widens the windows", () => {
    const d = new DefenseTracker([1000], 1.6);
    expect(d.press(1000 - 140, "parry")).toEqual({ index: 0, result: "parry" });
  });
});

describe("encounters", () => {
  it("folds swarms into one unit, puts elites first and caps the field", () => {
    const wave = [
      { kind: "husk" as const },
      { kind: "swarm" as const },
      { kind: "swarm" as const },
      { kind: "swarm" as const },
      { kind: "swarm" as const },
      { kind: "keeper" as const },
      { kind: "wisp" as const },
      { kind: "hound" as const, elite: "volatile" as const },
    ];
    const enc = waveToEncounter(wave);
    expect(enc).toHaveLength(3);
    expect(enc.find((f) => f.elite)).toEqual({ kind: "hound", elite: "volatile" });
    expect(enc.some((f) => f.kind === "keeper")).toBe(true);
    expect(enc.filter((f) => f.kind === "swarm").length).toBeLessThanOrEqual(1);
  });
  it("boss rooms are the King alone", () => {
    expect(roomEncounter({ kind: "boss", waves: [] })).toEqual([[{ kind: "king" }]]);
  });
});

describe("battle", () => {
  const waves: FoeSpec[][] = [[{ kind: "husk" }, { kind: "hound" }, { kind: "wisp" }], [{ kind: "keeper" }, { kind: "seer" }]];

  it("is deterministic for a seed and inputs", () => {
    const a = play(new Battle({ seed: "s1", stats: STATS, difficulty: 1, waves }));
    const b = play(new Battle({ seed: "s1", stats: STATS, difficulty: 1, waves }));
    expect(a.log).toEqual(b.log);
  });

  it("a timeline lists upcoming turns without changing the battle", () => {
    const b = new Battle({ seed: "t", stats: STATS, difficulty: 1, waves });
    const before = JSON.stringify(b.units);
    const tl = b.timeline(10);
    expect(tl).toHaveLength(10);
    expect(JSON.stringify(b.units)).toBe(before);
    expect(b.nextTurn().actor.id).toBe(tl[0]);
  });

  it("a skilled party wins a two-wave room; a party that never defends or times anything loses it more", () => {
    let skilled = 0;
    let clumsy = 0;
    for (let i = 0; i < 30; i++) {
      const s = new Battle({ seed: `w${i}`, stats: STATS, difficulty: 2, waves });
      play(s, { grade: "perfect", defend: (k) => (k % 3 === 0 ? "parry" : k % 3 === 1 ? "dodge" : "hit") });
      if (s.outcome === "victory") skilled++;
      const c = new Battle({ seed: `w${i}`, stats: STATS, difficulty: 2, waves });
      play(c, { grade: "miss", defend: () => "hit" });
      if (c.outcome === "victory") clumsy++;
    }
    expect(skilled).toBeGreaterThanOrEqual(28);
    expect(clumsy).toBeLessThan(skilled);
  });

  it("waves arrive in order and the battle ends in victory with kills counted", () => {
    const b = new Battle({ seed: "v", stats: STATS, difficulty: 1, waves });
    const { log } = play(b, { grade: "perfect", defend: () => "dodge" });
    expect(b.outcome).toBe("victory");
    expect(log.some((e) => e.type === "wave")).toBe(true);
    expect(Object.values(b.kills).reduce((a, x) => a + x, 0)).toBe(5);
  });

  it("parrying every hit gains AP and counters", () => {
    const b = new Battle({ seed: "p", stats: STATS, difficulty: 1, waves: [[{ kind: "hound" }]] });
    const hound = b.foes()[0]!;
    const plan = b.planFoe(hound.id);
    const target = b.unit(plan.targets[0]!);
    const ap = target.ap;
    const ev = b.resolveFoe(plan, plan.attack.hits.map(() => "parry"));
    expect(ev.some((e) => e.type === "counter")).toBe(true);
    expect(target.ap).toBe(Math.min(9, ap + plan.attack.hits.length));
    expect(hound.hp).toBeLessThan(hound.maxHp);
  });

  it("dodging takes no damage; getting hit does", () => {
    const b = new Battle({ seed: "d", stats: STATS, difficulty: 1, waves: [[{ kind: "husk" }]] });
    const husk = b.foes()[0]!;
    const plan = b.planFoe(husk.id);
    const t = b.unit(plan.targets[0]!);
    b.resolveFoe(plan, plan.attack.hits.map(() => "dodge"));
    expect(t.hp).toBe(t.maxHp);
    b.resolveFoe(plan, plan.attack.hits.map(() => "hit"));
    expect(t.hp).toBeLessThan(t.maxHp);
  });

  it("break staggers a foe: it skips its next turn, then recovers", () => {
    const b = new Battle({ seed: "b", stats: STATS, difficulty: 1, waves: [[{ kind: "keeper" }]] });
    const k = b.foes()[0]!;
    const ev: BattleEvent[] = [];
    b.unit("warden").ap = 9;
    for (let i = 0; i < 5 && !k.broken; i++) ev.push(...b.resolveHero("warden", "bash", k.id, ["perfect"]));
    expect(k.broken).toBe(true);
    expect(ev.some((e) => e.type === "break")).toBe(true);
    let turn = b.nextTurn();
    while (turn.actor.id !== k.id) turn = b.nextTurn();
    expect(turn.skipped).toBe(true);
    expect(k.broken).toBe(false);
  });

  it("AP is spent by skills and refused when short", () => {
    const b = new Battle({ seed: "ap", stats: STATS, difficulty: 1, waves: [[{ kind: "husk" }]] });
    const husk = b.foes()[0]!;
    b.unit("binder").ap = 1;
    expect(() => b.resolveHero("binder", "lash", husk.id, ["good", "good"])).toThrow(/AP/);
    b.resolveHero("binder", "bolt", husk.id, ["perfect"]);
    expect(b.unit("binder").ap).toBe(3);
  });

  it("a volatile elite bursts on death, and the burst must play before victory", () => {
    const b = new Battle({ seed: "vol", stats: STATS, difficulty: 1, waves: [[{ kind: "husk", elite: "volatile" }]] });
    const e = b.foes()[0]!;
    e.hp = 1;
    b.resolveHero("ranger", "arrow", e.id, ["good"]);
    b.settle();
    expect(b.outcome).toBe("ongoing");
    expect(b.reactions).toHaveLength(1);
    const plan = b.reactions.shift()!;
    b.resolveFoe(plan, ["dodge"]);
    expect(b.settle().some((x) => x.type === "outcome")).toBe(true);
    expect(b.outcome).toBe("victory");
  });

  it("the King's Ward breaks faster with stronger Forms, and phases summon help", () => {
    const boss = { hp: 1400, wardTargets: [25, 45, 65] };
    const weak = new Battle({ seed: "k", stats: { ...STATS, wardPower: 5 }, difficulty: 1, waves: [[{ kind: "king" }]], boss });
    const strong = new Battle({ seed: "k", stats: { ...STATS, wardPower: 60 }, difficulty: 1, waves: [[{ kind: "king" }]], boss });
    const hitsToBreak = (b: Battle) => {
      const k = b.king!;
      let n = 0;
      while (k.ward!.up && n < 100) {
        b.resolveHero("ranger", "arrow", k.id, ["good"]);
        n++;
      }
      return n;
    };
    expect(hitsToBreak(strong)).toBeLessThan(hitsToBreak(weak));
    expect(strong.wardBreaks).toBe(1);
    const k = strong.king!;
    k.hp = Math.floor(k.maxHp * 0.6);
    const ev = strong.settle();
    expect(ev.some((e) => e.type === "phase" && e.phase === 2)).toBe(true);
    expect(ev.some((e) => e.type === "summon")).toBe(true);
    expect(k.ward!.up).toBe(true);
    k.hp = 1;
    strong.resolveHero("ranger", "arrow", k.id, ["good"]);
    strong.settle();
    expect(strong.outcome).toBe("victory");
    expect(strong.living("foe")).toHaveLength(0);
  });

  it("across a whole run at the hardest difficulty, timing decides it: good timing clears, never defending falls", () => {
    // Five two-wave rooms, a hardened elite and the King, carrying health between battles.
    const room: FoeSpec[][] = [[{ kind: "husk" }, { kind: "hound" }, { kind: "wisp" }], [{ kind: "seer" }, { kind: "husk" }]];
    const rooms: FoeSpec[][][] = [room, room, room, room, room, [[{ kind: "keeper", elite: "hardened" }, { kind: "seer" }]], [[{ kind: "king" }]]];
    const runWith = (seed: number, grade: "perfect" | "good", defend: (k: number) => Defense) => {
      let hp: Record<string, number> | undefined;
      for (const [i, w] of rooms.entries()) {
        const b = new Battle({ seed: `run${seed}-${i}`, stats: { ...STATS, wardPower: 40 }, difficulty: 3, waves: w, partyHp: hp, boss: i === 6 ? { hp: 1400 * 1.5, wardTargets: [25, 45, 65] } : undefined });
        play(b, { grade, defend });
        if (b.outcome !== "victory") return false;
        hp = b.partyHpAfter();
      }
      return true;
    };
    const skilled = Array.from({ length: 8 }, (_, s) => runWith(s, "perfect", (k) => (k % 3 === 2 ? "hit" : k % 3 ? "dodge" : "parry")));
    const passive = Array.from({ length: 8 }, (_, s) => runWith(s, "good", () => "hit"));
    expect(skilled.every(Boolean)).toBe(true);
    expect(passive.some(Boolean)).toBe(false);
  });
});
