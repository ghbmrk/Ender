// E2E 4: Explorer and Smith receive the identical candidate set and choose differently.
import { expect, test } from "@playwright/test";
import { SHARED_FORM, get, newBinder, post, temperInUi } from "./helpers";

async function temperAs(page: any, preset: "explorer" | "smith") {
  await newBinder(page, { preset, startDate: "2023-08-04" });
  const form = await post(page, "/api/dev/grant-form", SHARED_FORM);
  const chosen = await temperInUi(page, form.id);
  const req = (await get(page, "/api/dev/inference/recent")).recent.find((r: any) => r.kind === "transform").request;
  return { chosen, candidateIds: req.candidates.map((c: any) => c.candidateId).sort(), policy: req.buildPolicy };
}

test("Explorer and Smith see the same candidates but choose differently", async ({ page }) => {
  const explorer = await temperAs(page, "explorer");
  const smith = await temperAs(page, "smith");
  expect(explorer.candidateIds).toEqual(smith.candidateIds);
  expect(explorer.policy.exploration).toBeGreaterThan(smith.policy.exploration);
  expect(explorer.chosen).not.toEqual(smith.chosen);
});
