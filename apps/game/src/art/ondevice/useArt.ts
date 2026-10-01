import { useMemo } from "react";
import { compileLoom, type LoomNode } from "@ender/battle";
import { getState, subscribe, useStore } from "../../state/store";
import { paintedFigure } from "../painted";
import { foeSpec, heroLookId, heroSpec, ranksFrom, type Ranks } from "./specs";
import { onDeviceArt, request, usePainted, type Art } from "./store";

/** The hero's Loom ranks as they fight now: the Expedition's locked snapshot, else the live Loom. */
export function heroRanks(): Ranks {
  const s = getState();
  const hero = s.hero;
  if (!hero) return {};
  const snap = s.expedition?.loom as { rank?: number; heroes?: Record<string, LoomNode[]> } | null | undefined;
  const live = s.loom as { rank?: number; heroes?: Record<string, { nodes?: LoomNode[] }> } | null | undefined;
  const nodes = (snap ? snap.heroes?.[hero.root] : live?.heroes?.[hero.root]?.nodes) ?? [];
  const c = compileLoom(nodes, snap?.rank ?? live?.rank ?? 1);
  const active = new Set(c.activeNodeIds);
  return ranksFrom(nodes.filter((n) => active.has(n.id)), c.keystone?.affinity);
}

/** The hero's painted look: their newest finished paint, which follows their Loom as it grows. */
export function useHeroArt(): Art | undefined {
  const hero = useStore((s) => s.hero);
  const loom = useStore((s) => s.loom);
  const snap = useStore((s) => s.expedition?.loom);
  const spec = useMemo(() => (onDeviceArt && hero ? heroSpec(hero, heroRanks()) : null), [hero, loom, snap]);
  const painted = usePainted(spec, 0);
  // Until this device's paint is in (or where it can't paint), the same look pre-painted with the same model.
  const base = useMemo(() => {
    const id = hero ? heroLookId(hero) : null;
    const url = id ? paintedFigure(id) : undefined;
    return url ? { url, w: 0, h: 0 } : undefined;
  }, [hero]);
  return painted ?? base;
}

/** Where a foe was met, so the same place on the same Expedition always shows the same individual. */
export const foeWhere = (nodeId: string) => `${getState().expedition?.plan?.seed ?? "free"}|${nodeId}`;

/** Paint ahead: the foes waiting at these map stops, nearest first, so their fights open with their art ready. */
export function prepaintFoes(stops: { id: string; encounter?: { waves: string[][] } }[]) {
  if (!onDeviceArt) return;
  stops.forEach((n, i) => {
    for (const k of n.encounter?.waves.flat() ?? []) request(foeSpec(k, foeWhere(n.id)), 1 + i * 0.01);
  });
}

let watching = false;
/** Keep the hero's paint current from the first screen on: a new hero or a new Loom stage queues its paint at once. */
export function watchHero() {
  if (!onDeviceArt || watching) return;
  watching = true;
  let last = "";
  let seen: unknown[] = [];
  const check = () => {
    const s = getState();
    const now = [s.hero, s.loom, s.expedition?.loom];
    if (now.every((v, i) => v === seen[i])) return;
    seen = now;
    const hero = s.hero;
    const spec = hero ? heroSpec(hero, heroRanks()) : null;
    if (!spec || spec.key === last) return;
    last = spec.key;
    request(spec, 0);
  };
  subscribe(check);
  check();
}
