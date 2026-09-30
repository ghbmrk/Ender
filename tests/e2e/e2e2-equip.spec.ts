// E2E 2: acquire a Form, Attune, Trial, equip, verify combat stats change.
import { expect, test } from "@playwright/test";
import { api, formsFromRealm, newBinder, openCrucibleOn } from "./helpers";

test("an Attuned, Trialed Form bound as a blade makes the Binder stronger", async ({ page }) => {
  await newBinder(page);
  const [form] = await formsFromRealm(page);
  const before = (await api(page, "character")).stats;

  await openCrucibleOn(page, form!.id);
  await page.getByTestId("act-attune").click();
  await expect(page.getByTestId(`form-${form!.id}`).first()).toHaveAttribute("data-tier", "attuned");
  await page.getByTestId("act-trial").click();
  await expect(page.getByTestId("trial-score")).toBeVisible();
  await expect(page.getByTestId(`form-${form!.id}`).first()).toHaveAttribute("data-tier", "trialed");

  await page.getByTestId("equip-blade").click();
  await expect.poll(async () => (await api(page, "character")).stats.attackDamage).toBeGreaterThan(before.attackDamage);
  expect((await api(page, "artifact", form!.id)).artifact.equippedSlot).toBe("blade");
});
