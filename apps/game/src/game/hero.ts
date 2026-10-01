import type { RootId } from "@ender/battle";
import { PARTY, ROOTS } from "@ender/battle";
import type { Hero } from "../art/look";
import { getState, setState } from "../state/store";

/**
 * The player's own hero, made at the start of the prologue. It fights alone until the prologue ends,
 * when the other two Roots join as companions. Saved in this browser beside the game save.
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

/** Who fights: the hero alone during the prologue's fights, the full party otherwise. */
export function partyRoots(): RootId[] {
  const { hero, tutorial } = getState();
  if (hero && tutorial && tutorial !== "gate") return [hero.root];
  return [...PARTY];
}

/** The look to draw for a Root's figure, when that Root is the player's hero. */
export const lookFor = (root: string) => {
  const h = getState().hero;
  return h && h.root === root ? h.look : undefined;
};

/** A Root's display name: the hero's own name for the player's Root, else "Iron Root" etc. */
export const rootLabel = (root: RootId) => {
  const h = getState().hero;
  return h && h.root === root ? h.name : ROOTS[root].name;
};
