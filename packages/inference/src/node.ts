// Node-only: the filesystem fixture store. Import from "@ender/inference/node".
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { FixtureFile, FixtureStore } from "./fixture";
import type { InferenceKind } from "./types";

export function fsFixtureStore(fixturesDir: string, requestsDir: string): FixtureStore {
  const reqPath = (kind: InferenceKind, hash: string) => join(requestsDir, kind, `${hash}.json`);
  return {
    readFixture(kind, hash) {
      const p = join(fixturesDir, kind, `${hash}.json`);
      return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as FixtureFile) : undefined;
    },
    hasRequest: (kind, hash) => existsSync(reqPath(kind, hash)),
    recordRequest(kind, hash, request) {
      const p = reqPath(kind, hash);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, JSON.stringify({ type: kind, requestHash: hash, request }, null, 1));
      return p;
    },
    listMissing() {
      const out: { type: string; hash: string }[] = [];
      if (!existsSync(requestsDir)) return out;
      for (const type of readdirSync(requestsDir)) {
        for (const f of readdirSync(join(requestsDir, type))) {
          if (f.endsWith(".json") && !existsSync(join(fixturesDir, type, f))) out.push({ type, hash: f.replace(/\.json$/, "") });
        }
      }
      return out;
    },
  };
}
