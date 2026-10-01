import type { Affinity } from "@ender/battle";
import { PALETTES, type Hero } from "../look";
import type { ArtSpec } from "./store";

/**
 * What the painter is asked for. Every phrase key here exists in apps/hero-painter/phrases.json (encoded once at
 * export: the phone never runs a text encoder). The same inputs always give the same picture.
 */

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** Loom affinity ranks (1–3) that show on the hero, strongest first, at most three. */
export type Ranks = Partial<Record<Affinity, number>>;

/** Ranks from the hero's active Loom nodes: a node counts 1 for its first affinity and ½ for its second; a keystone 2 more. */
export function ranksFrom(nodes: { affinities: readonly Affinity[] }[], keystone?: Affinity): Ranks {
  const score: Partial<Record<Affinity, number>> = {};
  for (const n of nodes) {
    const [a, b] = n.affinities;
    if (a) score[a] = (score[a] ?? 0) + 1;
    if (b && b !== a) score[b] = (score[b] ?? 0) + 0.5;
  }
  if (keystone) score[keystone] = (score[keystone] ?? 0) + 2;
  const out: Ranks = {};
  for (const [k, v] of Object.entries(score) as [Affinity, number][]) {
    const r = v >= 5 ? 3 : v >= 3 ? 2 : v >= 1 ? 1 : 0;
    if (r) out[k] = r;
  }
  return out;
}

/** The hero, from behind over the shoulder, wearing their garb and palette, with their strongest Loom affinities showing. */
export function heroSpec(hero: Hero, ranks: Ranks): ArtSpec | null {
  const { look } = hero;
  if (!look.garb) return null;
  const pal = Math.max(0, PALETTES.findIndex((p) => p[0] === look.primary));
  const shown = (Object.entries(ranks) as [Affinity, number][])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([a, r]) => `${a}.${r}`);
  const traits = [`look.${look.garb}.${pal}`, ...shown, `weapon.${look.garb}`, "view", "bg", "style"];
  // The seed stays the hero's own, so a new Loom stage paints the same person, upgraded.
  return { kind: "hero", key: `hero|${look.seed}|${traits.join(",")}`, traits, seed: hash(look.seed), group: `hero|${look.seed}` };
}

/** Foes the one-step model paints well. Others (the moth swarm) keep their pre-painted art. */
const PAINTABLE = new Set(["husk", "wisp", "hound", "keeper", "seer", "ironbound", "cinder", "matron", "king", "wyrm"]);

/** One foe, as met at one place on one Expedition: the same seed always gives the same individual. */
export function foeSpec(kind: string, where: string): ArtSpec | null {
  if (!PAINTABLE.has(kind)) return null;
  const h = hash(`${where}|${kind}`);
  const traits = [`foe.${kind}`, `var.${h % 8}`, "fview", "fbg", "style"];
  return { kind: "foe", key: `foe|${kind}|${h}`, traits, seed: h };
}
