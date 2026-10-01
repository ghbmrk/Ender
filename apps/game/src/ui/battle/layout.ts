import type { RootId } from "@ender/battle";

/** Feet positions on the 1080×1920 portrait stage: party lower-left, foes upper-right (§2, portrait). */
export const HERO_POS: Record<RootId, [number, number]> = { bond: [150, 1250], quick: [470, 1215], iron: [320, 1375] };
export const FOE_POS: [number, number][] = [
  [790, 930],
  [575, 790],
  [965, 800],
  [740, 1110],
  [975, 1090],
];
export const BOSS_POS: [number, number] = [770, 1000];
export const BOSS_ADDS: [number, number][] = [
  [1000, 1150],
  [520, 780],
  [1000, 760],
  [560, 1140],
];
/** Top of the skill-card row, in stage px on the 1920-tall stage (it sits on the screen's bottom edge). */
export const PANEL_TOP = 1520;

/**
 * Duels (one hero, one foe) are framed over the hero's shoulder: the hero stands large in the
 * foreground with the legs cropped by the card row, and the foe stands further back, smaller, upper
 * right. `panel` is the card row's top in world px.
 */
export function duelLayout(worldTop: number, panel: number, bossBar: boolean) {
  const top = 175 - worldTop + (bossBar ? 150 : 0);
  const h = panel - top;
  return { top, h, hero: [240, panel + Math.round(h * 0.3)] as [number, number], foe: [800, Math.round(top + h * 0.58)] as [number, number] };
}
/** The hero's height (feet to crown) as a share of the arena's; the feet sit below the card row. */
export const DUEL_HERO_SHARE = 1.0;
/** The foe is further away, so it is drawn at this share of the hero's zoom (if it fits). */
export const DUEL_FOE_DEPTH = 0.5;

/** The thumb arc, in stage px relative to the card row's top: Parry and Dodge sit on it. */
export const ARC = {
  parry: { x: 885, y: -440, d: 330 },
  dodge: { x: 590, y: -200, d: 280 },
  path: (top: number) => `M0 ${top + 210} Q 524 ${top - 207} 1080 ${top - 574}`,
};
