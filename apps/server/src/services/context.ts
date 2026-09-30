import { percentile, type WorldSnapshot } from "@ender/shared";
import { basePrices, buildSnapshots, productionCost, type BuiltWorld, type MarketSeed } from "@ender/economy";
import type { PubChemRealityAdapter } from "@ender/reality";
import { FixtureInferenceProvider, RuleInferenceProvider, type FixtureStore, type InferenceProvider } from "@ender/inference";
import { migrate, type Db } from "../db";
import type { ServerConfig } from "../config";

export type Ctx = {
  config: ServerConfig;
  db: Db;
  reality: PubChemRealityAdapter;
  world: BuiltWorld;
  snapshotById: Map<string, WorldSnapshot>;
  inference: InferenceProvider;
  fixtures: FixtureStore;
  /** Median corpus production cost at base prices; anchors efficiency. */
  referenceCost: number;
};

/**
 * Runtime inference selection: fixtures first, deterministic rules when no fixture exists.
 * The future ChatGPT-plan provider is never selected in the MVP.
 */
export function selectInferenceProvider(config: ServerConfig, store: FixtureStore): InferenceProvider {
  return new FixtureInferenceProvider({
    store,
    strict: config.strictFixtures,
    recordMissing: config.recordMissing,
    recordAll: config.recordAllRequests,
    fallback: new RuleInferenceProvider(),
  });
}

export type ContextParts = { db: Db; reality: PubChemRealityAdapter; marketSeed: MarketSeed; fixtures: FixtureStore };

/** Assemble a context from its parts; Node (node-context.ts) and the browser build supply them differently. */
export function createContext(config: ServerConfig, parts: ContextParts): Ctx {
  const { db, reality, fixtures } = parts;
  migrate(db);
  const world = buildSnapshots(parts.marketSeed);
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
    inference: selectInferenceProvider(config, fixtures),
    fixtures,
    referenceCost: percentile(costs, 0.5),
  };
}
