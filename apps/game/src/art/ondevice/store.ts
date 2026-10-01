import { useEffect, useSyncExternalStore } from "react";

/**
 * On-device character art: the hero and foes painted on the player's own GPU (apps/hero-painter), cut out of their
 * backdrop and kept in this browser. This module is the small, always-loaded half: what's been painted, and the
 * queue of what to paint next. The painter itself (service.ts, plus the model) loads behind the first screen.
 *
 * Art is only ever swapped in when it's ready: until then every figure keeps its drawn or pre-painted art, so the
 * player never waits on a paint.
 */

/** What to paint: phrase keys from the painter's manifest plus a noise seed. `key` names the result. */
export type ArtSpec = { key: string; traits: string[]; seed: number; kind: "hero" | "foe"; group?: string };
/** A painted cut-out, cropped to its silhouette (feet or knees on the bottom edge). */
export type Art = { bmp: ImageBitmap; w: number; h: number };

const BASE = import.meta.env.VITE_PAINTER_BASE as string | undefined;

function wanted(): boolean {
  if (!BASE || typeof navigator === "undefined" || !("gpu" in navigator)) return false;
  try {
    if (new URLSearchParams(location.search).get("painter") === "0") return false;
    if (localStorage.getItem("ender:painter") === "off") return false;
  } catch {
    /* storage blocked: still paint, just without the opt-out */
  }
  return true;
}
/** True where on-device painting can run (a WebGPU browser, on a build that ships the model). */
export const onDeviceArt = wanted();
export const painterBase = () => BASE!;

const done = new Map<string, Art>();
const listeners = new Set<() => void>();
let version = 0;
export function publish(key: string, art: Art) {
  done.set(key, art);
  version++;
  for (const l of listeners) l();
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The newest finished paint of each group (e.g. a hero's earlier Loom stage), kept across reloads. */
const LAST = "ender:art-last";
function lastOf(group: string): string | undefined {
  try {
    return (JSON.parse(localStorage.getItem(LAST) ?? "{}") as Record<string, string>)[group];
  } catch {
    return undefined;
  }
}
export function noteLast(group: string, key: string) {
  try {
    const m = JSON.parse(localStorage.getItem(LAST) ?? "{}") as Record<string, string>;
    m[group] = key;
    localStorage.setItem(LAST, JSON.stringify(m));
  } catch {
    /* private mode */
  }
}

/** Jobs wait here until the service is in; it drains them highest priority first. */
export type Job = { spec: ArtSpec; pri: number; cacheOnly?: boolean };
export const queue: Job[] = [];
let wake: (() => void) | null = null;
export const onQueue = (f: () => void) => void (wake = f);

/** Ask for a paint (or its stored copy). Lower `pri` runs first: 0 the hero, 1 the next foes, 2 later ones. */
export function request(spec: ArtSpec | null, pri = 1, cacheOnly = false) {
  if (!onDeviceArt || !spec || done.has(spec.key)) return;
  const at = queue.findIndex((j) => j.spec.key === spec.key);
  if (at >= 0) {
    if (queue[at]!.pri <= pri && !(queue[at]!.cacheOnly && !cacheOnly)) return;
    queue.splice(at, 1);
  }
  queue.push({ spec, pri, cacheOnly });
  warm();
  wake?.();
}

let started = false;
/** Start loading the painter in an idle moment (no-op where it can't run). Safe to call often. */
export function warm() {
  if (!onDeviceArt || started) return;
  started = true;
  const go = () => void import("./service").then((s) => s.start()).catch((e) => console.warn("painter off:", e));
  if ("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 1500 });
  else setTimeout(go, 300);
}

export const artNow = (key: string | undefined) => (key ? done.get(key) : undefined);

/**
 * The art for a spec once painted, else the newest earlier paint of its group (a hero keeps their last look while
 * the next Loom stage paints), else undefined (keep the drawn art). `frozen` keeps the first answer for the life of
 * the component, so a fight never swaps art mid-way.
 */
export function usePainted(spec: ArtSpec | null, pri = 1): Art | undefined {
  useSyncExternalStore(subscribe, () => version);
  useEffect(() => {
    if (!spec) return;
    request(spec, pri);
    const last = spec.group ? lastOf(spec.group) : undefined;
    if (last && last !== spec.key && !done.has(last)) request({ ...spec, key: last }, -1, true);
  }, [spec?.key]);
  if (!spec) return undefined;
  const own = done.get(spec.key);
  if (own) return own;
  const last = spec.group ? lastOf(spec.group) : undefined;
  return last ? done.get(last) : undefined;
}
