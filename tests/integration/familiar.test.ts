// The Familiar (thread "Agent play while away"): it spends a bounded Focus reserve through the same services the
// player uses, outcomes come only from actions performed, and the return summary stays short.
import { afterEach, describe, expect, it } from "vitest";
import { harness } from "./harness";

let h: Awaited<ReturnType<typeof harness>>;
afterEach(async () => h?.close());

const ret = (today: string) => h.call("POST", "/api/familiar/return", { today });

describe("Familiar while away", () => {
  it("does nothing without a mandate, and time alone grants nothing", async () => {
    h = await harness();
    const { runId } = await h.runExpedition();
    await h.finishRun(runId);
    const before = await h.call("GET", "/api/inventory");
    const r = await ret("2026-10-02");
    expect(r.session).toBeNull();
    const after = await h.call("GET", "/api/inventory");
    expect(after.artifacts.map((a: any) => a.tier)).toEqual(before.artifacts.map((a: any) => a.tier));
  });

  it("Check my Forms: spends one Watch on Attune, Trial and Mirror, and reports in at most five cards", async () => {
    h = await harness();
    const { runId, forms } = await h.runExpedition();
    await h.finishRun(runId);
    expect(forms.length).toBeGreaterThan(0);
    await h.call("POST", "/api/familiar/mandate", { id: "validate" });
    const focus0 = (await h.character()).focus;
    const xp0 = (await h.character()).xp;

    const r = await ret("2026-10-02");
    const s = r.session;
    expect(s).not.toBeNull();
    expect(s.focusSpent).toBeLessThanOrEqual(12);
    expect(s.focusSpent + s.reserveLeft).toBe(12);
    expect(s.tally.attune).toBeGreaterThan(0);
    expect(s.tally.trial).toBeGreaterThanOrEqual(s.tally.attune);
    expect(s.cards.length).toBeLessThanOrEqual(5);
    expect(s.xpGained).toBeGreaterThan(0);
    // The player's own Focus is untouched; XP is real, from the actions performed.
    expect((await h.character()).focus).toBe(focus0);
    expect((await h.character()).xp).toBe(xp0 + s.xpGained);
    const inv = await h.call("GET", "/api/inventory");
    expect(inv.artifacts.filter((a: any) => a.tier !== "veiled").length).toBeGreaterThan(0);

    // Same day again: no second Watch, so only leftover reserve can be spent.
    const again = await ret("2026-10-02");
    expect(again.session?.focusSpent ?? 0).toBeLessThanOrEqual(s.reserveLeft);
    // Next day: one more Watch, capped.
    const next = await ret("2026-10-03");
    expect(next.familiar.reserve).toBeLessThanOrEqual(24);
  });

  it("Find a cheaper Form: tempers spare Forms toward the costliest exact Form and checks every claim with a Trial", async () => {
    h = await harness({ preset: "merchant" });
    for (const realm of ["ashen-vault", "glass-fen"]) {
      const { runId } = await h.runExpedition(realm);
      await h.finishRun(runId);
    }
    await h.call("POST", "/api/familiar/mandate", { id: "cheaper" });
    const r = await ret("2026-10-02");
    const s = r.session;
    expect(s).not.toBeNull();
    expect(s.tally.temper ?? 0).toBeGreaterThan(0);
    const kinds = s.cards.map((c: any) => c.kind);
    // Either a verified cheaper match (a decision for the player) or a failed search worth knowing about.
    expect(kinds.some((k: string) => k === "decision" || k === "failed")).toBe(true);
    for (const c of s.cards.filter((c: any) => c.kind === "decision")) {
      const f = (await h.call("GET", "/api/inventory")).artifacts.find((a: any) => a.id === c.formIds[0]);
      expect(["trialed", "witnessed"]).toContain(f.tier);
    }
  });

  it("unspent Realm Focus is banked for the Familiar instead of turning into Crowns", async () => {
    h = await harness();
    await h.call("POST", "/api/familiar/mandate", { id: "validate" });
    const { runId } = await h.runExpedition();
    await h.finishRun(runId);
    const start = await h.call("POST", "/api/runs", { realmId: "glass-fen" });
    expect(start.focusBanked).toBeGreaterThan(0);
    expect(start.focusConverted).toBe(0);
    const f = await h.call("GET", "/api/familiar");
    expect(f.reserve).toBe(start.focusBanked);
  });
});
