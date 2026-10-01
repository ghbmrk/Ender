import { useId } from "react";
import { INK, P } from "./palette";
import type { HeroLook } from "./look";

/**
 * Shared drawing for the three hero figures (Warden, Ranger, Binder) when they wear a player's HeroLook:
 * colour ramps derived from the look's base colours, a three-quarter head with four hair styles, and a
 * procedural heraldic emblem. Everything here is a pure function of its props, so memoised figures stay cheap.
 */

/** Five tones, darkest to lightest, like the ramps in palette.ts. */
export type Ramp = readonly [string, string, string, string, string];

const parse = (c: string): [number, number, number] => {
  const h = c.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const hex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

/** Blend a toward b by t (0 = a, 1 = b). */
export function mix(a: string, b: string, t: number) {
  const x = parse(a), y = parse(b);
  return hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}
/** Darken by multiplying, which keeps the hue's saturation (a wash of the same pigment, deeper). */
export function deepen(c: string, k: number) {
  const [r, g, b] = parse(c);
  return hex(r * k, g * k, b * k);
}
/** Relative luminance, 0..1. */
export function lum(c: string) {
  const [r, g, b] = parse(c).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const WARM_WHITE = "#fff1dc";
const WARM_LIGHT = "#fff8ea";

/** A cloth or hair ramp around a base colour (base at index 2): deep shadow, shade, base, light, highlight. */
export function ramp(base: string): Ramp {
  const dark = lum(base) < 0.06;
  return [
    mix(deepen(base, 0.36), INK, 0.22),
    deepen(base, 0.64),
    base,
    // dark cloth needs a stronger lift for its lights to read under the figure filter
    mix(base, WARM_WHITE, dark ? 0.26 : 0.3),
    mix(base, WARM_LIGHT, dark ? 0.52 : 0.62),
  ];
}

/** Skin: the base tone sits at index 3 (as P.skin does for the drawn faces), with warm shadows. */
export function skinRamp(s: string): Ramp {
  const warm = "#7a2e22";
  return [mix(deepen(s, 0.42), warm, 0.18), mix(deepen(s, 0.66), warm, 0.12), mix(deepen(s, 0.84), warm, 0.06), s, mix(s, "#ffeedd", lum(s) < 0.12 ? 0.26 : 0.4)];
}

/** A glow ramp for magic and accents: the accent at index 3, a near-white core at 4. */
export function glowRamp(a: string): Ramp {
  return [deepen(a, 0.3), deepen(a, 0.55), deepen(a, 0.8), a, mix(a, "#ffffff", 0.72)];
}

export const METALS: Record<HeroLook["metal"], Ramp> = {
  steel: P.steel,
  bronze: ["#2c1a0e", "#55361c", "#83582f", "#b48656", "#e0c39a"],
  blackened: ["#0d0d12", "#1b1b22", "#2f2f39", "#555564", "#9696a8"],
};

export type HeroColors = {
  skin: Ramp;
  hair: Ramp;
  primary: Ramp;
  secondary: Ramp;
  accent: Ramp;
  /** The accent as light: for glows, eyes and magic. */
  glow: Ramp;
  metal: Ramp;
};

/** The figure's colours: the look's, or (no look) the figure's own drawn defaults, so the default figure is unchanged. */
export function heroColors(look: HeroLook | undefined, defaults: HeroColors): HeroColors {
  if (!look) return defaults;
  return {
    skin: skinRamp(look.skin),
    hair: ramp(look.hair),
    primary: ramp(look.primary),
    secondary: ramp(look.secondary),
    accent: ramp(look.accent),
    glow: glowRamp(look.accent),
    metal: METALS[look.metal],
  };
}

/** Horizontal scale about x (for build), or undefined when it is 1 so the default markup is unchanged. */
export function widen(k: number | undefined, x: number) {
  return k && k !== 1 ? `translate(${x} 0) scale(${k} 1) translate(${-x} 0)` : undefined;
}

/** The tone of a ramp that stands out most on a field colour (for charges on a tabard or shield). */
export function onField(field: string, ...ramps: Ramp[]) {
  const lf = lum(field);
  let best = ramps[0]![2], score = -1;
  for (const r of ramps)
    for (const c of [r[2], r[3], r[4]]) {
      // contrast ratio, with a small bias toward the base tone so the charge keeps its hue
      const lc = lum(c);
      const s = (Math.max(lf, lc) + 0.05) / (Math.min(lf, lc) + 0.05) + (c === r[2] ? 0.6 : c === r[3] ? 0.3 : 0);
      if (s > score) (score = s), (best = c);
    }
  return best;
}

// ─────────────────────────────── the head ───────────────────────────────

/*
 * The head is drawn in one frame for all three heroes: a three-quarter profile facing right, eye at
 * (124, 68), nose tip (133, 74.5), chin (121, 90), crown (114, 51), back of the skull at x≈101.
 * Figures place it with a transform. It comes in two layers so the neck can sit behind collars:
 * "back" (neck) and "front" (back hair, skull, face, hair cap).
 */
export const SKULL =
  "M114 51 C120.4 50.6 126 54 127.9 60 C128.5 62.2 128.8 64.6 129 67 C130 69 132 72 133 74.5 C132.5 76 131 76.5 129.5 77 C129.5 78.5 129 79.5 128.5 80.5 C128.5 82 128 83.5 126.5 85 C126 87.5 124 89.5 121 90 C117 90.2 113.6 88.6 111.4 86 C109.4 84.2 107.2 82.6 105.4 80.4 C102 76.4 100.8 70.6 101.4 65 C102.2 57 107 51.6 114 51 Z";

/** The short cap of hair, with a sideburn in front of the ear (also the stubble of a shaved head). */
const CAP =
  "M128.6 61.4 C129.2 56 125.4 50.4 119 48.6 C113.2 47 106.6 48.2 102.6 52.4 C99.4 55.8 98.2 60.4 98.8 64.8 C97.8 67.4 98 70.4 99.4 72.6 C99.4 75.6 100.8 78.4 102.8 79.8 C103.8 81.8 105.8 82.8 108 82.2 L108.6 79.4 C108.2 76 108.8 72.6 110.2 70.2 C111.6 69.6 112.8 70.2 113.2 71 L114 76 L115.6 75.8 C115.4 71 116.4 66.8 118.8 64 C121.6 61.8 125.2 60.8 128.6 61.4 Z";

export function HeroHead({ c, hairStyle, layer, transform, rim }: { c: HeroColors; hairStyle: HeroLook["hairStyle"]; layer: "back" | "front"; transform?: string; rim?: string }) {
  const u = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (s: string) => `${u}-${s}`;
  const S = c.skin, H = c.hair;
  if (layer === "back")
    return (
      <g transform={transform}>
        <path d="M107.6 79 C108.6 86 108.2 94 106.6 104 L123 104 C121.6 98 121 93 121.4 87.6 Z" fill={S[2]} strokeWidth="1.8" />
        <path d="M108.6 84 C112 88 116.6 90.4 121.2 90.2 L121.2 94 C116.4 93.6 111.8 91 108.6 88 Z" fill={S[0]} stroke="none" opacity="0.55" />
      </g>
    );
  const lip = mix(S[1], "#9a2a39", 0.45);
  return (
    <g transform={transform}>
      <defs>
        <radialGradient id={id("skin")} cx="0.72" cy="0.34" r="0.86">
          <stop offset="0" stopColor={S[4]} />
          <stop offset="0.42" stopColor={S[3]} />
          <stop offset="1" stopColor={S[1]} />
        </radialGradient>
        <linearGradient id={id("hair")} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={H[3]} />
          <stop offset="0.45" stopColor={H[2]} />
          <stop offset="1" stopColor={H[0]} />
        </linearGradient>
      </defs>

      {/* long hair falls behind the neck to the shoulders */}
      {hairStyle === 1 && (
        <g>
          <path d="M112 49.6 C102 49.6 96.6 57 96.4 67 C96 80 97.2 95 94.4 110 C97.8 107.4 100.6 108.6 102.4 112.4 C103.4 106.6 105.4 103.4 107.6 100.6 C109.4 96 109.6 90 109 84.4 L110.4 70 Z" fill={`url(#${id("hair")})`} strokeWidth="1.7" />
          <path d="M100 66 C99 80 99.4 94 97.6 106 M104 72 C103.4 84 104 94 102.6 104" fill="none" stroke={H[0]} strokeWidth="1" opacity="0.8" />
          <path d="M101.6 60 C100.6 70 101 80 100.6 90" fill="none" stroke={H[4]} strokeWidth="0.9" opacity="0.6" />
        </g>
      )}

      {/* skull and face */}
      <path d={SKULL} fill={`url(#${id("skin")})`} strokeWidth="1.8" />
      {/* the shadow plane behind the cheekbone, down the jaw */}
      <path d="M113.6 74 C116.4 79 118.6 84.6 120.6 89.8 C116.6 89.8 113.6 88.4 111.4 86 C109.4 84.2 107.8 82.8 106.6 81.4 C109 79.4 111.4 77 113.6 74 Z" fill={S[1]} stroke="none" opacity="0.4" />
      <path d="M126 60.5 C128 62 129 65 129.5 68" fill="none" stroke={S[4]} strokeWidth="1" opacity="0.9" />
      <path d="M127.2 84.6 C126.4 86.8 124.8 88.4 122.4 89" fill="none" stroke={S[4]} strokeWidth="0.8" opacity="0.6" />
      {/* cheek warmth */}
      <ellipse cx="124.6" cy="76.8" rx="3.2" ry="2.1" fill={mix(S[3], "#d8505a", 0.5)} stroke="none" opacity="0.28" />
      {/* ear */}
      <path d="M111.8 70.4 C109.4 69.4 107.8 71.6 108.2 74.6 C108.6 77.6 110.2 79.6 112.6 79.2 C113.6 76.6 113.4 73 111.8 70.4 Z" fill={S[3]} strokeWidth="1.2" />
      <path d="M110.4 72.6 C111.6 73.8 111.8 76 111 77.6" fill="none" stroke={S[0]} strokeWidth="0.8" />
      {/* eye socket shade, the eye (white, iris, lid) and brow */}
      <path d="M119.6 66.6 C121.6 65 125.6 64.8 128.2 66.4 C127.4 68.4 125 69.2 122.6 69.2 C121 69 120 68 119.6 66.6 Z" fill={S[1]} stroke="none" opacity="0.32" />
      <path d="M121 68.5 C122.5 67 125.5 66.9 126.6 68.4 C125.6 69.7 123 70.1 121 68.5 Z" fill="#f4ecdc" strokeWidth="0.5" />
      <circle cx="124.5" cy="68.4" r="1.25" fill={mix(H[1], "#2a2030", 0.4)} stroke="none" />
      <circle cx="124.5" cy="68.4" r="0.55" fill={INK} stroke="none" />
      <circle cx="124.9" cy="68" r="0.32" fill="#ffffff" stroke="none" />
      <path d="M120.6 68.4 C122.2 66.7 125.6 66.5 127 68.2" fill="none" stroke={INK} strokeWidth="1" />
      <path d="M120 65.3 C122.5 63.6 125.6 63.7 127.8 65" fill="none" stroke={hairStyle === 3 ? mix(H[1], S[1], 0.3) : H[0]} strokeWidth="1.4" />
      {/* nose, nostril and mouth */}
      <path d="M129.5 77 C128 78 127 78 126 77.5" fill="none" stroke={S[0]} strokeWidth="0.9" />
      <path d="M128.3 81.2 C127.4 81.7 126.4 81.8 125.4 81.5" fill="none" stroke={lip} strokeWidth="1.1" />
      <path d="M127.6 83 C126.8 83.4 126 83.4 125.4 83.1" fill="none" stroke={S[1]} strokeWidth="0.7" opacity="0.7" />

      {/* hair */}
      {hairStyle === 3 ? (
        <g>
          {/* shaved: a shadow of stubble and a sheen on the crown */}
          <path d="M128 61 C127 55 121 51 114 51 C107 51.6 102.2 57 101.4 65 C100.8 70.6 102 76.4 105.4 80.4 L108.4 80 C108 76.6 108.6 72.6 110.2 70.2 C111.6 69.6 112.8 70.2 113.2 71 L114 76 L115.6 75.8 C115.4 71 116.4 66.8 118.8 64 C121.6 61.8 125 60.6 128 61 Z" fill={H[1]} stroke="none" opacity="0.32" />
          <path d="M108 54 C112 51.6 118 51.6 122 53.6" fill="none" stroke={S[4]} strokeWidth="1.2" opacity="0.7" />
        </g>
      ) : (
        <g>
          <path d={CAP} fill={`url(#${id("hair")})`} strokeWidth="1.6" />
          {/* locks swept back from the brow: partings in shadow, a lit crown, a short fringe */}
          <path d="M124 56 C118 54.6 111 56.4 106 61.4 M120.4 59.6 C114 59.8 108.4 63.6 104.8 69.4 M116.4 63.2 C111.6 65.8 107.8 70.8 106 77" fill="none" stroke={H[0]} strokeWidth="0.9" opacity="0.85" />
          <path d="M108 52.6 C113 49.8 119.6 50 124.4 53" fill="none" stroke={H[4]} strokeWidth="1.1" opacity="0.8" />
          <path d="M103.4 58.6 C106 55 110 53.2 114 53 M101.2 66 C102.6 62.4 105 60 108 58.6" fill="none" stroke={H[3]} strokeWidth="0.9" opacity="0.8" />
          <path d="M128.6 61.4 C127.6 63.4 126 63.8 124.8 63 C124.2 64.6 122.6 65.2 121.2 64.6 C120.8 66.2 119.2 67.2 117.6 67 C118.2 63.4 121.8 60.6 128.6 61.4 Z" fill={H[2]} strokeWidth="1" />
        </g>
      )}

      {/* braid from the nape over the back */}
      {hairStyle === 2 && (
        <g>
          {/* the plait: interleaved lobes, left and right, tapering toward the tie */}
          <path d="M101.6 78 C103.6 88 101.4 100 97.6 111.6 L100.4 112.4 C104.4 101 107.4 89 107 79 Z" fill={H[0]} strokeWidth="1.3" />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
            const t = i / 8;
            const x = 104.6 - t * 6.2, y = 80.4 + t * 29.6, k = 1.22 - t * 0.4;
            return (
              <g key={i} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${(i % 2 ? -k : k).toFixed(2)} ${k.toFixed(2)}) rotate(-22)`}>
                <path d="M-3.6 -2.6 C-1.8 -4.2 2.4 -2.8 3.4 1.8 C1.2 2.6 -2.6 1.2 -3.6 -2.6 Z" fill={i % 2 ? H[1] : H[2]} strokeWidth="0.9" />
                <path d="M-2.2 -2.4 C-0.4 -2.8 1.4 -1.4 2 0.4" fill="none" stroke={H[4]} strokeWidth="0.6" opacity="0.6" />
              </g>
            );
          })}
          <path d="M96.6 110.4 L98.8 113 M95.4 111.6 C95 115 96 118.6 97.6 120.4 C98.4 117.6 99.4 115.6 101 114.2 Z" fill={H[2]} strokeWidth="1.1" />
          <path d="M95.2 109.6 L100.4 112.6" stroke={c.secondary[2]} strokeWidth="2.6" />
        </g>
      )}

      {/* light from a source on the right (the Binder's knot), along the face's front edge */}
      {rim && <path d="M128 60 C129 63 129.4 66 130 68.4 C131.4 70.6 132.6 72.6 133 74.5 M128.8 81 C128.4 83.4 127.4 85 126.4 86.4" fill="none" stroke={rim} strokeWidth="1.1" opacity="0.65" />}
    </g>
  );
}

// ─────────────────────────────── the emblem ───────────────────────────────

type Charge = "chevron" | "tower" | "star" | "crescent" | "key" | "knot";
const CHARGES: Charge[] = ["chevron", "tower", "star", "crescent", "key", "knot"];

/** Mulberry32 over a numeric seed. */
function rand(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type EmblemSpec = {
  charge: Charge;
  /** single: one large charge; trio: three small (two over one); chevroned: a small charge over a chevron; ringed: in an annulet. */
  layout: "single" | "trio" | "chevroned" | "ringed";
  points: 5 | 6 | 8;
  /** Field division, for the shield. */
  field: "plain" | "pale" | "bend" | "chief";
  /** Which of the look's colours carries the charge. */
  tincture: "secondary" | "accent";
};

export function emblemSpec(seed: number): EmblemSpec {
  const r = rand(seed);
  const charge = CHARGES[Math.floor(r() * CHARGES.length)]!;
  const lr = r();
  let layout: EmblemSpec["layout"] = lr < 0.4 ? "single" : lr < 0.62 ? "trio" : lr < 0.82 ? "chevroned" : "ringed";
  if (charge === "chevron" && layout === "chevroned") layout = "single";
  if (charge === "key" && layout === "trio") layout = "ringed";
  const points = ([5, 6, 8] as const)[Math.floor(r() * 3)]!;
  const fr = r();
  const field = fr < 0.4 ? "plain" : fr < 0.6 ? "pale" : fr < 0.8 ? "bend" : "chief";
  const tincture = r() < 0.5 ? "secondary" : "accent";
  return { charge, layout, points, field, tincture };
}

function starPath(n: number, ro = 10, ri = 4.4) {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI * i) / n - Math.PI / 2;
    const r = i % 2 ? (n === 8 ? ri * 1.25 : ri) : ro;
    pts.push(`${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`);
  }
  return `M${pts.join(" L")} Z`;
}

/** A charge in a 20×20 box centred on the origin. */
function ChargeShape({ charge, points, fill, dark }: { charge: Charge; points: number; fill: string; dark: string }) {
  const sw = { strokeWidth: 1.1, vectorEffect: "non-scaling-stroke" as const };
  switch (charge) {
    case "chevron":
      return <path d="M-10.5 4 L0 -6.5 L10.5 4 L10.5 9.5 L0 -1 L-10.5 9.5 Z" fill={fill} {...sw} />;
    case "tower":
      return (
        <g>
          <path d="M-7.5 -10 L-7.5 -5.5 L-5.4 -3.6 L-5.8 9.6 L5.8 9.6 L5.4 -3.6 L7.5 -5.5 L7.5 -10 L4.4 -10 L4.4 -7.6 L1.6 -7.6 L1.6 -10 L-1.6 -10 L-1.6 -7.6 L-4.4 -7.6 L-4.4 -10 Z" fill={fill} {...sw} />
          <path d="M-2.2 9.6 L-2.2 5 C-2.2 2.4 2.2 2.4 2.2 5 L2.2 9.6 Z" fill={dark} {...sw} />
          <path d="M-0.6 -2.6 L-0.6 0.6 M0.6 -2.6 L0.6 0.6" stroke={dark} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        </g>
      );
    case "star":
      return <path d={starPath(points)} fill={fill} {...sw} />;
    case "crescent":
      return <path d="M-7.44 -7.07 A9 9 0 1 0 7.44 -7.07 A7.6 7.6 0 1 1 -7.44 -7.07 Z" fill={fill} {...sw} />;
    case "key":
      return (
        <path
          fillRule="evenodd"
          d="M0 -10.5 A5 5 0 1 1 0 -0.5 A5 5 0 1 1 0 -10.5 Z M0 -7.6 A2.1 2.1 0 1 0 0 -3.4 A2.1 2.1 0 1 0 0 -7.6 Z M-1.6 -0.9 L1.6 -0.9 L1.6 3.6 L5.6 3.6 L5.6 6.2 L1.6 6.2 L1.6 7.2 L4.4 7.2 L4.4 10 L-1.6 10 Z"
          fill={fill}
          {...sw}
        />
      );
    case "knot":
      // three interlaced rings: the Bond's knot
      return (
        <g fill="none">
          {[0, 1, 2].map((i) => {
            const a = (i * 2 * Math.PI) / 3 - Math.PI / 2;
            return <circle key={i} cx={(Math.cos(a) * 3.8).toFixed(2)} cy={(Math.sin(a) * 3.8 + 0.6).toFixed(2)} r="5" stroke={INK} strokeWidth="4.2" />;
          })}
          {[0, 1, 2].map((i) => {
            const a = (i * 2 * Math.PI) / 3 - Math.PI / 2;
            return <circle key={i} cx={(Math.cos(a) * 3.8).toFixed(2)} cy={(Math.sin(a) * 3.8 + 0.6).toFixed(2)} r="5" stroke={fill} strokeWidth="2.2" />;
          })}
        </g>
      );
  }
}

/**
 * A procedural heraldic emblem from the look's emblem seed, centred at (x, y), `size` units across.
 * `fill` is the charge colour (see onField), `dark` a deep tone for doors and piercings.
 */
export function Emblem({ seed, x, y, size, fill, dark }: { seed: number; x: number; y: number; size: number; fill: string; dark: string }) {
  const s = emblemSpec(seed);
  const k = size / 20;
  const one = (cx: number, cy: number, sc: number, key?: number) => (
    <g key={key} transform={`translate(${cx} ${cy}) scale(${sc})`}>
      <ChargeShape charge={s.charge} points={s.points} fill={fill} dark={dark} />
    </g>
  );
  return (
    <g transform={`translate(${x} ${y}) scale(${k.toFixed(3)})`} stroke={INK} strokeLinejoin="round">
      {s.layout === "single" && one(0, 0, 0.9)}
      {s.layout === "trio" && [one(-5, -4.6, 0.42, 0), one(5, -4.6, 0.42, 1), one(0, 5, 0.42, 2)]}
      {s.layout === "chevroned" && (
        <g>
          <path d="M-10.5 9 L0 0.5 L10.5 9 L10.5 12.5 L0 4.5 L-10.5 12.5 Z" fill={fill} strokeWidth="1.1" vectorEffect="non-scaling-stroke" />
          {one(0, -5.6, 0.5)}
        </g>
      )}
      {s.layout === "ringed" && (
        <g>
          <circle r="10" fill="none" stroke={INK} strokeWidth="3.6" vectorEffect="non-scaling-stroke" />
          <circle r="10" fill="none" stroke={fill} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
          {one(0, 0, 0.62)}
        </g>
      )}
    </g>
  );
}

/** The emblem's tincture from the look: its secondary or accent ramp, whichever the seed chose, lit for the field. */
export function emblemFill(look: HeroLook, c: HeroColors, field: string) {
  const s = emblemSpec(look.emblem);
  return onField(field, s.tincture === "secondary" ? c.secondary : c.accent);
}

/**
 * A bare or open head sits lower than the tall helm or peaked hood the figure's meta.head crop was framed for.
 * When asked for exactly that crop (the Head portrait), frame the look's head instead.
 */
export function cropFor(viewBox: string | undefined, metaHead: readonly number[], bareCrop: readonly number[] | undefined) {
  return bareCrop && viewBox === metaHead.join(" ") ? bareCrop.join(" ") : viewBox;
}
