import { resolve } from "node:path";
import { REPO_ROOT } from "@ender/server/config";
import { DEFAULT_PORT, buildRealityService } from "./app";

const port = Number(process.env.PORT ?? process.env.ENDER_SERVICE_PORT ?? DEFAULT_PORT);
const host = process.env.HOST ?? "127.0.0.1";
// Its own save by default, so it can run beside the web build's server (.local/ender.sqlite).
const dbPath = process.env.ENDER_DB ?? resolve(REPO_ROOT, ".local/reality-service.sqlite");
const { app, ctx } = await buildRealityService({ dbPath });
await app.listen({ port, host });
console.log(`Ender reality service on http://${host}:${port} (inference: ${ctx.inference.name} → rule fallback; data: ${ctx.config.dataDir}; db: ${ctx.config.dbPath})`);
