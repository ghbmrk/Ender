import { useId, type ReactNode } from "react";
import { INK, P, GLOW } from "../palette";
import { rng, scatter, busy } from "./paint";

/*
 * Authored in a 540x960 space, scaled x2 into the 1080x1920 viewBox. Parallax layers are
 * <g data-layer=n> (0 farthest) and overdraw 20 units past the left and right edges.
 */

type Shard = { x: number; y: number; h: number; w: number; lean: number; v?: boolean; lit?: boolean };

function shardPaths(s: Shard) {
  const { x, y, h, w, lean } = s;
  const f = (a: number, b: number) => `${a.toFixed(1)} ${b.toFixed(1)}`;
  const tip = f(x + lean, y - h);
  const l = f(x - w / 2, y);
  const r = f(x + w / 2, y);
  const sl = f(x - w * 0.44 + lean * 0.25, y - h * 0.7);
  const sr = f(x + w * 0.46 + lean * 0.3, y - h * 0.6);
  const rb = f(x + w * 0.08, y);
  return {
    outline: `M${l} L${sl} L${tip} L${sr} L${r} Z`,
    left: `M${l} L${sl} L${tip} L${rb} Z`,
    right: `M${rb} L${tip} L${sr} L${r} Z`,
    ridge: `M${tip} L${rb}`,
    shine: `M${f(x - w * 0.3 + lean * 0.1, y - h * 0.1)} L${f(x - w * 0.28 + lean * 0.3, y - h * 0.62)} L${f(x - w * 0.18 + lean * 0.3, y - h * 0.6)} L${f(x - w * 0.16 + lean * 0.1, y - h * 0.12)} Z`,
  };
}

const HZ = 300;
// crystal clusters growing up from the ground (v = violet)
const GROUND: Shard[] = [
  { x: 30, y: 330, h: 120, w: 26, lean: 6, lit: true },
  { x: 56, y: 334, h: 70, w: 20, lean: 10 },
  { x: 8, y: 336, h: 80, w: 18, lean: -4, v: true },
  { x: 500, y: 330, h: 150, w: 30, lean: -8, lit: true },
  { x: 530, y: 336, h: 100, w: 24, lean: -2, v: true },
  { x: 470, y: 326, h: 60, w: 16, lean: -8 },
  { x: 160, y: 304, h: 36, w: 10, lean: 2, v: true },
  { x: 172, y: 304, h: 22, w: 8, lean: 4 },
  { x: 372, y: 304, h: 30, w: 9, lean: -2 },
];
// stalactites hanging from the vault (drawn flipped)
const HANG: Shard[] = [
  { x: 60, y: -10, h: 170, w: 34, lean: 4, lit: true },
  { x: 100, y: -10, h: 110, w: 24, lean: -2, v: true },
  { x: 140, y: -10, h: 70, w: 18, lean: 2 },
  { x: 200, y: -10, h: 40, w: 12, lean: 0 },
  { x: 340, y: -10, h: 50, w: 13, lean: 0, v: true },
  { x: 400, y: -10, h: 90, w: 20, lean: -2 },
  { x: 450, y: -10, h: 140, w: 28, lean: 2, lit: true },
  { x: 500, y: -10, h: 190, w: 36, lean: -4, v: true },
];
const FORE: Shard[] = [
  { x: 40, y: 980, h: 250, w: 64, lean: 14, v: true, lit: true },
  { x: 90, y: 976, h: 140, w: 40, lean: 20 },
  { x: -6, y: 976, h: 170, w: 40, lean: -6 },
  { x: 520, y: 990, h: 180, w: 50, lean: -14, lit: true },
  { x: 560, y: 990, h: 120, w: 40, lean: -4, v: true },
];

function coins(seed: number, cx: number, cy: number, rx: number, ry: number, n: number) {
  const r = rng(seed);
  return Array.from({ length: n }, () => {
    const a = r() * Math.PI;
    const d = Math.sqrt(r());
    return { x: cx + Math.cos(a) * rx * d * (r() < 0.5 ? -1 : 1), y: cy - Math.sin(a) * ry * d, s: 1 + r() * 1.6 };
  });
}
const HOARD = coins(4, 150, 312, 44, 16, 40);
const SCALES = scatter(18, 71, 0, 360, 540, 300).filter((s) => busy(s.x, s.y) > 0.3 || s.t < 0.3);
const RIPPLES = scatter(140, 45, -20, 304, 580, 640);
const MOTES = scatter(60, 23, -20, 90, 580, 600);
const DRIPS = scatter(10, 9, 30, 120, 480, 60);

function Layer({ n, children }: { n: number; children: ReactNode }) {
  return (
    <g data-layer={n}>
      <g transform="scale(2)">{children}</g>
    </g>
  );
}

/** The Fen Lair: a flooded crystal cavern where the glass wyrm sleeps on its hoard; teal water, violet and gold light. */
export default function FenLair({ className }: { className?: string }) {
  const u = useId().replace(/:/g, "");
  const id = (s: string) => `${u}-${s}`;
  const url = (s: string) => `url(#${id(s)})`;
  const shard = (s: Shard, i: number, ink: number) => {
    const p = shardPaths(s);
    const v = !!s.v;
    return (
      <g key={i}>
        <path d={p.left} fill={url(v ? "vL" : "tL")} />
        <path d={p.right} fill={url(v ? "vR" : "tR")} />
        <path d={p.shine} fill="#f4fffb" opacity={s.lit ? 0.4 : 0.2} />
        <path d={p.ridge} stroke={v ? GLOW.violet : GLOW.hex} strokeWidth={Math.max(0.5, ink * 0.45)} opacity="0.6" />
        {ink > 0 && <path d={p.outline} fill="none" stroke={INK} strokeWidth={ink} strokeLinejoin="round" />}
      </g>
    );
  };
  return (
    <svg viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id("cave")} x1="0" y1="0" x2="0" y2={HZ} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#03090b" />
          <stop offset="0.5" stopColor="#0b2426" />
          <stop offset="1" stopColor="#1a4a48" />
        </linearGradient>
        <linearGradient id={id("water")} x1="0" y1={HZ} x2="0" y2="960" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3e9a8e" />
          <stop offset="0.05" stopColor="#1c5a58" />
          <stop offset="0.35" stopColor="#0d3036" />
          <stop offset="1" stopColor="#020b0e" />
        </linearGradient>
        <linearGradient id={id("fall")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={GLOW.hex} stopOpacity="0.2" />
          <stop offset="0.5" stopColor="#c8fff0" stopOpacity="0.8" />
          <stop offset="1" stopColor={GLOW.hex} stopOpacity="0.9" />
        </linearGradient>
        <radialGradient id={id("hex")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={GLOW.hex} stopOpacity="0.5" />
          <stop offset="1" stopColor={GLOW.hex} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("vio")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={GLOW.violet} stopOpacity="0.5" />
          <stop offset="1" stopColor={GLOW.violet} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("gold")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={P.gold[4]} stopOpacity="0.55" />
          <stop offset="1" stopColor={P.gold[3]} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("tL")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.verdigris[4]} />
          <stop offset="0.45" stopColor={P.verdigris[3]} />
          <stop offset="1" stopColor={P.verdigris[1]} />
        </linearGradient>
        <linearGradient id={id("tR")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.verdigris[2]} />
          <stop offset="1" stopColor={P.verdigris[0]} />
        </linearGradient>
        <linearGradient id={id("vL")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.violet[4]} />
          <stop offset="0.45" stopColor={P.violet[3]} />
          <stop offset="1" stopColor={P.violet[1]} />
        </linearGradient>
        <linearGradient id={id("vR")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.violet[2]} />
          <stop offset="1" stopColor={P.violet[0]} />
        </linearGradient>
        <linearGradient id={id("rock")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#35524d" />
          <stop offset="0.5" stopColor="#1f3533" />
          <stop offset="1" stopColor="#101e1d" />
        </linearGradient>
        <linearGradient id={id("wallL")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#040b0c" />
          <stop offset="1" stopColor="#173331" />
        </linearGradient>
        <linearGradient id={id("wallR")} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#040b0c" />
          <stop offset="1" stopColor="#173331" />
        </linearGradient>
        <radialGradient id={id("vig")} cx="0.5" cy="0.4" r="0.75">
          <stop offset="0.55" stopColor="#010607" stopOpacity="0" />
          <stop offset="1" stopColor="#010607" stopOpacity="0.85" />
        </radialGradient>
        <linearGradient id={id("bands")} x1="0" y1="0" x2="0" y2="1920" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#010507" stopOpacity="0.92" />
          <stop offset="0.08" stopColor="#010507" stopOpacity="0.55" />
          <stop offset="0.14" stopColor="#010507" stopOpacity="0" />
          <stop offset="0.64" stopColor="#010507" stopOpacity="0" />
          <stop offset="0.78" stopColor="#010507" stopOpacity="0.45" />
          <stop offset="1" stopColor="#010507" stopOpacity="0.82" />
        </linearGradient>
      </defs>

      {/* ---------- layer 0: cavern back, the waterfall ---------- */}
      <Layer n={0}>
        <rect x="-20" y="0" width="580" height={HZ + 4} fill={url("cave")} />
        <g filter="url(#wc-wash)" opacity="0.8">
          <path d="M-20 200 Q60 170 120 196 Q170 150 230 170 L250 110 L290 110 Q300 160 340 168 Q400 146 450 190 Q510 170 560 200 L560 304 L-20 304 Z" fill="#0f2c2c" />
          <path d="M-20 250 Q80 230 160 252 Q260 236 360 252 Q460 236 560 250 L560 304 L-20 304 Z" fill="#12383a" />
        </g>
        <circle cx="270" cy="210" r="120" fill={url("hex")} />
        {/* a thin fall of glowing water from a crack in the vault */}
        <path d="M262 76 Q270 82 278 76 Q282 140 280 200 Q286 250 292 302 L248 302 Q254 250 260 200 Q258 140 262 76 Z" fill={url("fall")} filter="url(#wc)" />
        <path d="M238 304 Q250 286 262 298 Q270 282 280 296 Q292 284 302 304 Z" fill="#e8fff8" opacity="0.6" filter="url(#wc)" />
        <path d="M262 90 L260 300 M270 88 V300 M278 90 L281 300" stroke="#e8fff8" strokeWidth="0.8" opacity="0.6" />
        <ellipse cx="270" cy="300" rx="40" ry="8" fill="#dffff6" opacity="0.5" filter="url(#glow-soft)" />
        <circle cx="140" cy="236" r="40" fill={url("vio")} />
        <circle cx="410" cy="226" r="46" fill={url("vio")} />
      </Layer>

      {/* ---------- layer 1: the pool, the far hoard ---------- */}
      <Layer n={1}>
        <rect x="-20" y={HZ} width="580" height={960 - HZ} fill={url("water")} />
        {/* reflected fall */}
        <path d="M256 304 L284 304 L292 420 L248 420 Z" fill={GLOW.hex} opacity="0.3" filter="url(#glow-soft)" />
        <g stroke="#dffff6" strokeLinecap="round" opacity="0.6" strokeWidth="1">
          <path d="M250 312 H290 M256 322 H284 M246 334 H280 M262 348 H286 M254 364 H274" />
        </g>
        <g stroke={P.verdigris[4]} strokeLinecap="round" fill="none">
          {RIPPLES.map((r, i) => {
            const b = busy(r.x, r.y);
            if (b < 0.35) return null;
            const len = 4 + (r.y - HZ) * 0.05 + r.s * 12;
            return <path key={i} d={`M${(r.x - len / 2).toFixed(1)} ${r.y.toFixed(1)} h${len.toFixed(1)}`} strokeWidth={(0.5 + (r.y - HZ) * 0.002).toFixed(2)} opacity={(0.1 + r.t * 0.22).toFixed(2)} />;
          })}
        </g>
        {/* the far ledge and the wyrm's hoard */}
        <circle cx="150" cy="300" r="60" fill={url("gold")} />
        <g filter="url(#wc)" strokeLinejoin="round">
          <path d="M84 318 Q100 296 150 294 Q200 294 218 316 Z" fill="#2a3a30" stroke={INK} strokeWidth="1.4" />
          <path d="M104 316 Q126 294 150 292 Q178 294 196 316 Z" fill={P.gold[2]} stroke={INK} strokeWidth="1.2" />
          <path d="M112 314 Q130 298 150 296 Q170 298 188 314" stroke={P.gold[4]} strokeWidth="1" fill="none" />
          <path d="M160 296 L166 280 L172 296 Z" fill={P.gold[3]} stroke={INK} strokeWidth="0.8" />
          <circle cx="132" cy="300" r="3" fill={P.oxblood[3]} stroke={INK} strokeWidth="0.6" />
        </g>
        <g fill={P.gold[4]}>
          {HOARD.map((c, i) => (
            <circle key={i} cx={c.x.toFixed(1)} cy={c.y.toFixed(1)} r={(c.s * 0.6).toFixed(2)} opacity="0.85" />
          ))}
        </g>
        <path d="M136 300 l2 -5 l2 5 l5 1 l-5 1 l-2 5 l-2 -5 l-5 -1 Z M172 304 l1.5 -4 l1.5 4 l4 1 l-4 1 l-1.5 4 l-1.5 -4 l-4 -1 Z" fill="#fff8e0" filter="url(#glow)" />
        <path d="M100 320 Q150 330 210 320 L200 340 Q150 346 100 336 Z" fill={P.gold[3]} opacity="0.2" filter="url(#glow-soft)" />
      </Layer>

      {/* ---------- layer 2: cave walls, stalactites, the two shelves ---------- */}
      <Layer n={2}>
        <g filter="url(#wc)" strokeLinejoin="round">
          <path d="M-20 -10 H150 Q120 50 104 110 Q86 170 100 230 Q110 290 84 340 L-20 350 Z" fill={url("wallL")} stroke={INK} strokeWidth="2" />
          <path d="M150 -10 Q120 50 104 110 Q86 170 100 230 Q110 290 84 340" stroke={P.verdigris[3]} strokeWidth="1.3" fill="none" opacity="0.5" />
          <path d="M560 -10 H390 Q430 60 446 130 Q460 200 444 262 Q436 310 462 340 L560 350 Z" fill={url("wallR")} stroke={INK} strokeWidth="2" />
          <path d="M390 -10 Q430 60 446 130 Q460 200 444 262 Q436 310 462 340" stroke={P.violet[3]} strokeWidth="1.3" fill="none" opacity="0.5" />
          <path d="M30 60 Q50 100 40 150 M60 180 Q72 220 60 260 M500 60 Q486 110 496 160 M480 190 Q470 230 482 280" stroke="#2c5450" strokeWidth="1.1" fill="none" opacity="0.7" />
          <path d="M0 -10 H560 V40 Q480 30 400 50 Q330 30 270 44 Q200 30 130 50 Q60 36 0 46 Z" fill="#050d0e" stroke={INK} strokeWidth="1.6" />
        </g>
        <circle cx="30" cy="260" r="60" fill={url("hex")} />
        <circle cx="500" cy="240" r="70" fill={url("vio")} />
        <g filter="url(#wc)">
          <g transform="translate(0 20) scale(1 -1) translate(0 -20)">{HANG.map((s, i) => shard({ ...s, y: 30 }, i, 1.8))}</g>
          {GROUND.map((s, i) => shard(s, i, 1.8))}
        </g>
        {/* the wyrm's shelf (foes): a raised slab of rock */}
        <g filter="url(#wc-wash)" opacity="0.55">
          <path d="M250 470 Q340 500 450 500 Q520 498 564 486 L564 520 Q430 526 280 506 Z" fill="#06191a" />
        </g>
        <g filter="url(#wc)" strokeLinejoin="round">
          <path d="M250 440 L300 466 L380 474 L480 474 L566 462 L566 482 L480 494 L378 494 L296 486 L252 458 Z" fill="#0a1616" stroke={INK} strokeWidth="1.8" />
          <path d="M262 452 L300 474 L380 482 L480 482 L566 472 M300 474 L298 486 M380 482 L378 494 M480 482 L480 494" stroke="#1d3634" strokeWidth="1" fill="none" />
          <path d="M252 458 L296 486 L378 494 L480 494 L566 482" stroke={GLOW.hex} strokeWidth="1" fill="none" opacity="0.45" />
          <path d="M250 440 L268 404 L330 384 L420 370 L500 372 L566 382 L566 462 L480 474 L380 474 L300 466 Z" fill={url("rock")} stroke={INK} strokeWidth="2" />
          <path d="M268 404 L330 384 L420 370 L500 372 L566 382" stroke="#7fb3a8" strokeWidth="1.3" fill="none" opacity="0.6" />
          <path d="M300 420 L340 426 L360 444 M420 392 L440 410 L480 412 M340 400 L372 396" stroke="#0b1616" strokeWidth="1.1" fill="none" opacity="0.7" />
          <path d="M456 424 l30 -10 M460 432 l32 -9 M464 440 l30 -8" stroke="#081010" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
        </g>
        {/* the party's shelf */}
        <g filter="url(#wc)" strokeLinejoin="round">
          <path d="M342 540 L330 600 L290 660 L220 720 L140 760 L-24 770 L-24 792 L146 782 L228 740 L300 680 L342 618 L352 560 Z" fill="#0a1616" stroke={INK} strokeWidth="1.8" />
          <path d="M346 580 L310 650 L240 716 L150 764 M330 600 L340 612 M290 660 L300 676 M220 720 L228 738" stroke="#1d3634" strokeWidth="1" fill="none" />
          <path d="M352 560 L342 618 L300 680 L228 740 L146 782 L-24 792" stroke={GLOW.hex} strokeWidth="1" fill="none" opacity="0.4" />
          <path d="M-24 516 L40 494 L130 486 L230 488 L310 504 L342 540 L330 600 L290 660 L220 720 L140 760 L-24 770 Z" fill={url("rock")} stroke={INK} strokeWidth="2.2" />
          <path d="M-10 510 L40 496 L130 488 L230 490 L308 506 L338 536" stroke="#7fb3a8" strokeWidth="1.4" fill="none" opacity="0.6" />
          <path d="M60 540 L100 552 L112 580 M200 520 L230 540 L270 540 M120 640 L160 630 L190 660 M40 690 L70 676" stroke="#0b1616" strokeWidth="1.1" fill="none" opacity="0.7" />
          <path d="M180 612 L196 606 L222 610 L232 620 L210 628 L186 624 Z" fill="#0d3036" stroke={INK} strokeWidth="0.9" />
          <path d="M192 616 h18" stroke={P.verdigris[4]} strokeWidth="0.7" opacity="0.6" />
        </g>
        <g filter="url(#glow-soft)">
          <ellipse cx="320" cy="410" rx="70" ry="20" fill={GLOW.hex} opacity="0.14" />
          <ellipse cx="530" cy="400" rx="50" ry="18" fill={GLOW.violet} opacity="0.18" />
          <ellipse cx="40" cy="540" rx="80" ry="24" fill={GLOW.violet} opacity="0.16" />
          <ellipse cx="260" cy="516" rx="80" ry="18" fill={GLOW.hex} opacity="0.12" />
        </g>
        {/* small crystals growing from the shelves */}
        <g filter="url(#wc)">
          {shard({ x: 548, y: 386, h: 44, w: 14, lean: -6, v: true }, 100, 1.4)}
          {shard({ x: 534, y: 388, h: 26, w: 10, lean: -8 }, 101, 1.2)}
          {shard({ x: 18, y: 520, h: 50, w: 16, lean: 4 }, 102, 1.4)}
          {shard({ x: 34, y: 516, h: 28, w: 10, lean: 8, v: true }, 103, 1.2)}
        </g>
        {/* shed glass scales */}
        {SCALES.map((sc, i) => (
          <g key={i} transform={`translate(${sc.x.toFixed(1)} ${sc.y.toFixed(1)}) rotate(${(sc.t * 360).toFixed(0)})`}>
            <path d={`M0 ${(-3 - sc.s * 3).toFixed(1)} Q${(3 + sc.s * 2).toFixed(1)} 0 0 ${(2 + sc.s).toFixed(1)} Q${(-3 - sc.s * 2).toFixed(1)} 0 0 ${(-3 - sc.s * 3).toFixed(1)} Z`} fill={sc.t > 0.5 ? P.verdigris[3] : P.violet[3]} stroke={INK} strokeWidth="0.6" opacity="0.9" />
            <path d={`M-1 ${(-2 - sc.s * 2).toFixed(1)} L-1.5 0`} stroke="#fff" strokeWidth="0.6" opacity="0.6" />
          </g>
        ))}
      </Layer>

      {/* ---------- layer 3: foreground crystals ---------- */}
      <Layer n={3}>
        <circle cx="60" cy="800" r="110" fill={url("vio")} />
        <circle cx="520" cy="860" r="90" fill={url("hex")} />
        <g filter="url(#wc)">{FORE.map((s, i) => shard(s, i, 2.8))}</g>
        <path d="M48 900 L54 760 M520 950 L514 840" stroke={GLOW.violet} strokeWidth="1.6" filter="url(#glow)" opacity="0.8" />
      </Layer>

      {/* ---------- layer 4: drips, mist, motes ---------- */}
      <Layer n={4}>
        <g filter="url(#wc-wash)" fill="#a8e0d0">
          <path d="M-20 310 Q120 298 260 310 Q400 322 560 306 L560 330 Q400 342 250 332 Q100 322 -20 338 Z" opacity="0.14" />
          <path d="M240 490 Q380 480 560 494 L560 506 Q380 498 240 502 Z" opacity="0.1" />
        </g>
        <g fill="#dffff6">
          {DRIPS.map((d, i) => (
            <path key={i} d={`M${d.x.toFixed(1)} ${(d.y + d.t * 200).toFixed(1)} q1.4 2.6 0 4 q-1.4 -1.4 0 -4 Z`} opacity="0.7" />
          ))}
        </g>
        <g filter="url(#glow)">
          {MOTES.map((m, i) => {
            const b = busy(m.x, m.y);
            if (b < 0.3 && m.t < 0.75) return null;
            return <circle key={i} cx={m.x.toFixed(1)} cy={m.y.toFixed(1)} r={(0.6 + m.s * 1.5).toFixed(2)} fill={m.t > 0.7 ? GLOW.violet : m.t > 0.55 ? GLOW.rune : GLOW.hex} opacity={(0.4 + m.t * 0.5).toFixed(2)} />;
          })}
        </g>
      </Layer>

      <rect width="1080" height="1920" fill={url("vig")} />
      <rect width="1080" height="1920" fill={url("bands")} />
      <g transform="scale(2)">
        <rect width="540" height="960" filter="url(#grain)" opacity="0.18" />
      </g>
    </svg>
  );
}
