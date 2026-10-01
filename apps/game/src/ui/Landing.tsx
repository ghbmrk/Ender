import { useEffect, useState } from "react";
import { api } from "../api";
import { savedStep, tutorialDone } from "../game/tutorial";
import { paintedBackdrop, paintedFigure } from "../art/painted";
import { setState } from "../state/store";
import { Fig } from "./battle/Figure";
import { sfx } from "./battle/sfx";

/**
 * The first screen anyone sees: the title and the button over a full-bleed painting in the spirit of
 * classic fantasy cover art (a torchlit temple, an idol, a small party at the foot of the stair). The painting is alive: braziers flicker and embers rise. Dark bands keep the title and the
 * button legible. Sign-in is a placeholder; the button simply begins.
 */
export function Landing() {
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
        <button className="big primary landing-signin" onClick={begin} data-testid="sign-in">
          Sign in with ChatGPT
        </button>
      </div>
    </div>
  );
}

/** The painting: a dedicated cover piece when one has been rendered, else one composed from the game's art. */
function CoverPainting() {
  const cover = paintedBackdrop("cover");
  const hall = paintedBackdrop("throne");
  const idol = paintedFigure("king");
  const embers = Array.from({ length: 14 }, (_, i) => i);
  return (
    <div className="cv-paint">
      {cover ? (
        <>
          <img className="cv-bg" src={cover} alt="" draggable={false} />
          {/* A small party at the foot of the stair, looking up at what waits on the dais. */}
          <div className="cv-party on-cover">
            <div style={{ position: "absolute", left: 300, bottom: 0 }}>
              <Fig bake figure="warden" scale={1.15} />
            </div>
            <div style={{ position: "absolute", left: 170, bottom: -12 }}>
              <Fig bake figure="binder" scale={1.25} />
            </div>
            <div style={{ position: "absolute", left: 420, bottom: -6 }}>
              <Fig bake figure="ranger" scale={1.1} />
            </div>
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
