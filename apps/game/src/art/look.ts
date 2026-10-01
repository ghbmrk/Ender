import type { RootId } from "@ender/battle";

/**
 * The player's hero: one Root (their fighting style) and a look generated from a seed, so no two heroes
 * are drawn alike. Every field is a plain value so the look can be saved and re-rolled piece by piece.
 */
/** What the hero wears, which sets the figure drawn. Purely a look: how they fight is crafted on the Loom. */
export type Garb = "armour" | "leathers" | "robes";
export const GARBS: Garb[] = ["armour", "leathers", "robes"];
export const GARB_FIGURE: Record<Garb, string> = { armour: "warden", leathers: "ranger", robes: "binder" };
export const GARB_NAME: Record<Garb, string> = { armour: "Plate", leathers: "Leathers", robes: "Robes" };

export type HeroLook = {
  seed: string;
  /** Missing on heroes made before garb existed; their Root's figure is used instead. */
  garb?: Garb;
  /** Skin tone, hair colour. */
  skin: string;
  hair: string;
  /** Main cloth (tabard, robe or cloak), its trim/mantle/scarf, and a small accent (plume, glow, fletching). */
  primary: string;
  secondary: string;
  accent: string;
  /** Armour and fittings. */
  metal: "steel" | "bronze" | "blackened";
  /** Headwear variant for the Root's figure: 0 hood or helm (the classic), 1 an alternative, 2 bare-headed. */
  head: 0 | 1 | 2;
  /** Hair style when it shows: 0 short, 1 long, 2 braided, 3 shaved. */
  hairStyle: 0 | 1 | 2 | 3;
  /** Body width, 0.94–1.06 (1 = the drawn figure). */
  build: number;
  /** Seeds the procedural emblem on shield, tabard clasp or robe. */
  emblem: number;
};

/** `root` is internal (every new hero starts on the same Root); the player shapes how they fight on the Loom. */
export type Hero = { root: RootId; name: string; look: HeroLook };

export const SKINS = ["#f6dcc4", "#e2b391", "#c08766", "#8c5a40", "#5a3526", "#3d241a"] as const;
export const HAIRS = ["#1e1712", "#4a2a15", "#8c2c0c", "#c9953a", "#d6dee8", "#43296f"] as const;
/** Cloth palettes: [primary, secondary, accent]. */
export const PALETTES: readonly (readonly [string, string, string])[] = [
  ["#9a2a39", "#c9953a", "#ecc56a"], // oxblood and gold
  ["#23408f", "#6a44a3", "#86c6f2"], // sapphire and violet
  ["#1c605a", "#9a6535", "#f59142"], // verdigris and rust
  ["#43296f", "#c9953a", "#d2bff2"], // violet and gold
  ["#35323a", "#9a2a39", "#c8505a"], // ash and blood
  ["#8f6420", "#1c605a", "#a9e6d8"], // ochre and teal
  ["#d8cfb8", "#23408f", "#b3cbf5"], // bone and sapphire
  ["#4a2a15", "#2c8f84", "#58bfae"], // leather and verdigris
];
const METALS: HeroLook["metal"][] = ["steel", "bronze", "blackened"];

/** A small deterministic PRNG (mulberry32 over an FNV hash of the seed). */
export function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;

/** A complete look from a seed. The same seed always gives the same hero. */
export function lookFromSeed(seed: string): HeroLook {
  const r = rng(seed);
  const [primary, secondary, accent] = pick(r, PALETTES);
  return {
    seed,
    garb: pick(r, GARBS),
    skin: pick(r, SKINS),
    hair: pick(r, HAIRS),
    primary,
    secondary,
    accent,
    metal: pick(r, METALS),
    head: pick(r, [0, 1, 2] as const),
    hairStyle: pick(r, [0, 1, 2, 3] as const),
    build: Math.round((0.94 + r() * 0.12) * 100) / 100,
    emblem: Math.floor(r() * 1e9),
  };
}

export const newSeed = () => Math.random().toString(36).slice(2, 10);

const FIRST = ["Ser", "Ael", "Bran", "Cass", "Dov", "Esk", "Fen", "Ilse", "Joss", "Kael", "Lune", "Mira", "Nox", "Oren", "Pell", "Quill", "Rhea", "Sabe", "Tam", "Vey", "Wren", "Yara"];
const LAST = ["ashen", "thorn", "wick", "mere", "vale", "lark", "holt", "brand", "weft", "moor", "crane", "reed"];
export function randomName(seed = newSeed()) {
  const r = rng(`name:${seed}`);
  const a = pick(r, FIRST);
  const b = pick(r, LAST);
  return `${a} ${b[0]!.toUpperCase()}${b.slice(1)}`;
}
