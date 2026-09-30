import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export type ServerConfig = {
  dataDir: string;
  dbPath: string;
  /** Throw FixtureRequired instead of falling back to rules. */
  strictFixtures: boolean;
  /** Record missing fixture requests to data/inference-requests. */
  recordMissing: boolean;
  /** Replay date a new world starts on. */
  startDate: string;
  devRoutes: boolean;
};

export function configFromEnv(overrides: Partial<ServerConfig> = {}): ServerConfig {
  const dataDir = process.env.WEAVE_DATA_DIR ?? resolve(REPO_ROOT, "data");
  return {
    dataDir,
    dbPath: process.env.WEAVE_DB ?? resolve(REPO_ROOT, ".local/weave.sqlite"),
    strictFixtures: process.env.WEAVE_STRICT_FIXTURES === "1",
    recordMissing: process.env.WEAVE_RECORD_REQUESTS !== "0",
    startDate: process.env.WEAVE_START_DATE ?? DEFAULT_START_DATE,
    devRoutes: process.env.WEAVE_DEV_ROUTES !== "0",
    ...overrides,
  };
}

/** A turning where one Essence is clearly dear, so the first Bazaar visit has a story. */
export const DEFAULT_START_DATE = "2023-08-04";
