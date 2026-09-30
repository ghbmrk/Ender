import type { FastifyInstance } from "fastify";
import { buildApp } from "@ender/server";
import type { ServerConfig } from "@ender/server/config";
import type { Ctx } from "@ender/server/services/context";
import { registerRealityRoutes } from "./routes";

export { registerRealityRoutes, Schemas, type Envelope } from "./routes";

/** Default port: 8787 belongs to the web build's dev server (apps/server), so the reality service takes 8788. */
export const DEFAULT_PORT = 8788;

/**
 * The reality service = the existing Ender server (every /api/* route, same services, same
 * seed data under repo-root data/) + the Unreal client's endpoint contract on the same Fastify instance.
 */
export async function buildRealityService(overrides: Partial<ServerConfig> = {}): Promise<{ app: FastifyInstance; ctx: Ctx }> {
  const { app, ctx } = await buildApp(overrides);
  registerRealityRoutes(app, ctx);
  return { app, ctx };
}
