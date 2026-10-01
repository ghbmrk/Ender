// Traces one tap and sums main-thread work by kind (script, style, layout, paint) up to the first frame after it.
// PAGE=... node scripts/trace-tap.mjs
import { chromium } from "@playwright/test";
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await b.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await page.addInitScript(() => localStorage.setItem("ender:tutorial", "done"));
const cdp = await page.context().newCDPSession(page);
await page.goto(process.env.PAGE);
const tid = (t) => `[data-testid="${t}"]`;
await page.tap(tid("sign-in")); await page.waitForSelector(tid("crossing")); await page.waitForTimeout(1500);
await page.tap(tid("hub-gate")); await page.waitForSelector(tid("map")); await page.waitForTimeout(800);
await page.tap(".map-node.next"); await page.waitForSelector('[data-phase="command"]', { timeout: 30000 }); await page.waitForTimeout(2000);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
const events = [];
cdp.on("Tracing.dataCollected", (d) => events.push(...d.value));
const done = new Promise((r) => cdp.once("Tracing.tracingComplete", r));
await cdp.send("Tracing.start", { categories: "devtools.timeline,disabled-by-default-devtools.timeline,blink.user_timing", transferMode: "ReportEvents" });
const bx = await page.locator(tid("cmd-basic")).boundingBox();
await page.waitForTimeout(100);
await page.touchscreen.tap(bx.x + bx.width / 2, bx.y + bx.height / 2);
await page.waitForTimeout(400);
await cdp.send("Tracing.end"); await done;
const main = events.find((e) => e.name === "TracingStartedInBrowser")?.args?.data?.frames?.[0];
const tap = events.find((e) => e.name === "EventDispatch" && /pointerdown|touchstart/.test(e.args?.data?.type ?? ""));
const t0 = tap?.ts ?? 0;
const tid0 = tap?.tid;
const sum = {}; const list = [];
for (const e of events) {
  if (e.ph !== "X" || e.tid !== tid0 || e.ts < t0 || e.ts > t0 + 400000) continue;
  sum[e.name] = (sum[e.name] ?? 0) + (e.dur ?? 0) / 1000;
  if ((e.dur ?? 0) > Number(process.env.MIN ?? 3000)) list.push(`${((e.ts - t0) / 1000).toFixed(1).padStart(6)} +${(e.dur / 1000).toFixed(1).padStart(5)} ${e.name} ${e.args?.data?.type ?? e.args?.beginData?.stackTrace?.[0]?.functionName ?? ""}`);
}
console.log(Object.entries(sum).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => `${v.toFixed(1).padStart(7)} ${k}`).join("\n"));
console.log("\nlong events (ms from tap, duration):\n" + list.sort().join("\n"));
await b.close();
