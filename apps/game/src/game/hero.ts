import type { RootId } from "@ender/battle";
import { PARTY, ROOTS } from "@ender/battle";
import { GARB_FIGURE, type Hero } from "../art/look";
import { getState, setState } from "../state/store";

/**
 * The player's own hero, made at the start of the prologue. Every fight is this hero against one foe
 * at a time, so the figures can stand close and large. Saved in this browser beside the game save.
 */
const KEY = "ender:hero";

export function loadHero(): Hero | null {
  try {
    const v = localStorage.getItem(KEY);
    return v ? (JSON.parse(v) as Hero) : null;
  } catch {
    return null;
  }
}

export function saveHero(hero: Hero | null) {
  try {
    if (hero) localStorage.setItem(KEY, JSON.stringify(hero));
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
  setState({ hero });
}

/** Who fights: the hero alone, always (every fight is a duel). Saves from before heroes existed keep the old party. */
export function partyRoots(): RootId[] {
  const { hero } = getState();
  return hero ? [hero.root] : [...PARTY];
}

/** Duels: one foe on the field at a time, so an encounter's foes come one after another. */
export const DUEL_FIELD_CAP = 1;
/** Foes were tuned for three heroes; a lone hero meets them at this share of their HP. */
export const DUEL_HP = { normal: 0.45, elite: 0.45, boss: 0.5 } as const;

/** The look to draw for a Root's figure, when that Root is the player's hero. */
export const lookFor = (root: string) => {
  const h = getState().hero;
  return h && h.root === root ? h.look : undefined;
};

/** Every new hero starts on this Root; there is no class pick, because skills are crafted on the Loom. */
export const HERO_ROOT: RootId = "iron";

/** The figure drawn for a Root: the hero's chosen garb for the player's Root, else the Root's own figure. */
export const heroFigure = (root: RootId) => {
  const h = getState().hero;
  return h && h.root === root && h.look.garb ? GARB_FIGURE[h.look.garb] : ROOTS[root].hero;
};

/** A Root's display name: the hero's own name for the player's Root, else "Iron Root" etc. */
export const rootLabel = (root: RootId) => {
  const h = getState().hero;
  return h && h.root === root ? h.name : ROOTS[root].name;
};
