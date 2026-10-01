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
