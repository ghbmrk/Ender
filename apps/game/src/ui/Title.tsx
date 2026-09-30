import { useEffect, useState } from "react";
import { api } from "../api";
import { continueGame, newBinder } from "../game/flow";
import { setState, toast, useStore } from "../state/store";

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
  return (
    <div className="title-screen">
      <div className="title-card">
        <div className="sigil">⟁</div>
        <h1>ENDER</h1>
        <p className="tagline">The world is governed by hidden laws. Bind what you find. Prove what you bind.</p>
        <div className="title-actions">
          <button className="primary" disabled={busy} onClick={() => go(continueGame)} data-testid="continue">
            {hasSave ? "Continue" : "Continue (fresh Binder)"}
          </button>
          <button disabled={busy} onClick={() => go(() => newBinder())} data-testid="new-binder">
            New Binder
          </button>
          <button className={dev ? "toggled" : "ghost"} onClick={toggleDev} data-testid="dev-toggle">
            Developer Provenance: {dev ? "On" : "Off"}
          </button>
        </div>
        <div className="controls-help">
          <span>WASD move</span>
          <span>Mouse aim</span>
          <span>LMB Thread Bolt</span>
          <span>RMB Sever</span>
          <span>Space Slip</span>
          <span>Q Unravel</span>
          <span>E interact</span>
          <span>Tab inventory</span>
        </div>
      </div>
    </div>
  );
}
