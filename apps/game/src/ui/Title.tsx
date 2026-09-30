import { useEffect, useState } from "react";
import { api } from "../api";
import { continueGame, newBinder } from "../game/flow";
import { setState, toast, useStore } from "../state/store";
import { crossingBackdrop } from "../art/registry";
import { Fig } from "./battle/Figure";
import { sfx } from "./battle/sfx";

export function Title() {
  const dev = useStore((s) => s.devMode);
  const [hasSave, setHasSave] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api
      .character()
      .then((c) => setHasSave(c.xp > 0 || c.crowns !== 250 || c.level > 1))
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
  return (
    <div className="title-screen">
      <div className="backdrop dimmed">{Back && <Back className="backdrop-svg" />}</div>
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
      <div className="title-card">
        <h1>ENDER</h1>
        <p className="tagline">You never earn a skill. You make one.</p>
      </div>
      <div className="title-actions">
        <button className="big primary" disabled={busy} onClick={() => go(continueGame)} data-testid="continue">
          {hasSave ? "Continue" : "Begin"}
        </button>
        <button className="big" disabled={busy} onClick={() => go(() => newBinder())} data-testid="new-binder">
          New Party
        </button>
        <button className={`small ${dev ? "toggled" : "ghost"}`} onClick={toggleDev} data-testid="dev-toggle">
          Developer provenance: {dev ? "on" : "off"}
        </button>
      </div>
    </div>
  );
}
