// Sign in on a throttled phone network (MBPS, default 10) with WebGPU on, against the Pages build: how long from tap to game.
// PAGE=http://127.0.0.1:8740/ender-hero-painter/ MBPS=10 node scripts/pages-signin-slow.mjs
import { chromium } from "@playwright/test";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--enable-unsafe-webgpu", "--use-webgpu-adapter=swiftshader"] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await cdp.send("Network.enable");
const mbps = Number(process.env.MBPS ?? 10);
await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 60, downloadThroughput: (mbps * 1e6) / 8, uploadThroughput: 1e6 / 8 });
const reqs = []; p.on("console", (m) => /painter/i.test(m.text()) && console.log("console:", m.text().slice(0, 200))); p.on("requestfinished", (r) => reqs.push([Date.now(), r.url().replace(/.*ender-hero-painter\//, "")]));
const t0 = Date.now();
await p.goto(process.env.PAGE ?? "http://127.0.0.1:8740/ender-hero-painter/");
await p.waitForSelector('[data-testid="sign-in"]', { timeout: 120000 });
const tTitle = Date.now() - t0;
await p.waitForTimeout(1500);
const t1 = Date.now();
await p.tap('[data-testid="sign-in"]');
const ok = await p.waitForSelector('[data-testid="crossing"],[data-testid="map"],[data-testid="loom"],.battle', { timeout: 90000 }).then(() => 1, () => 0);
console.log({ mbps, tTitle, tapToGame: ok ? Date.now() - t1 : "stuck>90s", model: reqs.filter((r) => r[1].startsWith("model/")).length, firstReqs: reqs.slice(0, 14).map((r) => `${r[0] - t0} ${r[1]}`) });
await b.close();
