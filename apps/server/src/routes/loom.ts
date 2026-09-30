import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Ctx } from "../services/context";
import { activeCharacterId } from "../services/character";
import { inscribe, loomView, setLoom } from "../services/loom";

export function registerLoomRoutes(app: FastifyInstance, ctx: Ctx) {
  app.post<{ Params: { id: string } }>("/api/artifacts/:id/inscribe", async (req) => {
    const { role } = z.object({ role: z.enum(["action", "modifier", "reaction", "keystone"]) }).parse(req.body);
    return inscribe(ctx, activeCharacterId(ctx), req.params.id, role);
  });

  app.get("/api/loom", async () => loomView(ctx, activeCharacterId(ctx)));

  app.put<{ Params: { root: string } }>("/api/loom/:root", async (req) => {
    const root = z.enum(["iron", "quick", "bond"]).parse(req.params.root);
    const { nodes } = z.object({ nodes: z.array(z.object({ artifactId: z.string(), q: z.number().int(), r: z.number().int() })).max(18) }).parse(req.body);
    return setLoom(ctx, activeCharacterId(ctx), root, nodes);
  });
}
