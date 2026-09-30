import { resolve } from "node:path";
import { percentile, type WorldSnapshot } from "@weave/shared";
import { basePrices, buildSnapshots, productionCost, type BuiltWorld } from "@weave/economy";
import { loadMarketSeed, loadReality, type PubChemRealityAdapter } from "@weave/reality";
import { FixtureInferenceProvider, RuleInferenceProvider, type InferenceProvider } from "@weave/inference";
import { openDb, type Db } from "../db";
import type { ServerConfig } from "../config";

export type Ctx = {
  config: ServerConfig;
  db: Db;
  reality: PubChemRealityAdapter;
  world: BuiltWorld;
  snapshotById: Map<string, WorldSnapshot>;
  inference: InferenceProvider;
  /** Median corpus production cost at base prices; anchors efficiency. */
  referenceCost: number;
};

/**
 * Runtime inference selection: fixtures first, deterministic rules when no fixture exists.
 * The future ChatGPT-plan provider is never selected in the MVP.
 */
export function selectInferenceProvider(config: ServerConfig): InferenceProvider {
  return new FixtureInferenceProvider({
    fixturesDir: resolve(config.dataDir, "inference-fixtures"),
    requestsDir: resolve(config.dataDir, "inference-requests"),
    strict: config.strictFixtures,
    recordMissing: config.recordMissing,
    fallback: new RuleInferenceProvider(),
  });
}

export function createContext(config: ServerConfig): Ctx {
  const db = openDb(config.dbPath);
  const reality = loadReality(config.dataDir);
  const world = buildSnapshots(loadMarketSeed(config.dataDir));
  const costs = reality
    .all()
    .map((c) => productionCost(c.recipe, basePrices()))
    .sort((a, b) => a - b);
  return {
    config,
    db,
    reality,
    world,
    snapshotById: new Map(world.snapshots.map((s) => [s.id, s])),
    inference: selectInferenceProvider(config),
    referenceCost: percentile(costs, 0.5),
  };
}
