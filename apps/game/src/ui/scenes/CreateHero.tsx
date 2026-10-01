import { useEffect, useMemo, useRef, useState } from "react";
import { GARBS, PALETTES, lookFromSeed, newSeed, randomName, type Garb, type HeroLook } from "../../art/look";
import { PICKS, TRAITS, lookForTraits } from "../../art/traits";
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


/**
 * Create your hero, on one page (Mark, 22:05): pick three traits ("Tough", "Sly", "Beautiful"…, Mark 22:25) and a
 * name while the hero is painted out of sight (on this device where it can, else the same look pre-painted), then a
 * reveal. The traits choose the garb and colours; only the hero's shadow shows while choosing. There is no class to pick: how the hero fights is
 * crafted on the Loom.
 */
export function CreateHero() {
  const [look, setLook] = useState<HeroLook>(() => lookFromSeed(newSeed()));
  const [name, setName] = useState(() => randomName());
  const [traits, setTraits] = useState<string[]>([]);
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

  // The picked traits choose the garb and palette; the shadow follows each pick.
  const applyTraits = (ids: string[]) => {
    setTraits(ids);
    const t = lookForTraits(ids);
    if (!t) return;
    const [primary, secondary, accent] = PALETTES[t.pal]!;
    setLook((l) => ({ ...l, garb: t.garb, primary, secondary, accent, traits: ids }));
  };
  // Tap to pick, tap again to drop; a fourth pick takes the place of the last one.
  const toggle = (id: string) => {
    sfx.tap();
    if (traits.includes(id)) return applyTraits(traits.filter((t) => t !== id));
    applyTraits(traits.length < PICKS ? [...traits, id] : [...traits.slice(0, PICKS - 1), id]);
  };
  const roll = () => {
    sfx.tap();
    const seed = newSeed();
    setLook(lookFromSeed(seed));
    setName(randomName());
    const shuffled = TRAITS.map((t) => t.id).sort(() => Math.random() - 0.5);
    applyTraits(shuffled.slice(0, PICKS));
  };
  const left = PICKS - traits.length;

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
  // The shadow takes what the choices leave: title above, three rows of traits, the name and Reveal below.
  const shadowH = Math.max(360, stageH - shadowTop - 1150);
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
          <div className="ch-label">
            Pick {PICKS} <span className="ch-val">{left > 0 ? `${left} more` : "your hero is"}</span>
          </div>
          <div className="ch-traits">
            {TRAITS.map((t) => (
              <button key={t.id} className={`ch-trait ${traits.includes(t.id) ? "on" : ""}`} onClick={() => toggle(t.id)} data-testid={`trait-${t.id}`}>
                {t.name}
              </button>
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
        <button className="big primary ch-begin" disabled={left > 0} onClick={reveal} data-testid="hero-reveal">
          {left > 0 ? `Pick ${left} more` : "Reveal your hero"}
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
            <small>{traits.map((id) => TRAITS.find((t) => t.id === id)?.name).join(" · ")}</small>
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
