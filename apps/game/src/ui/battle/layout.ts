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
export const PANEL_TOP = 1440;

/**
 * Duels (one hero, one foe) fill the arena between the turn bar and the command panel, so the two
 * figures are as large and close as the phone allows. `panel` is the panel's top in world px.
 */
export function duelLayout(worldTop: number, panel: number, bossBar: boolean) {
  const top = 175 - worldTop + (bossBar ? 150 : 0);
  const h = panel - top;
  return { top, h, hero: [300, panel - 36] as [number, number], foe: [770, Math.round(top + h * 0.64)] as [number, number] };
}
/** The hero's height (feet to crown) as a share of the arena's. */
export const DUEL_HERO_SHARE = 0.5;
