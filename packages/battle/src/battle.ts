import { ENEMIES, type EliteModifier } from "@ender/content";
import { clamp, rng, type Rng } from "@ender/shared";
import {
  FOES,
  HEROES,
  KING_ATK,
  KING_HP_SCALE,
  PARTY_ORDER,
  RULES,
  skillById,
  skillsFor,
  type Defense,
  type FoeAttack,
  type FoeKind,
  type Grade,
  type HeroId,
  type Skill,
} from "./defs";

/** What the Binder brings in from the server: combat stats derived from equipped Forms and passives. */
export type PartyStats = {
  maxHealth: number;
  attackDamage: number;
  critChance: number;
  critMultiplier: number;
  cooldownRate: number;
  areaMultiplier: number;
  armor: number;
  wardPower: number;
  wardMultiplier: number;
};

export type FoeSpec = { kind: FoeKind; elite?: EliteModifier };

export type BattleSetup = {
  seed: string;
  stats: PartyStats;
  difficulty: number;
  /** Foes arrive wave by wave; the next wave enters when the field is clear. */
  waves: FoeSpec[][];
  /** Party health carried between battles (missing = full). */
  partyHp?: Partial<Record<HeroId, number>>;
  /** Boss fights: the King's health from the run plan and its Ward targets per phase. */
  boss?: { hp: number; wardTargets: readonly number[] };
};

export type Unit = {
  id: string;
  side: "party" | "foe";
  kind: HeroId | FoeKind;
  name: string;
  elite?: EliteModifier;
  maxHp: number;
  hp: number;
  atk: number;
  armor: number;
  speed: number;
  crit: number;
  critMult: number;
  ap: number;
  breakMax: number;
  breakVal: number;
  /** Staggered: skips its next turn and takes more damage until then. */
  broken: boolean;
  guard: number;
  taunt: number;
  mark: number;
  /** Charge-time: the unit acts when the clock reaches this. */
  next: number;
  alive: boolean;
  ward?: { value: number; up: boolean; downTurns: number };
};

export type BattleEvent =
  | { type: "damage"; source: string; target: string; amount: number; crit: boolean; grade?: Grade; beat?: number }
  | { type: "heal"; source: string; target: string; amount: number }
  | { type: "ap"; unit: string; delta: number; ap: number }
  | { type: "break"; target: string }
  | { type: "recover"; target: string }
  | { type: "ward-break"; target: string }
  | { type: "ward-restored"; target: string }
  | { type: "ko"; target: string }
  | { type: "defend"; target: string; result: Defense; hit: number }
  | { type: "counter"; source: string; target: string }
  | { type: "status"; target: string; status: "guard" | "taunt" | "mark"; turns: number }
  | { type: "phase"; target: string; phase: number }
  | { type: "summon"; units: string[] }
  | { type: "wave"; index: number; units: string[] }
  | { type: "skip"; unit: string }
  | { type: "outcome"; outcome: "victory" | "defeat" };

export type FoePlan = { actor: string; attack: FoeAttack; targets: string[]; healTarget?: string };

/** Foes the field holds at once (the King's hall holds one more). */
export const FIELD_CAP = 3;

export class Battle {
  units: Unit[] = [];
  clock = 0;
  current: Unit | null = null;
  waveIndex = 0;
  phase = 1;
  wardBreaks = 0;
  kills: Record<string, number> = {};
  outcome: "ongoing" | "victory" | "defeat" = "ongoing";
  /** Reactions that must play before the next turn (a volatile elite's death burst). */
  reactions: FoePlan[] = [];
  readonly rng: Rng;
  private seq = 0;

  constructor(readonly setup: BattleSetup) {
    this.rng = rng(`battle|${setup.seed}`);
    const s = setup.stats;
    const apStart = RULES.apStart + Math.max(0, Math.round((1 - s.cooldownRate) * 5));
    for (const id of PARTY_ORDER) {
      const d = HEROES[id];
      const maxHp = Math.round(s.maxHealth * d.hp);
      const hp = setup.partyHp?.[id];
      this.units.push({
        id,
        side: "party",
        kind: id,
        name: d.name,
        maxHp,
        hp: hp === undefined ? maxHp : clamp(Math.round(hp), 0, maxHp),
        atk: s.attackDamage * d.atk,
        armor: clamp(s.armor / 100, 0, 0.5) + d.armor,
        speed: d.speed,
        crit: clamp(s.critChance + d.crit, 0, 0.9),
        critMult: s.critMultiplier,
        ap: apStart,
        breakMax: 0,
        breakVal: 0,
        broken: false,
        guard: 0,
        taunt: 0,
        mark: 0,
        // The party gets the jump on the first wave.
        next: (1000 / d.speed) * (0.25 + 0.5 * this.rng.next()),
        alive: true,
      });
    }
    for (const u of this.party()) if (u.hp <= 0) u.alive = false;
    this.spawnWave(0);
  }

  // ───────────────────────── queries ─────────────────────────

  party() {
    return this.units.filter((u) => u.side === "party");
  }
  foes() {
    return this.units.filter((u) => u.side === "foe");
  }
  living(side: "party" | "foe") {
    return this.units.filter((u) => u.side === side && u.alive);
  }
  unit(id: string) {
    const u = this.units.find((x) => x.id === id);
    if (!u) throw new Error(`no unit ${id}`);
    return u;
  }
  get king() {
    return this.units.find((u) => u.kind === "king");
  }
  get wavesLeft() {
    return this.setup.waves.length - 1 - this.waveIndex;
  }
  /** Effective Form power against the current Ward target: above 1 the Ward breaks faster and the King presses less. */
  get wardRatio() {
    const b = this.setup.boss;
    if (!b) return 1;
    const target = b.wardTargets[Math.min(this.phase, b.wardTargets.length) - 1] ?? 1;
    return clamp((this.setup.stats.wardPower * this.setup.stats.wardMultiplier) / target, 0.25, 2);
  }
  get wardTarget() {
    const b = this.setup.boss;
    return b ? (b.wardTargets[Math.min(this.phase, b.wardTargets.length) - 1] ?? 0) : 0;
  }

  private interval(u: Unit) {
    let speed = u.speed;
    if (u.kind === "king" && this.wardRatio < 1) speed *= 1 + 0.6 * (1 - this.wardRatio);
    return 1000 / speed;
  }

  /** The next n turns, as unit ids, without changing anything. */
  timeline(n = 8): string[] {
    const sim = this.units.filter((u) => u.alive).map((u) => ({ id: u.id, next: u.next, step: this.interval(u) }));
    const out: string[] = [];
    if (this.current && this.current.alive) out.push(this.current.id);
    while (out.length < n && sim.length) {
      sim.sort((a, b) => a.next - b.next || a.id.localeCompare(b.id));
      const u = sim[0]!;
      out.push(u.id);
      u.next += u.step;
    }
    return out;
  }

  // ───────────────────────── setup ─────────────────────────

  private makeFoe(kind: FoeKind, elite?: EliteModifier): Unit {
    const def = FOES[kind];
    const d = this.setup.difficulty;
    let maxHp: number;
    let atk: number;
    if (kind === "king") {
      maxHp = Math.round((this.setup.boss?.hp ?? 1400) * KING_HP_SCALE);
      atk = KING_ATK * (1 + 0.12 * (d - 1));
    } else {
      const base = ENEMIES[kind];
      maxHp = Math.round(base.hp * def.hpScale * (1 + 0.18 * (d - 1)) * (elite === "hardened" ? 1.8 : elite === "volatile" ? 1.6 : 1));
      atk = base.damage * def.atkScale * (1 + 0.12 * (d - 1)) * (elite ? 1.3 : 1);
    }
    const id = `${kind}-${++this.seq}`;
    return {
      id,
      side: "foe",
      kind,
      name: elite ? `${elite === "hardened" ? "Hardened" : "Volatile"} ${def.name}` : def.name,
      elite,
      maxHp,
      hp: maxHp,
      atk,
      armor: def.armor + (elite === "hardened" ? 0.2 : 0),
      speed: def.speed * (elite ? 1.1 : 1),
      crit: 0,
      critMult: 1,
      ap: 0,
      breakMax: def.breakMax * (elite === "hardened" ? 1.5 : 1),
      breakVal: 0,
      broken: false,
      guard: 0,
      taunt: 0,
      mark: 0,
      next: this.clock + (1000 / def.speed) * (0.6 + 0.6 * this.rng.next()),
      alive: true,
      ward: kind === "king" ? { value: 100, up: true, downTurns: 0 } : undefined,
    };
  }

  private spawnWave(i: number) {
    this.waveIndex = i;
    const spawned = (this.setup.waves[i] ?? []).slice(0, FIELD_CAP + (this.setup.boss ? 1 : 0)).map((f) => this.makeFoe(f.kind, f.elite));
    this.units.push(...spawned);
    return spawned.map((u) => u.id);
  }

  // ───────────────────────── turns ─────────────────────────

  /**
   * Advance the clock to the next actor. A broken unit spends this turn recovering; the caller should show the skip
   * and call nextTurn() again.
   */
  nextTurn(): { actor: Unit; skipped: boolean; events: BattleEvent[] } {
    if (this.outcome !== "ongoing") throw new Error("battle is over");
    const alive = this.units.filter((u) => u.alive);
    alive.sort((a, b) => a.next - b.next || a.id.localeCompare(b.id));
    const u = alive[0]!;
    this.clock = u.next;
    u.next += this.interval(u);
    this.current = u;
    const events: BattleEvent[] = [];
    // Statuses tick at the start of their owner's turn.
    for (const k of ["guard", "taunt", "mark"] as const) if (u[k] > 0) u[k]--;
    if (u.broken) {
      if (u.ward && !u.ward.up) {
        u.ward.downTurns--;
        events.push({ type: "skip", unit: u.id });
        if (u.ward.downTurns <= 0) {
          u.ward.up = true;
          u.ward.value = RULES.wardRestore;
          u.broken = false;
          events.push({ type: "ward-restored", target: u.id });
        }
        return { actor: u, skipped: true, events };
      }
      u.broken = false;
      u.breakVal = 0;
      events.push({ type: "skip", unit: u.id }, { type: "recover", target: u.id });
      return { actor: u, skipped: true, events };
    }
    return { actor: u, skipped: false, events };
  }

  // ───────────────────────── heroes ─────────────────────────

  skillsFor(heroId: string) {
    const u = this.unit(heroId);
    return skillsFor(u.kind as HeroId).map((s) => ({ skill: s, usable: u.ap >= s.ap }));
  }

  targetsFor(skill: Skill, actorId: string): string[] {
    if (skill.target === "foe" || skill.target === "all-foes") return this.living("foe").map((u) => u.id);
    if (skill.target === "ally") return this.living("party").map((u) => u.id);
    return [actorId];
  }

  private damage(src: Unit, dst: Unit, raw: number, events: BattleEvent[], extra: { grade?: Grade; beat?: number; crit?: boolean } = {}) {
    let amt = raw * (1 - dst.armor);
    if (dst.side === "foe") {
      if (dst.mark > 0) amt *= RULES.markTakenMult;
      if (dst.ward) {
        if (dst.ward.up) {
          dst.ward.value -= amt * RULES.wardLossPerDamage * this.wardRatio;
          amt *= RULES.wardUpMult;
        } else amt *= RULES.brokenTakenMult;
      } else if (dst.broken) amt *= RULES.brokenTakenMult;
    } else if (dst.guard > 0) amt *= RULES.guardTakenMult;
    const amount = Math.max(1, Math.round(amt));
    dst.hp = Math.max(0, dst.hp - amount);
    events.push({ type: "damage", source: src.id, target: dst.id, amount, crit: !!extra.crit, grade: extra.grade, beat: extra.beat });
    this.checkWard(dst, events);
    if (dst.hp <= 0 && dst.alive) this.kill(dst, events);
  }

  private addBreak(dst: Unit, amount: number, events: BattleEvent[]) {
    if (!dst.alive || dst.side !== "foe") return;
    if (dst.ward) {
      if (dst.ward.up) dst.ward.value -= amount * RULES.wardLossPerBreak * this.wardRatio;
      this.checkWard(dst, events);
      return;
    }
    if (dst.broken) return;
    dst.breakVal = Math.min(dst.breakMax, dst.breakVal + amount);
    if (dst.breakVal >= dst.breakMax) {
      dst.broken = true;
      events.push({ type: "break", target: dst.id });
    }
  }

  private checkWard(u: Unit, events: BattleEvent[]) {
    if (!u.ward || !u.ward.up || u.ward.value > 0 || !u.alive) return;
    u.ward.value = 0;
    u.ward.up = false;
    u.ward.downTurns = 1 + (this.wardRatio >= 1.3 ? 1 : 0);
    u.broken = true;
    this.wardBreaks++;
    events.push({ type: "ward-break", target: u.id });
  }

  private kill(u: Unit, events: BattleEvent[]) {
    u.alive = false;
    u.hp = 0;
    u.broken = false;
    events.push({ type: "ko", target: u.id });
    if (u.side === "foe") {
      this.kills[u.kind] = (this.kills[u.kind] ?? 0) + 1;
      if (u.elite === "volatile" && this.living("party").length) {
        this.reactions.push({ actor: u.id, attack: RULES.volatileBurst, targets: this.living("party").map((p) => p.id) });
      }
    }
  }

  private gainAp(u: Unit, delta: number, events: BattleEvent[]) {
    const before = u.ap;
    u.ap = clamp(u.ap + delta, 0, RULES.apMax);
    if (u.ap !== before) events.push({ type: "ap", unit: u.id, delta: u.ap - before, ap: u.ap });
  }

  /** Apply a hero's skill with the grades of its timed presses (one per beat). */
  resolveHero(actorId: string, skillId: string, targetId: string, grades: Grade[]): BattleEvent[] {
    const actor = this.unit(actorId);
    const skill = skillById(skillId);
    if (skill.hero !== actor.kind) throw new Error(`${actor.kind} cannot use ${skill.id}`);
    if (actor.ap < skill.ap) throw new Error(`not enough AP for ${skill.id}`);
    const events: BattleEvent[] = [];
    if (skill.ap) this.gainAp(actor, -skill.ap, events);
    const g = skill.beats.map((_, i) => grades[i] ?? "miss");

    if (skill.target === "foe" || skill.target === "all-foes") {
      const area = skill.target === "all-foes" ? this.setup.stats.areaMultiplier : 1;
      g.forEach((grade, beat) => {
        const targets = skill.target === "all-foes" ? this.living("foe") : [this.unit(targetId)].filter((t) => t.alive);
        for (const t of targets) {
          const crit = this.rng.chance(actor.crit);
          const raw = actor.atk * skill.power * area * RULES.gradeMult[grade] * (crit ? actor.critMult : 1);
          this.damage(actor, t, raw, events, { grade, beat, crit });
          this.addBreak(t, skill.breakPower * RULES.gradeMult[grade], events);
          if (skill.mark && t.alive) {
            t.mark = skill.mark + 1;
            events.push({ type: "status", target: t.id, status: "mark", turns: skill.mark });
          }
        }
      });
    } else if (skill.target === "ally") {
      const t = this.unit(targetId);
      if (!t.alive) throw new Error("cannot heal a fallen ally");
      for (const grade of g) {
        const amount = Math.round(Math.min(t.maxHp - t.hp, actor.atk * (skill.heal ?? 0) * RULES.gradeMult[grade]));
        t.hp += amount;
        events.push({ type: "heal", source: actor.id, target: t.id, amount });
      }
    } else {
      const best = g.includes("perfect");
      if (skill.guard) {
        actor.guard = skill.guard + 1 + (best ? 1 : 0);
        events.push({ type: "status", target: actor.id, status: "guard", turns: actor.guard - 1 });
      }
      if (skill.taunt) {
        actor.taunt = skill.taunt + 1;
        events.push({ type: "status", target: actor.id, status: "taunt", turns: skill.taunt });
      }
    }
    if (skill.apGain) this.gainAp(actor, skill.apGain + (g[0] === "perfect" ? RULES.perfectApBonus : 0), events);
    return events;
  }

  // ───────────────────────── foes ─────────────────────────

  /** Choose the current foe's attack and targets. */
  planFoe(actorId: string): FoePlan {
    const actor = this.unit(actorId);
    const def = FOES[actor.kind as FoeKind];
    const party = this.living("party");
    const wounded = this.living("foe")
      .filter((f) => f.id !== actor.id && f.hp < f.maxHp * 0.6)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    const options = def.attacks.filter((a) => (a.minPhase ?? 1) <= this.phase && (!a.healAlly || wounded));
    const attack = this.rng.weighted(options, options.map((a) => a.weight));
    if (attack.healAlly) return { actor: actor.id, attack, targets: [], healTarget: wounded!.id };
    const taunting = party.filter((p) => p.taunt > 0);
    const targets = attack.target === "all" ? party.map((p) => p.id) : [(taunting[0] ?? this.rng.pick(party)).id];
    return { actor: actor.id, attack, targets };
  }

  /**
   * Apply a foe's attack. `defenses` has one entry per hit; an area attack's single defence covers every target.
   * A hero who parries every hit aimed at them counters.
   */
  resolveFoe(plan: FoePlan, defenses: Defense[]): BattleEvent[] {
    const actor = this.unit(plan.actor);
    const events: BattleEvent[] = [];
    if (plan.healTarget) {
      const t = this.unit(plan.healTarget);
      if (t.alive) {
        const amount = Math.round(Math.min(t.maxHp - t.hp, actor.atk * (plan.attack.healAlly ?? 0)));
        t.hp += amount;
        events.push({ type: "heal", source: actor.id, target: t.id, amount });
      }
      return events;
    }
    plan.attack.hits.forEach((hit, i) => {
      const result = defenses[i] ?? "hit";
      for (const tid of plan.targets) {
        const t = this.unit(tid);
        if (!t.alive) continue;
        events.push({ type: "defend", target: t.id, result, hit: i });
        if (result === "hit") this.damage(actor, t, actor.atk * hit.power, events);
        else if (result === "parry") this.gainAp(t, RULES.parryAp, events);
      }
    });
    const allParried = plan.attack.hits.length > 0 && plan.attack.hits.every((_, i) => defenses[i] === "parry");
    const counterer = plan.targets.map((id) => this.unit(id)).find((t) => t.alive);
    if (allParried && counterer && actor.alive) {
      events.push({ type: "counter", source: counterer.id, target: actor.id });
      const crit = this.rng.chance(counterer.crit);
      this.damage(counterer, actor, counterer.atk * RULES.counterPower * (crit ? counterer.critMult : 1), events, { crit, grade: "perfect" });
      this.addBreak(actor, RULES.counterBreak, events);
    }
    return events;
  }

  // ───────────────────────── after each action ─────────────────────────

  /** Phase changes, reinforcements and the outcome. Call after every resolved action or reaction. */
  settle(): BattleEvent[] {
    const events: BattleEvent[] = [];
    const king = this.king;
    if (king?.alive && this.setup.boss) {
      const next = king.hp < king.maxHp * 0.33 ? 3 : king.hp < king.maxHp * 0.66 ? 2 : 1;
      if (next > this.phase) {
        this.phase = next;
        king.ward = { value: 100, up: true, downTurns: 0 };
        king.broken = false;
        events.push({ type: "phase", target: king.id, phase: next });
        const adds: FoeKind[] = next === 2 ? ["husk", "wisp"] : ["hound", "seer"];
        if (this.wardRatio < 1) adds.push(next === 2 ? "husk" : "wisp");
        const room = FIELD_CAP + 1 - this.living("foe").length;
        const spawned = adds.slice(0, Math.max(0, room)).map((k) => this.makeFoe(k));
        this.units.push(...spawned);
        if (spawned.length) events.push({ type: "summon", units: spawned.map((u) => u.id) });
      }
    }
    if (!this.living("party").length) {
      this.outcome = "defeat";
      this.reactions = [];
      events.push({ type: "outcome", outcome: "defeat" });
      return events;
    }
    const bossDown = this.setup.boss ? !king?.alive : false;
    if (bossDown) {
      // The King's fall unbinds everything he summoned.
      for (const f of this.living("foe")) this.kill(f, events);
      this.reactions = [];
    }
    if (!this.living("foe").length && !this.reactions.length) {
      if (!bossDown && this.waveIndex + 1 < this.setup.waves.length) {
        const units = this.spawnWave(this.waveIndex + 1);
        events.push({ type: "wave", index: this.waveIndex, units });
      } else {
        this.outcome = "victory";
        events.push({ type: "outcome", outcome: "victory" });
      }
    }
    return events;
  }

  /** Party health to carry into the next battle: the fallen get up, the rest catch their breath. */
  partyHpAfter(): Record<HeroId, number> {
    const out = {} as Record<HeroId, number>;
    for (const u of this.party()) {
      out[u.kind as HeroId] = u.alive ? Math.min(u.maxHp, Math.round(u.hp + u.maxHp * RULES.restFraction)) : Math.round(u.maxHp * RULES.reviveFraction);
    }
    return out;
  }
}
