import { useEffect, useState } from "react";
import { api } from "../api";
import { savedStep, tutorialDone } from "../game/tutorial";
import { paintedBackdrop, paintedCard } from "../art/painted";
import { setState } from "../state/store";
import { Fig, Head } from "./battle/Figure";
import { sfx } from "./battle/sfx";
import { useWorldTop } from "./Stage";

/**
 * The first screen anyone sees. Behind the title a short reel loops: a fight (a timed strike, a parry,
 * a crafted skill), then a Loom being woven. The title and the button sit in darkened bands so they stay
 * legible over it. Sign-in is a placeholder: the button simply begins.
 */
export function Landing() {
  const worldTop = useWorldTop();
  const [hasSave, setHasSave] = useState(false);
  useEffect(() => {
    api
      .character()
      .then((c) => setHasSave(c.xp > 0 || c.crowns !== 250 || c.level > 1 || !!savedStep() || tutorialDone()))
      .catch(() => setHasSave(false));
  }, []);
  const begin = () => {
    sfx.unlock();
    let returning = hasSave;
    try {
      returning ||= !!localStorage.getItem("ender:hero");
    } catch {
      /* private mode */
    }
    // A returning player picks their hero; a new one goes straight into making one.
    setState({ screen: returning ? "title" : "create" });
  };
  const fightBg = paintedBackdrop("ashen-vault");
  return (
    <div className="landing" data-testid="landing">
      <div className="world" style={{ top: worldTop }}>
        <div className="reel reel-fight">
          {fightBg && <img className="reel-bg" src={fightBg} alt="" draggable={false} />}
          <div className="rf-foe" style={{ left: 760, top: 1330 }}>
            <div className="rf-foe-move">
              <Fig figure="wyrm" scale={2.3} />
            </div>
          </div>
          <div className="rf-hero" style={{ left: 290, top: 1580 }}>
            <div className="rf-hero-move">
              <Fig bake figure="binder" scale={2.05} />
            </div>
          </div>
          <div className="rf-ring" style={{ left: 770, top: 1000 }} />
          <div className="rf-slash" style={{ left: 770, top: 1000 }} />
          <div className="rf-burst" style={{ left: 770, top: 1000 }} />
          <div className="rf-parry" style={{ left: 330, top: 1250 }} />
          <div className="rf-pop rf-dmg1" style={{ left: 770, top: 780 }}>142</div>
          <div className="rf-pop rf-perfect" style={{ left: 770, top: 720 }}>
            Perfect!
            <small>214</small>
          </div>
          <div className="rf-pop rf-parried" style={{ left: 330, top: 960 }}>Parry</div>
          <div className="rf-pop rf-skill" style={{ left: 770, top: 700 }}>
            <small>Crush</small>
            286
          </div>
        </div>
        <div className="reel reel-loom">
          {fightBg && <img className="reel-bg loom-bg" src={fightBg} alt="" draggable={false} />}
          <LoomReel />
        </div>
      </div>
      <div className="landing-fade top" />
      <div className="landing-fade bottom" />
      <div className="title-card landing-card">
        <h1>ENDER</h1>
        <p className="tagline">You never earn a skill. You make one.</p>
      </div>
      <div className="title-actions landing-actions">
        <button className="big primary landing-signin" onClick={begin} data-testid="sign-in">
          Sign in with ChatGPT
        </button>
      </div>
    </div>
  );
}

/** Pointy-top hexes, as on the Loom: neighbours sit at ±√3·R across and 1.5·R up or down. */
const R = 160;
const DX = Math.sqrt(3) * R;
const CX = 540;
const CY = 1030;
const CELLS: [number, number][] = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0.5, -1],
  [-0.5, -1],
  [0.5, 1],
  [-0.5, 1],
];
const NODES: { at: number; art: string; glyph: string; name: string; n?: string; kind: "action" | "mod" | "react" }[] = [
  { at: 1, art: "burden", glyph: "▲", name: "Crush", n: "78", kind: "action" },
  { at: 3, art: "flex", glyph: "✦", name: "+Damage", kind: "mod" },
  { at: 5, art: "veil", glyph: "✧", name: "+Crits", kind: "mod" },
  { at: 4, art: "reach", glyph: "◆", name: "Riposte", kind: "react" },
];

function LoomReel() {
  const pos = (i: number) => {
    const [q, r] = CELLS[i]!;
    return { left: CX + q * DX, top: CY + r * 1.5 * R };
  };
  return (
    <>
      <div className="rl-glow" style={{ left: CX, top: CY }} />
      {CELLS.map((_, i) => (
        <div key={i} className="rl-cell" style={pos(i)} />
      ))}
      <div className="rl-hex rl-core" style={pos(0)}>
        <div className="rl-head">
          <Head figure="binder" size={160} />
        </div>
      </div>
      {NODES.map((nd, i) => {
        const art = paintedCard(nd.art);
        return (
          <div key={nd.name} className={`rl-node rl-n${i} ${nd.kind}`} style={pos(nd.at)}>
            <div className="rl-hex" style={art ? { backgroundImage: `url(${art})` } : undefined}>
              <span className="rl-glyph">{nd.glyph}</span>
              {nd.n && <span className="rl-num">{nd.n}</span>}
              <span className="rl-name">{nd.name}</span>
            </div>
          </div>
        );
      })}
      <div className="rl-result" style={{ left: CX, top: CY + 430 }}>
        <b>▲ Crush</b> 78 → <em>131 damage</em> ✦
      </div>
    </>
  );
}
