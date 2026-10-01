import { PARTY, ROOTS } from "@ender/battle";
import { heroFigure, lookFor, partyRoots, rootLabel } from "../../game/hero";
import { crossingBackdrop } from "../../art/registry";
import { refreshLoom } from "../../game/flow";
import { setState, toast, useStore } from "../../state/store";
import { essenceColor, essenceGlyph } from "../../economy/format";
import { Head } from "../battle/Figure";
import { useWorldTop } from "../Stage";
import { Coach } from "../Coach";
import { finishTutorial } from "../../game/tutorial";
import { weaves } from "../loom/Weave";

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

const LABEL: Record<string, { name: string; sub: string }> = {
  gate: { name: "The Gate", sub: "begin an Expedition" },
  bazaar: { name: "Bazaar", sub: "Essences, Forms, contracts" },
  crucible: { name: "Crucible", sub: "Attune · Inscribe · Temper" },
  mirror: { name: "Mirror", sub: "Witness a Trialed Form" },
  grimoire: { name: "Grimoire", sub: "every Form you have found" },
  loom: { name: "The Loom", sub: "weave your party's skills" },
};

/** The hub between Expeditions: painted stations you tap. */
export function Crossing() {
  const c = useStore((s) => s.character);
  const worldTop = useWorldTop();
  /** Last prologue step: point at the Gate and keep the other stations quiet. */
  const lesson = useStore((s) => s.tutorial === "gate");
  const mod = crossingBackdrop();
  const Back = mod?.default;
  const stations = (mod?.STATIONS ?? []) as readonly { id: string; x: number; y: number }[];
  const visited = seen();
  const shown = stations.filter((st) => unlocked(st.id, c?.mirrorCharges ?? 0));
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
      refreshLoom().catch((e) => toast(e.message, "loss"));
    }
  };
  return (
    <div className="crossing" data-testid="crossing">
      <div className="world" style={{ top: worldTop }}>
        <div className="backdrop">{Back && <Back className="backdrop-svg" />}</div>
        {shown.map((s) => (
          <button
            key={s.id}
            className={`station st-${s.id} ${lesson ? (s.id === "gate" ? "coach-pulse" : "muted") : ""} ${!lesson && s.id !== "gate" && s.id !== "loom" && !visited.includes(s.id) ? "fresh" : ""}`} style={{ left: s.x, top: s.y }} onClick={() => open(s.id)} data-testid={`station-${s.id}`}>
            {!lesson && s.id !== "gate" && s.id !== "loom" && !visited.includes(s.id) && <span className="st-new">New</span>}
            <span className="st-name">{LABEL[s.id]?.name ?? s.id}</span>
            <span className="st-sub">{LABEL[s.id]?.sub}</span>
          </button>
        ))}
      </div>
      <header className="hub-top">
        <div className="hub-name">
          <div className="hub-title">The Crossing</div>
          <div className="hub-sub">
            Loom Rank <b>{c?.rank ?? c?.level ?? 1}</b> · {c?.crowns ?? 0} Crowns · Focus {c?.focus ?? 0}
          </div>
        </div>
        <div className="hub-ess">
          {Object.entries(c?.essences ?? {}).map(([e, q]) => (
            <span key={e} style={{ color: essenceColor(e) }}>
              {essenceGlyph(e)}
              {q as number}
            </span>
          ))}
        </div>
      </header>
      {lesson && <Coach text="You're ready. Tap **Set out** to begin an Expedition. You can rework your Loom here, or at Shrines along the way." style={{ bottom: 250 }} />}
      {/* The two things done most here, Set out and the Loom, sit in the bottom-right thumb zone. */}
      <div className="hub-party hub-bar">
        {partyRoots().map((r) => (
          <div key={r} className="hub-hero">
            <Head figure={heroFigure(r)} size={92} look={lookFor(r)} />
            <span>{rootLabel(r)}</span>
          </div>
        ))}
        <button className="big" onClick={() => open("loom")} data-testid="hub-loom">
          Loom
        </button>
        <button className={`big primary ${lesson ? "coach-pulse" : ""}`} onClick={() => open("gate")} data-testid="hub-gate">
          Set out
        </button>
      </div>
    </div>
  );
}
