import { useId } from "react";
import { INK, P, GLOW, PAPER } from "../palette";
import type { FigureMeta, FigureProps } from "../types";

export const meta: FigureMeta = { id: "king", viewBox: [0, 0, 320, 400], feet: { x: 168, y: 388 }, head: [122, 44, 86, 86], facing: "left" };

/** Loose pages orbiting the King: [x, y, rotation]. */
const PAGES_IDLE: [number, number, number][] = [
  [34, 118, -18], [268, 84, 14], [292, 214, 24], [22, 248, -8], [262, 318, -26], [58, 44, 10],
];
const PAGES_STRIKE: [number, number, number][] = [
  [20, 150, -48], [238, 36, 38], [296, 150, 62], [30, 290, -30], [286, 290, 12], [132, 12, -24],
];

/** The Bound King: a crowned lich in violet and oxblood, wound in chains, circled by the torn pages of his own law. */
export default function King({ viewBox, className, pose = "idle" }: FigureProps) {
  const u = useId().replace(/:/g, "");
  const id = (s: string) => `${u}-${s}`;
  const url = (s: string) => `url(#${id(s)})`;
  const strike = pose === "strike";
  const pages = strike ? PAGES_STRIKE : PAGES_IDLE;
  const chainL = strike ? "M100 262 C80 250 60 226 40 214 C26 206 14 204 4 208" : "M100 262 C84 282 74 318 56 338 C44 352 24 358 8 352";
  const chainR = strike ? "M244 252 C262 232 280 200 290 172 C296 156 306 146 316 144" : "M244 252 C264 270 282 300 274 338 C268 366 290 382 314 378";
  const chain = (d: string, k: string) => (
    <g key={k} fill="none" strokeLinecap="butt">
      <path d={d} stroke={INK} strokeWidth="8" strokeLinecap="round" />
      <path d={d} stroke={P.steel[3]} strokeWidth="5" strokeDasharray="8 3" />
      <path d={d} stroke={P.steel[4]} strokeWidth="1.4" strokeDasharray="4 7" opacity="0.9" />
    </g>
  );
  return (
    <svg viewBox={viewBox ?? meta.viewBox.join(" ")} className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id("robe")} x1="0" y1="0" x2="1" y2="0.7">
          <stop offset="0" stopColor={P.violet[3]} />
          <stop offset="0.35" stopColor={P.violet[2]} />
          <stop offset="0.75" stopColor={P.violet[1]} />
          <stop offset="1" stopColor={P.violet[0]} />
        </linearGradient>
        <linearGradient id={id("blood")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.oxblood[3]} />
          <stop offset="0.5" stopColor={P.oxblood[2]} />
          <stop offset="1" stopColor={P.oxblood[0]} />
        </linearGradient>
        <linearGradient id={id("gold")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.gold[4]} />
          <stop offset="0.4" stopColor={P.gold[3]} />
          <stop offset="1" stopColor={P.gold[1]} />
        </linearGradient>
        <linearGradient id={id("crown")} x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0" stopColor={P.gold[4]} />
          <stop offset="0.35" stopColor={P.gold[3]} />
          <stop offset="0.7" stopColor={P.gold[2]} />
          <stop offset="1" stopColor={P.gold[0]} />
        </linearGradient>
        <radialGradient id={id("bone")} cx="0.3" cy="0.3" r="0.9">
          <stop offset="0" stopColor={P.bone[4]} />
          <stop offset="0.5" stopColor={P.bone[3]} />
          <stop offset="1" stopColor={P.bone[1]} />
        </radialGradient>
        <radialGradient id={id("eye")}>
          <stop offset="0" stopColor="#fff6dc" />
          <stop offset="0.35" stopColor={GLOW.ember} />
          <stop offset="1" stopColor={P.ember[2]} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("gem")} cx="0.35" cy="0.35">
          <stop offset="0" stopColor={P.violet[4]} />
          <stop offset="0.5" stopColor={P.violet[3]} />
          <stop offset="1" stopColor={P.violet[1]} />
        </radialGradient>
        <radialGradient id={id("aura")}>
          <stop offset="0" stopColor={P.violet[3]} stopOpacity="0.45" />
          <stop offset="1" stopColor={P.violet[2]} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* dark aura and ground shadow */}
      <ellipse cx="168" cy="200" rx="150" ry="190" fill={url("aura")} opacity={strike ? 1 : 0.7} />
      <ellipse cx="170" cy="388" rx="140" ry="12" fill={INK} opacity="0.34" filter="url(#wc-wash)" />

      {/* orbiting pages, behind */}
      {strike && (
        <g fill="none" stroke={P.violet[3]} strokeLinecap="round" opacity="0.6">
          <path d="M40 120 C40 40 140 0 230 30 M290 110 C312 200 290 300 230 340 M40 300 C20 250 20 200 30 170" strokeWidth="2" strokeDasharray="10 7" />
        </g>
      )}

      <g filter="url(#fig)" stroke={INK} strokeLinejoin="round" strokeLinecap="round">
        {/* ---------- standing collar fanning behind the skull ---------- */}
        <path d="M118 138 C104 110 100 84 110 60 L124 76 L130 46 L146 70 L166 44 L186 70 L202 46 L208 76 L222 60 C232 84 228 110 214 138 Z" fill={url("blood")} strokeWidth="2.6" />
        <path d="M126 132 C116 108 114 88 120 72 M210 132 C218 108 220 88 214 72" fill="none" stroke={P.gold[3]} strokeWidth="2.2" />
        <path d="M140 128 C136 108 140 88 146 76 M190 128 C194 108 192 88 186 76 M166 128 L166 64" fill="none" stroke={P.oxblood[0]} strokeWidth="1.4" opacity="0.8" />
        <path d="M110 60 L124 76 L130 46 L146 70 L166 44 L186 70 L202 46 L208 76 L222 60" fill="none" stroke={P.gold[2]} strokeWidth="2.2" />

        {/* trailing train behind */}
        <path d="M216 160 C246 230 276 320 312 382 C290 392 262 392 240 388 Z" fill={P.violet[0]} strokeWidth="2.4" />
        <path d="M252 290 C266 330 284 364 300 382" fill="none" stroke={P.violet[2]} strokeWidth="1.3" opacity="0.7" />

        {/* tattered shadow-wisps trailing from the hem */}
        <path d="M60 350 C44 364 30 380 14 392 C30 390 40 386 50 392 C58 384 66 390 74 386 Z M250 360 C270 372 290 386 316 394 C300 396 286 394 276 398 C268 390 258 394 250 388 Z" fill={P.violet[0]} strokeWidth="1.8" />
        {/* ---------- vast robe ---------- */}
        <path d="M120 146 C100 220 72 300 38 384 C100 396 232 396 294 384 C268 300 242 220 216 146 Z" fill={url("robe")} strokeWidth="2.8" />
        <path d="M190 150 L216 146 C242 220 268 300 294 384 C270 390 246 392 222 392 C226 300 212 220 190 150 Z" fill={P.violet[0]} stroke="none" opacity="0.5" />
        <path d="M112 190 C96 250 76 310 54 372" fill="none" stroke={P.violet[4]} strokeWidth="1.6" opacity="0.6" />
        <path d="M130 230 C120 290 104 340 90 388 M206 230 C222 290 240 340 256 388 M226 260 C244 310 262 350 276 386" fill="none" stroke={P.violet[0]} strokeWidth="1.5" opacity="0.8" />
        {/* gold fleurons scattered over the violet */}
        <path d="M100 300 L104 292 L108 300 L104 308 Z M76 344 L80 336 L84 344 L80 352 Z M118 250 L121 244 L124 250 L121 256 Z M226 300 L230 292 L234 300 L230 308 Z M250 344 L254 336 L258 344 L254 352 Z M212 250 L215 244 L218 250 L215 256 Z" fill={url("gold")} strokeWidth="1" />
        <path d="M104 316 L104 322 M80 360 L80 364 M230 316 L230 322 M254 360 L254 364" fill="none" stroke={P.gold[2]} strokeWidth="1.4" />
        {/* hem embroidery */}
        <path d="M38 384 C100 396 232 396 294 384" fill="none" stroke={P.gold[2]} strokeWidth="4" />
        <path d="M46 370 C106 382 226 382 286 370" fill="none" stroke={P.gold[2]} strokeWidth="2" />
        <path d="M54 380 L60 372 L66 380 M86 384 L92 376 L98 384 M232 384 L238 376 L244 384 M262 380 L268 372 L274 380" fill="none" stroke={P.gold[3]} strokeWidth="1.6" />

        {/* oxblood front panel, heavily embroidered */}
        <path d="M150 160 C146 240 134 316 120 390 L212 390 C204 316 194 240 184 160 Z" fill={url("blood")} strokeWidth="2.4" />
        <path d="M170 160 L184 160 C194 240 204 316 212 390 L190 390 C190 310 182 230 170 160 Z" fill={P.oxblood[0]} stroke="none" opacity="0.45" />
        <path d="M150 160 C146 240 134 316 120 390 M184 160 C194 240 204 316 212 390" fill="none" stroke={P.gold[3]} strokeWidth="3" />
        <path d="M143 250 L191 250 M136 320 L200 320" fill="none" stroke={P.gold[2]} strokeWidth="2.2" />
        {/* bound-crown sigil */}
        <path d="M152 296 L152 278 L160 286 L167 272 L174 286 L182 278 L182 296 Z" fill={url("gold")} strokeWidth="1.6" />
        <circle cx="167" cy="304" r="7" fill="none" stroke={P.gold[3]} strokeWidth="1.8" />
        <path d="M156 212 L167 196 L178 212 L167 228 Z" fill="none" stroke={P.gold[3]} strokeWidth="1.8" />
        <circle cx="167" cy="212" r="3" fill={url("gem")} strokeWidth="1" />
        <path d="M140 350 L146 342 L152 350 L158 342 L164 350 L170 342 L176 350 L182 342 L188 350 L194 342 L200 350" fill="none" stroke={P.gold[3]} strokeWidth="1.5" />

        {/* chains wrapped around the body */}
        {chain("M112 202 C150 218 190 218 228 198", "c1")}
        {chain("M100 262 C150 282 200 280 244 252", "c2")}
        {chain(chainL, "c3")}
        {chain(chainR, "c4")}
        {/* shackle ring */}
        <circle cx="244" cy="252" r="7" fill="none" stroke={INK} strokeWidth="6" />
        <circle cx="244" cy="252" r="7" fill="none" stroke={P.steel[3]} strokeWidth="3" />
        {strike && (
          <path d="M8 196 L0 204 M12 214 L2 220 M308 132 L318 128 M314 154 L320 160" fill="none" stroke={P.steel[4]} strokeWidth="1.8" />
        )}

        {/* ---------- mantle ---------- */}
        <path d="M112 142 C122 126 150 120 168 120 C188 120 212 126 224 142 C236 158 238 176 232 188 C220 180 208 186 200 180 C190 188 178 180 168 186 C158 180 146 188 136 180 C126 186 112 180 102 188 C98 172 102 154 112 142 Z" fill={url("robe")} strokeWidth="2.6" />
        <path d="M196 124 C212 128 226 140 232 160 C236 172 234 182 232 188 C222 182 212 184 204 180 C210 160 206 138 196 124 Z" fill={P.violet[0]} stroke="none" opacity="0.5" />
        <path d="M102 188 C112 180 126 186 136 180 C146 188 158 180 168 186 C178 180 190 188 200 180 C208 186 220 180 232 188" fill="none" stroke={P.gold[3]} strokeWidth="3" />
        <path d="M110 176 L112 186 M136 172 L136 182 M168 176 L168 186 M200 172 L200 182" fill="none" stroke={P.gold[2]} strokeWidth="1.6" />
        <path d="M114 146 C126 132 146 126 164 124" fill="none" stroke={P.violet[4]} strokeWidth="1.8" opacity="0.8" />

        {/* ribcage glimpsed through the neckline */}
        <path d="M148 128 L186 128 L168 166 Z" fill="#150c1c" strokeWidth="2" />
        <path d="M154 136 C160 140 176 140 180 136 M158 145 C163 148 173 148 176 145 M162 154 C165 156 171 156 172 154 M167 132 L167 160" fill="none" stroke={P.bone[3]} strokeWidth="1.8" />

        {/* ---------- skull ---------- */}
        <path d="M140 86 C140 74 150 66 164 66 C178 66 188 76 188 90 C188 102 184 110 180 114 L176 124 C170 130 156 130 150 124 L146 114 C140 108 138 98 140 86 Z" fill={url("bone")} strokeWidth="2.4" />
        <path d="M176 70 C186 76 190 88 188 100 C186 108 182 112 178 116 L174 124 C170 128 166 128 164 128 C176 110 180 90 176 70 Z" fill={P.bone[1]} stroke="none" opacity="0.5" />
        {/* sockets */}
        <path d="M144 90 C146 84 156 84 158 90 C158 96 154 100 150 100 C146 100 143 96 144 90 Z" fill="#12080a" strokeWidth="1.4" />
        <path d="M166 90 C168 84 180 84 182 90 C182 96 178 100 174 100 C168 100 165 96 166 90 Z" fill="#12080a" strokeWidth="1.4" />
        <path d="M143 88 C146 82 156 80 160 86 M165 86 C170 80 180 80 184 86" fill="none" strokeWidth="1.6" />
        {/* nasal cavity, cheekbones */}
        <path d="M158 102 L162 110 L155 110 Z" fill="#12080a" strokeWidth="1" />
        <path d="M146 106 C150 104 152 106 152 110 M176 104 C172 104 170 106 170 110" fill="none" stroke={P.bone[1]} strokeWidth="1.4" />
        {/* teeth */}
        <path d="M148 114 C156 118 170 118 178 114 L176 122 C168 126 158 126 150 122 Z" fill={P.bone[4]} strokeWidth="1.4" />
        <path d="M153 115 L153 123 M158 116 L158 125 M163 117 L163 125 M168 117 L168 125 M173 116 L173 123 M149 118 C158 121 168 121 177 118" fill="none" strokeWidth="1" />
        {/* crack */}
        <path d="M170 68 L166 76 L170 80" fill="none" strokeWidth="1" />

        {/* ---------- tall jagged crown ---------- */}
        <path d="M136 80 L134 46 L144 58 L148 26 L158 50 L166 10 L176 48 L186 24 L190 56 L200 40 L196 80 C176 74 156 74 136 80 Z" fill={url("crown")} strokeWidth="2.4" />
        <path d="M176 48 L186 24 L190 56 L200 40 L196 80 C190 78 184 77 178 76 Z" fill={P.gold[0]} stroke="none" opacity="0.4" />
        <path d="M136 80 C156 74 176 74 196 80 L196 88 C176 82 156 82 136 88 Z" fill={url("gold")} strokeWidth="2.2" />
        <path d="M140 50 L144 58 M152 36 L156 48 M166 16 L166 44" fill="none" stroke={P.gold[4]} strokeWidth="1.4" />
        {/* gems */}
        <path d="M166 54 L171 62 L166 70 L161 62 Z" fill={P.oxblood[3]} strokeWidth="1.2" />
        <circle cx="148" cy="66" r="3.4" fill={url("gem")} strokeWidth="1" />
        <circle cx="184" cy="66" r="3.4" fill={url("gem")} strokeWidth="1" />
        <circle cx="146" cy="84" r="1.8" fill={P.verdigris[3]} strokeWidth="0.8" />
        <circle cx="166" cy="82" r="1.8" fill={P.oxblood[3]} strokeWidth="0.8" />
        <circle cx="186" cy="84" r="1.8" fill={P.verdigris[3]} strokeWidth="0.8" />
        <circle cx="148" cy="26" r="2.4" fill={url("gold")} strokeWidth="1" />
        <circle cx="166" cy="10" r="3" fill={url("gold")} strokeWidth="1" />
        <circle cx="186" cy="24" r="2.4" fill={url("gold")} strokeWidth="1" />

        {/* ---------- far arm ---------- */}
        {strike ? (
          <g>
            <path d="M214 150 C232 150 250 160 264 172 L254 188 C240 180 226 176 212 176 Z" fill={url("robe")} strokeWidth="2.4" />
            <path d="M264 172 C274 176 280 186 276 198 C266 198 258 194 254 188 Z" fill={url("blood")} strokeWidth="2" />
            <path d="M270 184 L284 172 M272 188 L292 180 M272 192 L292 194 M270 196 L286 206" fill="none" stroke={INK} strokeWidth="4" />
            <path d="M270 184 L284 172 M272 188 L292 180 M272 192 L292 194 M270 196 L286 206" fill="none" stroke={P.bone[3]} strokeWidth="2" />
          </g>
        ) : (
          <g>
            <path d="M214 150 C228 170 232 196 226 222 L204 224 C208 200 208 176 204 160 Z" fill={url("robe")} strokeWidth="2.4" />
            <path d="M204 222 C204 232 214 240 228 236 L228 220 Z" fill={url("blood")} strokeWidth="2" />
            <path d="M206 228 L194 236 M206 232 L196 244 M210 234 L204 248 M214 236 L212 248" fill="none" stroke={INK} strokeWidth="4" />
            <path d="M206 228 L194 236 M206 232 L196 244 M210 234 L204 248 M214 236 L212 248" fill="none" stroke={P.bone[3]} strokeWidth="2" />
          </g>
        )}

        {/* ---------- scepter ---------- */}
        <g transform={strike ? "translate(-6 -122) rotate(-14 96 226)" : undefined}>
          <path d="M92 318 L98 140" stroke={INK} strokeWidth="7" />
          <path d="M92 318 L98 140" stroke={url("gold")} strokeWidth="4" />
          <path d="M93 270 L97 270 M94 250 L98 250" stroke={P.gold[0]} strokeWidth="2" />
          <path d="M88 318 L96 318 L92 328 Z" fill={url("gold")} strokeWidth="1.4" />
          {/* head: a small crown cradling a violet orb */}
          <path d="M86 140 L110 140 L112 124 L106 130 L98 118 L90 130 L84 124 Z" fill={url("crown")} strokeWidth="1.8" />
          <circle cx="98" cy="112" r="9" fill={url("gem")} strokeWidth="2" />
          <path d="M93 108 C94 105 97 104 100 104" fill="none" stroke="#fff" strokeWidth="1.4" />
          <path d="M98 103 L98 92 M93 97 L103 97" stroke={url("gold")} strokeWidth="2.4" />
        </g>

        {/* ---------- near arm: bell sleeve and bony hand ---------- */}
        {strike ? (
          <g>
            <path d="M122 146 C112 126 100 106 88 90 L72 100 C84 118 96 140 106 160 Z" fill={url("robe")} strokeWidth="2.4" />
            <path d="M72 100 C60 110 58 130 66 150 C78 140 86 124 88 110 Z" fill={url("blood")} strokeWidth="2" />
            <path d="M72 100 C60 110 58 130 66 150" fill="none" stroke={P.gold[3]} strokeWidth="2.4" />
            <path d="M74 90 C78 82 88 80 92 86 C94 92 88 98 80 98 C76 98 72 94 74 90 Z" fill={url("bone")} strokeWidth="1.8" />
            <path d="M76 86 L72 88 M78 92 L73 94" fill="none" strokeWidth="1" />
          </g>
        ) : (
          <g>
            <path d="M120 146 C108 172 102 200 100 224 L118 226 C122 202 128 180 132 164 Z" fill={url("robe")} strokeWidth="2.4" />
            <path d="M100 222 C92 240 90 260 96 280 C106 272 116 254 118 226 Z" fill={url("blood")} strokeWidth="2" />
            <path d="M100 222 C92 240 90 260 96 280" fill="none" stroke={P.gold[3]} strokeWidth="2.4" />
            <path d="M88 220 C90 212 100 210 104 216 C106 222 102 228 94 230 C88 230 86 226 88 220 Z" fill={url("bone")} strokeWidth="1.8" />
            <path d="M90 216 L86 218 M89 222 L85 224 M90 227 L86 229" fill="none" strokeWidth="1" />
          </g>
        )}

        {/* ---------- loose pages ---------- */}
        {pages.map(([x, y, r], i) => (
          <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
            <path d="M-11 -14 L9 -15 C11 -6 12 4 11 14 L-10 15 C-12 4 -12 -6 -11 -14 Z" fill={PAPER} strokeWidth="1.6" />
            <path d="M-7 -9 L6 -9 M-7 -5 L6 -5 M-7 -1 L4 -1 M-7 3 L6 3 M-7 7 L2 7" fill="none" stroke={P.violet[2]} strokeWidth="1" />
          </g>
        ))}
      </g>

      {/* burning eyes (unfiltered focal point) */}
      <circle cx="151" cy="92" r={strike ? 11 : 8} fill={url("eye")} />
      <circle cx="174" cy="92" r={strike ? 11 : 8} fill={url("eye")} />
      <circle cx="151" cy="92" r="2.4" fill="#fff4d6" filter="url(#glow)" />
      <circle cx="174" cy="92" r="2.4" fill="#fff4d6" filter="url(#glow)" />
      {/* scepter orb light */}
      <g transform={strike ? "translate(-6 -122) rotate(-14 96 226)" : undefined}>
        <circle cx="98" cy="112" r={strike ? 22 : 12} fill={GLOW.violet} opacity={strike ? 0.7 : 0.4} filter="url(#glow-soft)" />
      </g>
      {strike && (
        <g fill="none" stroke={GLOW.violet} strokeLinecap="round" filter="url(#glow)" opacity="0.9">
          <path d="M20 150 C10 120 16 90 40 70 M238 36 C270 50 296 90 298 130 M30 290 C60 330 110 350 150 352" strokeWidth="1.8" />
        </g>
      )}
    </svg>
  );
}
