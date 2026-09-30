import { round, type Candidate, type FormRealityData } from "@weave/shared";
import { computeBands, qualityDistance, toQualities, type NormalizationBands } from "@weave/domain";
import { productionRecipe } from "@weave/economy";

export const NEIGHBOR_COUNT = 16;

export type CandidateGraph = {
  bands: NormalizationBands;
  candidates: (Candidate & { distances: number[] })[];
};

/** Normalize qualities → feature vector → nearest neighbours (Euclidean, intentionally simple). */
export function buildCandidateGraph(corpus: FormRealityData[], k = NEIGHBOR_COUNT): CandidateGraph {
  const bands = computeBands(corpus);
  const base = corpus.map((r) => ({ id: r.externalId, qualities: toQualities(r, bands) }));
  const candidates = base.map((c) => {
    const ranked = base
      .filter((o) => o.id !== c.id)
      .map((o) => ({ id: o.id, d: qualityDistance(c.qualities, o.qualities) }))
      .sort((a, b) => a.d - b.d || a.id.localeCompare(b.id))
      .slice(0, k);
    return {
      id: c.id,
      qualities: c.qualities,
      recipe: productionRecipe(c.qualities),
      neighbors: ranked.map((x) => x.id),
      distances: ranked.map((x) => round(x.d, 2)),
    };
  });
  return { bands, candidates };
}
