/** Normalize qualities, compute feature vectors and nearest neighbours; write the candidate graph. */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildCandidateGraph } from "@ender/reality";
import { loadCompounds } from "@ender/reality/node";
import { DATA_DIR } from "./paths";

const compounds = loadCompounds(DATA_DIR);
const graph = buildCandidateGraph(compounds);
writeFileSync(resolve(DATA_DIR, "seed/pubchem/candidate-graph.json"), JSON.stringify(graph));
console.log(`candidate graph: ${graph.candidates.length} candidates, ${graph.candidates[0]?.neighbors.length} neighbours each`);
console.log("bands:", JSON.stringify(graph.bands));
