import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Ctx } from "../services/context";
import { activeCharacterId, characterView, createCharacter } from "../services/character";
import { allocatePassive, passivesView } from "../services/passives";
import { activateSnapshot, setState, snapshotForDate } from "../services/world";

export function registerCharacterRoutes(app: FastifyInstance, ctx: Ctx) {
  app.get("/api/character", async () => characterView(ctx, activeCharacterId(ctx)));

  app.post("/api/character/reset", async (req) => {
    const body = z
      .object({
        name: z.string().max(24).optional(),
        preset: z.enum(["explorer", "smith", "inquisitor", "merchant"]).optional(),
        resetWorld: z.boolean().default(true),
        startDate: z.string().optional(),
      })
      .parse(req.body ?? {});
    if (body.resetWorld) {
      setState(ctx, "pressure", { ember: 0, tide: 0, storm: 0, root: 0, glass: 0, ash: 0 });
      activateSnapshot(ctx, snapshotForDate(ctx, body.startDate ?? ctx.config.startDate).id);
    }
    const c = createCharacter(ctx, { name: body.name, preset: body.preset });
    return characterView(ctx, c.id);
  });

  app.get("/api/passives", async () => passivesView(ctx, activeCharacterId(ctx)));
  app.post<{ Params: { id: string } }>("/api/passives/:id/allocate", async (req) => allocatePassive(ctx, activeCharacterId(ctx), req.params.id));
}
