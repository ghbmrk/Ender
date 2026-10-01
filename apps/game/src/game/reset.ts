/**
 * Start over: a brand-new player, as if the game had never been opened. The saved game is dropped (the in-page
 * server ignores it on the next load and the first save replaces it) and every progress mark is cleared; sound and
 * the on-device painter's settings stay. Then the page reloads to the title.
 */
const KEEP = new Set(["ender:mute", "ender:painter", "ender:art-last", "ender:dev"]);

export function startOver() {
  // Nothing is saved from here on, so a save already queued can't put the old game back.
  (window as { __enderNoSave?: boolean }).__enderNoSave = true;
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("ender:") && !KEEP.has(k)) localStorage.removeItem(k);
    localStorage.setItem("ender:fresh", "1");
  } catch {
    /* storage blocked: there is no save to clear */
  }
  location.replace(location.pathname);
}
