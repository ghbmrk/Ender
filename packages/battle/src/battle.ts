import { rng, type Rng } from "@ender/shared";
import { RULES, ROOTS, TEMPLATES, isDodge, isParry, type Affinity, type Defense, type Grade, type RootId, type StatusId } from "./defs";
import { FOES, type FoeAttack, type FoeKind } from "./foes";
import type { CompiledAction, CompiledLoom, CompiledReaction } from "./loom";

export type HeroSetup = { root: RootId; loom: CompiledLoom; hp?: number; /** The player's own name for this hero. */ name?: string; /** The figure to draw, when the player chose one. */ figure?: string };
export type BattleSetup = {
  seed: string;
  party: HeroSetup[];
  /** Foes arrive wave by wave (usually one wave of 1–5). */
  waves: FoeKind[][];
  difficulty: number;
  /** Scales foe HP and attack (the prologue's gentle practice fights). */
  foeScale?: { hp?: number; atk?: number };
  /** Most foes on the field at once (default FIELD_CAP). 1 makes every fight a duel: waves arrive one foe at a time and bosses summon no help. */
  fieldCap?: number;
  /** Foes never enrage (the prologue, which teaches one rhythm at a time). */
  calm?: boolean;
};

type Dot = { rounds: number; dmg: number };
export type Statuses = { marked: number; slow: number; fracture: number; burn: Dot | null; poison: Dot | null };

export type Unit = {
  id: string;
  side: "party" | "foe";
  kind: RootId | FoeKind;
  name: string;
  figure: string;
  maxHp: number;
  hp: number;
  speed: number;
  /** Heroes: Basic damage. Foes: base hit damage. */
  power: number;
  breakTaken: number;
  tier: "hero" | "normal" | "elite" | "boss";
  ap: number;
  breakVal: number;
  /** Staggered: skips its next turn; stays Broken until the end of that round (a boss: until that turn ends). */
  broken: null | { skipPending: boolean };
  status: Statuses;
  barrier: number;
  /** Initiative delay reduction for the next round (fraction). */
  initBonus: number;
  initFromKeystone: number;
  alive: boolean;
  phase: number;
  /** A foe below a third of its health fights harder, once per fight. */
  enraged?: boolean;
  // hero state
  loom?: CompiledLoom;
  pattern: number;
  patternFree: boolean;
  knotsDiscount: boolean;
  linked: boolean;
  farSight: boolean;
  bondRiderTurn: number;
  livingPattern: string[];
  hiddenEdgeMarks: boolean;
};

const ENRAGE_AT = 1 / 3;
const ENRAGE_POWER = 1.2;

export type BattleEvent =
  | { type: "damage"; source: string; target: string; amount: number; crit: boolean; grade?: Grade; weakPoint?: boolean; absorbed?: number; dot?: StatusId }
  | { type: "heal"; source: string; target: string; amount: number }
  | { type: "barrier"; target: string; amount: number }
  | { type: "ap"; unit: string; delta: number; ap: number; reason: string }
  | { type: "break"; target: string }
  | { type: "recover"; target: string }
  | { type: "ko"; target: string }
  | { type: "enrage"; target: string }
  | { type: "defend"; target: string; result: Defense; hit: number }
  | { type: "full-parry"; target: string }
  | { type: "counter"; source: string; target: string }
  | { type: "reaction"; unit: string; name: string }
  | { type: "status"; target: string; status: StatusId; value: number }
  | { type: "advance"; unit: string }
  | { type: "summon"; units: string[] }
  | { type: "wave"; index: number; units: string[] }
  | { type: "round"; round: number; order: string[] }
  | { type: "skip"; unit: string }
  | { type: "outcome"; outcome: "victory" | "defeat" };

export type FoePlan = { actor: string; attack: FoeAttack; targets: string[]; healTarget?: string };

export type Command = {
  actor: string;
  /** "basic" or a compiled Action's nodeId. */
  command: string;
  target: string;
  /** Link's chosen ally. */
  ally?: string;
  /** One grade per timed beat. */
  grades: Grade[];
  /** A weak point was tapped in time. */
  weakPoint?: boolean;
};

/** Measured per battle, per side (used by the build-difference design test, §97). */
export type BattleStats = { breakDealt: number; apTransferred: number; apRefunded: number; damageDealt: number; parries: number; perfects: number; breaks: number };

export const FIELD_CAP = 5;
const CONDITIONS: StatusId[] = ["marked", "slow", "fracture", "burn", "poison"];

export class Battle {
  units: Unit[] = [];
  round = 0;
  order: string[] = [];
  cursor = -1;
  current: Unit | null = null;
  waveIndex = 0;
  kills: Record<string, number> = {};
  outcome: "ongoing" | "victory" | "defeat" = "ongoing";
  reactions: FoePlan[] = [];
  stats: BattleStats = { breakDealt: 0, apTransferred: 0, apRefunded: 0, damageDealt: 0, parries: 0, perfects: 0, breaks: 0 };
  breaksByUnit: Record<string, number> = {};
  readonly rng: Rng;
  private seq = 0;
  private turnNo = 0;
  private oneThreadAction = -1;

  constructor(readonly setup: BattleSetup) {
    this.rng = rng(`battle|${setup.seed}`);
    for (const h of setup.party) {
      const r = ROOTS[h.root];
      const hp = h.hp === undefined ? r.hp : Math.max(0, Math.min(r.hp, Math.round(h.hp)));
      this.units.push(this.blank({ id: h.root, side: "party", kind: h.root, name: h.name ?? r.name.replace(" Root", ""), figure: h.figure ?? r.hero, maxHp: r.hp, hp, speed: r.speed, power: r.basic, breakTaken: 0, tier: "hero", ap: RULES.apStart, loom: h.loom, alive: hp > 0 }));
    }
    this.spawnWave(0);
  }

  private blank(u: Partial<Unit> & Pick<Unit, "id" | "side" | "kind" | "name" | "figure" | "maxHp" | "hp" | "speed" | "power" | "breakTaken" | "tier">): Unit {
    return {
      ap: 0,
      breakVal: 0,
      broken: null,
      status: { marked: 0, slow: 0, fracture: 0, burn: null, poison: null },
      barrier: 0,
      initBonus: 0,
      initFromKeystone: 0,
      alive: true,
      phase: 0,
      pattern: 0,
      patternFree: false,
      knotsDiscount: false,
      linked: false,
      farSight: false,
      bondRiderTurn: -1,
      livingPattern: [],
      hiddenEdgeMarks: false,
      ...u,
    };
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
  hasCondition(u: Unit) {
    return CONDITIONS.some((c) => this.statusOn(u, c));
  }
  statusOn(u: Unit, s: StatusId) {
    const v = u.status[s];
    return typeof v === "number" ? v > 0 : !!v;
  }
  private conditionCount(u: Unit) {
    return CONDITIONS.filter((c) => this.statusOn(u, c)).length;
  }
  effectiveSpeed(u: Unit) {
    return u.speed * (u.status.slow > 0 ? 1 - RULES.slow : 1) * (1 + Math.min(RULES.initiativeCap, u.initBonus));
  }
  actionsOf(heroId: string): CompiledAction[] {
    return this.unit(heroId).loom?.actions ?? [];
  }
  private reactionOf(u: Unit, trigger: CompiledReaction["trigger"]) {
    return u.loom?.reactions.find((r) => r.executes && r.trigger === trigger);
  }
  private keystone(u: Unit): Affinity | undefined {
    return u.loom?.keystone?.affinity;
  }

  /** The AP a command costs right now, after Pattern, Knots and Living Pattern discounts. */
  costOf(heroId: string, command: string): number {
    if (command === "basic") return 0;
    const u = this.unit(heroId);
    const a = this.actionsOf(heroId).find((x) => x.nodeId === command);
    if (!a) throw new Error(`${heroId} has no Action ${command}`);
    if (a.template === "pattern" && u.patternFree) return 0;
    if (this.keystone(u) === "knots" && u.livingPattern.length >= 2 && !u.livingPattern.includes(a.nodeId)) return 0;
    return Math.max(0, a.apCost - (u.knotsDiscount ? 2 : 0));
  }

  /** Remaining turns this round, then the next round as it stands now (§62: always visible). */
  timeline(): { round: number; ids: string[] }[] {
    const rest = this.order.slice(this.cursor + 1).filter((id) => this.unit(id).alive);
    const now = this.current?.alive ? [this.current.id, ...rest] : rest;
    return [
      { round: this.round, ids: now },
      { round: this.round + 1, ids: this.roundOrder() },
    ];
  }

  private roundOrder() {
    return this.units
      .filter((u) => u.alive)
      .sort((a, b) => this.effectiveSpeed(b) - this.effectiveSpeed(a) || (a.side === b.side ? 0 : a.side === "party" ? -1 : 1) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((u) => u.id);
  }

  // ───────────────────────── setup ─────────────────────────

  private makeFoe(kind: FoeKind): Unit {
    const d = FOES[kind];
    const diff = this.setup.difficulty;
    const scale = this.setup.foeScale;
    const maxHp = Math.round(d.hp * (1 + 0.25 * (diff - 1)) * (scale?.hp ?? 1));
    return this.blank({
      id: `${kind}-${++this.seq}`,
      side: "foe",
      kind,
      name: d.name,
      figure: d.figure,
      maxHp,
      hp: maxHp,
      speed: d.speed,
      power: d.atk * (1 + 0.12 * (diff - 1)) * (scale?.atk ?? 1),
      breakTaken: d.breakTaken,
      tier: d.tier,
    });
  }

  private spawnWave(i: number) {
    this.waveIndex = i;
    const spawned = (this.setup.waves[i] ?? []).slice(0, this.setup.fieldCap ?? FIELD_CAP).map((k) => this.makeFoe(k));
    this.units.push(...spawned);
    return spawned.map((u) => u.id);
  }

  // ───────────────────────── rounds and turns ─────────────────────────

  private startRound(events: BattleEvent[]) {
    this.round++;
    for (const u of this.units) {
      if (u.alive && u.broken && !u.broken.skipPending) {
        u.broken = null;
        u.breakVal = 0;
        events.push({ type: "recover", target: u.id });
      }
    }
    this.order = this.roundOrder();
    // Initiative changes apply to the round they were earned for, then clear.
    for (const u of this.units) {
      u.initBonus = 0;
      u.initFromKeystone = 0;
    }
    this.cursor = -1;
    events.push({ type: "round", round: this.round, order: [...this.order] });
  }

  /** Advance to the next actor. Turn-start effects (AP, burn, poison, stagger) are applied here. */
  nextTurn(): { actor: Unit; skipped: boolean; events: BattleEvent[] } {
    if (this.outcome !== "ongoing") throw new Error("battle is over");
    const events: BattleEvent[] = [];
    for (let guard = 0; guard < 200; guard++) {
      this.cursor++;
      if (this.cursor >= this.order.length) { this.startRound(events); this.cursor = 0; }
      const u = this.unit(this.order[this.cursor]!);
      if (!u.alive) continue;
      this.current = u;
      this.turnNo++;
      // Damage over time at turn start (§72).
      for (const s of ["burn", "poison"] as const) {
        const dot = u.status[s];
        if (!dot) continue;
        this.hurt(u, u, dot.dmg, events, { dot: s });
        dot.rounds--;
        if (dot.rounds <= 0) u.status[s] = null;
      }
      if (u.status.slow > 0) u.status.slow--;
      if (u.status.fracture > 0) u.status.fracture--;
      if (!u.alive) {
        this.settleInto(events);
        if (this.outcome !== "ongoing") return { actor: u, skipped: true, events };
        continue;
      }
      if (u.broken?.skipPending) {
        u.broken.skipPending = false;
        events.push({ type: "skip", unit: u.id });
        if (u.tier === "boss") {
          u.broken = null;
          u.breakVal = 0;
          events.push({ type: "recover", target: u.id });
        }
        return { actor: u, skipped: true, events };
      }
      if (u.side === "party") this.gainAp(u, RULES.apPerTurn, events, "turn");
      return { actor: u, skipped: false, events };
    }
    throw new Error("no one can act");
  }

  // ───────────────────────── shared mechanics ─────────────────────────

  private gainAp(u: Unit, amount: number, events: BattleEvent[], reason: string, from?: Unit) {
    if (amount <= 0 || !u.alive) return 0;
    const before = u.ap;
    u.ap = Math.min(RULES.apMax, u.ap + amount);
    const got = u.ap - before;
    if (got <= 0) return 0;
    events.push({ type: "ap", unit: u.id, delta: got, ap: u.ap, reason });
    if (from && from !== u) this.stats.apTransferred += got;
    if (reason === "refund") this.stats.apRefunded += got;
    // One Thread (§45): when this character gains AP, an ally at ≤2 AP gains 1, once per party action.
    if (u.side === "party" && this.keystone(u) === "bond" && this.oneThreadAction !== this.turnNo) {
      const ally = this.living("party").filter((p) => p !== u && p.ap <= 2).sort((a, b) => a.ap - b.ap || (a.id < b.id ? -1 : 1))[0];
      if (ally) {
        this.oneThreadAction = this.turnNo;
        this.gainAp(ally, 1, events, "one thread", u);
      }
    }
    return got;
  }

  /** The ally with the least AP; a hero fighting alone is their own ally. */
  private lowestAp(except?: Unit) {
    const party = this.living("party");
    if (party.length === 1) return party[0];
    return party.filter((p) => p !== except).sort((a, b) => a.ap - b.ap || (a.id < b.id ? -1 : 1))[0];
  }
  private lowestHp() {
    return this.living("party").sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || (a.id < b.id ? -1 : 1))[0];
  }
  private addInit(u: Unit, frac: number, keystone = false) {
    if (keystone) {
      const room = Math.max(0, 0.24 - u.initFromKeystone);
      frac = Math.min(frac, room);
      u.initFromKeystone += frac;
    }
    u.initBonus += frac;
  }

  private mark(t: Unit, hits: number, events: BattleEvent[]) {
    t.status.marked = Math.max(t.status.marked, hits);
    events.push({ type: "status", target: t.id, status: "marked", value: t.status.marked });
  }

  private applyStatus(src: Unit, t: Unit, s: StatusId, events: BattleEvent[]) {
    const potency = src.power * 3;
    if (s === "marked") return this.mark(t, 1, events);
    if (s === "slow" || s === "fracture") t.status[s] = RULES.statusRounds;
    else if (s === "burn") t.status.burn = { rounds: RULES.dotRounds, dmg: Math.max(1, Math.round(potency * RULES.burnPct)) };
    else t.status.poison = { rounds: RULES.dotRounds, dmg: Math.max(1, Math.round(Math.min(t.maxHp * RULES.poisonMaxHpPct, potency * RULES.burnPct))) };
    events.push({ type: "status", target: t.id, status: s, value: s === "burn" || s === "poison" ? RULES.dotRounds : RULES.statusRounds });
  }

  /** Raw damage after Barrier; handles KO. */
  private hurt(src: Unit, t: Unit, raw: number, events: BattleEvent[], extra: { crit?: boolean; grade?: Grade; weakPoint?: boolean; dot?: StatusId } = {}) {
    let amount = Math.max(1, Math.round(raw));
    let absorbed = 0;
    if (t.barrier > 0) {
      absorbed = Math.min(t.barrier, amount);
      t.barrier -= absorbed;
      amount -= absorbed;
    }
    t.hp = Math.max(0, t.hp - amount);
    if (src.side === "party" && t.side === "foe") this.stats.damageDealt += amount;
    events.push({ type: "damage", source: src.id, target: t.id, amount, crit: !!extra.crit, grade: extra.grade, weakPoint: extra.weakPoint, absorbed: absorbed || undefined, dot: extra.dot });
    if (t.hp <= 0 && t.alive) this.kill(t, events);
  }

  /** A damaging hit on a foe: Marked, Broken and crits apply. */
  private strike(src: Unit, t: Unit, raw: number, events: BattleEvent[], opts: { grade?: Grade; weakPoint?: boolean; critBonus?: number } = {}) {
    if (!t.alive) return;
    let dmg = raw;
    if (t.status.marked > 0) {
      dmg *= 1 + (this.keystone(src) === "veil" ? RULES.hiddenEdgeMarkBonus : RULES.markBonus);
      t.status.marked--;
    }
    if (t.broken) dmg *= RULES.brokenTakenMult;
    const crit = this.rng.chance(RULES.critChance + (opts.critBonus ?? 0));
    if (crit) {
      if (this.keystone(src) === "veil") this.mark(t, 2, events);
      else dmg *= RULES.critMult;
    }
    this.hurt(src, t, dmg, events, { crit, grade: opts.grade, weakPoint: opts.weakPoint });
  }

  private addBreak(src: Unit, t: Unit, amount: number, events: BattleEvent[]) {
    if (!t.alive || t.side !== "foe" || amount <= 0) return;
    const add = amount * t.breakTaken * (t.status.fracture > 0 ? RULES.fractureBreakMult : 1);
    if (src.side === "party") {
      this.stats.breakDealt += add;
      this.breaksByUnit[src.id] = (this.breaksByUnit[src.id] ?? 0) + add;
    }
    if (t.broken) return;
    t.breakVal = Math.min(100, t.breakVal + add);
    if (t.breakVal >= 100) {
      t.broken = { skipPending: true };
      this.stats.breaks++;
      events.push({ type: "break", target: t.id });
    }
  }

  private kill(u: Unit, events: BattleEvent[]) {
    u.alive = false;
    u.hp = 0;
    u.broken = null;
    events.push({ type: "ko", target: u.id });
    if (u.side === "foe") {
      this.kills[u.kind] = (this.kills[u.kind] ?? 0) + 1;
      const burst = FOES[u.kind as FoeKind].deathBurst;
      if (burst && this.living("party").length) this.reactions.push({ actor: u.id, attack: burst, targets: this.living("party").map((p) => p.id) });
    }
  }

  // ───────────────────────── hero commands ─────────────────────────

  /** Resolve a hero's command with the grades of its timed presses. */
  resolveHero(cmd: Command): BattleEvent[] {
    const u = this.unit(cmd.actor);
    if (u.side !== "party" || !u.alive) throw new Error(`${cmd.actor} cannot act`);
    const events: BattleEvent[] = [];
    const target = this.unit(cmd.target);
    if (target.side !== "foe" || !target.alive) throw new Error("target a living foe");
    const key = this.keystone(u);

    if (cmd.command === "basic") {
      const g = cmd.grades[0] ?? "miss";
      if (g === "perfect") this.stats.perfects++;
      this.strike(u, target, u.power * RULES.gradeMult[g], events, { grade: g });
      this.addBreak(u, target, RULES.basicBreak * RULES.gradeMult[g], events);
      this.gainAp(u, ROOTS[u.kind as RootId].basicAp, events, "basic");
      this.perfectInitiative(u, g === "perfect", undefined);
      return events;
    }

    const a = this.actionsOf(u.id).find((x) => x.nodeId === cmd.command);
    if (!a) throw new Error(`${u.id} has no Action ${cmd.command}`);
    const cost = this.costOf(u.id, a.nodeId);
    if (u.ap < cost) throw new Error(`not enough AP for ${a.name}`);
    u.ap -= cost;
    events.push({ type: "ap", unit: u.id, delta: -cost, ap: u.ap, reason: a.name });
    // Consume discounts.
    if (a.template === "pattern" && u.patternFree) u.patternFree = false;
    else if (u.knotsDiscount && a.apCost > 0) u.knotsDiscount = false;
    if (key === "knots") {
      if (u.livingPattern.length >= 2 && !u.livingPattern.includes(a.nodeId)) u.livingPattern = [];
      else if (!u.livingPattern.includes(a.nodeId)) u.livingPattern.push(a.nodeId);
    }

    const tpl = TEMPLATES[a.template];
    const grades = tpl.beats.length ? tpl.beats.map((_, i) => cmd.grades[i] ?? "miss") : [cmd.grades[0] ?? "good"];
    const allPerfect = grades.every((g) => g === "perfect");
    this.stats.perfects += grades.filter((g) => g === "perfect").length;
    const debuffed = this.hasCondition(target);
    const conditions = this.conditionCount(target);
    const critBonus = (a.rider === "veil" && debuffed ? 0.15 : 0) + a.modifiers.filter((m) => m.affinity === "veil").length * (debuffed ? 0.1 : 0);

    let mult = 1;
    if (u.linked) {
      mult *= 1.2;
      u.linked = false;
    }
    if (a.rider === "knots" && debuffed) mult *= 1.2;
    const knotsMods = a.modifiers.filter((m) => m.affinity === "knots").length;
    if (knotsMods) mult *= 1 + Math.min(0.3, 0.15 * Math.min(2, conditions) * knotsMods);
    const weakPoint = !!cmd.weakPoint && (a.weakPoint || u.farSight);
    u.farSight = false;
    const perHit = u.power * (a.damagePct / 100);
    const brkPerHit = a.breakTotal / Math.max(1, a.hits) - (a.rider === "burden" ? 15 / a.hits : 0);

    for (let i = 0; i < a.hits; i++) {
      const g = grades[Math.min(i, grades.length - 1)]!;
      let gm = RULES.gradeMult[g];
      if (a.template === "flurry" && g === "perfect") gm = RULES.flurryPerfect;
      if (a.template === "lance" || tpl.beats.length === 0) gm = 1;
      let hitMult = mult * gm;
      if (a.template === "pattern" && i === 1 && debuffed) hitMult *= 1.5;
      const wp = weakPoint && i === 0;
      if (wp) hitMult *= a.weakPoint ? a.weakPointMult : RULES.weakPointMult;
      this.strike(u, target, perHit * hitMult, events, { grade: tpl.beats.length ? g : undefined, weakPoint: wp, critBonus });
      this.addBreak(u, target, brkPerHit * gm + (wp ? RULES.weakPointBreak : 0) + (i === 0 && a.rider === "burden" ? 15 : 0), events);
    }

    // Template effects.
    if (a.template === "mark" && target.alive) this.mark(target, grades[0] === "perfect" ? RULES.markHits + 1 : RULES.markHits, events);
    if (a.template === "pattern" && allPerfect) this.addPattern(u, events);
    let generated = 0;
    if (a.template === "flurry" && allPerfect) generated += this.gainAp(u, 1, events, "refund");
    if (a.template === "link" && cmd.ally) {
      const ally = this.unit(cmd.ally);
      if (ally.alive && ally.side === "party") {
        ally.linked = true;
        events.push({ type: "reaction", unit: ally.id, name: "Linked +20%" });
        if (grades[0] === "perfect") generated += this.gainAp(ally, 1, events, "link", u);
      }
    }
    // Bond rider: lowest-AP ally +1 AP, once per turn.
    if (a.rider === "bond" && u.bondRiderTurn !== this.turnNo) {
      u.bondRiderTurn = this.turnNo;
      const ally = this.lowestAp(u);
      if (ally) generated += this.gainAp(ally, 1, events, "bond rider", u);
    }
    // Bond Modifier: 25% of generated AP also to the lowest-AP ally.
    for (const m of a.modifiers)
      if (m.affinity === "bond") {
        const share = Math.floor(generated * 0.25);
        const ally = this.lowestAp(u);
        if (share > 0 && ally) this.gainAp(ally, share, events, "bond modifier", u);
      }
    this.perfectInitiative(u, grades.includes("perfect") && grades.every((g) => g === "perfect"), a);
    return events;
  }

  private perfectInitiative(u: Unit, perfect: boolean, a?: CompiledAction) {
    if (!perfect) return;
    if (u.kind === "quick") this.addInit(u, 0.1);
    if (a?.rider === "flex") this.addInit(u, 0.08);
    if (a) for (const m of a.modifiers) if (m.affinity === "flex") this.addInit(u, 0.1);
    if (this.keystone(u) === "flex") this.addInit(u, 0.08, true);
  }

  private addPattern(u: Unit, events: BattleEvent[]) {
    u.pattern++;
    events.push({ type: "reaction", unit: u.id, name: `Pattern ${u.pattern}/3` });
    if (u.pattern >= 3) {
      u.pattern = 0;
      u.patternFree = true;
      if (this.reactionOf(u, "full-parry")?.affinity === "knots") u.knotsDiscount = true;
    }
  }

  // ───────────────────────── foes ─────────────────────────

  planFoe(actorId: string): FoePlan {
    const actor = this.unit(actorId);
    const def = FOES[actor.kind as FoeKind];
    const wounded = this.living("foe")
      .filter((f) => f.id !== actor.id && f.hp < f.maxHp * 0.6)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    const options = def.attacks.filter((a) => (a.minPhase ?? 1) <= actor.phase + 1 && (!a.healAlly || wounded) && (!a.rage || !!actor.enraged));
    const attack = this.rng.weighted(options, options.map((a) => a.weight));
    if (attack.healAlly) return { actor: actor.id, attack, targets: [], healTarget: wounded!.id };
    const party = this.living("party");
    const targets = attack.target === "all" ? party.map((p) => p.id) : [this.rng.pick(party).id];
    return { actor: actor.id, attack, targets };
  }

  /**
   * Resolve a foe's attack given one defence per impact. An area attack's single defence covers every target.
   * Parry (perfect only): 0 damage, +1 AP, +10 Break to the attacker, Parry Reactions, and a counter at 65% Basic
   * potency (split across a multi-hit attack). Dodge: 0 damage. A missed Parry is a hit.
   */
  /** A Parry's counter: a strike back at the attacker (or, with a Reach Reaction, the weakest foe). */
  private counter(t: Unit, foe: Unit, blows: number, events: BattleEvent[]) {
    if (!t.alive) return;
    const anyEnemy = t.loom?.reactions.some((r) => r.executes && r.modifiers.some((m) => m.affinity === "reach"));
    const tgt = foe.alive && !anyEnemy ? foe : anyEnemy ? this.living("foe").sort((a, b) => a.hp - b.hp)[0] : undefined;
    if (!tgt) return;
    events.push({ type: "counter", source: t.id, target: tgt.id });
    this.strike(t, tgt, (t.power * RULES.counterPotency) / Math.max(1, blows), events, { grade: "perfect" });
  }

  resolveFoe(plan: FoePlan, defenses: Defense[]): BattleEvent[] {
    const foe = this.unit(plan.actor);
    const events: BattleEvent[] = [];
    this.turnNo++;
    if (plan.healTarget) {
      const t = this.unit(plan.healTarget);
      if (t.alive) {
        const amount = Math.round(Math.min(t.maxHp - t.hp, t.maxHp * (plan.attack.healAlly ?? 0)));
        t.hp += amount;
        events.push({ type: "heal", source: foe.id, target: t.id, amount });
      }
      return events;
    }
    const heroes = plan.targets.map((id) => this.unit(id));
    plan.attack.hits.forEach((hit, i) => {
      const d = defenses[i] ?? "hit";
      for (const t of heroes) {
        if (!t.alive) continue;
        events.push({ type: "defend", target: t.id, result: d, hit: i });
        if (d === "hit") {
          this.hurt(foe, t, foe.power * hit.power, events);
          if (hit.status && t.alive) this.applyStatus(foe, t, hit.status, events);
          continue;
        }
        if (isParry(d)) {
          this.stats.parries++;
          this.gainAp(t, RULES.parryAp, events, "parry");
          this.addBreak(t, foe, RULES.parryBreak * (t.kind === "iron" ? 1.2 : 1), events);
          if (t.kind === "bond") {
            const least = this.lowestAp();
            if (least) this.gainAp(least, 1, events, "bond root", t);
          }
          this.react(t, foe, "parry", d === "perfect-parry", events);
          if (d === "perfect-parry") {
            this.react(t, foe, "perfect-parry", true, events);
            if (this.keystone(t) === "flex") this.addInit(t, 0.08, true);
          }
          // Every perfect Parry answers its blow at once (split across a multi-hit attack's blows).
          this.counter(t, foe, plan.attack.hits.length, events);
        } else if (isDodge(d)) {
          this.react(t, foe, "dodge", d === "perfect-dodge", events);
          if (d === "perfect-dodge") this.react(t, foe, "perfect-dodge", true, events);
        }
      }
    });
    const n = plan.attack.hits.length;
    for (const t of heroes) {
      if (!t.alive || !n) continue;
      const allDefended = defenses.slice(0, n).every((d) => d !== "hit") && defenses.length >= n;
      const allParried = allDefended && defenses.slice(0, n).every(isParry);
      // Knots Modifier on a Reaction: a full defensive sequence stores a Pattern stack.
      if (allDefended && t.loom?.reactions.some((r) => r.executes && r.modifiers.some((m) => m.affinity === "knots"))) this.addPattern(t, events);
      if (allParried) {
        events.push({ type: "full-parry", target: t.id });
        this.react(t, foe, "full-parry", false, events);
      }
    }
    return events;
  }

  /** Run the executing Reaction for a trigger, plus its adjacent Modifiers' effects (§26–38). */
  private react(t: Unit, attacker: Unit, trigger: CompiledReaction["trigger"], perfect: boolean, events: BattleEvent[]) {
    const r = this.reactionOf(t, trigger);
    if (!r) return;
    events.push({ type: "reaction", unit: t.id, name: r.name });
    const p = r.nodePotency;
    switch (r.affinity) {
      case "burden":
        this.giveBarrier(t, t.maxHp * 0.1 * p, events);
        break;
      case "veil":
        if (attacker.alive) this.mark(attacker, 2, events);
        break;
      case "reach":
        t.farSight = true;
        break;
      case "knots":
        this.addPattern(t, events);
        break;
      case "flex":
        this.addInit(t, 0.15 * p);
        break;
      case "bond": {
        const ally = this.lowestAp();
        if (ally) {
          this.gainAp(ally, 1, events, "shared thread", t);
          if (perfect) this.heal(t, ally, ally.maxHp * 0.03 * p, events);
        }
        break;
      }
    }
    for (const m of r.modifiers) {
      if (m.affinity === "burden") this.giveBarrier(t, t.maxHp * 0.06, events);
      else if (m.affinity === "veil" && attacker.alive) this.mark(attacker, 1, events);
      else if (m.affinity === "bond") {
        const low = this.lowestHp();
        if (low) this.heal(t, low, low.maxHp * 0.04, events);
      } else if (m.affinity === "flex" && trigger === "perfect-parry" && this.rng.chance(0.2)) this.advance(t, events);
    }
  }

  private giveBarrier(t: Unit, amount: number, events: BattleEvent[]) {
    const a = Math.round(amount);
    if (a <= 0) return;
    t.barrier += a;
    events.push({ type: "barrier", target: t.id, amount: a });
  }
  private heal(src: Unit, t: Unit, amount: number, events: BattleEvent[]) {
    const a = Math.round(Math.min(t.maxHp - t.hp, amount));
    if (a <= 0) return;
    t.hp += a;
    events.push({ type: "heal", source: src.id, target: t.id, amount: a });
  }
  /** Move a unit one place earlier in the rest of this round. */
  private advance(t: Unit, events: BattleEvent[]) {
    const i = this.order.indexOf(t.id, this.cursor + 1);
    if (i > this.cursor + 1) {
      [this.order[i - 1], this.order[i]] = [this.order[i]!, this.order[i - 1]!];
      events.push({ type: "advance", unit: t.id });
    }
  }

  // ───────────────────────── after each action ─────────────────────────

  private settleInto(events: BattleEvent[]) {
    events.push(...this.settle());
  }

  /** Boss phases, reinforcements and the outcome. Call after every resolved action or reaction. */
  settle(): BattleEvent[] {
    const events: BattleEvent[] = [];
    for (const b of this.living("foe").filter((f) => f.tier === "boss")) {
      const phases = FOES[b.kind as FoeKind].phases ?? [];
      while (b.phase < phases.length && b.hp < b.maxHp * phases[b.phase]!.at) {
        const ph = phases[b.phase]!;
        b.phase++;
        const room = (this.setup.fieldCap ?? FIELD_CAP) - this.living("foe").length;
        const spawned = ph.summon.slice(0, Math.max(0, room)).map((k) => this.makeFoe(k));
        this.units.push(...spawned);
        if (spawned.length) events.push({ type: "summon", units: spawned.map((s) => s.id) });
      }
    }
    // A cornered foe turns desperate: below a third of its health it hits a fifth harder, once.
    for (const f of this.living("foe").filter((x) => !this.setup.calm && x.tier !== "boss" && !x.enraged && x.hp < x.maxHp * ENRAGE_AT)) {
      f.enraged = true;
      f.power *= ENRAGE_POWER;
      events.push({ type: "enrage", target: f.id });
      const mend = FOES[f.kind as FoeKind]?.mendOnRage;
      if (mend) {
        const amount = Math.round(Math.min(f.maxHp - f.hp, f.maxHp * mend));
        f.hp += amount;
        events.push({ type: "heal", source: f.id, target: f.id, amount });
      }
    }
    if (!this.living("party").length) {
      this.outcome = "defeat";
      this.reactions = [];
      events.push({ type: "outcome", outcome: "defeat" });
      return events;
    }
    const bosses = this.foes().filter((f) => f.tier === "boss");
    if (bosses.length && bosses.every((b) => !b.alive)) {
      for (const f of this.living("foe")) this.kill(f, events);
      this.reactions = [];
    }
    if (!this.living("foe").length && !this.reactions.length) {
      if (this.waveIndex + 1 < this.setup.waves.length) {
        // In a duel the next foe steps up only after the hero catches a breath, so a fight of several foes is a run of duels, not one long bleed.
        if (this.setup.fieldCap === 1)
          for (const u of this.living("party")) {
            const amount = Math.min(u.maxHp - u.hp, Math.round(u.maxHp * RULES.duelBreath));
            if (amount > 0) {
              u.hp += amount;
              events.push({ type: "heal", source: u.id, target: u.id, amount });
            }
          }
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
  partyHpAfter(): Record<RootId, number> {
    const out = {} as Record<RootId, number>;
    for (const u of this.party())
      out[u.kind as RootId] = u.alive ? Math.min(u.maxHp, Math.round(u.hp + u.maxHp * RULES.restFraction)) : Math.round(u.maxHp * RULES.reviveFraction);
    return out;
  }
}
