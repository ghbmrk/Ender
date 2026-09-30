import type { FormRealityData } from "@ender/shared";
import { productionRecipe } from "@ender/economy";
import { buildCandidateGraph, type CandidateGraph } from "./graph";
import { PubChemRealityAdapter, type LoreRecord } from "./adapter";

export type RealitySeeds = {
  compounds: FormRealityData[];
  /** Precomputed neighbour graph; rebuilt from compounds when absent. */
  graph?: CandidateGraph;
  lore?: LoreRecord[];
};

/** Build the adapter from already-loaded seed objects (works in Node and the browser). */
export function realityFromSeeds(seeds: RealitySeeds) {
  const graph = seeds.graph ?? buildCandidateGraph(seeds.compounds);
  // Recipes are an economic rule, not data: always derive them from qualities.
  for (const c of graph.candidates) c.recipe = productionRecipe(c.qualities);
  return new PubChemRealityAdapter(graph, seeds.compounds, seeds.lore ?? []);
}
