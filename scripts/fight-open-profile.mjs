// Where the time goes between tapping a map stop and the fight showing, at 4x CPU: main-thread events and the
// hottest functions. node scripts/fight-open-profile.mjs   (PAGE=http://…/index.html for the split build)
import { chromium } from "@playwright/test";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await page.addInitScript(() => localStorage.setItem("ender:tutorial", "done"));
await page.goto(process.env.PAGE ?? "file://" + resolve(root, "apps/game/dist-web/ender.html"));
const tid = (t) => `[data-testid="${t}"]`;
for (const s of [tid("sign-in"), tid("hub-gate")]) { await page.waitForSelector(s, { timeout: 60000 }); await page.waitForTimeout(600); await page.tap(s); }
await page.waitForSelector(".map-node.next", { timeout: 30000 });
await page.waitForTimeout(1500);
const cdp = await page.context().newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
const events = [];
cdp.on("Tracing.dataCollected", (d) => events.push(...d.value));
const done = new Promise((r) => cdp.once("Tracing.tracingComplete", r));
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 100 });
await cdp.send("Tracing.start", { categories: "devtools.timeline,disabled-by-default-devtools.timeline", transferMode: "ReportEvents" });
await cdp.send("Profiler.start");
const t0 = Date.now();
await page.tap(".map-node.next");
await page.waitForSelector("[data-phase]", { timeout: 30000 });
const wall = Date.now() - t0;
await page.waitForTimeout(100);
const { profile } = await cdp.send("Profiler.stop");
await cdp.send("Tracing.end"); await done; await browser.close();
console.log("tap → [data-phase] wall ms", wall);
const main = events.filter((e) => e.ph === "X" && e.dur && e.tid === events.find((x) => x.name === "EventDispatch")?.tid);
const by = new Map();
for (const e of main) { const v = by.get(e.name) ?? 0; by.set(e.name, v + e.dur / 1000); }
console.log("main thread (inclusive ms):", [...by].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(" · "));
// The long tasks on the main thread after the tap, with what fills each.
const tap = main.find((e) => e.name === "EventDispatch")?.ts ?? 0;
const tasks = main.filter((e) => e.name === "RunTask" && e.ts >= tap - 5000 && e.dur > 8000);
for (const t of tasks) {
  const kids = new Map();
  for (const e of main) if (e !== t && e.ts >= t.ts && e.ts + e.dur <= t.ts + t.dur && e.name !== "RunTask") kids.set(e.name, (kids.get(e.name) ?? 0) + e.dur / 1000);
  console.log(`  +${((t.ts - tap) / 1000).toFixed(0)}ms task ${(t.dur / 1000).toFixed(0)}ms:`, [...kids].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(" · "));
}
const self = new Map(); const byId = new Map(profile.nodes.map((n) => [n.id, n]));
profile.samples.forEach((id, i) => { const f = byId.get(id).callFrame; const k = `${f.functionName || "(anon)"} ${f.url.split("/").pop().slice(0, 30)}:${f.lineNumber}:${f.columnNumber}`; self.set(k, (self.get(k) ?? 0) + (profile.timeDeltas[i] ?? 0)); });
for (const [k, us] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log((us / 1000).toFixed(1).padStart(7), k);
// Inclusive time per function (each sample counts once for every distinct frame on its stack).
const parent = new Map(); for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const incl = new Map();
profile.samples.forEach((id, i) => { const seen = new Set(); for (let x = id; x !== undefined; x = parent.get(x)) { const f = byId.get(x).callFrame; const k = `${f.functionName || "(anon)"} ${f.url.split("/").pop().slice(0, 24)}:${f.lineNumber}:${f.columnNumber}`; if (seen.has(k)) continue; seen.add(k); incl.set(k, (incl.get(k) ?? 0) + (profile.timeDeltas[i] ?? 0)); } });
console.log("inclusive:");
for (const [k, us] of [...incl].sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log((us / 1000).toFixed(1).padStart(7), k);
