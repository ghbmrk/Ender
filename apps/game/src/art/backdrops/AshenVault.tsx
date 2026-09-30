import { useId, type ReactNode } from "react";
import { INK, P, GLOW } from "../palette";
import { flagstones, scatter, busy, farLines } from "./paint";
import { Atmosphere } from "./Atmosphere";

/*
 * Authored in a 540x960 space, scaled x2 into the 1080x1920 viewBox so the shared watercolor filters
 * keep their brush scale. Each parallax layer is <g data-layer=n> (0 farthest) and overdraws 20 units
 * (40 px) past the left and right edges.
 */

/** Umber stone ramp for the vault (warmer and darker than P.stone). */
const U = ["#140b08", "#24150f", "#3a2418", "#5a3824", "#8a5a38", "#c08a58"] as const;

const HZ = 286;
const STONES = flagstones({ vpX: 270, horizon: HZ, bottom: 990, tile: 150, z0: 5, aspect: 0.8, seed: 31, minRow: 1.1, width: 540 });
const FAR_LINES = farLines(8, HZ + 2, 345, 9);
const CINDERS = scatter(110, 5, -20, 60, 580, 700);
const COURSES = [128, 152, 176, 200, 224, 248, 272];
const NICHES = [0, 1, 2, 3, 4];

function Layer({ n, children }: { n: number; children: ReactNode }) {
  return (
    <g data-layer={n}>
      <g transform="scale(2)">{children}</g>
    </g>
  );
}

/** Ashen Vault: collapsed reliquaries under a broken arch, braziers and ember-lit cracks, cinders drifting up. */
export default function AshenVault({ className }: { className?: string }) {
  const u = useId().replace(/:/g, "");
  const id = (s: string) => `${u}-${s}`;
  const url = (s: string) => `url(#${id(s)})`;
  const brazier = (x: number, y: number, k: number) => (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <circle cx="0" cy="-30" r="46" fill={P.ember[3]} opacity="0.5" filter="url(#glow-soft)" />
      <g stroke={INK} strokeWidth="2.2" strokeLinecap="round" fill="none">
        <path d="M-10 -10 L-22 44 M10 -10 L22 44 M0 -8 L0 48" />
        <path d="M-15 18 H15" strokeWidth="1.3" />
      </g>
      <path d="M-22 -20 Q0 4 22 -20 Z" fill="#2a1a14" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M-19 -17 Q0 -1 19 -17" stroke={P.ember[3]} strokeWidth="1.1" fill="none" opacity="0.7" />
      <ellipse cx="0" cy="-20" rx="21" ry="4" fill={P.ember[3]} filter="url(#glow)" />
      <path d="M-15 -20 C-17 -32 -8 -38 -10 -50 C-2 -42 -4 -58 2 -68 C4 -54 12 -50 10 -40 C16 -44 17 -34 15 -20 Z" fill={url("flame")} filter="url(#glow)" />
      <path d="M-6 -20 C-8 -30 -2 -34 -2 -44 C4 -36 6 -30 6 -20 Z" fill="#fff6dc" opacity="0.9" />
    </g>
  );
  return (
    <svg viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2={HZ + 10} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0c0706" />
          <stop offset="0.45" stopColor="#1a0f0b" />
          <stop offset="0.9" stopColor="#5a2c14" />
          <stop offset="1" stopColor="#3a2014" />
        </linearGradient>
        <radialGradient id={id("far")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={P.ember[4]} stopOpacity="0.95" />
          <stop offset="0.25" stopColor={P.ember[3]} stopOpacity="0.7" />
          <stop offset="0.6" stopColor={P.ember[2]} stopOpacity="0.28" />
          <stop offset="1" stopColor={P.ember[1]} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("floor")} x1="0" y1={HZ} x2="0" y2="960" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6e3c1f" />
          <stop offset="0.15" stopColor="#4a2b1b" />
          <stop offset="0.45" stopColor="#2c1a12" />
          <stop offset="1" stopColor="#0e0806" />
        </linearGradient>
        <radialGradient id={id("pool")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={P.ember[3]} stopOpacity="0.3" />
          <stop offset="1" stopColor={P.ember[3]} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("pierL")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={U[1]} />
          <stop offset="0.6" stopColor={U[3]} />
          <stop offset="1" stopColor={U[4]} />
        </linearGradient>
        <linearGradient id={id("pierR")} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor={U[1]} />
          <stop offset="0.6" stopColor={U[2]} />
          <stop offset="1" stopColor={U[4]} />
        </linearGradient>
        <linearGradient id={id("col")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={U[0]} />
          <stop offset="0.45" stopColor={U[2]} />
          <stop offset="0.85" stopColor={U[4]} />
          <stop offset="1" stopColor={U[3]} />
        </linearGradient>
        <linearGradient id={id("colR")} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor={U[0]} />
          <stop offset="0.5" stopColor={U[2]} />
          <stop offset="0.9" stopColor={U[4]} />
          <stop offset="1" stopColor={U[3]} />
        </linearGradient>
        <linearGradient id={id("drum")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={U[4]} />
          <stop offset="0.35" stopColor={U[2]} />
          <stop offset="1" stopColor={U[0]} />
        </linearGradient>
        <linearGradient id={id("wallL")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1c100b" />
          <stop offset="1" stopColor="#3a2216" />
        </linearGradient>
        <linearGradient id={id("wallR")} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#1c100b" />
          <stop offset="1" stopColor="#3a2216" />
        </linearGradient>
        <radialGradient id={id("vig")} cx="0.5" cy="0.4" r="0.75">
          <stop offset="0.55" stopColor="#080404" stopOpacity="0" />
          <stop offset="1" stopColor="#080404" stopOpacity="0.8" />
        </radialGradient>
        <linearGradient id={id("bands")} x1="0" y1="0" x2="0" y2="1920" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#080505" stopOpacity="0.72" />
          <stop offset="0.06" stopColor="#080505" stopOpacity="0.3" />
          <stop offset="0.11" stopColor="#080505" stopOpacity="0" />
          <stop offset="0.64" stopColor="#080505" stopOpacity="0" />
          <stop offset="0.78" stopColor="#080505" stopOpacity="0.45" />
          <stop offset="1" stopColor="#080505" stopOpacity="0.8" />
        </linearGradient>
        <radialGradient id={id("flame")} cx="0.5" cy="0.8" r="0.7">
          <stop offset="0" stopColor="#fff4d8" />
          <stop offset="0.35" stopColor={P.gold[4]} />
          <stop offset="0.7" stopColor={P.ember[3]} />
          <stop offset="1" stopColor={P.ember[2]} />
        </radialGradient>
        <linearGradient id={id("inside")} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#fff2cc" />
          <stop offset="1" stopColor={P.ember[3]} />
        </linearGradient>
        <clipPath id={id("floorClip")}>
          <rect x="-20" y={HZ - 2} width="580" height="700" />
        </clipPath>
      </defs>

      {/* ---------- layer 0: cavern dark, far glow, far arcade ---------- */}
      <Layer n={0}>
        <rect x="-20" y="0" width="580" height={HZ + 10} fill={url("sky")} />
        <ellipse cx="270" cy="250" rx="280" ry="150" fill={url("far")} />
        <g fill="#4a2616" opacity="0.7" filter="url(#wc-wash)">
          <path d="M140 288 L143 196 L150 196 L153 288Z M200 288 L202 206 L209 202 L212 288Z M328 288 L330 200 L337 204 L339 288Z M388 288 L390 192 L397 192 L399 288Z" />
        </g>
        <g filter="url(#glow-soft)" opacity="0.75">
          <path d="M222 70 L262 70 L322 320 L236 320 Z" fill={P.ember[4]} opacity="0.3" />
          <path d="M280 70 L294 70 L372 300 L344 300 Z" fill={P.gold[4]} opacity="0.22" />
        </g>
        <g filter="url(#wc)">
          <path
            fillRule="evenodd"
            fill="#2e1a11"
            stroke={INK}
            strokeWidth="1.4"
            strokeLinejoin="round"
            d="M106 288 L106 196 L130 188 L146 196 L170 180 L192 190 L214 174 L230 184 L240 164 L252 174 L288 168 L300 180 L322 166 L350 184 L374 176 L400 190 L422 184 L434 196 L434 288 Z
               M136 288 L136 238 Q136 218 150 214 Q164 218 164 238 L164 288 Z
               M190 288 L190 240 Q190 220 204 216 Q218 220 218 240 L218 288 Z
               M246 288 L246 226 Q248 196 264 186 L272 196 L278 188 Q294 204 294 226 L294 288 Z
               M322 288 L322 240 Q322 220 336 216 Q350 220 350 240 L350 288 Z
               M376 288 L376 238 Q376 218 390 214 Q404 218 404 238 L404 288 Z"
          />
          <path d="M110 214 H132 M168 222 H186 M222 206 H242 M298 206 H318 M354 222 H372 M408 214 H430 M110 254 H132 M168 258 H186 M222 250 H242 M298 250 H318 M354 258 H372 M408 254 H430" stroke="#1a0e09" strokeWidth="1" opacity="0.8" />
          <path d="M164 240 V286 M218 242 V286 M294 228 V286 M350 242 V286 M404 240 V286" stroke={P.ember[3]} strokeWidth="1.2" opacity="0.55" />
        </g>
        <g filter="url(#glow-soft)" opacity="0.85">
          <path d="M248 288 L248 228 Q254 204 264 194 Q292 210 292 230 L292 288Z" fill={P.gold[4]} />
          <rect x="194" y="234" width="20" height="54" fill={P.ember[3]} />
          <rect x="326" y="234" width="20" height="54" fill={P.ember[3]} />
          <rect x="140" y="236" width="20" height="52" fill={P.ember[2]} />
          <rect x="380" y="236" width="20" height="52" fill={P.ember[2]} />
        </g>
        <path d="M248 288 L248 228 Q254 204 264 194 Q292 210 292 230 L292 288Z" fill={P.ember[4]} opacity="0.5" />
      </Layer>

      {/* ---------- layer 1: the floor and what lies on it ---------- */}
      <Layer n={1}>
        <rect x="-20" y={HZ - 2} width="580" height="700" fill={url("floor")} />
        <ellipse cx="270" cy="340" rx="300" ry="110" fill={url("pool")} />
        <g clipPath={url("floorClip")} filter="url(#wc)">
          {STONES.map((s, i) => {
            const b = busy(s.cx, s.cy);
            const tone = s.shade < 0 ? INK : "#c9905e";
            const fade = Math.min(1, Math.max(0, (s.depth - 0.05) / 0.2));
            return (
              <path
                key={i}
                d={s.d}
                fill={tone}
                fillOpacity={(Math.abs(s.shade) * (s.shade < 0 ? 0.22 : 0.1) * (0.5 + b) * fade).toFixed(3)}
                stroke="#120a07"
                strokeOpacity={((0.2 + 0.5 * b) * (0.2 + 0.8 * fade) * (0.5 + 0.5 * Math.min(1, s.depth * 2))).toFixed(3)}
                strokeWidth={(0.5 + Math.min(1, s.depth * 2) * 1.2).toFixed(2)}
                strokeDasharray={s.dash}
                strokeLinecap="round"
              />
            );
          })}
        </g>
        <g stroke="#120a07" fill="none" strokeLinecap="round" filter="url(#wc)">
          {FAR_LINES.map((l, i) => (
            <path key={i} d={l.d} strokeWidth={(0.5 + l.t * 0.6).toFixed(2)} opacity={(0.25 + l.t * 0.25).toFixed(2)} />
          ))}
        </g>
        <rect x="-20" y={HZ - 6} width="580" height="34" fill={P.ember[3]} opacity="0.14" filter="url(#glow-soft)" />
        <ellipse cx="150" cy="316" rx="60" ry="14" fill={P.ember[3]} opacity="0.3" filter="url(#glow-soft)" />
        <ellipse cx="390" cy="316" rx="60" ry="14" fill={P.ember[3]} opacity="0.3" filter="url(#glow-soft)" />
        <ellipse cx="40" cy="470" rx="70" ry="22" fill={P.ember[2]} opacity="0.18" filter="url(#glow-soft)" />
        <ellipse cx="510" cy="520" rx="70" ry="22" fill={P.ember[2]} opacity="0.18" filter="url(#glow-soft)" />
        {/* light spilling from the arches, ash drifts, contact shadows */}
        <g filter="url(#glow-soft)">
          <path d="M248 288 L292 288 L326 380 L214 380 Z" fill={P.ember[4]} opacity="0.26" />
          <path d="M194 288 L214 288 L196 330 L166 330 Z M326 288 L346 288 L374 330 L344 330 Z" fill={P.ember[3]} opacity="0.22" />
        </g>
        <g filter="url(#wc-wash)">
          <ellipse cx="270" cy="291" rx="170" ry="6" fill={INK} opacity="0.5" />
          <path d="M-20 380 Q30 368 70 390 Q30 406 -20 404 Z M470 420 Q510 408 560 414 L560 446 Q500 444 470 420 Z" fill="#8a6a52" opacity="0.2" />
        </g>
        {/* the reliquary, lid pushed aside, light pouring out */}
        <g filter="url(#wc)" strokeLinejoin="round">
          <ellipse cx="272" cy="320" rx="54" ry="7" fill={INK} opacity="0.55" filter="url(#wc-wash)" />
          <path d="M230 298 L310 300 L308 320 L232 318 Z" fill={U[3]} stroke={INK} strokeWidth="1.8" />
          <path d="M310 300 L320 293 L318 313 L308 320 Z" fill={U[1]} stroke={INK} strokeWidth="1.6" />
          <path d="M230 298 L242 291 L320 293 L310 300 Z" fill={url("inside")} />
          <path d="M236 305 H304 M238 314 H304" stroke={P.gold[2]} strokeWidth="1" opacity="0.8" />
          <circle cx="270" cy="309.5" r="3" fill="none" stroke={P.gold[3]} strokeWidth="1" />
          <path d="M210 292 L246 278 L288 282 L282 288 L248 286 L218 298 Z" fill={U[4]} stroke={INK} strokeWidth="1.6" />
          <path d="M218 296 L248 285 L282 287" stroke={P.ember[4]} strokeWidth="1" fill="none" opacity="0.7" />
        </g>
        <path d="M236 296 L230 200 L316 200 L320 296 Z" fill={P.gold[4]} opacity="0.16" filter="url(#glow-soft)" />
        <ellipse cx="276" cy="293" rx="40" ry="9" fill={P.gold[4]} opacity="0.6" filter="url(#glow-soft)" />
        {/* glowing cracks */}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M-20 452 L10 444 L24 454 L50 446 L64 458 M24 454 L30 472 L22 488" stroke={P.ember[2]} strokeWidth="3.4" filter="url(#glow)" opacity="0.9" />
          <path d="M-20 452 L10 444 L24 454 L50 446 L64 458 M24 454 L30 472 L22 488" stroke={P.gold[4]} strokeWidth="1" />
          <path d="M560 516 L530 524 L514 516 L492 528 L470 524 M514 516 L510 500 L520 488" stroke={P.ember[2]} strokeWidth="3.4" filter="url(#glow)" opacity="0.9" />
          <path d="M560 516 L530 524 L514 516 L492 528 L470 524 M514 516 L510 500 L520 488" stroke={P.gold[4]} strokeWidth="1" />
          <path d="M150 336 L166 332 L174 338 L190 334" stroke={P.ember[3]} strokeWidth="1.8" filter="url(#glow)" opacity="0.6" />
          <path d="M300 760 L330 752 L346 762 L380 756" stroke={P.ember[2]} strokeWidth="2.4" filter="url(#glow)" opacity="0.45" />
        </g>
        {/* scattered rubble */}
        <g filter="url(#wc)" strokeLinejoin="round">
          <path d="M120 306 L130 298 L142 302 L138 310 Z M196 300 L204 294 L214 298 L210 304 Z M350 302 L360 295 L370 300 L366 307 Z" fill={U[2]} stroke={INK} strokeWidth="1.2" />
          <ellipse cx="80" cy="366" rx="34" ry="5" fill={INK} opacity="0.5" />
          <path d="M52 358 L70 346 L102 350 L98 362 L62 366 Z" fill={U[2]} stroke={INK} strokeWidth="1.6" />
          <path d="M70 346 L102 350" stroke={P.ember[4]} strokeWidth="1" opacity="0.5" />
        </g>
      </Layer>

      {/* ---------- layer 2: the great broken arch, side walls of niches, braziers ---------- */}
      <Layer n={2}>
        <g filter="url(#wc)" strokeLinejoin="round">
          <path d="M-20 60 L64 100 L64 296 L-20 330 Z" fill={url("wallL")} stroke={INK} strokeWidth="1.8" />
          <path d="M560 60 L476 100 L476 296 L560 330 Z" fill={url("wallR")} stroke={INK} strokeWidth="1.8" />
          {NICHES.map((k) => {
            const y = 110 + k * 40;
            return (
              <g key={k}>
                <path d={`M-4 ${y + 34} L-4 ${y + 4} Q6 ${y - 10} 20 ${y - 6} L20 ${y + 36} Z M36 ${y + 30} L36 ${y + 8} Q43 ${y - 2} 52 ${y + 1} L52 ${y + 32} Z`} fill="#120a07" stroke={INK} strokeWidth="1.2" />
                <path d={`M544 ${y + 34} L544 ${y + 4} Q534 ${y - 10} 520 ${y - 6} L520 ${y + 36} Z M504 ${y + 30} L504 ${y + 8} Q497 ${y - 2} 488 ${y + 1} L488 ${y + 32} Z`} fill="#120a07" stroke={INK} strokeWidth="1.2" />
                <path d={`M0 ${y + 34} q2 -12 8 -12 q6 0 8 12 Z M39 ${y + 30} q1 -9 5 -9 q5 0 6 9 Z M540 ${y + 34} q-2 -12 -8 -12 q-6 0 -8 12 Z M501 ${y + 30} q-1 -9 -5 -9 q-5 0 -6 9 Z`} fill={U[3]} />
                <path d={`M20 ${y - 6} V${y + 36} M52 ${y + 1} V${y + 32} M520 ${y - 6} V${y + 36} M488 ${y + 1} V${y + 32}`} stroke={P.ember[3]} strokeWidth="1" opacity="0.45" />
                <circle cx={k % 2 ? 44 : 8} cy={y + (k % 2 ? 14 : 12)} r="1.8" fill={P.gold[4]} filter="url(#glow)" />
                <circle cx={k % 2 ? 532 : 496} cy={y + (k % 2 ? 12 : 14)} r="1.8" fill={P.gold[4]} filter="url(#glow)" />
              </g>
            );
          })}
          <path d="M-20 330 L64 296 M560 330 L476 296" stroke={U[4]} strokeWidth="1.2" opacity="0.5" />
        </g>
        <g filter="url(#wc)" strokeLinejoin="round">
          <path d="M108 306 L118 292 L132 296 L140 286 L156 294 L170 290 L178 302 L172 310 Z" fill={U[2]} stroke={INK} strokeWidth="1.4" />
          <path d="M118 292 L132 296 L140 286 L156 294 L170 290" stroke={P.ember[4]} strokeWidth="0.9" fill="none" opacity="0.6" />
          <path d="M372 308 L382 294 L398 298 L410 288 L426 296 L436 308 Z" fill={U[1]} stroke={INK} strokeWidth="1.4" />
          <path d="M382 294 L398 298 L410 288" stroke={P.ember[3]} strokeWidth="0.9" fill="none" opacity="0.6" />
        </g>
        <g filter="url(#wc-wash)">
          <ellipse cx="92" cy="312" rx="50" ry="7" fill={INK} opacity="0.6" />
          <ellipse cx="448" cy="312" rx="50" ry="7" fill={INK} opacity="0.6" />
        </g>
        {/* the great broken arch */}
        <g filter="url(#wc)" strokeLinejoin="round">
          <path fill={url("pierL")} stroke={INK} strokeWidth="2.6" d="M66 310 L66 124 C76 82 124 50 184 36 L194 48 L186 56 L198 66 L188 74 C152 84 124 104 114 134 L114 310 Z" />
          <path fill={url("pierR")} stroke={INK} strokeWidth="2.6" d="M474 310 L474 124 C464 82 416 52 358 40 L352 52 L360 60 L348 70 L356 80 C392 90 418 108 426 136 L426 310 Z" />
          <path d="M188 74 L196 80 C160 90 132 110 122 140 L114 134 C124 104 152 84 188 74 Z" fill={U[4]} stroke={INK} strokeWidth="1.2" />
          <path d="M356 80 L348 86 C384 96 408 114 418 142 L426 136 C418 108 392 90 356 80 Z" fill={U[3]} stroke={INK} strokeWidth="1.2" />
          <path d="M114 136 L122 142 L122 306 L114 306 Z" fill={U[4]} stroke={INK} strokeWidth="1" />
          <path d="M426 138 L418 144 L418 306 L426 306 Z" fill={U[3]} stroke={INK} strokeWidth="1" />
          <g stroke={INK} strokeWidth="1" opacity="0.55">
            {COURSES.map((y, i) => (
              <path key={i} d={`M67 ${y} H113 M427 ${y + 4} H473 M${i % 2 ? 86 : 96} ${y} V${y + 24} M${i % 2 ? 444 : 454} ${y + 4} V${y + 28}`} />
            ))}
            <path d="M70 108 L86 118 M82 86 L96 100 M104 68 L114 84 M134 52 L140 70 M470 108 L454 118 M458 86 L444 100 M438 68 L428 84 M406 54 L400 72" />
          </g>
          <path d="M122 144 V304" stroke={P.ember[3]} strokeWidth="2" opacity="0.8" />
          <path d="M418 146 V304" stroke={P.ember[3]} strokeWidth="1.6" opacity="0.6" />
          <path d="M195 80 C160 90 132 110 122 140" stroke={P.ember[4]} strokeWidth="1.3" fill="none" opacity="0.6" />
          <path d="M349 86 C384 96 408 114 418 142" stroke={P.ember[4]} strokeWidth="1.1" fill="none" opacity="0.45" />
          <path d="M58 312 L58 298 L130 298 L130 312 Z M410 312 L410 298 L482 298 L482 312 Z" fill={U[2]} stroke={INK} strokeWidth="1.8" />
          <path d="M60 300 H128 M412 300 H480" stroke={U[5]} strokeWidth="1" opacity="0.5" />
        </g>
        <g filter="url(#wc)">
          <path d="M266 0 V96 M278 0 V88" stroke={INK} strokeWidth="1.1" />
          <path d="M258 96 L284 88 L290 106 L266 114 Z" fill={U[2]} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M284 90 L290 106" stroke={P.ember[3]} strokeWidth="1" opacity="0.6" />
        </g>
        {brazier(150, 292, 0.7)}
        {brazier(390, 292, 0.7)}
      </Layer>

      {/* ---------- layer 3: foreground framing ---------- */}
      <Layer n={3}>
        <g filter="url(#wc)" strokeLinejoin="round">
          <ellipse cx="10" cy="700" rx="70" ry="12" fill={INK} opacity="0.55" filter="url(#wc-wash)" />
          <path d="M-20 668 L-20 190 L-10 176 L-2 186 L8 168 L18 182 L28 172 L36 184 L36 668 Z" fill={url("col")} stroke={INK} strokeWidth="2.8" />
          <g stroke={INK} strokeWidth="1.1" opacity="0.5">
            <path d="M-10 188 V666 M0 186 V666 M10 180 V666 M20 182 V666 M30 180 V666" />
          </g>
          <g stroke={P.ember[3]} strokeWidth="1" opacity="0.4">
            <path d="M23 184 V664 M33 186 V664" />
          </g>
          <path d="M0 260 L10 284 L4 302 L14 326 M16 460 L8 480 L16 500" stroke={INK} strokeWidth="1.3" fill="none" />
          <path d="M-28 666 H46 L50 680 L44 690 H-28 Z M-30 690 H54 V712 H-30 Z" fill={U[2]} stroke={INK} strokeWidth="2.2" />
          <path d="M-26 669 H44 M-28 693 H52" stroke={U[5]} strokeWidth="1" opacity="0.55" />
          <path d="M35 666 L35 186" stroke={P.ember[4]} strokeWidth="1.4" opacity="0.6" />
        </g>
        <g filter="url(#wc)" strokeLinejoin="round">
          <ellipse cx="530" cy="660" rx="60" ry="10" fill={INK} opacity="0.55" filter="url(#wc-wash)" />
          <path d="M508 646 L508 520 L518 508 L530 516 L542 502 L560 512 L560 646 Z" fill={url("colR")} stroke={INK} strokeWidth="2.8" />
          <g stroke={INK} strokeWidth="1.1" opacity="0.5">
            <path d="M518 514 V644 M530 518 V644 M542 508 V644 M552 512 V644" />
          </g>
          <path d="M509 520 V644 M515 518 V644" stroke={P.ember[3]} strokeWidth="1" opacity="0.5" />
          <path d="M496 644 H570 V662 H496 Z" fill={U[2]} stroke={INK} strokeWidth="2.2" />
          <ellipse cx="460" cy="800" rx="110" ry="14" fill={INK} opacity="0.6" filter="url(#wc-wash)" />
          <path d="M420 736 L570 728 L570 804 L420 804 Z" fill={url("drum")} stroke={INK} strokeWidth="2.6" />
          <ellipse cx="420" cy="770" rx="24" ry="36" fill={U[3]} stroke={INK} strokeWidth="2.6" />
          <ellipse cx="420" cy="770" rx="14" ry="23" fill="none" stroke={INK} strokeWidth="1" opacity="0.5" />
          <path d="M432 740 L570 734 M432 752 L570 747" stroke={INK} strokeWidth="1" opacity="0.5" />
          <path d="M408 738 Q420 732 432 736" stroke={P.ember[4]} strokeWidth="1.3" fill="none" opacity="0.7" />
          <path d="M-24 830 L6 810 L34 820 L52 846 L44 900 L-24 900 Z" fill={U[1]} stroke={INK} strokeWidth="2.2" />
          <path d="M6 810 L34 820" stroke={P.ember[3]} strokeWidth="1.2" opacity="0.5" />
          <path d="M360 800 L378 788 L398 794 L396 810 L368 812 Z" fill={U[2]} stroke={INK} strokeWidth="1.8" />
          <path d="M150 880 L176 866 L204 874 L200 894 L160 896 Z" fill={U[1]} stroke={INK} strokeWidth="1.8" />
        </g>
      </Layer>

      {/* ---------- layer 4: smoke and cinders ---------- */}
      <Layer n={4}>
        <g filter="url(#wc-wash)" fill="#0b0605">
          <ellipse cx="120" cy="130" rx="200" ry="34" opacity="0.4" />
          <ellipse cx="420" cy="160" rx="180" ry="26" opacity="0.3" />
          <ellipse cx="270" cy="40" rx="320" ry="60" opacity="0.55" />
        </g>
        <g filter="url(#glow)">
          {CINDERS.map((c, i) => {
            const b = busy(c.x, c.y);
            if (b < 0.25 && c.t < 0.75) return null;
            const r = 0.5 + c.s * c.s * 2;
            const col = c.t > 0.66 ? GLOW.ember : c.t > 0.33 ? P.ember[3] : P.gold[4];
            return c.s > 0.8 ? (
              <path key={i} d={`M${c.x.toFixed(1)} ${c.y.toFixed(1)} l${(1.5 + c.t * 2).toFixed(1)} -${(4 + c.s * 5).toFixed(1)}`} stroke={col} strokeWidth="1.2" strokeLinecap="round" />
            ) : (
              <circle key={i} cx={c.x.toFixed(1)} cy={c.y.toFixed(1)} r={r.toFixed(2)} fill={col} opacity={(0.5 + c.t * 0.5).toFixed(2)} />
            );
          })}
        </g>
      </Layer>

      {/* static overlays: vignette, calm bands for the UI, paper grain */}
      <Atmosphere light={{ x: 540, y: 500, color: "#ffb35c" }} rays={{ n: 6, spread: 0.95, length: 1300, seed: 5 }} haze={{ y: 600, color: "#c46a2a", opacity: 0.2 }} />
      <rect width="1080" height="1920" fill={url("vig")} />
      <rect width="1080" height="1920" fill={url("bands")} />
      <g transform="scale(2)">
        <rect width="540" height="960" filter="url(#grain)" opacity="0.2" />
      </g>
    </svg>
  );
}
