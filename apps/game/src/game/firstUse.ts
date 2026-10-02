/**
 * First use (Mark, 2026-10-02): every piece of the game is baby-stepped the first time it shows, and only deepens
 * once the simpler version is familiar. Two records, kept per player (a fresh start clears them, see reset.ts):
 * guides the player has finished, and how many times each place has been opened.
 */
const LEARNED = "ender:learned";
const VISITS = "ender:visits";

function read<T>(key: string, empty: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? "null") as T) ?? empty;
  } catch {
    return empty;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private mode: guides show again next time */
  }
}

/** Developers and scripted tests (`ender:dev`) see everything at full depth. */
export const fullDepth = () => {
  try {
    return !!localStorage.getItem("ender:dev");
  } catch {
    return false;
  }
};

export const learned = (id: string) => fullDepth() || read<string[]>(LEARNED, []).includes(id);
export function learn(id: string) {
  const all = read<string[]>(LEARNED, []);
  if (!all.includes(id)) write(LEARNED, [...all, id]);
}

export const visits = (place: string) => (fullDepth() ? 99 : (read<Record<string, number>>(VISITS, {})[place] ?? 0));
/** Counts one more opening of `place` and returns the new count. */
export function visit(place: string): number {
  const all = read<Record<string, number>>(VISITS, {});
  all[place] = (all[place] ?? 0) + 1;
  write(VISITS, all);
  return fullDepth() ? 99 : all[place];
}
