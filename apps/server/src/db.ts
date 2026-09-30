/**
 * Schema and query helpers. The database handle is anything with node:sqlite's
 * prepare/exec shape: node:sqlite on the server (db-node.ts), sql.js in the browser build.
 */
export type Stmt = {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): unknown;
};
export type Db = { prepare(sql: string): Stmt; exec(sql: string): void; close(): void };

export const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  preset TEXT,
  level INTEGER NOT NULL,
  xp INTEGER NOT NULL,
  crowns REAL NOT NULL,
  focus INTEGER NOT NULL,
  free_attunes_used INTEGER NOT NULL DEFAULT 0,
  passive_points INTEGER NOT NULL,
  build_policy TEXT NOT NULL,
  equipped TEXT NOT NULL,
  runs_started INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS character_mastery (
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  successes REAL NOT NULL,
  failures REAL NOT NULL,
  opportunities INTEGER NOT NULL,
  PRIMARY KEY (character_id, domain)
);
CREATE TABLE IF NOT EXISTS mastery_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  success REAL NOT NULL,
  reason TEXT NOT NULL,
  level INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS passive_allocations (
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  passive_id TEXT NOT NULL,
  allocated_at TEXT NOT NULL,
  PRIMARY KEY (character_id, passive_id)
);
CREATE TABLE IF NOT EXISTS inventory (
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  quantity REAL NOT NULL,
  PRIMARY KEY (character_id, item_type, item_id)
);
CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  reality_source TEXT NOT NULL,
  reality_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  objective_id TEXT NOT NULL,
  fantasy_name TEXT,
  epithet TEXT,
  evidence_tier TEXT NOT NULL,
  revealed TEXT NOT NULL,
  readings TEXT,
  technical_score REAL,
  production_cost REAL,
  market_value REAL,
  efficiency_score REAL,
  origin TEXT NOT NULL,
  run_id TEXT,
  acquisition_cost REAL NOT NULL DEFAULT 0,
  acquisition_value REAL,
  status TEXT NOT NULL,
  equipped_slot TEXT,
  bound INTEGER NOT NULL DEFAULT 0,
  familiar TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS artifact_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artifact_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  evidence_tier TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS artifact_lineage (
  child_id TEXT NOT NULL,
  parent_id TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (child_id, parent_id)
);
CREATE TABLE IF NOT EXISTS artifact_evaluations (
  id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  technical_score REAL NOT NULL,
  production_cost REAL NOT NULL,
  market_value REAL NOT NULL,
  efficiency_score REAL NOT NULL,
  margin REAL NOT NULL,
  snapshot_id TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pending_tempers (
  artifact_id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL,
  options TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL,
  realm_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  seed TEXT NOT NULL,
  plan TEXT NOT NULL,
  status TEXT NOT NULL,
  rooms_granted TEXT NOT NULL,
  result TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE TABLE IF NOT EXISTS run_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS inference_events (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL,
  artifact_id TEXT,
  type TEXT NOT NULL,
  action TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  provider TEXT NOT NULL,
  work_units REAL NOT NULL,
  xp_awarded INTEGER NOT NULL,
  run_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS xp_awards (
  award_key TEXT PRIMARY KEY,
  xp INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS world_snapshots (
  id TEXT PRIMARY KEY,
  idx INTEGER NOT NULL,
  date TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS market_observations (
  id TEXT PRIMARY KEY,
  essence TEXT NOT NULL,
  series_key TEXT NOT NULL,
  obs_date TEXT NOT NULL,
  value REAL NOT NULL,
  source TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS world_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS essence_prices (
  snapshot_id TEXT NOT NULL,
  essence TEXT NOT NULL,
  price REAL NOT NULL,
  scarcity REAL NOT NULL,
  breakdown TEXT NOT NULL,
  PRIMARY KEY (snapshot_id, essence)
);
CREATE TABLE IF NOT EXISTS market_transactions (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  side TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  world_snapshot_id TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS npc_demand (
  snapshot_id TEXT NOT NULL,
  essence TEXT NOT NULL,
  pressure REAL NOT NULL,
  npc_factor REAL NOT NULL,
  PRIMARY KEY (snapshot_id, essence)
);
CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL,
  data TEXT NOT NULL,
  status TEXT NOT NULL,
  fulfilled_by TEXT,
  fulfilled_artifact_id TEXT,
  expires_index INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS bazaar_offers (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL,
  reality_id TEXT NOT NULL,
  realm_id TEXT NOT NULL,
  price REAL NOT NULL,
  status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS prophecies (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL,
  essence TEXT NOT NULL,
  probability REAL NOT NULL,
  snapshot_id TEXT NOT NULL,
  target_snapshot_id TEXT NOT NULL,
  status TEXT NOT NULL,
  outcome INTEGER,
  loss REAL,
  quality REAL,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
`;


export const now = () => new Date().toISOString();

type Row = Record<string, unknown>;
export const all = <T = Row>(db: Db, sql: string, ...params: unknown[]) => db.prepare(sql).all(...params) as T[];
export const get = <T = Row>(db: Db, sql: string, ...params: unknown[]) => db.prepare(sql).get(...params) as T | undefined;
export const run = (db: Db, sql: string, ...params: unknown[]) => db.prepare(sql).run(...params);

export function tx<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
