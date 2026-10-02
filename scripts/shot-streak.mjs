// Captures a battle mid-fight to check the chain badge: node scripts/shot-streak.mjs
import { chromium } from "@playwright/test";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await page.addInitScript(() => localStorage.setItem("ender:tutorial", "done"));
await page.goto("file://" + resolve(root, "apps/game/dist-web/ender.html") + "?demo=battle&autoplay=1");
let n = 0;
for (let i = 0; i < 200 && n < 3; i++) {
  if (await page.$('[data-testid="streak"]')) {
    await page.screenshot({ path: `${root}/art-shots/streak-${n++}.png` });
    await page.waitForTimeout(1500);
    continue;
  }
  const basic = await page.$('[data-testid="cmd-basic"]');
  if (basic) await basic.click().catch(() => {});
  await page.waitForTimeout(250);
}
console.log("shots", n);
await browser.close();
