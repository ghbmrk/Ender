import { useSyncExternalStore } from "react";
import type { RootId } from "@ender/battle";

/** Scenes drawn on the portrait stage. Menu sheets (panels) open over them at the device's own pixel size. */
export type Screen = "title" | "create" | "crossing" | "map" | "battle" | "loom";
export type Panel = null | "gate" | "crucible" | "bazaar" | "grimoire" | "inventory" | "provenance" | "rewards" | "summary" | "codex";

export type Toast = { id: number; text: string; tone?: "gain" | "loss" | "info" | "mastery" };

export type MapNode = { id: string; layer: number; kind: string; links: string[]; encounter?: { waves: string[][]; difficulty: number }; label?: string };
export type Expedition = {
  plan: { runId: string; realmId: string; seed: string; difficulty: number; boss: string; map: { layers: MapNode[][] } };
  visited: string[];
  /** The node the party stands on (null before the first step). */
  at: string | null;
  partyHp: Partial<Record<RootId, number>>;
  /** The Loom the party carries: saved at the start and whenever it leaves a Shrine (§80). */
  loom: { rank: number; heroes: Record<RootId, unknown[]> } | null;
};

export type State = {
  screen: Screen;
  panel: Panel;
  crucibleFocus?: string | null;
  crucibleMode?: "craft" | "mirror";
  /** The Loom opened straight after a fight to weave what dropped (Mark: crafting follows combat). */
  afterFight?: boolean;
  character: any | null;
  /** Server Loom view: rank, capacity and each hero's placed nodes plus the unplaced pool. */
  loom: any | null;
  /** Where the Loom may be edited: the Crossing or a Shrine (§79). */
  loomEditable: boolean;
  expedition: Expedition | null;
  /** The fight in progress: which map node it came from. */
  battle: { nodeId: string; kind: string; waves: string[][]; difficulty: number } | null;
  rewards: any | null;
  runSummary: any | null;
  devMode: boolean;
  toasts: Toast[];
  world: any | null;
  /** The prologue lesson in progress (null once it is done or skipped). */
  tutorial: import("../game/tutorial").TutStep | null;
  /** Bumped each time a practice fight starts, so a retry gets a fresh battle. */
  tutorialRun?: number;
  /** The player's own hero (made in the prologue); null for saves from before heroes were made. */
  hero: import("../art/look").Hero | null;
};

let state: State = {
  // A new player goes straight into making their hero; a returning one gets the hero select.
  screen: (() => {
    try {
      return localStorage.getItem("ender:hero") || localStorage.getItem("ender:tutorial") ? "title" : "create";
    } catch {
      return "create";
    }
  })(),
  panel: null,
  character: null,
  loom: null,
  loomEditable: true,
  expedition: null,
  battle: null,
  rewards: null,
  runSummary: null,
  devMode: (() => {
    try {
      return localStorage.getItem("ender:dev") === "1";
    } catch {
      return false;
    }
  })(),
  toasts: [],
  world: null,
  tutorial: null,
  hero: (() => {
    try {
      const v = localStorage.getItem("ender:hero");
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  })(),
};
const listeners = new Set<() => void>();

export const getState = () => state;
export function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  for (const l of listeners) l();
}
export const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state));
}

let toastId = 0;
/** Notices show one at a time: a new one waits until the one on screen has had its moment. */
const toastQueue: { text: string; tone: Toast["tone"] }[] = [];
let toastShowing = false;
function showNextToast() {
  const next = toastQueue.shift();
  if (!next) {
    toastShowing = false;
    return;
  }
  toastShowing = true;
  const id = ++toastId;
  setState((s) => ({ toasts: [{ id, ...next }] }));
  // Shorter holds while others wait, so a burst of notices doesn't hang around.
  const hold = toastQueue.length ? 2200 : 3800;
  current = { id, since: Date.now(), until: Date.now() + hold, timer: setTimeout(endToast, hold) };
}
let current: { id: number; since: number; until: number; timer: ReturnType<typeof setTimeout> } | null = null;
function endToast() {
  if (!current) return;
  const { id, timer } = current;
  clearTimeout(timer);
  current = null;
  setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  setTimeout(showNextToast, 180);
}
/** Tapping a notice puts it away. */
export const dismissToast = endToast;
/** On a new screen, a notice from the last one leaves soon rather than covering the new one. A notice raised with
 *  the move itself (younger than half a second) is about the new screen, so it keeps its time. */
export function hurryToast(ms = 1200) {
  if (!current || Date.now() - current.since < 500 || current.until - Date.now() <= ms) return;
  clearTimeout(current.timer);
  current.until = Date.now() + ms;
  current.timer = setTimeout(endToast, ms);
}
export function toast(text: string, tone: Toast["tone"] = "info") {
  if (toastQueue.length >= 3) toastQueue.shift();
  toastQueue.push({ text, tone });
  if (!toastShowing) showNextToast();
}
