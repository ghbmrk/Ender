import { useEffect, useState } from "react";
import { GARBS, GARB_NAME, PALETTES, lookFromSeed, newSeed, randomName, type Garb, type HeroLook } from "../../art/look";
import { paintedFigure } from "../../art/painted";
import { crossingBackdrop } from "../../art/registry";
import { SceneBackdrop } from "../../art/SceneBackdrop";
import { startTutorial, tutorialDone } from "../../game/tutorial";
import { HERO_ROOT, saveHero } from "../../game/hero";
import { newBinder } from "../../game/flow";
import { getState, setState, toast } from "../../state/store";
import { sfx } from "../battle/sfx";
import { useStage, useWorldTop } from "../Stage";
import "../../create.css";

const next = <T,>(xs: readonly T[], cur: T) => xs[(xs.indexOf(cur) + 1) % xs.length]!;

/** What the painted hero shows: garb and colours. Each pair is pre-painted with the game's model (art/painted). */
type Part = "garb" | "colours";
const SIDE: Record<Part, "l" | "r"> = { colours: "l", garb: "r" };
const NAME: Record<Part, string> = { garb: "Garb", colours: "Colours" };

/**
 * The first screen of a new game: your hero fills the screen, painted in the game's own style, seen over the
 * shoulder as in every fight. Tap Garb or Colours to change them; the dice rolls a whole new hero and name. There is
 * no class to pick: how the hero fights is crafted on the Loom. Once you begin, this device paints your own hero
 * (your seed, then your Loom upgrades) in the background and swaps it in when it's ready.
 */
export function CreateHero() {
  const [look, setLook] = useState<HeroLook>(() => lookFromSeed(newSeed()));
  const [name, setName] = useState(() => randomName());
  const [busy, setBusy] = useState(false);
  const worldTop = useWorldTop();
  const { h: stageH } = useStage();
  const Back = crossingBackdrop()?.default;
  const garb: Garb = look.garb ?? "armour";
  const pal = Math.max(0, PALETTES.findIndex(([p]) => p === look.primary));
  const barTop = stageH - 330;
  const feet = barTop - 40;
  const top = 250;
  // Every look is in before the first tap, so a change shows on the next frame.
  useEffect(() => {
    for (const g of GARBS) for (let i = 0; i < PALETTES.length; i++) {
      const url = paintedFigure(`hero-${g}-${i}`);
      if (url) new Image().src = url;
    }
  }, []);
  const art = paintedFigure(`hero-${garb}-${pal}`);

  const change = (part: Part) => {
    setLook((l) => {
      if (part === "garb") return { ...l, garb: next(GARBS, l.garb ?? "armour") };
      const at = PALETTES.findIndex(([p]) => p === l.primary);
      const [primary, secondary, accent] = PALETTES[(at + 1) % PALETTES.length]!;
      return { ...l, primary, secondary, accent };
    });
  };
  const roll = () => {
    setLook(lookFromSeed(newSeed()));
    setName(randomName());
  };
  const value = (part: Part) =>
    part === "garb" ? GARB_NAME[garb] : <i className="ch-dot wide" style={{ background: `linear-gradient(90deg, ${look.primary} 0 55%, ${look.secondary} 55% 80%, ${look.accent} 80%)` }} />;

  const begin = async () => {
    sfx.unlock();
    setBusy(true);
    try {
      const hero = { root: HERO_ROOT, name: name.trim() || randomName(), look };
      // Players who have finished the prologue before go straight to the Crossing with their new hero.
      if (tutorialDone()) {
        saveHero(hero);
        await newBinder();
      } else await startTutorial(hero);
    } catch (e) {
      toast((e as Error).message, "loss");
      setBusy(false);
    }
  };

  const parts = Object.keys(SIDE) as Part[];
  const [lit, setLit] = useState<{ p: Part; n: number } | null>(null);
  const tapPart = (p: Part) => {
    sfx.tap();
    change(p);
    setLit((l) => ({ p, n: (l?.n ?? 0) + 1 }));
  };
  return (
    <div className="create-hero" data-testid="create-hero">
      <div className="world" style={{ top: worldTop }}>
        <div className="backdrop dimmed">
          <SceneBackdrop id="title" Drawn={Back} />
        </div>
      </div>
      <div className="ch-spot" style={{ top: feet - 130 }} />
      <div className="ch-painted" style={{ top, height: feet - top }}>
        {art ? <img key={`${garb}${pal}`} src={art} className="ch-painted-img" alt="" draggable={false} onClick={() => tapPart("garb")} data-testid="part-garb" /> : null}
      </div>

      {parts.map((p) => (
        <button
          key={p}
          className={`ch-callout ${SIDE[p]} ${lit?.p === p ? `lit lit-${lit.n % 2}` : ""}`}
          style={{ top: feet - 520 }}
          onClick={() => tapPart(p)}
          data-testid={`look-${p}`}
        >
          <span className="ch-part">
            {NAME[p]} <span className="ch-val">{value(p)}</span>
          </span>
          {!lit && <span className="ch-cta">tap to change</span>}
        </button>
      ))}

      {/* A first-timer has no heroes to go back to. */}
      {(tutorialDone() || !!getState().hero) && (
        <button className="ch-exit" onClick={() => setState({ screen: "title" })} data-testid="to-heroes">
          ‹ Heroes
        </button>
      )}
      <header className="ch-head">
        <h1>Create your hero</h1>
      </header>

      <div className="ch-bar" style={{ top: barTop }}>
        <div className="ch-name">
          <input value={name} maxLength={22} onChange={(e) => setName(e.target.value)} aria-label="Hero name" data-testid="hero-name" />
          <button className="ch-dice" onClick={roll} aria-label="Roll a new hero" data-testid="look-reroll">
            ⚄
          </button>
        </div>
        <button className="big primary ch-begin" disabled={busy} onClick={begin} data-testid="hero-begin">
          Begin
        </button>
      </div>
    </div>
  );
}
