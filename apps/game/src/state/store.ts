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
export function toast(text: string, tone: Toast["tone"] = "info") {
  const id = ++toastId;
  setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, tone }] }));
  setTimeout(() => setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3800);
}
