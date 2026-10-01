import { useEffect, useState } from "react";
import { api } from "../api";
import { enterGame } from "../game/launch";
import { savedStep, tutorialDone } from "../game/tutorial";
import { setState, toast, useStore } from "../state/store";
import { sfx } from "./battle/sfx";
import { CoverPainting } from "./Landing";

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
  /** Continue the save, picking the prologue back up where it was left (it never hangs: see enterGame). */
  const resume = async () => {
    await enterGame();
    setBusy(false);
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
    <div className="title-screen landing painted">
      {/* The same painting as the landing, so the two read as one: the hero, alone, before the monster. */}
      <div className="cover-fill">
        <CoverPainting />
      </div>
      <div className="landing-fade top" />
      <div className="landing-fade bottom" />
      <div className="title-card landing-card">
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
        <button className={`big ${hasSave || me ? "" : "primary"}`} onClick={() => go(async () => setState({ screen: "create" }))} data-testid="new-hero">
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
