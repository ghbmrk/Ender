import { useId, type ReactNode } from "react";
import { INK, P, GLOW } from "../palette";
import { rng, scatter, busy } from "./paint";
import { Atmosphere } from "./Atmosphere";

/*
 * Authored in a 540x960 space, scaled x2 into the 1080x1920 viewBox. Parallax layers are
 * <g data-layer=n> (0 farthest) and overdraw 20 units past the left and right edges.
 */

type Spire = { x: number; y: number; h: number; w: number; lean: number; lit?: boolean };

function spirePaths(s: Spire) {
  const { x, y, h, w, lean } = s;
  const f = (a: number, b: number) => `${a.toFixed(1)} ${b.toFixed(1)}`;
  const tip = f(x + lean, y - h);
  const l = f(x - w / 2, y);
  const r = f(x + w / 2, y);
  const sl = f(x - w * 0.42 + lean * 0.25, y - h * 0.72);
  const sr = f(x + w * 0.46 + lean * 0.3, y - h * 0.62);
  const rb = f(x + w * 0.08, y);
  return {
    outline: `M${l} L${sl} L${tip} L${sr} L${r} Z`,
    left: `M${l} L${sl} L${tip} L${rb} Z`,
    right: `M${rb} L${tip} L${sr} L${r} Z`,
    ridge: `M${tip} L${rb}`,
    edge: `M${l} L${sl} L${tip}`,
    shine: `M${f(x - w * 0.3 + lean * 0.1, y - h * 0.08)} L${f(x - w * 0.28 + lean * 0.3, y - h * 0.62)} L${f(x - w * 0.18 + lean * 0.3, y - h * 0.6)} L${f(x - w * 0.16 + lean * 0.1, y - h * 0.1)} Z`,
    facets: `M${tip} L${f(x - w * 0.22, y)} M${f(x + w * 0.3 + lean * 0.3, y - h * 0.62)} L${f(x + w * 0.3, y)} M${f(x - w * 0.36 + lean * 0.1, y - h * 0.34)} L${f(x - w * 0.02 + lean * 0.12, y - h * 0.4)} L${f(x + w * 0.4 + lean * 0.12, y - h * 0.3)}`,
  };
}

const HZ = 292;
const FAR: Spire[] = [
  { x: 150, y: HZ, h: 50, w: 11, lean: 2 },
  { x: 163, y: HZ, h: 30, w: 9, lean: -2 },
  { x: 238, y: HZ, h: 70, w: 13, lean: 1 },
  { x: 254, y: HZ, h: 104, w: 17, lean: -3 },
  { x: 270, y: HZ, h: 60, w: 12, lean: 4 },
  { x: 282, y: HZ, h: 34, w: 9, lean: 2 },
  { x: 350, y: HZ, h: 40, w: 10, lean: -2 },
  { x: 362, y: HZ, h: 24, w: 8, lean: 1 },
];
const MID: Spire[] = [
  { x: 22, y: 318, h: 220, w: 36, lean: 8, lit: true },
  { x: 56, y: 314, h: 140, w: 28, lean: 10 },
  { x: 86, y: 310, h: 80, w: 20, lean: 6 },
  { x: -10, y: 320, h: 120, w: 24, lean: -3 },
  { x: 108, y: 306, h: 40, w: 13, lean: 3 },
  { x: 488, y: 314, h: 170, w: 30, lean: -8, lit: true },
  { x: 522, y: 318, h: 230, w: 36, lean: -5 },
  { x: 460, y: 308, h: 80, w: 19, lean: -6 },
  { x: 440, y: 304, h: 36, w: 12, lean: -2 },
];
const FORE: Spire[] = [
  { x: 506, y: 980, h: 330, w: 60, lean: -18, lit: true },
  { x: 462, y: 976, h: 210, w: 40, lean: -22 },
  { x: 552, y: 974, h: 250, w: 40, lean: 8 },
  { x: 420, y: 970, h: 130, w: 22, lean: -10 },
];

function reeds(seed: number, x: number, y: number, n: number, h: number, spread: number) {
  const r = rng(seed);
  return Array.from({ length: n }, () => {
    const bx = x + (r() - 0.5) * spread;
    const by = y + (r() - 0.5) * 4;
    const hh = h * (0.55 + r() * 0.5);
    const lean = (r() - 0.5) * h * 0.5;
    const tx = bx + lean;
    const ty = by - hh;
    return { d: `M${bx.toFixed(1)} ${by.toFixed(1)}Q${(bx + lean * 0.2).toFixed(1)} ${(by - hh * 0.6).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`, tx, ty, head: r() < 0.3, lean, w: 0.8 + r() * 1.2 };
  });
}

const REEDS = [
  ...reeds(3, 20, 486, 16, 80, 40),
  ...reeds(8, 196, 310, 12, 24, 50),
  ...reeds(9, 400, 306, 8, 20, 30),
  ...reeds(12, 520, 380, 10, 50, 40),
  ...reeds(15, 290, 520, 7, 34, 30),
];
const FORE_REEDS = [...reeds(21, 20, 900, 22, 260, 70), ...reeds(22, 170, 910, 12, 150, 80), ...reeds(23, 350, 930, 10, 120, 60)];
/** Grass tufts sampled along the upper arc of an elliptical bank. */
function tufts(seed: number, cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n: number) {
  const r = rng(seed);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * (i / n + r() * 0.8 / n);
    const x = cx + Math.cos(a) * rx * (0.96 + r() * 0.06);
    const y = cy + Math.sin(a) * ry * (0.96 + r() * 0.06);
    const h = 3 + r() * 7;
    out.push(`M${(x - 2).toFixed(1)} ${y.toFixed(1)}l${(-1 - r() * 2).toFixed(1)} ${(-h).toFixed(1)}M${x.toFixed(1)} ${y.toFixed(1)}l${(r() - 0.5).toFixed(1)} ${(-h * 1.2).toFixed(1)}M${(x + 2).toFixed(1)} ${y.toFixed(1)}l${(1 + r() * 2).toFixed(1)} ${(-h * 0.8).toFixed(1)}`);
  }
  return out.join("");
}
const TUFTS_FOE = tufts(5, 405, 422, 160, 62, Math.PI * 1.02, Math.PI * 2.0, 34);
const TUFTS_PARTY = tufts(6, 150, 566, 190, 82, Math.PI * 1.05, Math.PI * 2.02, 40);
const PADS = [
  { x: 226, y: 334, r: 9, bud: "gold" },
  { x: 244, y: 342, r: 6 },
  { x: 110, y: 452, r: 11, bud: "violet" },
  { x: 132, y: 446, r: 7 },
  { x: 390, y: 548, r: 12, bud: "gold" },
  { x: 414, y: 560, r: 8 },
  { x: 470, y: 612, r: 10, bud: "violet" },
  { x: 350, y: 700, r: 14 },
  { x: 60, y: 404, r: 8 },
] as const;
const MOSS_F = scatter(22, 61, 250, 360, 316, 120);
const MOSS_P = scatter(30, 62, -20, 480, 360, 300);
const STARS = scatter(40, 91, 0, 20, 540, 200);
const MOTES = scatter(70, 17, -20, 100, 580, 620);
const RIPPLES = scatter(160, 44, -20, 296, 580, 660);

function Layer({ n, children }: { n: number; children: ReactNode }) {
  return (
    <g data-layer={n}>
      <g transform="scale(2)">{children}</g>
    </g>
  );
}

/** The Glass Fen: a drowned marsh under a pale moon, still water mirroring glassy crystal spires and reeds. */
export default function GlassFen({ className }: { className?: string }) {
  const u = useId().replace(/:/g, "");
  const id = (s: string) => `${u}-${s}`;
  const url = (s: string) => `url(#${id(s)})`;
  const spire = (s: Spire, i: number, faceL: string, faceR: string, ink: number) => {
    const p = spirePaths(s);
    return (
      <g key={i}>
        <path d={p.left} fill={faceL} />
        <path d={p.right} fill={faceR} />
        <path d={p.shine} fill="#eafff8" opacity={s.lit ? 0.4 : 0.22} />
        <path d={p.facets} stroke={P.verdigris[0]} strokeWidth={Math.max(0.5, ink * 0.35)} opacity="0.5" fill="none" />
        <path d={p.ridge} stroke={GLOW.hex} strokeWidth={ink * 0.45} opacity="0.55" />
        <path d={p.edge} stroke={P.verdigris[4]} strokeWidth={ink * 0.5} opacity={s.lit ? 0.9 : 0.5} fill="none" />
        {ink > 0 && <path d={p.outline} fill="none" stroke={INK} strokeWidth={ink} strokeLinejoin="round" />}
      </g>
    );
  };
  const reedGroup = (list: ReturnType<typeof reeds>, dark: string, light: string | null, headScale: number) =>
    list.map((r, i) => (
      <g key={i}>
        <path d={r.d} stroke={dark} strokeWidth={r.w * (light ? 1 : 1.8) + 0.6} />
        {light && <path d={r.d} stroke={light} strokeWidth={r.w * 0.4} opacity="0.6" />}
        {r.head && (
          <ellipse
            cx={r.tx}
            cy={r.ty + 3 * headScale}
            rx={1.4 * headScale}
            ry={4 * headScale}
            fill={light ? "#3b2a1a" : "#140e08"}
            stroke={INK}
            strokeWidth="0.6"
            transform={`rotate(${(r.lean * 0.5).toFixed(1)} ${r.tx.toFixed(1)} ${r.ty.toFixed(1)})`}
          />
        )}
      </g>
    ));
  return (
    <svg viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2={HZ} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#040a10" />
          <stop offset="0.35" stopColor="#0a1c26" />
          <stop offset="0.75" stopColor="#15434a" />
          <stop offset="1" stopColor="#4a958b" />
        </linearGradient>
        <linearGradient id={id("water")} x1="0" y1={HZ} x2="0" y2="960" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3a7f79" />
          <stop offset="0.04" stopColor="#1a4f52" />
          <stop offset="0.35" stopColor="#0d3036" />
          <stop offset="1" stopColor="#030d11" />
        </linearGradient>
        <radialGradient id={id("moon")} cx="0.42" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#f6fbf2" />
          <stop offset="0.7" stopColor="#d6ece2" />
          <stop offset="1" stopColor="#a9d6cc" />
        </radialGradient>
        <radialGradient id={id("halo")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={P.verdigris[4]} stopOpacity="0.55" />
          <stop offset="0.4" stopColor={P.verdigris[3]} stopOpacity="0.18" />
          <stop offset="1" stopColor={P.verdigris[2]} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("hexglow")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={GLOW.hex} stopOpacity="0.45" />
          <stop offset="1" stopColor={GLOW.hex} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("faceL")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.verdigris[4]} />
          <stop offset="0.4" stopColor={P.verdigris[3]} />
          <stop offset="1" stopColor={P.verdigris[1]} />
        </linearGradient>
        <linearGradient id={id("faceR")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.verdigris[2]} />
          <stop offset="0.5" stopColor={P.verdigris[1]} />
          <stop offset="1" stopColor={P.verdigris[0]} />
        </linearGradient>
        <linearGradient id={id("farFace")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7cc4b6" />
          <stop offset="1" stopColor="#2a6664" />
        </linearGradient>
        <linearGradient id={id("bank")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#557a5a" />
          <stop offset="0.25" stopColor="#35503f" />
          <stop offset="0.7" stopColor="#1e3128" />
          <stop offset="1" stopColor="#101a15" />
        </linearGradient>
        <linearGradient id={id("streak")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e6f6ee" stopOpacity="0.8" />
          <stop offset="1" stopColor="#e6f6ee" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={id("vig")} cx="0.5" cy="0.4" r="0.75">
          <stop offset="0.55" stopColor="#020a0c" stopOpacity="0" />
          <stop offset="1" stopColor="#020a0c" stopOpacity="0.8" />
        </radialGradient>
        <linearGradient id={id("bands")} x1="0" y1="0" x2="0" y2="1920" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#02070a" stopOpacity="0.72" />
          <stop offset="0.06" stopColor="#02070a" stopOpacity="0.3" />
          <stop offset="0.11" stopColor="#02070a" stopOpacity="0" />
          <stop offset="0.64" stopColor="#02070a" stopOpacity="0" />
          <stop offset="0.78" stopColor="#02070a" stopOpacity="0.45" />
          <stop offset="1" stopColor="#02070a" stopOpacity="0.8" />
        </linearGradient>
        <clipPath id={id("bankF")}>
          <path d="M244 432 Q252 392 318 372 Q400 350 480 358 Q560 366 566 390 L566 468 Q510 480 420 480 Q310 478 264 462 Q240 452 244 432 Z" />
        </clipPath>
        <clipPath id={id("bankP")}>
          <path d="M-24 520 Q20 490 110 482 Q220 474 300 498 Q346 512 340 548 Q334 600 300 660 Q250 740 160 780 L-24 800 Z" />
        </clipPath>
      </defs>

      {/* ---------- layer 0: night sky, moon, horizon spires ---------- */}
      <Layer n={0}>
        <rect x="-20" y="0" width="580" height={HZ + 4} fill={url("sky")} />
        <g fill="#dff3ea">
          {STARS.map((st, i) => (
            <circle key={i} cx={st.x.toFixed(1)} cy={st.y.toFixed(1)} r={(0.3 + st.s * 0.9).toFixed(2)} opacity={(0.25 + st.t * 0.6).toFixed(2)} />
          ))}
        </g>
        <circle cx="400" cy="178" r="120" fill={url("halo")} />
        <circle cx="400" cy="178" r="27" fill={url("moon")} />
        <g fill="#a9cfc4" opacity="0.45">
          <ellipse cx="392" cy="170" rx="7" ry="5" />
          <ellipse cx="410" cy="188" rx="5" ry="3.5" />
          <circle cx="404" cy="164" r="2.5" />
        </g>
        <g filter="url(#wc-wash)">
          <path d="M-20 130 Q80 110 200 134 Q300 150 420 126 Q500 114 560 128 L560 150 Q440 160 300 150 Q140 140 -20 158 Z" fill="#0a2229" opacity="0.65" />
          <path d="M250 206 Q340 192 440 206 Q500 212 560 206 L560 220 Q430 226 250 218 Z" fill={P.verdigris[3]} opacity="0.2" />
          <path d="M-20 236 Q60 226 150 236 L150 246 Q60 244 -20 252 Z" fill={P.verdigris[3]} opacity="0.14" />
        </g>
        <g fill="#1d4c4d" opacity="0.85" filter="url(#wc)">
          <path d="M-20 290 Q40 278 120 284 Q190 272 260 282 Q340 274 420 284 Q490 276 560 286 L560 296 L-20 296 Z" />
          <path d="M318 286 L320 250 L312 238 M320 250 L330 236 M320 262 L310 256" stroke="#1d4c4d" strokeWidth="2.2" fill="none" />
          <path d="M196 284 L197 262 L191 252 M197 264 L205 254" stroke="#1d4c4d" strokeWidth="1.8" fill="none" />
        </g>
        <g filter="url(#wc)">{FAR.map((s, i) => spire(s, i, url("farFace"), "#1f5456", 1))}</g>
        <circle cx="254" cy="232" r="60" fill={url("hexglow")} />
      </Layer>

      {/* ---------- layer 1: still water and its reflections ---------- */}
      <Layer n={1}>
        <rect x="-20" y={HZ} width="580" height={960 - HZ} fill={url("water")} />
        <g filter="url(#wc-wash)" opacity="0.4">
          <g transform={`translate(0 ${HZ * 2}) scale(1 -1)`}>{FAR.map((s, i) => spire(s, i, url("farFace"), "#1f5456", 0))}</g>
        </g>
        <g filter="url(#wc-wash)" opacity="0.3">
          <g transform={`translate(0 ${2 * 318}) scale(1 -1)`}>{MID.map((s, i) => spire(s, i, url("faceL"), url("faceR"), 0))}</g>
        </g>
        <path d="M388 296 L412 296 L408 350 L392 350 Z" fill={url("streak")} opacity="0.5" filter="url(#wc-wash)" />
        <g stroke="#dff3ea" strokeLinecap="round" opacity="0.7" strokeWidth="1.1">
          <path d="M384 300 H416 M388 308 H412 M382 316 H406 M392 325 H410 M386 334 H402 M396 343 H406" />
        </g>
        <g stroke={P.verdigris[4]} strokeLinecap="round" fill="none">
          {RIPPLES.map((r, i) => {
            const b = busy(r.x, r.y);
            if (b < 0.35) return null;
            const len = 4 + (r.y - HZ) * 0.05 + r.s * 12;
            return <path key={i} d={`M${(r.x - len / 2).toFixed(1)} ${r.y.toFixed(1)} h${len.toFixed(1)}`} strokeWidth={(0.5 + (r.y - HZ) * 0.002).toFixed(2)} opacity={(0.1 + r.t * 0.22).toFixed(2)} />;
          })}
        </g>
        <g filter="url(#wc-wash)" fill="#8fd0c2" opacity="0.2">
          <path d="M-20 298 Q120 290 270 299 Q400 306 560 296 L560 308 Q400 316 270 308 Q120 302 -20 312 Z" />
        </g>
        {PADS.map((p, i) => (
          <g key={i}>
            <ellipse cx={p.x} cy={p.y + 1.5} rx={p.r * 1.1} ry={p.r * 0.34} fill="#03100f" opacity="0.5" />
            <path
              d={`M${p.x} ${p.y} L${p.x + p.r} ${p.y - p.r * 0.08} A${p.r} ${p.r * 0.36} 0 1 1 ${p.x + p.r * 0.7} ${p.y + p.r * 0.26} Z`}
              fill="#23523f"
              stroke={INK}
              strokeWidth="0.9"
            />
            <path d={`M${p.x - p.r * 0.7} ${p.y - p.r * 0.12} q${p.r * 0.5} -${p.r * 0.18} ${p.r * 1.1} 0`} stroke="#5f9a76" strokeWidth="0.8" fill="none" opacity="0.7" />
            {"bud" in p && (
              <g>
                <circle cx={p.x - p.r * 0.2} cy={p.y - 4} r="9" fill={p.bud === "gold" ? GLOW.rune : GLOW.violet} opacity="0.35" filter="url(#glow-soft)" />
                <path d={`M${p.x - p.r * 0.2 - 3} ${p.y - 1} q0 -6 3 -8 q3 2 3 8 Z`} fill={p.bud === "gold" ? P.gold[4] : P.violet[4]} stroke={INK} strokeWidth="0.6" />
                <ellipse cx={p.x - p.r * 0.2} cy={p.y + 6} rx="2" ry="8" fill={p.bud === "gold" ? GLOW.rune : GLOW.violet} opacity="0.3" />
              </g>
            )}
          </g>
        ))}
      </Layer>

      {/* ---------- layer 2: spire clusters and the two banks ---------- */}
      <Layer n={2}>
        <circle cx="26" cy="190" r="70" fill={url("hexglow")} />
        <circle cx="488" cy="210" r="60" fill={url("hexglow")} />
        <g filter="url(#wc)">{MID.map((s, i) => spire(s, i, url("faceL"), url("faceR"), 1.8))}</g>
        <path d="M26 280 L30 150 M490 280 L484 190" stroke={GLOW.hex} strokeWidth="1.5" filter="url(#glow)" opacity="0.8" />
        <g filter="url(#wc)" strokeLinejoin="round">
          <path d="M-24 326 Q20 306 76 306 Q116 306 134 314 Q108 326 50 330 Q10 332 -24 336 Z" fill="#1d3329" stroke={INK} strokeWidth="1.4" />
          <path d="M564 324 Q520 304 470 304 Q440 305 428 312 Q456 324 506 328 Q540 330 564 334 Z" fill="#1d3329" stroke={INK} strokeWidth="1.4" />
        </g>
        {/* the foes' bank */}
        <g filter="url(#wc-wash)" opacity="0.45">
          <path d="M250 460 Q320 480 420 482 Q500 482 564 470 L564 500 Q420 512 280 492 Z" fill="#0f2a26" />
        </g>
        <g>
          <path d="M244 432 Q252 392 318 372 Q400 350 480 358 Q560 366 566 390 L566 468 Q510 480 420 480 Q310 478 264 462 Q240 452 244 432 Z" fill={url("bank")} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <path d="M254 424 Q274 390 330 376 Q400 358 478 362 Q540 368 562 380" stroke="#7fae8c" strokeWidth="1.3" fill="none" opacity="0.6" />
          <path d="M264 462 Q310 478 420 480 Q510 480 566 468" stroke={GLOW.hex} strokeWidth="1" fill="none" opacity="0.35" />
          <path d="M300 410 q12 -4 26 -1 M420 396 q14 -3 28 0 M350 448 q16 -2 32 1 M480 440 q12 -2 24 1" stroke="#5a8066" strokeWidth="1" fill="none" opacity="0.5" />
          <path d="M248 446 Q262 462 320 472 Q420 484 566 468" stroke="#1d160f" strokeWidth="4" fill="none" opacity="0.7" />
          <ellipse cx="470" cy="420" rx="26" ry="6" fill="#0d2a2c" stroke={INK} strokeWidth="0.8" opacity="0.8" />
          <path d="M452 419 h14 M474 422 h10" stroke={P.verdigris[4]} strokeWidth="0.7" opacity="0.5" />
        </g>
        <g clipPath={url("bankF")}>
          <g filter="url(#wc-wash)">
            {MOSS_F.map((m, i) => (
              <ellipse key={i} cx={m.x.toFixed(1)} cy={m.y.toFixed(1)} rx={(10 + m.s * 26).toFixed(1)} ry={(4 + m.s * 9).toFixed(1)} fill={m.t > 0.55 ? "#12201a" : m.t > 0.2 ? "#6f9464" : "#3f6a5a"} opacity={(m.t > 0.55 ? 0.35 : 0.25).toFixed(2)} />
            ))}
          </g>
          <path d="M244 440 Q300 420 400 404 Q480 396 566 404 L566 480 L244 480 Z" fill="#0b1510" opacity="0.35" filter="url(#wc-wash)" />
        </g>
        <path d={TUFTS_FOE} stroke="#6f9a74" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.8" />
        {/* the party's bank, running into the dark foreground */}
        <g>
          <path d="M-24 520 Q20 490 110 482 Q220 474 300 498 Q346 512 340 548 Q334 600 300 660 Q250 740 160 780 L-24 800 Z" fill={url("bank")} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M-10 510 Q40 490 120 485 Q220 478 294 500 Q330 512 336 532" stroke="#7fae8c" strokeWidth="1.4" fill="none" opacity="0.6" />
          <path d="M340 552 Q334 600 300 660" stroke={GLOW.hex} strokeWidth="1" fill="none" opacity="0.35" />
          <path d="M80 540 q14 -4 28 0 M200 520 q12 -3 24 0 M150 600 q16 -3 30 1 M50 620 q12 -2 24 1 M240 580 q12 -2 22 1" stroke="#5a8066" strokeWidth="1" fill="none" opacity="0.5" />
          <path d="M340 552 Q332 604 298 664 Q250 742 160 782" stroke="#1d160f" strokeWidth="4.5" fill="none" opacity="0.7" />
          <ellipse cx="90" cy="600" rx="34" ry="8" fill="#0d2a2c" stroke={INK} strokeWidth="0.8" opacity="0.8" />
          <path d="M70 598 h20 M96 602 h12" stroke={P.verdigris[4]} strokeWidth="0.7" opacity="0.5" />
        </g>
        <g clipPath={url("bankP")}>
          <g filter="url(#wc-wash)">
            {MOSS_P.map((m, i) => (
              <ellipse key={i} cx={m.x.toFixed(1)} cy={m.y.toFixed(1)} rx={(10 + m.s * 26).toFixed(1)} ry={(4 + m.s * 9).toFixed(1)} fill={m.t > 0.55 ? "#12201a" : m.t > 0.2 ? "#6f9464" : "#3f6a5a"} opacity={(m.t > 0.55 ? 0.35 : 0.25).toFixed(2)} />
            ))}
          </g>
          <path d="M-24 560 Q120 540 260 560 Q330 580 340 548 L340 800 L-24 800 Z" fill="#0b1510" opacity="0.35" filter="url(#wc-wash)" />
        </g>
        <path d={TUFTS_PARTY} stroke="#6f9a74" strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.8" />
        <g fill="none" strokeLinecap="round">{reedGroup(REEDS, "#16302a", "#4f7a5e", 1)}</g>
      </Layer>

      {/* ---------- layer 3: foreground crystals and reeds ---------- */}
      <Layer n={3}>
        <circle cx="500" cy="760" r="110" fill={url("hexglow")} />
        <g filter="url(#wc)">{FORE.map((s, i) => spire(s, i, url("faceL"), url("faceR"), 2.8))}</g>
        <path d="M494 900 L490 700" stroke={GLOW.hex} strokeWidth="1.8" filter="url(#glow)" opacity="0.8" />
        <g fill="none" strokeLinecap="round">{reedGroup(FORE_REEDS, "#06100c", null, 1.7)}</g>
      </Layer>

      {/* ---------- layer 4: mist and wisps ---------- */}
      <Layer n={4}>
        <g filter="url(#wc-wash)" fill="#a8e0d0">
          <path d="M-20 318 Q100 306 230 318 Q360 330 560 314 L560 338 Q360 348 220 338 Q80 328 -20 344 Z" opacity="0.15" />
          <path d="M-20 474 Q80 462 200 474 L200 486 Q80 482 -20 494 Z" opacity="0.1" />
          <path d="M330 488 Q440 480 560 492 L560 506 Q440 498 330 500 Z" opacity="0.12" />
        </g>
        <g filter="url(#glow)">
          {MOTES.map((m, i) => {
            const b = busy(m.x, m.y);
            if (b < 0.3 && m.t < 0.75) return null;
            return <circle key={i} cx={m.x.toFixed(1)} cy={m.y.toFixed(1)} r={(0.6 + m.s * 1.6).toFixed(2)} fill={m.t > 0.5 ? GLOW.hex : P.verdigris[4]} opacity={(0.4 + m.t * 0.6).toFixed(2)} />;
          })}
        </g>
      </Layer>

      <Atmosphere light={{ x: 800, y: 356, color: "#d6fff2" }} rays={{ n: 7, spread: 1.0, length: 1500, tilt: -0.5, seed: 3 }} haze={{ y: 600, color: "#7cc4b6", opacity: 0.22 }} poolColor="#bff5e6" />
      <rect width="1080" height="1920" fill={url("vig")} />
      <rect width="1080" height="1920" fill={url("bands")} />
      <g transform="scale(2)">
        <rect width="540" height="960" filter="url(#grain)" opacity="0.18" />
      </g>
    </svg>
  );
}
