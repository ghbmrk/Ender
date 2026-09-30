/**
 * Plays a canonical, fully deterministic session against a fresh in-memory DB and
 * records every inference request that has no fixture yet to data/inference-requests/.
 * The coding agent (never a paid API) then authors fixtures for those requests.
 *
 *   pnpm fixtures:collect            # record missing requests
 *   pnpm fixtures:collect --clean    # wipe data/inference-requests first (re-records every request)
 */
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { buildApp } from "../apps/server/src/app";
import { DATA_DIR } from "./paths";

if (process.argv.includes("--clean")) rmSync(resolve(DATA_DIR, "inference-requests"), { recursive: true, force: true });

export async function canonicalSession(opts: { recordMissing: boolean }) {
  const { app, ctx } = await buildApp({ dbPath: ":memory:", recordMissing: opts.recordMissing, recordAllRequests: opts.recordMissing, strictFixtures: false });
  const call = async (method: "GET" | "POST", url: string, payload?: unknown) => {
    const r = await app.inject({ method, url, payload: payload as any });
    if (r.statusCode >= 400) throw new Error(`${method} ${url} → ${r.statusCode} ${r.body}`);
    return r.json();
  };
  for (const preset of ["explorer", "smith"] as const) {
  await call("POST", "/api/character/reset", { preset });
  for (const realmId of ["ashen-vault", "glass-fen", "hollow-keep"]) {
    const run = await call("POST", "/api/runs", { realmId });
    const cp = await call("POST", `/api/runs/${run.plan.runId}/checkpoint`, { roomsCleared: [0, 1, 2, 3, 4] });
    const formIds: string[] = cp.artifacts.map((a: { id: string }) => a.id);
    // Shrine: attune up to two Forms inside the Realm, as a player would.
    for (const id of formIds.slice(0, 2)) await call("POST", `/api/artifacts/${id}/attune`);
    await call("POST", `/api/runs/${run.plan.runId}/complete`, { outcome: "victory", roomsCleared: [0, 1, 2, 3, 4, 5, 6, 7], durationMs: 600000 });
    // Crossing: attune the rest, temper the first, trial + fracture + mirror the result.
    for (const id of formIds.slice(2)) await call("POST", `/api/artifacts/${id}/attune`);
    const first = formIds[0];
    const t = await call("POST", `/api/artifacts/${first}/temper`, {});
    const chosen = await call("POST", `/api/artifacts/${first}/temper`, { choice: t.options[0].candidateId });
    const nid = chosen.artifact.id;
    await call("POST", `/api/artifacts/${nid}/trial`);
    await call("POST", `/api/artifacts/${nid}/fracture`);
    await call("POST", `/api/artifacts/${nid}/mirror`);
    if (formIds[1]) await call("POST", `/api/artifacts/${formIds[1]}/fracture`);
  }
  }
  const provider = ctx.inference as { hits?: unknown[]; misses?: { kind: string; hash: string }[] };
  await app.close();
  return { hits: provider.hits?.length ?? 0, misses: provider.misses ?? [] };
}

const out = await canonicalSession({ recordMissing: true });
const byKind: Record<string, number> = {};
for (const m of out.misses) byKind[m.kind] = (byKind[m.kind] ?? 0) + 1;
console.log(`fixture hits: ${out.hits}, misses: ${out.misses.length}`, byKind);
