import { useId } from "react";
import { INK, INK_SOFT, P, GLOW } from "../palette";
import type { FigureMeta, FigureProps } from "../types";

export const meta: FigureMeta = { id: "husk", viewBox: [0, 0, 200, 280], feet: { x: 104, y: 268 }, head: [22, 54, 72, 72], facing: "left" };

/* ashen grey-violet dead skin */
const SK = ["#2c2533", "#4a4054", "#6e6479", "#958ba0", "#c3bccb"] as const;

/** The Husk: a gaunt, hunched ghoul in a cracked bone mask, wrapped in oxblood rags, with long raking claws. */
export default function Husk({ viewBox, className, pose = "idle" }: FigureProps) {
  const u = useId().replace(/:/g, "");
  const id = (s: string) => `${u}-${s}`;
  const url = (s: string) => `url(#${id(s)})`;
  const strike = pose === "strike";

  /* claws: a finger path, ink under-stroke then skin, then a hooked bone claw at the tip */
  const finger = (d: string, claw: string, w = 3.4, dark = false) => (
    <g>
      <path d={d} fill="none" stroke={INK} strokeWidth={w + 2.2} />
      <path d={d} fill="none" stroke={dark ? SK[1] : SK[3]} strokeWidth={w} />
      <path d={claw} fill={P.bone[3]} stroke={INK} strokeWidth="1.1" />
    </g>
  );

  return (
    <svg viewBox={viewBox ?? meta.viewBox.join(" ")} className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id("skin")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={SK[4]} />
          <stop offset="0.35" stopColor={SK[3]} />
          <stop offset="0.75" stopColor={SK[2]} />
          <stop offset="1" stopColor={SK[0]} />
        </linearGradient>
        <linearGradient id={id("skinDark")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={SK[2]} />
          <stop offset="1" stopColor={SK[0]} />
        </linearGradient>
        <linearGradient id={id("rag")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.oxblood[3]} />
          <stop offset="0.5" stopColor={P.oxblood[2]} />
          <stop offset="1" stopColor={P.oxblood[0]} />
        </linearGradient>
        <linearGradient id={id("mask")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.bone[4]} />
          <stop offset="0.55" stopColor={P.bone[3]} />
          <stop offset="1" stopColor={P.bone[1]} />
        </linearGradient>
        <radialGradient id={id("ember")}>
          <stop offset="0" stopColor="#fff4d6" />
          <stop offset="0.4" stopColor={GLOW.ember} />
          <stop offset="1" stopColor={P.ember[2]} stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx={strike ? 96 : 104} cy="268" rx={strike ? 66 : 54} ry="8" fill={INK} opacity="0.32" filter="url(#wc-wash)" />

      <g filter="url(#fig)" stroke={INK} strokeLinejoin="round" strokeLinecap="round" transform="translate(104 268) scale(1.1) translate(-104 -268)">
        {/* ---------- far leg ---------- */}
        {strike ? (
          <path d="M132 164 C140 180 150 194 156 206 C160 214 158 220 156 226 C162 238 170 250 176 258 C178 262 176 268 170 268 L150 268 C150 264 156 262 162 260 C154 250 146 238 142 228 C138 220 138 212 140 206 C132 196 122 184 116 172 Z" fill={url("skinDark")} strokeWidth="2.2" />
        ) : (
          <path d="M132 166 C124 180 112 196 106 208 C103 214 105 220 108 224 C112 236 116 246 118 252 C110 256 100 260 96 264 C94 268 98 269 102 268 L132 268 C134 262 132 256 128 252 C124 240 122 228 119 216 C126 204 136 192 144 178 Z" fill={url("skinDark")} strokeWidth="2.2" />
        )}

        {/* ---------- upper body (tilts forward on the strike) ---------- */}
        <g transform={strike ? "translate(-2 4) rotate(-12 120 170)" : undefined}>
          {/* far arm hanging behind the torso */}
          {strike ? (
            <g>
              <path d="M126 104 C136 118 140 136 136 150 C134 160 138 172 146 184 L138 188 C128 176 122 162 122 150 C118 136 114 122 112 110 Z" fill={url("skinDark")} strokeWidth="2" />
              {finger("M142 186 C146 196 146 204 142 210", "M143 208 L139 218 L140 208 Z", 3, true)}
              {finger("M146 184 C152 192 154 200 152 208", "M153 206 L151 216 L150 206 Z", 3, true)}
            </g>
          ) : (
            <g>
              <path d="M124 110 C128 124 126 140 122 152 C116 166 108 180 102 194 L94 190 C98 176 104 162 110 150 C112 136 112 122 112 112 Z" fill={url("skinDark")} strokeWidth="2" />
              {finger("M98 192 C94 202 92 210 94 218", "M94 216 L96 226 L91 216 Z", 3, true)}
              {finger("M102 194 C102 204 102 212 106 220", "M106 218 L110 227 L103 219 Z", 3, true)}
              {finger("M95 190 C88 196 86 204 86 212", "M86 210 L86 220 L83 210 Z", 2.6, true)}
            </g>
          )}

          {/* torso: bony hunched back */}
          <path d="M80 106 C88 92 106 82 126 84 C142 86 152 104 152 128 C152 146 150 160 146 174 C134 180 116 180 104 174 C102 162 98 150 92 140 C84 130 78 118 80 106 Z" fill={url("skin")} strokeWidth="2.5" />
          {/* shadow-side wash on the back and underside */}
          <path d="M140 96 C150 110 152 130 150 150 C148 162 146 170 144 174 C132 178 120 178 110 174 C124 168 136 150 140 126 Z" fill={SK[0]} stroke="none" opacity="0.45" />
          <path d="M84 104 C80 116 84 128 92 138" fill="none" stroke={SK[4]} strokeWidth="1.6" opacity="0.9" />
          {/* ribs */}
          <g fill="none" stroke={SK[1]} strokeWidth="1.5">
            <path d="M126 108 C116 110 104 116 96 124" />
            <path d="M130 118 C120 120 108 126 100 134" />
            <path d="M132 128 C122 130 112 136 104 144" />
            <path d="M132 138 C124 140 116 146 108 154" />
            <path d="M130 148 C124 150 118 154 112 160" />
          </g>
          <g fill="none" stroke={SK[4]} strokeWidth="1.1" opacity="0.8">
            <path d="M124 105 C114 108 104 113 96 120" />
            <path d="M128 115 C118 118 108 123 100 130" />
            <path d="M130 125 C120 128 112 133 104 140" />
            <path d="M130 135 C122 138 116 142 108 150" />
          </g>
          {/* sunken belly and sternum */}
          <path d="M96 130 C100 146 104 160 106 172" fill="none" stroke={SK[1]} strokeWidth="1.2" opacity="0.8" />
          {/* spine knuckles along the hump */}
          <g fill={SK[3]} strokeWidth="1.3">
            <circle cx="112" cy="84" r="3" />
            <circle cx="124" cy="83" r="3.2" />
            <circle cx="136" cy="87" r="3" />
          </g>

          {/* waist wrappings and hanging rags */}
          <path d="M104 176 L96 218 L104 210 L108 228 L116 208 L124 222 L128 206 L136 216 L138 180 Z" fill={url("rag")} strokeWidth="2" />
          <path d="M112 186 L108 214 M124 188 L126 206" fill="none" stroke={P.oxblood[0]} strokeWidth="1.1" opacity="0.8" />
          <path d={strike ? "M146 170 C160 176 176 180 190 180 L180 186 L192 192 C174 194 158 188 144 182 Z" : "M146 170 C160 182 168 198 174 214 L166 208 L168 224 C158 208 150 194 142 184 Z"} fill={P.oxblood[1]} strokeWidth="1.8" />
          <path d="M100 160 C116 168 136 168 150 160 L150 176 C136 184 116 184 102 178 Z" fill={url("rag")} strokeWidth="2.2" />
          <path d="M101 168 C118 175 136 174 150 168" fill="none" stroke={P.oxblood[0]} strokeWidth="1.2" />
          <path d="M104 164 C118 170 132 170 146 164" fill="none" stroke={P.oxblood[4]} strokeWidth="1" opacity="0.6" />

          {/* ragged shawl over the hump */}
          <path d="M90 100 C100 84 124 76 142 84 C156 92 162 110 164 132 L157 126 L160 146 L150 134 L148 152 L140 132 L132 144 L128 122 C118 114 104 108 92 110 Z" fill={url("rag")} strokeWidth="2.3" />
          <path d="M140 92 C150 104 154 118 156 130 M128 90 C136 104 140 116 142 130" fill="none" stroke={P.oxblood[0]} strokeWidth="1.2" opacity="0.8" />
          <path d="M98 96 C110 86 126 82 138 86" fill="none" stroke={P.oxblood[4]} strokeWidth="1.3" opacity="0.7" />
          {/* frayed threads */}
          <path d="M150 134 L152 142 M140 132 L138 140 M160 146 L162 152" fill="none" stroke={P.oxblood[1]} strokeWidth="1" />

          {/* sinewy neck */}
          <path d="M70 112 C74 122 82 130 92 134 L96 114 C90 106 82 104 76 106 Z" fill={url("skin")} strokeWidth="2" />
          <path d="M78 118 C82 124 86 128 92 130" fill="none" stroke={SK[1]} strokeWidth="1.1" />
          {/* ---------- head ---------- */}
          <g transform="translate(-2 8)">
          {/* lank hair behind the mask */}
          <path d="M62 78 C72 66 92 68 98 84 C102 96 100 110 96 122 L91 112 L90 128 L84 114 L80 128 L77 112 C70 106 62 94 62 78 Z" fill={INK_SOFT} strokeWidth="2" />
          <path d="M86 82 C92 96 92 108 90 120 M78 86 C82 98 82 106 80 118" fill="none" stroke={SK[2]} strokeWidth="1" opacity="0.8" />
          {/* bone mask: long, cracked, pointed at the chin */}
          <path d="M56 70 C68 66 80 70 83 80 C86 90 83 100 78 108 C72 118 64 126 55 129 C48 125 43 116 41 106 C39 94 44 78 56 70 Z" fill={url("mask")} strokeWidth="2.5" />
          {/* mask shadow side */}
          <path d="M81 86 C83 96 80 104 74 112 C68 120 62 125 56 128 C62 120 70 110 74 98 Z" fill={P.bone[1]} stroke="none" opacity="0.55" />
          {/* brow ridge */}
          <path d="M43 86 C52 84 64 84 81 82" fill="none" stroke={P.bone[1]} strokeWidth="1.3" />
          {/* slanted eye holes */}
          <path d="M59 88 C65 89 73 86 77 88 C76 95 69 99 64 98 C60 96 58 92 59 88 Z" fill="#0c0910" strokeWidth="1.4" />
          <path d="M43 90 C47 91 51 91 53 92 C52 96 49 98 46 97 C44 96 43 93 43 90 Z" fill="#0c0910" strokeWidth="1.3" />
          {/* nose slit */}
          <path d="M51 100 L54 105 L49 105 Z" fill="#0c0910" strokeWidth="1" />
          {/* grinning mouth slot with teeth */}
          <path d="M47 111 C54 114 64 112 72 106 L70 114 C63 119 55 120 49 117 Z" fill="#0c0910" strokeWidth="1.3" />
          <path d="M52 113 L52 118 M57 113 L57 119 M62 112 L62 118 M67 110 L67 116" fill="none" stroke={P.bone[3]} strokeWidth="1.3" />
          {/* cracks */}
          <path d="M67 68 L64 76 L69 80 L65 88" fill="none" stroke={INK} strokeWidth="1.2" />
          <path d="M76 100 L80 104 L75 108" fill="none" stroke={INK} strokeWidth="1.1" />
          <path d="M47 76 L51 81 L49 85" fill="none" stroke={INK} strokeWidth="1" />
          {/* lit rim */}
          <path d="M46 78 C52 72 60 70 68 71" fill="none" stroke="#fffaf0" strokeWidth="1.4" opacity="0.8" />
          {/* ember pinpoints */}
          <circle cx="68" cy="93" r="7" fill={url("ember")} stroke="none" opacity="0.7" />
          <circle cx="68" cy="93" r="1.9" fill={GLOW.ember} stroke="none" filter="url(#glow)" />
          <circle cx="48" cy="94" r="1.4" fill={GLOW.ember} stroke="none" filter="url(#glow)" />
          </g>

          {/* ---------- near arm ---------- */}
          {strike ? (
            <g>
              {/* arm flung forward, claws raking */}
              <g transform="translate(4 26) rotate(8 96 116)">
              <path d="M92 106 C104 104 110 114 106 124 C98 128 88 128 80 126 C72 124 62 122 54 120 L54 110 C62 108 72 108 80 108 Z" fill={url("skin")} strokeWidth="2.3" />
              <path d="M80 124 C88 126 98 126 104 120" fill="none" stroke={SK[1]} strokeWidth="1.2" opacity="0.8" />
              <path d="M84 111 C74 110 64 110 56 112" fill="none" stroke={SK[4]} strokeWidth="1.2" opacity="0.8" />
              <path d="M66 108 L64 122 M72 108 L70 124" fill="none" stroke={P.oxblood[2]} strokeWidth="3" />
              <path d="M58 107 C50 104 43 108 41 114 C43 120 50 123 56 121 Z" fill={url("skin")} strokeWidth="2" />
              {finger("M45 108 C38 100 32 97 26 98", "M27 96 L19 99 L27 101 Z")}
              {finger("M43 112 C36 109 28 110 23 114", "M24 112 L17 118 L24 116 Z")}
              {finger("M44 117 C37 120 31 124 29 130", "M30 128 L25 136 L27 128 Z")}
              {finger("M49 121 C45 127 43 133 43 139", "M44 137 L41 145 L41 137 Z", 3)}
              
              </g>
            </g>
          ) : (
            <g>
              <path d="M88 110 C84 124 82 140 82 152 C76 164 66 176 58 186 L66 192 C74 180 86 168 94 158 C98 146 104 128 106 114 C104 104 92 102 88 110 Z" fill={url("skin")} strokeWidth="2.3" />
              <path d="M96 158 C100 146 104 130 104 118" fill="none" stroke={SK[1]} strokeWidth="1.3" opacity="0.7" />
              <path d="M86 118 C84 130 84 142 84 150 M80 158 C74 166 68 174 62 182" fill="none" stroke={SK[4]} strokeWidth="1.2" opacity="0.85" />
              {/* knobbly elbow */}
              <path d="M90 150 C94 154 95 158 93 162" fill="none" stroke={SK[1]} strokeWidth="1.2" />
              {/* rag wrapped round the forearm */}
              <path d="M70 172 L80 180 L76 186 L66 178 Z" fill={P.oxblood[2]} strokeWidth="1.4" />
              <path d="M66 178 L58 196 L62 186 L56 194" fill="none" stroke={P.oxblood[1]} strokeWidth="1.6" />
              {/* hand */}
              <path d="M58 184 C52 186 48 192 50 198 C54 202 60 202 66 194 Z" fill={url("skin")} strokeWidth="2" />
              {finger("M50 196 C44 204 42 212 44 222", "M44 220 L46 230 L41 221 Z")}
              {finger("M54 199 C52 208 52 216 56 224", "M56 222 L60 231 L53 223 Z")}
              {finger("M59 199 C60 206 62 212 66 218", "M66 216 L71 224 L63 218 Z", 3)}
              {finger("M51 190 C44 192 40 198 38 206", "M38 204 L36 213 L35 204 Z", 2.8)}
            </g>
          )}
        </g>

        {strike && (
          <g fill="none" stroke={P.ember[4]} strokeLinecap="round" opacity="0.9">
            <path d="M12 118 C3 136 0 158 4 184" strokeWidth="2.6" />
            <path d="M20 122 C11 140 8 162 12 188" strokeWidth="2.2" />
            <path d="M28 128 C20 146 18 166 22 190" strokeWidth="1.8" />
          </g>
        )}
        {/* ---------- near leg ---------- */}
        {strike ? (
          <path d="M104 172 C90 180 72 190 60 202 C54 208 56 216 60 220 C60 234 58 246 56 254 C48 258 38 262 34 265 C32 269 36 269 40 268 L74 268 C74 262 70 256 68 250 C70 236 72 224 72 214 C82 204 98 196 116 186 Z" fill={url("skin")} strokeWidth="2.4" />
        ) : (
          <path d="M104 168 C96 180 84 196 76 206 C72 212 73 218 76 222 C80 234 84 246 86 254 C78 257 68 260 62 264 C60 268 64 269 68 268 L100 268 C102 262 100 256 96 252 C92 240 90 228 87 216 C94 204 104 190 118 176 Z" fill={url("skin")} strokeWidth="2.4" />
        )}
        {strike ? (
          <g fill="none">
            <path d="M68 214 C66 228 64 240 62 250" stroke={SK[1]} strokeWidth="1.3" opacity="0.8" />
            <path d="M60 206 C57 212 58 218 62 220" stroke={SK[1]} strokeWidth="1.3" />
            <path d="M36 266 L30 269 M44 266 L40 270" stroke={INK} strokeWidth="1.4" />
          </g>
        ) : (
          <g fill="none">
            <path d="M90 220 C92 234 95 246 97 254 L92 254 C88 240 86 230 86 220 Z" fill={SK[0]} stroke="none" opacity="0.45" />
            <path d="M88 216 C96 204 106 192 116 180" stroke={SK[1]} strokeWidth="1.3" opacity="0.8" />
            <path d="M84 196 C80 202 76 208 76 214" stroke={SK[4]} strokeWidth="1.2" opacity="0.8" />
            <path d="M74 210 C72 216 74 220 78 222" stroke={SK[1]} strokeWidth="1.3" />
            <path d="M66 266 L60 269 M74 266 L70 270" stroke={INK} strokeWidth="1.4" />
          </g>
        )}

        
      </g>
    </svg>
  );
}
