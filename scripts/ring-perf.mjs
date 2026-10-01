// Timing-ring smoothness at phone speed (4x CPU): dropped frames while a ring is closing, and the time from a
// tap to its judgement on screen. node scripts/ring-perf.mjs   (SECS=20 RATE=4)
import { chromium } from "@playwright/test";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const RATE = Number(process.env.RATE ?? 4);
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  localStorage.setItem("ender:tutorial", "done");
  const w = window;
  w.__frames = [];
  w.__taps = [];
  let last = 0;
  const phase = () => document.querySelector("[data-phase]")?.getAttribute("data-phase");
  const f = (t) => { if (last) w.__frames.push([phase(), t - last]); last = t; requestAnimationFrame(f); };
  requestAnimationFrame(f);
  // A tap's judgement: the first new judgement mark (floater) after the press, and the frame that shows it.
  addEventListener("pointerdown", (e) => { if (phase() === "attack" || phase() === "defend") w.__taps.push({ t0: e.timeStamp, seen: 0, paint: 0 }); }, true);
  new MutationObserver((ms) => {
    const tap = w.__taps.at(-1);
    if (!tap || tap.seen) return;
    for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && (n.matches?.(".floater, .judge") || n.querySelector?.(".floater, .judge"))) {
      tap.seen = performance.now();
      requestAnimationFrame(() => requestAnimationFrame((p) => (tap.paint = p)));
      return;
    }
  }).observe(document, { subtree: true, childList: true });
});
await page.goto("file://" + resolve(root, "apps/game/dist-web/ender.html") + "?demo=foe&god=1");
await page.waitForSelector("[data-phase]", { timeout: 60000 });
const cdp = await page.context().newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: RATE });
await page.evaluate(() => { window.__frames = []; window.__taps = []; });
const t0 = Date.now();
const box = await page.locator('[data-testid="battle"]').boundingBox();
while (Date.now() - t0 < Number(process.env.SECS ?? 20) * 1000) {
  const ph = await page.evaluate(() => document.querySelector("[data-phase]")?.getAttribute("data-phase"));
  if (ph === "command") await page.tap('[data-testid="cmd-basic"]').catch(() => {});
  else if (ph === "attack") await page.touchscreen.tap(box.x + box.width * 0.6, box.y + box.height * 0.35);
  else if (ph === "defend") await page.tap('[data-testid="parry"]').catch(() => {});
  await page.waitForTimeout(ph === "attack" || ph === "defend" ? 90 : 200);
}
const r = await page.evaluate(() => ({ frames: window.__frames, taps: window.__taps }));
await browser.close();
const ring = r.frames.filter(([p]) => p === "attack" || p === "defend").map(([, d]) => d).sort((a, b) => a - b);
const q = (a, k) => (a.length ? a[Math.min(a.length - 1, Math.floor(a.length * k))].toFixed(0) : "-");
const judged = r.taps.filter((t) => t.paint).map((t) => t.paint - t.t0).sort((a, b) => a - b);
console.log(`ring frames: n=${ring.length} p50=${q(ring, 0.5)}ms p95=${q(ring, 0.95)}ms max=${q(ring, 1)}ms  dropped(>33ms)=${ring.filter((d) => d > 33).length} (${((100 * ring.filter((d) => d > 33).length) / Math.max(1, ring.length)).toFixed(0)}%)`);
console.log(`tap → judgement on screen: n=${judged.length}/${r.taps.length} p50=${q(judged, 0.5)}ms p95=${q(judged, 0.95)}ms max=${q(judged, 1)}ms`);
if (errors.length) console.log("errors", errors.slice(0, 3));
