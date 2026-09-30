import { buildApp } from "../../apps/server/src/app";

/** A fresh in-memory server with rule/fixture inference and no request recording. */
export async function harness(opts: { preset?: "explorer" | "smith" | "inquisitor" | "merchant"; startDate?: string } = {}) {
  const { app, ctx } = await buildApp({ dbPath: ":memory:", recordMissing: false, strictFixtures: false });
  const call = async <T = any>(method: "GET" | "POST" | "PUT", url: string, payload?: unknown): Promise<T> => {
    const r = await app.inject({ method, url, payload: payload as any });
    if (r.statusCode >= 400) throw new Error(`${method} ${url} → ${r.statusCode} ${r.body}`);
    return r.json() as T;
  };
  /** Status + body without throwing, for validation tests. */
  const raw = async (method: "GET" | "POST" | "PUT", url: string, payload?: unknown) => {
    const r = await app.inject({ method, url, payload: payload as any });
    return { status: r.statusCode, body: r.json() as any };
  };
  await call("POST", "/api/character/reset", { preset: opts.preset, startDate: opts.startDate });
  /**
   * Walk a whole expedition map to the boss, winning every fight (preferring fight branches), and return the run id
   * and the Forms found on the way. The run is left active so the caller can complete it.
   */
  const runExpedition = async (realmId = "ashen-vault") => {
    const start = await call("POST", "/api/runs", { realmId });
    const plan = start.plan;
    const nodes = plan.map.layers.flat();
    const byId = new Map(nodes.map((n: any) => [n.id, n]));
    let options: any[] = plan.map.layers[0];
    const forms: any[] = [];
    const rewards: any[] = [];
    while (options.length) {
      const next = options.find((n) => n.encounter) ?? options[0];
      const res = await call("POST", `/api/runs/${plan.runId}/node`, { nodeId: next.id, outcome: next.encounter ? "victory" : "skip" });
      forms.push(...res.rewards.forms);
      rewards.push({ node: next, ...res.rewards });
      options = next.links.map((id: string) => byId.get(id));
    }
    return { runId: plan.runId as string, plan, forms, rewards };
  };
  const finishRun = (runId: string, outcome: "victory" | "death" = "victory") => call("POST", `/api/runs/${runId}/complete`, { outcome, durationMs: 600000 });
  const character = () => call("GET", "/api/character");
  return { app, ctx, call, raw, runToShrine: runExpedition, runExpedition, finishRun, character, close: () => app.close() };
}
