import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { configFromEnv, type ServerConfig } from "./config";
import type { Ctx } from "./services/context";
import { createNodeContext } from "./node-context";
import { HttpError } from "./services/character";
import { ensureWorld } from "./services/world";
import { registerCharacterRoutes } from "./routes/character";
import { registerWorldRoutes } from "./routes/world";
import { registerRunRoutes } from "./routes/runs";
import { registerArtifactRoutes } from "./routes/artifacts";
import { registerBazaarRoutes } from "./routes/bazaar";
import { registerDevRoutes } from "./routes/dev";

export async function buildApp(overrides: Partial<ServerConfig> = {}): Promise<{ app: FastifyInstance; ctx: Ctx }> {
  const config = configFromEnv(overrides);
  const ctx = createNodeContext(config);
  ensureWorld(ctx);
  const app = Fastify({ logger: false });
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) return reply.status(err.statusCode).send({ error: err.message });
    if (err instanceof ZodError) return reply.status(400).send({ error: "invalid request", issues: err.issues });
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode && e.statusCode < 500) return reply.status(e.statusCode).send({ error: e.message });
    console.error(err);
    return reply.status(500).send({ error: e.message ?? "internal error" });
  });
  app.get("/api/health", async () => ({ ok: true, provider: ctx.inference.name }));
  registerCharacterRoutes(app, ctx);
  registerWorldRoutes(app, ctx);
  registerRunRoutes(app, ctx);
  registerArtifactRoutes(app, ctx);
  registerBazaarRoutes(app, ctx);
  if (config.devRoutes) registerDevRoutes(app, ctx);
  app.addHook("onClose", async () => ctx.db.close());
  return { app, ctx };
}
