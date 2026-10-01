import { useMemo, useState } from "react";
import { GARBS, GARB_FIGURE, GARB_NAME, HAIRS, PALETTES, SKINS, lookFromSeed, newSeed, randomName, type Garb, type HeroLook } from "../../art/look";
import { crossingBackdrop } from "../../art/registry";
import { SceneBackdrop } from "../../art/SceneBackdrop";
import { startTutorial, tutorialDone } from "../../game/tutorial";
import { HERO_ROOT, saveHero } from "../../game/hero";
import { newBinder } from "../../game/flow";
import { setState, toast } from "../../state/store";
import { Fig } from "../battle/Figure";
import { sfx } from "../battle/sfx";
import { useStage, useWorldTop } from "../Stage";
import "../../create.css";

type Tab = "garb" | "colours" | "skin" | "hair" | "head";
const TABS: [Tab, string][] = [
  ["garb", "Garb"],
  ["colours", "Colours"],
  ["skin", "Skin"],
  ["hair", "Hair"],
  ["head", "Head"],
];
const HEAD_NAME: Record<Garb, [string, string, string]> = {
  armour: ["Great helm", "Open helm", "Bare"],
  leathers: ["Hood", "Hood down", "Bare"],
  robes: ["Deep hood", "Circlet", "Bare"],
};

/**
 * The first screen of a new game: a hero no one else has, generated from a seed. The player can re-roll
 * it whole or adjust garb, colours, skin, hair and headwear, then name them. There is no class to pick:
 * how the hero fights is crafted on the Loom.
 */
export function CreateHero() {
  const [look, setLook] = useState<HeroLook>(() => lookFromSeed(newSeed()));
  const [name, setName] = useState(() => randomName());
  const [tab, setTab] = useState<Tab>("garb");
  const [busy, setBusy] = useState(false);
  const worldTop = useWorldTop();
  const { h: stageH } = useStage();
  const Back = crossingBackdrop()?.default;
  const garb: Garb = look.garb ?? "armour";
  const figure = GARB_FIGURE[garb];
  // The hero stands between the header and the controls, as large as the phone allows.
  const panelTop = stageH - 450;
  const feet = panelTop - 150;
  const figScale = Math.min(3.1, (feet - 300) / 280);
  const patch = (p: Partial<HeroLook>) => (sfx.tap(), setLook((l) => ({ ...l, ...p })));
  const reroll = () => {
    sfx.tap();
    setLook(lookFromSeed(newSeed()));
  };
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

  const swatches = useMemo(() => {
    if (tab === "skin") return SKINS.map((c) => ({ key: c, on: look.skin === c, fill: c, pick: () => patch({ skin: c }) }));
    if (tab === "hair") return HAIRS.map((c) => ({ key: c, on: look.hair === c, fill: c, pick: () => patch({ hair: c }) }));
    if (tab === "colours")
      return PALETTES.map(([p, s, a]) => ({
        key: p + s,
        on: look.primary === p && look.secondary === s,
        fill: `linear-gradient(135deg, ${p} 0 55%, ${s} 55% 80%, ${a} 80%)`,
        pick: () => patch({ primary: p, secondary: s, accent: a }),
      }));
    if (tab === "garb") return GARBS.map((g) => ({ key: g, on: garb === g, label: GARB_NAME[g], pick: () => patch({ garb: g }) }));
    return ([0, 1, 2] as const).map((h) => ({ key: String(h), on: look.head === h, label: HEAD_NAME[garb][h], pick: () => patch({ head: h }) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, look]);

  return (
    <div className="create-hero" data-testid="create-hero">
      <div className="world" style={{ top: worldTop }}>
        <div className="backdrop dimmed">
          <SceneBackdrop id="title" Drawn={Back} />
        </div>
      </div>
      <div className="ch-spot" style={{ top: feet - 160 }} />
      <div className="ch-figure" style={{ left: 540, top: feet }}>
        <Fig key={figure} figure={figure} look={look} scale={figScale} />
      </div>

      <button className="ch-exit" onClick={() => (sfx.tap(), setState({ screen: "title" }))} data-testid="to-heroes">
        ‹ Heroes
      </button>
      <header className="ch-head">
        <h1>Your hero</h1>
        <p>Made for you alone. How they fight, you craft as you go.</p>
      </header>

      <div className="ch-name" style={{ top: feet + 20 }}>
        <input value={name} maxLength={22} onChange={(e) => setName(e.target.value)} aria-label="Hero name" data-testid="hero-name" />
        <button className="ch-dice" onClick={() => (sfx.tap(), setName(randomName()))} aria-label="New name" data-testid="hero-name-dice">
          ⚄
        </button>
        <button className="ch-reroll" onClick={reroll} data-testid="look-reroll">
          ⚄ New look
        </button>
      </div>

      {/* Everything you touch sits in the bottom thumb zone. */}
      <div className="ch-panel" style={{ top: panelTop }}>
        <div className="ch-look">
          <div className="ch-tabs">
            {TABS.map(([t, label]) => (
              <button key={t} className={`ch-tab ${t === tab ? "on" : ""}`} onClick={() => setTab(t)} data-testid={`look-tab-${t}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="ch-swatches">
            {swatches.map((s) =>
              "label" in s ? (
                <button key={s.key} className={`ch-chip ${s.on ? "on" : ""}`} onClick={s.pick}>
                  {s.label}
                </button>
              ) : (
                <button key={s.key} className={`ch-swatch ${s.on ? "on" : ""}`} style={{ background: s.fill }} onClick={s.pick} aria-label={tab} />
              ),
            )}
          </div>
        </div>
        <button className="big primary ch-begin" disabled={busy} onClick={begin} data-testid="hero-begin">
          Play as {name.trim() || "your hero"}
        </button>
      </div>
    </div>
  );
}
