import { useEffect, useState } from "react";
import { api } from "../api";
import { enterGame, signIn } from "../game/launch";
import { paintedBackdrop, paintedFigure } from "../art/painted";
import { Fig } from "./battle/Figure";
import { sfx } from "./battle/sfx";
import { OpenAIMark } from "./OpenAIMark";
import { useStore } from "../state/store";
import { heroFigure } from "../game/hero";

/**
 * The first screen anyone sees: the title and the button over a full-bleed painting in the spirit of
 * classic fantasy cover art (a torchlit temple, an idol, a small party at the foot of the stair). The painting is alive: braziers flicker and embers rise. Dark bands keep the title and the
 * button legible. Sign-in is a placeholder; the button simply begins.
 */
export function Landing() {
  const [busy, setBusy] = useState(false);
  // Warm the save while the title shows (a first visit creates the character here), so signing in is quick.
  useEffect(() => {
    const warm = () => void api.character().catch(() => undefined);
    const id = "requestIdleCallback" in window ? requestIdleCallback(warm, { timeout: 1500 }) : setTimeout(warm, 300);
    return () => ("cancelIdleCallback" in window ? cancelIdleCallback(id as number) : clearTimeout(id as number));
  }, []);
  // Sign-in is a placeholder: it is remembered, and it leads straight into the game.
  const begin = async () => {
    sfx.unlock();
    setBusy(true);
    signIn();
    await enterGame();
    setBusy(false);
  };
  return (
    <div className="landing painted" data-testid="landing">
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
      <div className="title-actions landing-actions">
        {/* The mark is the button; "Sign in" sits in its heart. It names ChatGPT for screen readers. */}
        <button className="landing-signin" disabled={busy} onClick={begin} aria-label="Sign in with ChatGPT" data-testid="sign-in">
          <OpenAIMark size={330} className="signin-mark" />
          <span className="signin-text">Sign in</span>
        </button>
      </div>
    </div>
  );
}

/** The painting: a dedicated cover piece when one has been rendered, else one composed from the game's art. */
export function CoverPainting() {
  const hero = useStore((s) => s.hero);
  const cover = paintedBackdrop("cover");
  const hall = paintedBackdrop("throne");
  const idol = paintedFigure("king");
  const embers = Array.from({ length: 14 }, (_, i) => i);
  return (
    <div className="cv-paint">
      {cover ? (
        <>
          <img className="cv-bg" src={cover} alt="" draggable={false} />
          {/* One hero, seen from behind in silhouette, squaring up to what waits on the dais. */}
          <div className="cv-lone">
            <Fig bake figure={hero ? heroFigure(hero.root) : "warden"} look={hero?.look} scale={4.6} />
          </div>
        </>
      ) : (
        <>
          {hall && <img className="cv-bg composed" src={hall} alt="" draggable={false} />}
          <div className="cv-dais" />
          {idol && (
            <div className="cv-idol">
              <img src={idol} alt="" draggable={false} />
              <span className="cv-eye l" />
              <span className="cv-eye r" />
            </div>
          )}
          <div className="cv-party">
            <div className="cv-climber">
              <Fig bake figure="ranger" scale={0.95} />
            </div>
            <div style={{ position: "absolute", left: 330, bottom: 0 }}>
              <Fig bake figure="warden" scale={1.6} />
            </div>
            <div style={{ position: "absolute", left: 150, bottom: -20 }}>
              <Fig bake figure="binder" scale={1.75} />
            </div>
          </div>
        </>
      )}
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
