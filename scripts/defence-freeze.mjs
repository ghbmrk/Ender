// The defence lessons hold time at the point of contact when the player hasn't pressed, and prompt them.
// Plays the dodge (and parry) lesson by hand: attacks with Basic, never presses during the foe's swing, checks that
// the fight freezes with the prompt, waits, then presses and checks the blow was answered.
// PAGE=http://127.0.0.1:8732/index.html node scripts/defence-freeze.mjs
import { chromium } from "@playwright/test";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const out = {};
for (const step of ["dodge", "parry"]) {
  const p = await b.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.addInitScript((s) => {
    localStorage.setItem("ender:tutorial", s);
    localStorage.setItem("ender:signed-in", "1");
  }, step);
  await p.goto(process.env.PAGE ?? "http://127.0.0.1:8732/index.html");
  await p.waitForSelector('[data-testid="battle"]', { timeout: 15000 }).catch(async () => { await p.screenshot({ path: `${root}/art-shots/freeze-boot.png` }); throw new Error("no battle: " + errors.join(";")); });
  const r = { froze: false, prompt: null, heldMs: 0, answered: null };
  const t0 = Date.now();
  while (Date.now() - t0 < 40000 && !r.froze) {
    if (await p.$('[data-testid="basic"], [data-testid="cmd-basic"]')) await p.tap('[data-testid="basic"], [data-testid="cmd-basic"]').catch(() => {});
    else if ((await p.getAttribute('[data-testid="battle"]', "data-phase")) === "attack") await p.tap("body", { position: { x: 200, y: 300 } }).catch(() => {});
    r.froze = !!(await p.$(".battle.frozen"));
    if (!r.froze) await p.waitForTimeout(120);
  }
  if (r.froze) {
    r.prompt = await p.textContent(".coach").catch(() => null);
    await p.waitForTimeout(1500);
    r.heldMs = (await p.$(".battle.frozen")) ? 1500 : 0;
    await p.screenshot({ path: `${root}/art-shots/freeze-${step}.png` });
    await p.tap(`[data-testid="${step}"]`);
    await p.waitForTimeout(250);
    r.answered = await p.evaluate(() => [...document.querySelectorAll(".judge")].map((e) => e.textContent).join(" | "));
    r.unfrozen = !(await p.$(".battle.frozen"));
  }
  r.errors = errors;
  out[step] = r;
  await p.close();
}
await b.close();
console.log(JSON.stringify(out, null, 1));
