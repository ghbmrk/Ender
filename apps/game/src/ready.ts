/**
 * The game loads in two parts: the title (small, shown at once) and everything else (the in-page server, its
 * seeds and every other screen), which loads behind the title. `gameReady` resolves once the rest is in.
 */
let resolveReady!: () => void;
let rejectReady!: (e: unknown) => void;
const ready = new Promise<void>((res, rej) => {
  resolveReady = res;
  rejectReady = rej;
});
ready.catch(() => undefined);
export const gameReady = () => ready;
export const markReady = () => resolveReady();
export const markFailed = (e: unknown) => rejectReady(e);

/**
 * Reload the page once to pick up a newer build (a publish replaces the files an open page still asks for).
 * Returns false if it already tried within the last minute, so a real failure isn't hidden by a reload loop.
 */
export function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem("ender:reloaded") ?? 0);
    if (Date.now() - last < 60000) return false;
    sessionStorage.setItem("ender:reloaded", String(Date.now()));
  } catch {
    return false;
  }
  location.reload();
  return true;
}
if (typeof window !== "undefined") window.addEventListener("vite:preloadError", (e) => reloadOnce() && e.preventDefault());
