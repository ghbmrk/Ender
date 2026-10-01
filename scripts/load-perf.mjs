// First-load time at phone speed: 4x CPU and a 4G-like network (9 Mbps, 60 ms), served over HTTP.
// node scripts/load-perf.mjs [file]   (default apps/game/dist-web/ender.html; DIST=apps/game/dist-split with index.html for the split build)
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join, extname } from "node:path";
const root = resolve(import.meta.dirname, "..", process.env.DIST ?? "apps/game/dist-web");
const page0 = process.argv[2] ?? "ender.html";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".wasm": "application/wasm", ".json": "application/json", ".woff2": "font/woff2" };
const srv = createServer((q, r) => {
  const f = join(root, decodeURIComponent(q.url.split("?")[0]));
  if (!existsSync(f)) return r.writeHead(404).end();
  r.writeHead(200, { "content-type": types[extname(f)] ?? "application/octet-stream" }).end(readFileSync(f));
}).listen(0);
const port = srv.address().port;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const rows = [];
for (let i = 0; i < Number(process.env.RUNS ?? 3); i++) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 60, downloadThroughput: (9e6 / 8), uploadThroughput: (3e6 / 8) });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.RATE ?? 4) });
  let bytes = 0;
  page.on("response", async (res) => { try { bytes += (await res.body()).length; } catch {} });
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${port}/${page0}`, { waitUntil: "commit" });
  await page.waitForSelector("#root", { timeout: 120000 });
  const loader = Date.now() - t0;
  await page.waitForSelector('[data-testid="sign-in"]', { timeout: 120000 });
  const title = Date.now() - t0;
  await page.waitForFunction(() => (window).__ender, null, { timeout: 120000 });
  const game = Date.now() - t0;
  await page.waitForTimeout(300);
  rows.push({ loader, title, game, MB: +(bytes / 1e6).toFixed(2) });
  await ctx.close();
}
console.table(rows);
const med = (k) => rows.map((r) => r[k]).sort((a, b) => a - b)[Math.floor(rows.length / 2)];
console.log(`median: loading screen ${med("loader")}ms, title ready ${med("title")}ms, game loaded ${med("game")}ms, ${med("MB")} MB`);
await browser.close();
srv.close();
