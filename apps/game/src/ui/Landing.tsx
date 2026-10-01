import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { paintedBackdrop } from "../art/painted";
import { gameReady } from "../ready";
import { sfx } from "./battle/sfx";
import { OpenAIMark } from "./OpenAIMark";

/**
 * The first screen anyone sees, laid out like a fantasy rulebook cover: a tooled-leather cover with the title on
 * top, the painting (a lone hero before a towering monster) in a gilt window, and the sign-in seal below. The
 * painting is alive: firelight flickers and embers rise. Sign-in is a placeholder; the button simply begins.
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
    // The rest of the game loads behind the title; sign-in waits for it only if it isn't in yet.
    const [{ enterGame, signIn }] = await Promise.all([import("../game/launch"), gameReady()]);
    signIn();
    await enterGame();
    setBusy(false);
    going.current = false;
  };
  // One composition, like a book cover: the title on its own band, the painting in a gilt window, the sign-in
  // seal on the band below. Nothing sits over the painting.
  return (
    <div className="landing cover-book" data-testid="landing" onClick={begin}>
      <div className="cb-frame">
        <header className="cb-head">
          <h1 className="cb-title">ENDER</h1>
          <p className="cb-tagline">You never earn a skill. You make one.</p>
        </header>
        <div className="cb-art">
          <CoverPainting />
        </div>
        <footer className="cb-foot">
          {/* The mark is the button, set like a seal; "Sign in" sits in its heart. It names ChatGPT for screen readers. */}
          <button className="cb-seal" disabled={busy} onClick={begin} aria-label="Sign in with ChatGPT" data-testid="sign-in">
            <OpenAIMark size={250} className="cb-mark" />
            <span className="cb-signin">{busy ? "Entering" : "Sign in"}</span>
          </button>
        </footer>
        <i className="cb-corner tl" />
        <i className="cb-corner tr" />
        <i className="cb-corner bl" />
        <i className="cb-corner br" />
      </div>
    </div>
  );
}

/** The painting: the dedicated cover piece, with flickering braziers and rising embers over it. */
export function CoverPainting() {
  const cover = paintedBackdrop("cover");
  const embers = Array.from({ length: 14 }, (_, i) => i);
  return (
    <div className="cv-paint">
      {/* The cover holds its own lone knight before the demon, so nothing is drawn over it. */}
      {cover && <img className="cv-bg" src={cover} alt="" draggable={false} fetchPriority="high" />}
      <div className="cv-torch" />
      <div className="cv-embers">
        {embers.map((i) => (
          <span key={i} style={{ left: `${8 + ((i * 61) % 84)}%`, animationDelay: `${(i * 0.7) % 6}s`, animationDuration: `${5 + (i % 4)}s` }} />
        ))}
      </div>
      <div className="cv-vignette" />
    </div>
  );
}
