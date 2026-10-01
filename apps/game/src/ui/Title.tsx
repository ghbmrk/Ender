import { useEffect, useState } from "react";
import { api } from "../api";
import { continueGame } from "../game/flow";
import { goTo, savedStep, tutorialDone } from "../game/tutorial";
import { heroFigure } from "../game/hero";
import { setState, toast, useStore } from "../state/store";
import { crossingBackdrop } from "../art/registry";
import { SceneBackdrop } from "../art/SceneBackdrop";
import { Fig } from "./battle/Figure";
import { sfx } from "./battle/sfx";
import { useWorldTop } from "./Stage";

const SHOW_DEV = new URLSearchParams(location.search).has("dev");

export function Title() {
  const dev = useStore((s) => s.devMode);
  const me = useStore((s) => s.hero);
  const [hasSave, setHasSave] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api
      .character()
      .then((c) => setHasSave(c.xp > 0 || c.crowns !== 250 || c.level > 1 || !!savedStep() || tutorialDone()))
      .catch(() => setHasSave(false));
  }, []);
  const go = async (fn: () => Promise<void>) => {
    sfx.unlock();
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message, "loss");
      setBusy(false);
    }
  };
  /** Continue the save, picking the prologue back up where it was left. */
  const resume = async () => {
    await continueGame();
    const step = savedStep();
    if (step) goTo(step);
  };
  const toggleDev = () => {
    const v = !dev;
    try {
      localStorage.setItem("ender:dev", v ? "1" : "0");
    } catch {
      /* private mode */
    }
    setState({ devMode: v });
  };
  const Back = crossingBackdrop()?.default;
  const worldTop = useWorldTop();
  return (
    <div className="title-screen">
      <div className="world" style={{ top: worldTop }}>
      <div className="backdrop dimmed">
        <SceneBackdrop id="title" Drawn={Back} />
      </div>
      {me ? (
        <div className="title-party">
          <div style={{ position: "absolute", left: 540, top: 1360 }}>
            <Fig figure={heroFigure(me.root)} look={me.look} scale={1.9} />
          </div>
        </div>
      ) : (
      <div className="title-party">
        <div style={{ position: "absolute", left: 260, top: 1260 }}>
          <Fig figure="binder" scale={1.6} />
        </div>
        <div style={{ position: "absolute", left: 800, top: 1270 }}>
          <Fig figure="ranger" scale={1.6} className="flip" />
        </div>
        <div style={{ position: "absolute", left: 540, top: 1360 }}>
          <Fig figure="warden" scale={1.75} />
        </div>
      </div>
      )}
      </div>
      <div className="title-card">
        <h1>ENDER</h1>
        <p className="tagline">You never earn a skill. You make one.</p>
      </div>
      {/* Hero select: the saved hero to continue, or a new one. A new player never sees this screen first. */}
      <div className="title-actions">
        {me && <div className="title-hero-name">{me.name}</div>}
        {(hasSave || me) && (
          <button className="big primary" disabled={busy} onClick={() => go(resume)} data-testid="continue">
            Continue
          </button>
        )}
        <button className={`big ${hasSave || me ? "" : "primary"}`} disabled={busy} onClick={() => go(async () => setState({ screen: "create" }))} data-testid="new-hero">
          New hero
        </button>
        {/* Developer provenance is for building the game; it only shows with ?dev in the address. */}
        {SHOW_DEV && (
          <button className={`small ${dev ? "toggled" : "ghost"}`} onClick={toggleDev} data-testid="dev-toggle">
            Developer provenance: {dev ? "on" : "off"}
          </button>
        )}
      </div>
    </div>
  );
}
