import { buildApp } from "./app";

const port = Number(process.env.PORT ?? 8787);
const { app, ctx } = await buildApp();
await app.listen({ port, host: "127.0.0.1" });
console.log(`The Weave server on http://127.0.0.1:${port} (inference: ${ctx.inference.name} → rule fallback; db: ${ctx.config.dbPath})`);
