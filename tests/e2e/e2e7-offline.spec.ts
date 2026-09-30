// E2E 7: the whole game runs offline: no request ever leaves localhost.
import { expect, test } from "@playwright/test";
import { api, formsFromRealm, newBinder } from "./helpers";

test("play, craft and trade with every external host blocked", async ({ page, context }) => {
  const external: string[] = [];
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === "127.0.0.1" || u.hostname === "localhost") return route.continue();
    external.push(u.href);
    return route.abort();
  });
  await newBinder(page, { query: "autoplay=1&god=1&speed=2&dmg=6" });
  await page.evaluate(() => (window as any).__weave.setState({ panel: "gate" }));
  await page.getByTestId("enter-glass-fen").click();
  await expect(page.getByTestId("room")).toBeVisible();
  await page.waitForTimeout(4000); // live combat in the canvas
  await page.evaluate(() => (window as any).__weave.realm.abandon());
  await expect(page.getByTestId("run-summary")).toBeVisible();

  const [form] = await formsFromRealm(page, "hollow-keep");
  await api(page, "attune", form!.id);
  await api(page, "trial", form!.id);
  const sale = await api(page, "sellArtifact", form!.id);
  expect(sale.payout).toBeGreaterThan(0);
  const health = await page.evaluate(async () => (await fetch("/api/health")).json());
  expect(health.provider).toBe("fixture");
  expect(external).toEqual([]);
});
