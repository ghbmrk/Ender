import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  AttackTracker,
  Battle,
  DefenseTracker,
  FOES,
  RULES,
  STATUS_NAMES,
  TEMPLATES,
  WEAKPOINT_MIN_PX,
  type BattleEvent,
  type BattleSetup,
  type CompiledAction,
  type Defense,
  type FoeKind,
  type FoePlan,
  type Grade,
  type RootId,
  type Unit,
} from "@ender/battle";
import { backdropFor, backdropId } from "../../art/registry";
import { SceneBackdrop } from "../../art/SceneBackdrop";
import { STAGE_H, useStage, useWorldTop } from "../Stage";
import { AFF_COLOR, AFF_DEEP, AFF_GLYPH } from "../affinity";
import { FIG_SCALE, Fig, Head, figureBox } from "./Figure";
import { BOSS_ADDS, BOSS_POS, DUEL_HERO_SHARE, FOE_POS, HERO_POS, PANEL_TOP, duelLayout } from "./layout";
import { sfx } from "./sfx";
import { debug } from "../../game/debug";
import type { CoachKey, Lesson } from "../../game/tutorial";
import { Coach } from "../Coach";
import { lookFor } from "../../game/hero";

export type BattleResult = { outcome: "victory" | "defeat"; kills: Record<string, number>; partyHp: Record<RootId, number>; stats: Battle["stats"] };

/** Basic attack: one timed press. */
const BASIC_BEATS = [600];
/** How long a contracting ring takes to close on its marker. */
/** How long a timing ring takes to close on its mark. Always the same, so the rhythm is learnable. */
const RING_LEAD = 900;
const IMPACT_LEAD = 900;
/** Rings close from this radius to the mark's radius at a constant speed, then keep closing past it. */
const RING_FROM = 330;
const MARK_R = 70;
const RING_V = (RING_FROM - MARK_R) / RING_LEAD;
/** A ring's radius when `left` ms remain until its beat or impact (negative once past). */
const ringR = (left: number) => Math.max(14, MARK_R + RING_V * left);

type Floater = { id: number; x: number; y: number; text: string; cls: string; delay: number };
type Fx = { id: number; kind: "slash" | "splat" | "spark" | "bloom" | "whoosh"; x: number; y: number; color: string; delay: number };

type AttackSeq = {
  k: "attack";
  actor: string;
  command: string;
  action?: CompiledAction;
  target: string;
  ally?: string;
  t0: number;
  /** Weak-point window (Reach), in ms from t0; 0 when none. */
  weakMs: number;
  weakPts: { x: number; y: number; r: number }[];
  weakHit: boolean | null;
  /** When the timed beats begin (after the weak-point window). */
  beatsAt: number;
  beats: number[];
  tracker: AttackTracker;
  pressed: { t: number; grade: Grade }[];
  /** Slow-motion factor while a lesson teaches this input (1 = real time). */
  scale: number;
};
type DefendSeq = { k: "defend"; scale: number; plan: FoePlan; t0: number; impacts: number[]; tracker: DefenseTracker; shown: (Defense | null)[]; landed: boolean[] };
type Seq = AttackSeq | DefendSeq;

type Phase =
  | { k: "intro" }
  | { k: "command"; actor: string }
  | { k: "ally"; actor: string; command: string }
  | { k: "attack" }
  | { k: "defend" }
  | { k: "wait" }
  | { k: "end"; outcome: "victory" | "defeat" };

const RIDER_SHORT: Record<string, string> = {
  burden: "+15 Break, +1 AP",
  veil: "+15% crit vs debuffed",
  reach: "weak point",
  knots: "+20% on a condition",
  flex: "Perfect: act sooner",
  bond: "+1 AP to an ally",
};
const DEF_LABEL: Record<Defense, string> = { "perfect-parry": "PERFECT PARRY", parry: "PARRY", "perfect-dodge": "PERFECT DODGE", dodge: "DODGE", hit: "HIT" };
const STATUS_GLYPH: Record<string, string> = { marked: "◎", slow: "≋", fracture: "⟋", burn: "♨", poison: "☠" };

type CamKick = "shake" | "big" | "punch" | "finale";
const CAM_MS: Record<CamKick, number> = { shake: 200, big: 320, punch: 260, finale: 1000 };

let uid = 0;
/** Sequence time in ms (debug ?speed= slows it down for screenshots). */
const elapsed = (s: { t0: number; scale: number }) => (performance.now() - s.t0) / (debug.timeScale * s.scale);

export function BattleScreen({
  setup,
  realmId,
  boss,
  title,
  lesson,
  onSkip,
  onEnd,
}: {
  setup: BattleSetup;
  realmId: string;
  boss: boolean;
  title?: string;
  /** A prologue lesson: limits the commands and defences shown and coaches the player through them. */
  lesson?: Lesson;
  onSkip?: () => void;
  onEnd: (r: BattleResult) => void;
}) {
  const battle = useMemo(() => new Battle(setup), [setup]);
  const [, force] = useReducer((n: number) => n + 1, 0);
  const [phase, setPhase] = useState<Phase>({ k: "intro" });
  const [target, setTarget] = useState<string | null>(null);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [fx, setFx] = useState<Fx[]>([]);
  const [banner, setBanner] = useState<{ id: number; text: string; sub?: string; ms: number; lore?: string } | null>(null);
  const [caption, setCaption] = useState<{ name: string; tell: string; foe: string } | null>(null);
  const [hurt, setHurt] = useState<Record<string, number>>({});
  const [clock, setClock] = useState(0);
  /** Clean timings in a row (strikes and defences alike); a miss or a hit taken resets it. Pure feedback. */
  const [streak, setStreak] = useState(0);
  const best = useRef(0);
  const bumpStreak = (clean: boolean) =>
    setStreak((n) => {
      const next = clean ? n + 1 : 0;
      best.current = Math.max(best.current, next);
      return next;
    });
  const lastPose = useRef("");
  const seq = useRef<Seq | null>(null);
  const [coach, setCoach] = useState<{ key: CoachKey; text: string } | null>(null);
  const said = useRef(new Set<CoachKey>());
  const slowLeft = useRef(lesson?.slow ?? 0);
  /** Coach the player once per moment (lessons only). */
  const say = (key: CoachKey) => {
    const text = lesson?.coach[key];
    if (!text || said.current.has(key)) return;
    said.current.add(key);
    setCoach({ key, text });
  };
  const slowScale = () => (slowLeft.current > 0 ? (slowLeft.current--, 2.2) : 1);
  const slots = useRef<Record<string, [number, number]>>({});
  const timers = useRef<number[]>([]);
  const { toStage, h: stageH } = useStage();
  const worldTop = useWorldTop();
  const Backdrop = backdropFor(realmId, boss)?.default;

  const later = useCallback((ms: number, f: () => void) => {
    timers.current.push(window.setTimeout(f, ms));
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // ───────────── positions ─────────────
  /** One hero against one foe at a time: stage them close and large. */
  const duel = battle.party().length === 1 && (setup.fieldCap ?? 5) === 1;
  const arena = duelLayout(worldTop, PANEL_TOP + stageH - STAGE_H - worldTop, battle.foes().some((f) => f.tier === "boss"));
  const posOf = (u: Unit): [number, number] => {
    if (duel) return u.side === "party" ? arena.hero : arena.foe;
    if (u.side === "party") return HERO_POS[u.kind as RootId];
    const s = slots.current;
    if (!s[u.id]) {
      const taken = new Set(Object.entries(s).filter(([id]) => battle.units.find((x) => x.id === id)?.alive).map(([, p]) => p.join(",")));
      const hasBoss = battle.foes().some((f) => f.tier === "boss");
      const pool = u.tier === "boss" ? [BOSS_POS] : hasBoss ? BOSS_ADDS : FOE_POS;
      s[u.id] = pool.find((p) => !taken.has(p.join(","))) ?? pool[0]!;
    }
    return s[u.id]!;
  };
  const chest = (u: Unit): [number, number] => {
    const [x, y] = posOf(u);
    const b = figureBox(u.figure, figScale(u));
    return [x + (u.side === "party" ? 10 : -10), y - b.h * 0.55];
  };
  const hitBox = (u: Unit) => {
    const b = figureBox(u.figure, figScale(u));
    const w = Math.min(b.w, duel ? 420 : 260);
    return { left: -w / 2, top: -b.h * 0.9, width: w, height: b.h * 0.9 };
  };
  const figScale = (u: Unit) => {
    const base = u.kind === "ironbound" ? 1.55 : u.kind === "cinder" ? 1.45 : (FIG_SCALE[u.figure] ?? 1.2);
    if (!duel) return u.kind === "ironbound" || u.kind === "cinder" ? base : undefined;
    // The hero stands half the arena tall; the foe matches that zoom unless it would crowd the turn bar.
    const hero = battle.party()[0]!;
    const heroBase = FIG_SCALE[hero.figure] ?? 1.2;
    const zoom = Math.max(1.5, Math.min(2.8, (DUEL_HERO_SHARE * arena.h) / figureBox(hero.figure, heroBase).feetY));
    if (u.side === "party") return base * zoom;
    const room = arena.foe[1] - arena.top - (u.tier === "boss" ? 20 : 120);
    return Math.min(base * zoom, room / figureBox(u.figure, 1).feetY);
  };

  // ───────────── feedback ─────────────
  const float = (u: Unit | [number, number], text: string, cls: string, delay = 0) => {
    const [x, y] = Array.isArray(u) ? u : chest(u);
    const id = ++uid;
    setFloaters((f) => [...f, { id, x: x + (Math.random() * 40 - 20), y, text, cls, delay }]);
    later(1000 + delay, () => setFloaters((f) => f.filter((q) => q.id !== id)));
  };
  const spawnFx = (kind: Fx["kind"], at: [number, number], color: string, delay = 0) => {
    const id = ++uid;
    setFx((f) => [...f, { id, kind, x: at[0], y: at[1], color, delay }]);
    later(600 + delay, () => setFx((f) => f.filter((q) => q.id !== id)));
  };
  const flinch = (id: string, delay = 0) =>
    later(delay, () => {
      setHurt((h) => ({ ...h, [id]: (h[id] ?? 0) + 1 }));
      later(260, () => setHurt((h) => ({ ...h, [id]: 0 })));
    });
  const showBanner = (text: string, sub?: string, ms = 900, lore?: string) => {
    const id = ++uid;
    setBanner({ id, text, sub, ms, lore });
    later(ms, () => setBanner((b) => (b?.id === id ? null : b)));
  };

  /** Camera kicks: a small shake on every blow, a big one on heavy hits, a punch-in toward Perfects. */
  const camN = useRef(0);
  const [finale, setFinale] = useState(0);
  /** Units whose knock-out has played. A unit only falls when its KO lands, not when the turn resolves. */
  const [downed, setDowned] = useState<Record<string, true>>({});
  const [cam, setCam] = useState<{ k: CamKick; n: number; at: [number, number] } | null>(null);
  const kick = (k: CamKick, at: [number, number] = [540, 1100], delay = 0) =>
    later(delay, () => {
      const n = ++camN.current;
      setCam({ k, n, at });
      later(CAM_MS[k], () => setCam((c) => (c?.n === n ? null : c)));
    });
  const [flash, setFlash] = useState<{ id: number; at: [number, number]; color: string } | null>(null);
  const flashAt = (at: [number, number], color: string, delay = 0) =>
    later(delay, () => {
      const id = ++uid;
      setFlash({ id, at, color });
      later(220, () => setFlash((f) => (f?.id === id ? null : f)));
    });

  /** Turn engine events into numbers, words and paint. */
  const play = (events: BattleEvent[]) => {
    let d = 0;
    for (const e of events) {
      switch (e.type) {
        case "damage": {
          const t = battle.unit(e.target);
          const txt = `${e.amount}${e.crit ? "!" : ""}`;
          float(t, txt, `dmg ${t.side} ${e.crit ? "crit" : ""} ${e.weakPoint ? "weak" : ""} ${e.dot ?? ""}`, d);
          if (e.absorbed) float(t, `⛨ ${e.absorbed}`, "barrier", d + 60);
          if (!e.dot) {
            spawnFx("splat", chest(t), t.side === "foe" ? "#1d1822" : "#6b1a28", d);
            flinch(t.id, d);
            kick(e.crit || e.amount >= 60 ? "big" : "shake", chest(t), d);
          }
          later(d, () => (e.amount >= 60 ? sfx.heavy() : t.side === "party" ? sfx.hurt() : sfx.hit()));
          d += 110;
          break;
        }
        case "heal":
          float(battle.unit(e.target), `+${e.amount}`, "heal", d);
          d += 80;
          break;
        case "barrier":
          float(battle.unit(e.target), `⛨ +${e.amount}`, "barrier", d);
          d += 80;
          break;
        case "ap":
          if (e.delta > 0 && e.reason !== "turn") {
            float(battle.unit(e.unit), `+${e.delta} AP`, "ap", d);
            later(d, sfx.ap);
            d += 60;
          }
          break;
        case "break": {
          const t = battle.unit(e.target);
          later(d + 200, () => say("broken"));
          float(t, "BROKEN", "broken", d);
          spawnFx("bloom", chest(t), "#ecc56a", d);
          flashAt(chest(t), "#ecc56a", d);
          kick("big", chest(t), d);
          later(d, sfx.brk);
          d += 160;
          break;
        }
        case "recover":
          float(battle.unit(e.target), "recovers", "fl-status", d);
          break;
        case "ko": {
          later(d, sfx.ko);
          const u = battle.unit(e.target);
          later(d, () => setDowned((m) => ({ ...m, [u.id]: true })));
          if (u.side === "foe" && battle.outcome === "victory") {
            // The killing blow: the camera leans in on the fallen foe, the world drains of colour, then a white bloom.
            kick("finale", chest(u), d);
            later(d, () => setFinale(++uid));
            later(d + 80, sfx.finale);
            d += 900;
          } else d += 120;
          break;
        }
        case "full-parry":
          float(battle.unit(e.target), "FULL PARRY", "full", d);
          d += 120;
          break;
        case "counter":
          float(battle.unit(e.source), "Counter", "reaction", d);
          d += 100;
          break;
        case "reaction":
          float(battle.unit(e.unit), e.name, "reaction", d);
          d += 120;
          break;
        case "status":
          float(battle.unit(e.target), `${STATUS_GLYPH[e.status]} ${STATUS_NAMES[e.status]}`, `fl-status s-${e.status}`, d);
          d += 90;
          break;
        case "advance":
          float(battle.unit(e.unit), "Quickened", "reaction", d);
          break;
        case "summon":
          later(d, () => showBanner("Reinforcements", "the seals give way"));
          break;
        case "wave":
          later(d, () => showBanner(`Wave ${e.index + 1}`));
          break;
        case "round":
          later(d, () => showBanner(`Round ${e.round}`, undefined, 650));
          break;
        case "skip":
          float(battle.unit(e.unit), "Staggered", "fl-status", d);
          break;
        default:
          break;
      }
    }
    force();
    return d;
  };

  // ───────────── flow ─────────────
  const finish = (outcome: "victory" | "defeat") => {
    seq.current = null;
    setCaption(null);
    setPhase({ k: "end", outcome });
    setCoach(null);
    (outcome === "victory" ? sfx.victory : sfx.defeat)();
  };

  const advance = () => {
    if (battle.outcome !== "ongoing") return finish(battle.outcome);
    if (battle.reactions.length) return startDefend(battle.reactions.shift()!);
    const t = battle.nextTurn();
    const d = play(t.events);
    if (battle.outcome !== "ongoing") return later(d + 450, () => finish(battle.outcome as "victory" | "defeat"));
    const u = t.actor;
    if (t.skipped) {
      setPhase({ k: "wait" });
      return later(Math.max(450, d + 250), advance);
    }
    if (u.side === "party") {
      later(d, () => {
        sfx.turn();
        setTarget((cur) => (cur && battle.unit(cur).alive ? cur : (battle.living("foe").find((f) => f.tier === "boss") ?? battle.living("foe")[0])?.id ?? null));
        setPhase({ k: "command", actor: u.id });
        if (lesson?.commands === "all") {
          const acts = battle.actionsOf(u.id);
          if (acts.some((a) => battle.costOf(u.id, a.nodeId) <= u.ap)) say("skill");
          else if (acts.length) say("ap");
        } else say("command");
      });
    } else {
      const plan = battle.planFoe(u.id);
      setPhase({ k: "wait" });
      later(d + 250, () => startDefend(plan));
    }
  };

  useEffect(() => {
    const foes = battle.living("foe");
    const names = foes.map((f) => f.name);
    // The first time you meet a kind of foe, its card holds a beat longer and says how it fights.
    const lead = foes.find((f) => f.tier === "boss") ?? foes[0];
    const lore = !lesson && lead && meetFoe(lead.kind) ? FOES[lead.kind as FoeKind]?.blurb.replace(/^Boss\.\s*/, "") : undefined;
    const sub = boss ? "a Boss bars the way" : lore ? "New foe" : undefined;
    showBanner(title ?? (names.length > 2 ? `${names[0]} and ${names.length - 1} more` : names.join(" & ")), sub, lore ? 1900 : 850, lore);
    later(lore ? 1750 : 800, advance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time clock during timed sequences.
  useEffect(() => {
    if (phase.k !== "attack" && phase.k !== "defend") return;
    let raf = 0;
    const loop = () => {
      const s = seq.current;
      if (!s) return;
      const t = elapsed(s);
      if (s.k === "attack") tickAttack(s, t);
      else tickDefend(s, t);
      // The rings draw themselves every frame (CueRings); React re-renders only when a pose changes.
      const key = poseKey(s, t);
      if (key !== lastPose.current) {
        lastPose.current = key;
        setClock(t);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.k]);

  // ───────────── hero attacks ─────────────
  const commit = (actor: string, command: string, ally?: string) => {
    const foe = target && battle.unit(target).alive ? target : battle.living("foe")[0]?.id;
    if (!foe) return;
    sfx.unlock();
    const action = command === "basic" ? undefined : battle.actionsOf(actor).find((a) => a.nodeId === command);
    const hero = battle.unit(actor);
    const weak = !!action?.weakPoint;
    const weakMs = weak ? RULES.weakPointMs + (hero.farSight ? 300 : 0) : 0;
    const beats = action ? TEMPLATES[action.template].beats : BASIC_BEATS;
    const t = battle.unit(foe);
    const [cx, cy] = chest(t);
    const b = figureBox(t.figure, figScale(t));
    const r = Math.max(WEAKPOINT_MIN_PX / 2, 56);
    const weakPts = weak
      ? [
          { x: cx + (Math.random() * 0.5 - 0.25) * b.w, y: cy - b.h * (0.15 + Math.random() * 0.15), r },
          { x: cx + (Math.random() * 0.5 - 0.25) * b.w, y: cy + b.h * (0.1 + Math.random() * 0.15), r },
        ]
      : [];
    const s: AttackSeq = {
      k: "attack",
      actor,
      command,
      action,
      target: foe,
      ally,
      t0: performance.now() + Math.max(150, weak ? 150 : RING_LEAD - (beats[0] ?? RING_LEAD)),
      weakMs,
      weakPts,
      weakHit: weak ? null : false,
      beatsAt: weakMs,
      beats,
      tracker: new AttackTracker(beats),
      pressed: [],
      scale: slowScale(),
    };
    seq.current = s;
    setPhase({ k: "attack" });
    say("attack");
  };

  const tickAttack = (s: AttackSeq, t: number) => {
    if (s.weakHit === null && t > s.weakMs) {
      s.weakHit = false;
      s.beatsAt = t;
    }
    if (s.weakHit === null) return;
    const bt = t - s.beatsAt;
    const lateBy = RULES.timing.good;
    for (const _ of s.tracker.expire(bt)) gradeFeedback(s, "miss");
    if (debug.autoplay) {
      const next = s.beats.findIndex((b, i) => s.tracker.result()[i] === "miss" && s.pressed.length <= i && bt >= b);
      if (next >= 0) pressAttack(s, t);
    }
    const last = s.beats.length ? s.beats[s.beats.length - 1]! + lateBy + 60 : 0;
    if ((s.tracker.done || bt > last) && seq.current === s) resolveAttack(s);
  };

  const gradeFeedback = (s: AttackSeq, g: Grade) => {
    const t = battle.unit(s.target);
    s.pressed.push({ t: performance.now(), grade: g });
    float([chest(t)[0], chest(t)[1] - 140], g === "perfect" ? "PERFECT" : g === "good" ? "GOOD" : "MISS", `grade ${g}`);
    const color = s.action ? AFF_COLOR[s.action.dominant] : "#efe3c8";
    spawnFx("slash", chest(t), color);
    if (g === "perfect") {
      spawnFx("bloom", chest(t), color);
      flashAt(chest(t), "#fff4dc");
      kick("punch", chest(t));
    }
    (g === "perfect" ? sfx.perfect : g === "good" ? sfx.good : sfx.miss)();
    bumpStreak(g !== "miss");
    say(g);
  };

  const pressAttack = (s: AttackSeq, t: number, at?: { x: number; y: number }) => {
    if (s.weakHit === null) {
      const hit = at ? s.weakPts.some((p) => Math.hypot(p.x - at.x, p.y - at.y) <= p.r + 12) : debug.autoplay;
      s.weakHit = hit;
      s.beatsAt = t;
      const tt = battle.unit(s.target);
      float([chest(tt)[0], chest(tt)[1] - 140], hit ? "WEAK POINT" : "GLANCING", `grade ${hit ? "perfect" : "miss"}`);
      (hit ? sfx.perfect : sfx.miss)();
      if (hit) spawnFx("bloom", at ? [at.x, at.y] : chest(tt), "#86c6f2");
      return;
    }
    const r = s.tracker.press(t - s.beatsAt);
    if (r) gradeFeedback(s, r.grade);
  };

  const resolveAttack = (s: AttackSeq) => {
    seq.current = null;
    setPhase({ k: "wait" });
    const events = battle.resolveHero({ actor: s.actor, command: s.command, target: s.target, ally: s.ally, grades: s.tracker.result(), weakPoint: !!s.weakHit });
    events.push(...battle.settle());
    const d = play(events);
    if (s.command === "basic" && lesson?.commands === "basic") later(d + 300, () => say("ap"));
    later(d + 320, advance);
  };

  // ───────────── enemy attacks ─────────────
  const startDefend = (plan: FoePlan) => {
    const foe = battle.unit(plan.actor);
    setCaption({ name: plan.attack.name, tell: plan.attack.tell, foe: foe.name });
    if (plan.healTarget || !plan.attack.hits.length) {
      setPhase({ k: "wait" });
      sfx.telegraph();
      later(600, () => {
        const events = battle.resolveFoe(plan, []);
        events.push(...battle.settle());
        const d = play(events);
        later(d + 380, () => {
          setCaption(null);
          advance();
        });
      });
      return;
    }
    sfx.telegraph();
    if (lesson?.defense === "none") {
      // First lesson: the foe's blows go wide, so the player only has to learn to strike.
      setPhase({ k: "wait" });
      later(800, () => {
        const victim = battle.unit(plan.targets[0]!);
        float([chest(victim)[0] + 60, chest(victim)[1] - 120], "MISSES", "def dodge");
        const events = battle.resolveFoe(plan, plan.attack.hits.map(() => "dodge"));
        events.push(...battle.settle());
        const d = play(events.filter((e) => e.type !== "defend"));
        later(d + 320, () => {
          setCaption(null);
          advance();
        });
      });
      return;
    }
    const impacts = plan.attack.hits.map((h) => h.t);
    seq.current = { k: "defend", scale: slowScale(), plan, t0: performance.now() + Math.max(150, IMPACT_LEAD - impacts[0]!), impacts, tracker: new DefenseTracker(impacts), shown: impacts.map(() => null), landed: impacts.map(() => false) };
    setPhase({ k: "defend" });
    say("defend");
  };

  const defendFeedback = (s: DefendSeq, i: number, r: Defense) => {
    s.shown[i] = r;
    const victim = battle.unit(s.plan.targets[0]!);
    say(r === "hit" ? "hit" : r.includes("parry") ? "parried" : "dodged");
    bumpStreak(r !== "hit");
    if (r === "hit") return;
    float([chest(victim)[0] + 60, chest(victim)[1] - 120], DEF_LABEL[r], `def ${r}`);
    if (r.includes("parry")) {
      sfx.parry();
      spawnFx("spark", chest(victim), "#ecc56a");
      flashAt(chest(victim), "#ecc56a");
      kick(r === "perfect-parry" ? "punch" : "shake", chest(victim));
    } else {
      sfx.dodge();
      spawnFx("whoosh", chest(victim), "#b3cbf5");
    }
  };

  const tickDefend = (s: DefendSeq, t: number) => {
    if (debug.autoplay) {
      const i = s.tracker.result().findIndex((_, j) => s.tracker.resultAt(j) === null);
      if (i >= 0 && t >= s.impacts[i]! - 20) pressDefend(s, t, "parry");
    }
    s.tracker.expire(t);
    s.impacts.forEach((at, i) => {
      const r = s.tracker.resultAt(i);
      if (r && s.shown[i] === null) defendFeedback(s, i, r);
      // The blow lands at the impact time (or when the mistimed input is spent, whichever is later).
      if (!s.landed[i] && t >= at && r === "hit") {
        s.landed[i] = true;
        for (const id of s.plan.targets) {
          flinch(id);
          spawnFx("splat", chest(battle.unit(id)), "#6b1a28");
        }
        kick("big", chest(battle.unit(s.plan.targets[0]!)));
        sfx.hurt();
      }
    });
    const last = s.impacts[s.impacts.length - 1]! + Math.max(RULES.dodge[1], RULES.parry[1]) + 80;
    if (s.tracker.done && t > last && seq.current === s) resolveDefend(s);
  };

  const pressDefend = (s: DefendSeq, t: number, kind: "parry" | "dodge") => {
    sfx.unlock();
    const r = s.tracker.press(t, kind);
    if (!r) return;
    if (r.result === "hit") float([chest(battle.unit(s.plan.targets[0]!))[0] + 60, chest(battle.unit(s.plan.targets[0]!))[1] - 120], kind === "parry" ? "TOO EARLY" : "MISTIMED", "def hit");
  };

  const resolveDefend = (s: DefendSeq) => {
    seq.current = null;
    setPhase({ k: "wait" });
    const events = battle.resolveFoe(s.plan, s.tracker.result());
    events.push(...battle.settle());
    const d = play(events.filter((e) => e.type !== "defend"));
    later(d + 320, () => {
      setCaption(null);
      advance();
    });
  };

  // ───────────── input ─────────────
  const onStageDown = (e: React.PointerEvent) => {
    const s = seq.current;
    if (!s || s.k !== "attack") return;
    const p = toStage(e.clientX, e.clientY);
    pressAttack(s, elapsed(s), { x: p.x, y: p.y - worldTop });
  };

  const tapHero = (id: string) => {
    if (phase.k === "ally" && id !== phase.actor && battle.unit(id).alive) commit(phase.actor, phase.command, id);
  };
  const tapFoe = (id: string) => {
    if ((phase.k === "command" || phase.k === "ally") && battle.unit(id).alive) {
      setTarget(id);
      sfx.tap();
    }
  };
  const chooseCommand = (actor: string, command: string) => {
    if (command !== "basic") {
      const a = battle.actionsOf(actor).find((x) => x.nodeId === command)!;
      if (battle.costOf(actor, command) > battle.unit(actor).ap) return;
      if (a.template === "link" && battle.living("party").length > 1) {
        sfx.tap();
        setPhase({ k: "ally", actor, command });
        return;
      }
    }
    // Alone, Link binds the hero to their own next Action.
    commit(actor, command, battle.living("party").length === 1 ? actor : undefined);
  };

  // ───────────── render ─────────────
  const s = seq.current;
  const tl = battle.timeline();
  const active = phase.k === "command" || phase.k === "ally" ? battle.unit(phase.actor) : battle.current;
  const strikeHero = s?.k === "attack" && s.weakHit !== null && s.beats.some((b) => clock - s.beatsAt > b - 90 && clock - s.beatsAt < b + 160) ? s.actor : null;
  const lungingFoe = s?.k === "defend" && s.impacts.some((at) => clock > at - 140 && clock < at + 100) ? s.plan.actor : null;
  // The foe draws back before each blow, so the timing reads in its body as well as the ring.
  const windingFoe = s?.k === "defend" && !lungingFoe && s.impacts.some((at) => clock > at - 520 && clock <= at - 140) ? s.plan.actor : null;
  /** In a duel a lunge closes most of the gap to the opponent. */
  const lungeVec = (u: Unit) => {
    if (!duel) return undefined;
    const [hx, hy] = arena.hero;
    const [fx_, fy] = arena.foe;
    const k = u.side === "party" ? 0.42 : -0.38;
    return { ["--lx" as string]: `${Math.round((fx_ - hx) * k)}px`, ["--ly" as string]: `${Math.round((fy - hy) * k)}px` };
  };
  const bossUnit = battle.foes().find((f) => f.tier === "boss");

  return (
    <div className={`battle phase-${phase.k} ${finale ? "finale" : ""}`} onPointerDown={onStageDown} data-testid="battle" data-phase={phase.k}>
      <div
        className="world"
        style={{ top: worldTop, transformOrigin: cam ? `${cam.at[0]}px ${cam.at[1]}px` : undefined, animation: cam ? `cam-${cam.k}-${cam.n % 2} ${CAM_MS[cam.k]}ms ease-out` : undefined }}
      >
      <div className="backdrop">
        <SceneBackdrop id={backdropId(realmId, boss)} Drawn={Backdrop} />
      </div>

      {/* units: foes behind, heroes in front */}
      <div className="field">
        {[...battle.foes(), ...battle.party()]
          .filter((u) => u.alive || u.side === "party" || hurt[u.id] !== undefined || !downed[u.id])
          .sort((a, b) => posOf(a)[1] - posOf(b)[1])
          .map((u) => {
            const [x, y] = posOf(u);
            const isTarget = phase.k !== "end" && u.id === (s?.k === "attack" ? s.target : target) && u.side === "foe";
            const lunge = u.id === strikeHero || u.id === lungingFoe;
            return (
              <div
                key={u.id}
                className={`unit ${u.side} ${u.alive || !downed[u.id] ? "" : "dead"} ${u.broken ? "is-broken" : ""} ${hurt[u.id] ? "hurt" : ""} ${lunge ? "lunge" : ""} ${u.id === windingFoe ? "windup" : ""} ${active?.id === u.id ? "active" : ""} ${isTarget ? "targeted" : ""} ${phase.k === "ally" && u.side === "party" && u.id !== phase.actor ? "pickable" : ""}`}
                style={{ left: x, top: y, zIndex: Math.round(y), ...lungeVec(u) }}
                onPointerDown={(e) => {
                  if (seq.current) return;
                  e.stopPropagation();
                  if (u.side === "foe") tapFoe(u.id);
                  else tapHero(u.id);
                }}
                data-testid={`unit-${u.id}`}
              >
                <div className="shadow" />
                <div className="hit" style={hitBox(u)} />
                {isTarget && (
                  <div className="reticle">
                    <div />
                  </div>
                )}
                <div className="bob">
                  <Fig look={u.side === "party" ? lookFor(u.kind) : undefined} figure={u.figure} pose={u.id === strikeHero || u.id === lungingFoe ? "strike" : "idle"} scale={figScale(u)} className={`fig ${u.kind === "cinder" ? "tint-cinder" : u.kind === "ironbound" ? "tint-iron" : ""}`} />
                </div>
                {u.side === "foe" && u.tier !== "boss" && u.alive && <FoeTag u={u} h={figureBox(u.figure, figScale(u)).h} x={x} />}
                {u.side === "party" && <HeroTag u={u} />}
              </div>
            );
          })}
      </div>

      {finale > 0 && <div key={`fin${finale}`} className="finale-bloom" />}
      {flash && <div key={flash.id} className="flash" style={{ left: flash.at[0], top: flash.at[1], ["--flash" as string]: flash.color }} />}

      {/* paint: slashes, splats, sparks */}
      <svg className="fx-layer" viewBox="0 0 1080 1920">
        {fx.map((f) => (
          <FxMark key={f.id} f={f} />
        ))}
        {s && <CueRings seq={seq} at={s.k === "attack" ? chest(battle.unit(s.target)) : chest(battle.unit(s.plan.targets[0]!))} />}
      </svg>
      {s?.k === "attack" &&
        s.weakHit === null &&
        clock >= 0 &&
        s.weakPts.map((p, i) => <div key={i} className="weak-point" style={{ left: p.x - p.r, top: p.y - p.r, width: p.r * 2, height: p.r * 2 }} />)}

      {streak >= 2 && (
        <div key={streak} className={`streak ${streak >= 5 ? "hot" : streak >= 3 ? "warm" : ""}`} data-testid="streak">
          <b>×{streak}</b>
          <span>{streak >= 5 ? "Unstoppable" : streak >= 3 ? "In the flow" : "Chain"}</span>
        </div>
      )}
      {floaters.map((f) => (
        <div key={f.id} className={`floater ${f.cls}`} style={{ left: f.x, top: f.y, animationDelay: `${f.delay}ms` }}>
          {f.text}
        </div>
      ))}

      </div>

      <Timeline b={battle} tl={tl} />
      {bossUnit && bossUnit.alive && <BossBar u={bossUnit} />}

      {caption && (
        <div className="tell" key={caption.name + caption.foe}>
          <div className="tell-name">{caption.name}</div>
          <div className="tell-sub">
            {caption.foe} {caption.tell}
          </div>
        </div>
      )}
      {banner && (
        <div className={`banner ${banner.lore ? "has-lore" : ""}`} key={banner.id} style={{ animationDuration: `${banner.ms}ms` }}>
          <div>{banner.text}</div>
          {banner.sub && <small>{banner.sub}</small>}
          {banner.lore && <p className="banner-lore">{banner.lore}</p>}
        </div>
      )}

      {lesson ? (
        coach && phase.k !== "end" && <Coach text={coach.text} key={coach.key} style={{ bottom: STAGE_H - PANEL_TOP + 24 }} />
      ) : (
        <Hint duel={duel} phase={phase} s={s} b={battle} top={PANEL_TOP + stageH - STAGE_H - 70} />
      )}
      {lesson && onSkip && phase.k === "command" && (
        <button className="skip-tutorial" onPointerDown={(e) => e.stopPropagation()} onClick={onSkip} data-testid="skip-tutorial">
          Skip tutorial
        </button>
      )}

      {/* One-thumb panel: everything pressed often sits in the right column, inside a right thumb's reach;
          the hero's status (and the incoming blows while defending) fill the left. */}
      <div className="bpanel thumb" style={{ top: PANEL_TOP + stageH - STAGE_H }}>
        <div className="bp-left">
          <PartyStrip b={battle} active={active?.side === "party" ? active.id : null} />
          {phase.k === "defend" && s?.k === "defend" && (
            <div className="impacts">
              {s.impacts.map((_, i) => {
                const r = s.tracker.resultAt(i);
                return <span key={i} className={`pip ${r ?? ""}`} />;
              })}
            </div>
          )}
        </div>
        <div className="bp-right">
          {/* Between turns the hero's cards stay in place, dimmed, so the panel never empties and the thumb knows where to go. */}
          {(phase.k === "wait" || phase.k === "intro") && battle.living("party")[0] && (
            <div className="cards-idle" aria-hidden>
              <Commands b={battle} actor={battle.living("party")[0]!.id} ally={false} basicOnly={lesson?.commands === "basic"} onPick={() => {}} onCancel={() => {}} idle />
            </div>
          )}
          {(phase.k === "command" || phase.k === "ally") && <Commands b={battle} actor={phase.actor} ally={phase.k === "ally"} basicOnly={lesson?.commands === "basic"} pulse={coach?.key === "command" ? "basic" : coach?.key === "skill" ? "actions" : null} onPick={chooseCommand} onCancel={() => setPhase({ k: "command", actor: phase.actor })} />}
          {phase.k === "defend" && s?.k === "defend" && (
            <div className="defense">
              <button className={`def-btn dodge ${lesson?.step === "dodge" && coach?.key === "defend" ? "coach-pulse" : ""}`} onPointerDown={(e) => (e.stopPropagation(), pressDefend(s, elapsed(s), "dodge"))} data-testid="dodge">
                <span className="def-glyph">⤺</span>
                DODGE
                <small>forgiving</small>
              </button>
              {lesson?.defense !== "dodge" && (
                <button className={`def-btn parry ${lesson?.step === "parry" && coach?.key === "defend" ? "coach-pulse" : ""}`} onPointerDown={(e) => (e.stopPropagation(), pressDefend(s, elapsed(s), "parry"))} data-testid="parry">
                  <span className="def-glyph">⚔</span>
                  PARRY
                  <small>tight · +1 AP · Break</small>
                </button>
              )}
            </div>
          )}
          {phase.k === "attack" && <div className="tap-anywhere">{s?.k === "attack" && s.weakHit === null ? "Tap a weak point!" : "Tap anywhere as the ring meets the mark"}</div>}
        </div>
      </div>

      {phase.k === "end" && (
        <div className={`battle-end ${phase.outcome}`} data-testid="battle-end">
          <h1>{phase.outcome === "victory" ? "Victory" : lesson ? "Not this time" : "Defeated"}</h1>
          <div className="end-stats">
            <span>
              <b>{Math.round(battle.stats.breakDealt)}</b>Break
            </span>
            <span>
              <b>{best.current}</b>Best chain
            </span>
            <span>
              <b>{battle.stats.perfects}</b>Perfects
            </span>
          </div>
          <button className={`big ${phase.outcome === "victory" ? "primary" : ""}`} onPointerDown={(e) => e.stopPropagation()} onClick={() => onEnd({ outcome: phase.outcome, kills: battle.kills, partyHp: battle.partyHpAfter(), stats: battle.stats })} data-testid="battle-continue">
            {lesson && phase.outcome === "defeat" ? "Try again" : "Continue"}
          </button>
        </div>
      )}
    </div>
  );
}

// ───────────── pieces ─────────────

function Bar({ v, max, cls }: { v: number; max: number; cls: string }) {
  return (
    <div className={`gbar ${cls}`}>
      <div style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%` }} />
    </div>
  );
}

function Statuses({ u }: { u: Unit }) {
  const on = (Object.keys(u.status) as (keyof Unit["status"])[]).filter((k) => {
    const v = u.status[k];
    return typeof v === "number" ? v > 0 : !!v;
  });
  if (!on.length && !u.barrier) return null;
  return (
    <div className="statuses">
      {u.barrier > 0 && <span className="st barrier">⛨{Math.round(u.barrier)}</span>}
      {on.map((k) => {
        const v = u.status[k];
        return (
          <span key={k} className={`st s-${k}`} title={STATUS_NAMES[k]}>
            {STATUS_GLYPH[k]}
            {typeof v === "number" ? v : v?.rounds}
          </span>
        );
      })}
    </div>
  );
}

/** Matches .foe-tag's width in frame.css, so tags near the edges stay on screen. */
const FOE_TAG_W = 300;

function FoeTag({ u, h, x }: { u: Unit; h: number; x: number }) {
  // Keep the tag on screen near the edges.
  const left = Math.max(10, Math.min(1070 - FOE_TAG_W, x - FOE_TAG_W / 2)) - x;
  return (
    <div className="foe-tag" style={{ top: -h - 34, left }}>
      <div className="foe-name">
        {u.name}
        {u.tier === "elite" && <span className="elite-mark">elite</span>}
      </div>
      <Bar v={u.hp} max={u.maxHp} cls="hp" />
      <Bar v={u.broken ? 100 : u.breakVal} max={100} cls={`brk ${u.broken ? "full" : ""}`} />
      <Statuses u={u} />
    </div>
  );
}

function HeroTag({ u }: { u: Unit }) {
  return (
    <div className="hero-tag">
      <Statuses u={u} />
    </div>
  );
}

function BossBar({ u }: { u: Unit }) {
  return (
    <div className="boss-bar" data-testid="boss-bar">
      <div className="boss-name">
        {u.name} <span className="boss-phase">{u.phase > 0 ? `seal ${u.phase + 1}` : ""}</span>
      </div>
      <Bar v={u.hp} max={u.maxHp} cls="hp boss" />
      <div className="row">
        <Bar v={u.broken ? 100 : u.breakVal} max={100} cls={`brk ${u.broken ? "full" : ""}`} />
        <Statuses u={u} />
      </div>
    </div>
  );
}

function Timeline({ b, tl }: { b: Battle; tl: { round: number; ids: string[] }[] }) {
  const [now, next] = tl;
  const cell = (id: string, i: number, soon: boolean) => {
    const u = b.unit(id);
    return (
      <div key={`${soon ? "n" : "c"}${i}-${id}`} className={`tl-cell ${u.side} ${i === 0 && !soon ? "now" : ""} ${u.broken ? "is-broken" : ""}`}>
        <Head look={u.side === "party" ? lookFor(u.kind) : undefined} figure={u.figure} size={i === 0 && !soon ? 96 : 72} />
      </div>
    );
  };
  return (
    <div className="timeline" data-testid="timeline">
      <div className="tl-round">R{now!.round}</div>
      {now!.ids.slice(0, 8).map((id, i) => cell(id, i, false))}
      <div className="tl-sep">R{next!.round}</div>
      {next!.ids.slice(0, Math.max(0, 9 - now!.ids.length)).map((id, i) => cell(id, i, true))}
    </div>
  );
}

function PartyStrip({ b, active }: { b: Battle; active: string | null }) {
  return (
    <div className="party-strip">
      {b.party().map((u) => (
        <div key={u.id} className={`ps ${active === u.id ? "active" : ""} ${u.alive ? "" : "down"}`} data-testid={`hero-${u.id}`}>
          <Head look={u.side === "party" ? lookFor(u.kind) : undefined} figure={u.figure} size={86} />
          <div className="ps-body">
            <div className="ps-name">
              {u.name}
              <span className="ps-hp">
                {Math.round(u.hp)}/{u.maxHp}
              </span>
            </div>
            <Bar v={u.hp} max={u.maxHp} cls="hp hero" />
            <div className="ap-pips" data-testid={`ap-${u.id}`}>
              {Array.from({ length: RULES.apMax }, (_, i) => (
                <span key={i} className={i < u.ap ? "on" : ""} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Commands({
  b,
  actor,
  ally,
  basicOnly,
  pulse,
  onPick,
  onCancel,
  idle,
}: {
  b: Battle;
  actor: string;
  ally: boolean;
  basicOnly?: boolean;
  pulse?: "basic" | "actions" | null;
  onPick: (actor: string, cmd: string) => void;
  onCancel: () => void;
  /** A dimmed, inert copy shown between turns. */
  idle?: boolean;
}) {
  const u = b.unit(actor);
  const actions = basicOnly ? [] : b.actionsOf(actor);
  if (ally)
    return (
      <div className="ally-pick">
        <div>Tap an ally to Link</div>
        <button onPointerDown={(e) => e.stopPropagation()} onClick={onCancel}>
          Back
        </button>
      </div>
    );
  return (
    <div className="cards" data-testid={idle ? undefined : "commands"}>
      <button className={`card basic ${pulse === "basic" ? "coach-pulse" : ""}`} onPointerDown={(e) => e.stopPropagation()} onClick={() => onPick(actor, "basic")} data-testid={idle ? undefined : "cmd-basic"}>
        <div className="card-top">
          <span className="card-name">Basic</span>
          <span className="card-ap gain">+2 AP</span>
        </div>
        <div className="card-line">{u.power} damage · timed</div>
        <div className="card-line dim">Builds AP for crafted Actions</div>
      </button>
      {actions.map((a) => {
        const cost = b.costOf(actor, a.nodeId);
        const can = cost <= u.ap;
        return (
          <button
            key={a.nodeId}
            className={`card ${can ? "" : "poor"} ${pulse === "actions" && can ? "coach-pulse" : ""}`}
            style={{ ["--aff" as string]: AFF_COLOR[a.dominant], ["--aff-deep" as string]: AFF_DEEP[a.dominant] }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => can && onPick(actor, a.nodeId)}
            data-testid={idle ? undefined : `cmd-${a.template}`}
          >
            <div className="card-top">
              <span className="card-name">
                <span className="glyph">{AFF_GLYPH[a.dominant]}</span> {a.name}
              </span>
              <span className={`card-ap ${cost < a.apCost ? "cheap" : ""}`}>{cost} AP</span>
            </div>
            <div className="card-line">
              {a.hits > 1 ? `${a.hits}×` : ""}
              {Math.round(a.damagePct)}% · Break {Math.round(a.breakTotal)}
              {a.weakPoint ? " · weak pt" : ""}
            </div>
            <div className="card-line dim">
              <span style={{ color: AFF_COLOR[a.rider] }}>{AFF_GLYPH[a.rider]}</span> {RIDER_SHORT[a.rider]}
              {a.modifiers.length > 0 && <span> · {a.modifiers.map((m) => AFF_GLYPH[m.affinity]).join("")} mod</span>}
            </div>
            <div className="card-form">{a.formName}</div>
          </button>
        );
      })}
      {actions.length === 0 && !basicOnly && <div className="card empty">No Actions woven. Inscribe a Form as an Action and place it on this Loom.</div>}
    </div>
  );
}

function Hint({ duel, phase, s, b, top }: { duel: boolean; phase: Phase; s: Seq | null; b: Battle; top: number }) {
  let text = "";
  if (phase.k === "command") {
    const u = b.unit(phase.actor);
    const acts = b.actionsOf(phase.actor);
    const cheapest = Math.min(...acts.map((a) => b.costOf(phase.actor, a.nodeId)));
    text = acts.length && u.ap < cheapest ? "Basic builds AP. Your crafted Actions spend it." : duel ? "" : "Tap a foe to target, then a command.";
  } else if (phase.k === "defend" && s?.k === "defend") text = s.impacts.length > 1 ? `${s.impacts.length} blows: defend each one` : "Dodge is forgiving. Parry is tight but earns AP.";
  if (!text) return null;
  return (
    <div className="hint" style={{ top }}>
      {text}
    </div>
  );
}

/** Which poses show at time t; the screen re-renders only when this changes. */
function poseKey(s: Seq, t: number) {
  if (s.k === "attack") {
    const bt = t - s.beatsAt;
    return `a${s.weakHit === null ? "w" : ""}${s.beats.some((b) => bt > b - 90 && bt < b + 160) ? "s" : ""}`;
  }
  const lunge = s.impacts.some((at) => t > at - 140 && t < at + 100);
  const wind = !lunge && s.impacts.some((at) => t > at - 520 && t <= at - 140);
  return `d${lunge ? "l" : ""}${wind ? "w" : ""}`;
}

/**
 * The timing rings, drawn straight to the SVG on every animation frame (no React re-render), so they close
 * smoothly at one constant speed. The mark shows the scoring window: the gold band is where a press counts,
 * the bright rim is Perfect (attacks) or Parry (defence), and the ring keeps closing past it so lateness shows.
 */
function CueRings({ seq, at: [cx, cy] }: { seq: React.MutableRefObject<Seq | null>; at: [number, number] }) {
  const g = useRef<SVGGElement>(null);
  const bar = useRef<SVGRectElement>(null);
  const kind = seq.current?.k;
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const s = seq.current;
      const rings = g.current ? (Array.from(g.current.querySelectorAll("circle.ring")) as SVGCircleElement[]) : [];
      let n = 0;
      const put = (left: number, fade: number) => {
        const c = rings[n++];
        if (!c) return;
        c.setAttribute("r", ringR(left).toFixed(1));
        c.setAttribute("opacity", fade.toFixed(2));
        c.style.display = "";
      };
      if (s) {
        const t = elapsed(s);
        if (s.k === "attack") {
          if (bar.current) bar.current.setAttribute("width", s.weakHit === null ? String(800 * Math.max(0, 1 - t / s.weakMs)) : "0");
          if (s.weakHit !== null) {
            const bt = t - s.beatsAt;
            const res = s.tracker.result();
            s.beats.forEach((beat, i) => {
              if (s.pressed.length > i || res[i] !== "miss") return;
              const left = beat - bt;
              if (left > RING_LEAD || left < -RULES.timing.good) return;
              put(left, Math.min(1, 0.4 + 0.6 * (1 - left / RING_LEAD)));
            });
          }
        } else {
          s.impacts.forEach((imp, i) => {
            const left = imp - t;
            if (left > IMPACT_LEAD || left < -140 || s.tracker.resultAt(i)) return;
            put(left, Math.min(1, 0.4 + 0.6 * (1 - left / IMPACT_LEAD)));
          });
        }
      }
      for (; n < rings.length; n++) rings[n]!.style.display = "none";
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [seq]);
  const attack = kind === "attack";
  // Scoring bands, as radii: a press counts while the ring is inside the outer band.
  const band = attack
    ? { outer: [ringR(RULES.timing.good), ringR(-RULES.timing.good)], inner: [ringR(RULES.timing.perfect), ringR(-RULES.timing.perfect)] }
    : { outer: [ringR(-RULES.dodge[0]), ringR(-RULES.dodge[1])], inner: [ringR(-RULES.parry[0]), ringR(-RULES.parry[1])] };
  const mid = (b: number[]) => (b[0]! + b[1]!) / 2;
  const wid = (b: number[]) => b[0]! - b[1]!;
  const color = attack ? "#efe3c8" : "#ff6b6b";
  return (
    <g className="cues">
      {attack && <rect ref={bar} x="140" y="1340" width="0" height="10" rx="5" fill="#86c6f2" opacity="0.8" />}
      <circle cx={cx} cy={cy} r={mid(band.outer)} fill="none" stroke={attack ? "#ecc56a" : "#86c6f2"} strokeWidth={wid(band.outer)} opacity={0.16} />
      <circle cx={cx} cy={cy} r={mid(band.inner)} fill="none" stroke="#ecc56a" strokeWidth={wid(band.inner)} opacity={0.3} />
      <circle cx={cx} cy={cy} r={MARK_R} fill="none" stroke="#1d1822" strokeWidth={12} opacity={0.85} />
      <circle cx={cx} cy={cy} r={MARK_R} fill="none" stroke="#ecc56a" strokeWidth={4} />
      <g ref={g}>
        {[0, 1, 2, 3].map((i) => (
          <circle key={i} className="ring" cx={cx} cy={cy} r={RING_FROM} fill="none" stroke={color} strokeWidth={10} style={{ display: "none" }} />
        ))}
      </g>
    </g>
  );
}

function FxMark({ f }: { f: Fx }) {
  const style = { animationDelay: `${f.delay}ms` };
  switch (f.kind) {
    case "slash":
      return <path className="fx slash" style={style} d={`M${f.x - 150} ${f.y - 110} C${f.x - 40} ${f.y - 40} ${f.x + 40} ${f.y + 10} ${f.x + 160} ${f.y + 100}`} stroke={f.color} strokeWidth={22} strokeLinecap="round" fill="none" filter="url(#wc)" />;
    case "splat":
      return (
        <g className="fx splat" style={{ ...style, transformOrigin: `${f.x}px ${f.y}px` }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <circle key={i} cx={f.x + Math.cos(i * 1.7) * (20 + i * 9)} cy={f.y + Math.sin(i * 2.3) * (16 + i * 7)} r={14 - i * 1.6} fill={f.color} opacity={0.85} />
          ))}
        </g>
      );
    case "spark":
      return (
        <g className="fx spark" style={{ ...style, transformOrigin: `${f.x}px ${f.y}px` }}>
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return <line key={i} x1={f.x + Math.cos(a) * 30} y1={f.y + Math.sin(a) * 30} x2={f.x + Math.cos(a) * 120} y2={f.y + Math.sin(a) * 120} stroke={f.color} strokeWidth={6} strokeLinecap="round" />;
          })}
          <circle cx={f.x} cy={f.y} r={34} fill="#fff4dc" />
        </g>
      );
    case "bloom":
      return <circle className="fx bloom" style={{ ...style, transformOrigin: `${f.x}px ${f.y}px` }} cx={f.x} cy={f.y} r={150} fill={f.color} filter="url(#wc-wash)" />;
    case "whoosh":
      return <path className="fx slash" style={style} d={`M${f.x - 120} ${f.y + 40} Q${f.x} ${f.y - 90} ${f.x + 140} ${f.y - 20}`} stroke={f.color} strokeWidth={14} strokeLinecap="round" fill="none" strokeDasharray="30 18" />;
  }
}

/** Records a meeting with a kind of foe; true the first time. */
function meetFoe(kind: string): boolean {
  try {
    const seen: string[] = JSON.parse(localStorage.getItem("ender:foes-seen") ?? "[]");
    if (seen.includes(kind)) return false;
    localStorage.setItem("ender:foes-seen", JSON.stringify([...seen, kind]));
    return true;
  } catch {
    return false;
  }
}

export const FOE_NAME = (k: string) => FOES[k as FoeKind]?.name ?? k;
