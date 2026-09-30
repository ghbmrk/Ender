// All server calls. The browser never talks to real-data sources directly.
async function call<T = any>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  character: () => call("GET", "/api/character"),
  reset: (body: { name?: string; preset?: string } = {}) => call("POST", "/api/character/reset", body),
  world: () => call("GET", "/api/world"),
  advance: (steps = 1) => call("POST", "/api/world/advance", { steps }),
  replayDate: (date: string) => call("POST", "/api/world/replay-date", { date }),
  startRun: (realmId: string) => call("POST", "/api/runs", { realmId }),
  checkpoint: (runId: string) => call("POST", `/api/runs/${runId}/checkpoint`, {}),
  activeRun: () => call("GET", "/api/runs/active"),
  runNode: (runId: string, body: { nodeId: string; outcome: "victory" | "defeat" | "skip"; kills?: Record<string, number> }) => call("POST", `/api/runs/${runId}/node`, body),
  completeRun: (runId: string, body: { outcome: "victory" | "death" | "abandon" }) => call("POST", `/api/runs/${runId}/complete`, body),
  loom: () => call("GET", "/api/loom"),
  putLoom: (root: string, nodes: { artifactId: string; q: number; r: number }[]) => call("PUT", `/api/loom/${root}`, { nodes }),
  inscribe: (id: string, role: string) => call("POST", `/api/artifacts/${id}/inscribe`, { role }),
  inventory: () => call("GET", "/api/inventory"),
  grimoire: () => call("GET", "/api/grimoire"),
  artifact: (id: string) => call("GET", `/api/artifacts/${id}`),
  attune: (id: string) => call("POST", `/api/artifacts/${id}/attune`),
  temper: (id: string, body: { choice?: string; wildSigil?: boolean } = {}) => call("POST", `/api/artifacts/${id}/temper`, body),
  fracture: (id: string) => call("POST", `/api/artifacts/${id}/fracture`),
  trial: (id: string) => call("POST", `/api/artifacts/${id}/trial`),
  mirror: (id: string) => call("POST", `/api/artifacts/${id}/mirror`),
  deepTrial: (id: string) => call("POST", `/api/artifacts/${id}/deep-trial`),
  bazaar: () => call("GET", "/api/bazaar"),
  buyEssence: (assetId: string, quantity: number) => call("POST", "/api/bazaar/buy", { assetType: "essence", assetId, quantity }),
  sellEssence: (assetId: string, quantity: number) => call("POST", "/api/bazaar/sell", { assetType: "essence", assetId, quantity }),
  buyOffer: (assetId: string) => call("POST", "/api/bazaar/buy", { assetType: "artifact", assetId }),
  sellArtifact: (assetId: string, mode: "produce" | "salvage" = "produce") => call("POST", "/api/bazaar/sell", { assetType: "artifact", assetId, mode }),
  contracts: () => call("GET", "/api/contracts"),
  fulfill: (id: string, artifactId: string) => call("POST", `/api/contracts/${encodeURIComponent(id)}/fulfill`, { artifactId }),
  prophesy: (essence: string, probability: number) => call("POST", "/api/prophecies", { essence, probability }),
  resolveProphecy: (id: string) => call("POST", `/api/prophecies/${id}/resolve`),
  useItem: (id: string) => call("POST", `/api/items/${id}/use`),
  provenance: (id: string) => call("GET", `/api/dev/provenance/${id}`),
  devEconomy: () => call("GET", "/api/dev/economy"),
  analytics: () => call("GET", "/api/dev/analytics"),
  missingFixtures: () => call("GET", "/api/dev/inference/missing"),
  snapshots: () => call("GET", "/api/dev/snapshots"),
};
