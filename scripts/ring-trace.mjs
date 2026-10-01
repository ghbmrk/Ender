// Rendering cost while rings run, at 4x CPU: main-thread and raster/compositor time by event, from a Chrome trace.
// node scripts/ring-trace.mjs   (SECS=10)
import { chromium } from "@playwright/test";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await page.addInitScript(() => localStorage.setItem("ender:tutorial", "done"));
await page.goto((process.env.PAGE ?? "file://" + resolve(root, "apps/game/dist-web/ender.html")) + "?demo=foe&god=1");
await page.waitForSelector("[data-phase]", { timeout: 60000 });
await page.waitForTimeout(1500);
const cdp = await page.context().newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
const events = [];
cdp.on("Tracing.dataCollected", (d) => events.push(...d.value));
const done = new Promise((r) => cdp.once("Tracing.tracingComplete", r));
await cdp.send("Tracing.start", { categories: "devtools.timeline,disabled-by-default-devtools.timeline,cc,viz,gpu", transferMode: "ReportEvents" });
const box = await page.locator('[data-testid="battle"]').boundingBox();
const t0 = Date.now();
while (Date.now() - t0 < Number(process.env.SECS ?? 10) * 1000) {
  const ph = await page.evaluate(() => document.querySelector("[data-phase]")?.getAttribute("data-phase"));
  if (ph === "command") await page.tap('[data-testid="cmd-basic"]').catch(() => {});
  else if (ph === "attack") await page.touchscreen.tap(box.x + box.width * 0.6, box.y + box.height * 0.35);
  else if (ph === "defend") await page.tap('[data-testid="parry"]').catch(() => {});
  await page.waitForTimeout(ph === "attack" || ph === "defend" ? 90 : 200);
}
await cdp.send("Tracing.end");
await done;
await browser.close();
const by = new Map();
for (const e of events) if (e.ph === "X" && e.dur) { const k = `${e.name}`; const v = by.get(k) ?? { ms: 0, n: 0, max: 0 }; v.ms += e.dur / 1000; v.n++; v.max = Math.max(v.max, e.dur / 1000); by.set(k, v); }
for (const [k, v] of [...by].sort((a, b) => b[1].ms - a[1].ms).slice(0, 30)) console.log(v.ms.toFixed(0).padStart(7), String(v.n).padStart(6), v.max.toFixed(1).padStart(7), k);
