import { useId, type ReactNode } from "react";
import { INK, P, GLOW } from "../palette";
import { flagstones, scatter, busy, rng } from "./paint";
import { Atmosphere } from "./Atmosphere";

/*
 * Authored in a 540x960 space, scaled x2 into the 1080x1920 viewBox. Parallax layers are
 * <g data-layer=n> (0 farthest) and overdraw 20 units past the left and right edges.
 * Perspective: vanishing point (VX, HZ); depth z puts a thing at x = VX + X / z, floor y = HZ + FLOOR / z.
 */
const VX = 270;
const HZ = 282;
const FLOOR = 170;
const f = (n: number) => n.toFixed(1);
const xAt = (X: number, z: number) => VX + X / z;
const fy = (z: number) => HZ + FLOOR / z;

const STONES = flagstones({ vpX: VX, horizon: HZ, bottom: 990, tile: 190, z0: 4.2, aspect: 1, seed: 12, minRow: 1.6, width: 540 });
const COLS = [
  { z: 1.25, X: -340 },
  { z: 1.9, X: -340 },
  { z: 2.9, X: -340 },
  { z: 1.25, X: 340 },
  { z: 1.9, X: 340 },
  { z: 2.9, X: 340 },
];
const MOTES = scatter(70, 13, -20, 90, 580, 600);

/** Chain links along a sagging curve from (x1,y1) to (x2,y2). */
function chain(seed: number, x1: number, y1: number, x2: number, y2: number, sag: number, link: number) {
  const r = rng(seed);
  const len = Math.hypot(x2 - x1, y2 - y1) + sag;
  const n = Math.max(2, Math.round(len / (link * 1.5)));
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2 + sag;
  const out: { x: number; y: number; a: number; flat: boolean }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
    const y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;
    const dx = 2 * (1 - t) * (cx - x1) + 2 * t * (x2 - cx);
    const dy = 2 * (1 - t) * (cy - y1) + 2 * t * (y2 - cy);
    out.push({ x, y, a: (Math.atan2(dy, dx) * 180) / Math.PI + (r() - 0.5) * 6, flat: i % 2 === 1 });
  }
  return { links: out, link };
}

const CHAINS = [
  // draped between the colossal columns, high up
  chain(1, -20, 150, 110, 190, 60, 5),
  chain(2, 110, 190, 190, 210, 26, 3.6),
  chain(3, 560, 150, 430, 190, 60, 5),
  chain(4, 430, 190, 350, 210, 26, 3.6),
  // from the dark vault down to the throne (the king is bound)
  chain(5, 214, 60, 238, 206, 8, 3.4),
  chain(6, 326, 60, 302, 206, 8, 3.4),
  // from the throne's arms to rings on the dais
  chain(7, 234, 280, 196, 322, 10, 2.8),
  chain(8, 306, 280, 344, 322, 10, 2.8),
];
const FORE_CHAINS = [chain(9, 20, -10, 34, 330, 10, 9), chain(10, 44, -10, 70, 250, 20, 8), chain(11, 520, -10, 506, 380, 12, 9)];

function pages(seed: number, n: number) {
  const r = rng(seed);
  const out: { x: number; y: number; s: number; a: number; glow: boolean }[] = [];
  while (out.length < n) {
    const x = -10 + r() * 560;
    const y = 90 + r() * 560;
    if (busy(x, y) < 0.35 && r() < 0.8) continue;
    out.push({ x, y, s: 3 + r() * 4.5, a: (r() - 0.5) * 140, glow: r() < 0.35 });
  }
  return out;
}
const PAGES = pages(33, 20);

function Layer({ n, children }: { n: number; children: ReactNode }) {
  return (
    <g data-layer={n}>
      <g transform="scale(2)">{children}</g>
    </g>
  );
}

/** The Bound King's throne room: a vast dark hall, a broken throne held down by chains, violet-and-gold light, drifting pages. */
export default function Throne({ className }: { className?: string }) {
  const u = useId().replace(/:/g, "");
  const id = (s: string) => `${u}-${s}`;
  const url = (s: string) => `url(#${id(s)})`;

  const drawChain = (c: ReturnType<typeof chain>, i: number, dark: boolean) => (
    <g key={i}>
      {c.links.map((l, j) => (
        <ellipse
          key={j}
          cx={f(l.x)}
          cy={f(l.y)}
          rx={f(c.link)}
          ry={f(l.flat ? c.link * 0.28 : c.link * 0.62)}
          transform={`rotate(${f(l.a)} ${f(l.x)} ${f(l.y)})`}
          fill="none"
          stroke={dark ? "#07060a" : INK}
          strokeWidth={f(c.link * (l.flat ? 0.5 : 0.42))}
        />
      ))}
      {!dark &&
        c.links.map((l, j) =>
          l.flat ? null : (
            <ellipse
              key={`h${j}`}
              cx={f(l.x - c.link * 0.15)}
              cy={f(l.y - c.link * 0.15)}
              rx={f(c.link * 0.8)}
              ry={f(c.link * 0.45)}
              transform={`rotate(${f(l.a)} ${f(l.x)} ${f(l.y)})`}
              fill="none"
              stroke={P.gold[2]}
              strokeWidth={f(c.link * 0.14)}
              opacity="0.6"
            />
          ),
        )}
    </g>
  );

  const column = (c: { z: number; X: number }, i: number) => {
    const w = 84 / c.z;
    const x = xAt(c.X, c.z);
    const x0 = c.X < 0 ? x - w / 2 : x - w / 2;
    const base = fy(c.z);
    const lit = c.X < 0 ? 1 : -1;
    return (
      <g key={i}>
        <ellipse cx={f(x)} cy={f(base + 2)} rx={f(w * 0.9)} ry={f(w * 0.12)} fill="#000" opacity="0.5" filter="url(#wc-wash)" />
        <path d={`M${f(x0)} -30 V${f(base)} H${f(x0 + w)} V-30 Z`} fill={url(lit > 0 ? "colL" : "colR")} stroke={INK} strokeWidth={f(1 + 1.6 / c.z)} />
        {[0.2, 0.36, 0.52, 0.68, 0.84].map((t) => (
          <path key={t} d={`M${f(x0 + w * t)} -30 V${f(base - w * 0.4)}`} stroke={INK} strokeWidth={f(0.5 + 0.5 / c.z)} opacity="0.4" />
        ))}
        <path d={`M${f(lit > 0 ? x0 + w - 1.5 : x0 + 1.5)} -30 V${f(base - w * 0.4)}`} stroke={P.gold[3]} strokeWidth={f(0.6 + 1.2 / c.z)} opacity="0.55" />
        <path d={`M${f(lit > 0 ? x0 + w * 0.8 : x0 + w * 0.2)} 40 V${f(base - w * 0.4)}`} stroke={P.violet[3]} strokeWidth={f(1 + 2 / c.z)} opacity="0.25" />
        {/* base mouldings */}
        <path d={`M${f(x0 - w * 0.14)} ${f(base - w * 0.4)} h${f(w * 1.28)} v${f(w * 0.16)} h${f(-w * 1.28)} Z M${f(x0 - w * 0.2)} ${f(base - w * 0.24)} h${f(w * 1.4)} v${f(w * 0.24)} h${f(-w * 1.4)} Z`} fill={P.slate[2]} stroke={INK} strokeWidth={f(0.8 + 1 / c.z)} />
        <path d={`M${f(x0 - w * 0.2)} ${f(base - w * 0.23)} h${f(w * 1.4)}`} stroke={P.gold[3]} strokeWidth={f(0.5 + 0.8 / c.z)} opacity="0.6" />
      </g>
    );
  };

  const brazier = (x: number, y: number, k: number) => (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <circle cx="0" cy="-44" r="40" fill={P.violet[3]} opacity="0.55" filter="url(#glow-soft)" />
      <path d="M-4 0 L-3 -30 M4 0 L3 -30" stroke={INK} strokeWidth="2.4" />
      <path d="M-12 0 H12 L8 -5 H-8 Z" fill={P.gold[1]} stroke={INK} strokeWidth="1.4" />
      <path d="M-16 -32 Q0 -18 16 -32 Z" fill={P.gold[2]} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M-14 -31 Q0 -22 14 -31" stroke={P.gold[4]} strokeWidth="1" fill="none" />
      <path d="M-11 -32 C-13 -42 -5 -46 -7 -56 C0 -50 -2 -64 3 -72 C5 -60 11 -56 9 -46 C14 -50 14 -40 11 -32 Z" fill={url("vflame")} filter="url(#glow)" />
      <path d="M-4 -32 C-5 -40 0 -44 0 -52 C4 -46 5 -40 4 -32 Z" fill="#fff6ff" opacity="0.9" />
    </g>
  );

  return (
    <svg viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id("dark")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#060509" />
          <stop offset="0.5" stopColor="#120e1c" />
          <stop offset="1" stopColor="#1d1530" />
        </linearGradient>
        <linearGradient id={id("window")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.violet[2]} />
          <stop offset="0.45" stopColor={P.violet[3]} />
          <stop offset="0.8" stopColor={P.gold[3]} />
          <stop offset="1" stopColor={P.gold[4]} />
        </linearGradient>
        <radialGradient id={id("halo")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={P.gold[4]} stopOpacity="0.7" />
          <stop offset="0.3" stopColor={GLOW.violet} stopOpacity="0.35" />
          <stop offset="1" stopColor={P.violet[1]} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("ray")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.gold[4]} stopOpacity="0.5" />
          <stop offset="1" stopColor={P.gold[4]} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id("floor")} x1="0" y1={HZ} x2="0" y2="960" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3b2d52" />
          <stop offset="0.12" stopColor="#261d38" />
          <stop offset="0.45" stopColor="#151120" />
          <stop offset="1" stopColor="#07060b" />
        </linearGradient>
        <linearGradient id={id("colL")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0d0b14" />
          <stop offset="0.6" stopColor="#262036" />
          <stop offset="1" stopColor="#4a3d63" />
        </linearGradient>
        <linearGradient id={id("colR")} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#0d0b14" />
          <stop offset="0.6" stopColor="#221c30" />
          <stop offset="1" stopColor="#40355a" />
        </linearGradient>
        <linearGradient id={id("step")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4d4068" />
          <stop offset="1" stopColor="#1b1628" />
        </linearGradient>
        <linearGradient id={id("carpet")} x1="0" y1={fy(2.1)} x2="0" y2="960" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8a2a3c" />
          <stop offset="0.2" stopColor="#5a1a2a" />
          <stop offset="0.55" stopColor="#3a1020" />
          <stop offset="1" stopColor="#1a070e" />
        </linearGradient>
        <linearGradient id={id("throne")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={P.gold[1]} />
          <stop offset="0.4" stopColor={P.gold[3]} />
          <stop offset="0.7" stopColor={P.gold[2]} />
          <stop offset="1" stopColor={P.gold[0]} />
        </linearGradient>
        <linearGradient id={id("velvet")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.violet[3]} />
          <stop offset="1" stopColor={P.violet[0]} />
        </linearGradient>
        <radialGradient id={id("vflame")} cx="0.5" cy="0.8" r="0.7">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.35" stopColor={GLOW.violet} />
          <stop offset="0.75" stopColor={P.violet[3]} />
          <stop offset="1" stopColor={P.violet[2]} />
        </radialGradient>
        <radialGradient id={id("vig")} cx="0.5" cy="0.4" r="0.75">
          <stop offset="0.5" stopColor="#040308" stopOpacity="0" />
          <stop offset="1" stopColor="#040308" stopOpacity="0.88" />
        </radialGradient>
        <linearGradient id={id("bands")} x1="0" y1="0" x2="0" y2="1920" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#030206" stopOpacity="0.72" />
          <stop offset="0.06" stopColor="#030206" stopOpacity="0.3" />
          <stop offset="0.11" stopColor="#030206" stopOpacity="0" />
          <stop offset="0.64" stopColor="#030206" stopOpacity="0" />
          <stop offset="0.78" stopColor="#030206" stopOpacity="0.45" />
          <stop offset="1" stopColor="#030206" stopOpacity="0.85" />
        </linearGradient>
        <clipPath id={id("floorClip")}>
          <rect x="-20" y={HZ + 30} width="580" height="700" />
        </clipPath>
      </defs>

      {/* ---------- layer 0: the void of the hall, the great window ---------- */}
      <Layer n={0}>
        <rect x="-20" y="0" width="580" height="400" fill={url("dark")} />
        <circle cx="270" cy="210" r="210" fill={url("halo")} />
        <g filter="url(#wc)">
          <path d="M176 330 V170 C176 110 220 78 270 60 C320 78 364 110 364 170 V330 Z" fill="#0f0b17" stroke={INK} strokeWidth="2" />
          <path d="M190 322 V172 C190 120 228 94 270 78 C312 94 350 120 350 172 V322 Z" fill={url("window")} stroke={INK} strokeWidth="1.8" />
          {/* mullions and tracery, one light broken out */}
          <path d="M230 322 V150 M270 322 V80 M310 322 V150 M190 220 H350 M190 270 H350" stroke={INK} strokeWidth="2.2" />
          <path d="M230 150 C230 118 250 100 270 92 C290 100 310 118 310 150" stroke={INK} strokeWidth="1.8" fill="none" />
          <circle cx="250" cy="130" r="12" fill="none" stroke={INK} strokeWidth="1.6" />
          <circle cx="290" cy="130" r="12" fill="none" stroke={INK} strokeWidth="1.6" />
          <path d="M310 222 L350 222 L350 268 L330 262 L320 240 L310 250 Z" fill="#0a0710" stroke={INK} strokeWidth="1.2" />
        </g>
        <path d="M190 322 V172 C190 120 228 94 270 78 C312 94 350 120 350 172 V322 Z" fill={P.gold[4]} opacity="0.25" filter="url(#glow-soft)" />
        {/* falling light */}
        <g filter="url(#glow-soft)" opacity="0.7">
          <path d="M196 180 L250 180 L236 420 L110 420 Z" fill={url("ray")} opacity="0.5" />
          <path d="M290 180 L344 180 L430 420 L304 420 Z" fill={url("ray")} opacity="0.45" />
        </g>
        {/* far wall stonework either side of the window */}
        <g stroke="#2a2140" strokeWidth="1" opacity="0.7" filter="url(#wc)">
          <path d="M120 240 H176 M120 270 H176 M120 300 H176 M364 240 H420 M364 270 H420 M364 300 H420 M140 240 V270 M160 270 V300 M384 240 V270 M404 270 V300" />
        </g>
      </Layer>

      {/* ---------- layer 1: floor, carpet, dais and the broken throne ---------- */}
      <Layer n={1}>
        <rect x="-20" y={HZ + 30} width="580" height="700" fill={url("floor")} />
        <g clipPath={url("floorClip")} filter="url(#wc)">
          {STONES.map((s, i) => {
            const b = busy(s.cx, s.cy);
            const fade = Math.min(1, Math.max(0, (s.depth - 0.05) / 0.2));
            return (
              <path
                key={i}
                d={s.d}
                fill={s.shade < 0 ? "#000" : "#9a86c4"}
                fillOpacity={(Math.abs(s.shade) * (s.shade < 0 ? 0.25 : 0.07) * (0.5 + b) * fade).toFixed(3)}
                stroke="#06050a"
                strokeOpacity={((0.3 + 0.5 * b) * (0.2 + 0.8 * fade)).toFixed(3)}
                strokeWidth={(0.5 + Math.min(1, s.depth * 2)).toFixed(2)}
                strokeDasharray={s.dash}
                strokeLinecap="round"
              />
            );
          })}
        </g>
        {/* reflections of the window in the polished floor */}
        <g filter="url(#glow-soft)" opacity="0.5">
          <path d="M190 366 L350 366 L380 470 L160 470 Z" fill={P.gold[3]} opacity="0.25" />
          <path d="M150 366 L180 366 L170 440 L130 440 Z M360 366 L390 366 L410 440 L370 440 Z" fill={GLOW.violet} opacity="0.3" />
        </g>
        {/* the carpet */}
        <g>
          <path d={`M${f(xAt(-58, 2.1))} ${f(fy(2.1))} L${f(xAt(58, 2.1))} ${f(fy(2.1))} L${f(xAt(58, 0.26))} 970 L${f(xAt(-58, 0.26))} 970 Z`} fill={url("carpet")} stroke={INK} strokeWidth="1.6" />
          <path d={`M${f(xAt(-50, 2.1))} ${f(fy(2.1))} L${f(xAt(-50, 0.26))} 970 M${f(xAt(50, 2.1))} ${f(fy(2.1))} L${f(xAt(50, 0.26))} 970`} stroke={P.gold[3]} strokeWidth="1.4" opacity="0.75" />
          {/* a tear in the runner */}
          <path d="M300 560 L310 572 L304 584 L292 574 Z" fill="#1a1426" stroke={INK} strokeWidth="1" opacity="0.8" />
          {[2.0, 1.6, 1.25, 0.95, 0.7, 0.5].map((z, i) => (
            <g key={i}>
              <path d={`M${f(xAt(-50, z))} ${f(fy(z))} H${f(xAt(50, z))}`} stroke={P.gold[2]} strokeWidth={f(0.6 + 0.5 / z)} opacity="0.35" strokeDasharray={`${f(6 / z)} ${f(4 / z)}`} />
              <path d={`M${f(VX)} ${f(fy(z) - 4 / z)} l${f(5 / z)} ${f(4 / z)} l${f(-5 / z)} ${f(4 / z)} l${f(-5 / z)} ${f(-4 / z)} Z`} fill="none" stroke={P.gold[2]} strokeWidth={f(0.5 + 0.4 / z)} opacity="0.4" />
            </g>
          ))}
          <path d={`M${f(xAt(-58, 2.1))} ${f(fy(2.1))} L${f(xAt(-58, 0.26))} 970`} stroke={P.oxblood[3]} strokeWidth="1" opacity="0.4" />
        </g>
        {/* dais steps */}
        <g filter="url(#wc)" strokeLinejoin="round">
          <path d="M120 366 L128 352 H412 L420 366 Z" fill={url("step")} stroke={INK} strokeWidth="1.8" />
          <path d="M142 352 L150 340 H390 L398 352 Z" fill={url("step")} stroke={INK} strokeWidth="1.6" />
          <path d="M162 340 L170 329 H370 L378 340 Z" fill={url("step")} stroke={INK} strokeWidth="1.5" />
          <path d="M180 329 L186 320 H354 L360 329 Z" fill={url("step")} stroke={INK} strokeWidth="1.4" />
          <path d="M128 353 H412 M150 341 H390 M170 330 H370 M186 321 H354" stroke={P.gold[4]} strokeWidth="1" opacity="0.55" />
          <path d={`M${f(xAt(-58, 2.1))} ${f(fy(2.1))} L${f(xAt(-50, 2.5))} 330 H${f(xAt(50, 2.5))} L${f(xAt(58, 2.1))} ${f(fy(2.1))} Z`} fill={P.oxblood[2]} opacity="0.85" />
          <path d="M140 330 L150 334 L146 346 M388 336 L398 344" stroke={INK} strokeWidth="1" fill="none" />
          <circle cx="196" cy="322" r="2.6" fill="none" stroke={P.gold[3]} strokeWidth="1.2" />
          <circle cx="344" cy="322" r="2.6" fill="none" stroke={P.gold[3]} strokeWidth="1.2" />
        </g>
        {/* the broken throne */}
        <g filter="url(#wc)" strokeLinejoin="round">
          <ellipse cx="270" cy="322" rx="54" ry="5" fill="#000" opacity="0.5" />
          {/* backrest: tall, its right spire snapped off */}
          <path d="M238 292 L236 180 L246 150 L256 172 L270 118 L284 168 L288 176 L296 170 L292 196 L304 206 L302 292 Z" fill={url("throne")} stroke={INK} strokeWidth="2.4" />
          <path d="M246 290 L246 190 L256 180 L270 146 L282 184 L292 206 L292 290 Z" fill={url("velvet")} stroke={INK} strokeWidth="1.4" />
          <path d="M270 150 V288 M256 196 L284 196" stroke={P.gold[3]} strokeWidth="1" opacity="0.7" />
          <path d="M270 146 L282 184 L292 206 L292 290 L270 290 Z" fill={P.violet[0]} opacity="0.45" />
          <path d="M288 176 L296 170 L292 196 L304 206 L302 292 L292 292 L292 206 Z" fill={P.gold[0]} opacity="0.5" />
          <circle cx="270" cy="214" r="8" fill="none" stroke={P.gold[4]} strokeWidth="1.4" />
          <circle cx="270" cy="214" r="3" fill={GLOW.violet} filter="url(#glow)" />
          {/* the snapped spire lies on the dais */}
          <path d="M312 318 L336 304 L344 310 L318 324 Z" fill={url("throne")} stroke={INK} strokeWidth="1.6" />
          {/* seat and arms */}
          <path d="M228 292 H312 L316 306 H224 Z" fill={P.gold[2]} stroke={INK} strokeWidth="2" />
          <path d="M232 306 V322 H308 V306 Z" fill={P.gold[1]} stroke={INK} strokeWidth="2" />
          <path d="M222 268 Q222 262 230 262 H240 V292 H224 Z M318 268 Q318 262 310 262 H300 V292 H316 Z" fill={url("throne")} stroke={INK} strokeWidth="1.8" />
          <path d="M226 264 H238 M302 264 H314" stroke={P.gold[4]} strokeWidth="1" />
          <path d="M239 176 L243 290 M300 208 L298 290" stroke={P.gold[4]} strokeWidth="1" opacity="0.6" />
          <path d="M252 250 L262 262 L256 276" stroke={INK} strokeWidth="1" fill="none" />
        </g>
        {CHAINS.slice(4).map((c, i) => drawChain(c, i, false))}
      </Layer>

      {/* ---------- layer 2: colossal columns, high chains, violet braziers ---------- */}
      <Layer n={2}>
        <g filter="url(#wc)">{COLS.map(column)}</g>
        {CHAINS.slice(0, 4).map((c, i) => drawChain(c, i, false))}
        {brazier(150, 346, 0.62)}
        {brazier(390, 346, 0.62)}
      </Layer>

      {/* ---------- layer 3: foreground chains ---------- */}
      <Layer n={3}>{FORE_CHAINS.map((c, i) => drawChain(c, i, true))}</Layer>

      {/* ---------- layer 4: drifting pages and motes ---------- */}
      <Layer n={4}>
        <g filter="url(#glow)">
          {MOTES.map((m, i) => {
            const b = busy(m.x, m.y);
            if (b < 0.3 && m.t < 0.7) return null;
            return <circle key={i} cx={m.x.toFixed(1)} cy={m.y.toFixed(1)} r={(0.5 + m.s * 1.3).toFixed(2)} fill={m.t > 0.5 ? GLOW.rune : GLOW.violet} opacity={(0.3 + m.t * 0.6).toFixed(2)} />;
          })}
        </g>
        {PAGES.map((p, i) => (
          <g key={i} transform={`translate(${f(p.x)} ${f(p.y)}) rotate(${f(p.a)}) skewX(${f(p.a * 0.15)})`}>
            {p.glow && <rect x={-p.s * 0.9} y={-p.s * 1.2} width={p.s * 1.8} height={p.s * 2.4} fill={P.gold[4]} opacity="0.5" filter="url(#glow-soft)" />}
            <path d={`M${f(-p.s * 0.7)} ${f(-p.s)} H${f(p.s * 0.7)} L${f(p.s * 0.74)} ${f(p.s)} H${f(-p.s * 0.66)} Z`} fill={p.glow ? P.bone[4] : P.bone[2]} stroke={INK} strokeWidth="0.7" strokeLinejoin="round" />
            <path d={`M${f(-p.s * 0.45)} ${f(-p.s * 0.55)} h${f(p.s * 0.9)} M${f(-p.s * 0.45)} ${f(-p.s * 0.2)} h${f(p.s * 0.8)} M${f(-p.s * 0.45)} ${f(p.s * 0.15)} h${f(p.s * 0.9)} M${f(-p.s * 0.45)} ${f(p.s * 0.5)} h${f(p.s * 0.5)}`} stroke={P.bone[1]} strokeWidth="0.5" />
            <path d={`M${f(p.s * 0.7)} ${f(-p.s)} L${f(p.s * 0.74)} ${f(p.s)}`} stroke={P.bone[2]} strokeWidth="0.8" opacity="0.7" />
          </g>
        ))}
      </Layer>

      <Atmosphere light={{ x: 540, y: 420, color: "#ffd98a" }} rays={{ n: 8, spread: 0.75, length: 1600, seed: 2 }} haze={{ y: 600, color: "#6a44a3", opacity: 0.22 }} />
      <rect width="1080" height="1920" fill={url("vig")} />
      <rect width="1080" height="1920" fill={url("bands")} />
      <g transform="scale(2)">
        <rect width="540" height="960" filter="url(#grain)" opacity="0.18" />
      </g>
    </svg>
  );
}
