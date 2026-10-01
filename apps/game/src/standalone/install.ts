// No-install web build: the Ender server runs inside the page. Every /api/* request the
// game makes is answered by the same server code, backed by sql.js and bundled seeds.
// The database is saved to this browser's IndexedDB, so progress survives a reload.
import initSqlJs from "sql.js/dist/sql-asm-memory-growth.js";
import type { Database } from "sql.js";
import { memoryFixtureStore, type FixtureFile } from "@ender/inference";
import { realityFromSeeds } from "@ender/reality";
import { SCHEMA, createInPageServer, type Db } from "@ender/server/browser";
import compounds from "@data/seed/pubchem/compounds.json";
import graph from "@data/seed/pubchem/candidate-graph.json";
import marketSeed from "@data/seed/markets/ecb-exr.json";

const fixtureFiles = Object.values(import.meta.glob("@data/inference-fixtures/*/*.json", { eager: true, import: "default" })) as FixtureFile[];
const START_DATE = "2023-08-04";
const IDB = { name: "ender", store: "db", key: "sqlite" };

function sqlJsDb(sdb: Database): Db {
  const norm = (ps: unknown[]) => ps.map((p) => (p === undefined ? null : p)) as never[];
  return {
    prepare(sql) {
      return {
        all(...ps) {
          const st = sdb.prepare(sql);
          try {
            st.bind(norm(ps));
            const out: unknown[] = [];
            while (st.step()) out.push(st.getAsObject());
            return out;
          } finally {
            st.free();
          }
        },
        get(...ps) {
          const st = sdb.prepare(sql);
          try {
            st.bind(norm(ps));
            return st.step() ? st.getAsObject() : undefined;
          } finally {
            st.free();
          }
        },
        run(...ps) {
          sdb.run(sql, norm(ps));
          return { changes: sdb.getRowsModified() };
        },
      };
    },
    exec: (sql) => void sdb.exec(sql),
    close: () => sdb.close(),
  };
}

/** IndexedDB can hang without ever answering (seen in embedded pages on phones); a read gives up after this. */
const IDB_READ_MS = 2500;
const TIMED_OUT = Symbol("timed out");

function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open(IDB.name, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(IDB.store);
      open.onerror = () => resolve(undefined);
      open.onsuccess = () => {
        const req = fn(open.result.transaction(IDB.store, mode).objectStore(IDB.store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(undefined);
      };
    } catch {
      resolve(undefined); // private mode / storage blocked: play without saving
    }
  });
}

export async function installInPageServer() {
  const SQL = await initSqlJs();
  const read = await Promise.race([
    idb<Uint8Array>("readonly", (s) => s.get(IDB.key) as IDBRequest<Uint8Array>),
    new Promise<typeof TIMED_OUT>((r) => setTimeout(() => r(TIMED_OUT), IDB_READ_MS)),
  ]);
  // If the save couldn't be read, play on without one, and never write over it: the old save stays intact.
  const canSave = read !== TIMED_OUT;
  if (!canSave) (window as { __enderNoSave?: boolean }).__enderNoSave = true;
  const saved = read === TIMED_OUT ? undefined : read;
  const sdb = saved ? new SQL.Database(saved) : new SQL.Database();
  sdb.exec(SCHEMA);
  const server = createInPageServer({
    db: sqlJsDb(sdb),
    reality: realityFromSeeds({ compounds: compounds.compounds as never, graph: graph as never }),
    marketSeed: marketSeed as never,
    fixtures: memoryFixtureStore(fixtureFiles),
    startDate: START_DATE,
  });

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    if (!canSave) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void idb("readwrite", (s) => s.put(sdb.export(), IDB.key)), 400);
  };

  const realFetch = window.fetch.bind(window);
  let lastYield = 0;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = url.startsWith("/") ? url : new URL(url, location.href).origin === location.origin ? new URL(url).pathname + new URL(url).search : "";
    if (!path.startsWith("/api/")) return realFetch(input, init);
    // The server runs on the page's own thread, so let the screen show the tap first (one frame), then answer.
    if (performance.now() - lastYield > 40) {
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
      lastYield = performance.now();
    }
    const method = (init?.method ?? "GET").toUpperCase();
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    const out = await server.handle(method, path, body);
    if (method !== "GET") save();
    return new Response(JSON.stringify(out.body ?? null), { status: out.status, headers: { "content-type": "application/json" } });
  };
}
