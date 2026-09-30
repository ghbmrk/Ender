// E2E 1: start a new Binder, enter a Realm, fight, kill the boss.
import { expect, test } from "@playwright/test";
import { newBinder, state } from "./helpers";

test("new Binder enters a Realm, fights through it and unbinds the King", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // autoplay drives the same Intent interface as the keyboard; god/dmg keep CI time bounded.
  await newBinder(page, { query: "autoplay=1&god=1&speed=2&dmg=6" });

  // Walk-free: stand at the Realm Gate and press E, exactly as a player would.
  await page.waitForFunction(() => (window as any).__weave.crossing);
  await page.evaluate(() => (window as any).__weave.crossing.teleportTo("gate"));
  await page.getByTestId("game-canvas").click({ position: { x: 5, y: 5 } });
  await page.keyboard.down("e");
  await page.waitForTimeout(200);
  await page.keyboard.up("e");
  await expect(page.getByTestId("enter-ashen-vault")).toBeVisible();
  await page.getByTestId("enter-ashen-vault").click();

  await expect(page.getByTestId("room")).toBeVisible();
  const seen = new Set<number>();
  let bossBarSeen = false;
  await expect
    .poll(
      async () => {
        const s = await state(page);
        const room = await page.evaluate(() => (window as any).__weave.realm?.currentRoom);
        if (typeof room === "number") seen.add(room);
        if (!bossBarSeen) bossBarSeen = await page.getByTestId("boss-bar").isVisible();
        if (s.panel === "shrine") await page.getByTestId("leave-shrine").click();
        return s.panel;
      },
      { timeout: 220_000, intervals: [1000] },
    )
    .toBe("summary");

  const summary = (await state(page)).runSummary;
  expect(summary.status).toBe("victory");
  expect(seen.has(7)).toBe(true); // rooms 0–4 combat, 5 shrine, 6 elite, 7 the Bound King
  expect(bossBarSeen).toBe(true);
  expect(Object.values(summary.combat.kills as Record<string, number>).reduce((a, b) => a + b, 0)).toBeGreaterThan(10);
  await expect(page.getByTestId("run-summary")).toContainText("The King is unbound");
  expect(errors).toEqual([]);
});
