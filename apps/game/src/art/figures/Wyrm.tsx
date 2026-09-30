import { useId } from "react";
import { INK, P, GLOW } from "../palette";
import type { FigureMeta, FigureProps } from "../types";

export const meta: FigureMeta = { id: "wyrm", viewBox: [0, 0, 400, 360], feet: { x: 210, y: 318 }, head: [40, 36, 118, 118], facing: "left" };

/** Glass shards sprayed from the jaws on the strike: [x, y, rotation, size]. */
const SHARDS: [number, number, number, number][] = [
  [26, 162, -20, 1.4], [10, 190, 30, 1.1], [38, 200, 70, 1.2], [14, 140, 10, 1], [56, 216, -40, 0.9], [8, 222, 50, 0.9], [32, 126, -60, 0.8], [22, 176, 20, 1.3],
];

/** The Fen Wyrm: a sea-glass serpent dragon coiled out of black water, throat aglow, jaws set with crystal teeth. */
export default function Wyrm({ viewBox, className, pose = "idle" }: FigureProps) {
  const u = useId().replace(/:/g, "");
  const id = (s: string) => `${u}-${s}`;
  const url = (s: string) => `url(#${id(s)})`;
  const strike = pose === "strike";
  const headS = "translate(140 100) scale(1.15) translate(-140 -100)";
  const headT = strike ? `translate(-8 44) rotate(10 140 100) ${headS}` : headS;
  const neck2 = strike ? "M206 160 C200 150 170 150 132 150" : "M206 160 C194 120 160 100 128 102";
  const jawT = strike ? "rotate(-30 136 112)" : "rotate(-3 136 112)";

  /** A shaded, scaled tube along a centre-line. */
  const tube = (d: string, w: number, k: string) => (
    <g key={k} fill="none" strokeLinecap="round">
      <path d={d} stroke={INK} strokeWidth={w + 5} />
      <path d={d} stroke={url("glass")} strokeWidth={w} />
      <path d={d} stroke={url("scales")} strokeWidth={w} opacity="0.9" />
      <path d={d} stroke={P.verdigris[0]} strokeWidth={w * 0.42} opacity="0.5" transform={`translate(${w * 0.22} ${w * 0.2})`} />
      <path d={d} stroke={P.verdigris[4]} strokeWidth={w * 0.26} opacity="0.35" transform={`translate(${-w * 0.2} ${-w * 0.18})`} />
      <path d={d} stroke={P.violet[3]} strokeWidth={w * 0.12} opacity="0.35" transform={`translate(${-w * 0.05} ${-w * 0.3})`} />
    </g>
  );
  return (
    <svg viewBox={viewBox ?? meta.viewBox.join(" ")} className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id("glass")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.verdigris[3]} />
          <stop offset="0.5" stopColor={P.verdigris[2]} />
          <stop offset="1" stopColor={P.verdigris[1]} />
        </linearGradient>
        <pattern id={id("scales")} width="15" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(24)">
          <path d="M0 6.5 L7.5 0 L15 6.5 L7.5 13 Z" fill={P.verdigris[2]} stroke={P.gold[3]} strokeWidth="0.9" />
          <path d="M7.5 0 L15 6.5 L7.5 6.5 Z" fill={P.violet[3]} opacity="0.55" />
          <path d="M0 6.5 L7.5 13 L7.5 6.5 Z" fill={P.verdigris[0]} opacity="0.45" />
          <path d="M3 5.5 L7 2" stroke={P.verdigris[4]} strokeWidth="1" />
        </pattern>
        <linearGradient id={id("head")} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor={P.verdigris[3]} />
          <stop offset="0.55" stopColor={P.verdigris[2]} />
          <stop offset="1" stopColor={P.verdigris[0]} />
        </linearGradient>
        <linearGradient id={id("fin")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.violet[3]} />
          <stop offset="0.5" stopColor={P.verdigris[2]} />
          <stop offset="1" stopColor={P.verdigris[0]} />
        </linearGradient>
        <linearGradient id={id("water")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.verdigris[1]} />
          <stop offset="0.5" stopColor={P.sapphire[0]} />
          <stop offset="1" stopColor={P.slate[0]} />
        </linearGradient>
        <linearGradient id={id("gold")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.gold[4]} />
          <stop offset="1" stopColor={P.gold[1]} />
        </linearGradient>
        <radialGradient id={id("maw")}>
          <stop offset="0" stopColor="#fffbe6" />
          <stop offset="0.35" stopColor={GLOW.rune} />
          <stop offset="0.7" stopColor={GLOW.ember} stopOpacity="0.6" />
          <stop offset="1" stopColor={P.ember[2]} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ground/water shadow */}
      <ellipse cx="210" cy="318" rx="180" ry="16" fill={INK} opacity="0.3" filter="url(#wc-wash)" />

      <g filter="url(#wc)" stroke={INK} strokeLinejoin="round" strokeLinecap="round">
        {/* far coil arching out of the water, with a tail fin */}
        {tube("M372 312 C380 226 290 214 270 312", 40, "coil1")}
        <path d="M352 236 L366 206 L368 232 L384 214 L380 246 Z" fill={url("fin")} strokeWidth="1.8" />
        <path d="M300 238 L296 210 L312 230 L318 204 L326 232 Z" fill={url("fin")} strokeWidth="1.8" />
        {/* near coil */}
        {tube("M262 318 C256 256 208 252 206 290", 42, "coil2")}
        <path d="M244 258 L252 232 L256 254 L270 238 L266 266 Z" fill={url("fin")} strokeWidth="1.8" />

        {/* neck: lower (thick) and upper (tapered) */}
        {tube("M176 320 C156 262 224 214 206 160", 54, "neck1")}
        {tube(neck2, 42, "neck2")}

        {/* dorsal fin-crest down the back of the neck */}
        <path d={strike ? "M226 150 L246 128 L238 162 L254 150 L240 188 L256 184 L236 222 L218 214 L220 170 Z" : "M226 150 L246 124 L238 160 L256 148 L240 188 L258 184 L236 222 L218 214 L220 170 Z"} fill={url("fin")} strokeWidth="2" />
        <path d="M228 160 L244 132 M230 180 L252 154 M228 204 L254 188" fill="none" stroke={P.gold[3]} strokeWidth="1.3" />

        {/* glowing throat: belly plates lit from within */}
        <path d="M164 300 C146 262 192 226 186 176" fill="none" stroke={P.gold[2]} strokeWidth="18" opacity="0.95" transform="translate(-8 0)" />
        <path d="M164 300 C146 262 192 226 186 176" fill="none" stroke={GLOW.rune} strokeWidth="8" opacity="0.9" transform="translate(-9 0)" />
        <path d="M164 300 C146 262 192 226 186 176" fill="none" stroke={P.gold[0]} strokeWidth="18" strokeDasharray="1.2 9" opacity="0.5" transform="translate(-8 0)" strokeLinecap="butt" />

        {/* ---------- head ---------- */}
        <g transform={headT}>
          {/* swept frill behind the skull */}
          <path d="M128 78 L150 38 L158 68 L182 44 L178 80 L204 72 L184 104 L150 108 Z" fill={url("fin")} strokeWidth="2.2" />
          <path d="M140 76 L150 44 M156 80 L178 50 M166 94 L198 76" fill="none" stroke={P.gold[3]} strokeWidth="1.4" />

          {/* lower jaw (hinged) */}
          <g transform={jawT}>
            <path d="M138 110 C126 118 104 122 80 120 C62 120 46 118 38 114 C36 120 42 128 54 130 C80 134 110 134 130 128 C140 124 144 116 138 110 Z" fill={url("head")} strokeWidth="2.4" />
            <path d="M54 130 C80 134 110 134 130 128" fill="none" stroke={P.gold[2]} strokeWidth="2" />
            {/* crystal teeth, pointing up */}
            <path d="M46 116 L49 107 L52 117 Z M60 118 L63 108 L66 119 Z M74 119 L77 110 L80 120 Z M88 120 L91 112 L94 120 Z M102 120 L104 113 L107 120 Z" fill={P.spirit[4]} strokeWidth="1" />
            {strike && <path d="M44 118 C70 124 110 124 134 116" fill="none" stroke={P.oxblood[2]} strokeWidth="5" opacity="0.8" />}
          </g>

          {/* mouth glow when open */}
          {strike && <ellipse cx="86" cy="122" rx="40" ry="14" fill={url("maw")} stroke="none" />}

          {/* upper head: long snout */}
          <path d="M146 82 C136 66 112 62 94 70 C78 76 58 84 38 92 C28 96 26 104 32 110 C54 112 84 112 108 112 C124 116 138 116 146 108 C152 100 152 90 146 82 Z" fill={url("head")} strokeWidth="2.6" />
          <path d="M146 82 C136 66 112 62 94 70 C78 76 58 84 38 92 C28 96 26 104 32 110 L60 111 C60 100 72 90 94 84 C112 78 132 78 146 82 Z" fill={url("scales")} stroke="none" opacity="0.55" />
          <path d="M108 112 C124 116 138 116 146 108 C152 100 152 90 146 82 C140 96 128 104 108 104 Z" fill={P.verdigris[0]} stroke="none" opacity="0.5" />
          {/* upper teeth, pointing down */}
          <path d="M40 108 L43 117 L46 109 Z M54 110 L57 119 L60 110 Z M68 110 L71 120 L74 111 Z M82 111 L85 121 L88 111 Z M96 111 L98 119 L101 111 Z" fill={P.spirit[4]} strokeWidth="1" />
          {/* lit ridge of the snout, nostril, gold edge-plates */}
          <path d="M40 91 C60 84 78 76 96 70" fill="none" stroke={P.verdigris[4]} strokeWidth="1.8" opacity="0.9" />
          <path d="M40 96 C42 94 46 94 46 97" fill="none" strokeWidth="1.4" />
          <path d="M60 88 L66 84 L70 90 M76 82 L82 78 L86 84" fill="none" stroke={P.gold[3]} strokeWidth="1.4" />
          {/* brow horn */}
          <path d="M112 72 C120 58 134 50 150 48 C140 56 132 66 128 76 Z" fill={P.spirit[4]} strokeWidth="1.8" />
          <path d="M118 68 C126 60 136 54 146 51" fill="none" stroke={P.violet[3]} strokeWidth="1.1" />
          {/* eye socket */}
          <path d="M100 82 C104 76 116 76 120 82 C116 88 104 88 100 82 Z" fill="#08201e" strokeWidth="1.6" />
          <path d="M98 78 C104 72 116 72 122 78" fill="none" stroke={P.gold[2]} strokeWidth="1.6" />
        </g>

        {/* water surface in front of the coils */}
        <path d="M4 306 C60 294 130 304 190 299 C250 294 330 302 398 300 C404 324 384 346 300 350 C220 356 110 354 50 346 C14 340 0 324 4 306 Z" fill={url("water")} strokeWidth="2.2" opacity="0.92" />
        <path d="M150 306 C166 300 196 300 212 306 M244 308 C254 302 276 302 286 308 M356 308 C364 302 384 302 392 306 M30 314 C60 310 90 312 110 316" fill="none" stroke={P.verdigris[4]} strokeWidth="1.8" opacity="0.8" />
        <path d="M146 300 C140 290 150 284 156 292 M212 298 C220 288 232 290 228 300 M258 302 C262 294 272 294 274 302" fill="none" stroke={P.verdigris[4]} strokeWidth="1.6" />
        <path d="M140 322 C180 316 220 318 250 324 M280 330 C310 324 350 326 380 330 M20 334 C50 330 80 332 100 336" fill="none" stroke={P.verdigris[3]} strokeWidth="1.3" opacity="0.6" />
      </g>

      {/* glowing eye and throat (unfiltered focal points) */}
      <g transform={headT}>
        <ellipse cx="110" cy="82" rx="5.5" ry="3.2" fill={GLOW.rune} filter="url(#glow)" />
        <path d="M110 79.5 L110 84.5" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
        <ellipse cx="110" cy="82" rx="12" ry="7" fill={GLOW.ember} opacity="0.35" filter="url(#glow-soft)" />
      </g>
      <path d="M156 300 C138 262 184 226 178 176" fill="none" stroke={GLOW.ember} strokeWidth="16" opacity="0.4" filter="url(#glow-soft)" />
      {strike && (
        <g strokeLinejoin="round">
          <ellipse cx="40" cy="168" rx="46" ry="34" fill={GLOW.hex} opacity="0.3" filter="url(#glow-soft)" />
          <path d="M58 160 L4 146 M60 168 L6 182 M58 176 L22 212 M58 152 L24 122" fill="none" stroke={P.spirit[4]} strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
          {SHARDS.map(([x, y, r, s], i) => (
            <path key={i} d="M0 -7 L4 2 L0 7 L-3 1 Z" transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`} fill={i % 2 ? P.verdigris[4] : P.violet[4]} stroke={P.gold[2]} strokeWidth="1" filter="url(#glow)" />
          ))}
        </g>
      )}
    </svg>
  );
}
