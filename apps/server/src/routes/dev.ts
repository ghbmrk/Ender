import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { REALMS } from "@ender/content";
import type { Ctx } from "../services/context";
import { activeCharacterId } from "../services/character";
import { artifactView, createArtifact, getArtifact, makeReadings } from "../services/artifacts";
import { passivesFor } from "../services/character";
import { analytics } from "../services/analytics";
import { economyDebug, missingFixtures, provenance } from "../services/dev";
import { run } from "../db";

/** Developer-only routes: provenance, economy internals, fixture misses, analytics, test hooks. */
export function registerDevRoutes(app: FastifyInstance, ctx: Ctx) {
  app.get("/api/dev/inference/missing", async () => ({ missing: missingFixtures(ctx) }));
  app.get<{ Params: { artifactId: string } }>("/api/dev/provenance/:artifactId", async (req) => provenance(ctx, req.params.artifactId));
  app.get("/api/dev/inference/recent", async () => ({ recent: (ctx.inference as { recent?: unknown[] }).recent ?? [] }));
  app.get("/api/dev/economy", async () => economyDebug(ctx));
  app.get("/api/dev/analytics", async () => analytics(ctx));
  app.get("/api/dev/snapshots", async () => ctx.world.snapshots.map((s) => ({ id: s.id, date: s.date, scarcity: s.essenceScarcity })));

  // Test hook: grant a specific real candidate as an Attuned Form (identical candidate sets across builds).
  app.post("/api/dev/grant-form", async (req) => {
    const body = z
      .object({ realityId: z.string(), realmId: z.enum(REALMS.map((r) => r.id) as [string, ...string[]]), tier: z.enum(["veiled", "attuned"]).default("attuned") })
      .parse(req.body);
    const charId = activeCharacterId(ctx);
    const a = createArtifact(ctx, charId, { realityId: body.realityId, realmId: body.realmId, origin: "seed", tier: body.tier });
    if (body.tier === "attuned") {
      const r = makeReadings(ctx, a, passivesFor(ctx, charId).readingNoise);
      run(ctx.db, "UPDATE artifacts SET readings = ?, fantasy_name = ?, revealed = '[]' WHERE id = ?", JSON.stringify(r), "Granted Form", a.id);
    }
    return artifactView(ctx, getArtifact(ctx, a.id));
  });

  app.post("/api/dev/grant", async (req) => {
    const body = z.object({ crowns: z.number().optional(), focus: z.number().optional(), passivePoints: z.number().optional() }).parse(req.body);
    const charId = activeCharacterId(ctx);
    if (body.crowns) run(ctx.db, "UPDATE characters SET crowns = crowns + ? WHERE id = ?", body.crowns, charId);
    if (body.focus) run(ctx.db, "UPDATE characters SET focus = focus + ? WHERE id = ?", body.focus, charId);
    if (body.passivePoints) run(ctx.db, "UPDATE characters SET passive_points = passive_points + ? WHERE id = ?", body.passivePoints, charId);
    return { ok: true };
  });
}
