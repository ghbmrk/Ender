// Drive the running game at phone size and save screenshots: node scripts/shoot-app.mjs <url> <name> [steps-json]
// steps: [{ "wait": ms } | { "click": selector } | { "shot": name } | { "tapAt": [x, y] } | { "eval": js }]
import { chromium } from "@playwright/test";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const [url, name = "app", stepsJson = "[]"] = process.argv.slice(2);
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const logs = [];
page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && logs.push(`${m.type()}: ${m.text()}`));
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(url);
await page.waitForTimeout(1500);
for (const s of JSON.parse(stepsJson)) {
  if (s.wait) await page.waitForTimeout(s.wait);
  if (s.click) await page.click(s.click, { timeout: 15000 });
  if (s.tapAt) await page.mouse.click(s.tapAt[0], s.tapAt[1]);
  if (s.eval) console.log(await page.evaluate(s.eval));
  if (s.waitFor) await page.waitForSelector(s.waitFor, { timeout: s.timeout ?? 30000 });
  if (s.shot) await page.screenshot({ path: resolve(root, `art-shots/${s.shot}.png`) });
}
await page.screenshot({ path: resolve(root, `art-shots/${name}.png`) });
console.log(logs.slice(0, 20).join("\n"));
await browser.close();
