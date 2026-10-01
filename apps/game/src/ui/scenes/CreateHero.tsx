import { useState } from "react";
import { GARBS, GARB_FIGURE, GARB_NAME, HAIRS, PALETTES, SKINS, lookFromSeed, newSeed, randomName, type Garb, type HeroLook } from "../../art/look";
import { crossingBackdrop, figureFor } from "../../art/registry";
import { SceneBackdrop } from "../../art/SceneBackdrop";
import { startTutorial, tutorialDone } from "../../game/tutorial";
import { HERO_ROOT, saveHero } from "../../game/hero";
import { newBinder } from "../../game/flow";
import { setState, toast } from "../../state/store";
import { Fig } from "../battle/Figure";
import { sfx } from "../battle/sfx";
import { useStage, useWorldTop } from "../Stage";
import "../../create.css";

const HEAD_NAME: Record<Garb, [string, string, string]> = {
  armour: ["Great helm", "Open helm", "Bare"],
  leathers: ["Hood", "Hood down", "Bare"],
  robes: ["Deep hood", "Circlet", "Bare"],
};
const HAIR_STYLE = ["Short", "Long", "Braided", "Shaved"];
const next = <T,>(xs: readonly T[], cur: T) => xs[(xs.indexOf(cur) + 1) % xs.length]!;

type Part = "head" | "hair" | "skin" | "garb" | "colours";
/** Where each callout points on the figure, as [x offset, height above the feet] in shares of the figure's height. */
const SIDE: Record<Part, "l" | "r"> = { head: "l", skin: "l", colours: "l", hair: "r", garb: "r" };
const NAME: Record<Part, string> = { head: "Head", hair: "Hair", skin: "Skin", garb: "Garb", colours: "Colours" };

/**
 * Where each part is on a figure, from its art metadata (the head crop and the feet), in viewBox units:
 * the callout's anchor point and the part's tap zone [x0, y0, x1, y1].
 */
function partsOf(figure: string) {
  const m = figureFor(figure).meta;
  const [hx, hy, hs] = m.head;
  const fx = m.feet.x;
  const neck = hy + hs;
  const body = m.feet.y - neck;
  const half = 0.2 * (m.feet.y - hy);
  const face = m.facing === "right" ? 1 : -1;
  const cx = hx + hs / 2;
  return {
    top: hy - 0.3 * hs,
    feetY: m.feet.y,
    feetX: fx,
    w: m.viewBox[2],
    anchor: {
      head: [cx, hy + 0.12 * hs],
      hair: [cx - face * 0.3 * hs, hy + 0.5 * hs],
      skin: [cx + face * 0.2 * hs, hy + 0.62 * hs],
      garb: [fx - 0.05 * body, neck + 0.25 * body],
      colours: [fx + 0.1 * body, neck + 0.62 * body],
    } as Record<Part, [number, number]>,
    zone: {
      head: [hx - 0.15 * hs, hy - 0.3 * hs, hx + 1.15 * hs, hy + 0.35 * hs],
      hair: face > 0 ? [hx - 0.25 * hs, hy + 0.35 * hs, cx, neck] : [cx, hy + 0.35 * hs, hx + 1.25 * hs, neck],
      skin: face > 0 ? [cx, hy + 0.35 * hs, hx + 1.25 * hs, neck] : [hx - 0.25 * hs, hy + 0.35 * hs, cx, neck],
      garb: [fx - half, neck, fx + half, neck + 0.42 * body],
      colours: [fx - half * 1.2, neck + 0.42 * body, fx + half * 1.2, m.feet.y],
    } as Record<Part, [number, number, number, number]>,
  };
}

/**
 * The first screen of a new game: your hero fills the screen, idling, with each part labelled. Tap a label
 * to change that part; the dice rolls a whole new hero and name. There is no class to pick: how the hero
 * fights is crafted on the Loom.
 */
export function CreateHero() {
  const [look, setLook] = useState<HeroLook>(() => lookFromSeed(newSeed()));
  const [name, setName] = useState(() => randomName());
  const [busy, setBusy] = useState(false);
  const worldTop = useWorldTop();
  const { h: stageH } = useStage();
  const Back = crossingBackdrop()?.default;
  const garb: Garb = look.garb ?? "armour";
  const figure = GARB_FIGURE[garb];
  // The hero fills the space between the title and the name row, measured from the art's own head and feet.
  const barTop = stageH - 330;
  const feet = barTop - 40;
  const top = 300;
  const geo = partsOf(figure);
  const scale = (feet - top) / (geo.feetY - geo.top);
  const X = (vx: number) => 540 + (vx - geo.w / 2) * scale;
  const Y = (vy: number) => feet - (geo.feetY - vy) * scale;
  // Labels sit beside their parts, spread so they never overlap.
  const labelY = {} as Record<Part, number>;
  for (const side of ["l", "r"] as const) {
    let last = 230;
    for (const p of (Object.keys(SIDE) as Part[]).filter((q) => SIDE[q] === side).sort((a2, b2) => geo.anchor[a2][1] - geo.anchor[b2][1])) {
      labelY[p] = Math.max(Y(geo.anchor[p][1]) - 60, last + 20);
      last = labelY[p] + 130;
    }
  }

  const change = (part: Part) => {
    sfx.tap();
    setLook((l) => {
      const pal = PALETTES.findIndex(([p, s2]) => p === l.primary && s2 === l.secondary);
      if (part === "garb") return { ...l, garb: next(GARBS, l.garb ?? "armour") };
      if (part === "skin") return { ...l, skin: next(SKINS, l.skin as (typeof SKINS)[number]) };
      if (part === "head") return { ...l, head: ((l.head + 1) % 3) as HeroLook["head"] };
      if (part === "colours") {
        const [primary, secondary, accent] = PALETTES[(pal + 1) % PALETTES.length]!;
        return { ...l, primary, secondary, accent };
      }
      // Hair steps through colours, then styles; it uncovers the head if a helm or hood hides it.
      const hi = HAIRS.indexOf(l.hair as (typeof HAIRS)[number]);
      const style = hi === HAIRS.length - 1 ? (((l.hairStyle + 1) % 4) as HeroLook["hairStyle"]) : l.hairStyle;
      return { ...l, hair: next(HAIRS, l.hair as (typeof HAIRS)[number]), hairStyle: style, head: l.head === 0 ? 2 : l.head };
    });
  };
  const roll = () => {
    sfx.tap();
    setLook(lookFromSeed(newSeed()));
    setName(randomName());
  };
  const value = (part: Part) =>
    part === "garb" ? GARB_NAME[garb] : part === "head" ? HEAD_NAME[garb][look.head] : part === "hair" ? HAIR_STYLE[look.hairStyle] : part === "skin" ? <i className="ch-dot" style={{ background: look.skin }} /> : <i className="ch-dot wide" style={{ background: `linear-gradient(90deg, ${look.primary} 0 55%, ${look.secondary} 55% 80%, ${look.accent} 80%)` }} />;

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
      <div className="ch-figure" style={{ left: 540, top: feet }}>
        <div className="ch-idle">
          <Fig key={figure} figure={figure} look={look} scale={scale} />
        </div>
      </div>

      {/* Each part of the hero is its own tap target. */}
      {parts.map((p) => {
        const [x0, y0, x1, y1] = geo.zone[p];
        return (
          <div
            key={p}
            className={`ch-zone ${lit?.p === p ? `lit lit-${lit.n % 2}` : ""}`}
            style={{ left: X(x0), width: (x1 - x0) * scale, top: Y(y0), height: (y1 - y0) * scale }}
            onClick={() => tapPart(p)}
            data-testid={`part-${p}`}
          />
        );
      })}

      {/* Leader lines from each label to its part of the figure. */}
      <svg className="ch-leaders" viewBox={`0 0 1080 ${stageH}`} style={{ height: stageH }}>
        {parts.map((p) => {
          const x = X(geo.anchor[p][0]);
          const y = Y(geo.anchor[p][1]);
          const ly = labelY[p] + 60;
          const lx = SIDE[p] === "l" ? 306 : 774;
          return (
            <g key={p}>
              <polyline points={`${lx},${ly} ${lx + (SIDE[p] === "l" ? 30 : -30)},${ly} ${x},${y}`} />
              <circle cx={x} cy={y} r={10} />
            </g>
          );
        })}
      </svg>
      {parts.map((p) => (
        <button
          key={p}
          className={`ch-callout ${SIDE[p]}`}
          style={{ top: labelY[p] }}
          onClick={() => tapPart(p)}
          data-testid={`look-${p}`}
        >
          <span className="ch-part">
            {NAME[p]} <span className="ch-val">{value(p)}</span>
          </span>
          <span className="ch-cta">tap to change</span>
        </button>
      ))}

      <button className="ch-exit" onClick={() => (sfx.tap(), setState({ screen: "title" }))} data-testid="to-heroes">
        ‹ Heroes
      </button>
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
