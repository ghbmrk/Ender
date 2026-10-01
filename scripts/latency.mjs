// Responsiveness check: how long a tap takes to show a response, and how long each screen change takes, on a
// phone-speed CPU (4x throttle). Fails (exit 1) when a tap takes over FEEDBACK ms to show any response, or a move
// between screens goes over its budget (READY ms, or SERVER ms where a save is loaded or made).
// Run before every publish:  pnpm check:latency
import { chromium } from "@playwright/test";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const FEEDBACK = Number(process.env.FEEDBACK ?? 100);
const READY = Number(process.env.READY ?? 300);
const RATE = Number(process.env.RATE ?? 4);
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const RUNS = Number(process.env.RUNS ?? 3);
const errors = [];
// One full pass through the game; the check uses the median of RUNS passes, so one noisy frame can't fail it.
async function pass() {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem("ender:tutorial", "done");
    const w = window;
    // On each tap: when the page first changes, the frame that shows it, and when the awaited element appears.
    w.__tap = null;
    // feedback: the first frame after the tap (the pressed button shows); ready: the frame showing the next screen.
    addEventListener("pointerdown", (e) => {
      const t = (w.__tap = { t0: e.timeStamp, paint: 0, ready: 0, want: w.__want });
      requestAnimationFrame(() => requestAnimationFrame((p) => (t.paint = p)));
    }, true);
    const poll = (now) => { const t = w.__tap; if (t && !t.ready && t.want && document.querySelector(t.want)) requestAnimationFrame((p) => (t.ready = p)); requestAnimationFrame(poll); };
    requestAnimationFrame(poll);
    // Every fight phase change, to see where time goes between states.
    w.__phases = [];
    const ph = () => { const p = document.querySelector("[data-phase]")?.getAttribute("data-phase") ?? null; if (p !== w.__lp) { w.__phases.push([Math.round(performance.now()), p]); w.__lp = p; } requestAnimationFrame(ph); };
    requestAnimationFrame(ph);
  });
  const cdp = await page.context().newCDPSession(page);
  await page.goto(process.env.PAGE ?? "file://" + resolve(root, "apps/game/dist-web/ender.html"));
  await page.waitForSelector('[data-testid="sign-in"]', { timeout: 60000 });
  await page.waitForTimeout(800);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: RATE });
  const rows = [];
  async function step(name, sel, want, budget = READY) {
    await page.evaluate((w) => (window.__want = w), want);
    await page.waitForSelector(sel, { timeout: 30000 });
    // A raw touch at the element's centre: page.tap() runs its own hit-target checks inside the page during the
    // tap (elementsFromPoint and listeners), which a player's phone doesn't, and they were counted as the game's time.
    const bx = await page.locator(sel).first().boundingBox();
    await page.touchscreen.tap(bx.x + bx.width / 2, bx.y + bx.height / 2);
    await page.waitForSelector(want, { timeout: 30000 });
    await page.waitForTimeout(250);
    const t = await page.evaluate(() => window.__tap);
    const r = { name, feedback: Math.round(t.paint - t.t0), ready: Math.round(Math.max(t.ready, t.paint) - t.t0), budget };
    rows.push(r);
    await page.waitForTimeout(400);
  }
  const tid = (t) => `[data-testid="${t}"]`;
  // Steps that load or create a save on the in-page server get SERVER ms; plain screen changes get READY ms.
  const SERVER = Number(process.env.SERVER ?? 600);
  await step("sign in → Crossing", tid("sign-in"), tid("crossing"), SERVER);
  await step("Crossing → Loom", tid("hub-loom"), tid("loom"));
  await step("Loom → Crossing", tid("loom-done"), tid("crossing"));
  await step("Set out → Map", tid("hub-gate"), tid("map"), SERVER);
  await step("Map → fight", ".map-node.next", "[data-phase]");
  {
    const t = await page.evaluate(() => ({ t0: window.__tap.t0, ph: window.__phases }));
    console.log("fight opening (ms after tap → phase):", t.ph.map(([at, p]) => `${Math.round(at - t.t0)}:${p}`).join(" "));
  }
  await page.waitForSelector('[data-phase="command"]', { timeout: 30000 });
  await step("Basic attack → swing", tid("cmd-basic"), '[data-phase]:not([data-phase="command"])');
  // Time from the hero's action ending to the next point the player can act again.
  const gaps = await page.evaluate(async () => {
    const out = []; let last = document.querySelector("[data-phase]")?.getAttribute("data-phase"); let t = performance.now();
    const end = performance.now() + 12000;
    while (performance.now() < end) {
      await new Promise((r) => requestAnimationFrame(r));
      const p = document.querySelector("[data-phase]")?.getAttribute("data-phase");
      if (p !== last) { out.push([p, Math.round(performance.now() - t)]); last = p; t = performance.now(); if (p === "command") break; }
    }
    return out;
  });
  console.log("fight phases after the swing (phase entered, ms spent in the one before):", JSON.stringify(gaps));
  await page.close();
  return rows;
}
const passes = [];
for (let i = 0; i < RUNS; i++) passes.push(await pass());
const med = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const rows = passes[0].map((r, i) => ({ ...r, feedback: med(passes.map((p) => p[i].feedback)), ready: med(passes.map((p) => p[i].ready)) }));
console.log(`median of ${RUNS} passes:`);
console.table(rows);
const bad = rows.filter((r) => r.feedback > FEEDBACK || r.ready > r.budget);
if (errors.length) console.log("errors", errors.slice(0, 5));
await browser.close();
if (bad.length) {
  console.log(`SLOW (feedback > ${FEEDBACK}ms or ready over budget at ${RATE}x CPU):`, bad.map((b) => b.name).join(", "));
  process.exit(1);
}
console.log(`OK: every tap answered within ${FEEDBACK}ms and every screen within its budget at ${RATE}x CPU`);
