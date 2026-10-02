import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Ctx } from "../services/context";
import { activeCharacterId } from "../services/character";
import { familiarReturn, familiarView, setMandate } from "../services/familiar";

export function registerFamiliarRoutes(app: FastifyInstance, ctx: Ctx) {
  app.get("/api/familiar", async () => familiarView(ctx, activeCharacterId(ctx)));

  app.post("/api/familiar/mandate", async (req) => {
    const body = z.object({ id: z.enum(["validate", "cheaper"]).nullable(), targetId: z.string().optional() }).parse(req.body ?? {});
    return setMandate(ctx, activeCharacterId(ctx), body.id ? { id: body.id, targetId: body.targetId } : null);
  });

  /** The player is back: the Familiar spends its reserve now and returns what is worth knowing. */
  app.post("/api/familiar/return", async (req) => {
    const { today } = z.object({ today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(req.body ?? {});
    const charId = activeCharacterId(ctx);
    const session = await familiarReturn(ctx, charId, today);
    return { session, familiar: familiarView(ctx, charId) };
  });
}
