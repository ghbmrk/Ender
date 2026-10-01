// Screenshots single screens at phone size: node scripts/shot-pages.mjs name@?query@waitMs ...
import { chromium } from "@playwright/test";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
for (const arg of process.argv.slice(2)) {
  const [name, query, wait = "1500"] = arg.split("@");
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  // LS='{"key":"value"}' seeds extra localStorage entries before the page loads.
  await page.addInitScript((extra) => {
    localStorage.setItem("ender:tutorial", "done");
    for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
  }, JSON.parse(process.env.LS ?? "{}"));
  await page.goto("file://" + resolve(root, "apps/game/dist-web/ender.html") + query);
  await page.waitForTimeout(Number(wait));
  await page.screenshot({ path: `${root}/art-shots/${name}.png` });
  await page.close();
}
await browser.close();
