// Screenshots of a foe's blow at 4x slow motion: wind-up, just before contact, contact. node scripts/def-shots.mjs
import { chromium } from "@playwright/test";
import { resolve } from "node:path";
import { overlaps } from "./overlap.mjs";
const root = resolve(import.meta.dirname, "..");
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await page.addInitScript(() => localStorage.setItem("ender:tutorial", "done"));
await page.goto("file://" + resolve(root, "apps/game/dist-web/ender.html") + `?demo=${process.env.DEMO ?? "foe"}&god=1&speed=4`);
await page.waitForSelector("[data-phase]", { timeout: 60000 });
let n = 0;
const t0 = Date.now();
while (n < Number(process.env.N ?? 6) && Date.now() - t0 < 90000) {
  const ph = await page.evaluate(() => document.querySelector("[data-phase]")?.getAttribute("data-phase"));
  if (ph === "command") await page.tap('[data-testid="cmd-basic"]').catch(() => {});
  if (ph === "defend") {
    for (const wait of (process.env.WAITS ?? "700,2000,1200").split(",").map(Number)) { await page.waitForTimeout(wait); await page.screenshot({ path: resolve(root, `art-shots/def-${n++}.png`) }); const c = await overlaps(page); if (c.length) console.log("clashes", JSON.stringify(c)); }
    while ((await page.evaluate(() => document.querySelector("[data-phase]")?.getAttribute("data-phase"))) === "defend") await page.waitForTimeout(200);
  }
  await page.waitForTimeout(150);
}
await browser.close();
