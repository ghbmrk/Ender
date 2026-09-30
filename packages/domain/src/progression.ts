import type { CraftAction } from "@ender/shared";

/** Loom Rank (the character level) caps at 20 (§56). */
export const LEVEL_CAP = 20;

/** Focus refreshes to this at the start of each Realm. */
export const BASE_FOCUS = 12;

export const FOCUS_COST: Record<CraftAction, number> = {
  attune: 1,
  fracture: 1,
  temper: 2,
  trial: 0,
  mirror: 2,
  "deep-trial": 3,
};

/** Normalized Work Units per action (rule/fixture providers). */
export const WORK_UNITS: Record<CraftAction, number> = {
  attune: 1,
  fracture: 1,
  temper: 3,
  trial: 0,
  mirror: 3,
  "deep-trial": 5,
};

export const xpForWorkUnits = (wu: number) => (wu <= 0 ? 0 : Math.round(20 * wu ** 0.72));

/** Cumulative XP required to reach `level`. */
export const xpRequired = (level: number) => Math.round(100 * Math.max(0, level - 1) ** 1.55);

export function levelForXp(xp: number): number {
  let lvl = 1;
  while (lvl < LEVEL_CAP && xp >= xpRequired(lvl + 1)) lvl++;
  return lvl;
}

/** Key used to award XP at most once per (character, artifact revision, action). */
export const xpAwardKey = (characterId: string, artifactId: string, revision: number, action: CraftAction) =>
  `${characterId}|${artifactId}#${revision}|${action}`;
