import { PARTY, ROOTS } from "@ender/battle";
import { lookFor, partyRoots, rootLabel } from "../../game/hero";
import { crossingBackdrop } from "../../art/registry";
import { refreshLoom } from "../../game/flow";
import { setState, toast, useStore } from "../../state/store";
import { essenceColor, essenceGlyph } from "../../economy/format";
import { Head } from "../battle/Figure";
import { useWorldTop } from "../Stage";
import { Coach } from "../Coach";
import { finishTutorial } from "../../game/tutorial";

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
  const open = (id: string) => {
    if (lesson) finishTutorial();
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
        {stations.map((s) => (
          <button key={s.id} className={`station st-${s.id} ${lesson ? (s.id === "gate" ? "coach-pulse" : "muted") : ""}`} style={{ left: s.x, top: s.y }} onClick={() => open(s.id)} data-testid={`station-${s.id}`}>
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
      {lesson && <Coach text="You're ready. Tap **The Gate** to set out on an Expedition. You can rework your Loom here, or at Shrines along the way." style={{ bottom: 250 }} />}
      <div className="hub-party">
        {partyRoots().map((r) => (
          <div key={r} className="hub-hero">
            <Head figure={ROOTS[r].hero} size={92} look={lookFor(r)} />
            <span>{rootLabel(r)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
