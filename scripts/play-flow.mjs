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
await page.waitForSelector(tid("new-hero"), { timeout: 60000 });
await shot("flow-title");
await page.click(tid("new-hero"));
await page.waitForSelector(tid("hero-begin"));
await page.click(tid("hero-begin"));
await page.waitForSelector(tid("crossing"));
await page.waitForTimeout(500);
await shot("flow-crossing");
await page.click(tid("station-loom"));
await page.waitForSelector(tid("loom"));
await page.waitForTimeout(600);
await shot("flow-loom");
await page.click(tid("loom-done"));
await page.click(tid("hub-gate"));
await page.waitForSelector('[data-testid^="enter-"]');
await shot("flow-gate");
await page.click('[data-testid^="enter-"]');
await page.waitForSelector(tid("map"));
await page.waitForTimeout(400);
await shot("flow-map");

let fights = 0;
let woven = 0;
let skipRaw = false;
for (let step = 0; step < 400 && (fights < maxFights || (await visible(tid("loom-done")))); step++) {
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
    // After a fight: weave each raw Form (reveal, pick the first role, place it on a glowing cell), then Continue.
    if (await visible(tid("weave-sheet"))) {
      if (!woven) await shot("flow-weave-sheet");
      if (await visible(`${tid("weave-reveal")}:not([disabled])`)) {
        await page.click(tid("weave-reveal"));
        await page.waitForTimeout(500);
        await shot("flow-weave-revealed");
        continue;
      }
      const role = await page.$('[data-testid^="weave-"].ws-role:not([disabled])');
      if (role) {
        await role.click();
        await page.waitForTimeout(500);
        continue;
      }
      await page.click(".ws-close");
      skipRaw = true;
      continue;
    }
    const cell = await page.$('[data-testid^="place-"]');
    if (cell) {
      await shot("flow-weave-place");
      await cell.click();
      woven++;
      await page.waitForTimeout(500);
      await shot("flow-weave-placed");
      continue;
    }
    const raw = !skipRaw && (await page.$('[data-testid^="raw-"]'));
    if (raw) {
      if (!woven) await shot("flow-weave");
      await raw.click();
      await page.waitForTimeout(400);
      continue;
    }
    skipRaw = false;
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
console.log(JSON.stringify({ fights, woven, errors: errors.slice(0, 10) }));
await browser.close();
