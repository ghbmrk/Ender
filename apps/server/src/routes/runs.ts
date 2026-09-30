import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Ctx } from "../services/context";
import { activeCharacterId } from "../services/character";
import { checkpointRun, completeRun, startRun } from "../services/runs";
import { realmGateView, resolveDueProphecies, tickRumors } from "../services/market";
import { advanceWorld, currentSnapshot } from "../services/world";
import { now, run } from "../db";

export function registerRunRoutes(app: FastifyInstance, ctx: Ctx) {
  app.post("/api/runs", async (req) => {
    const { realmId } = z.object({ realmId: z.string() }).parse(req.body);
    const charId = activeCharacterId(ctx);
    // Record what the market looked like when the Realm was chosen (analytics).
    const gate = realmGateView(ctx);
    const out = startRun(ctx, charId, realmId);
    const best = [...gate].sort((a, b) => b.demand.filter((d) => d.arrows === "↑↑").length - a.demand.filter((d) => d.arrows === "↑↑").length)[0];
    run(
      ctx.db,
      "INSERT INTO run_events (run_id, type, payload, created_at) VALUES (?, 'realm-choice', ?, ?)",
      out.plan.runId,
      JSON.stringify({ chosen: realmId, strongestDemandRealm: best?.id, gate: gate.map((g) => ({ id: g.id, haulValue: g.haulValue, demand: g.demand.map((d) => d.arrows) })) }),
      now(),
    );
    return out;
  });

  app.post<{ Params: { id: string } }>("/api/runs/:id/checkpoint", async (req) => {
    const { roomsCleared } = z.object({ roomsCleared: z.array(z.number().int().min(0).max(7)) }).parse(req.body);
    return checkpointRun(ctx, activeCharacterId(ctx), req.params.id, roomsCleared);
  });

  app.post<{ Params: { id: string } }>("/api/runs/:id/complete", async (req) => {
    const body = z
      .object({
        outcome: z.enum(["victory", "death", "abandon"]),
        roomsCleared: z.array(z.number().int().min(0).max(7)),
        kills: z.record(z.string(), z.number()).optional(),
        durationMs: z.number().optional(),
        deaths: z.number().optional(),
        bossPhaseMs: z.array(z.number()).optional(),
        wardBreaks: z.number().optional(),
        advanceWorld: z.boolean().default(true),
      })
      .parse(req.body);
    const charId = activeCharacterId(ctx);
    const out = completeRun(ctx, charId, req.params.id, body);
    tickRumors(ctx, charId);
    // A Realm run takes a turning of world time.
    let turned = null;
    if (body.advanceWorld) {
      const before = currentSnapshot(ctx);
      const s = advanceWorld(ctx, 1);
      turned = { from: before.date, to: s.date, settledProphecies: resolveDueProphecies(ctx) };
    }
    return { ...out, worldTurned: turned };
  });
}
