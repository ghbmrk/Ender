// Screenshots the landing at common phone sizes and checks it for overlaps and the Sign in target size.
// PAGE=http://127.0.0.1:8732/index.html node scripts/landing-shots.mjs
import { chromium } from "@playwright/test";
import { resolve } from "node:path";
import { overlaps } from "./overlap.mjs";
const root = resolve(import.meta.dirname, "..");
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const out = {};
for (const [w, h] of [[375, 667], [390, 844], [430, 932], [360, 780]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await p.goto(process.env.PAGE ?? "http://127.0.0.1:8732/index.html");
  await p.waitForSelector('[data-testid="sign-in"]');
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${root}/art-shots/landing-${w}x${h}.png` });
  const r = await p.locator('[data-testid="sign-in"]').boundingBox();
  out[`${w}x${h}`] = { signIn: `${Math.round(r.width)}x${Math.round(r.height)}pt at y${Math.round(r.y)}`, clashes: (await overlaps(p)).length };
  await p.close();
}
await b.close();
console.log(JSON.stringify(out, null, 1));
