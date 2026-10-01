import { useEffect, useState } from "react";
import { HeroPrebake } from "../battle/HeroPrebake";
import { PARTY, ROOTS } from "@ender/battle";
import { heroFigure, lookFor, partyRoots, rootLabel } from "../../game/hero";
import { crossingBackdrop } from "../../art/registry";
import { paintedBackdrop, predecode } from "../../art/painted";
import { SceneBackdrop } from "../../art/SceneBackdrop";

/** Where each station's sign hangs on the painted square, in world (1080x1920) units. */
const PAINTED_STATIONS = [
  { id: "mirror", x: 250, y: 720 },
  { id: "crucible", x: 830, y: 720 },
  { id: "bazaar", x: 250, y: 990 },
  { id: "grimoire", x: 830, y: 990 },
  { id: "gate", x: 790, y: 1270 },
  { id: "loom", x: 330, y: 1520 },
] as const;
import { refreshLoom, setOut } from "../../game/flow";
import { setState, toast, useStore } from "../../state/store";
import { essenceColor, essenceGlyph } from "../../economy/format";
import { Head } from "../battle/Figure";
import { HeroHead } from "../battle/ArtHeads";
import { useWorldTop } from "../Stage";
import { Coach } from "../Coach";
import { finishTutorial } from "../../game/tutorial";
import { weaves } from "../loom/Weave";
import { startOver } from "../../game/reset";

/**
 * The hub opens up as you play: at first only the Gate and the Loom; the other stations appear as you weave,
 * each marked New until you visit it.
 */
function unlocked(id: string, mirrorCharges: number, n = weaves()) {
  if (id === "grimoire") return n >= 1;
  if (id === "bazaar") return n >= 2;
  if (id === "crucible") return n >= 3;
  if (id === "mirror") return mirrorCharges > 0 || n >= 5;
  return true;
}
const later = (ms: number, f: () => void) => window.setTimeout(f, ms);
const SEEN = "ender:stations-seen";
function seen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN) ?? "[]");
  } catch {
    return [];
  }
}
function markSeen(id: string) {
  try {
    localStorage.setItem(SEEN, JSON.stringify([...new Set([...seen(), id])]));
  } catch {
    /* private mode */
  }
}

/** Stations not yet announced. Each one rises in with a toast the first time it appears. */
const ANNOUNCED = "ender:stations-announced";
function announce(ids: string[]): string[] {
  try {
    const done: string[] = JSON.parse(localStorage.getItem(ANNOUNCED) ?? "[]");
    const fresh = ids.filter((id) => !done.includes(id));
    if (fresh.length) localStorage.setItem(ANNOUNCED, JSON.stringify([...done, ...fresh]));
    return fresh;
  } catch {
    return [];
  }
}

const LABEL: Record<string, { name: string; sub: string }> = {
  gate: { name: "The Gate", sub: "choose a Realm" },
  bazaar: { name: "Bazaar", sub: "Essences, Forms, contracts" },
  crucible: { name: "Crucible", sub: "refine your Forms" },
  mirror: { name: "Mirror", sub: "see a Form at work" },
  grimoire: { name: "Grimoire", sub: "every Form you have found" },
  loom: { name: "The Loom", sub: "weave your skills" },
};

/** The hub between Expeditions: painted stations you tap. */
export function Crossing() {
  const c = useStore((s) => s.character);
  const [resetArmed, setResetArmed] = useState(false);
  const worldTop = useWorldTop();
  /** Last prologue step: point at the Gate and keep the other stations quiet. */
  const lesson = useStore((s) => s.tutorial === "gate");
  const mod = crossingBackdrop();
  const Back = mod?.default;
  // The Gate's realm paintings (also the fight backdrops) decode while the player looks around here.
  useEffect(() => predecode(["ashen-vault", "glass-fen", "hollow-keep", "throne", "fen-lair"].map(paintedBackdrop)), []);
  // The painted square is a lane of lit doorways; each station hangs its sign on one of them.
  const painted = !!paintedBackdrop("crossing");
  const stations = (painted ? PAINTED_STATIONS : (mod?.STATIONS ?? [])) as readonly { id: string; x: number; y: number }[];
  const visited = seen();
  const all = stations.filter((st) => unlocked(st.id, c?.mirrorCharges ?? 0));
  // The Loom's sign on the square is left out: the Loom button in the bottom bar is the one way in.
  const shown = all.filter((st) => st.id !== "loom");
  const has = (id: string) => shown.some((st) => st.id === id);
  const [risen] = useState(() => (lesson ? [] : announce(shown.map((st) => st.id).filter((id) => id !== "gate" && id !== "loom"))));
  useEffect(() => {
    if (risen.length) {
      const names = risen.map((id) => LABEL[id]?.name ?? id);
      const text =
        risen.length === 1
          ? `${names[0]} has opened: ${LABEL[risen[0]!]?.sub ?? ""}`
          : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} have opened`;
      later(450, () => toast(text, "gain", true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Set out goes straight into the next Realm; the Gate on the square is where you pick a different one.
  const [going, setGoing] = useState(false);
  const go = async () => {
    if (going) return;
    if (lesson) finishTutorial();
    setGoing(true);
    try {
      await setOut();
    } catch (e) {
      toast((e as Error).message, "loss");
      setGoing(false);
    }
  };
  const open = (id: string) => {
    if (lesson) finishTutorial();
    markSeen(id);
    if (id === "gate") setState({ panel: "gate" });
    else if (id === "bazaar") setState({ panel: "bazaar" });
    else if (id === "crucible") setState({ panel: "crucible", crucibleMode: "craft" });
    else if (id === "mirror") setState({ panel: "crucible", crucibleMode: "mirror" });
    else if (id === "grimoire") setState({ panel: "grimoire" });
    else if (id === "loom") {
      setState({ screen: "loom", loomEditable: true });
      // The Loom opens on the copy already held; the fresh read waits until it's on screen, so the two never share a frame.
      requestAnimationFrame(() => setTimeout(() => refreshLoom().catch((e) => toast(e.message, "loss")), 0));
    }
  };
  return (
    <div className="crossing" data-testid="crossing">
      <div className="world" style={{ top: worldTop }}>
        <div className={`backdrop ${painted ? "hub-painted" : ""}`}>
          <SceneBackdrop id="crossing" Drawn={Back} />
          {painted && <HubAmbience />}
        </div>
        {shown.map((s) => (
          <button
            key={s.id}
            className={`station st-${s.id} ${risen.includes(s.id) ? "risen" : ""} ${lesson ? "muted" : ""} ${!lesson && s.id !== "gate" && s.id !== "loom" && !visited.includes(s.id) ? "fresh" : ""}`} style={{ left: s.x, top: s.y }} onClick={() => open(s.id)} data-testid={`station-${s.id}`}>
            {!lesson && s.id !== "gate" && s.id !== "loom" && !visited.includes(s.id) && <span className="st-new">New</span>}
            <span className="st-name">{LABEL[s.id]?.name ?? s.id}</span>
            <span className="st-sub">{LABEL[s.id]?.sub}</span>
          </button>
        ))}
      </div>
      <HeroPrebake />
      <header className="hub-top">
        {/* Back out of the game to hero select, where a new hero is made. Never on the way in. */}
        <button className="hub-back" onClick={() => setState({ screen: "title", panel: null })} aria-label="Heroes" data-testid="to-heroes">
          ‹
        </button>
        <div className="hub-name">
          <div className="hub-title">The Crossing</div>
          <div className="hub-sub">
            Loom Rank <b>{c?.rank ?? c?.level ?? 1}</b>
            {has("crucible") && <> · Focus {c?.focus ?? 0}</>}
          </div>
        </div>
        {/* Start over as a brand-new player. It erases everything, so the first tap only arms it. */}
        <button
          className={`hub-reset ${resetArmed ? "armed" : ""}`}
          onClick={() => {
            if (resetArmed) return startOver();
            setResetArmed(true);
            setTimeout(() => setResetArmed(false), 3000);
          }}
          data-testid="start-over"
        >
          {resetArmed ? "Tap again: erase all" : "Start over"}
        </button>
        {/* Counts appear with the places that use them: Essences with the Bazaar, Focus with the Crucible. */}
        <div className={`hub-ess ${has("bazaar") ? "" : "solo"}`}>
          <span className="hub-crowns" title="Crowns">
            ◈{c?.crowns ?? 0}
          </span>
          {has("bazaar") &&
            Object.entries(c?.essences ?? {}).map(([e, q]) => (
              <span key={e} style={{ color: essenceColor(e) }}>
                {essenceGlyph(e)}
                {q as number}
              </span>
            ))}
        </div>
      </header>
      {lesson && <Coach text="You're ready. Tap **Set out**. Every fight drops **Forms**, the pieces your skills are made of." style={{ bottom: 250 }} />}
      {/* The two things done most here, Set out and the Loom, sit in the bottom-right thumb zone. */}
      <div className="hub-party hub-bar">
        {partyRoots().map((r) => (
          <div key={r} className="hub-hero">
            {lookFor(r) ? <HeroHead size={92} /> : <Head figure={heroFigure(r)} size={92} />}
            <span>{rootLabel(r)}</span>
          </div>
        ))}
        <button className="big" onClick={() => open("loom")} data-testid="hub-loom">
          Loom
        </button>
        <button className={`big primary ${lesson ? "coach-pulse" : ""} ${going ? "going" : ""}`} onClick={go} data-testid="hub-gate">
          Set out
        </button>
      </div>
    </div>
  );
}

/** Window light that breathes, and embers drifting up the lane: the painted square, alive. Transform and opacity only. */
const GLOWS = [
  [150, 560, 260],
  [330, 1150, 230],
  [700, 660, 200],
  [930, 1150, 220],
  [560, 1290, 160],
] as const;
const MOTES = Array.from({ length: 16 }, (_, i) => ({ x: (i * 397) % 1000 + 40, delay: -((i * 1.7) % 11), dur: 9 + ((i * 13) % 7), size: 9 + ((i * 7) % 8) }));
function HubAmbience() {
  return (
    <div className="hub-amb" aria-hidden>
      {GLOWS.map(([x, y, r], i) => (
        <i key={`g${i}`} className="hub-glow" style={{ left: x - r, top: y - r, width: r * 2, height: r * 2, animationDelay: `${-i * 1.3}s` }} />
      ))}
      {MOTES.map((m, i) => (
        <i key={`m${i}`} className="hub-mote" style={{ left: m.x, width: m.size, height: m.size, animationDelay: `${m.delay}s`, animationDuration: `${m.dur}s` }} />
      ))}
    </div>
  );
}
