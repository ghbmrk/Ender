import { resolve } from "node:path";
import { fsFixtureStore } from "@weave/inference/node";
import { loadMarketSeed, loadReality } from "@weave/reality/node";
import type { ServerConfig } from "./config";
import { openDb } from "./db-node";
import { createContext } from "./services/context";

export const nodeFixtureStore = (config: ServerConfig) => fsFixtureStore(resolve(config.dataDir, "inference-fixtures"), resolve(config.dataDir, "inference-requests"));

export function createNodeContext(config: ServerConfig) {
  return createContext(config, {
    db: openDb(config.dbPath),
    reality: loadReality(config.dataDir),
    marketSeed: loadMarketSeed(config.dataDir),
    fixtures: nodeFixtureStore(config),
  });
}
