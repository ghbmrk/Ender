import { useId, type ReactNode } from "react";
import { INK, P, GLOW } from "../palette";
import { flagstones, scatter, busy, farLines } from "./paint";
import { Atmosphere } from "./Atmosphere";

/*
 * Authored in a 540x960 space, scaled x2 into the 1080x1920 viewBox. Parallax layers are
 * <g data-layer=n> (0 farthest) and overdraw 20 units past the left and right edges.
 *
 * The nave is laid out in simple perspective: vanishing point (VX, HZ); a thing at depth z sits at
 * x = VX + X / z, the floor at HZ + FLOOR / z, the vault springs at HZ - SPRING / z and peaks at HZ - PEAK / z.
 */
const VX = 270;
const HZ = 290;
const FLOOR = 170;
const SPRING = 450;
const PEAK = 900;
const WALL_X = 420; // half-width of the nave
const PIER_W = 70;
const PIERS = [1.4, 2, 2.8, 4];
const BACK = 5.5;

const xAt = (X: number, z: number) => VX + X / z;
const fy = (z: number) => HZ + FLOOR / z;
const sy = (z: number) => HZ - SPRING / z;
const py = (z: number) => HZ - PEAK / z;
const f = (n: number) => n.toFixed(1);

const STONES = flagstones({ vpX: VX, horizon: HZ, bottom: 990, tile: 120, z0: 1.05 * (700 / 170) * 0 + 4.1, aspect: 0.8, seed: 77, minRow: 1.4, width: 540 });
const FAR_LINES = farLines(4, fy(BACK), 350, 5);
const DUST = scatter(90, 29, -20, 90, 580, 620);

function Layer({ n, children }: { n: number; children: ReactNode }) {
  return (
    <g data-layer={n}>
      <g transform="scale(2)">{children}</g>
    </g>
  );
}

/** A pointed (gothic) arch from (x1, y) to (x2, y) peaking at yPeak, as path commands (no M). */
function pointed(x1: number, x2: number, y: number, yPeak: number) {
  const mx = (x1 + x2) / 2;
  const h = y - yPeak;
  return `C${f(x1)} ${f(y - h * 0.62)} ${f(mx - (mx - x1) * 0.32)} ${f(yPeak + h * 0.08)} ${f(mx)} ${f(yPeak)} C${f(mx + (x2 - mx) * 0.32)} ${f(yPeak + h * 0.08)} ${f(x2)} ${f(y - h * 0.62)} ${f(x2)} ${f(y)}`;
}

/** The Hollow Keep: a gothic hall built around an absence, violet light through a broken rose window, banners, cold slate. */
export default function HollowKeep({ className }: { className?: string }) {
  const u = useId().replace(/:/g, "");
  const id = (s: string) => `${u}-${s}`;
  const url = (s: string) => `url(#${id(s)})`;

  // one side of the nave (side = -1 left, +1 right)
  const side = (sd: -1 | 1) => {
    const X = sd * WALL_X;
    const Xi = sd * (WALL_X - PIER_W);
    const bays: ReactNode[] = [];
    const zs = [...PIERS, BACK];
    for (let i = 0; i < zs.length - 1; i++) {
      const za = zs[i]!;
      const zb = zs[i + 1]!;
      const xa = xAt(Xi, za);
      const xb = xAt(X, zb);
      const zm = (za + zb) / 2;
      const aS = HZ - 150 / zm;
      const aP = HZ - 250 / zm;
      const cS = HZ - 330 / zm;
      const cP = HZ - 400 / zm;
      const ya = fy(za);
      const yb = fy(zb);
      const wallTop = `M${f(xa)} ${f(sy(za))} L${f(xb)} ${f(sy(zb))} L${f(xb)} ${f(yb)} L${f(xa)} ${f(ya)} Z`;
      const inset = (x: number) => xa + (xb - xa) * x;
      const arch = `M${f(inset(0.08))} ${f(ya - (ya - yb) * 0.08)} L${f(inset(0.08))} ${f(aS)} ${pointed(inset(0.08), inset(0.92), aS, aP)} L${f(inset(0.92))} ${f(yb + (ya - yb) * 0.08)} Z`;
      const cl = `M${f(inset(0.3))} ${f(cS)} ${pointed(inset(0.3), inset(0.7), cS, cP)} L${f(inset(0.7))} ${f(cS + 34 / zm)} L${f(inset(0.3))} ${f(cS + 34 / zm)} Z`;
      bays.push(
        <g key={i}>
          <path d={wallTop} fill={sd < 0 ? "#2a2c3a" : "#222431"} stroke={INK} strokeWidth="1.2" />
          <path d={arch} fill="#0b0b12" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
          <path d={`M${f(inset(0.5))} ${f(aS + 10 / zm)} v${f(40 / zm)}`} stroke={P.violet[3]} strokeWidth={f(10 / zm)} opacity="0.35" filter="url(#glow)" />
          <path d={cl} fill={P.violet[2]} stroke={INK} strokeWidth="1" opacity="0.9" />
          <path d={cl} fill={GLOW.violet} opacity="0.35" filter="url(#glow)" />
          <path d={`M${f(inset(0.5))} ${f(cP + 3)} V${f(cS + 34 / zm)} M${f(inset(0.3))} ${f(cS + 14 / zm)} H${f(inset(0.7))}`} stroke={INK} strokeWidth="0.9" />
        </g>,
      );
    }
    const piers = PIERS.map((z, i) => {
      const xo = xAt(X, z);
      const xi = xAt(Xi, z);
      const lit = sd < 0;
      const w = Math.abs(xi - xo);
      return (
        <g key={`p${i}`}>
          <path d={`M${f(xo)} -30 L${f(xo)} ${f(fy(z))} L${f(xi)} ${f(fy(z))} L${f(xi)} -30 Z`} fill={url(lit ? "pierL" : "pierR")} stroke={INK} strokeWidth={f(1.2 + 1.4 / z)} />
          {/* clustered shafts */}
          <path
            d={`M${f(xo + (xi - xo) * 0.3)} -30 V${f(fy(z))} M${f(xo + (xi - xo) * 0.55)} -30 V${f(fy(z))} M${f(xo + (xi - xo) * 0.8)} -30 V${f(fy(z))}`}
            stroke={INK}
            strokeWidth={f(0.6 + 0.6 / z)}
            opacity="0.45"
          />
          <path d={`M${f(xi - sd * 1)} -30 V${f(fy(z))}`} stroke={lit ? P.violet[4] : P.violet[3]} strokeWidth={f(0.8 + 1 / z)} opacity={lit ? 0.7 : 0.4} />
          {/* capital and base */}
          <path d={`M${f(xo - sd * 3 / z)} ${f(sy(z))} h${f((xi - xo) + sd * 6 / z)} v${f(8 / z)} h${f(-(xi - xo) - sd * 6 / z)} Z`} fill={P.slate[3]} stroke={INK} strokeWidth="1" />
          <path d={`M${f(xo - sd * 4 / z)} ${f(fy(z) - 14 / z)} h${f((xi - xo) + sd * 8 / z)} v${f(14 / z)} h${f(-(xi - xo) - sd * 8 / z)} Z`} fill={P.slate[2]} stroke={INK} strokeWidth="1" />
          {w > 12 && <path d={`M${f(xo)} ${f(fy(z) + 2)} h${f(xi - xo)}`} stroke={INK} strokeWidth="3" opacity="0.4" filter="url(#wc-wash)" />}
        </g>
      );
    });
    return (
      <g>
        {bays}
        {piers}
      </g>
    );
  };

  // transverse vault ribs across the nave at each pier
  const ribs = [...PIERS, BACK].map((z, i) => {
    const xl = xAt(-(WALL_X - PIER_W), z);
    const xr = xAt(WALL_X - PIER_W, z);
    const t = 1.2 + 3 / z;
    return (
      <g key={i}>
        <path d={`M${f(xl)} ${f(sy(z))} ${pointed(xl, xr, sy(z), py(z))}`} fill="none" stroke={INK} strokeWidth={f(t * 2.2)} />
        <path d={`M${f(xl)} ${f(sy(z))} ${pointed(xl, xr, sy(z), py(z))}`} fill="none" stroke={P.slate[3]} strokeWidth={f(t * 1.2)} />
        <path d={`M${f(xl + 1)} ${f(sy(z))} ${pointed(xl + 1, xr - 1, sy(z), py(z) + t * 0.6)}`} fill="none" stroke={P.violet[3]} strokeWidth={f(t * 0.35)} opacity="0.55" />
      </g>
    );
  });

  // hanging banners on the inner faces of the piers
  const banner = (x: number, top: number, w: number, h: number, cloth: string, dark: string, k: number) => (
    <g>
      <path d={`M${f(x - w * 0.62)} ${f(top)} H${f(x + w * 0.62)}`} stroke={INK} strokeWidth={f(1.4 * k)} strokeLinecap="round" />
      <path
        d={`M${f(x - w / 2)} ${f(top)} H${f(x + w / 2)} V${f(top + h * 0.86)} L${f(x + w * 0.3)} ${f(top + h * 0.8)} L${f(x + w * 0.12)} ${f(top + h)} L${f(x - w * 0.08)} ${f(top + h * 0.84)} L${f(x - w * 0.28)} ${f(top + h * 0.95)} L${f(x - w / 2)} ${f(top + h * 0.82)} Z`}
        fill={cloth}
        stroke={INK}
        strokeWidth={f(1.3 * k)}
        strokeLinejoin="round"
      />
      <path d={`M${f(x + w * 0.1)} ${f(top)} V${f(top + h * 0.84)} L${f(x + w / 2)} ${f(top + h * 0.86)} V${f(top)} Z`} fill={dark} opacity="0.55" />
      <path d={`M${f(x - w * 0.34)} ${f(top + 3 * k)} V${f(top + h * 0.8)}`} stroke="#fff" strokeWidth={f(0.8 * k)} opacity="0.12" />
      <path d={`M${f(x - w / 2 + 2 * k)} ${f(top + 4 * k)} H${f(x + w / 2 - 2 * k)}`} stroke={P.gold[3]} strokeWidth={f(1 * k)} opacity="0.8" />
      {/* sigil: an empty ring pierced by a line — the absence */}
      <circle cx={f(x)} cy={f(top + h * 0.34)} r={f(w * 0.24)} fill="none" stroke={P.gold[3]} strokeWidth={f(1.3 * k)} />
      <path d={`M${f(x)} ${f(top + h * 0.34 - w * 0.36)} V${f(top + h * 0.34 + w * 0.36)}`} stroke={P.gold[3]} strokeWidth={f(1 * k)} />
    </g>
  );

  const rose = { x: VX, y: 214, r: 50 };
  const tracery = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return `M${f(rose.x + Math.cos(a) * 16)} ${f(rose.y + Math.sin(a) * 16)} L${f(rose.x + Math.cos(a) * rose.r)} ${f(rose.y + Math.sin(a) * rose.r)}`;
  }).join("");
  const petals = Array.from({ length: 12 }, (_, i) => {
    const a = ((i + 0.5) / 12) * Math.PI * 2;
    return <circle key={i} cx={f(rose.x + Math.cos(a) * 36)} cy={f(rose.y + Math.sin(a) * 36)} r="7.5" fill="none" stroke={INK} strokeWidth="1.3" />;
  });

  const bx0 = xAt(-(WALL_X - PIER_W), BACK);
  const bx1 = xAt(WALL_X - PIER_W, BACK);

  return (
    <svg viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id("back")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#15161f" />
          <stop offset="0.6" stopColor="#2c2d3d" />
          <stop offset="1" stopColor="#3d3a55" />
        </linearGradient>
        <radialGradient id={id("glass")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fbf2ff" />
          <stop offset="0.35" stopColor={GLOW.violet} />
          <stop offset="0.8" stopColor={P.violet[2]} />
          <stop offset="1" stopColor={P.violet[1]} />
        </radialGradient>
        <radialGradient id={id("halo")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={GLOW.violet} stopOpacity="0.6" />
          <stop offset="0.5" stopColor={P.violet[2]} stopOpacity="0.2" />
          <stop offset="1" stopColor={P.violet[1]} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("floor")} x1="0" y1={HZ} x2="0" y2="960" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4a4666" />
          <stop offset="0.12" stopColor="#34344a" />
          <stop offset="0.45" stopColor="#1f2130" />
          <stop offset="1" stopColor="#0a0b10" />
        </linearGradient>
        <linearGradient id={id("vault")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a0a10" />
          <stop offset="1" stopColor="#1e1f2b" />
        </linearGradient>
        <linearGradient id={id("pierL")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={P.slate[1]} />
          <stop offset="0.7" stopColor={P.slate[2]} />
          <stop offset="1" stopColor="#6a6590" />
        </linearGradient>
        <linearGradient id={id("pierR")} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor={P.slate[0]} />
          <stop offset="0.7" stopColor={P.slate[1]} />
          <stop offset="1" stopColor={P.slate[3]} />
        </linearGradient>
        <linearGradient id={id("beam")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={GLOW.violet} stopOpacity="0.55" />
          <stop offset="1" stopColor={GLOW.violet} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={id("pool")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={GLOW.violet} stopOpacity="0.45" />
          <stop offset="1" stopColor={P.violet[2]} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("void")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" />
          <stop offset="0.7" stopColor="#0b0714" />
          <stop offset="1" stopColor={P.violet[1]} />
        </radialGradient>
        <radialGradient id={id("vig")} cx="0.5" cy="0.42" r="0.75">
          <stop offset="0.55" stopColor="#05050a" stopOpacity="0" />
          <stop offset="1" stopColor="#05050a" stopOpacity="0.85" />
        </radialGradient>
        <linearGradient id={id("bands")} x1="0" y1="0" x2="0" y2="1920" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#040409" stopOpacity="0.72" />
          <stop offset="0.06" stopColor="#040409" stopOpacity="0.3" />
          <stop offset="0.11" stopColor="#040409" stopOpacity="0" />
          <stop offset="0.64" stopColor="#040409" stopOpacity="0" />
          <stop offset="0.78" stopColor="#040409" stopOpacity="0.45" />
          <stop offset="1" stopColor="#040409" stopOpacity="0.82" />
        </linearGradient>
        <clipPath id={id("floorClip")}>
          <rect x="-20" y={fy(BACK) - 1} width="580" height="700" />
        </clipPath>
      </defs>

      {/* ---------- layer 0: the end wall and its broken rose window ---------- */}
      <Layer n={0}>
        <rect x="-20" y="0" width="580" height="400" fill={url("vault")} />
        <rect x={bx0 - 10} y="0" width={bx1 - bx0 + 20} height={fy(BACK) - 0} fill={url("back")} />
        <circle cx={rose.x} cy={rose.y} r="130" fill={url("halo")} />
        <g filter="url(#wc)">
          <circle cx={rose.x} cy={rose.y} r={rose.r + 7} fill={P.slate[2]} stroke={INK} strokeWidth="2" />
          <circle cx={rose.x} cy={rose.y} r={rose.r} fill={url("glass")} stroke={INK} strokeWidth="2" />
          {/* coloured panes */}
          {Array.from({ length: 12 }, (_, i) => {
            const a0 = (i / 12) * Math.PI * 2;
            const a1 = ((i + 1) / 12) * Math.PI * 2;
            const r0 = 18;
            const r1 = rose.r - 1;
            const col = i % 3 === 0 ? P.sapphire[3] : i % 3 === 1 ? P.violet[3] : P.oxblood[3];
            return (
              <path
                key={i}
                d={`M${f(rose.x + Math.cos(a0) * r0)} ${f(rose.y + Math.sin(a0) * r0)} L${f(rose.x + Math.cos(a0) * r1)} ${f(rose.y + Math.sin(a0) * r1)} A${r1} ${r1} 0 0 1 ${f(rose.x + Math.cos(a1) * r1)} ${f(rose.y + Math.sin(a1) * r1)} L${f(rose.x + Math.cos(a1) * r0)} ${f(rose.y + Math.sin(a1) * r0)} Z`}
                fill={col}
                opacity="0.45"
              />
            );
          })}
          <path d={tracery} stroke={INK} strokeWidth="1.6" />
          {petals}
          {/* the hollow at the heart of the rose: its centre is simply gone */}
          <circle cx={rose.x} cy={rose.y} r="17" fill={url("void")} stroke={INK} strokeWidth="1.8" />
          <path d={`M${rose.x - 12} ${rose.y - 20} l5 6 l-3 4 M${rose.x + 16} ${rose.y + 8} l-5 1 l-1 5`} stroke={INK} strokeWidth="1.1" fill="none" />
        </g>
        <circle cx={rose.x} cy={rose.y} r={rose.r} fill={GLOW.violet} opacity="0.25" filter="url(#glow-soft)" />
        {/* two lancets under the rose */}
        <g filter="url(#wc)">
          {[-26, 26].map((dx) => (
            <g key={dx}>
              <path d={`M${rose.x + dx - 9} ${fy(BACK) - 12} V${rose.y + 74} ${pointed(rose.x + dx - 9, rose.x + dx + 9, rose.y + 74, rose.y + 60)} V${fy(BACK) - 12} Z`} fill={P.violet[2]} stroke={INK} strokeWidth="1.4" />
              <path d={`M${rose.x + dx} ${rose.y + 62} V${fy(BACK) - 12}`} stroke={INK} strokeWidth="0.8" />
            </g>
          ))}
        </g>
        <g filter="url(#glow)" opacity="0.6">
          <rect x={rose.x - 33} y={rose.y + 70} width="12" height="30" fill={GLOW.violet} />
          <rect x={rose.x + 21} y={rose.y + 70} width="12" height="30" fill={GLOW.violet} />
        </g>
      </Layer>

      {/* ---------- layer 1: floor, light pools, the empty dais ---------- */}
      <Layer n={1}>
        <rect x="-20" y={fy(BACK) - 1} width="580" height="700" fill={url("floor")} />
        <g clipPath={url("floorClip")} filter="url(#wc)">
          {STONES.map((s, i) => {
            const b = busy(s.cx, s.cy);
            const fade = Math.min(1, Math.max(0, (s.depth - 0.04) / 0.2));
            return (
              <path
                key={i}
                d={s.d}
                fill={s.shade < 0 ? INK : "#8e89b0"}
                fillOpacity={(Math.abs(s.shade) * (s.shade < 0 ? 0.25 : 0.08) * (0.5 + b) * fade).toFixed(3)}
                stroke="#0b0b12"
                strokeOpacity={((0.25 + 0.5 * b) * (0.2 + 0.8 * fade)).toFixed(3)}
                strokeWidth={(0.5 + Math.min(1, s.depth * 2) * 1.1).toFixed(2)}
                strokeDasharray={s.dash}
                strokeLinecap="round"
              />
            );
          })}
        </g>
        <g stroke="#0b0b12" fill="none" filter="url(#wc)">
          {FAR_LINES.map((l, i) => (
            <path key={i} d={l.d} strokeWidth="0.6" opacity="0.35" />
          ))}
        </g>
        <g filter="url(#wc-wash)">
          <path d="M-20 430 Q40 420 90 450 Q60 480 -20 476 Z M450 470 Q500 456 560 466 L560 520 Q490 510 450 470 Z M-20 560 Q60 540 120 580 Q50 610 -20 600 Z" fill="#07070c" opacity="0.4" />
          <path d="M120 460 Q150 452 176 462 Q150 470 120 460 Z M380 540 Q420 530 452 544 Q420 552 380 540 Z" fill="#b0a8d8" opacity="0.12" />
        </g>
        <g filter="url(#wc)" strokeLinejoin="round" stroke={INK} strokeWidth="1.2">
          <path d="M70 520 L84 512 L96 518 L90 526 Z M470 430 L480 424 L490 428 L486 434 Z M506 580 L520 570 L536 576 L530 588 Z" fill={P.slate[2]} />
          <path d="M40 470 L60 480 L58 494 L76 504 M488 560 L500 548 L520 552" fill="none" opacity="0.7" />
        </g>
        {/* violet light pouring from the rose onto the floor */}
        <ellipse cx="250" cy="400" rx="130" ry="40" fill={url("pool")} />
        {/* the rose's colours thrown across the floor */}
        <g filter="url(#glow-soft)" opacity="0.5">
          <ellipse cx="246" cy="404" rx="86" ry="20" fill="none" stroke={P.sapphire[3]} strokeWidth="7" />
          <ellipse cx="246" cy="404" rx="62" ry="14" fill="none" stroke={P.oxblood[3]} strokeWidth="6" />
          <ellipse cx="246" cy="404" rx="36" ry="8" fill="none" stroke={GLOW.violet} strokeWidth="6" />
          <ellipse cx="246" cy="404" rx="14" ry="3" fill="#000" />
        </g>
        <g filter="url(#wc-wash)" fill="#8c83b8" opacity="0.14">
          <path d="M-20 350 Q120 336 270 346 Q420 356 560 342 L560 364 Q400 376 260 366 Q100 358 -20 372 Z" />
        </g>
        <ellipse cx="270" cy="330" rx="60" ry="10" fill={url("pool")} />
        {/* the dais where something should be */}
        <g filter="url(#wc)" strokeLinejoin="round">
          <ellipse cx="270" cy="336" rx="52" ry="8" fill={GLOW.violet} opacity="0.25" filter="url(#glow-soft)" />
          <ellipse cx="270" cy="334" rx="46" ry="7" fill="none" stroke={GLOW.violet} strokeWidth="1.2" strokeDasharray="3 4" opacity="0.8" />
          <path d="M246 332 L248 322 L292 322 L294 332 Z" fill={P.slate[2]} stroke={INK} strokeWidth="1.3" />
          <path d="M252 322 L254 314 L286 314 L288 322 Z" fill={P.slate[3]} stroke={INK} strokeWidth="1.2" />
          <ellipse cx="270" cy="314" rx="16" ry="2.4" fill={url("void")} stroke={INK} strokeWidth="1" />
          {/* cut chains lying slack */}
          <path d="M254 318 q-10 4 -14 14 M286 318 q10 5 12 15" stroke={P.steel[2]} strokeWidth="1.4" fill="none" strokeDasharray="2.2 1.2" />
        </g>
        <g filter="url(#glow)">
          <circle cx="232" cy="330" r="1.6" fill={GLOW.rune} />
          <circle cx="310" cy="331" r="1.6" fill={GLOW.rune} />
          <path d="M232 331 v6 M310 332 v6" stroke={P.bone[3]} strokeWidth="1.6" />
        </g>
      </Layer>

      {/* ---------- layer 2: arcades, vault ribs, banners ---------- */}
      <Layer n={2}>
        <g filter="url(#wc)">
          {side(-1)}
          {side(1)}
          {ribs}
        </g>
        {/* violet beams from the rose */}
        <g filter="url(#glow-soft)">
          <path d={`M${rose.x - 44} ${rose.y} L${rose.x + 40} ${rose.y + 10} L340 420 L150 420 Z`} fill={url("beam")} opacity="0.8" />
          <path d={`M${rose.x - 10} ${rose.y} L${rose.x + 10} ${rose.y} L290 410 L210 410 Z`} fill={url("beam")} opacity="0.7" />
        </g>
        {banner(xAt(-(WALL_X - PIER_W), 2) + 14, sy(2) + 10, 24, 120, P.oxblood[2], P.oxblood[0], 1)}
        {banner(xAt(WALL_X - PIER_W, 2) - 14, sy(2) + 10, 24, 120, P.violet[2], P.violet[0], 1)}
        {banner(xAt(-(WALL_X - PIER_W), 2.8) + 9, sy(2.8) + 8, 16, 84, P.violet[2], P.violet[0], 0.7)}
        {banner(xAt(WALL_X - PIER_W, 2.8) - 9, sy(2.8) + 8, 16, 84, P.oxblood[2], P.oxblood[0], 0.7)}
        {banner(xAt(-(WALL_X - PIER_W), 4) + 6, sy(4) + 6, 10, 56, P.oxblood[2], P.oxblood[0], 0.5)}
        {banner(xAt(WALL_X - PIER_W, 4) - 6, sy(4) + 6, 10, 56, P.violet[2], P.violet[0], 0.5)}
        {/* wall sconces */}
        {[2, 2.8].map((z) =>
          [-1, 1].map((sd) => {
            const x = xAt(sd * (WALL_X - PIER_W), z) - sd * 2;
            const y = HZ - 60 / z;
            return (
              <g key={`${z}${sd}`}>
                <circle cx={x} cy={y} r={14 / z + 6} fill={P.gold[3]} opacity="0.35" filter="url(#glow-soft)" />
                <path d={`M${x} ${y + 2} v${10 / z}`} stroke={INK} strokeWidth="1.4" />
                <path d={`M${x - 2} ${y + 2} q2 -${9 / z + 3} 4 0 Z`} fill={P.gold[4]} filter="url(#glow)" />
              </g>
            );
          }),
        )}
      </Layer>

      {/* ---------- layer 3: foreground banner, pillar, rubble ---------- */}
      <Layer n={3}>
        <g filter="url(#wc)">
          <path d="M-24 -10 H64 V300 L50 290 L40 330 L26 296 L12 344 L0 300 L-24 320 Z" fill={P.oxblood[1]} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
          <path d="M20 -10 V300 L26 296 L40 330 L50 290 L64 300 V-10 Z" fill={P.oxblood[0]} opacity="0.5" />
          <path d="M-20 60 H60 M-20 66 H60" stroke={P.gold[2]} strokeWidth="1.6" />
          <circle cx="22" cy="140" r="22" fill="none" stroke={P.gold[3]} strokeWidth="2.2" />
          <path d="M22 104 V176" stroke={P.gold[3]} strokeWidth="1.8" />
          <path d="M58 0 V296" stroke={P.oxblood[3]} strokeWidth="1.4" opacity="0.6" />
          <path d="M526 -20 L526 700 L560 700 L560 -20 Z" fill={url("pierR")} stroke={INK} strokeWidth="2.8" />
          <path d="M534 -20 V700 M546 -20 V700" stroke={INK} strokeWidth="1.1" opacity="0.5" />
          <path d="M527 -20 V700" stroke={P.violet[3]} strokeWidth="1.4" opacity="0.5" />
          <path d="M514 690 H570 V720 H514 Z" fill={P.slate[2]} stroke={INK} strokeWidth="2.2" />
          <ellipse cx="530" cy="724" rx="50" ry="8" fill={INK} opacity="0.5" filter="url(#wc-wash)" />
          <path d="M-24 820 L10 800 L44 812 L60 846 L50 900 L-24 900 Z M380 850 L410 830 L446 840 L450 870 L396 876 Z" fill={P.slate[1]} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M10 800 L44 812 M410 830 L446 840" stroke={P.violet[3]} strokeWidth="1.2" opacity="0.5" />
        </g>
      </Layer>

      {/* ---------- layer 4: motes in the violet light ---------- */}
      <Layer n={4}>
        <g filter="url(#glow)">
          {DUST.map((d, i) => {
            const b = busy(d.x, d.y);
            if (b < 0.3 && d.t < 0.7) return null;
            return <circle key={i} cx={d.x.toFixed(1)} cy={d.y.toFixed(1)} r={(0.5 + d.s * 1.4).toFixed(2)} fill={d.t > 0.8 ? GLOW.rune : GLOW.violet} opacity={(0.3 + d.t * 0.5).toFixed(2)} />;
          })}
        </g>
      </Layer>

      <Atmosphere light={{ x: 540, y: 428, color: "#cfdcff" }} rays={{ n: 7, spread: 0.85, length: 1500, seed: 9 }} haze={{ y: 610, color: "#8e93a6", opacity: 0.2 }} />
      <rect width="1080" height="1920" fill={url("vig")} />
      <rect width="1080" height="1920" fill={url("bands")} />
      <g transform="scale(2)">
        <rect width="540" height="960" filter="url(#grain)" opacity="0.18" />
      </g>
    </svg>
  );
}
