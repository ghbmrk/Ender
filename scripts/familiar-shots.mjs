import { chromium } from "@playwright/test";
const root = "/home/user/ender";
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await page.addInitScript(() => localStorage.setItem("ender:tutorial", "done"));
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const tid = (t) => `[data-testid="${t}"]`;
const url = "file://" + root + "/apps/game/dist-web/ender.html?familiar=1&autoplay=1";
await page.goto(url);
await page.waitForSelector(tid("sign-in"), { timeout: 60000 });
await page.click(tid("sign-in"));
await page.waitForSelector(tid("crossing"));
await page.waitForTimeout(800);
const out = await page.evaluate(async () => {
  const call = async (m, u, b) => (await fetch(u, { method: m, headers: b ? { "content-type": "application/json" } : {}, body: b ? JSON.stringify(b) : undefined })).json();
  for (const realm of ["ashen-vault", "glass-fen"]) {
    const s = await call("POST", "/api/runs", { realmId: realm });
    const byId = new Map(s.plan.map.layers.flat().map((n) => [n.id, n]));
    let opts = s.plan.map.layers[0];
    while (opts.length) {
      const n = opts.find((x) => x.encounter) ?? opts[0];
      await call("POST", `/api/runs/${s.plan.runId}/node`, { nodeId: n.id, outcome: n.encounter ? "victory" : "skip" });
      opts = n.links.map((id) => byId.get(id));
    }
    await call("POST", `/api/runs/${s.plan.runId}/complete`, { outcome: "victory" });
  }
  await call("POST", "/api/familiar/mandate", { id: "cheaper" });
  // Pretend a day has passed: clear the Watch day so the next return refills it.
  return call("GET", "/api/familiar");
});
console.log("before", JSON.stringify(out).slice(0, 200));
await page.screenshot({ path: root + "/art-shots/fam-0-gate.png" });
// Close the Gate panel if it is open, to see the Crossing chip.
for (const sel of [tid("gate-close"), ".panel-close", '[aria-label="Close"]']) if (await page.$(sel)) { await page.click(sel); break; }
await page.waitForTimeout(400);
await page.screenshot({ path: root + "/art-shots/fam-1-chip.png" });
await page.reload();
await page.waitForTimeout(1500);
if (await page.$(tid("sign-in"))) { await page.click(tid("sign-in")); }
await page.waitForSelector(tid("familiar-away"), { timeout: 15000 }).catch(() => console.log("no away sheet"));
await page.waitForTimeout(400);
await page.screenshot({ path: root + "/art-shots/fam-2-away.png" });
console.log("errors", errors);
await browser.close();
