import { useEffect, useMemo, useRef, useState } from "react";
import { GARBS, GARB_NAME, PALETTES, lookFromSeed, newSeed, randomName, type Garb, type HeroLook } from "../../art/look";
import { paintedFigure } from "../../art/painted";
import { crossingBackdrop } from "../../art/registry";
import { SceneBackdrop } from "../../art/SceneBackdrop";
import { heroSpec } from "../../art/ondevice/specs";
import { artNow, onDeviceArt, request } from "../../art/ondevice/store";
import { startTutorial, tutorialDone } from "../../game/tutorial";
import { HERO_ROOT, saveHero } from "../../game/hero";
import { newBinder } from "../../game/flow";
import { getState, setState, toast } from "../../state/store";
import { sfx } from "../battle/sfx";
import { useStage, useWorldTop } from "../Stage";
import "../../create.css";

const PAL_NAME = ["Oxblood", "Sapphire", "Verdigris", "Violet", "Ash", "Ochre", "Bone", "Leather"];

/**
 * Create your hero, on one page (Mark, 22:05): pick what they wear, their colours and their name while the hero is
 * painted out of sight (on this device where it can, else the same look pre-painted), then a reveal. Only the
 * hero's shadow shows while choosing; the reveal is the payoff. There is no class to pick: how the hero fights is
 * crafted on the Loom.
 */
export function CreateHero() {
  const [look, setLook] = useState<HeroLook>(() => lookFromSeed(newSeed()));
  const [name, setName] = useState(() => randomName());
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const worldTop = useWorldTop();
  const { h: stageH } = useStage();
  const Back = crossingBackdrop()?.default;
  const garb: Garb = look.garb ?? "armour";
  const pal = Math.max(0, PALETTES.findIndex(([p]) => p === look.primary));
  const hero = useMemo(() => ({ root: HERO_ROOT, name: name.trim() || "Hero", look }), [name, look]);
  // Every look is in before the first tap, so the shadow and the reveal never wait on an image.
  useEffect(() => {
    for (const g of GARBS)
      for (let i = 0; i < PALETTES.length; i++) {
        const url = paintedFigure(`hero-${g}-${i}`);
        if (url) void Object.assign(new Image(), { src: url }).decode?.().catch(() => undefined);
      }
  }, []);
  // The device paints the chosen hero behind the page, once the choice has settled for a moment.
  const spec = useMemo(() => heroSpec(hero, {}), [garb, pal, look.seed]);
  useEffect(() => {
    const t = setTimeout(() => request(spec, 0), 600);
    return () => clearTimeout(t);
  }, [spec?.key]);
  const base = paintedFigure(`hero-${garb}-${pal}`);
  const own = artNow(spec?.key)?.url;
  const art = (revealed && own) || base;

  const pickGarb = (g: Garb) => {
    sfx.tap();
    setLook((l) => ({ ...l, garb: g }));
  };
  const pickPal = (i: number) => {
    sfx.tap();
    const [primary, secondary, accent] = PALETTES[i]!;
    setLook((l) => ({ ...l, primary, secondary, accent }));
  };
  const roll = () => {
    sfx.tap();
    setLook(lookFromSeed(newSeed()));
    setName(randomName());
  };

  const reveal = () => {
    sfx.unlock();
    sfx.finale();
    setRevealed(true);
  };
  const begin = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const h = { ...hero, name: name.trim() || randomName() };
      // Players who have finished the prologue before go straight to the Crossing with their new hero.
      if (tutorialDone()) {
        saveHero(h);
        await newBinder();
      } else await startTutorial(h);
    } catch (e) {
      toast((e as Error).message, "loss");
      setBusy(false);
    }
  };
  // The reveal holds its moment, then a tap anywhere begins.
  const ready = useRef(false);
  useEffect(() => {
    if (!revealed) return;
    ready.current = false;
    const t = setTimeout(() => (ready.current = true), 900);
    return () => clearTimeout(t);
  }, [revealed]);

  const shadowTop = 230;
  const shadowH = Math.max(560, stageH - 1240);
  return (
    <div className="create-hero one-page" data-testid="create-hero">
      <div className="world" style={{ top: worldTop }}>
        <div className="backdrop dimmed">
          <SceneBackdrop id="title" Drawn={Back} />
        </div>
      </div>
      {/* A first-timer has no heroes to go back to. */}
      {(tutorialDone() || !!getState().hero) && (
        <button className="ch-exit" onClick={() => setState({ screen: "title" })} data-testid="to-heroes">
          ‹ Heroes
        </button>
      )}
      <header className="ch-head">
        <h1>Create your hero</h1>
      </header>

      {/* The hero being painted: only their shadow until the reveal. */}
      <div className="ch-shadow" style={{ top: shadowTop, height: shadowH }} aria-hidden>
        <div className="ch-halo" />
        {base && <img key={`${garb}${pal}`} src={base} className="ch-shadow-img" alt="" draggable={false} />}
        {onDeviceArt && <span className="ch-painting">Painting your hero…</span>}
      </div>

      <div className="ch-picks" style={{ top: shadowTop + shadowH + 30 }}>
        <div className="ch-row">
          <div className="ch-label">Garb</div>
          <div className="ch-garbs">
            {GARBS.map((g) => (
              <button key={g} className={`ch-garb ${g === garb ? "on" : ""}`} onClick={() => pickGarb(g)} data-testid={`garb-${g}`}>
                <img src={paintedFigure(`hero-${g}-${pal}`)} alt="" draggable={false} />
                <span>{GARB_NAME[g]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="ch-row">
          <div className="ch-label">
            Colours <span className="ch-val">{PAL_NAME[pal]}</span>
          </div>
          <div className="ch-pals">
            {PALETTES.map(([a, b, c], i) => (
              <button
                key={a}
                className={`ch-pal ${i === pal ? "on" : ""}`}
                style={{ background: `conic-gradient(${a} 0 55%, ${b} 55% 82%, ${c} 82%)` }}
                onClick={() => pickPal(i)}
                aria-label={PAL_NAME[i]}
                data-testid={`pal-${i}`}
              />
            ))}
          </div>
        </div>
        <div className="ch-row">
          <div className="ch-label">Name</div>
          <div className="ch-name">
            <input value={name} maxLength={22} onChange={(e) => setName(e.target.value)} aria-label="Hero name" data-testid="hero-name" />
            <button className="ch-dice" onClick={roll} aria-label="Roll a new hero" data-testid="look-reroll">
              ⚄
            </button>
          </div>
        </div>
      </div>

      <div className="ch-bar" style={{ top: stageH - 230 }}>
        <button className="big primary ch-begin" onClick={reveal} data-testid="hero-reveal">
          Reveal your hero
        </button>
      </div>

      {revealed && (
        <div className="ch-reveal" onClick={() => ready.current && begin()} data-testid="hero-reveal-scene">
          <div className="chr-rays" />
          <div className="chr-flash" />
          <div className="chr-figure" style={{ top: 220, height: stageH - 760 }}>
            {base && <img src={base} className="chr-shadow" alt="" draggable={false} />}
            {art && <img src={art} className="chr-art" alt="" draggable={false} />}
          </div>
          <div className="chr-name" style={{ top: stageH - 520 }}>
            <small>Your hero</small>
            <b>{name.trim() || "Hero"}</b>
          </div>
          <button className="big primary chr-begin" style={{ top: stageH - 260 }} disabled={busy} onClick={(e) => (e.stopPropagation(), begin())} data-testid="hero-begin">
            Begin
          </button>
        </div>
      )}
    </div>
  );
}
