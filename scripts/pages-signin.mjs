// Taps Sign in on the Pages build (the painter-carrying build at the one link Mark plays) like a phone would,
// and checks the game opens. Serve the Pages checkout under /ender-hero-painter/ and pass its URL as PAGE.
// PAGE=http://127.0.0.1:8740/ender-hero-painter/ node scripts/pages-signin.mjs
import { chromium } from "@playwright/test";
const page0 = process.env.PAGE ?? "http://127.0.0.1:8740/ender-hero-painter/";
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const out = { fresh: null, returning: null, errors: [] };
for (const kind of ["fresh", "returning"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => out.errors.push(`${kind}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && out.errors.push(`${kind}: ${m.text()}`));
  await page.goto(page0);
  if (kind === "returning") {
    // A second visit: the first one's save is there.
    await page.waitForSelector('[data-testid="sign-in"]', { timeout: 60000 });
    await page.waitForLoadState("networkidle");
    await page.reload();
  }
  await page.waitForSelector('[data-testid="sign-in"]', { timeout: 60000 });
  await page.waitForTimeout(800);
  const t0 = Date.now();
  await page.tap('[data-testid="sign-in"]');
  const ok = await page
    .waitForSelector('[data-testid="crossing"], [data-testid="battle"], .battle, [data-testid="loom"], [data-testid="map"]', { timeout: 15000 })
    .then(() => true, () => false);
  out[kind] = ok ? Date.now() - t0 : "stuck";
  if (!ok) await page.screenshot({ path: `art-shots/pages-signin-${kind}.png` });
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
process.exit(out.fresh === "stuck" || out.returning === "stuck" || out.errors.length ? 1 : 0);
