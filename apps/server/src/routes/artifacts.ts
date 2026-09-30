import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { GEAR_SLOTS } from "@ender/shared";
import type { Ctx } from "../services/context";
import { activeCharacterId, characterView } from "../services/character";
import { artifactView, getArtifact, heldArtifacts } from "../services/artifacts";
import { attune, deepTrial, fracture, mirror, temperChoose, temperOptions, trial } from "../services/craft";
import { equip, sellPreview } from "../services/market";
import { all } from "../db";

export function registerArtifactRoutes(app: FastifyInstance, ctx: Ctx) {
  app.get("/api/inventory", async () => {
    const charId = activeCharacterId(ctx);
    const c = characterView(ctx, charId);
    return {
      artifacts: heldArtifacts(ctx, charId).map((a) => artifactView(ctx, a)),
      essences: c.essences,
      currencies: c.currencies,
      crowns: c.crowns,
      focus: c.focus,
      equipped: c.equipped,
    };
  });

  app.get("/api/grimoire", async () => {
    const charId = activeCharacterId(ctx);
    const rows = all<{ id: string }>(ctx.db, "SELECT id FROM artifacts WHERE character_id = ? ORDER BY rowid", charId);
    const lineage = all(ctx.db, "SELECT l.child_id, l.parent_id, l.action FROM artifact_lineage l JOIN artifacts a ON a.id = l.child_id WHERE a.character_id = ?", charId);
    return { artifacts: rows.map((r) => artifactView(ctx, getArtifact(ctx, r.id))), lineage };
  });

  app.get<{ Params: { id: string } }>("/api/artifacts/:id", async (req) => {
    const charId = activeCharacterId(ctx);
    const a = getArtifact(ctx, req.params.id, charId);
    return { artifact: artifactView(ctx, a), sale: a.evidence_tier === "veiled" ? null : sellPreview(ctx, charId, a.id) };
  });

  app.post<{ Params: { id: string } }>("/api/artifacts/:id/attune", async (req) => attune(ctx, activeCharacterId(ctx), req.params.id));
  app.post<{ Params: { id: string } }>("/api/artifacts/:id/temper", async (req) => {
    const body = z.object({ choice: z.string().optional(), wildSigil: z.boolean().optional() }).parse(req.body ?? {});
    const charId = activeCharacterId(ctx);
    if (body.choice) return { phase: "chosen", ...temperChoose(ctx, charId, req.params.id, body.choice) };
    return { phase: "options", ...(await temperOptions(ctx, charId, req.params.id, { wildSigil: body.wildSigil })) };
  });
  app.post<{ Params: { id: string } }>("/api/artifacts/:id/fracture", async (req) => fracture(ctx, activeCharacterId(ctx), req.params.id));
  app.post<{ Params: { id: string } }>("/api/artifacts/:id/trial", async (req) => trial(ctx, activeCharacterId(ctx), req.params.id));
  app.post<{ Params: { id: string } }>("/api/artifacts/:id/mirror", async (req) => mirror(ctx, activeCharacterId(ctx), req.params.id));
  app.post<{ Params: { id: string } }>("/api/artifacts/:id/deep-trial", async (req) => deepTrial(ctx, activeCharacterId(ctx), req.params.id));

  app.post("/api/equipment", async (req) => {
    const body = z.object({ slot: z.enum(GEAR_SLOTS as [string, ...string[]]), artifactId: z.string().nullable() }).parse(req.body);
    return equip(ctx, activeCharacterId(ctx), body.slot as never, body.artifactId);
  });
}
