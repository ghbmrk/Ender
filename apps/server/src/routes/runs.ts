import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Ctx } from "../services/context";
import { activeCharacterId } from "../services/character";
import { activeRunId, checkpointRun, completeRun, resolveNode, runView, startRun } from "../services/runs";
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

  app.get("/api/runs/active", async () => {
    const charId = activeCharacterId(ctx);
    const id = activeRunId(ctx, charId);
    return id ? runView(ctx, charId, id) : { plan: null, status: null, visited: [], loom: null };
  });

  app.get<{ Params: { id: string } }>("/api/runs/:id", async (req) => runView(ctx, activeCharacterId(ctx), req.params.id));

  app.post<{ Params: { id: string } }>("/api/runs/:id/node", async (req) => {
    const body = z
      .object({ nodeId: z.string(), outcome: z.enum(["victory", "defeat", "skip"]), kills: z.record(z.string(), z.number()).optional() })
      .parse(req.body);
    return resolveNode(ctx, activeCharacterId(ctx), req.params.id, body);
  });

  // Leaving a Shrine (or the hub): save the Loom snapshot combat will use.
  app.post<{ Params: { id: string } }>("/api/runs/:id/checkpoint", async (req) => checkpointRun(ctx, activeCharacterId(ctx), req.params.id));

  app.post<{ Params: { id: string } }>("/api/runs/:id/complete", async (req) => {
    const body = z
      .object({
        outcome: z.enum(["victory", "death", "abandon"]),
        kills: z.record(z.string(), z.number()).optional(),
        durationMs: z.number().optional(),
        advanceWorld: z.boolean().default(true),
      })
      .parse(req.body);
    const charId = activeCharacterId(ctx);
    const out = completeRun(ctx, charId, req.params.id, body);
    tickRumors(ctx, charId);
    // An expedition takes a turning of world time.
    let turned = null;
    if (body.advanceWorld) {
      const before = currentSnapshot(ctx);
      const s = advanceWorld(ctx, 1);
      turned = { from: before.date, to: s.date, settledProphecies: resolveDueProphecies(ctx) };
    }
    return { ...out, worldTurned: turned };
  });
}
