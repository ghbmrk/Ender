// §74: the MVP must never use paid LLM inference. Fails on commercial AI SDKs, AI API-key
// env vars, LLM endpoints in source, or any network call during a full crafting session.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../apps/server/src/app";
import { selectInferenceProvider } from "../../apps/server/src/services/context";
import { nodeFixtureStore } from "../../apps/server/src/node-context";
import { configFromEnv } from "../../apps/server/src/config";

const ROOT = resolve(__dirname, "../..");
const BANNED_PACKAGES = [
  "openai",
  "@anthropic-ai/sdk",
  "@anthropic-ai/",
  "@google/generative-ai",
  "@google/genai",
  "@google-cloud/vertexai",
  "cohere-ai",
  "@mistralai/",
  "groq-sdk",
  "replicate",
  "together-ai",
  "@huggingface/inference",
  "langchain",
  "@langchain/",
  "llamaindex",
  "@ai-sdk/",
  "@aws-sdk/client-bedrock",
];
const BANNED_ENV = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "COHERE_API_KEY", "MISTRAL_API_KEY", "GROQ_API_KEY", "REPLICATE_API_TOKEN", "TOGETHER_API_KEY", "HF_TOKEN"];
const BANNED_HOSTS = ["api.openai.com", "api.anthropic.com", "generativelanguage.googleapis.com", "aiplatform.googleapis.com", "api.cohere.ai", "api.mistral.ai", "api.groq.com", "api.replicate.com", "api.together.xyz", "api-inference.huggingface.co"];

const SCAN_DIRS = ["apps", "packages", "scripts", "prompts"];
const SKIP = new Set(["node_modules", "dist", ".vite", "test-results"]);
function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.(ts|tsx|js|mjs|cjs|json|py)$/.test(name)) out.push(p);
  }
  return out;
}

describe("no paid inference: static", () => {
  const manifests = [join(ROOT, "package.json"), ...files(join(ROOT, "apps")), ...files(join(ROOT, "packages"))].filter((p) => p.endsWith("package.json"));

  it("no workspace package depends on a commercial AI SDK", () => {
    for (const m of manifests) {
      const pkg = JSON.parse(readFileSync(m, "utf8"));
      const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies, ...pkg.peerDependencies });
      for (const d of deps) for (const b of BANNED_PACKAGES) expect(d === b || (b.endsWith("/") && d.startsWith(b)), `${relative(ROOT, m)} depends on ${d}`).toBe(false);
    }
  });

  it("the lockfile resolves no commercial AI SDK", () => {
    const lock = readFileSync(join(ROOT, "pnpm-lock.yaml"), "utf8");
    for (const b of BANNED_PACKAGES) {
      const re = new RegExp(`^\\s+'?${b.replace(/[/@.-]/g, "\\$&")}${b.endsWith("/") ? "" : "@"}`, "m");
      expect(re.test(lock), `pnpm-lock.yaml contains ${b}`).toBe(false);
    }
  });

  it("source never imports an AI SDK, reads an AI key, or names an LLM endpoint", () => {
    for (const f of SCAN_DIRS.flatMap((d) => files(join(ROOT, d)))) {
      const src = readFileSync(f, "utf8");
      const rel = relative(ROOT, f);
      for (const b of BANNED_PACKAGES) expect(new RegExp(`from\\s+["']${b.replace(/[/@.-]/g, "\\$&")}|require\\(["']${b.replace(/[/@.-]/g, "\\$&")}`).test(src), `${rel} imports ${b}`).toBe(false);
      for (const e of BANNED_ENV) expect(src.includes(e), `${rel} mentions ${e}`).toBe(false);
      for (const h of BANNED_HOSTS) expect(src.includes(h), `${rel} names ${h}`).toBe(false);
    }
  });
});

describe("no paid inference: runtime", () => {
  const realFetch = globalThis.fetch;
  const fetchSpy = vi.fn(async () => {
    throw new Error("network access during gameplay");
  });
  afterAll(() => {
    globalThis.fetch = realFetch;
  });

  it("selects the fixture provider (rule fallback), never the future ChatGPT stub", () => {
    const config = configFromEnv({ dbPath: ":memory:" });
    const p = selectInferenceProvider(config, nodeFixtureStore(config));
    expect(p.name).toBe("fixture");
    const src = readFileSync(join(ROOT, "apps/server/src/services/context.ts"), "utf8");
    expect(src).not.toMatch(/new\s+ChatGPTPlanInferenceProvider/);
  });

  it("a full crafting session runs with no AI keys and makes zero network calls", async () => {
    for (const e of BANNED_ENV) delete process.env[e];
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const { app } = await buildApp({ dbPath: ":memory:", recordMissing: false });
    const call = async (method: "GET" | "POST", url: string, payload?: unknown) => {
      const r = await app.inject({ method, url, payload: payload as any });
      expect(r.statusCode, `${url}: ${r.body}`).toBeLessThan(400);
      return r.json();
    };
    await call("POST", "/api/character/reset", {});
    const run = await call("POST", "/api/runs", { realmId: "glass-fen" });
    const cp = await call("POST", `/api/runs/${run.plan.runId}/checkpoint`, { roomsCleared: [0, 1, 2, 3, 4] });
    const id = cp.artifacts[0].id;
    const at = await call("POST", `/api/artifacts/${id}/attune`);
    expect(["fixture", "rule"]).toContain(at.inference.provider);
    await call("POST", `/api/runs/${run.plan.runId}/complete`, { outcome: "victory", roomsCleared: [0, 1, 2, 3, 4, 5, 6, 7], durationMs: 1 });
    const t = await call("POST", `/api/artifacts/${id}/temper`, {});
    const ch = await call("POST", `/api/artifacts/${id}/temper`, { choice: t.options[0].candidateId });
    await call("POST", `/api/artifacts/${ch.artifact.id}/trial`);
    await call("POST", `/api/artifacts/${ch.artifact.id}/fracture`);
    await call("POST", `/api/artifacts/${ch.artifact.id}/mirror`);
    await app.close();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
