import { useId } from "react";
import { INK, P, GLOW } from "../palette";
import type { FigureMeta, FigureProps } from "../types";

export const meta: FigureMeta = { id: "hound", viewBox: [0, 0, 240, 200], feet: { x: 124, y: 188 }, head: [26, 50, 76, 76], facing: "left" };

/* bone spikes along the spine: [x, y on the back line, height] */
const SPINES: [number, number, number][] = [
  [98, 74, 15],
  [110, 71, 17],
  [122, 72, 16],
  [134, 76, 14],
  [146, 80, 12],
  [158, 83, 10],
  [170, 85, 9],
  [182, 88, 7],
];

/** The Hound: a lean ash wolf with a bone face plate, a ridge of bone spikes and a coat cracked with smouldering embers. */
export default function Hound({ viewBox, className, pose = "idle" }: FigureProps) {
  const u = useId().replace(/:/g, "");
  const id = (s: string) => `${u}-${s}`;
  const url = (s: string) => `url(#${id(s)})`;
  const strike = pose === "strike";

  const CRACKS = [
    "M88 98 L94 103 L92 109 L99 115 M94 103 L101 101",
    "M124 94 L131 100 L128 107 L135 112 L133 118 M131 100 L138 98",
    "M168 104 L175 110 L172 117 L179 123 M175 110 L182 108",
    "M110 122 L116 126 L114 132",
    "M206 114 L211 121 L209 128",
  ];
  const cracks = (
    <g fill="none">
      <g stroke={P.ember[2]} strokeWidth="4" opacity="0.35">
        {CRACKS.map((d, i) => <path key={i} d={d} />)}
      </g>
      <g stroke={P.ember[1]} strokeWidth="2.4">
        {CRACKS.map((d, i) => <path key={i} d={d} />)}
      </g>
      <g stroke={P.ember[4]} strokeWidth="1">
        {CRACKS.map((d, i) => <path key={i} d={d} />)}
      </g>
    </g>
  );

  return (
    <svg viewBox={viewBox ?? meta.viewBox.join(" ")} className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id("coat")} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#c2b8b8" />
          <stop offset="0.3" stopColor="#8a7f88" />
          <stop offset="0.75" stopColor="#554a5c" />
          <stop offset="1" stopColor="#30263a" />
        </linearGradient>
        <linearGradient id={id("coatDark")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4f4556" />
          <stop offset="1" stopColor="#1c1622" />
        </linearGradient>
        <linearGradient id={id("ruff")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.ash[3]} />
          <stop offset="1" stopColor={P.slate[1]} />
        </linearGradient>
        <linearGradient id={id("bone")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.bone[4]} />
          <stop offset="0.6" stopColor={P.bone[3]} />
          <stop offset="1" stopColor={P.bone[1]} />
        </linearGradient>
        <radialGradient id={id("eye")}>
          <stop offset="0" stopColor="#fff4d6" />
          <stop offset="0.35" stopColor={GLOW.ember} />
          <stop offset="1" stopColor={P.ember[2]} stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx={strike ? 132 : 124} cy="188" rx={strike ? 62 : 84} ry="7" fill={INK} opacity={strike ? 0.22 : 0.32} filter="url(#wc-wash)" />

      <g filter="url(#fig)" stroke={INK} strokeLinejoin="round" strokeLinecap="round" transform={strike ? "translate(-4 -24) rotate(12 130 120)" : undefined}>
        {/* ---------- far legs (behind the body) ---------- */}
        {strike ? (
          <g fill={url("coatDark")} strokeWidth="2">
            <path d="M104 126 C92 138 78 148 64 154 C56 158 50 160 48 164 C54 168 62 166 70 162 C86 156 102 148 116 138 Z" />
            <path d="M156 116 C170 126 184 136 198 146 C206 152 214 158 222 162 C220 168 210 168 202 164 C186 156 170 146 148 132 Z" />
          </g>
        ) : (
          <g fill={url("coatDark")} strokeWidth="2">
            <path d="M100 134 C102 146 102 158 102 168 C101 174 100 178 98 182 C94 184 92 186 92 188 L110 188 C110 184 108 180 107 174 C108 164 110 150 112 136 Z" />
            <path d="M150 112 C160 120 164 132 170 142 C174 150 178 158 180 166 C180 172 176 180 174 184 C173 187 170 188 166 188 L152 188 C152 185 156 183 164 181 C166 176 168 172 168 168 C164 162 158 156 152 150 C146 144 142 134 142 124 Z" />
          </g>
        )}

        {/* tail */}
        <path d={strike ? "M188 96 C206 94 222 100 236 108 C230 110 226 112 224 114 C230 116 234 120 236 124 C224 124 210 118 192 116 Z" : "M188 96 C204 98 218 110 226 128 C230 138 232 146 230 154 C226 148 222 144 218 142 C218 148 216 152 212 154 C210 140 204 128 192 118 Z"} fill={url("coat")} strokeWidth="2.2" />

        {/* torso with a shaggy underside */}
        <path d="M84 78 C100 70 118 70 136 78 C156 86 176 82 190 90 C198 100 198 116 190 128 C180 134 166 132 152 128 C140 134 126 140 116 142 L112 150 L106 144 L100 152 L96 144 L88 148 C78 142 70 132 68 118 C68 102 74 88 84 78 Z" fill={url("coat")} strokeWidth="2.5" />
        {/* shadow wash under the belly and haunch */}
        <path d="M76 128 C90 138 110 140 130 134 C150 126 170 128 190 124 C186 130 180 134 170 134 C160 134 152 130 146 132 C134 138 120 144 108 146 C94 146 82 138 76 128 Z" fill={P.slate[1]} stroke="none" opacity="0.5" />
        {/* fur hatching */}
        <g fill="none" stroke={P.ash[1]} strokeWidth="1.1" opacity="0.7">
          <path d="M120 90 L126 98 M140 92 L146 100 M156 96 L162 104 M112 108 L118 116 M150 110 L156 118 M128 120 L134 126" />
        </g>
        <path d="M100 76 C116 72 134 76 150 84" fill="none" stroke={P.ash[4]} strokeWidth="1.3" opacity="0.8" />

        <ellipse cx="130" cy="112" rx="34" ry="12" fill={P.ember[2]} stroke="none" opacity="0.28" filter="url(#glow-soft)" />
        {/* ember cracks */}
        {cracks}

        {/* bone ridge along the spine */}
        <path d="M92 76 C110 68 132 72 150 80 C166 86 180 86 190 92" fill="none" stroke={P.bone[1]} strokeWidth="3" />
        {SPINES.map(([x, y, h], i) => (
          <path key={i} d={`M${x - 6} ${y + 3} C${x - 3} ${y - h * 0.5} ${x + 2} ${y - h} ${x + 7} ${y - h} C${x + 6} ${y - h * 0.4} ${x + 6} ${y} ${x + 5} ${y + 3} Z`} fill={url("bone")} strokeWidth="1.5" />
        ))}

        {/* smoulder: ember motes rising from the ridge */}
        <g fill={GLOW.ember} stroke="none">
          <circle cx="118" cy="52" r="1.4" opacity="0.9" />
          <circle cx="140" cy="60" r="1.1" opacity="0.8" />
          <circle cx="104" cy="46" r="0.9" opacity="0.7" />
          <circle cx="160" cy="66" r="1.2" opacity="0.85" />
          <circle cx="128" cy="40" r="0.8" opacity="0.6" />
        </g>
        {/* hind near leg */}
        {strike ? (
          <g><path d="M164 102 C182 96 198 108 198 122 C204 130 214 138 228 144 C234 146 236 150 232 154 C222 156 210 152 198 146 C186 142 174 140 162 130 Z" fill={url("coat")} stroke="none" /><path d="M198 120 C204 130 214 138 228 144 C234 146 236 150 232 154 C222 156 210 152 198 146 C188 142 180 140 172 136" fill="none" strokeWidth="2.4" /><path d="M226 146 L232 144 M230 152 L236 151" fill="none" strokeWidth="1.2" /></g>
        ) : (
          <g><path d="M166 98 C184 96 198 108 196 126 C195 136 190 142 186 148 C190 154 194 160 196 166 C196 172 192 178 190 184 C189 187 186 188 182 188 L166 188 C166 185 170 183 180 181 C182 176 184 172 184 168 C180 162 174 156 168 150 C160 142 156 134 156 122 C156 110 158 102 166 98 Z" fill={url("coat")} stroke="none" /><path d="M196 124 C195 136 190 142 186 148 C190 154 194 160 196 166 C196 172 192 178 190 184 C189 187 186 188 182 188 L166 188 C166 185 170 183 180 181 C182 176 184 172 184 168 C180 162 174 156 168 150 C162 144 158 136 157 128" fill="none" strokeWidth="2.4" /><path d="M168 104 C162 112 160 120 162 130" fill="none" stroke="#30263a" strokeWidth="1.2" opacity="0.7" /></g>
        )}
        {!strike && (
          <g fill="none">
            <path d="M162 112 C164 126 170 140 180 150" stroke={P.ash[1]} strokeWidth="1.2" opacity="0.8" />
            <path d="M186 150 C190 156 192 162 192 170" stroke={P.ash[4]} strokeWidth="1" opacity="0.6" />
            <path d="M170 186 L167 190 M176 186 L173 190" stroke={INK} strokeWidth="1.3" />
          </g>
        )}

        {/* front near leg */}
        {strike ? (
          <path transform="translate(2 10) rotate(6 90 120)" d="M80 116 C70 124 58 130 46 132 C40 132 34 134 32 138 C36 142 46 142 54 140 C68 138 82 134 96 128 Z" fill={url("coat")} strokeWidth="2.4" />
        ) : (
          <path d="M72 118 C74 132 76 146 76 158 C76 166 75 172 74 176 C68 180 62 182 60 186 C60 188 62 189 66 189 L82 189 C84 186 82 180 81 174 C82 164 84 152 86 140 C88 132 90 126 92 122 Z" fill={url("coat")} strokeWidth="2.4" />
        )}
        {strike ? (
          <path transform="translate(2 10) rotate(6 90 120)" d="M34 131 L27 132 M34 135 L28 138 M38 137 L33 141" fill="none" strokeWidth="1.3" />
        ) : (
          <g fill="none">
            <path d="M86 136 C84 148 82 160 80 170" stroke={P.ash[1]} strokeWidth="1.2" opacity="0.8" />
            <path d="M75 128 C77 140 78 152 78 162" stroke={P.ash[4]} strokeWidth="1" opacity="0.7" />
            <path d="M62 186 L58 190 M68 186 L65 190" strokeWidth="1.3" />
          </g>
        )}

        {/* neck ruff */}
        <path d="M70 112 C68 92 76 78 90 72 C98 70 106 72 112 76 L106 84 L116 88 L106 94 L114 102 L100 104 L106 114 L92 112 L96 124 L82 118 L80 130 C74 126 70 120 70 112 Z" fill={url("ruff")} strokeWidth="2.2" />
        <path d="M84 80 L90 92 M78 92 L86 104 M92 90 L98 100" fill="none" stroke={P.ash[4]} strokeWidth="1.1" opacity="0.7" />

        {/* ---------- head ---------- */}
        <g transform={strike ? "rotate(-10 86 96)" : undefined}>
          {/* ears laid back */}
          <path d="M78 78 L84 58 L90 76 Z" fill={P.ash[1]} strokeWidth="1.8" />
          <path d="M84 80 L98 58 L98 84 Z" fill={url("ruff")} strokeWidth="2" />
          <path d="M89 76 L96 65 L96 80 Z" fill={P.oxblood[1]} stroke="none" opacity="0.7" />
          {/* lower jaw */}
          {strike && <path d="M84 100 L34 100 L46 128 Z" fill={P.oxblood[0]} strokeWidth="1.4" />}
          <g transform={strike ? "rotate(-30 80 102)" : undefined}>
            <path d="M36 103 C42 108 52 112 62 112 C70 112 78 108 82 102 L62 101 C54 102 44 103 36 103 Z" fill={url("coatDark")} strokeWidth="2" />
            <path d="M40 104 L42 97 L45 104 M50 105 L52 99 L55 105" fill={P.bone[4]} strokeWidth="1" />
            <path d="M44 108 C52 110 62 110 72 106" fill="none" stroke={P.ash[4]} strokeWidth="1" opacity="0.6" />
          </g>
          {/* mouth interior */}
          <path d="M36 101 C50 100 64 99 80 99 L81 105 C66 106 50 106 38 105 Z" fill={P.oxblood[0]} stroke="none" />
          {/* skull and muzzle */}
          <path d="M94 88 C90 76 80 70 70 71 C61 72 56 79 50 83 C44 86 38 89 34 92 C30 95 31 100 36 101 C44 102 52 101 60 101 C68 106 80 106 88 100 C94 96 96 92 94 88 Z" fill={url("coat")} strokeWidth="2.4" />
          <path d="M60 101 C68 104 78 104 86 99" fill="none" stroke={P.ash[1]} strokeWidth="1.1" />
          {/* snarl wrinkles */}
          <path d="M44 95 C47 97 51 97 54 95 M50 92 C54 94 58 94 60 92" fill="none" stroke={P.ash[1]} strokeWidth="1" />
          {/* bared upper fangs */}
          <path d="M38 101 L40 108 L42 101 M46 101 L47 105 L49 101 M54 101 L56 110 L59 101" fill={P.bone[4]} strokeWidth="1.1" />
          {/* bone face plate */}
          <path d="M92 84 C86 74 74 69 64 72 C58 75 54 80 48 84 C43 86 39 88 36 91 L40 93 C46 91 52 89 58 88 C62 88 66 90 68 94 C76 92 86 90 92 84 Z" fill={url("bone")} strokeWidth="2" />
          <path d="M86 79 L104 66 L92 84 Z" fill={url("bone")} strokeWidth="1.5" />
          <path d="M42 89 C52 85 62 81 76 78" fill="none" stroke={P.bone[1]} strokeWidth="1" />
          <path d="M56 80 L59 84 L56 87 M80 76 L78 82" fill="none" stroke={INK} strokeWidth="1" />
          <path d="M44 86 C52 80 60 75 70 73" fill="none" stroke="#fffaf0" strokeWidth="1.2" opacity="0.85" />
          {/* nose */}
          <path d="M30 94 C31 91 36 91 38 93 C38 97 33 98 30 96 Z" fill={INK} strokeWidth="1" />
          {/* eye socket and ember eye */}
          <path d="M62 84 C65 81 71 81 74 84 C72 88 66 89 62 86 Z" fill="#120a08" strokeWidth="1.3" />
          <circle cx="68" cy="84.5" r="7" fill={url("eye")} stroke="none" opacity="0.75" />
          <ellipse cx="68" cy="84.5" rx="2.4" ry="1.5" fill={GLOW.ember} stroke="none" filter="url(#glow)" />
        </g>
      </g>
    </svg>
  );
}
