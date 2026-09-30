import { useId } from "react";
import { INK, P, GLOW } from "../palette";
import type { FigureMeta, FigureProps } from "../types";

export const meta: FigureMeta = { id: "keeper", viewBox: [0, 0, 240, 300], feet: { x: 118, y: 288 }, head: [88, 44, 66, 66], facing: "left" };

const RIVETS_CHEST: [number, number][] = [
  [88, 122], [86, 142], [87, 162], [90, 180], [160, 122], [162, 142], [161, 162], [158, 180], [124, 118], [124, 176],
];
const RIVETS_SHIELD: [number, number][] = [
  [38, 126], [60, 122], [82, 122], [36, 160], [36, 200], [37, 240], [86, 160], [86, 200], [85, 240], [50, 266], [72, 266],
];

/** The Keeper: a hulking warden-construct in verdigris-bitten iron plate, bearing a tower shield and a great maul. */
export default function Keeper({ viewBox, className, pose = "idle" }: FigureProps) {
  const u = useId().replace(/:/g, "");
  const id = (s: string) => `${u}-${s}`;
  const url = (s: string) => `url(#${id(s)})`;
  const strike = pose === "strike";
  const maulT = strike ? "translate(132 198) rotate(-112) scale(1.12)" : "translate(172 128) rotate(16) scale(1.08)";
  const bodyT = strike ? "rotate(-7 124 206)" : undefined;
  const shieldT = strike ? "translate(24 2) rotate(6 60 190)" : undefined;
  const rivet = (x: number, y: number, k: string) => <circle key={k} cx={x} cy={y} r="2.1" fill={url("gold")} stroke={INK} strokeWidth="0.8" />;
  return (
    <svg viewBox={viewBox ?? meta.viewBox.join(" ")} className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id("iron")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.steel[3]} />
          <stop offset="0.35" stopColor={P.steel[2]} />
          <stop offset="0.75" stopColor={P.steel[1]} />
          <stop offset="1" stopColor={P.slate[1]} />
        </linearGradient>
        <linearGradient id={id("ironH")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={P.steel[3]} />
          <stop offset="0.45" stopColor={P.steel[2]} />
          <stop offset="1" stopColor={P.slate[1]} />
        </linearGradient>
        <linearGradient id={id("dark")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.steel[2]} />
          <stop offset="1" stopColor={P.slate[0]} />
        </linearGradient>
        <linearGradient id={id("shield")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.verdigris[3]} />
          <stop offset="0.4" stopColor={P.verdigris[2]} />
          <stop offset="0.8" stopColor={P.verdigris[1]} />
          <stop offset="1" stopColor={P.verdigris[0]} />
        </linearGradient>
        <linearGradient id={id("gold")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.gold[4]} />
          <stop offset="0.45" stopColor={P.gold[3]} />
          <stop offset="1" stopColor={P.gold[1]} />
        </linearGradient>
        <linearGradient id={id("haft")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={P.leather[3]} />
          <stop offset="0.5" stopColor={P.leather[2]} />
          <stop offset="1" stopColor={P.leather[0]} />
        </linearGradient>
        <linearGradient id={id("tabard")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.oxblood[3]} />
          <stop offset="0.5" stopColor={P.oxblood[2]} />
          <stop offset="1" stopColor={P.oxblood[1]} />
        </linearGradient>
        <radialGradient id={id("slit")} cx="0.35" cy="0.5" r="0.7">
          <stop offset="0" stopColor="#fff4d8" />
          <stop offset="0.4" stopColor={GLOW.ember} />
          <stop offset="1" stopColor={P.ember[2]} />
        </radialGradient>
        <radialGradient id={id("impact")}>
          <stop offset="0" stopColor={P.gold[4]} stopOpacity="0.9" />
          <stop offset="0.5" stopColor={GLOW.ember} stopOpacity="0.45" />
          <stop offset="1" stopColor={P.ember[2]} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ground shadow */}
      <ellipse cx="116" cy="287" rx="92" ry="10" fill={INK} opacity="0.32" filter="url(#wc-wash)" />
      {strike && <ellipse cx="50" cy="280" rx="46" ry="18" fill={url("impact")} />}

      <g filter="url(#wc)" stroke={INK} strokeLinejoin="round" strokeLinecap="round">
        {/* ---------- back leg ---------- */}
        <path d="M130 192 L162 190 C164 206 164 222 162 236 L134 240 C132 224 130 208 130 192 Z" fill={url("dark")} strokeWidth="2.4" />
        <path d="M137 248 L163 245 C166 256 167 268 168 278 L139 280 C139 268 138 258 137 248 Z" fill={url("dark")} strokeWidth="2.4" />
        <path d="M156 250 C159 260 160 270 161 278" fill="none" stroke={P.slate[0]} strokeWidth="3" opacity="0.5" />
        <ellipse cx="149" cy="241" rx="15" ry="11" fill={url("iron")} strokeWidth="2.2" />
        <path d="M140 238 C146 234 154 234 158 238" fill="none" stroke={P.steel[4]} strokeWidth="1.2" opacity="0.8" />
        <path d="M128 288 C128 278 136 273 146 273 L170 273 C174 279 175 285 173 288 Z" fill={url("dark")} strokeWidth="2.4" />
        <path d="M136 280 L170 280" fill="none" strokeWidth="1.1" />

        {/* ---------- front leg ---------- */}
        <path d="M88 192 L118 192 C116 208 114 222 111 236 L84 234 C85 220 86 206 88 192 Z" fill={url("iron")} strokeWidth="2.4" />
        <path d="M84 244 L109 244 C108 256 106 268 105 278 L82 278 C82 266 83 256 84 244 Z" fill={url("iron")} strokeWidth="2.4" />
        <ellipse cx="97" cy="239" rx="14" ry="10" fill={url("iron")} strokeWidth="2.2" />
        <path d="M60 288 C62 278 70 273 80 273 L106 273 L108 288 Z" fill={url("iron")} strokeWidth="2.4" />
        <path d="M68 280 L106 280" fill="none" strokeWidth="1.1" />
        {rivet(97, 239, "kn1")}
        {rivet(149, 241, "kn2")}

        {/* ---------- upper body (leans into the strike) ---------- */}
        <g transform={bodyT}>
          {/* tassets / plated skirt */}
          <path d="M76 184 L172 184 L178 214 C168 220 158 220 150 216 L138 222 C130 224 122 222 116 216 L102 222 C92 222 82 218 72 212 Z" fill={url("iron")} strokeWidth="2.4" />
          <path d="M100 188 L102 220 M124 188 L126 220 M150 188 L150 216" fill="none" strokeWidth="1.2" />
          <path d="M74 200 C104 204 146 204 176 200" fill="none" stroke={P.gold[2]} strokeWidth="2.2" />
          <path d="M150 190 L176 204 L178 214 C168 220 158 220 150 216 Z" fill={P.slate[0]} stroke="none" opacity="0.4" />
          <path d="M104 206 C104 212 108 216 114 214 M128 206 C130 212 136 216 142 214" fill="none" stroke={P.verdigris[3]} strokeWidth="2.4" opacity="0.55" />

          {/* oxblood warden's tabard hanging from the belt */}
          <path d="M108 196 C118 198 132 198 142 196 L146 250 C140 256 134 252 126 258 C118 252 112 256 104 250 Z" fill={url("tabard")} strokeWidth="2.2" />
          <path d="M130 200 L140 198 L144 250 C140 254 136 252 130 256 Z" fill={P.oxblood[0]} stroke="none" opacity="0.45" />
          <path d="M107 244 C113 250 118 247 126 252 C134 247 139 250 145 244" fill="none" stroke={P.gold[3]} strokeWidth="2" />
          <path d="M125 208 L119 222 L125 236 L131 222 Z" fill={url("gold")} strokeWidth="1.2" />
          <path d="M114 204 C112 220 111 234 110 246" fill="none" stroke={P.oxblood[4]} strokeWidth="1.2" opacity="0.7" />
          {/* back pauldron (behind the torso's far edge) */}
          <path d="M140 94 C156 82 182 86 190 102 C194 114 190 126 182 132 C170 128 156 124 146 124 Z" fill={url("dark")} strokeWidth="2.4" />
          <path d="M150 124 C164 124 176 128 184 134 C184 142 178 146 170 146 C160 142 152 138 146 134 Z" fill={url("dark")} strokeWidth="2" />

          {/* barrel breastplate */}
          <path d="M80 112 C76 138 78 166 84 190 L166 190 C172 166 174 138 168 112 C150 100 100 100 80 112 Z" fill={url("iron")} strokeWidth="2.6" />
          {/* shadow side and underside of the chest */}
          <path d="M142 106 C156 106 164 108 168 112 C174 138 172 166 166 190 L136 190 C150 168 152 136 142 106 Z" fill={P.slate[0]} stroke="none" opacity="0.45" />
          <path d="M84 170 C110 180 142 180 166 170 L166 190 L84 190 Z" fill={P.slate[0]} stroke="none" opacity="0.3" />
          {/* lit edge */}
          <path d="M86 116 C83 138 84 160 88 180" fill="none" stroke={P.steel[4]} strokeWidth="1.6" opacity="0.8" />
          {/* central ridge and plate seams */}
          <path d="M122 106 C120 130 120 158 124 188" fill="none" strokeWidth="1.3" />
          <path d="M118 108 C116 130 116 158 119 186" fill="none" stroke={P.steel[4]} strokeWidth="1.2" opacity="0.7" />
          <path d="M82 150 C104 158 146 158 170 150" fill="none" strokeWidth="1.2" />
          <path d="M82 152 C104 160 146 160 170 152" fill="none" stroke={P.gold[2]} strokeWidth="1.8" />
          {/* verdigris patina blooms and drips */}
          <path d="M92 128 C98 122 108 126 106 134 C104 142 110 146 106 150 C98 148 90 140 92 128 Z" fill={P.verdigris[3]} stroke="none" opacity="0.5" />
          <path d="M140 160 C148 156 156 162 152 170 C150 176 154 182 150 186 C142 182 136 168 140 160 Z" fill={P.verdigris[2]} stroke="none" opacity="0.55" />
          <path d="M96 166 L94 184 M132 124 C134 130 132 138 134 144" fill="none" stroke={P.verdigris[3]} strokeWidth="1.8" opacity="0.6" />
          {RIVETS_CHEST.map(([x, y], i) => rivet(x, y, `c${i}`))}

          {/* gorget */}
          <path d="M98 104 C108 96 136 96 148 104 L146 116 C134 110 112 110 100 116 Z" fill={url("dark")} strokeWidth="2.2" />
          <path d="M100 112 C114 106 132 106 146 112" fill="none" stroke={P.gold[2]} strokeWidth="1.6" />

          {/* ---------- great helm ---------- */}
          <path d="M104 108 C98 96 97 78 102 66 C110 56 132 54 142 62 C148 72 148 96 144 108 C132 112 116 112 104 108 Z" fill={url("iron")} strokeWidth="2.6" />
          {/* far-side shadow */}
          <path d="M130 58 C138 58 142 60 144 64 C148 76 148 96 144 108 C138 110 132 110 128 110 C136 94 136 72 130 58 Z" fill={P.slate[0]} stroke="none" opacity="0.5" />
          {/* forward face plate ridge */}
          <path d="M103 68 C99 80 99 96 104 108" fill="none" stroke={P.steel[4]} strokeWidth="1.8" opacity="0.85" />
          <path d="M116 58 C112 76 112 96 116 110" fill="none" strokeWidth="1.2" />
          {/* gold crest comb */}
          <path d="M104 64 C110 50 132 46 144 56 C140 58 136 60 134 62 C124 56 112 58 104 64 Z" fill={url("gold")} strokeWidth="1.8" />
          <path d="M112 58 L112 54 M120 55 L120 51 M128 55 L129 51 M136 57 L138 53" fill="none" strokeWidth="1" />
          {/* breathing holes */}
          <circle cx="108" cy="98" r="1.3" fill={INK} stroke="none" />
          <circle cx="113" cy="100" r="1.3" fill={INK} stroke="none" />
          <circle cx="108" cy="103" r="1.3" fill={INK} stroke="none" />
          <path d="M136 96 C140 100 140 104 138 108" fill="none" stroke={P.verdigris[3]} strokeWidth="2.2" opacity="0.6" />
          {/* the glowing slit */}
          <path d="M99 82 C108 80 122 80 132 82 L131 88 C120 87 108 87 100 89 Z" fill="#1a0c08" strokeWidth="1.6" />
          <path d="M101 85 C110 83.5 120 83.5 129 85" fill="none" stroke={url("slit")} strokeWidth="2.6" filter="url(#glow)" />
          {rivet(124, 70, "h1")}
          {rivet(138, 94, "h2")}

          {/* front pauldron, over the shield arm */}
          <path d="M68 104 C70 88 88 80 106 86 C114 92 116 104 112 114 C98 112 82 114 70 120 Z" fill={url("iron")} strokeWidth="2.4" />
          <path d="M70 118 C84 112 100 112 112 114 L110 124 C96 122 82 124 72 130 Z" fill={url("iron")} strokeWidth="2" />
          <path d="M72 128 C84 122 98 122 110 124 L108 134 C96 132 84 134 74 140 Z" fill={url("dark")} strokeWidth="2" />
          <path d="M70 104 C78 94 92 90 104 92" fill="none" stroke={P.steel[4]} strokeWidth="1.6" opacity="0.85" />
          <path d="M72 114 C84 110 98 108 110 110" fill="none" stroke={P.gold[2]} strokeWidth="1.8" />
          <path d="M92 94 C98 100 96 108 100 112" fill="none" stroke={P.verdigris[3]} strokeWidth="2.4" opacity="0.55" />
          {rivet(86, 100, "p1")}
          {rivet(100, 98, "p2")}
        </g>

        {/* ---------- tower shield ---------- */}
        <g transform={shieldT}>
          <path d="M26 126 C26 116 34 110 46 110 L84 108 C94 108 98 116 98 126 L96 262 C82 274 50 278 32 270 C28 246 26 168 26 126 Z" fill={url("shield")} strokeWidth="2.8" />
          {/* shadow side (away from the light) */}
          <path d="M74 110 L84 108 C94 108 98 116 98 126 L96 262 C88 268 80 272 70 274 C80 220 80 160 74 110 Z" fill={P.verdigris[0]} stroke="none" opacity="0.55" />
          {/* iron patches showing under the patina */}
          <path d="M34 214 C42 208 52 214 50 226 C48 236 38 238 34 232 Z" fill={P.steel[1]} stroke="none" opacity="0.55" />
          <path d="M66 134 C74 130 80 136 76 144 C72 150 64 146 66 134 Z" fill={P.steel[1]} stroke="none" opacity="0.5" />
          <path d="M44 130 C42 150 46 170 44 186 M52 232 C52 244 54 254 52 262" fill="none" stroke={P.verdigris[4]} strokeWidth="1.4" opacity="0.6" />
          {/* gold rim, inset */}
          <path d="M32 128 C32 120 38 116 46 116 L84 114 C90 114 92 120 92 128 L90 258 C78 266 52 270 38 264 C34 242 32 168 32 128 Z" fill="none" stroke={P.gold[1]} strokeWidth="4.4" />
          <path d="M32 128 C32 120 38 116 46 116 L84 114 C90 114 92 120 92 128 L90 258 C78 266 52 270 38 264 C34 242 32 168 32 128 Z" fill="none" stroke={P.gold[3]} strokeWidth="2" />
          {/* lit rim highlight */}
          <path d="M28 130 C28 120 34 113 46 112 L70 111" fill="none" stroke={P.verdigris[4]} strokeWidth="1.6" opacity="0.9" />
          {/* central boss band and keyhole sigil */}
          <path d="M60 118 L60 264" fill="none" stroke={P.gold[1]} strokeWidth="3" opacity="0.7" />
          <circle cx="60" cy="182" r="19" fill={url("gold")} strokeWidth="2.2" />
          <circle cx="60" cy="182" r="14" fill="none" stroke={P.gold[1]} strokeWidth="1.3" />
          <path d="M60 172 C55 172 53 178 56 182 L53 194 L67 194 L64 182 C67 178 65 172 60 172 Z" fill={INK} strokeWidth="1" />
          <path d="M44 168 C48 162 54 160 60 160" fill="none" stroke={P.gold[4]} strokeWidth="1.4" />
          {RIVETS_SHIELD.map(([x, y], i) => rivet(x, y, `s${i}`))}
          {/* rust-green drips beneath rivets */}
          <path d="M38 130 L38 142 M82 126 L83 140 M36 204 L36 214" fill="none" stroke={P.verdigris[4]} strokeWidth="1.3" opacity="0.7" />
          {/* gauntlet fingers curling around the far edge */}
          <path d="M94 168 C100 166 104 170 102 178 C100 186 96 188 92 186 Z" fill={url("dark")} strokeWidth="1.8" />
          <path d="M96 174 L102 174 M95 180 L101 180" fill="none" strokeWidth="1" />
        </g>

        {/* ---------- maul arm ---------- */}
        {strike ? (
          <g>
            <path d="M152 108 C166 104 180 112 178 126 C176 140 168 150 160 156 L142 150 C144 136 146 120 152 108 Z" fill={url("iron")} strokeWidth="2.4" />
            <path d="M144 150 L162 154 C158 168 150 182 142 194 L126 188 C132 174 138 162 144 150 Z" fill={url("iron")} strokeWidth="2.2" />
            <path d="M170 124 C166 138 160 148 156 154 M156 158 C152 170 146 180 140 190" fill="none" stroke={P.slate[0]} strokeWidth="4" opacity="0.4" />
            <ellipse cx="152" cy="152" rx="11" ry="9" fill={url("iron")} strokeWidth="2" />
          </g>
        ) : (
          <g>
            <path d="M166 116 L190 114 C196 126 198 140 196 152 L176 156 C172 142 168 128 166 116 Z" fill={url("dark")} strokeWidth="2.4" />
            <ellipse cx="187" cy="154" rx="11" ry="9" fill={url("iron")} strokeWidth="2" />
            <path d="M176 150 L197 146 C194 136 188 128 182 122 L164 128 C168 136 172 144 176 150 Z" fill={url("iron")} strokeWidth="2.2" />
            <path d="M190 144 C188 136 184 130 180 126" fill="none" stroke={P.slate[0]} strokeWidth="3" opacity="0.5" />
          </g>
        )}

        {/* ---------- great maul ---------- */}
        <g transform={maulT}>
          <path d="M-3.5 44 L-3 -96 L3 -96 L3.5 44 Z" fill={url("haft")} strokeWidth="2.2" />
          <path d="M-4 14 L4 10 M-4 22 L4 18 M-4 30 L4 26" fill="none" strokeWidth="1" />
          <path d="M-6 42 L6 42 L5 52 L-5 52 Z" fill={url("gold")} strokeWidth="1.8" />
          <path d="M-6 -86 L6 -86 L6 -80 L-6 -80 Z" fill={url("gold")} strokeWidth="1.6" />
          {/* head: a heavy flared iron block */}
          <path d="M-30 -118 L-24 -122 L24 -122 L30 -118 L30 -82 L24 -78 L-24 -78 L-30 -82 Z" fill={url("ironH")} strokeWidth="2.8" />
          <path d="M8 -122 L24 -122 L30 -118 L30 -82 L24 -78 L8 -78 Z" fill={P.slate[0]} stroke="none" opacity="0.4" />
          {/* striking faces */}
          <path d="M-36 -116 L-30 -118 L-30 -82 L-36 -84 Z" fill={url("dark")} strokeWidth="2.2" />
          <path d="M36 -116 L30 -118 L30 -82 L36 -84 Z" fill={url("dark")} strokeWidth="2.2" />
          {/* gold bands and a rune plate */}
          <path d="M-22 -122 L-16 -122 L-16 -78 L-22 -78 Z M16 -122 L22 -122 L22 -78 L16 -78 Z" fill={url("gold")} strokeWidth="1.4" />
          <path d="M-8 -108 L8 -108 L8 -92 L-8 -92 Z" fill={P.verdigris[2]} strokeWidth="1.3" />
          <path d="M-4 -104 L4 -96 M4 -104 L-4 -96" fill="none" stroke={P.gold[3]} strokeWidth="1.2" />
          <path d="M-28 -116 L-6 -118" fill="none" stroke={P.steel[4]} strokeWidth="1.4" opacity="0.8" />
          <path d="M-12 -84 C-10 -80 -6 -80 -4 -84" fill="none" stroke={P.verdigris[3]} strokeWidth="2" opacity="0.6" />
          {/* top spike */}
          <path d="M-5 -122 L0 -136 L5 -122 Z" fill={url("iron")} strokeWidth="1.8" />
        </g>

        {/* gauntlet over the haft */}
        {strike ? (
          <path d="M124 190 C128 182 140 182 144 190 L142 206 C136 212 126 210 122 204 Z" fill={url("iron")} strokeWidth="2.2" />
        ) : (
          <path d="M162 120 C164 114 178 112 184 118 L184 134 C178 140 166 140 162 134 Z" fill={url("iron")} strokeWidth="2.2" />
        )}
        {strike ? (
          <path d="M126 194 L141 193 M125 200 L141 199" fill="none" strokeWidth="1" />
        ) : (
          <path d="M165 122 L182 121 M164 128 L182 128" fill="none" strokeWidth="1" />
        )}
      </g>

      {/* unfiltered glows */}
      <g transform={bodyT}>
        <ellipse cx="114" cy="85" rx="16" ry="6" fill={GLOW.ember} opacity="0.45" filter="url(#glow-soft)" />
        <path d="M103 85 C110 84 118 84 126 85" fill="none" stroke="#fff1cf" strokeWidth="1.2" strokeLinecap="round" />
      </g>
      {strike && (
        <g fill="none" stroke={INK} strokeLinecap="round">
          <ellipse cx="46" cy="276" rx="22" ry="7" fill={GLOW.ember} stroke="none" opacity="0.55" filter="url(#glow-soft)" />
          <path d="M50 284 L30 290 M50 284 L68 294 M46 286 L40 297" strokeWidth="1.6" />
          <path d="M20 266 C22 254 28 248 34 250 M74 262 C78 252 86 250 90 256" stroke={P.stone[3]} strokeWidth="2.4" opacity="0.8" />
          <path d="M22 280 L10 276 M80 276 L92 272 M30 260 L22 252" stroke={GLOW.ember} strokeWidth="2" filter="url(#glow)" />
          <path d="M200 26 C150 -4 50 18 16 180 M170 18 C120 10 60 44 38 160" stroke={P.steel[3]} strokeWidth="2.2" opacity="0.55" strokeDasharray="14 8" />
        </g>
      )}
    </svg>
  );
}
