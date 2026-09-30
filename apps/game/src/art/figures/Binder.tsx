import { useId } from "react";
import { INK, P, GLOW } from "../palette";
import type { FigureMeta, FigureProps } from "../types";

export const meta: FigureMeta = { id: "binder", viewBox: [0, 0, 200, 280], feet: { x: 100, y: 268 }, head: [88, 44, 52, 52], facing: "right" };

/**
 * The Binder: a hooded thread-mage in a sapphire robe with gold trim and a violet mantle,
 * carrying a hooked staff from which hangs a glowing knot of pale-blue light.
 * Strike: leans in and thrusts the staff forward; the knot flares and threads lash out.
 */
export default function Binder({ viewBox, className, pose = "idle" }: FigureProps) {
  const u = useId().replace(/:/g, "");
  const id = (s: string) => `${u}-${s}`;
  const url = (s: string) => `url(#${id(s)})`;
  const strike = pose === "strike";

  // Staff is drawn in grip-local coordinates (grip at 0,0; staff runs along -y to the hook).
  const grip = strike ? { x: 160, y: 101, a: 24, top: -62, bottom: 150 } : { x: 153, y: 146, a: -1.5, top: -104, bottom: 119 };
  const T = grip.top;
  const hook = `M0 ${T + 4} C-1 ${T - 10} 4 ${T - 20} 13 ${T - 20} C22 ${T - 20} 25 ${T - 10} 21 ${T - 3} C19 ${T + 1} 15 ${T + 1} 14 ${T - 2}`;
  const knot = { x: 15, y: T + 12 };
  const staffT = `translate(${grip.x} ${grip.y}) rotate(${grip.a})`;
  // Body lean for the strike: a shear pivoting at the feet.
  const lean = strike ? "matrix(1 0 -0.07 1 18.6 0)" : undefined;

  return (
    <svg viewBox={viewBox ?? meta.viewBox.join(" ")} className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id("robe")} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor={P.sapphire[3]} />
          <stop offset="0.35" stopColor={P.sapphire[2]} />
          <stop offset="0.8" stopColor={P.sapphire[1]} />
          <stop offset="1" stopColor={P.sapphire[0]} />
        </linearGradient>
        <linearGradient id={id("skirt")} x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0" stopColor={P.sapphire[2]} />
          <stop offset="0.45" stopColor={P.sapphire[2]} />
          <stop offset="1" stopColor={P.sapphire[0]} />
        </linearGradient>
        <linearGradient id={id("cape")} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.violet[2]} />
          <stop offset="0.6" stopColor={P.violet[1]} />
          <stop offset="1" stopColor={P.violet[0]} />
        </linearGradient>
        <linearGradient id={id("mantle")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.violet[3]} />
          <stop offset="0.5" stopColor={P.violet[2]} />
          <stop offset="1" stopColor={P.violet[1]} />
        </linearGradient>
        <linearGradient id={id("hood")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.sapphire[3]} />
          <stop offset="0.4" stopColor={P.sapphire[2]} />
          <stop offset="1" stopColor={P.sapphire[0]} />
        </linearGradient>
        
        <linearGradient id={id("gold")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.gold[4]} />
          <stop offset="0.5" stopColor={P.gold[3]} />
          <stop offset="1" stopColor={P.gold[1]} />
        </linearGradient>
        <radialGradient id={id("orb")}>
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.25" stopColor={P.spirit[4]} />
          <stop offset="0.55" stopColor={GLOW.thread} stopOpacity="0.6" />
          <stop offset="1" stopColor={P.spirit[2]} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("jaw")} cx="0.85" cy="0.6" r="0.8">
          <stop offset="0" stopColor={P.skin[3]} />
          <stop offset="0.6" stopColor={P.skin[2]} />
          <stop offset="1" stopColor={P.skin[0]} />
        </radialGradient>
        <radialGradient id={id("hand")} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={P.skin[3]} />
          <stop offset="1" stopColor={P.skin[1]} />
        </radialGradient>
        <radialGradient id={id("lining")} cx="0.3" cy="0.2" r="1">
          <stop offset="0" stopColor={P.violet[3]} />
          <stop offset="1" stopColor={P.violet[1]} />
        </radialGradient>
      </defs>

      {/* ground shadow */}
      <ellipse cx="98" cy="267" rx="64" ry="7.5" fill={INK} opacity="0.3" filter="url(#wc-wash)" />
      {strike && <ellipse cx="170" cy="266" rx="26" ry="5" fill={GLOW.thread} opacity="0.25" filter="url(#glow-soft)" />}

      <g filter="url(#fig)" stroke={INK} strokeLinejoin="round" strokeLinecap="round">
        <g transform={lean}>
          {/* ── cape, trailing behind ── */}
          {strike ? (
            <g>
              <path d="M84 100 C68 116 52 150 38 186 C28 212 16 234 6 254 C18 252 26 258 36 256 C42 262 52 262 60 258 C66 262 74 262 80 258 L88 150 Z" fill={url("cape")} strokeWidth="2.5" />
              <path d="M6 254 C16 240 26 226 34 212 C36 232 44 248 60 258 C50 262 42 262 36 256 C26 258 18 252 6 254 Z" fill={url("lining")} strokeWidth="1.8" />
              <path d="M8 252 C18 252 26 257 36 255 C44 261 52 261 60 257" fill="none" stroke={P.gold[3]} strokeWidth="1.8" />
              <path d="M70 128 C58 160 44 196 30 226 M80 140 C72 180 64 216 56 246" fill="none" stroke={P.violet[0]} strokeWidth="1.2" opacity="0.7" />
              <path d="M80 108 C68 126 58 150 50 170" fill="none" stroke={P.violet[3]} strokeWidth="1.4" opacity="0.8" />
            </g>
          ) : (
            <g>
              <path d="M84 100 C72 120 64 160 56 198 C50 226 42 246 32 262 C42 259 50 264 58 261 C64 265 72 265 78 262 L88 150 Z" fill={url("cape")} strokeWidth="2.5" />
              <path d="M32 262 C40 250 46 238 50 226 C52 242 56 254 64 262 C56 265 46 260 32 262 Z" fill={url("lining")} strokeWidth="1.8" />
              <path d="M34 261 C44 259 50 263 58 261 C64 264 70 264 76 262" fill="none" stroke={P.gold[3]} strokeWidth="1.8" />
              <path d="M74 126 C66 164 58 204 48 238 M82 138 C76 184 72 220 68 252" fill="none" stroke={P.violet[0]} strokeWidth="1.2" opacity="0.7" />
              <path d="M80 110 C72 130 66 156 62 180" fill="none" stroke={P.violet[3]} strokeWidth="1.4" opacity="0.8" />
            </g>
          )}

          {/* ── back arm ── */}
          {strike ? (
            <g>
              <path d="M88 106 C76 110 62 118 50 124 C46 128 44 134 46 140 C54 144 64 140 72 134 C80 128 88 124 94 120 Z" fill={url("robe")} strokeWidth="2.2" />
              <path d="M50 124 C44 128 42 136 46 141 L52 140 C50 134 52 128 56 124 Z" fill={url("lining")} strokeWidth="1.4" />
              <path d="M50 124 C45 128 43 135 46 140" fill="none" stroke={P.gold[3]} strokeWidth="1.8" />
              {/* open hand, fingers splayed, threads trailing */}
              <path d="M49 125 C44 121 38 121 34 122 L24 118 C21 117 20 121 23 122 L31 126 L21 127 C18 127 18 131 21 131 L31 131 L23 135 C20 136 22 140 25 139 L34 135 C37 138 41 140 45 139 C50 137 51 131 49 125 Z" fill={url("hand")} strokeWidth="1.5" />
              <path d="M42 122 L37 114 C36 111 32 112 33 115 L37 124" fill={url("hand")} strokeWidth="1.4" />
              <path d="M34 126 L40 127 M34 131 L40 131" fill="none" stroke={P.skin[0]} strokeWidth="0.8" />
            </g>
          ) : (
            <g>
              <path d="M84 106 C76 118 72 138 72 158 C76 164 84 164 90 160 C88 142 90 124 94 112 Z" fill={P.sapphire[1]} strokeWidth="2.2" />
              <path d="M72 158 C76 164 84 164 90 160" fill="none" stroke={P.gold[3]} strokeWidth="1.8" />
            </g>
          )}

          {/* ── robe skirt ── */}
          <path
            d={strike ? "M82 146 L124 144 C130 170 136 200 140 222 C144 240 150 252 156 262 C136 266 112 266 98 265 C86 266 74 264 62 262 C68 240 72 200 76 176 C78 164 80 154 82 146 Z" : "M81 146 L125 144 C129 168 133 190 135 208 C137 228 140 248 145 262 C128 266 108 266 96 265 C84 266 70 264 59 262 C64 242 68 212 72 186 C75 168 78 156 81 146 Z"}
            fill={url("skirt")}
            strokeWidth="2.6"
          />
          {/* front opening, violet lining */}
          <path d={strike ? "M114 150 C120 190 130 228 140 262 L156 262 C148 250 142 236 138 220 C134 196 128 170 122 150 Z" : "M114 150 C118 190 124 228 130 262 L144 262 C138 250 134 236 132 220 C130 196 126 170 122 150 Z"} fill={url("lining")} strokeWidth="1.6" />
          {/* shadow wash on the far side of the skirt */}
          <path d={strike ? "M112 152 C116 190 124 228 134 264 L112 265 C110 230 108 190 104 156 Z" : "M112 152 C114 190 120 228 126 264 L108 265 C108 230 106 190 102 156 Z"} fill={P.sapphire[0]} stroke="none" opacity="0.4" />
          {/* folds */}
          <path d="M92 154 C90 190 84 226 78 262 M100 156 C100 196 98 232 96 264" fill="none" stroke={P.sapphire[0]} strokeWidth="1.3" opacity="0.85" />
          <path d="M84 158 C82 190 76 226 70 258" fill="none" stroke={P.sapphire[4]} strokeWidth="1.3" opacity="0.55" />
          <path d="M88 200 C86 220 82 240 80 256" fill="none" stroke={P.sapphire[3]} strokeWidth="1" opacity="0.6" />
          {/* gold placket and hem, with a stitched pattern */}
          <path d={strike ? "M114 150 C120 190 130 228 140 262" : "M114 150 C118 190 124 228 130 262"} fill="none" stroke={INK} strokeWidth="4.2" />
          <path d={strike ? "M114 150 C120 190 130 228 140 262" : "M114 150 C118 190 124 228 130 262"} fill="none" stroke={url("gold")} strokeWidth="2.4" />
          <path d={strike ? "M63 259 C84 263 110 264 140 261" : "M63 259 C84 263 108 264 130 261"} fill="none" stroke={INK} strokeWidth="5.4" />
          <path d={strike ? "M63 259 C84 263 110 264 140 261" : "M63 259 C84 263 108 264 130 261"} fill="none" stroke={P.gold[3]} strokeWidth="3.4" />
          <path d={strike ? "M68 260 C88 263 110 263 136 261" : "M68 260 C88 263 108 263 126 261"} fill="none" stroke={P.gold[0]} strokeWidth="1" strokeDasharray="1.5 3" />

          {/* ── boots ── */}
          {strike ? (
            <g>
              <path d="M128 262 C130 255 142 255 150 259 C155 262 157 266 152 267 L128 267 Z" fill={P.leather[2]} strokeWidth="1.8" />
              <path d="M66 263 C66 258 76 257 80 261 L82 267 L64 267 Z" fill={P.leather[1]} strokeWidth="1.8" />
            </g>
          ) : (
            <g>
              <path d="M116 262 C118 255 130 255 138 259 C143 262 145 266 140 267 L116 267 Z" fill={P.leather[2]} strokeWidth="1.8" />
              <path d="M76 263 C77 258 88 257 92 261 L94 267 L74 267 Z" fill={P.leather[1]} strokeWidth="1.8" />
            </g>
          )}
          <path d={strike ? "M134 258 C140 257 146 258 150 261" : "M122 258 C128 257 134 258 138 261"} fill="none" stroke={P.leather[4]} strokeWidth="1" opacity="0.7" />

          {/* ── bodice ── */}
          <path d="M78 110 L128 110 C129 124 128 136 126 146 L81 148 C79 136 77 122 78 110 Z" fill={url("robe")} strokeWidth="2.2" />
          <path d="M112 112 C116 124 118 136 116 146 L125 146 C127 134 127 122 126 112 Z" fill={P.sapphire[0]} stroke="none" opacity="0.45" />

          {/* ── belt / sash with the knot buckle, a thread spool at the hip ── */}
          <path d="M80 139 C96 145 112 145 126 139 L127 150 C112 156 96 156 79 150 Z" fill={P.leather[2]} strokeWidth="1.8" />
          <path d="M81 142 C96 148 112 148 126 142" fill="none" stroke={P.leather[4]} strokeWidth="0.9" opacity="0.6" />
          <path d="M98 152 C96 166 95 180 91 194 L97 196 C100 180 102 166 103 152 Z" fill={P.violet[2]} strokeWidth="1.5" />
          <path d="M103 152 C104 164 106 176 105 188 L110 187 C110 174 109 162 107 152 Z" fill={P.violet[1]} strokeWidth="1.5" />
          <path d="M91 194 L97 196 M105 188 L110 187" stroke={P.gold[3]} strokeWidth="2" />
          <circle cx="105" cy="149" r="6.2" fill={url("gold")} strokeWidth="1.6" />
          <path d="M101 149 C102 144 109 145 108 150 C107 155 100 154 102 148 C103 145 107 146 107 148" fill="none" stroke={P.gold[0]} strokeWidth="1.1" />
          {/* spool */}
          <path d="M82 152 L92 152 L92 155 L82 155 Z M82 166 L92 166 L92 169 L82 169 Z" fill={P.gold[3]} strokeWidth="1.2" />
          <path d="M83.5 155 L90.5 155 L90.5 166 L83.5 166 Z" fill={P.spirit[3]} strokeWidth="1.1" />
          <path d="M84 158 L90 157 M84 161 L90 160 M84 164 L90 163" stroke={P.spirit[4]} strokeWidth="0.8" />

          {/* ── mantle over the shoulders, dagged hem with gold trim ── */}
          <path d="M75 102 C86 92 120 92 130 100 C136 108 137 120 134 131 C130 134 126 136 122 136 C120 132 118 129 115 128 C112 133 108 137 104 138 C100 134 97 130 93 129 C90 133 86 135 81 135 C78 133 75 131 72 131 C69 120 70 108 75 102 Z" fill={url("mantle")} strokeWidth="2.3" />
          <path d="M134 131 C130 134 126 136 122 136 C120 132 118 129 115 128 C112 133 108 137 104 138 C100 134 97 130 93 129 C90 133 86 135 81 135 C78 133 75 131 72 131" fill="none" stroke={P.gold[3]} strokeWidth="2.2" />
          <path d="M116 100 C124 106 128 116 128 126 L132 128 C135 118 134 108 128 100 Z" fill={P.violet[0]} stroke="none" opacity="0.45" />
          <path d="M80 104 C86 98 96 96 104 96" fill="none" stroke={P.violet[4]} strokeWidth="1.3" opacity="0.8" />
          <path d="M93 112 C94 118 93 122 93 126 M115 110 C116 116 116 120 115 124 M104 116 L104 130" stroke={P.violet[0]} strokeWidth="1" opacity="0.6" />
          <circle cx="93" cy="126" r="1.2" fill={P.gold[4]} stroke="none" />
          <circle cx="115" cy="125" r="1.2" fill={P.gold[4]} stroke="none" />
          <circle cx="104" cy="133" r="1.4" fill={P.gold[4]} stroke="none" />

          {/* ── hood ── */}
          <g transform="translate(108 106) scale(0.87) translate(-108 -106)">

          <path d="M113 45 C101 43 91 49 86 59 C83 66 80 72 72 78 C79 80 82 84 84 90 C84 97 86 102 90 106 L126 104 C132 98 136 90 136 80 C136 64 130 46 112 42 Z" fill={url("hood")} strokeWidth="2.6" />
          {/* shadow side of the hood and the fold under the peak */}
          <path d="M84 90 C84 97 86 102 90 106 L112 105 C102 100 94 94 88 84 Z" fill={P.sapphire[0]} stroke="none" opacity="0.5" />
          <path d="M102 47 C95 56 92 68 94 86 M111 46 C107 56 105 68 107 82" fill="none" stroke={P.sapphire[0]} strokeWidth="1.2" opacity="0.8" />
          <path d="M88 56 C94 49 102 46 111 46" fill="none" stroke={P.sapphire[4]} strokeWidth="1.6" opacity="0.85" />
          {/* face opening in deep shadow */}
          <path d="M120 55 C128 57 134 66 134 78 C134 88 130 96 124 100 C117 98 113 90 113 80 C113 68 115 59 120 55 Z" fill="#120e1b" strokeWidth="1.8" />
          {/* lit jaw and chin, catching the knot's light */}
          <path d="M115 84 C119 87 126 87 132 84 C132 90 128 96 123 98 C118 97 115 92 115 84 Z" fill={url("jaw")} stroke="none" />
          <path d="M129 74 L133 81 L129 82 Z" fill={P.skin[2]} stroke="none" opacity="0.8" />
          <path d="M124 90 C127 90 129 89 131 88" fill="none" stroke={P.skin[0]} strokeWidth="1" />
          <path d="M123 98 C127 96 130 92 132 87" fill="none" stroke={INK} strokeWidth="1.1" />
          {/* eyes: a glint of thread-light in the shadow */}
          <ellipse cx="127" cy="72" rx="2.1" ry="1.1" fill={GLOW.thread} stroke="none" filter="url(#glow)" />
          <ellipse cx="119.5" cy="71.5" rx="1.4" ry="0.9" fill={GLOW.thread} stroke="none" opacity="0.8" />
          {/* hood rim trim and a cool rim light on the front edge */}
          <path d="M120 55 C128 57 134 66 134 78 C134 88 130 96 124 100" fill="none" stroke={P.gold[3]} strokeWidth="2" />
          <path d="M122 47 C130 52 135 62 136 74" fill="none" stroke={P.spirit[4]} strokeWidth="1.2" opacity="0.8" />
          <path d="M83 70 C80 74 77 76 73 78" fill="none" stroke={P.sapphire[4]} strokeWidth="1" opacity="0.7" />
          </g>
        </g>

        {/* ── staff (the near hand closes over it below) ── */}
        <g transform={staffT}>
          <path d={`M0 ${T + 4} L0 ${grip.bottom}`} stroke={INK} strokeWidth="6.6" />
          <path d={`M0 ${T + 4} L0 ${grip.bottom}`} stroke={P.leather[2]} strokeWidth="4" />
          <path d={`M-1 ${T + 16} L-1 ${grip.bottom - 8}`} stroke={P.leather[4]} strokeWidth="1" opacity="0.75" />
          <path d={`M1.1 ${T + 20} L1.1 ${grip.bottom - 4}`} stroke={P.leather[0]} strokeWidth="1" opacity="0.8" />
          <path d={hook} fill="none" stroke={INK} strokeWidth="6.6" />
          <path d={hook} fill="none" stroke={P.leather[2]} strokeWidth="4" />
          <path d={hook} fill="none" stroke={P.leather[4]} strokeWidth="1" opacity="0.7" transform="translate(-0.8 -0.8)" />
          {/* gold bands */}
          <path d={`M-3 ${T + 8} L3 ${T + 8} M-3 ${T + 12} L3 ${T + 12}`} stroke={P.gold[3]} strokeWidth="2.6" />
          <path d={`M-3 ${grip.bottom - 3} L3 ${grip.bottom - 3}`} stroke={P.gold[2]} strokeWidth="3" />
          {/* thread from the hook tip to the knot */}
          <path d={`M14 ${T - 2} L${knot.x} ${knot.y - 5}`} stroke={GLOW.thread} strokeWidth="1" />
          {/* the knot of light */}
          <circle cx={knot.x} cy={knot.y} r={strike ? 22 : 13} fill={url("orb")} stroke="none" />
          <path
            d={`M${knot.x - 5} ${knot.y} C${knot.x - 5} ${knot.y - 7} ${knot.x + 5} ${knot.y - 7} ${knot.x + 4} ${knot.y + 1} C${knot.x + 3} ${knot.y + 7} ${knot.x - 6} ${knot.y + 5} ${knot.x - 3} ${knot.y - 1} C${knot.x} ${knot.y - 6} ${knot.x + 7} ${knot.y - 2} ${knot.x + 3} ${knot.y + 4}`}
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.5"
            filter="url(#glow)"
          />
        </g>

        {/* ── near arm, bell sleeve, hand on the staff ── */}
        {strike ? (
          <g>
            <path d="M112 106 C124 100 140 98 152 96 L158 95 C161 101 161 107 158 112 C150 118 142 126 134 134 C126 134 118 130 113 124 Z" fill={url("robe")} strokeWidth="2.3" />
            <path d="M158 95 C161 101 161 107 158 112 L152 110 C154 106 154 100 152 96 Z" fill={url("lining")} strokeWidth="1.3" />
            <path d="M158 95 C161 101 161 107 158 112" fill="none" stroke={P.gold[3]} strokeWidth="2" />
            <path d="M120 122 C130 118 142 112 152 108" fill="none" stroke={P.sapphire[0]} strokeWidth="1.2" opacity="0.8" />
            <path d="M116 104 C128 100 140 98 150 97" fill="none" stroke={P.sapphire[4]} strokeWidth="1.2" opacity="0.8" />
            {/* fist */}
            <path d="M156 96 C160 92 166 93 168 98 C169 104 166 108 161 108 C157 107 155 102 156 96 Z" fill={url("hand")} strokeWidth="1.6" />
            <path d="M162 96 C165 97 166 100 165 103 M160 99 L166 100 M159 103 L165 104" fill="none" stroke={P.skin[0]} strokeWidth="0.9" />
          </g>
        ) : (
          <g>
            <path d="M110 106 C121 103 127 111 128 121 C129 128 131 133 136 136 C140 138 144 139 149 140 C151 152 151 166 146 180 C136 182 124 178 116 170 C110 158 106 142 106 124 Z" fill={url("robe")} strokeWidth="2.3" />
            <path d="M126 132 C128 148 134 164 140 176 L146 180 C151 166 151 152 149 140 C140 140 132 138 126 132 Z" fill={P.sapphire[0]} stroke="none" opacity="0.45" />
            <path d="M149 140 C151 152 151 166 146 180 L141 178 C145 166 145 152 144 142 Z" fill={url("lining")} strokeWidth="1.3" />
            <path d="M149 140 C151 152 151 166 146 180" fill="none" stroke={P.gold[3]} strokeWidth="2" />
            <path d="M112 120 C114 138 120 156 130 172 M120 132 C124 150 130 164 138 176" fill="none" stroke={P.sapphire[0]} strokeWidth="1.2" opacity="0.8" />
            <path d="M112 110 C120 108 126 114 128 122" fill="none" stroke={P.sapphire[4]} strokeWidth="1.3" opacity="0.8" />
            {/* fist around the staff */}
            <path d="M147 140 C150 136 157 136 159 141 C160 147 158 153 152 154 C148 153 146 148 147 140 Z" fill={url("hand")} strokeWidth="1.6" />
            <path d="M152 140 C155 140 157 142 157 144 M150 145 L157 146 M150 149 L156 150" fill="none" stroke={P.skin[0]} strokeWidth="0.9" />
          </g>
        )}

        {/* threads of light wound around the hand */}
        <g fill="none" stroke={GLOW.thread} strokeWidth="1.1" opacity="0.95">
          {strike ? (
            <path d="M150 98 C156 88 170 92 166 102 C162 112 150 106 156 98 C160 92 170 96 172 90" />
          ) : (
            <path d="M143 148 C146 136 162 136 160 146 C158 156 144 154 148 143 C151 136 160 138 162 132 C164 124 158 116 162 108" />
          )}
        </g>
      </g>

      {/* ── light, unfiltered so it stays crisp ── */}
      <g transform={staffT}>
        <circle cx={knot.x} cy={knot.y} r={strike ? 16 : 9} fill={GLOW.thread} opacity={strike ? 0.6 : 0.4} filter="url(#glow-soft)" />
        <circle cx={knot.x} cy={knot.y} r="2.4" fill="#ffffff" />
        {strike && (
          <g fill="none" stroke={P.spirit[4]} strokeLinecap="round" filter="url(#glow)">
            <path d={`M${knot.x + 6} ${knot.y - 4} C${knot.x + 20} ${knot.y - 18} ${knot.x + 30} ${knot.y + 2} ${knot.x + 44} ${knot.y - 10}`} strokeWidth="1.6" />
            <path d={`M${knot.x + 7} ${knot.y + 2} C${knot.x + 22} ${knot.y + 4} ${knot.x + 26} ${knot.y + 18} ${knot.x + 42} ${knot.y + 16}`} strokeWidth="1.4" />
            <path d={`M${knot.x + 2} ${knot.y + 7} C${knot.x + 8} ${knot.y + 22} ${knot.x + 20} ${knot.y + 24} ${knot.x + 24} ${knot.y + 40}`} strokeWidth="1.2" />
            <path d={`M${knot.x - 2} ${knot.y - 7} C${knot.x + 2} ${knot.y - 20} ${knot.x + 14} ${knot.y - 22} ${knot.x + 16} ${knot.y - 34}`} strokeWidth="1.2" />
            <path d={`M${knot.x - 6} ${knot.y + 2} C${knot.x - 18} ${knot.y + 8} ${knot.x - 20} ${knot.y + 20} ${knot.x - 30} ${knot.y + 24}`} strokeWidth="1" opacity="0.8" />
          </g>
        )}
      </g>
      {strike && (
        <g fill="none" stroke={GLOW.thread} strokeLinecap="round" opacity="0.85">
          <path d="M30 124 C20 118 14 126 6 120" strokeWidth="1.1" />
          <path d="M28 132 C18 136 12 130 4 136" strokeWidth="1" />
        </g>
      )}
    </svg>
  );
}
