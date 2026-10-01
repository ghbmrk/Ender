// End-to-end check of on-device character art in the Pages build (apps/game: pnpm build:pages), on a software
// GPU: sign in, reach the map, wait for the hero and the first foes to paint, then open a fight with them.
// Serve a folder holding play/ (dist-pages) and model/ (apps/hero-painter/model), then:
//   PAGE=http://localhost:8770/play/index.html node scripts/ondevice-art.mjs [paints=2] [minutes=60]
// A paint takes ~15 min on SwiftShader; on a phone GPU it is far quicker. Screenshots go to art-shots/ondevice-*.png.
import { chromium } from "@playwright/test";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const shots = resolve(root, "art-shots");
const want = Number(process.argv[2] ?? 2);
const minutes = Number(process.argv[3] ?? 60);
// A kept profile (PROFILE dir) keeps the hero and finished paints between runs, as a phone would.
const browser = await chromium.launchPersistentContext(process.env.PROFILE ?? resolve(root, "art-shots/.ondevice-profile"), {
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--use-webgpu-adapter=swiftshader"],
  viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
});
const page = browser.pages()[0] ?? (await browser.newPage());
await page.addInitScript(() => localStorage.setItem("ender:tutorial", "done"));
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && errors.push(m.text()));
const shot = (n) => page.screenshot({ path: `${shots}/ondevice-${n}.png` });
const tid = (t) => `[data-testid="${t}"]`;
const stats = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__enderArt?.stats ?? null)));

await page.goto(process.env.PAGE + "?autoplay=1");
await page.waitForSelector(tid("sign-in"), { timeout: 60000 });
await page.click(tid("sign-in"));
await page.waitForSelector(`${tid("crossing")}, ${tid("map")}`);
if (!(await page.$(tid("map")))) {
  await page.click(tid("hub-gate"));
  await page.waitForSelector('[data-testid^="enter-"]');
  await page.click('[data-testid^="enter-"]');
  await page.waitForSelector(tid("map"));
}
await page.waitForTimeout(600);
await shot("map-before");

const t0 = Date.now();
for (;;) {
  const s = await stats();
  console.log(`${((Date.now() - t0) / 60000).toFixed(1)} min`, JSON.stringify(s));
  if (s?.error || (s?.paints?.length ?? 0) >= want || Date.now() - t0 > minutes * 60000) break;
  await page.waitForTimeout(30000);
}
// Hold further painting so the page can draw (each software-GPU block can stall it for seconds).
await page.evaluate(() => (window.__enderArt.ctl.hold = true));
await page.waitForTimeout(90000);
await shot("map-after");
// Open the first reachable fight.
const node = await page.$('.map-node.next:has(.mn-foe)');
if (node) {
  await node.click();
  await page.waitForSelector(".battle", { timeout: 20000 }).catch(() => null);
  await page.waitForTimeout(2500);
  await shot("battle");
}
console.log("errors:", errors.slice(0, 20));
await browser.close();
