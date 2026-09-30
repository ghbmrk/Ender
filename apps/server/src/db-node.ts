import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
// node:sqlite ships with Node ≥ 22.13: no native build, no database setup.
import { DatabaseSync } from "node:sqlite";
import { SCHEMA, type Db } from "./db";

export function openDb(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  return db as unknown as Db;
}
