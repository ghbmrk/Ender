import { memo, useId } from "react";
import type { Affinity } from "@ender/battle";
import { P } from "../art/palette";

/**
 * The art box of a Form card: a small painted vignette, deterministic per Form (§92: procedural, no
 * image generation). A dramatic light source, god-rays, a painted landscape that speaks for the
 * dominant Affinity, and the Form's own rune glowing over it. Gradients only, no filters, so a
 * list of cards stays cheap on phones.
 */

const SKY: Record<Affinity | "none", [string, string, string]> = {
  burden: [P.ember[4], P.ember[2], P.ember[0]],
  veil: [P.violet[4], P.violet[2], P.violet[0]],
  reach: [P.sapphire[4], P.sapphire[2], P.sapphire[0]],
  knots: [P.gold[4], P.gold[2], P.gold[0]],
  flex: [P.verdigris[4], P.verdigris[2], P.verdigris[0]],
  bond: [P.oxblood[4], P.oxblood[2], P.oxblood[0]],
  none: [P.steel[4], P.steel[2], P.slate[0]],
};

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507)), ((h >>> 0) % 10000) / 10000);
}

/** A ridge line across the box: `n` points between y0±amp, closed to the bottom. */
function ridge(rnd: () => number, y0: number, amp: number, n: number, sharp: boolean) {
  const p = Array.from({ length: n + 1 }, (_, i) => [-10 + (320 * i) / n, y0 + (rnd() - 0.5) * amp * 2] as const);
  const f = (v: number) => v.toFixed(1);
  if (sharp) return `M-10 170 ${p.map(([x, y]) => `L${f(x)} ${f(y)}`).join(" ")} L310 170 Z`;
  // Rolling: quadratic curves through the midpoints.
  let d = `M-10 170 L${f(p[0]![0])} ${f(p[0]![1])}`;
  for (let i = 1; i < p.length; i++) {
    const [x0, y0p] = p[i - 1]!;
    const [x1, y1] = p[i]!;
    d += ` Q${f(x0)} ${f(y0p)} ${f((x0 + x1) / 2)} ${f((y0p + y1) / 2)}`;
  }
  return `${d} L310 ${f(p[n]![1])} L310 170 Z`;
}

/** The Form's rune: a few curved strokes between seeded points. */
function rune(rnd: () => number) {
  const pts = Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * Math.PI * 2 + rnd() * 0.4;
    const r = 16 + rnd() * 20;
    return [Math.cos(a) * r, Math.sin(a) * r] as const;
  });
  const out: string[] = [];
  const n = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const a = pts[Math.floor(rnd() * 7)]!;
    const b = pts[Math.floor(rnd() * 7)]!;
    out.push(`M${a[0].toFixed(1)} ${a[1].toFixed(1)} Q${(rnd() * 16 - 8).toFixed(1)} ${(rnd() * 16 - 8).toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`);
  }
  return out.join(" ");
}

export const CardArt = memo(function CardArt({ seed, aff, aff2, className }: { seed: string; aff?: Affinity | null; aff2?: Affinity | null; className?: string }) {
  const u = useId().replace(/:/g, "");
  const k = aff ?? "none";
  const [hi, mid, deep] = SKY[k];
  const accent = SKY[aff2 ?? k][0];
  const rnd = hash(seed);
  const sunX = 60 + rnd() * 180;
  const sunY = 26 + rnd() * 30;
  const far = ridge(rnd, 108, 14, 9, k === "burden" || k === "knots");
  const near = ridge(rnd, 132, 12, 6, false);
  const rays = Array.from({ length: 5 }, (_, i) => {
    const a = -0.9 + i * 0.42 + rnd() * 0.2;
    const w = 0.05 + rnd() * 0.07;
    const L = 360;
    const p = (t: number) => `${(sunX + Math.sin(t) * L).toFixed(1)} ${(sunY + Math.cos(t) * L).toFixed(1)}`;
    return `M${sunX.toFixed(1)} ${sunY.toFixed(1)} L${p(a - w)} L${p(a + w)} Z`;
  });
  const motes = Array.from({ length: 14 }, () => ({ x: rnd() * 300, y: 20 + rnd() * 120, r: 0.6 + rnd() * 1.8, o: 0.3 + rnd() * 0.6 }));
  const glyph = rune(rnd);
  const g = (s: string) => `${u}-${s}`;
  return (
    <svg className={className} viewBox="0 0 300 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id={g("sky")} cx={sunX / 300} cy={sunY / 160} r="1.1">
          <stop offset="0" stopColor="#fff6dc" />
          <stop offset="0.12" stopColor={hi} />
          <stop offset="0.45" stopColor={mid} />
          <stop offset="1" stopColor={deep} />
        </radialGradient>
        <linearGradient id={g("ray")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff4d6" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff4d6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={g("far")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mid} stopOpacity="0.9" />
          <stop offset="1" stopColor={deep} />
        </linearGradient>
        <linearGradient id={g("near")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={deep} />
          <stop offset="1" stopColor="#07050a" />
        </linearGradient>
        <radialGradient id={g("halo")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={accent} stopOpacity="0.85" />
          <stop offset="0.5" stopColor={accent} stopOpacity="0.25" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={g("vig")} cx="0.5" cy="0.45" r="0.75">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.6" />
        </radialGradient>
      </defs>
      <rect width="300" height="160" fill={`url(#${g("sky")})`} />
      <g style={{ mixBlendMode: "screen" }}>
        {rays.map((d, i) => (
          <path key={i} d={d} fill={`url(#${g("ray")})`} opacity={0.5 + (i % 2) * 0.3} />
        ))}
      </g>
      <path d={far} fill={`url(#${g("far")})`} opacity="0.85" />
      <rect y="96" width="300" height="30" fill={hi} opacity="0.12" />
      <path d={near} fill={`url(#${g("near")})`} />
      {motes.map((m, i) => (
        <circle key={i} cx={m.x.toFixed(1)} cy={m.y.toFixed(1)} r={m.r.toFixed(2)} fill="#fff4d6" opacity={m.o.toFixed(2)} />
      ))}
      <g transform="translate(150 78)">
        <circle r="58" fill={`url(#${g("halo")})`} />
        <path d={glyph} stroke={accent} strokeWidth="12" strokeOpacity="0.35" fill="none" strokeLinecap="round" />
        <path d={glyph} stroke="#1d1822" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d={glyph} stroke="#fff4d6" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      </g>
      <rect width="300" height="160" fill={`url(#${g("vig")})`} />
    </svg>
  );
});

/** The dominant and second Affinity of a Form, from its (possibly partial) qualities. */
export function formAffinities(q: Record<string, { value: number } | number | undefined> | undefined): [Affinity | null, Affinity | null] {
  if (!q) return [null, null];
  const vals = Object.entries(q)
    .map(([k, v]) => [k, typeof v === "number" ? v : (v?.value ?? -1)] as const)
    .filter(([, v]) => v >= 0)
    .sort((a, b) => b[1] - a[1]);
  return [(vals[0]?.[0] as Affinity) ?? null, (vals[1]?.[0] as Affinity) ?? null];
}
