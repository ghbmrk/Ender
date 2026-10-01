import { useMemo, useState } from "react";
import { ROOTS, type RootId } from "@ender/battle";
import { HAIRS, PALETTES, SKINS, lookFromSeed, newSeed, randomName, type HeroLook } from "../../art/look";
import { crossingBackdrop } from "../../art/registry";
import { SceneBackdrop } from "../../art/SceneBackdrop";
import { startTutorial, tutorialDone } from "../../game/tutorial";
import { saveHero } from "../../game/hero";
import { newBinder } from "../../game/flow";
import { toast } from "../../state/store";
import { Fig } from "../battle/Figure";
import { sfx } from "../battle/sfx";
import { useStage, useWorldTop } from "../Stage";
import "../../create.css";

/** What each Root plays like, in one line (§5). */
const PITCH: Record<RootId, { style: string; line: string }> = {
  iron: { style: "Knight", line: "Heavy blows. Parries crack a foe's guard." },
  quick: { style: "Ranger", line: "Fast. Perfect timing lets you act sooner." },
  bond: { style: "Binder", line: "A guide. Parries feed your allies AP." },
};
const ROOT_ORDER: RootId[] = ["iron", "quick", "bond"];
type Tab = "skin" | "hair" | "colours" | "head";
const HEAD_NAME: Record<RootId, [string, string, string]> = {
  iron: ["Great helm", "Open helm", "Bare"],
  quick: ["Hood", "Hood down", "Bare"],
  bond: ["Deep hood", "Circlet", "Bare"],
};

/**
 * The first screen of a new game: choose a Root and get a hero no one else has. The look is generated
 * from a seed; the player can re-roll it whole or adjust skin, hair, colours and headwear, then name them.
 */
export function CreateHero() {
  const [root, setRoot] = useState<RootId>("iron");
  const [look, setLook] = useState<HeroLook>(() => lookFromSeed(newSeed()));
  const [name, setName] = useState(() => randomName());
  const [tab, setTab] = useState<Tab>("colours");
  const [busy, setBusy] = useState(false);
  const worldTop = useWorldTop();
  const { h: stageH } = useStage();
  const Back = crossingBackdrop()?.default;
  const figure = ROOTS[root].hero;
  // The hero stands between the header and the controls, as large as the phone allows.
  const panelTop = stageH - 820;
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
      const hero = { root, name: name.trim() || randomName(), look };
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
    return ([0, 1, 2] as const).map((h) => ({ key: String(h), on: look.head === h, label: HEAD_NAME[root][h], pick: () => patch({ head: h }) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, look, root]);

  return (
    <div className="create-hero" data-testid="create-hero">
      <div className="world" style={{ top: worldTop }}>
        <div className="backdrop dimmed">
          <SceneBackdrop id="title" Drawn={Back} />
        </div>
      </div>
      <div className="ch-spot" style={{ top: feet - 160 }} />
      <div className="ch-figure" style={{ left: 540, top: feet }}>
        <Fig key={root} figure={figure} look={look} scale={figScale} />
      </div>

      <header className="ch-head">
        <h1>Your hero</h1>
        <p>Your Root is how you fight. Your look is yours alone.</p>
      </header>

      <div className="ch-name" style={{ top: feet + 20 }}>
        <input value={name} maxLength={22} onChange={(e) => setName(e.target.value)} aria-label="Hero name" data-testid="hero-name" />
        <button className="ch-dice" onClick={() => (sfx.tap(), setName(randomName()))} aria-label="New name" data-testid="hero-name-dice">
          ⚄
        </button>
      </div>

      {/* Everything you touch sits in the bottom thumb zone. */}
      <div className="ch-panel" style={{ top: panelTop }}>
        <div className="ch-roots">
          {ROOT_ORDER.map((r) => (
            <button key={r} className={`ch-root ${r === root ? "on" : ""}`} onClick={() => (sfx.tap(), setRoot(r))} data-testid={`root-${r}`}>
              <b>{ROOTS[r].name.replace(" Root", "")}</b>
              <span className="ch-style">{PITCH[r].style}</span>
              <span className="ch-line">{PITCH[r].line}</span>
            </button>
          ))}
        </div>
        <div className="ch-look">
          <div className="ch-tabs">
            {(["colours", "skin", "hair", "head"] as Tab[]).map((t) => (
              <button key={t} className={`ch-tab ${t === tab ? "on" : ""}`} onClick={() => setTab(t)} data-testid={`look-tab-${t}`}>
                {t === "colours" ? "Colours" : t === "skin" ? "Skin" : t === "hair" ? "Hair" : "Head"}
              </button>
            ))}
            <button className="ch-reroll" onClick={reroll} data-testid="look-reroll">
              ⚄ New look
            </button>
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
          Begin as {name.trim() || "your hero"}
        </button>
      </div>
    </div>
  );
}
