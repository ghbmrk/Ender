import { useId } from "react";
import { INK, P, GLOW } from "../palette";
import type { FigureMeta, FigureProps } from "../types";

export const meta: FigureMeta = { id: "swarm", viewBox: [0, 0, 200, 220], feet: { x: 100, y: 208 }, head: [48, 56, 104, 104], facing: "left" };

type MothSpec = { x: number; y: number; rot: number; s: number; flap: number; depth: number };

const CX = 100;
const CY = 106;

/* idle: moths circling a vortex (counter-clockwise), back ones smaller */
function ring(): MothSpec[] {
  const out: MothSpec[] = [];
  const n = 10;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2 + 0.35 + (i % 3) * 0.12;
    const rx = 64 - (i % 2) * 10;
    const ry = 44 - (i % 3) * 5;
    const x = CX + rx * Math.cos(t);
    const y = CY + ry * Math.sin(t) - 4 * Math.cos(t * 2);
    const vx = rx * Math.sin(t);
    const vy = -ry * Math.cos(t);
    const depth = (Math.sin(t) + 1) / 2; // 0 = back, 1 = front
    out.push({ x, y, rot: (Math.atan2(vx, -vy) * 180) / Math.PI, s: 1.05 + depth * 0.55, flap: 0.55 + ((i * 37) % 10) / 22, depth });
  }
  out.push({ x: CX - 12, y: CY - 10, rot: -120, s: 1.1, flap: 0.8, depth: 0.5 });
  return out.sort((a, b) => a.depth - b.depth);
}

/* strike: the swarm drawn into a stinging stream toward the left */
function stream(): MothSpec[] {
  const out: MothSpec[] = [];
  const n = 10;
  const p0: [number, number] = [190, 150], p1: [number, number] = [118, 56], p2: [number, number] = [22, 104];
  for (let i = 0; i < n; i++) {
    const t = Math.pow(i / (n - 1), 1.3);
    const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
    const jitter = ((i * 53) % 11) - 5;
    const dx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
    const dy = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
    const len = Math.hypot(dx, dy) || 1;
    const off = (i % 2 ? 1 : -1) * (5 + (i % 3) * 4) * (1 - t * 0.6);
    const x = a * p0[0] + b * p1[0] + c * p2[0] + (-dy / len) * off;
    const y = a * p0[1] + b * p1[1] + c * p2[1] + (dx / len) * off;
    out.push({ x, y, rot: (Math.atan2(dx, -dy) * 180) / Math.PI + jitter * 2, s: 0.6 + t * 0.75, flap: 0.45 + ((i * 29) % 10) / 20, depth: t });
  }
  return out;
}

/** The Swarm: a glittering host of gilded moths with ember eye-spots, circling a faint vortex of light. */
export default function Swarm({ viewBox, className, pose = "idle" }: FigureProps) {
  const u = useId().replace(/:/g, "");
  const id = (s: string) => `${u}-${s}`;
  const url = (s: string) => `url(#${id(s)})`;
  const strike = pose === "strike";
  const moths = strike ? stream() : ring();

  const wing = (
    <g>
      {/* hind wing */}
      <path d="M-1.5 1 C-7 0 -13 3 -13.5 8.5 C-13 13 -6 12.5 -1.5 5 Z" fill={url("hind")} strokeWidth="1" />
      {/* fore wing */}
      <path d="M-1.5 -4 C-5 -10 -14 -15 -21 -14 C-20.5 -8 -16 -2 -10 1 C-6 2 -3 1.5 -1.5 1 Z" fill={url("fore")} strokeWidth="1.1" />
      {/* veins */}
      <path d="M-2 -2 C-8 -7 -13 -11 -18 -13 M-2 0 C-8 -3 -13 -5 -18 -8 M-2 3 C-6 5 -9 7 -11 9" fill="none" stroke={P.gold[1]} strokeWidth="0.5" opacity="0.8" />
      {/* dark wing-tip band */}
      <path d="M-21 -14 C-20.5 -8 -18 -5 -15 -2.5 C-15 -7 -16 -11 -17.5 -13.8 Z" fill={P.ember[1]} stroke="none" opacity="0.75" />
      {/* leading-edge light */}
      <path d="M-3 -6 C-8 -11 -13 -14 -18 -14" fill="none" stroke="#fff6da" strokeWidth="0.8" opacity="0.9" />
      {/* eye-spot */}
      <circle cx="-10.5" cy="-6.5" r="3" fill={P.oxblood[1]} strokeWidth="0.5" />
      <circle cx="-10.5" cy="-6.5" r="1.9" fill={P.ember[3]} stroke="none" />
      <circle cx="-10.4" cy="-6.6" r="0.9" fill={INK} stroke="none" />
    </g>
  );

  const moth = (m: MothSpec, i: number) => (
    <g key={i} transform={`translate(${m.x.toFixed(1)} ${m.y.toFixed(1)}) rotate(${m.rot.toFixed(1)}) scale(${m.s.toFixed(2)})`} opacity={0.72 + m.depth * 0.28}>
      <g transform={`scale(${m.flap.toFixed(2)} 1)`}>{wing}</g>
      <g transform={`scale(${(-m.flap).toFixed(2)} 1)`}>{wing}</g>
      {/* antennae */}
      <path d="M-0.8 -6 C-2 -9 -4 -11 -6 -11.5 M0.8 -6 C2 -9 4 -11 6 -11.5" fill="none" stroke={P.gold[1]} strokeWidth="0.8" />
      {/* furred body */}
      <ellipse cx="0" cy="1.5" rx="2.6" ry="7" fill={url("body")} strokeWidth="0.9" />
      <circle cx="0" cy="-5.5" r="2.1" fill={P.gold[3]} strokeWidth="0.8" />
    </g>
  );

  return (
    <svg viewBox={viewBox ?? meta.viewBox.join(" ")} className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={id("fore")} gradientUnits="userSpaceOnUse" cx="0" cy="-2" r="20">
          <stop offset="0" stopColor="#fff3cc" />
          <stop offset="0.3" stopColor={P.gold[4]} />
          <stop offset="0.65" stopColor={P.gold[3]} />
          <stop offset="1" stopColor={P.gold[2]} />
        </radialGradient>
        <radialGradient id={id("hind")} gradientUnits="userSpaceOnUse" cx="0" cy="2" r="14">
          <stop offset="0" stopColor={P.gold[3]} />
          <stop offset="0.55" stopColor={P.ember[3]} />
          <stop offset="1" stopColor={P.ember[2]} />
        </radialGradient>
        <linearGradient id={id("body")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff6da" />
          <stop offset="1" stopColor={P.gold[2]} />
        </linearGradient>
        <radialGradient id={id("core")}>
          <stop offset="0" stopColor="#fff2c8" stopOpacity="0.95" />
          <stop offset="0.3" stopColor={GLOW.rune} stopOpacity="0.6" />
          <stop offset="1" stopColor={P.ember[2]} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ground shadow with a faint warm cast */}
      <ellipse cx="100" cy="208" rx={strike ? 56 : 40} ry="5" fill={INK} opacity="0.22" filter="url(#wc-wash)" />
      <ellipse cx="100" cy="206" rx="28" ry="4" fill={P.ember[3]} opacity="0.25" filter="url(#glow-soft)" />

      {strike ? (
        <g>
          {/* stinging stream of light */}
          <path d="M190 150 Q118 56 22 104" fill="none" stroke={GLOW.rune} strokeWidth="18" opacity="0.28" filter="url(#glow-soft)" />
          <g fill="none" strokeLinecap="round" stroke={P.gold[3]} opacity="0.7">
            <path d="M194 160 Q124 66 34 98" strokeWidth="1.3" strokeDasharray="10 7" />
            <path d="M184 140 Q112 46 26 112" strokeWidth="1" strokeDasharray="6 9" />
          </g>
          <circle cx="10" cy="104" r="14" fill={url("core")} />
          <g stroke={GLOW.ember} strokeWidth="1.4" strokeLinecap="round">
            <path d="M4 102 L-6 98 M6 108 L-2 114 M6 96 L-2 88" />
          </g>
        </g>
      ) : (
        <g>
          {/* the vortex: a dusky whirl with light at its eye */}
          <ellipse cx={CX} cy={CY} rx="58" ry="40" fill={P.violet[0]} opacity="0.28" filter="url(#wc-wash)" />
          <circle cx={CX} cy={CY} r="34" fill={url("core")} opacity="0.55" filter="url(#glow-soft)" />
          <g fill="none" stroke={P.gold[3]} strokeLinecap="round" opacity="0.55">
            <path d="M100 76 C128 78 140 96 132 112 C124 128 96 132 82 120 C70 110 76 94 92 92 C106 90 114 102 106 110" strokeWidth="1.4" />
            <path d="M60 110 C58 84 84 66 112 70 C140 74 160 96 150 122" strokeWidth="1" strokeDasharray="8 6" />
            <path d="M150 104 C152 130 126 148 98 146 C72 144 50 128 52 102" strokeWidth="1" strokeDasharray="5 8" />
          </g>
          <circle cx={CX + 2} cy={CY + 4} r="3.5" fill="#fff6da" filter="url(#glow)" />
        </g>
      )}

      <g filter="url(#wc)" stroke={INK} strokeLinejoin="round" strokeLinecap="round">
        {moths.map(moth)}
      </g>

      {/* glow of the moth bodies */}
      <g fill="#fff0c0" filter="url(#glow)" opacity="0.8">
        {moths.map((m, i) => (
          <ellipse key={i} cx={m.x.toFixed(1)} cy={m.y.toFixed(1)} rx={(1.2 * m.s).toFixed(1)} ry={(1.2 * m.s).toFixed(1)} />
        ))}
      </g>
      {/* drifting gold dust */}
      <g fill={P.gold[4]}>
        {(strike
          ? [[40, 96, 1.2], [70, 78, 1], [120, 72, 1.3], [150, 96, 0.9], [26, 120, 1.1], [96, 90, 0.8]]
          : [[60, 70, 1.1], [142, 76, 1.3], [150, 140, 1], [58, 146, 1.2], [100, 160, 0.9], [122, 58, 0.8], [80, 60, 1]]
        ).map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} opacity="0.85" />
        ))}
      </g>
    </svg>
  );
}
