/**
 * Start over: a brand-new player, as if the game had never been opened. The saved game is dropped (the in-page
 * server ignores it on the next load and the first save replaces it) and every progress mark is cleared; sound and
 * the on-device painter's settings stay. Then the page reloads to the title.
 */
const BUILD_KEY = "ender:build";
const KEEP = new Set(["ender:mute", "ender:painter", "ender:art-last", "ender:dev", BUILD_KEY]);

/** Drops the save and every progress mark; the in-page server starts a new game on its next load. */
function wipe() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("ender:") && !KEEP.has(k)) localStorage.removeItem(k);
    localStorage.setItem("ender:fresh", "1");
  } catch {
    /* storage blocked: there is no save to clear */
  }
}

export function startOver() {
  // Nothing is saved from here on, so a save already queued can't put the old game back.
  (window as { __enderNoSave?: boolean }).__enderNoSave = true;
  wipe();
  location.replace(location.pathname);
}

/**
 * Every published build starts everyone fresh (Mark's ask: each patch is played from the start). The publish stamps
 * a build id; the first load of a new id wipes the game before anything reads the save. The painter's model cache,
 * its finished paints and its settings stay. Builds without an id (local, tests) never wipe.
 */
export function freshOnNewBuild() {
  const id = import.meta.env.VITE_RESET_ID as string | undefined;
  if (!id) return;
  try {
    const seen = localStorage.getItem(BUILD_KEY);
    if (seen === id) return;
    if (seen !== null || Object.keys(localStorage).some((k) => k.startsWith("ender:") && !KEEP.has(k))) wipe();
    localStorage.setItem(BUILD_KEY, id);
  } catch {
    /* storage blocked */
  }
}
