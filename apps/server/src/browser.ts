// The whole Weave server as an in-page module, for the no-install web build.
// Same services and routes as Node; only the database (sql.js) and seed loading differ.
import { ZodError } from "zod";
import type { MarketSeed } from "@weave/economy";
import type { FixtureStore } from "@weave/inference";
import type { PubChemRealityAdapter } from "@weave/reality";
import type { ServerConfig } from "./config";
import type { Db } from "./db";
import { createContext } from "./services/context";
import { HttpError } from "./services/character";
import { ensureWorld } from "./services/world";
import { registerCharacterRoutes } from "./routes/character";
import { registerWorldRoutes } from "./routes/world";
import { registerRunRoutes } from "./routes/runs";
import { registerArtifactRoutes } from "./routes/artifacts";
import { registerBazaarRoutes } from "./routes/bazaar";
import { registerDevRoutes } from "./routes/dev";

type Handler = (req: { params: Record<string, string>; body: unknown; query: Record<string, string> }) => unknown;
type Route = { method: string; parts: string[]; handler: Handler };

export type InPageServer = { handle(method: string, url: string, body?: unknown): Promise<{ status: number; body: unknown }> };

export function createInPageServer(parts: { db: Db; reality: PubChemRealityAdapter; marketSeed: MarketSeed; fixtures: FixtureStore; startDate: string }): InPageServer {
  const config: ServerConfig = { dataDir: "(bundled)", dbPath: "(browser)", strictFixtures: false, recordMissing: false, startDate: parts.startDate, devRoutes: true };
  const ctx = createContext(config, parts);
  ensureWorld(ctx);

  const routes: Route[] = [];
  const add = (method: string) => (path: string, handler: Handler) => routes.push({ method, parts: path.split("/").filter(Boolean), handler });
  // A Fastify-shaped registrar: the route modules only use app.get/app.post(path, handler).
  const app = { get: add("GET"), post: add("POST") } as never;
  registerCharacterRoutes(app, ctx);
  registerWorldRoutes(app, ctx);
  registerRunRoutes(app, ctx);
  registerArtifactRoutes(app, ctx);
  registerBazaarRoutes(app, ctx);
  registerDevRoutes(app, ctx);
  routes.push({ method: "GET", parts: ["api", "health"], handler: () => ({ ok: true, provider: ctx.inference.name, mode: "in-page" }) });

  const match = (method: string, path: string) => {
    const segs = path.split("/").filter(Boolean);
    for (const r of routes) {
      if (r.method !== method || r.parts.length !== segs.length) continue;
      const params: Record<string, string> = {};
      if (r.parts.every((p, i) => (p.startsWith(":") ? ((params[p.slice(1)] = decodeURIComponent(segs[i]!)), true) : p === segs[i]))) return { r, params };
    }
    return null;
  };

  return {
    async handle(method, url, body) {
      const u = new URL(url, "http://in-page");
      const m = match(method.toUpperCase(), u.pathname);
      if (!m) return { status: 404, body: { error: `no route ${method} ${u.pathname}` } };
      try {
        const out = await m.r.handler({ params: m.params, body, query: Object.fromEntries(u.searchParams) });
        return { status: 200, body: out };
      } catch (err) {
        if (err instanceof HttpError) return { status: err.statusCode, body: { error: err.message } };
        if (err instanceof ZodError) return { status: 400, body: { error: "invalid request", issues: err.issues } };
        console.error(err);
        return { status: 500, body: { error: (err as Error).message ?? "internal error" } };
      }
    },
  };
}
export { SCHEMA, type Db } from "./db";
