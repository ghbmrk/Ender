// Node-only seed loading from data/seed. Import from "@weave/reality/node".
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { FormRealityData } from "@weave/shared";
import type { MarketSeed } from "@weave/economy";
import type { CandidateGraph } from "./graph";
import type { LoreRecord } from "./adapter";
import { realityFromSeeds } from "./load";

const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, "utf8")) as T;

export const loadCompounds = (dataDir: string) => readJson<{ compounds: FormRealityData[] }>(resolve(dataDir, "seed/pubchem/compounds.json")).compounds;

export function loadGraph(dataDir: string): CandidateGraph | undefined {
  const p = resolve(dataDir, "seed/pubchem/candidate-graph.json");
  return existsSync(p) ? readJson<CandidateGraph>(p) : undefined;
}

export function loadLore(dataDir: string): LoreRecord[] {
  const p = resolve(dataDir, "seed/openalex/lore.json");
  return existsSync(p) ? (readJson<{ records?: LoreRecord[] }>(p).records ?? []) : [];
}

export const loadMarketSeed = (dataDir: string) => readJson<MarketSeed>(resolve(dataDir, "seed/markets/ecb-exr.json"));

export const loadReality = (dataDir: string) => realityFromSeeds({ compounds: loadCompounds(dataDir), graph: loadGraph(dataDir), lore: loadLore(dataDir) });
