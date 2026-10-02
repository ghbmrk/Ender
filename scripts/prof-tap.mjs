// Profiles one tap: where the main thread spends time between the tap and the next screen. Not part of the checks.
// PAGE=... SEL=cmd-basic node scripts/prof-tap.mjs
import { chromium } from "@playwright/test";
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await b.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await page.addInitScript(() => localStorage.setItem("ender:tutorial", "done"));
const cdp = await page.context().newCDPSession(page);
await page.goto(process.env.PAGE);
const tid = (t) => `[data-testid="${t}"]`;
await page.tap(tid("sign-in")); await page.waitForSelector(tid("crossing"));
await page.waitForTimeout(1500);
const which = process.env.SEL ?? "cmd-basic";
if (which === "cmd-basic") {
  await page.tap(tid("hub-gate")); await page.waitForSelector(tid("map")); await page.waitForTimeout(800);
  await page.tap(".map-node.next"); await page.waitForSelector('[data-phase="command"]', { timeout: 30000 }); await page.waitForTimeout(1500);
}
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 200 }); await cdp.send("Profiler.start");
{ const bx = await page.locator(tid(which)).boundingBox(); await page.touchscreen.tap(bx.x + bx.width / 2, bx.y + bx.height / 2); }
await page.waitForTimeout(Number(process.env.WIN ?? 300));
const { profile } = await cdp.send("Profiler.stop");
const self = new Map(); const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const dt = profile.timeDeltas; let i = 0;
for (const s of profile.samples) { const n = byId.get(s); const k = `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url.split("/").pop()}:${n.callFrame.lineNumber}`; self.set(k, (self.get(k) ?? 0) + (dt[i++] ?? 0) / 1000); }
// total time per function, inclusive
const parent = new Map(); for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const incl = new Map(); i = 0;
for (const s of profile.samples) { const seen = new Set(); let id = s; while (id) { const n = byId.get(id); const k = `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url.split("/").pop()}:${n.callFrame.lineNumber}`; if (!seen.has(k)) { incl.set(k, (incl.get(k) ?? 0) + (dt[i] ?? 0) / 1000); seen.add(k); } id = parent.get(id); } i++; }
const top = (m) => [...m].filter(([k]) => !k.startsWith("(idle)")).sort((a, b) => b[1] - a[1]).slice(0, Number(process.env.TOP ?? 25)).map(([k, v]) => `${v.toFixed(1).padStart(7)}  ${k}`).join("\n");
console.log("SELF\n" + top(self) + "\n\nINCLUSIVE\n" + top(incl));
await b.close();
