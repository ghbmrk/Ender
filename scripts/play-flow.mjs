// Plays the built web game at phone size: new party → Loom → Gate → map → fights until the Expedition ends.
// node scripts/play-flow.mjs [maxFights]   (uses ?autoplay=1, which only auto-times presses; commands are chosen here)
import { chromium } from "@playwright/test";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const shots = resolve(root, "art-shots");
const maxFights = Number(process.argv[2] ?? 3);
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
// The prologue has its own script (play-prologue.mjs); this one starts from the Crossing.
await page.addInitScript(() => localStorage.setItem("ender:tutorial", "done"));
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const shot = (n) => page.screenshot({ path: `${shots}/${n}.png` });
const tid = (t) => `[data-testid="${t}"]`;
const visible = async (sel) => (await page.$(sel)) !== null;

await page.goto("file://" + resolve(root, "apps/game/dist-web/ender.html") + "?autoplay=1");
await page.waitForSelector(tid("new-binder"), { timeout: 60000 });
await shot("flow-title");
await page.click(tid("new-binder"));
await page.waitForSelector(tid("crossing"));
await page.waitForTimeout(500);
await shot("flow-crossing");
await page.click(tid("station-loom"));
await page.waitForSelector(tid("loom"));
await page.waitForTimeout(600);
await shot("flow-loom");
await page.click(tid("loom-done"));
await page.click(tid("station-gate"));
await page.waitForSelector('[data-testid^="enter-"]');
await shot("flow-gate");
await page.click('[data-testid^="enter-"]');
await page.waitForSelector(tid("map"));
await page.waitForTimeout(400);
await shot("flow-map");

let fights = 0;
for (let step = 0; step < 400 && fights < maxFights; step++) {
  if (await visible(tid("rewards-ok"))) {
    if (fights === 1) await shot("flow-rewards");
    await page.click(tid("rewards-ok"));
    continue;
  }
  if (await visible(tid("run-summary"))) break;
  if (await visible(".panel-backdrop")) {
    await page.keyboard.press("Escape");
    continue;
  }
  if (await visible(tid("loom-done"))) {
    await page.click(tid("loom-done"));
    await page.waitForTimeout(300);
    continue;
  }
  if (await visible(tid("battle"))) {
    if (await visible(tid("battle-continue"))) {
      fights++;
      await shot(`flow-battle-end-${fights}`);
      await page.click(tid("battle-continue"));
      await page.waitForTimeout(500);
      continue;
    }
    const cards = await page.$$('[data-testid="commands"] .card:not(.poor):not(.basic)');
    if (cards.length) {
      if (fights === 0 && step < 40) await shot("flow-battle-command");
      await cards[0].click();
      await page.waitForTimeout(200);
      if (await visible(".unit.pickable")) await page.click(".unit.pickable .hit");
    } else if (await visible(tid("cmd-basic"))) await page.click(tid("cmd-basic"));
    await page.waitForTimeout(400);
    continue;
  }
  if (await visible(tid("map"))) {
    const next = await page.$(".map-node.next");
    if (!next) {
      await page.waitForTimeout(300);
      continue;
    }
    await next.click();
    await page.waitForTimeout(700);
    continue;
  }
  await page.waitForTimeout(300);
}
await shot("flow-end");
console.log(JSON.stringify({ fights, errors: errors.slice(0, 10) }));
await browser.close();
