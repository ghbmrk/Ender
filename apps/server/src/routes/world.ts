import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Ctx } from "../services/context";
import { activeCharacterId } from "../services/character";
import { activateSnapshot, advanceWorld, currentSnapshot, snapshotForDate } from "../services/world";
import { bazaarView, realmGateView, resolveDueProphecies } from "../services/market";

export function registerWorldRoutes(app: FastifyInstance, ctx: Ctx) {
  app.get("/api/world", async () => {
    const s = currentSnapshot(ctx);
    const bazaar = bazaarView(ctx, activeCharacterId(ctx));
    return {
      snapshot: { id: s.id, date: s.date, index: s.index, total: ctx.world.snapshots.length, first: ctx.world.snapshots[0]!.date, last: ctx.world.snapshots.at(-1)!.date },
      headline: bazaar.headline,
      essences: bazaar.essences,
      realms: realmGateView(ctx),
      contracts: bazaar.contracts,
      events: bazaar.worldEvents,
    };
  });

  app.post("/api/world/replay-date", async (req) => {
    const { date } = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(req.body);
    const s = snapshotForDate(ctx, date);
    activateSnapshot(ctx, s.id);
    return { snapshot: { id: s.id, date: s.date, index: s.index } };
  });

  app.post("/api/world/advance", async (req) => {
    const { steps } = z.object({ steps: z.number().int().min(1).max(12).default(1) }).parse(req.body ?? {});
    const before = currentSnapshot(ctx);
    const s = advanceWorld(ctx, steps);
    const settled = resolveDueProphecies(ctx);
    return { from: { id: before.id, date: before.date }, snapshot: { id: s.id, date: s.date, index: s.index }, settledProphecies: settled };
  });
}
