import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { FormRealityData } from "@weave/shared";
import { productionRecipe, type MarketSeed } from "@weave/economy";
import { buildCandidateGraph, type CandidateGraph } from "./graph";
import { PubChemRealityAdapter, type LoreRecord } from "./adapter";

export type SeedPaths = { dataDir: string };

export function loadCompounds(dataDir: string): FormRealityData[] {
  const raw = JSON.parse(readFileSync(resolve(dataDir, "seed/pubchem/compounds.json"), "utf8"));
  return raw.compounds as FormRealityData[];
}

export function loadGraph(dataDir: string, compounds: FormRealityData[]): CandidateGraph {
  const p = resolve(dataDir, "seed/pubchem/candidate-graph.json");
  if (existsSync(p)) {
    const g = JSON.parse(readFileSync(p, "utf8")) as CandidateGraph;
    // Recipes are an economic rule, not data: always derive them from qualities.
    for (const c of g.candidates) c.recipe = productionRecipe(c.qualities);
    return g;
  }
  return buildCandidateGraph(compounds);
}

export function loadLore(dataDir: string): LoreRecord[] {
  const p = resolve(dataDir, "seed/openalex/lore.json");
  if (!existsSync(p)) return [];
  return (JSON.parse(readFileSync(p, "utf8")).records ?? []) as LoreRecord[];
}

export function loadMarketSeed(dataDir: string): MarketSeed {
  return JSON.parse(readFileSync(resolve(dataDir, "seed/markets/ecb-exr.json"), "utf8")) as MarketSeed;
}

export function loadReality(dataDir: string) {
  const compounds = loadCompounds(dataDir);
  const graph = loadGraph(dataDir, compounds);
  return new PubChemRealityAdapter(graph, compounds, loadLore(dataDir));
}
