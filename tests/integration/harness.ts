import { buildApp } from "../../apps/server/src/app";

/** A fresh in-memory server with rule/fixture inference and no request recording. */
export async function harness(opts: { preset?: "explorer" | "smith" | "inquisitor" | "merchant"; startDate?: string } = {}) {
  const { app, ctx } = await buildApp({ dbPath: ":memory:", recordMissing: false, strictFixtures: false });
  const call = async <T = any>(method: "GET" | "POST", url: string, payload?: unknown): Promise<T> => {
    const r = await app.inject({ method, url, payload: payload as any });
    if (r.statusCode >= 400) throw new Error(`${method} ${url} → ${r.statusCode} ${r.body}`);
    return r.json() as T;
  };
  await call("POST", "/api/character/reset", { preset: opts.preset, startDate: opts.startDate });
  /** Run a Realm to the shrine (rooms 0–4 cleared) and return the run id and Forms found. */
  const runToShrine = async (realmId = "ashen-vault") => {
    const run = await call("POST", "/api/runs", { realmId });
    const cp = await call("POST", `/api/runs/${run.plan.runId}/checkpoint`, { roomsCleared: [0, 1, 2, 3, 4] });
    return { runId: run.plan.runId as string, plan: run.plan, forms: cp.artifacts as any[], checkpoint: cp };
  };
  const finishRun = (runId: string, outcome: "victory" | "defeat" = "victory") =>
    call("POST", `/api/runs/${runId}/complete`, { outcome, roomsCleared: outcome === "victory" ? [0, 1, 2, 3, 4, 5, 6, 7] : [0, 1, 2, 3, 4], durationMs: 600000 });
  const character = () => call("GET", "/api/character");
  return { app, ctx, call, runToShrine, finishRun, character, close: () => app.close() };
}
