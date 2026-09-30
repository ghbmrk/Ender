// E2E 3: allocate a Forge passive, Temper, verify the policy reaches the inference request.
import { expect, test } from "@playwright/test";
import { SHARED_FORM, api, get, newBinder, post, temperInUi } from "./helpers";

test("a Forge passive changes the SearchPolicy sent with the Temper request", async ({ page }) => {
  await newBinder(page);
  await post(page, "/api/dev/grant", { passivePoints: 1 });
  const base = (await api(page, "character")).effectivePolicy;

  await page.evaluate(() => (window as any).__weave.setState({ panel: "passives" }));
  await page.getByTestId("node-tempered-purpose").click();
  await expect.poll(async () => (await api(page, "character")).passives).toContain("tempered-purpose");
  const boosted = (await api(page, "character")).effectivePolicy;
  expect(boosted.optimization).toBeCloseTo(base.optimization + 0.2, 3);

  const form = await post(page, "/api/dev/grant-form", SHARED_FORM);
  await page.evaluate(() => (window as any).__weave.setState({ panel: null }));
  await temperInUi(page, form.id);
  const recent = (await get(page, "/api/dev/inference/recent")).recent;
  const transform = recent.find((r: any) => r.kind === "transform");
  expect(transform.request.buildPolicy.optimization).toBeCloseTo(boosted.optimization, 3);
  expect(transform.request.buildPolicy).toEqual(boosted);
});
