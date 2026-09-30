// §70: the required gameplay economic loop, end to end through the UI.
import { expect, test, type Page } from "@playwright/test";
import { api, newBinder, openCrucibleOn, state } from "./helpers";

async function openStation(page: Page, id: string) {
  await page.evaluate((s) => (window as any).__weave.crossing.teleportTo(s), id);
  await page.getByTestId("game-canvas").click({ position: { x: 700, y: 450 } });
  await page.waitForTimeout(250);
  await page.keyboard.down("e");
  await page.waitForTimeout(200);
  await page.keyboard.up("e");
  await page.waitForTimeout(300);
}
const crownsShown = async (page: Page) => Number((await page.getByTestId("crowns").textContent())!.replace(/[^\d]/g, ""));

test("inspect scarcity → choose a Realm → fight → craft → sell → the world turns → values shift", async ({ page }) => {
  // 1. Enter the Crossing.
  await newBinder(page, { query: "autoplay=1&god=1&speed=2&dmg=6" });
  await page.waitForFunction(() => (window as any).__weave.crossing);

  // 2–3. Inspect the Bazaar and observe an expensive Essence.
  await openStation(page, "bazaar");
  await expect(page.getByTestId("essence-table")).toBeVisible();
  await expect(page.getByTestId("essence-storm")).toHaveAttribute("data-status", "dear");
  await expect(page.getByTestId("bazaar-headline")).toContainText("Storm");
  await page.evaluate(() => (window as any).__weave.setState({ panel: null }));

  // 4. Choose a Realm because of the market: the Gate shows demand for Storm-free Forms.
  await openStation(page, "gate");
  await expect(page.getByTestId("realm-glass-fen")).toContainText("Storm-free");
  await page.getByTestId("enter-glass-fen").click();

  // 5–7. Complete combat, acquire Veiled Forms, Attune one at the shrine.
  let attunedAtShrine = false;
  await expect
    .poll(
      async () => {
        const s = await state(page);
        if (s.panel === "shrine") {
          const btn = page.locator("[data-testid^=attune-]").first();
          if (!attunedAtShrine && (await btn.isVisible())) {
            await btn.click();
            attunedAtShrine = true;
            await page.waitForTimeout(800);
          }
          await page.getByTestId("leave-shrine").click();
        }
        return s.panel;
      },
      { timeout: 300_000, intervals: [1000] },
    )
    .toBe("summary");
  expect((await state(page)).runSummary.status).toBe("victory");
  expect(attunedAtShrine).toBe(true);
  await page.getByTestId("return-crossing").click();

  const inv0 = await api(page, "inventory");
  const attuned = inv0.artifacts.filter((a: any) => a.tier === "attuned");
  const veiled = inv0.artifacts.filter((a: any) => a.tier === "veiled");
  expect(attuned.length + veiled.length).toBeGreaterThan(1);

  // 8. Temper the attuned Form in the Crucible.
  const base = attuned[0];
  await openCrucibleOn(page, base.id);
  await page.getByTestId("act-temper").click();
  await expect(page.getByTestId("temper-choices")).toBeVisible();
  await page.locator("[data-testid^=choose-]").first().click();
  await expect(page.getByTestId("temper-choices")).toBeHidden();

  // 9. Trial the new Form; also Attune + Trial a second Form so there is something to compare.
  const inv1 = await api(page, "inventory");
  const child = inv1.artifacts.find((a: any) => a.parentId === base.id);
  expect(child).toBeTruthy();
  await page.getByTestId("crucible").getByTestId(`form-${child.id}`).first().click();
  await page.getByTestId("act-trial").click();
  await expect(page.getByTestId("trial-score")).toBeVisible();
  const other = veiled[0] ?? attuned[1];
  await page.getByTestId("crucible").getByTestId(`form-${other.id}`).first().click();
  if (other.tier === "veiled") await page.getByTestId("act-attune").click();
  await page.getByTestId("act-trial").click();
  await expect(page.getByTestId("trial-score")).toBeVisible();

  // 10. Compare high-power/high-cost against lower-power/low-cost.
  await expect(page.getByTestId("compare")).toBeVisible();
  const trialed = (await api(page, "inventory")).artifacts.filter((a: any) => a.tier === "trialed");
  expect(trialed.length).toBeGreaterThanOrEqual(2);
  const [a, b] = trialed;
  expect(`${a.evaluation.power}/${a.evaluation.productionCost}`).not.toBe(`${b.evaluation.power}/${b.evaluation.productionCost}`);
  await expect(page.getByTestId("compare")).toContainText(String(Math.floor(a.evaluation.power)));

  // 11–12. Sell the more profitable one; Crowns increase.
  const pick = [...trialed].sort((x: any, y: any) => y.evaluation.margin - x.evaluation.margin)[0];
  await page.evaluate(() => (window as any).__weave.setState({ panel: "bazaar" }));
  await page.getByTestId("tab-forms").click();
  const before = await crownsShown(page);
  await page.getByTestId(`sell-form-${pick.id}`).click();
  await expect.poll(() => crownsShown(page)).toBeGreaterThan(before);

  // 13. Advance the world snapshot.
  const snapshot = async () => {
    const w = await api(page, "world");
    const forms = ((await api(page, "inventory")).artifacts as any[]).filter((x) => x.tier !== "veiled" && x.status !== "sold");
    return { date: w.snapshot.date, prices: Object.fromEntries(w.essences.map((e: any) => [e.id, e.price])), forms: Object.fromEntries(forms.map((f) => [f.id, f.evaluation])) };
  };
  const s0 = await snapshot();
  await page.getByTestId("advance-world").click();
  await expect.poll(async () => (await api(page, "world")).snapshot.date).not.toBe(s0.date);
  const s1 = await snapshot();

  // 14. Relative value changes: Essences reprice unevenly, so Forms' costs and margins move against each other.
  const ratios = Object.keys(s0.prices).map((e) => Math.round((s1.prices[e] / s0.prices[e]) * 100) / 100);
  expect(new Set(ratios).size).toBeGreaterThan(1);
  const kept = Object.keys(s0.forms).filter((id) => s1.forms[id]);
  expect(kept.length).toBeGreaterThan(0);
  expect(kept.some((id) => s0.forms[id].productionCost !== s1.forms[id].productionCost || s0.forms[id].marketValue !== s1.forms[id].marketValue)).toBe(true);
});
