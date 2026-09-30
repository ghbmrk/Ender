// E2E 5: Merchant reacts differently from Smith to high production cost.
import { expect, test } from "@playwright/test";
import { SHARED_FORM, newBinder, post } from "./helpers";

async function offers(page: any, preset: "smith" | "merchant") {
  // 2023-08-04: Storm is dear (≈ ×2), so production costs are high for Storm recipes.
  await newBinder(page, { preset, startDate: "2023-08-04" });
  const form = await post(page, "/api/dev/grant-form", SHARED_FORM);
  await page.evaluate((id: string) => (window as any).__weave.setState({ panel: "crucible", crucibleFocus: id }), form.id);
  await page.getByTestId("crucible").getByTestId(`form-${form.id}`).first().click();
  await page.getByTestId("act-temper").click();
  await expect(page.getByTestId("temper-choices")).toBeVisible();
  const t = await post(page, `/api/artifacts/${form.id}/temper`, {}); // pending: returns the same options
  return t.options as { candidateId: string; productionCost: number; efficiency: number }[];
}

test("the Merchant steers away from costly Forms that the Smith accepts", async ({ page }) => {
  const smith = await offers(page, "smith");
  const merchant = await offers(page, "merchant");
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  expect(merchant.map((o) => o.candidateId)).not.toEqual(smith.map((o) => o.candidateId));
  expect(mean(merchant.map((o) => o.productionCost))).toBeLessThan(mean(smith.map((o) => o.productionCost)));
  expect(mean(merchant.map((o) => o.efficiency))).toBeGreaterThan(mean(smith.map((o) => o.efficiency)));
});
