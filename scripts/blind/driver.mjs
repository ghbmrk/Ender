// Blind-player driver: one persistent phone browser on the built game, controlled over HTTP.
// node scripts/blind/driver.mjs <outDir> [port]   then use scripts/blind/play.sh
// Game time is frozen between commands (Playwright clock), so a slow player still gets fair reaction time:
// time only moves during `wait` and for a short reaction gap after each tap.
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { mkdirSync, appendFileSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
const root = resolve(import.meta.dirname, "../..");
const out = resolve(process.argv[2] ?? "/tmp/blind");
const port = Number(process.argv[3] ?? 7777);
mkdirSync(out, { recursive: true });
const log = (s) => appendFileSync(`${out}/actions.log`, `${new Date().toISOString()} ${s}\n`);
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => { errors.push(e.message); log(`PAGEERROR ${e.message}`); });
await page.clock.install();
// The split build, served over http, is exactly what the published artifact runs.
const split = resolve(root, "apps/game/dist-split");
const types = { ".js": "text/javascript", ".css": "text/css", ".wasm": "application/wasm", ".webp": "image/webp", ".woff2": "font/woff2", ".html": "text/html" };
const files = createServer((req, res) => {
  const path = resolve(split, "." + decodeURIComponent(new URL(req.url, "http://x").pathname.replace(/\/$/, "/index.html")));
  if (!path.startsWith(split)) return res.writeHead(403).end();
  try {
    const body = readFileSync(path);
    res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(port + 1);
await page.goto(`http://127.0.0.1:${port + 1}/index.html`);
await page.clock.runFor(4000);
let n = 0;
const run = (ms) => page.clock.runFor(ms);
async function shot() {
  const p = `${out}/s${String(++n).padStart(3, "0")}.png`;
  // CSS transitions run on real time, not the frozen clock: let them settle as an eye would.
  await new Promise((r) => setTimeout(r, 350));
  await page.screenshot({ path: p });
  return p;
}
async function visibleText() {
  return page.evaluate(() => document.body.innerText.replace(/\n{2,}/g, "\n").trim());
}
const cmds = {
  async shot() { return { shot: await shot() }; },
  async text() { return { text: await visibleText() }; },
  async wait({ ms = 500 }) { await run(Math.min(Number(ms), 10000)); return { shot: await shot() }; },
  async tap({ x, y, after = 250 }) {
    await page.touchscreen.tap(Number(x), Number(y));
    await run(Number(after));
    return { shot: await shot() };
  },
  async taptext({ t, after = 250 }) {
    // Like a person reading the screen, prefer something that looks pressable over plain words.
    const pressable = page.locator("button, [role=button], a").filter({ hasText: String(t), visible: true }).first();
    const words = page.getByText(String(t), { exact: false }).filter({ visible: true }).first();
    const box = (await pressable.boundingBox({ timeout: 300 }).catch(() => null)) ?? (await words.boundingBox({ timeout: 1000 }).catch(() => null));
    if (!box) return { error: `no visible text "${t}"`, shot: await shot() };
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await run(Number(after));
    return { tapped: [Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2)], shot: await shot() };
  },
  async swipe({ x1, y1, x2, y2 }) {
    const steps = 8;
    await page.mouse.move(+x1, +y1); await page.mouse.down();
    for (let i = 1; i <= steps; i++) { await page.mouse.move(+x1 + ((x2 - x1) * i) / steps, +y1 + ((y2 - y1) * i) / steps); await run(16); }
    await page.mouse.up(); await run(250);
    return { shot: await shot() };
  },
  async hold({ x, y, ms = 600 }) {
    await page.mouse.move(+x, +y); await page.mouse.down(); await run(+ms); await page.mouse.up(); await run(200);
    return { shot: await shot() };
  },
};
createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  const c = u.pathname.slice(1);
  const args = Object.fromEntries(u.searchParams);
  try {
    if (!cmds[c]) throw new Error(`unknown command ${c}`);
    const r = await cmds[c](args);
    log(`${c} ${JSON.stringify(args)} -> ${r.shot ?? ""}${r.error ? " ERR " + r.error : ""}`);
    res.end(JSON.stringify(r) + "\n");
  } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: String(e.message ?? e) }) + "\n"); }
}).listen(port, () => console.log(`blind driver on ${port}, out ${out}`));
