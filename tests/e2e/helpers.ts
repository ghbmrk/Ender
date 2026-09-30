import { expect, type Page } from "@playwright/test";

type Preset = "explorer" | "smith" | "inquisitor" | "merchant";

/** Browser-side API client (the game's own). */
export const api = <T = any>(page: Page, fn: string, ...args: unknown[]): Promise<T> =>
  page.evaluate(([f, a]) => (window as any).__weave.api[f as string](...(a as unknown[])), [fn, args] as const) as Promise<T>;

export const state = (page: Page) => page.evaluate(() => (window as any).__weave.getState());
export const setPanel = (page: Page, panel: string | null) => page.evaluate((p) => (window as any).__weave.setState({ panel: p }), panel);

/** Title → a fresh Binder (optionally a §68 preset) → the Crossing. */
export async function newBinder(page: Page, opts: { preset?: Preset; query?: string; startDate?: string } = {}) {
  await page.goto(`/${opts.query ? `?${opts.query}` : ""}`);
  await expect(page.getByTestId("new-binder")).toBeVisible();
  if (opts.preset || opts.startDate) {
    await page.evaluate(([preset, startDate]) => (window as any).__weave.api.reset({ preset, startDate }), [opts.preset, opts.startDate] as const);
    await page.getByTestId("continue").click();
  } else {
    await page.getByTestId("new-binder").click();
  }
  await expect(page.getByTestId("hud")).toBeVisible();
}

/** Clear a Realm to its shrine through the API (for tests that are about crafting, not combat). */
export async function formsFromRealm(page: Page, realmId = "ashen-vault") {
  const run = await api(page, "startRun", realmId);
  const cp = await api(page, "checkpoint", run.plan.runId, [0, 1, 2, 3, 4]);
  await api(page, "completeRun", run.plan.runId, { outcome: "victory", roomsCleared: [0, 1, 2, 3, 4, 5, 6, 7], durationMs: 60000 });
  return cp.artifacts as { id: string }[];
}

export async function openCrucibleOn(page: Page, artifactId: string) {
  await page.evaluate((id) => (window as any).__weave.setState({ panel: "crucible", crucibleFocus: id, crucibleMode: "craft" }), artifactId);
  await expect(page.getByTestId("crucible")).toBeVisible();
  await page.getByTestId("crucible").getByTestId(`form-${artifactId}`).first().click();
}

/** Raw API call from the page (for dev hooks the game client doesn't expose). */
export const post = <T = any>(page: Page, url: string, body: unknown = {}): Promise<T> =>
  page.evaluate(
    async ([u, b]) => {
      const r = await fetch(u as string, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
      if (!r.ok) throw new Error(`${u}: ${r.status} ${await r.text()}`);
      return r.json();
    },
    [url, body] as const,
  ) as Promise<T>;
export const get = <T = any>(page: Page, url: string): Promise<T> => page.evaluate(async (u) => (await fetch(u)).json(), url) as Promise<T>;

/** Temper in the Crucible UI and return the offered candidate IDs in order. */
export async function temperInUi(page: Page, artifactId: string) {
  await openCrucibleOn(page, artifactId);
  await page.getByTestId("act-temper").click();
  await expect(page.getByTestId("temper-choices")).toBeVisible();
  const ids = await page.locator("[data-testid^=temper-option-]").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")!.replace("temper-option-", "")));
  return ids;
}

/** A shared real candidate (PubChem CID 7108) used to give different builds the identical Temper context. */
export const SHARED_FORM = { realityId: "7108", realmId: "ashen-vault" };
