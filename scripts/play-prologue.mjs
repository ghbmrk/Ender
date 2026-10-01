// Plays the prologue at phone size: Begin → practice fights → place the first Form → last fight → the Gate.
// node scripts/play-prologue.mjs   (uses ?autoplay=1, which only auto-times presses). Saves art-shots/prologue-*.png,
// one per new coaching tip, and prints the tips in order.
import { chromium } from "@playwright/test";
import { resolve } from "node:path";
import { overlaps } from "./overlap.mjs";
const root = resolve(import.meta.dirname, "..");
const shots = resolve(root, "art-shots");
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const tid = (t) => `[data-testid="${t}"]`;
const visible = async (sel) => (await page.$(sel)) !== null;
const tips = [];
// Each stop also checks the screen for overlapping text and controls.
const clashes = {};
const shot = async (n) => {
  await page.screenshot({ path: `${shots}/${n}.png` });
  const o = await overlaps(page);
  if (o.length) clashes[n] = o;
};
let n = 0;
const snapTip = async () => {
  const el = await page.$(tid("coach"));
  if (!el) return;
  const text = (await el.textContent())?.trim();
  if (text && !tips.includes(text)) {
    tips.push(text);
    await shot(`prologue-${String(++n).padStart(2, "0")}`);
  }
};

await page.goto((process.env.PAGE ?? "file://" + resolve(root, "apps/game/dist-web/ender.html")) + "?autoplay=1");
// A new player lands on the title, and its button leads straight into the first fight with a made-up hero.
await page.waitForSelector(tid("sign-in"), { timeout: 60000 });
await page.click(tid("sign-in"));
// A first-timer makes their hero, then the prologue's first fight opens.
await page.waitForSelector(tid("create-hero"));
await page.waitForTimeout(600);
await shot("prologue-00-create");
await page.click(tid("garb-robes"));
await page.click(tid("pal-1"));
await page.waitForTimeout(300);
await shot("prologue-00-create-picked");
await page.click(tid("hero-reveal"));
await page.waitForTimeout(500);
await shot("prologue-00-reveal-mid");
await page.waitForTimeout(1300);
await shot("prologue-00-reveal");
await page.click(tid("hero-begin"));
await page.waitForSelector(tid("battle"));

let fights = 0;
for (let step = 0; step < 1500; step++) {
  await snapTip();
  if (await visible(tid("crossing"))) {
    await page.waitForTimeout(400);
    await snapTip();
    break;
  }
  if (await visible(tid("lesson-fight"))) {
    await page.click(tid("lesson-fight"));
    await page.waitForTimeout(400);
    continue;
  }
  if (await visible(tid("loom"))) {
    const item = await page.$(".tray-item.coach-pulse");
    const cell = (await page.$("g:has(.cell-dmg.boosted) .cell.coach-cell")) ?? (await page.$(".cell.coach-cell"));
    if (item && cell) {
      const a = await item.boundingBox();
      const b = await cell.boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      for (let i = 1; i <= 12; i++) await page.mouse.move(a.x + a.width / 2 + ((b.x + b.width / 2 - a.x - a.width / 2) * i) / 12, a.y + a.height / 2 + ((b.y + b.height / 2 - a.y - a.height / 2) * i) / 12);
      await shot(`prologue-${String(++n).padStart(2, "0")}-drag`);
      await page.mouse.up();
    }
    await page.waitForTimeout(600);
    continue;
  }
  if (await visible(tid("battle"))) {
    if (await visible(tid("battle-continue"))) {
      fights++;
      await page.click(tid("battle-end"), { timeout: 1500 }).catch(() => undefined);
      await page.waitForTimeout(500);
      continue;
    }
    const cards = await page.$$('[data-testid="commands"] .card:not(.poor):not(.basic):not(.empty)');
    if (await visible(".unit.pickable")) await page.click(".unit.pickable .hit");
    else if (cards.length) await cards[0].click();
    else if (await visible(tid("cmd-basic"))) await page.click(tid("cmd-basic"));
    await page.waitForTimeout(150);
    continue;
  }
  await page.waitForTimeout(200);
}
await shot(`prologue-last`);
console.log(JSON.stringify({ fights, crossing: await visible(tid("crossing")), gate: await visible(tid("realm-gate")), tips, errors, clashes }, null, 1));
await browser.close();
