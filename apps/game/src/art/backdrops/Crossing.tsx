import { useId, type ReactNode } from "react";
import { INK, P, GLOW } from "../palette";
import { rng, scatter } from "./paint";
import { Atmosphere } from "./Atmosphere";

/*
 * The Crossing: the hub town square at dusk, seen from a high three-quarter view. Authored in a
 * 540x960 space and scaled x2 into the 1080x1920 viewBox. Parallax layers are <g data-layer=n>
 * (0 farthest), overdrawing 20 units past the left and right edges.
 */

/** Tappable landmarks, in viewBox (1080x1920) units. */
export const STATIONS = [
  { id: "gate", x: 540, y: 330 },
  { id: "bazaar", x: 190, y: 640 },
  { id: "crucible", x: 890, y: 630 },
  { id: "mirror", x: 180, y: 1200 },
  { id: "grimoire", x: 900, y: 1200 },
  { id: "loom", x: 540, y: 1430 },
] as const;

const f = (n: number) => n.toFixed(1);
const FX = 270;
const FY = 478;
const STARS = scatter(40, 3, 0, 0, 540, 90);
const FIREFLIES = scatter(70, 8, -20, 140, 580, 700);
const SPARKS = scatter(16, 19, 424, 230, 50, 70);

/** Threads of the loom as a small skill graph: nodes and the edges between them. */
const LOOM_NODES = (() => {
  const r = rng(12);
  const cols = [222, 246, 270, 294, 318];
  return cols.flatMap((x, i) => [0, 1, 2].map((j) => ({ x: x + (r() - 0.5) * 6, y: 668 + j * 30 + (i % 2) * 14 + (r() - 0.5) * 6, c: (i + j) % 3 })));
})();
const LOOM_EDGES = (() => {
  const r = rng(5);
  const e: [number, number][] = [];
  for (let i = 0; i < LOOM_NODES.length; i++)
    for (let j = i + 1; j < LOOM_NODES.length; j++) {
      const a = LOOM_NODES[i]!;
      const b = LOOM_NODES[j]!;
      if (Math.hypot(a.x - b.x, a.y - b.y) < 40 && r() < 0.6) e.push([i, j]);
    }
  return e;
})();

function Layer({ n, children }: { n: number; children: ReactNode }) {
  return (
    <g data-layer={n}>
      <g transform="scale(2)">{children}</g>
    </g>
  );
}

export default function Crossing({ className }: { className?: string }) {
  const u = useId().replace(/:/g, "");
  const id = (s: string) => `${u}-${s}`;
  const url = (s: string) => `url(#${id(s)})`;

  /** A townhouse seen from above: front wall with lit windows, pitched roof plane. */
  const house = (k: string, x: number, base: number, w: number, h: number, roof: number, wall: string, roofC: string, win = 2) => (
    <g key={k}>
      <ellipse cx={f(x + w / 2)} cy={f(base + 2)} rx={f(w * 0.6)} ry="5" fill="#000" opacity="0.35" filter="url(#wc-wash)" />
      <path d={`M${f(x)} ${f(base)} V${f(base - h)} H${f(x + w)} V${f(base)} Z`} fill={wall} stroke={INK} strokeWidth="1.6" />
      <path d={`M${f(x + w * 0.62)} ${f(base)} V${f(base - h)} H${f(x + w)} V${f(base)} Z`} fill="#000" opacity="0.22" />
      <path d={`M${f(x - 4)} ${f(base - h)} L${f(x + 6)} ${f(base - h - roof)} H${f(x + w - 6)} L${f(x + w + 4)} ${f(base - h)} Z`} fill={roofC} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      <path d={`M${f(x + 6)} ${f(base - h - roof)} H${f(x + w - 6)}`} stroke="#fff" strokeWidth="1" opacity="0.18" />
      {Array.from({ length: 4 }, (_, i) => (
        <path key={i} d={`M${f(x - 2 + (i + 1) * 0.2 * (w + 4))} ${f(base - h - roof * 0.15)} l${f(0)} ${f(-roof * 0.7)}`} stroke={INK} strokeWidth="0.6" opacity="0.35" />
      ))}
      {Array.from({ length: win }, (_, i) => {
        const wx = x + (w / (win + 1)) * (i + 1) - 3.5;
        return (
          <g key={`w${i}`}>
            <rect x={f(wx)} y={f(base - h * 0.72)} width="7" height="9" fill={P.gold[4]} stroke={INK} strokeWidth="0.9" />
            <rect x={f(wx - 3)} y={f(base - h * 0.72 - 3)} width="13" height="15" fill={P.gold[3]} opacity="0.35" filter="url(#glow)" />
            <path d={`M${f(wx + 3.5)} ${f(base - h * 0.72)} v9 M${f(wx)} ${f(base - h * 0.72 + 4.5)} h7`} stroke={INK} strokeWidth="0.6" />
          </g>
        );
      })}
      <path d={`M${f(x + w * 0.42)} ${f(base)} v-9 q3 -3 6 0 v9 Z`} fill={P.leather[1]} stroke={INK} strokeWidth="0.9" />
    </g>
  );

  const lamp = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <ellipse cx={x} cy={y + 1} rx="22" ry="8" fill={P.gold[4]} opacity="0.25" filter="url(#glow-soft)" />
      <path d={`M${x} ${y} V${y - 34}`} stroke={INK} strokeWidth="2" />
      <path d={`M${x - 4} ${y} h8`} stroke={INK} strokeWidth="2" />
      <circle cx={x} cy={y - 38} r="12" fill={P.gold[4]} opacity="0.45" filter="url(#glow-soft)" />
      <path d={`M${x - 4} ${y - 34} L${x - 5} ${y - 42} L${x} ${y - 46} L${x + 5} ${y - 42} L${x + 4} ${y - 34} Z`} fill="#ffe7a8" stroke={INK} strokeWidth="1.1" strokeLinejoin="round" />
    </g>
  );

  const tree = (k: string, x: number, base: number, r: number, c0: string, c1: string) => (
    <g key={k}>
      <ellipse cx={x} cy={base + 2} rx={r * 0.9} ry={r * 0.25} fill="#000" opacity="0.35" filter="url(#wc-wash)" />
      <path d={`M${x - 3} ${base} L${x - 2} ${base - r} H${x + 2} L${x + 3} ${base} Z`} fill={P.leather[1]} stroke={INK} strokeWidth="1.2" />
      <path d={`M${x - r} ${base - r * 1.1} q0 -${r * 0.9} ${r * 0.7} -${r * 0.9} q${r * 0.4} -${r * 0.5} ${r * 0.8} 0 q${r * 0.6} 0 ${r * 0.5} ${r * 0.8} q${r * 0.2} ${r * 0.7} -${r * 0.6} ${r * 0.8} q-${r * 0.5} ${r * 0.3} -${r} 0 q-${r * 0.5} -${r * 0.1} -${r * 0.4} -${r * 0.7} Z`} fill={c0} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      <path d={`M${x - r * 0.7} ${base - r * 1.5} q${r * 0.3} -${r * 0.5} ${r * 0.8} -${r * 0.5}`} stroke={c1} strokeWidth={f(r * 0.25)} strokeLinecap="round" opacity="0.6" fill="none" />
    </g>
  );

  return (
    <svg viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="150" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#140f2a" />
          <stop offset="0.45" stopColor="#3b2350" />
          <stop offset="0.75" stopColor="#8a3b4a" />
          <stop offset="1" stopColor="#e07a3a" />
        </linearGradient>
        <linearGradient id={id("ground")} x1="0" y1="140" x2="0" y2="960" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5b4a5e" />
          <stop offset="0.3" stopColor="#4a4258" />
          <stop offset="0.7" stopColor="#332e42" />
          <stop offset="1" stopColor="#15131d" />
        </linearGradient>
        <radialGradient id={id("plaza")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#8a7a8a" />
          <stop offset="0.7" stopColor="#6a5c70" />
          <stop offset="1" stopColor="#4a4258" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("portal")} cx="0.5" cy="0.55" r="0.55">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.25" stopColor={GLOW.hex} />
          <stop offset="0.6" stopColor={P.violet[3]} />
          <stop offset="1" stopColor={P.violet[1]} />
        </radialGradient>
        <radialGradient id={id("warm")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={P.gold[4]} stopOpacity="0.5" />
          <stop offset="1" stopColor={P.gold[3]} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("fire")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={P.ember[4]} stopOpacity="0.7" />
          <stop offset="1" stopColor={P.ember[3]} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("arcane")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={GLOW.violet} stopOpacity="0.6" />
          <stop offset="1" stopColor={P.violet[2]} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("hexg")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={GLOW.hex} stopOpacity="0.5" />
          <stop offset="1" stopColor={GLOW.hex} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("water")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.verdigris[4]} />
          <stop offset="1" stopColor={P.verdigris[1]} />
        </linearGradient>
        <linearGradient id={id("glass")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e8f4ff" />
          <stop offset="0.35" stopColor={P.spirit[3]} />
          <stop offset="0.7" stopColor={P.violet[3]} />
          <stop offset="1" stopColor={P.spirit[1]} />
        </linearGradient>
        <linearGradient id={id("stone")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={P.stone[3]} />
          <stop offset="1" stopColor={P.stone[1]} />
        </linearGradient>
        <linearGradient id={id("forge")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.stone[2]} />
          <stop offset="0.6" stopColor={P.stone[1]} />
          <stop offset="1" stopColor="#4a2418" />
        </linearGradient>
        <linearGradient id={id("page")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff7dc" />
          <stop offset="1" stopColor={P.gold[4]} />
        </linearGradient>
        <radialGradient id={id("vig")} cx="0.5" cy="0.45" r="0.75">
          <stop offset="0.6" stopColor="#07050c" stopOpacity="0" />
          <stop offset="1" stopColor="#07050c" stopOpacity="0.75" />
        </radialGradient>
        <linearGradient id={id("bottom")} x1="0" y1="1500" x2="0" y2="1920" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#07050c" stopOpacity="0" />
          <stop offset="0.6" stopColor="#07050c" stopOpacity="0.5" />
          <stop offset="1" stopColor="#07050c" stopOpacity="0.8" />
        </linearGradient>
      </defs>

      {/* ---------- layer 0: dusk sky, far hills, the town wall ---------- */}
      <Layer n={0}>
        <rect x="-20" y="0" width="580" height="160" fill={url("sky")} />
        <g fill="#fff4e0">
          {STARS.map((s, i) => (
            <circle key={i} cx={f(s.x)} cy={f(s.y)} r={f(0.3 + s.s * 0.8)} opacity={f(0.2 + s.t * 0.5)} />
          ))}
        </g>
        <path d="M430 40 a14 14 0 1 0 12 22 a11 11 0 1 1 -12 -22 Z" fill="#fbe8c8" opacity="0.9" />
        <circle cx="270" cy="150" r="120" fill={url("fire")} opacity="0.6" />
        <g filter="url(#wc-wash)">
          <path d="M-20 120 Q40 96 100 112 Q160 88 220 108 Q280 92 340 106 Q400 86 460 110 Q510 96 560 112 L560 160 L-20 160 Z" fill="#2a1d3a" />
        </g>
        <g filter="url(#wc)">
          <path d="M-20 136 L20 128 L24 108 L34 108 L36 124 L60 120 L66 96 L70 86 L74 96 L78 118 L120 122 L124 104 L140 104 L142 126 L560 126 L560 170 L-20 170 Z" fill="#241a33" stroke={INK} strokeWidth="1.2" />
          <path d="M398 126 L400 100 L414 92 L428 100 L430 126 Z M470 126 L472 110 L484 104 L496 110 L498 126 Z" fill="#241a33" stroke={INK} strokeWidth="1.2" />
          <circle cx="70" cy="104" r="1.6" fill={P.gold[4]} />
          <circle cx="414" cy="108" r="1.6" fill={P.gold[4]} />
        </g>
        {/* crenellated town wall */}
        <g filter="url(#wc)">
          <path d={`M-20 196 V150 ${Array.from({ length: 30 }, (_, i) => `H${-20 + i * 20 + 10} V142 H${-20 + i * 20 + 18} V150`).join(" ")} H560 V196 Z`} fill="#3a3148" stroke={INK} strokeWidth="1.5" />
          <path d="M-20 168 H560 M-20 182 H560" stroke={INK} strokeWidth="0.8" opacity="0.4" />
          <path d="M-20 151 H560" stroke={P.ember[3]} strokeWidth="1" opacity="0.4" />
        </g>
      </Layer>

      {/* ---------- layer 1: the square itself ---------- */}
      <Layer n={1}>
        <rect x="-20" y="190" width="580" height="780" fill={url("ground")} />
        <ellipse cx={FX} cy={FY} rx="300" ry="230" fill={url("plaza")} opacity="0.55" />
        {/* cobbles: dashed rings and spokes around the fountain */}
        <g fill="none" stroke="#1e1a28" strokeLinecap="round" filter="url(#wc)">
          {Array.from({ length: 16 }, (_, i) => {
            const rx = 64 + i * 17;
            return <ellipse key={i} cx={FX} cy={FY} rx={rx} ry={rx * 0.62} strokeWidth={f(0.7 + i * 0.03)} opacity={f(0.55 - i * 0.018)} strokeDasharray={`${f(6 + i * 0.6)} 2.4`} />;
          })}
          {Array.from({ length: 36 }, (_, i) => {
            const a = (i / 36) * Math.PI * 2;
            return (
              <path
                key={`s${i}`}
                d={`M${f(FX + Math.cos(a) * 64)} ${f(FY + Math.sin(a) * 40)} L${f(FX + Math.cos(a) * 330)} ${f(FY + Math.sin(a) * 205)}`}
                strokeWidth="0.6"
                opacity="0.25"
                strokeDasharray="3 14"
              />
            );
          })}
        </g>
        {/* streets leaving the square */}
        <g filter="url(#wc-wash)" fill="#2a2536" opacity="0.6">
          <path d="M240 196 L300 196 L310 240 L230 240 Z" />
          <path d="M-20 460 L40 450 L40 510 L-20 520 Z M560 460 L500 450 L500 510 L560 520 Z" />
        </g>
        {/* dusk glow pools from the gate and forge */}
        <ellipse cx="270" cy="236" rx="90" ry="30" fill={url("arcane")} />
        <ellipse cx="440" cy="340" rx="90" ry="40" fill={url("fire")} opacity="0.55" />
        <ellipse cx="100" cy="350" rx="90" ry="40" fill={url("warm")} />
      </Layer>

      {/* ---------- layer 2: buildings and the six landmarks ---------- */}
      <Layer n={2}>
        {/* houses ringing the square */}
        <g filter="url(#wc)">
          {house("h1", -20, 250, 56, 40, 26, "#6b5a6e", P.oxblood[1])}
          {house("h2", 34, 236, 44, 34, 22, "#7a6878", "#3a3148")}
          {house("h4", 470, 238, 50, 36, 24, "#6b5a6e", P.sapphire[1])}
          {house("h5", 516, 256, 50, 42, 26, "#5e5063", P.oxblood[1])}
          {house("h6", 150, 214, 40, 28, 18, "#7a6878", P.slate[2], 1)}
          {house("h7", 350, 214, 40, 28, 18, "#6b5a6e", P.oxblood[1], 1)}
          {house("h8", -26, 470, 40, 44, 20, "#5e5063", P.sapphire[1], 1)}
          {house("h9", 526, 470, 40, 44, 20, "#5e5063", "#3a3148", 1)}
        </g>
        {tree("t1", 30, 440, 22, "#2c4a3c", "#5a8a6a")}
        {tree("t2", 512, 440, 22, "#2c4a3c", "#5a8a6a")}
        {tree("t3", 190, 236, 14, "#2c4a3c", "#5a8a6a")}
        {tree("t4", 350, 236, 14, "#2c4a3c", "#5a8a6a")}

        {/* GATE: an arcane portal set in the town wall */}
        <g>
          <circle cx="270" cy="160" r="70" fill={url("arcane")} />
          <g filter="url(#wc)" strokeLinejoin="round">
            <path d="M226 212 V140 C226 104 246 86 270 80 C294 86 314 104 314 140 V212 H300 V142 C300 116 288 102 270 98 C252 102 240 116 240 142 V212 Z" fill={url("stone")} stroke={INK} strokeWidth="2.2" />
            <path d="M240 212 V142 C240 116 252 102 270 98 C288 102 300 116 300 142 V212 Z" fill={url("portal")} stroke={INK} strokeWidth="1.4" />
            <path d="M270 160 m-4 0 a4 4 0 1 1 8 0 a9 9 0 1 1 -18 0 a14 14 0 1 1 28 0 a19 19 0 1 1 -38 2" fill="none" stroke="#ffffff" strokeWidth="1.4" opacity="0.7" />
            <path d="M232 128 v6 M232 150 v6 M232 172 v6 M308 128 v6 M308 150 v6 M308 172 v6" stroke={GLOW.hex} strokeWidth="2" filter="url(#glow)" />
            <path d="M264 84 L270 74 L276 84 Z" fill={P.gold[3]} stroke={INK} strokeWidth="1" />
            <path d="M218 212 H322 L326 220 H214 Z M210 220 H330 L334 228 H206 Z" fill={P.stone[2]} stroke={INK} strokeWidth="1.4" />
            <path d="M226 140 C226 104 246 86 270 80" stroke={P.ember[4]} strokeWidth="1.2" fill="none" opacity="0.5" />
          </g>
          <ellipse cx="270" cy="160" rx="22" ry="40" fill={GLOW.hex} opacity="0.35" filter="url(#glow-soft)" />
        </g>

        {/* BAZAAR: striped market stalls */}
        <g filter="url(#wc)" strokeLinejoin="round">
          <circle cx="96" cy="310" r="60" fill={url("warm")} />
          {[
            { x: 44, y: 316, a: P.oxblood[2], b: P.bone[4] },
            { x: 104, y: 340, a: P.sapphire[2], b: P.gold[3] },
            { x: 58, y: 370, a: P.verdigris[2], b: P.bone[4] },
          ].map((st, i) => (
            <g key={i}>
              <ellipse cx={st.x + 24} cy={st.y + 2} rx="32" ry="6" fill="#000" opacity="0.3" />
              <path d={`M${st.x} ${st.y} V${st.y - 30} M${st.x + 48} ${st.y} V${st.y - 30}`} stroke={INK} strokeWidth="1.8" />
              <path d={`M${st.x - 2} ${st.y} V${st.y - 14} H${st.x + 50} V${st.y} Z`} fill={P.leather[2]} stroke={INK} strokeWidth="1.4" />
              <path d={`M${st.x - 2} ${st.y - 14} H${st.x + 50}`} stroke={P.leather[4]} strokeWidth="1" />
              {/* wares */}
              <circle cx={st.x + 8} cy={st.y - 16} r="3" fill={P.ember[3]} stroke={INK} strokeWidth="0.7" />
              <circle cx={st.x + 14} cy={st.y - 17} r="3" fill={P.gold[3]} stroke={INK} strokeWidth="0.7" />
              <path d={`M${st.x + 22} ${st.y - 14} q2 -8 5 -8 q3 0 5 8 Z`} fill={P.verdigris[3]} stroke={INK} strokeWidth="0.7" />
              <path d={`M${st.x + 34} ${st.y - 14} h10 v-5 h-10 Z`} fill={P.violet[2]} stroke={INK} strokeWidth="0.7" />
              {/* awning */}
              <path d={`M${st.x - 6} ${st.y - 30} L${st.x + 4} ${st.y - 46} H${st.x + 44} L${st.x + 54} ${st.y - 30} Z`} fill={st.b} stroke={INK} strokeWidth="1.5" />
              {[0, 1, 2, 3, 4].map((k) => (
                <path key={k} d={`M${st.x - 6 + k * 12} ${st.y - 30} L${st.x + 4 + k * 8} ${st.y - 46} H${st.x + 8 + k * 8} L${st.x + k * 12} ${st.y - 30} Z`} fill={st.a} />
              ))}
              <path d={`M${st.x - 6} ${st.y - 30} ${[0, 1, 2, 3, 4, 5].map((k) => `q5 6 10 0`).join(" ")}`} fill={st.a} stroke={INK} strokeWidth="1.2" />
              <circle cx={st.x + 48} cy={st.y - 24} r="2.6" fill="#ffe7a8" filter="url(#glow)" />
            </g>
          ))}
          <ellipse cx="146" cy="396" rx="16" ry="3" fill="#000" opacity="0.35" />
          <path d="M132 384 h12 v10 h-12 Z M146 388 h10 v8 h-10 Z" fill={P.leather[2]} stroke={INK} strokeWidth="1" />
          <path d="M132 384 l3 -3 h12 l-3 3 Z" fill={P.leather[3]} stroke={INK} strokeWidth="0.8" />

        </g>

        {/* CRUCIBLE: the forge-furnace */}
        <g>
          <circle cx="446" cy="312" r="70" fill={url("fire")} />
          <g filter="url(#wc)" strokeLinejoin="round">
            <ellipse cx="446" cy="346" rx="44" ry="9" fill="#000" opacity="0.35" />
            <path d="M456 276 L460 214 H476 L480 290 Z" fill={P.stone[1]} stroke={INK} strokeWidth="1.6" />
            <path d="M456 214 H480 V204 H456 Z" fill={P.stone[2]} stroke={INK} strokeWidth="1.4" />
            <path d="M460 212 V206 M468 212 V206" stroke={P.ember[3]} strokeWidth="1" opacity="0.7" />
            <path d="M414 344 V302 C414 272 432 262 446 262 C460 262 478 272 478 302 V344 Z" fill={url("forge")} stroke={INK} strokeWidth="2" />
            <path d="M408 344 H484 V352 H408 Z" fill={P.stone[2]} stroke={INK} strokeWidth="1.4" />
            <path d="M418 290 H474 M416 310 H476 M416 328 H476 M430 272 V290 M446 290 V310 M462 272 V290 M430 310 V328 M462 310 V328" stroke={INK} strokeWidth="0.8" opacity="0.5" />
            <path d="M432 344 V322 Q446 306 460 322 V344 Z" fill={P.ember[3]} stroke={INK} strokeWidth="1.6" />
            <path d="M436 344 C434 334 442 330 440 322 C446 328 446 318 450 314 C452 324 458 328 456 344 Z" fill="#fff0c0" filter="url(#glow)" />
            <path d="M414 302 C414 272 432 262 446 262" stroke={P.ember[4]} strokeWidth="1.2" fill="none" opacity="0.6" />
            <path d="M426 322 Q446 300 466 322" stroke={P.ember[3]} strokeWidth="2" fill="none" opacity="0.8" filter="url(#glow)" />
            <path d="M394 300 L400 344 M388 322 H406" stroke={P.leather[2]} strokeWidth="2.4" strokeLinecap="round" />
            {/* cauldron */}
            <path d="M488 336 q0 12 14 12 q14 0 14 -12 Z" fill={P.steel[1]} stroke={INK} strokeWidth="1.4" />
            <ellipse cx="502" cy="336" rx="14" ry="3.4" fill={P.verdigris[3]} stroke={INK} strokeWidth="1.2" />
            <circle cx="498" cy="332" r="2" fill={GLOW.hex} filter="url(#glow)" />
            <circle cx="506" cy="328" r="1.4" fill={GLOW.hex} filter="url(#glow)" />
            {/* anvil */}
            <path d="M388 342 h18 v-4 h8 v-5 h-26 q-4 3 -6 5 h6 Z" fill={P.steel[2]} stroke={INK} strokeWidth="1.2" />
          </g>
          <g filter="url(#wc-wash)" fill="#1a1520" opacity="0.5">
            <path d="M470 206 Q460 180 476 160 Q490 140 480 120 Q500 138 494 164 Q486 186 470 206 Z" />
          </g>
          <g fill={P.ember[4]} filter="url(#glow)">
            {SPARKS.map((s, i) => (
              <circle key={i} cx={f(s.x)} cy={f(s.y)} r={f(0.6 + s.s)} opacity={f(0.5 + s.t * 0.5)} />
            ))}
          </g>
        </g>

        {/* the central fountain */}
        <g filter="url(#wc)" strokeLinejoin="round">
          <ellipse cx={FX} cy={FY + 8} rx="62" ry="26" fill="#000" opacity="0.35" />
          <path d={`M${FX - 56} ${FY} V${FY + 12} A56 24 0 0 0 ${FX + 56} ${FY + 12} V${FY} Z`} fill={P.stone[2]} stroke={INK} strokeWidth="2" />
          <ellipse cx={FX} cy={FY} rx="56" ry="24" fill={P.stone[3]} stroke={INK} strokeWidth="2" />
          <ellipse cx={FX} cy={FY} rx="48" ry="19" fill={url("water")} stroke={INK} strokeWidth="1.4" />
          <path d={`M${FX - 34} ${FY + 4} q10 -3 20 0 M${FX + 12} ${FY - 8} q10 -3 20 0 M${FX - 10} ${FY + 12} q8 -2 16 0`} stroke="#e8fff8" strokeWidth="0.9" fill="none" opacity="0.7" />
          <path d={`M${FX - 6} ${FY} V${FY - 34} H${FX + 6} V${FY} Z`} fill={P.stone[3]} stroke={INK} strokeWidth="1.6" />
          <ellipse cx={FX} cy={FY - 34} rx="20" ry="7" fill={P.stone[3]} stroke={INK} strokeWidth="1.6" />
          <ellipse cx={FX} cy={FY - 35} rx="15" ry="4.5" fill={url("water")} />
          <path d={`M${FX - 3} ${FY - 36} V${FY - 52} H${FX + 3} V${FY - 36} Z`} fill={P.stone[3]} stroke={INK} strokeWidth="1.2" />
          <circle cx={FX} cy={FY - 56} r="5" fill={GLOW.hex} stroke={INK} strokeWidth="1.2" />
          <path d={`M${FX} ${FY - 52} Q${FX - 20} ${FY - 60} ${FX - 32} ${FY - 6} M${FX} ${FY - 52} Q${FX + 20} ${FY - 60} ${FX + 32} ${FY - 6} M${FX - 16} ${FY - 34} Q${FX - 30} ${FY - 34} ${FX - 38} ${FY} M${FX + 16} ${FY - 34} Q${FX + 30} ${FY - 34} ${FX + 38} ${FY}`} stroke="#c8fff0" strokeWidth="1.2" fill="none" opacity="0.75" />
        </g>
        <g filter="url(#wc)">
          {[
            [FX - 100, FY - 44],
            [FX + 100, FY - 44],
            [FX - 108, FY + 50],
            [FX + 108, FY + 50],
          ].map(([x, y], i) => (
            <g key={i}>
              <ellipse cx={x} cy={y! + 6} rx="18" ry="4" fill="#000" opacity="0.3" />
              <path d={`M${x! - 14} ${y} h28 l-3 8 h-22 Z`} fill={P.stone[2]} stroke={INK} strokeWidth="1.2" />
              <path d={`M${x! - 13} ${y} q4 -10 13 -10 q9 0 13 10 Z`} fill="#2c4a3c" stroke={INK} strokeWidth="1.1" />
              {[-8, -3, 2, 7, 0, -5, 5].map((dx, k) => (
                <circle key={k} cx={x! + dx} cy={y! - 3 - (k > 3 ? 4 : 0)} r="1.5" fill={[P.oxblood[4], P.gold[4], P.violet[4], P.sapphire[4]][k % 4]} />
              ))}
            </g>
          ))}
        </g>
        <circle cx={FX} cy={FY - 56} r="16" fill={GLOW.hex} opacity="0.4" filter="url(#glow-soft)" />
        <ellipse cx={FX} cy={FY} rx="60" ry="26" fill={url("hexg")} opacity="0.6" />

        {/* MIRROR: a tall standing mirror */}
        <g>
          <ellipse cx="90" cy="630" rx="50" ry="18" fill={url("hexg")} />
          <g filter="url(#wc)" strokeLinejoin="round">
            <ellipse cx="90" cy="650" rx="30" ry="8" fill="#000" opacity="0.35" />
            <path d="M74 650 L82 628 M106 650 L98 628" stroke={P.gold[1]} strokeWidth="3" strokeLinecap="round" />
            <ellipse cx="90" cy="588" rx="24" ry="44" fill={P.gold[2]} stroke={INK} strokeWidth="2.2" />
            <ellipse cx="90" cy="588" rx="18" ry="37" fill={url("glass")} stroke={INK} strokeWidth="1.4" />
            <path d="M80 566 L96 552 M78 584 L100 562 M84 604 L102 586" stroke="#fff" strokeWidth="1.4" opacity="0.6" />
            <path d="M90 540 l4 -8 l4 8 Z M86 544 q4 -6 8 0" fill={P.gold[3]} stroke={INK} strokeWidth="1" />
            <path d="M68 590 q-4 -10 2 -18 M112 590 q4 -10 -2 -18" stroke={P.gold[3]} strokeWidth="1.4" fill="none" />
            <path d="M72 588 C72 560 80 548 90 546" stroke={P.gold[4]} strokeWidth="1" fill="none" opacity="0.7" />
          </g>
          <ellipse cx="90" cy="588" rx="18" ry="37" fill={P.spirit[3]} opacity="0.3" filter="url(#glow-soft)" />
        </g>

        {/* GRIMOIRE: a lectern with a giant open book, shelves behind */}
        <g>
          <circle cx="452" cy="594" r="60" fill={url("warm")} />
          <g filter="url(#wc)" strokeLinejoin="round">
            <path d="M408 596 V540 Q452 524 496 540 V596 Z" fill={P.leather[1]} stroke={INK} strokeWidth="1.8" />
            {[548, 566, 584].map((y) => (
              <g key={y}>
                <path d={`M410 ${y} Q452 ${y - 14} 494 ${y}`} stroke={INK} strokeWidth="1.2" fill="none" />
                {Array.from({ length: 12 }, (_, k) => (
                  <rect key={k} x={414 + k * 6.6} y={y - 12 + Math.abs(k - 5.5) * 0.9} width="5" height="11" fill={[P.oxblood[2], P.sapphire[2], P.verdigris[2], P.gold[2], P.violet[2]][k % 5]} stroke={INK} strokeWidth="0.5" />
                ))}
              </g>
            ))}
            <ellipse cx="452" cy="652" rx="34" ry="8" fill="#000" opacity="0.35" />
            <path d="M444 650 L448 616 H456 L460 650 Z" fill={P.leather[2]} stroke={INK} strokeWidth="1.4" />
            <path d="M436 652 H468" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
            <path d="M424 618 L452 626 L480 618 L476 604 L452 610 L428 604 Z" fill={P.oxblood[1]} stroke={INK} strokeWidth="1.6" />
            <path d="M428 604 Q440 594 452 604 Q464 594 476 604 L476 610 Q464 602 452 610 Q440 602 428 610 Z" fill={url("page")} stroke={INK} strokeWidth="1.3" />
            <path d="M434 603 l12 2 M434 606 l12 2 M458 605 l12 -2 M458 608 l12 -2" stroke={P.gold[1]} strokeWidth="0.6" />
          </g>
          <g filter="url(#glow)" fill={GLOW.rune}>
            <path d="M444 588 l3 -5 l3 5 Z" />
            <circle cx="460" cy="582" r="1.8" />
            <path d="M452 574 l2 -3 l2 3 l-2 3 Z" />
          </g>
          <ellipse cx="452" cy="600" rx="26" ry="12" fill={P.gold[4]} opacity="0.4" filter="url(#glow-soft)" />
          <path d="M412 600 v-8 M494 600 v-8" stroke="#fff4d8" strokeWidth="2" />
          <circle cx="412" cy="590" r="2" fill={P.gold[4]} filter="url(#glow)" />
          <circle cx="494" cy="590" r="2" fill={P.gold[4]} filter="url(#glow)" />
        </g>

        {/* LOOM: a great tree grown into a loom of glowing threads */}
        <g>
          <ellipse cx="270" cy="700" rx="90" ry="70" fill={url("arcane")} opacity="0.8" />
          <g filter="url(#wc)" strokeLinejoin="round">
            <ellipse cx="270" cy="776" rx="70" ry="12" fill="#000" opacity="0.35" />
            {/* roots and twin trunks */}
            <path d="M196 778 Q206 760 208 700 Q206 670 196 648 Q214 660 220 700 Q222 750 230 776 Z" fill={P.leather[1]} stroke={INK} strokeWidth="1.8" />
            <path d="M344 778 Q334 760 332 700 Q334 670 344 648 Q326 660 320 700 Q318 750 310 776 Z" fill={P.leather[1]} stroke={INK} strokeWidth="1.8" />
            <path d="M200 650 Q270 626 340 650 L336 660 Q270 638 204 660 Z" fill={P.leather[2]} stroke={INK} strokeWidth="1.6" />
            <path d="M204 652 Q270 630 336 652" stroke={P.leather[4]} strokeWidth="1" fill="none" />
            <path d="M190 780 q-8 -4 -16 2 M236 778 q6 -6 14 -2 M350 780 q8 -4 16 2 M304 778 q-6 -6 -14 -2" stroke={INK} strokeWidth="1.6" fill="none" />
            <path d="M216 700 L212 740" stroke={P.leather[4]} strokeWidth="1" opacity="0.6" />
            {/* crown of glowing leaves over the beam */}
            <path d="M196 648 Q180 620 204 604 Q214 580 244 590 Q262 568 290 584 Q320 574 334 598 Q360 610 344 648 Q300 626 270 632 Q236 628 196 648 Z" fill={P.verdigris[1]} stroke={INK} strokeWidth="1.8" />
            <path d="M210 616 q16 -14 34 -10 M270 594 q18 -8 34 4 M318 612 q14 0 20 12" stroke={P.verdigris[4]} strokeWidth="2" fill="none" opacity="0.6" strokeLinecap="round" />
          </g>
          {/* warp threads and the skill graph woven on them */}
          <g stroke={P.gold[4]} strokeWidth="0.6" opacity="0.5">
            {[222, 234, 246, 258, 270, 282, 294, 306, 318].map((x) => (
              <path key={x} d={`M${x} 646 V770`} />
            ))}
          </g>
          <g filter="url(#glow)">
            {LOOM_EDGES.map(([a, b], i) => (
              <path key={i} d={`M${f(LOOM_NODES[a]!.x)} ${f(LOOM_NODES[a]!.y)} L${f(LOOM_NODES[b]!.x)} ${f(LOOM_NODES[b]!.y)}`} stroke={GLOW.thread} strokeWidth="1" opacity="0.8" />
            ))}
            {LOOM_NODES.map((n, i) => (
              <circle key={i} cx={f(n.x)} cy={f(n.y)} r="2.6" fill={[GLOW.thread, GLOW.rune, GLOW.hex][n.c]} />
            ))}
          </g>
          <g filter="url(#glow)">
            {[204, 226, 250, 282, 306, 330, 240, 296].map((x, i) => (
              <circle key={i} cx={x} cy={604 + ((i * 13) % 34)} r="1.8" fill={GLOW.hex} />
            ))}
          </g>
        </g>

        {lamp(170, 330)}
        {lamp(370, 330)}
        {lamp(160, 640)}
        {lamp(380, 640)}
      </Layer>

      {/* ---------- layer 3: foreground roofs, bunting, hedges ---------- */}
      <Layer n={3}>
        <g filter="url(#wc)" strokeLinejoin="round">
          {/* string of lanterns across the top of the square */}
          <path d="M-20 214 Q130 262 270 250 Q410 262 560 214" stroke={INK} strokeWidth="1.2" fill="none" />
          {Array.from({ length: 13 }, (_, i) => {
            const t = i / 12;
            const x = -20 + t * 580;
            const y = t < 0.5 ? 214 + (1 - Math.pow(1 - 2 * t, 2)) * 42 : 214 + (1 - Math.pow(2 * t - 1, 2)) * 42;
            const c = [P.oxblood[3], P.gold[3], P.sapphire[3], P.verdigris[3]][i % 4]!;
            return (
              <g key={i}>
                <path d={`M${f(x - 4)} ${f(y)} L${f(x + 4)} ${f(y)} L${f(x)} ${f(y + 9)} Z`} fill={c} stroke={INK} strokeWidth="0.8" />
              </g>
            );
          })}
          {/* dark hedges and a bench low in the frame */}
          <path d="M-24 880 Q20 850 70 862 Q110 846 150 870 L150 980 L-24 980 Z" fill="#141c1a" stroke={INK} strokeWidth="1.6" />
          <path d="M564 880 Q520 850 470 862 Q430 846 390 870 L390 980 L564 980 Z" fill="#141c1a" stroke={INK} strokeWidth="1.6" />
          <path d="M-10 870 q20 -10 40 -4 M420 862 q20 -8 40 0" stroke="#2f4a40" strokeWidth="2" fill="none" opacity="0.7" />
        </g>
      </Layer>

      {/* ---------- layer 4: fireflies ---------- */}
      <Layer n={4}>
        <g filter="url(#glow)">
          {FIREFLIES.map((m, i) =>
            m.t < 0.55 ? null : <circle key={i} cx={f(m.x)} cy={f(m.y)} r={f(0.6 + m.s * 1.2)} fill={m.t > 0.85 ? GLOW.violet : P.gold[4]} opacity={f(0.4 + m.s * 0.5)} />,
          )}
        </g>
      </Layer>

      <Atmosphere light={{ x: 540, y: 320, color: "#c9a8ff", strength: 0.8 }} rays={{ n: 5, spread: 0.8, length: 900, seed: 6 }} haze={{ y: 320, color: "#6a44a3", opacity: 0.18 }} pools={[[540, 1180, 460, 220]]} poolColor="#ffd98a" vignette={0.45} />
      <rect width="1080" height="1920" fill={url("vig")} />
      <rect width="1080" height="1920" fill={url("bottom")} />
      <g transform="scale(2)">
        <rect width="540" height="960" filter="url(#grain)" opacity="0.16" />
      </g>
    </svg>
  );
}
