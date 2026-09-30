// Test / developer hooks (exposed on window.__ender). Never used by normal play.
export const debug = {
  autoplay: false,
  godMode: false,
  timeScale: 1,
  /** Multiplies player damage (E2E speed). */
  damageScale: 1,
};

const params = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
if (params.get("autoplay") === "1") debug.autoplay = true;
if (params.get("god") === "1") debug.godMode = true;
if (params.get("speed")) debug.timeScale = Number(params.get("speed")) || 1;
if (params.get("dmg")) debug.damageScale = Number(params.get("dmg")) || 1;
