import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { paintedBackdrop } from "../art/painted";
import { gameReady, reloadOnce } from "../ready";
import { toast } from "../state/store";
import { sfx } from "./battle/sfx";
import { OpenAIMark } from "./OpenAIMark";

/**
 * The first screen anyone sees: a lone hero facing a wyrm that rises out of the storm, painted in the game's own
 * style and filling the screen, with the title in the sky and Sign in under the thumb. Sign-in is a placeholder;
 * the button simply begins.
 */
export function Landing() {
  const [busy, setBusy] = useState(false);
  const going = useRef(false);
  // Warm the save while the title shows (a first visit creates the character here), so signing in is quick.
  useEffect(() => {
    // (The game itself is still loading in the background on a first visit; this waits for it.)
    const warm = () => void gameReady().then(() => api.character()).catch(() => undefined);
    const id = "requestIdleCallback" in window ? requestIdleCallback(warm, { timeout: 1500 }) : setTimeout(warm, 300);
    return () => ("cancelIdleCallback" in window ? cancelIdleCallback(id as number) : clearTimeout(id as number));
  }, []);
  // Sign-in is a placeholder: it is remembered, and it leads straight into the game.
  // A tap anywhere on the title begins too: new players tap the middle of the screen first.
  const begin = async () => {
    if (going.current) return;
    going.current = true;
    sfx.unlock();
    setBusy(true);
    try {
      // The rest of the game loads behind the title; sign-in waits for it only if it isn't in yet.
      const [{ enterGame, signIn }] = await Promise.all([import("../game/launch"), gameReady()]);
      signIn();
      await enterGame();
    } catch (e) {
      // A part that won't load usually means a newer build went up while this page was open: load the new one.
      if (reloadOnce()) return;
      toast(`Couldn't start: ${(e as Error).message}. Tap to try again.`, "loss");
    }
    setBusy(false);
    going.current = false;
  };
  // One composition, like the game's own key art: the painting fills the screen, the title sits in the storm at
  // the top, and the standard Sign in with ChatGPT button sits in the thumb zone.
  return (
    <div className="landing keyart" data-testid="landing" onClick={begin}>
      <CoverPainting />
      <header className="ka-head">
        <h1 className="ka-title">Ender</h1>
        <p className="ka-tagline">You never earn a skill. You make one.</p>
      </header>
      <footer className="ka-foot">
        {/* A standard provider sign-in button, not themed: black pill, the OpenAI mark in white, the provider's name. */}
        <button className={`oauth-chatgpt ${busy ? "going" : ""}`} disabled={busy} onClick={begin} data-testid="sign-in">
          <OpenAIMark size={60} className="oa-mark" />
          <span>{busy ? "Signing in…" : "Sign in with ChatGPT"}</span>
        </button>
      </footer>
    </div>
  );
}

/** The painting: a lone hero on a cliff, a wyrm rising out of the storm, with lightning and drifting sparks. */
export function CoverPainting() {
  const art = paintedBackdrop("landing");
  const sparks = Array.from({ length: 12 }, (_, i) => i);
  return (
    <div className="ka-paint">
      {art && <img className="ka-bg" src={art} alt="" draggable={false} fetchPriority="high" />}
      <div className="ka-flash" />
      <div className="ka-sparks">
        {sparks.map((i) => (
          <span key={i} style={{ left: `${6 + ((i * 61) % 88)}%`, animationDelay: `${(i * 0.7) % 6}s`, animationDuration: `${6 + (i % 4)}s` }} />
        ))}
      </div>
      <div className="ka-fade top" />
      <div className="ka-fade bottom" />
    </div>
  );
}
