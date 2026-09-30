// Deterministic helpers shared by client and server.

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const round = (v: number, dp = 0) => {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
};
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
export const std = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1));
};

/** Linear-interpolated percentile, p in [0,1]. */
export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = clamp(p, 0, 1) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

/** Fraction of values strictly below v (0..1). */
export function percentileRank(values: number[], v: number): number {
  if (!values.length) return 0.5;
  let below = 0;
  let equal = 0;
  for (const x of values) {
    if (x < v) below++;
    else if (x === v) equal++;
  }
  return (below + equal / 2) / values.length;
}

/** 32-bit FNV-1a hash of a string. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 PRNG — small, fast, deterministic. */
export function rng(seed: number | string) {
  let a = typeof seed === "string" ? hash32(seed) : seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo: number, hi: number) => lo + (hi - lo) * next(),
    int: (lo: number, hiInclusive: number) => lo + Math.floor(next() * (hiInclusive - lo + 1)),
    pick: <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]!,
    chance: (p: number) => next() < p,
    weighted: <T>(items: readonly T[], weights: readonly number[]): T => {
      const total = sum(weights as number[]);
      let r = next() * total;
      for (let i = 0; i < items.length; i++) {
        r -= weights[i]!;
        if (r <= 0) return items[i]!;
      }
      return items[items.length - 1]!;
    },
  };
}
export type Rng = ReturnType<typeof rng>;

/** Deterministic noise in [-1, 1] for a key. */
export const noise = (key: string) => rng(key).next() * 2 - 1;

/** Stable JSON: sorted keys, numbers rounded to 4 dp, undefined dropped. */
export function canonicalize(value: unknown): string {
  const norm = (v: unknown): unknown => {
    if (v === null || v === undefined) return null;
    if (typeof v === "number") return Number.isFinite(v) ? round(v, 4) : null;
    if (Array.isArray(v)) return v.map(norm);
    if (typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as object).sort()) {
        const x = (v as Record<string, unknown>)[k];
        if (x !== undefined) out[k] = norm(x);
      }
      return out;
    }
    return v;
  };
  return JSON.stringify(norm(value));
}
