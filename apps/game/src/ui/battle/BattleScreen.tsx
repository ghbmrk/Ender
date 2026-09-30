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
import { backdropFor } from "../../art/registry";
import { STAGE_H, useStage, useWorldTop } from "../Stage";
import { AFF_COLOR, AFF_DEEP, AFF_GLYPH } from "../affinity";
import { Fig, Head, figureBox } from "./Figure";
import { BOSS_ADDS, BOSS_POS, FOE_POS, HERO_POS, PANEL_TOP } from "./layout";
import { sfx } from "./sfx";
import { debug } from "../../game/debug";

export type BattleResult = { outcome: "victory" | "defeat"; kills: Record<string, number>; partyHp: Record<RootId, number>; stats: Battle["stats"] };

/** Basic attack: one timed press. */
const BASIC_BEATS = [600];
/** How long a contracting ring takes to close on its marker. */
const RING_LEAD = 560;
const IMPACT_LEAD = 760;

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
};
type DefendSeq = { k: "defend"; plan: FoePlan; t0: number; impacts: number[]; tracker: DefenseTracker; shown: (Defense | null)[]; landed: boolean[] };
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

let uid = 0;
/** Sequence time in ms (debug ?speed= slows it down for screenshots). */
const elapsed = (s: { t0: number }) => (performance.now() - s.t0) / debug.timeScale;

export function BattleScreen({ setup, realmId, boss, title, onEnd }: { setup: BattleSetup; realmId: string; boss: boolean; title?: string; onEnd: (r: BattleResult) => void }) {
  const battle = useMemo(() => new Battle(setup), [setup]);
  const [, force] = useReducer((n: number) => n + 1, 0);
  const [phase, setPhase] = useState<Phase>({ k: "intro" });
  const [target, setTarget] = useState<string | null>(null);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [fx, setFx] = useState<Fx[]>([]);
  const [banner, setBanner] = useState<{ id: number; text: string; sub?: string } | null>(null);
  const [caption, setCaption] = useState<{ name: string; tell: string; foe: string } | null>(null);
  const [hurt, setHurt] = useState<Record<string, number>>({});
  const [clock, setClock] = useState(0);
  const seq = useRef<Seq | null>(null);
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
  const posOf = (u: Unit): [number, number] => {
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
  const figScale = (u: Unit) => (u.kind === "ironbound" ? 1.55 : u.kind === "cinder" ? 1.45 : undefined);

  // ───────────── feedback ─────────────
  const float = (u: Unit | [number, number], text: string, cls: string, delay = 0) => {
    const [x, y] = Array.isArray(u) ? u : chest(u);
    const id = ++uid;
    setFloaters((f) => [...f, { id, x: x + (Math.random() * 40 - 20), y, text, cls, delay }]);
    later(1400 + delay, () => setFloaters((f) => f.filter((q) => q.id !== id)));
  };
  const spawnFx = (kind: Fx["kind"], at: [number, number], color: string, delay = 0) => {
    const id = ++uid;
    setFx((f) => [...f, { id, kind, x: at[0], y: at[1], color, delay }]);
    later(900 + delay, () => setFx((f) => f.filter((q) => q.id !== id)));
  };
  const flinch = (id: string, delay = 0) =>
    later(delay, () => {
      setHurt((h) => ({ ...h, [id]: (h[id] ?? 0) + 1 }));
      later(320, () => setHurt((h) => ({ ...h, [id]: 0 })));
    });
  const showBanner = (text: string, sub?: string, ms = 1100) => {
    const id = ++uid;
    setBanner({ id, text, sub });
    later(ms, () => setBanner((b) => (b?.id === id ? null : b)));
  };

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
          float(t, "BROKEN", "broken", d);
          spawnFx("bloom", chest(t), "#ecc56a", d);
          later(d, sfx.brk);
          d += 160;
          break;
        }
        case "recover":
          float(battle.unit(e.target), "recovers", "fl-status", d);
          break;
        case "ko":
          later(d, sfx.ko);
          d += 120;
          break;
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
          later(d, () => showBanner(`Round ${e.round}`, undefined, 800));
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
    (outcome === "victory" ? sfx.victory : sfx.defeat)();
  };

  const advance = () => {
    if (battle.outcome !== "ongoing") return finish(battle.outcome);
    if (battle.reactions.length) return startDefend(battle.reactions.shift()!);
    const t = battle.nextTurn();
    const d = play(t.events);
    if (battle.outcome !== "ongoing") return later(d + 700, () => finish(battle.outcome as "victory" | "defeat"));
    const u = t.actor;
    if (t.skipped) {
      setPhase({ k: "wait" });
      return later(Math.max(700, d + 400), advance);
    }
    if (u.side === "party") {
      later(d, () => {
        sfx.turn();
        setTarget((cur) => (cur && battle.unit(cur).alive ? cur : (battle.living("foe").find((f) => f.tier === "boss") ?? battle.living("foe")[0])?.id ?? null));
        setPhase({ k: "command", actor: u.id });
      });
    } else {
      const plan = battle.planFoe(u.id);
      setPhase({ k: "wait" });
      later(d + 250, () => startDefend(plan));
    }
  };

  useEffect(() => {
    const names = battle.living("foe").map((f) => f.name);
    showBanner(title ?? (names.length > 2 ? `${names[0]} and ${names.length - 1} more` : names.join(" & ")), boss ? "a Boss bars the way" : undefined, 1300);
    later(1400, advance);
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
      setClock(t);
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
      t0: performance.now() + 250,
      weakMs,
      weakPts,
      weakHit: weak ? null : false,
      beatsAt: weakMs,
      beats,
      tracker: new AttackTracker(beats),
      pressed: [],
    };
    seq.current = s;
    setPhase({ k: "attack" });
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
    if (g === "perfect") spawnFx("bloom", chest(t), color);
    (g === "perfect" ? sfx.perfect : g === "good" ? sfx.good : sfx.miss)();
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
    later(d + 650, advance);
  };

  // ───────────── enemy attacks ─────────────
  const startDefend = (plan: FoePlan) => {
    const foe = battle.unit(plan.actor);
    setCaption({ name: plan.attack.name, tell: plan.attack.tell, foe: foe.name });
    if (plan.healTarget || !plan.attack.hits.length) {
      setPhase({ k: "wait" });
      sfx.telegraph();
      later(900, () => {
        const events = battle.resolveFoe(plan, []);
        events.push(...battle.settle());
        const d = play(events);
        later(d + 700, () => {
          setCaption(null);
          advance();
        });
      });
      return;
    }
    sfx.telegraph();
    const impacts = plan.attack.hits.map((h) => h.t);
    seq.current = { k: "defend", plan, t0: performance.now() + 150, impacts, tracker: new DefenseTracker(impacts), shown: impacts.map(() => null), landed: impacts.map(() => false) };
    setPhase({ k: "defend" });
  };

  const defendFeedback = (s: DefendSeq, i: number, r: Defense) => {
    s.shown[i] = r;
    const victim = battle.unit(s.plan.targets[0]!);
    if (r === "hit") return;
    float([chest(victim)[0] + 60, chest(victim)[1] - 120], DEF_LABEL[r], `def ${r}`);
    if (r.includes("parry")) {
      sfx.parry();
      spawnFx("spark", chest(victim), "#ecc56a");
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
    later(d + 600, () => {
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
    commit(actor, command);
  };

  // ───────────── render ─────────────
  const s = seq.current;
  const tl = battle.timeline();
  const active = phase.k === "command" || phase.k === "ally" ? battle.unit(phase.actor) : battle.current;
  const strikeHero = s?.k === "attack" && s.weakHit !== null && s.beats.some((b) => clock - s.beatsAt > b - 90 && clock - s.beatsAt < b + 160) ? s.actor : null;
  const lungingFoe = s?.k === "defend" && s.impacts.some((at) => clock > at - 140 && clock < at + 100) ? s.plan.actor : null;
  const bossUnit = battle.foes().find((f) => f.tier === "boss");

  return (
    <div className={`battle phase-${phase.k}`} onPointerDown={onStageDown} data-testid="battle" data-phase={phase.k}>
      <div className="world" style={{ top: worldTop }}>
      <div className="backdrop">{Backdrop && <Backdrop className="backdrop-svg" />}</div>

      {/* units: foes behind, heroes in front */}
      <div className="field">
        {[...battle.foes(), ...battle.party()]
          .filter((u) => u.alive || u.side === "party" || hurt[u.id] !== undefined)
          .sort((a, b) => posOf(a)[1] - posOf(b)[1])
          .map((u) => {
            const [x, y] = posOf(u);
            const isTarget = phase.k !== "end" && u.id === (s?.k === "attack" ? s.target : target) && u.side === "foe";
            const lunge = u.id === strikeHero || u.id === lungingFoe;
            return (
              <div
                key={u.id}
                className={`unit ${u.side} ${u.alive ? "" : "dead"} ${u.broken ? "is-broken" : ""} ${hurt[u.id] ? "hurt" : ""} ${lunge ? "lunge" : ""} ${active?.id === u.id ? "active" : ""} ${isTarget ? "targeted" : ""} ${phase.k === "ally" && u.side === "party" && u.id !== phase.actor ? "pickable" : ""}`}
                style={{ left: x, top: y, zIndex: Math.round(y) }}
                onPointerDown={(e) => {
                  if (seq.current) return;
                  e.stopPropagation();
                  if (u.side === "foe") tapFoe(u.id);
                  else tapHero(u.id);
                }}
                data-testid={`unit-${u.id}`}
              >
                <div className="shadow" />
                {isTarget && (
                  <div className="reticle">
                    <div />
                  </div>
                )}
                <div className="bob">
                  <Fig figure={u.figure} pose={u.id === strikeHero || u.id === lungingFoe ? "strike" : "idle"} scale={figScale(u)} className={`fig ${u.kind === "cinder" ? "tint-cinder" : u.kind === "ironbound" ? "tint-iron" : ""}`} />
                </div>
                {u.side === "foe" && u.tier !== "boss" && u.alive && <FoeTag u={u} h={figureBox(u.figure, figScale(u)).h} x={x} />}
                {u.side === "party" && <HeroTag u={u} />}
              </div>
            );
          })}
      </div>

      {/* paint: slashes, splats, sparks */}
      <svg className="fx-layer" viewBox="0 0 1080 1920">
        {fx.map((f) => (
          <FxMark key={f.id} f={f} />
        ))}
        {s?.k === "attack" && <AttackCues s={s} t={clock} at={chest(battle.unit(s.target))} />}
        {s?.k === "defend" && <DefendCues s={s} t={clock} chestOf={(id) => chest(battle.unit(id))} />}
      </svg>
      {s?.k === "attack" &&
        s.weakHit === null &&
        clock >= 0 &&
        s.weakPts.map((p, i) => <div key={i} className="weak-point" style={{ left: p.x - p.r, top: p.y - p.r, width: p.r * 2, height: p.r * 2 }} />)}

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
        <div className="banner" key={banner.id}>
          <div>{banner.text}</div>
          {banner.sub && <small>{banner.sub}</small>}
        </div>
      )}

      <Hint phase={phase} s={s} b={battle} top={PANEL_TOP + stageH - STAGE_H - 70} />

      <div className="bpanel" style={{ top: PANEL_TOP + stageH - STAGE_H }}>
        <PartyStrip b={battle} active={active?.side === "party" ? active.id : null} />
        {(phase.k === "command" || phase.k === "ally") && <Commands b={battle} actor={phase.actor} ally={phase.k === "ally"} onPick={chooseCommand} onCancel={() => setPhase({ k: "command", actor: phase.actor })} />}
        {phase.k === "defend" && s?.k === "defend" && (
          <div className="defense">
            <button className="def-btn dodge" onPointerDown={(e) => (e.stopPropagation(), pressDefend(s, elapsed(s), "dodge"))} data-testid="dodge">
              <span className="def-glyph">⤺</span>
              DODGE
              <small>forgiving</small>
            </button>
            <div className="impacts">
              {s.impacts.map((_, i) => {
                const r = s.tracker.resultAt(i);
                return <span key={i} className={`pip ${r ?? ""}`} />;
              })}
            </div>
            <button className="def-btn parry" onPointerDown={(e) => (e.stopPropagation(), pressDefend(s, elapsed(s), "parry"))} data-testid="parry">
              <span className="def-glyph">⚔</span>
              PARRY
              <small>tight · +1 AP · Break</small>
            </button>
          </div>
        )}
        {phase.k === "attack" && <div className="tap-anywhere">{s?.k === "attack" && s.weakHit === null ? "Tap a weak point!" : "Tap anywhere as the ring meets the mark"}</div>}
      </div>

      {phase.k === "end" && (
        <div className={`battle-end ${phase.outcome}`} data-testid="battle-end">
          <h1>{phase.outcome === "victory" ? "Victory" : "The party falls"}</h1>
          <div className="end-stats">
            <span>Break dealt {Math.round(battle.stats.breakDealt)}</span>
            <span>Parries {battle.stats.parries}</span>
            <span>Perfects {battle.stats.perfects}</span>
            <span>AP shared {battle.stats.apTransferred + battle.stats.apRefunded}</span>
          </div>
          <button className="big" onPointerDown={(e) => e.stopPropagation()} onClick={() => onEnd({ outcome: phase.outcome, kills: battle.kills, partyHp: battle.partyHpAfter(), stats: battle.stats })} data-testid="battle-continue">
            Continue
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

function FoeTag({ u, h, x }: { u: Unit; h: number; x: number }) {
  // Keep the tag on screen near the edges.
  const left = Math.max(10, Math.min(1070 - 260, x - 130)) - x;
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
        <Head figure={u.figure} size={i === 0 && !soon ? 96 : 72} />
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
          <Head figure={u.figure} size={86} />
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

function Commands({ b, actor, ally, onPick, onCancel }: { b: Battle; actor: string; ally: boolean; onPick: (actor: string, cmd: string) => void; onCancel: () => void }) {
  const u = b.unit(actor);
  const actions = b.actionsOf(actor);
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
    <div className="cards" data-testid="commands">
      <button className="card basic" onPointerDown={(e) => e.stopPropagation()} onClick={() => onPick(actor, "basic")} data-testid="cmd-basic">
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
            className={`card ${can ? "" : "poor"}`}
            style={{ ["--aff" as string]: AFF_COLOR[a.dominant], ["--aff-deep" as string]: AFF_DEEP[a.dominant] }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => can && onPick(actor, a.nodeId)}
            data-testid={`cmd-${a.template}`}
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
      {actions.length === 0 && <div className="card empty">No Actions woven. Inscribe a Form as an Action and place it on this Loom.</div>}
    </div>
  );
}

function Hint({ phase, s, b, top }: { phase: Phase; s: Seq | null; b: Battle; top: number }) {
  let text = "";
  if (phase.k === "command") {
    const u = b.unit(phase.actor);
    const acts = b.actionsOf(phase.actor);
    const cheapest = Math.min(...acts.map((a) => b.costOf(phase.actor, a.nodeId)));
    text = acts.length && u.ap < cheapest ? "Basic builds AP. Your crafted Actions spend it." : "Tap a foe to target, then a command.";
  } else if (phase.k === "defend" && s?.k === "defend") text = s.impacts.length > 1 ? `${s.impacts.length} blows: defend each one` : "Dodge is forgiving. Parry is tight but earns AP.";
  if (!text) return null;
  return (
    <div className="hint" style={{ top }}>
      {text}
    </div>
  );
}

function AttackCues({ s, t, at: [cx, cy] }: { s: AttackSeq; t: number; at: [number, number] }) {
  if (s.weakHit === null) {
    const left = Math.max(0, 1 - t / s.weakMs);
    return (
      <g>
        <rect x="140" y="1340" width={800 * left} height="10" rx="5" fill="#86c6f2" opacity="0.8" />
      </g>
    );
  }
  const bt = t - s.beatsAt;
  const res = s.tracker.result();
  // All cues centre on the target's marker.
  return (
    <g className="cues">
      {s.beats.map((beat, i) => {
        const graded = s.pressed.length > i;
        if (graded || res[i] !== "miss") return null;
        const dt = beat - bt;
        if (dt > RING_LEAD || dt < -RULES.timing.good) return null;
        const r = 64 + Math.max(0, dt / RING_LEAD) * 250;
        return (
          <g key={i} data-cue="ring">
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#efe3c8" strokeWidth={10} opacity={0.35 + 0.65 * (1 - Math.max(0, dt) / RING_LEAD)} filter="url(#wc)" />
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={64} fill="none" stroke="#1d1822" strokeWidth={14} />
      <circle cx={cx} cy={cy} r={64} fill="none" stroke="#ecc56a" strokeWidth={4} strokeDasharray="10 8" />
    </g>
  );
}

function DefendCues({ s, t, chestOf }: { s: DefendSeq; t: number; chestOf: (id: string) => [number, number] }) {
  const [x, y] = chestOf(s.plan.targets[0]!);
  return (
    <g className="cues">
      {s.impacts.map((at, i) => {
        const dt = at - t;
        if (dt > IMPACT_LEAD || dt < -120 || s.tracker.resultAt(i)) return null;
        const r = 70 + Math.max(0, dt / IMPACT_LEAD) * 260;
        return <circle key={i} cx={x} cy={y} r={r} fill="none" stroke="#c8505a" strokeWidth={12} opacity={0.3 + 0.7 * (1 - Math.max(0, dt) / IMPACT_LEAD)} />;
      })}
      <circle cx={x} cy={y} r={70} fill="none" stroke="#1d1822" strokeWidth={10} opacity={0.8} />
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

export const FOE_NAME = (k: string) => FOES[k as FoeKind]?.name ?? k;
