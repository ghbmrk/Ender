import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { paintedBackdrop } from "../art/painted";
import { gameReady } from "../ready";
import { sfx } from "./battle/sfx";
import { OpenAIMark } from "./OpenAIMark";

/**
 * The first screen anyone sees: the title and the button over a full-bleed painting in the spirit of
 * classic fantasy cover art (a torchlit temple, an idol, a small party at the foot of the stair). The painting is alive: braziers flicker and embers rise. Dark bands keep the title and the
 * button legible. Sign-in is a placeholder; the button simply begins.
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
  return (
    <div className="landing painted" data-testid="landing" onClick={begin}>
      {/* The painting fills the whole screen, cropping its sides on taller phones, so no dark band shows. */}
      <div className="cover-fill">
        <CoverPainting />
      </div>
      <div className="landing-fade top" />
      <div className="landing-fade bottom" />
      <div className="title-card landing-card">
        <h1>ENDER</h1>
        <p className="tagline">You never earn a skill. You make one.</p>
      </div>
      <p className="landing-tap">Tap to begin</p>
      <div className="title-actions landing-actions">
        {/* The mark is the button; "Sign in" sits in its heart. It names ChatGPT for screen readers. */}
        <button className="landing-signin" disabled={busy} onClick={begin} aria-label="Sign in with ChatGPT" data-testid="sign-in">
          <OpenAIMark size={330} className="signin-mark" />
          <span className="signin-text">{busy ? "Entering" : "Sign in"}</span>
        </button>
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
