import { createPainter, type Manifest, type Painter } from "../../../../hero-painter/engine.js";
import { getState } from "../../state/store";
import { noteLast, onQueue, painterBase, publish, queue, type Art, type Job } from "./store";

/**
 * The painter's runtime: loads the model (cached by the browser after the first visit), then paints queued
 * characters one at a time. It only works while nothing needs the GPU or main thread more: never during a fight,
 * never within a moment of a tap, never in a hidden tab. Finished cut-outs are stored in IndexedDB, so each
 * character is painted once per device.
 */

const CACHE = "ender-painter-v1";
let painter: Painter | null = null;
let running = false;
export const stats: { loadS?: number; paints: { key: string; ms: number }[]; error?: string } = { paints: [] };
/** Test hook: `hold` pauses painting between blocks (a software GPU can stall the page for seconds per block). */
const ctl = { hold: false };
(window as unknown as { __enderArt: unknown }).__enderArt = { stats, queue, ctl };

// ---------- when to work ----------
let lastInput = 0;
addEventListener("pointerdown", () => (lastInput = performance.now()), { capture: true, passive: true });
addEventListener("keydown", () => (lastInput = performance.now()), { capture: true, passive: true });
const busy = () => ctl.hold || getState().screen === "battle" || document.hidden || performance.now() - lastInput < 700;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const idle = () => new Promise<void>((r) => ("requestIdleCallback" in window ? requestIdleCallback(() => r(), { timeout: 250 }) : setTimeout(r, 16)));
/** Holds the painter between blocks until the page is quiet, then lets it run one more block. */
async function gate() {
  while (busy()) await sleep(200);
  await idle();
}

// ---------- storage ----------
async function cachedFetch(url: string): Promise<ArrayBuffer> {
  let cache: Cache | null = null;
  try {
    cache = await caches.open(CACHE);
    const hit = await cache.match(url);
    if (hit) return hit.arrayBuffer();
  } catch {
    /* no Cache API (private mode): fetch every time */
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`painter download failed (${r.status}) for ${url}`);
  if (cache) await cache.put(url, r.clone()).catch(() => undefined);
  return r.arrayBuffer();
}
/** Drop cached chunks a newer export no longer names (chunk names carry their content hash). */
async function pruneCache(keep: Set<string>) {
  try {
    const cache = await caches.open(CACHE);
    for (const req of await cache.keys()) if (!keep.has(req.url)) await cache.delete(req);
  } catch {
    /* nothing to prune */
  }
}

type Stored = { key: string; w: number; h: number; px: Uint8ClampedArray; at: number };
const KEEP = 60;
let dbp: Promise<IDBDatabase | null> | null = null;
function db() {
  dbp ??= new Promise((res) => {
    try {
      const o = indexedDB.open("ender-art", 1);
      o.onupgradeneeded = () => o.result.createObjectStore("paints", { keyPath: "key" });
      o.onsuccess = () => res(o.result);
      o.onerror = () => res(null);
    } catch {
      res(null);
    }
  });
  return dbp;
}
async function getStored(key: string): Promise<Stored | undefined> {
  const d = await db();
  if (!d) return undefined;
  return new Promise((res) => {
    const r = d.transaction("paints").objectStore("paints").get(key);
    r.onsuccess = () => res(r.result as Stored | undefined);
    r.onerror = () => res(undefined);
  });
}
async function putStored(s: Stored) {
  const d = await db();
  if (!d) return;
  const store = d.transaction("paints", "readwrite").objectStore("paints");
  store.put(s);
  // Keep the newest few dozen; older foes are painted again if ever met again.
  const all = store.getAll();
  all.onsuccess = () => {
    const rows = (all.result as Stored[]).sort((a, b) => b.at - a.at);
    for (const r of rows.slice(KEEP)) store.delete(r.key);
  };
}

// ---------- cut-out ----------
/** The matte (320², 0..1) applied as alpha, then cropped to the figure's silhouette. */
function cutOut(rgba: Uint8ClampedArray, m: Float32Array | null): { w: number; h: number; px: Uint8ClampedArray } {
  const W = 512, S = 320;
  const px = new Uint8ClampedArray(rgba);
  let x0 = W, y0 = W, x1 = -1, y1 = -1;
  for (let y = 0; y < W; y++) {
    const sy = Math.max(0, ((y + 0.5) * S) / W - 0.5), ya = Math.min(S - 1, sy | 0), yb = Math.min(S - 1, ya + 1), fy = sy - ya;
    for (let x = 0; x < W; x++) {
      let a = 255;
      if (m) {
        const sx = Math.max(0, ((x + 0.5) * S) / W - 0.5), xa = Math.min(S - 1, sx | 0), xb = Math.min(S - 1, xa + 1), fx = sx - xa;
        const v = (m[ya * S + xa]! * (1 - fx) + m[ya * S + xb]! * fx) * (1 - fy) + (m[yb * S + xa]! * (1 - fx) + m[yb * S + xb]! * fx) * fy;
        a = Math.min(1, Math.max(0, (v - 0.08) / 0.84)) * 255;
      }
      px[(y * W + x) * 4 + 3] = a;
      if (a > 40) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { w: W, h: W, px };
  const w = x1 - x0 + 1, h = y1 - y0 + 1, out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) out.set(px.subarray(((y + y0) * W + x0) * 4, ((y + y0) * W + x1 + 1) * 4), y * w * 4);
  return { w, h, px: out };
}

async function toArt(s: { w: number; h: number; px: Uint8ClampedArray }): Promise<Art> {
  const bmp = await createImageBitmap(new ImageData(new Uint8ClampedArray(s.px), s.w, s.h));
  return { bmp, w: s.w, h: s.h };
}

// ---------- the queue ----------
async function runJob({ spec, cacheOnly }: Job) {
  const stored = await getStored(spec.key);
  if (stored) {
    publish(spec.key, await toArt(stored));
    return;
  }
  if (cacheOnly || !painter) return;
  const missing = spec.traits.filter((t) => !(t in painter!.phrases));
  if (missing.length) {
    console.warn("painter: unknown phrases", missing);
    return;
  }
  const t0 = performance.now();
  const { rgba } = await painter.paint({ traits: spec.traits, seed: spec.seed, gate });
  await gate();
  const cut = cutOut(rgba, await painter.matte(rgba));
  stats.paints.push({ key: spec.key, ms: Math.round(performance.now() - t0) });
  await putStored({ key: spec.key, ...cut, at: Date.now() });
  publish(spec.key, await toArt(cut));
  if (spec.group) noteLast(spec.group, spec.key);
}

async function drain() {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      queue.sort((a, b) => a.pri - b.pri);
      const job = queue.shift()!;
      // Stored copies need no GPU, so they load even before the model is in.
      if (!painter && !job.cacheOnly && !(await getStored(job.spec.key))) {
        queue.unshift(job);
        break;
      }
      await gate();
      await runJob(job).catch((e) => console.warn("painter job failed", job.spec.key, e));
    }
  } finally {
    running = false;
  }
}

let starting: Promise<void> | null = null;
export function start() {
  starting ??= (async () => {
    onQueue(() => void drain());
    void drain();
    const t0 = performance.now();
    const base = new URL(painterBase(), location.href);
    const manifest = (await (await fetch(new URL("manifest.json", base), { cache: "no-cache" })).json()) as Manifest;
    const urls = [...manifest.files, manifest.matte?.json, manifest.matte?.bin].filter(Boolean).map((f) => new URL(f!, base).href);
    void pruneCache(new Set(urls));
    painter = await createPainter({ manifest, fetchChunk: (f) => cachedFetch(new URL(f, base).href), gate });
    stats.loadS = Math.round((performance.now() - t0) / 100) / 10;
    void painter.lost.then(() => {
      painter = null;
      stats.error = "GPU device lost";
    });
    void drain();
  })().catch((e) => {
    stats.error = (e as Error).message;
    console.warn("painter unavailable:", e);
  });
  return starting;
}
