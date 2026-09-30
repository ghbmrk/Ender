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
