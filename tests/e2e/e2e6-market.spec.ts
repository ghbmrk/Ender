// E2E 6: advance the market snapshot; Essence prices and contracts change.
import { expect, test } from "@playwright/test";
import { newBinder } from "./helpers";

test("a turning of the world moves Essence prices and rewrites contracts", async ({ page }) => {
  await newBinder(page, { startDate: "2023-08-04" });
  await page.evaluate(() => (window as any).__weave.setState({ panel: "bazaar" }));
  await expect(page.getByTestId("essence-table")).toBeVisible();
  await expect(page.getByTestId("bazaar-headline")).toContainText("Storm");
  const prices = () => page.locator("[data-testid^=essence-][data-price]").evaluateAll((els) => els.map((e) => `${e.getAttribute("data-testid")}=${e.getAttribute("data-price")}`).join());
  const p0 = await prices();
  await page.getByTestId("tab-contracts").click();
  const contracts = () => page.locator("[data-testid^=contract-]").evaluateAll((els) => els.map((e) => `${e.getAttribute("data-testid")}:${e.getAttribute("data-target")}`).join());
  const c0 = await contracts();
  const storm0 = await page.locator("[data-testid^=contract-][data-target=storm]").count();
  expect(storm0).toBeGreaterThan(0);

  await page.getByTestId("advance-world").click();
  await page.getByTestId("tab-market").click();
  await expect.poll(prices).not.toBe(p0);
  await page.getByTestId("tab-contracts").click();
  await expect.poll(contracts).not.toBe(c0);
});
