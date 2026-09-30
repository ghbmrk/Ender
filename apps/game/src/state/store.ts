import { useSyncExternalStore } from "react";

export type Screen = "title" | "crossing" | "realm";
export type Panel = null | "gate" | "crucible" | "bazaar" | "grimoire" | "passives" | "inventory" | "provenance" | "analytics" | "shrine" | "summary";

export type Toast = { id: number; text: string; tone?: "gain" | "loss" | "info" | "mastery" };

export type State = {
  screen: Screen;
  panel: Panel;
  crucibleFocus?: string | null;
  crucibleMode?: "craft" | "mirror";
  character: any | null;
  run: any | null;
  runSummary: any | null;
  devMode: boolean;
  toasts: Toast[];
  world: any | null;
  shrineForms?: any[];
};

let state: State = {
  screen: "title",
  panel: null,
  character: null,
  run: null,
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
  setState((s) => ({ toasts: [...s.toasts.slice(-4), { id, text, tone }] }));
  setTimeout(() => setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4200);
}
