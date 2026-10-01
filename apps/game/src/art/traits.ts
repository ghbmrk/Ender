import { GARBS, PALETTES, type Garb } from "./look";

/**
 * Character creation picks three traits (Mark, 22:25): abstract words, not parts. Each trait leans the hero toward a
 * garb and a palette; together they choose the painted look. Palettes index PALETTES in look.ts.
 */
export type Trait = { id: string; name: string; garb: Partial<Record<Garb, number>>; pal: Partial<Record<number, number>> };

export const TRAITS: Trait[] = [
  { id: "tough", name: "Tough", garb: { armour: 2 }, pal: { 4: 1, 0: 1 } },
  { id: "sly", name: "Sly", garb: { leathers: 2 }, pal: { 7: 1, 4: 1 } },
  { id: "wise", name: "Wise", garb: { robes: 2 }, pal: { 1: 1, 6: 1 } },
  { id: "beautiful", name: "Beautiful", garb: { robes: 1 }, pal: { 6: 2, 3: 1 } },
  { id: "fierce", name: "Fierce", garb: { armour: 1 }, pal: { 0: 2 } },
  { id: "swift", name: "Swift", garb: { leathers: 1 }, pal: { 2: 2 } },
  { id: "noble", name: "Noble", garb: { armour: 1 }, pal: { 3: 2, 0: 1 } },
  { id: "wild", name: "Wild", garb: { leathers: 1 }, pal: { 7: 2, 2: 1 } },
  { id: "mysterious", name: "Mysterious", garb: { robes: 1 }, pal: { 3: 1, 1: 1 } },
  { id: "grim", name: "Grim", garb: { armour: 1 }, pal: { 4: 2 } },
  { id: "cold", name: "Cold", garb: { robes: 1 }, pal: { 1: 2, 6: 1 } },
  { id: "bright", name: "Bright", garb: { leathers: 1 }, pal: { 5: 2 } },
];
export const PICKS = 3;

/** The garb and palette three picked traits add up to. Earlier picks break ties, so the first word leads. */
export function lookForTraits(ids: string[]): { garb: Garb; pal: number } | null {
  const picked = ids.map((id) => TRAITS.find((t) => t.id === id)).filter((t): t is Trait => !!t);
  if (!picked.length) return null;
  const g: Record<string, number> = {};
  const p: Record<number, number> = {};
  picked.forEach((t, i) => {
    const lead = (picked.length - i) * 0.01;
    for (const [k, v] of Object.entries(t.garb)) g[k] = (g[k] ?? 0) + v! + lead;
    for (const [k, v] of Object.entries(t.pal)) p[Number(k)] = (p[Number(k)] ?? 0) + v! + lead;
  });
  const garb = (GARBS.slice().sort((a, b) => (g[b] ?? 0) - (g[a] ?? 0))[0] ?? "armour") as Garb;
  const pal = Number(Object.entries(p).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0);
  return { garb, pal: Math.min(PALETTES.length - 1, Math.max(0, pal)) };
}
