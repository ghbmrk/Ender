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
  /** Record every inference request, including ones that hit a fixture. */
  recordAllRequests?: boolean;
  /** Replay date a new world starts on. */
  startDate: string;
  devRoutes: boolean;
};

export function configFromEnv(overrides: Partial<ServerConfig> = {}): ServerConfig {
  const dataDir = process.env.ENDER_DATA_DIR ?? resolve(REPO_ROOT, "data");
  return {
    dataDir,
    dbPath: process.env.ENDER_DB ?? resolve(REPO_ROOT, ".local/ender.sqlite"),
    strictFixtures: process.env.ENDER_STRICT_FIXTURES === "1",
    recordMissing: process.env.ENDER_RECORD_REQUESTS !== "0",
    startDate: process.env.ENDER_START_DATE ?? DEFAULT_START_DATE,
    devRoutes: process.env.ENDER_DEV_ROUTES !== "0",
    ...overrides,
  };
}

/** A turning where one Essence is clearly dear, so the first Bazaar visit has a story. */
export const DEFAULT_START_DATE = "2023-08-04";
