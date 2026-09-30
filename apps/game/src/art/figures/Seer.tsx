import { useId } from "react";
import { INK, P, GLOW } from "../palette";
import type { FigureMeta, FigureProps } from "../types";

export const meta: FigureMeta = { id: "seer", viewBox: [0, 0, 200, 280], feet: { x: 112, y: 268 }, head: [76, 30, 60, 60], facing: "left" };

/** The Seer: a tall masked oracle in layered verdigris robes, holding a staff hung with a golden lantern. */
export default function Seer({ viewBox, className, pose = "idle" }: FigureProps) {
  const u = useId().replace(/:/g, "");
  const id = (s: string) => `${u}-${s}`;
  const url = (s: string) => `url(#${id(s)})`;
  const strike = pose === "strike";
  const staffT = strike ? "translate(-2 -40) rotate(-12 60 146)" : undefined;
  const lx = 34;
  const ly = 72;
  return (
    <svg viewBox={viewBox ?? meta.viewBox.join(" ")} className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id("robe")} x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0" stopColor={P.verdigris[3]} />
          <stop offset="0.4" stopColor={P.verdigris[2]} />
          <stop offset="1" stopColor={P.verdigris[0]} />
        </linearGradient>
        <linearGradient id={id("inner")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.violet[2]} />
          <stop offset="1" stopColor={P.violet[0]} />
        </linearGradient>
        <linearGradient id={id("cape")} x1="0" y1="0" x2="1" y2="0.5">
          <stop offset="0" stopColor={P.verdigris[2]} />
          <stop offset="1" stopColor={P.verdigris[0]} />
        </linearGradient>
        <linearGradient id={id("gold")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.gold[4]} />
          <stop offset="0.45" stopColor={P.gold[3]} />
          <stop offset="1" stopColor={P.gold[1]} />
        </linearGradient>
        <radialGradient id={id("mask")} cx="0.3" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor={P.bone[4]} />
          <stop offset="1" stopColor={P.bone[2]} />
        </radialGradient>
        <linearGradient id={id("hand")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.bone[4]} />
          <stop offset="1" stopColor={P.bone[2]} />
        </linearGradient>
        <linearGradient id={id("wood")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={P.leather[3]} />
          <stop offset="0.5" stopColor={P.leather[2]} />
          <stop offset="1" stopColor={P.leather[0]} />
        </linearGradient>
        <radialGradient id={id("core")}>
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.4" stopColor={GLOW.rune} />
          <stop offset="1" stopColor={P.gold[2]} />
        </radialGradient>
        <radialGradient id={id("blaze")}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.25" stopColor={GLOW.rune} stopOpacity="0.8" />
          <stop offset="0.6" stopColor={GLOW.hex} stopOpacity="0.35" />
          <stop offset="1" stopColor={GLOW.hex} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ground shadow */}
      <ellipse cx="112" cy="267" rx="66" ry="8" fill={INK} opacity="0.32" filter="url(#wc-wash)" />

      {/* painted gold halo behind the head */}
      <g fill="none" strokeLinecap="round">
        <circle cx="118" cy="58" r="34" stroke={INK} strokeWidth="4.6" opacity="0.85" />
        <circle cx="118" cy="58" r="34" stroke={url("gold")} strokeWidth="2.6" />
        <path d="M118 20 L118 12 M146 30 L152 24 M156 58 L164 58 M146 86 L152 92 M90 30 L84 24" stroke={P.gold[2]} strokeWidth="2" />
      </g>

      <g filter="url(#wc)" stroke={INK} strokeLinejoin="round" strokeLinecap="round">
        {/* trailing back of the outer robe */}
        <path d="M130 100 C150 130 164 190 184 258 C172 266 158 266 146 262 Z" fill={P.verdigris[0]} strokeWidth="2.2" />

        {/* outer robe */}
        <path d="M94 92 C82 100 78 122 80 150 C74 190 62 230 50 262 C82 270 140 270 176 262 C162 220 148 182 142 150 C142 120 140 100 128 92 Z" fill={url("robe")} strokeWidth="2.6" />
        {/* shadow side */}
        <path d="M122 96 C134 100 140 118 142 150 C148 182 162 220 176 262 C160 266 146 266 132 266 C140 220 132 170 122 96 Z" fill={P.verdigris[0]} stroke="none" opacity="0.5" />
        {/* folds */}
        <path d="M112 170 C116 200 118 232 118 264 M130 176 C138 206 146 236 152 264 M86 176 C82 206 78 232 74 264" fill="none" stroke={P.verdigris[0]} strokeWidth="1.4" opacity="0.8" />
        <path d="M82 160 C78 190 70 226 60 258" fill="none" stroke={P.verdigris[4]} strokeWidth="1.3" opacity="0.7" />

        <path d="M60 244 C96 252 138 252 170 244" fill="none" stroke={P.gold[2]} strokeWidth="1.8" />
        <path d="M66 252 L70 246 L74 252 M112 254 L116 248 L120 254 M150 250 L154 244 L158 250" fill="none" stroke={P.gold[3]} strokeWidth="1.3" />
        <path d="M128 94 C136 120 140 140 142 150" fill="none" stroke={P.gold[2]} strokeWidth="1.6" />
        {/* inner violet robe at the front opening */}
        <path d="M84 150 C80 190 72 230 64 264 L100 266 C100 224 100 184 102 150 Z" fill={url("inner")} strokeWidth="2" />
        {/* gold embroidery on the inner panel */}
        <path d="M78 230 L100 230 M74 246 L100 246" fill="none" stroke={P.gold[3]} strokeWidth="2" />
        <path d="M80 238 L84 234 L88 238 L92 234 L96 238 M76 254 L80 250 L84 254 L88 250 L92 254 L96 250" fill="none" stroke={P.gold[3]} strokeWidth="1.2" />
        <path d="M88 180 C84 186 86 194 92 194 C98 194 98 186 94 182 C92 188 90 190 88 180 Z" fill={url("gold")} strokeWidth="1" />
        <path d="M84 150 C80 190 72 230 64 264 M102 150 C100 184 100 224 100 266" fill="none" stroke={P.gold[2]} strokeWidth="2.4" />
        {/* robe hem trim */}
        <path d="M50 262 C82 270 140 270 176 262" fill="none" stroke={P.gold[2]} strokeWidth="3.2" />
        <path d="M58 258 C90 265 134 265 168 258" fill="none" stroke={P.gold[1]} strokeWidth="1.1" strokeDasharray="3 4" />
        {/* slipper toe */}
        <path d="M66 266 C58 266 50 268 46 270 C54 272 66 272 74 270 Z" fill={P.violet[1]} strokeWidth="1.6" />

        {/* sash */}
        <path d="M80 142 C96 148 122 148 142 142 L143 154 C122 160 96 160 80 154 Z" fill={P.oxblood[2]} strokeWidth="1.8" />
        <path d="M82 146 C96 151 122 151 140 146" fill="none" stroke={P.oxblood[4]} strokeWidth="1" opacity="0.7" />
        <path d="M120 156 L116 196 L122 192 L126 198 L128 156 Z" fill={P.oxblood[1]} strokeWidth="1.6" />
        <circle cx="112" cy="151" r="4.4" fill={url("gold")} strokeWidth="1.3" />

        {/* shoulder capelet, scalloped */}
        <path d="M96 88 C86 94 78 108 76 126 C84 132 90 126 96 132 C102 138 110 130 116 136 C122 140 130 132 136 134 C142 134 146 126 146 120 C144 104 138 94 128 88 Z" fill={url("cape")} strokeWidth="2.4" />
        <path d="M128 90 C138 96 144 106 146 120 C146 126 142 134 136 134 C134 118 132 104 128 90 Z" fill={P.verdigris[0]} stroke="none" opacity="0.5" />
        <path d="M78 124 C84 130 90 124 96 130 C102 136 110 128 116 134 C122 138 130 130 136 132" fill="none" stroke={P.gold[3]} strokeWidth="2" />
        <path d="M86 108 C90 104 96 104 98 108 M104 112 C108 108 114 108 116 112" fill="none" stroke={P.gold[3]} strokeWidth="1.2" />

        {/* embroidered stole hanging down the front */}
        <path d="M100 92 C98 120 96 150 94 196 L104 198 C106 150 108 120 108 94 Z" fill={url("gold")} strokeWidth="1.6" />
        <path d="M98 120 L106 120 M97 140 L106 140 M96 160 L105 160 M95 180 L104 180" fill="none" stroke={P.gold[0]} strokeWidth="1" />
        <path d="M101 128 L103 132 L101 136 L99 132 Z M100 168 L102 172 L100 176 L98 172 Z" fill={P.verdigris[2]} strokeWidth="0.8" />
        <path d="M94 196 L92 206 M99 197 L99 208 M104 198 L106 206" fill="none" stroke={P.gold[2]} strokeWidth="1.2" />

        {/* far arm: long-fingered hand reaching forward */}
        <path d="M128 102 C136 118 132 140 120 152 C112 158 102 160 94 158 L94 146 C104 142 114 134 118 120 Z" fill={url("cape")} strokeWidth="2.2" />
        <path d="M94 146 C88 150 86 156 94 160 L100 158 Z" fill={P.gold[2]} strokeWidth="1.4" />
        {strike ? (
          <path d="M92 150 C84 150 78 156 74 164 M92 154 C86 158 82 166 80 176 M94 156 C90 164 90 172 90 182 M96 157 C96 164 98 170 100 176" fill="none" stroke={INK} strokeWidth="4.2" />
        ) : (
          <path d="M92 150 C86 154 82 162 80 172 M92 154 C88 160 86 170 86 180 M94 156 C92 164 92 172 94 182 M96 157 C96 164 98 170 100 176" fill="none" stroke={INK} strokeWidth="4.2" />
        )}
        {strike ? (
          <path d="M92 150 C84 150 78 156 74 164 M92 154 C86 158 82 166 80 176 M94 156 C90 164 90 172 90 182 M96 157 C96 164 98 170 100 176" fill="none" stroke={url("hand")} strokeWidth="2.3" />
        ) : (
          <path d="M92 150 C86 154 82 162 80 172 M92 154 C88 160 86 170 86 180 M94 156 C92 164 92 172 94 182 M96 157 C96 164 98 170 100 176" fill="none" stroke={url("hand")} strokeWidth="2.3" />
        )}

        {/* ---------- head ---------- */}
        {/* tall pointed cowl */}
        <path d="M98 100 C88 88 84 62 90 44 C96 30 106 18 118 10 C126 22 136 40 138 58 C140 76 136 92 130 100 Z" fill={url("cape")} strokeWidth="2.6" />
        <path d="M118 10 C126 22 136 40 138 58 C140 76 136 92 130 100 L122 100 C130 74 128 40 118 10 Z" fill={P.verdigris[0]} stroke="none" opacity="0.55" />
        <path d="M90 46 C96 32 106 20 116 12" fill="none" stroke={P.verdigris[4]} strokeWidth="1.4" opacity="0.8" />
        {/* shadowed opening */}
        <path d="M90 50 C94 40 108 36 118 44 C124 58 124 80 116 94 C106 98 94 96 90 86 C86 74 86 60 90 50 Z" fill="#0c1a19" strokeWidth="1.8" />
        {/* gold circlet on the cowl */}
        <path d="M90 46 C98 38 112 38 120 44" fill="none" stroke={P.gold[2]} strokeWidth="2.4" />
        <circle cx="104" cy="40" r="2.6" fill={P.verdigris[3]} strokeWidth="1" />

        {/* ---------- staff and lantern ---------- */}
        <g transform={staffT}>
          <path d="M56 36 L60 266" stroke={INK} strokeWidth="6.4" />
          <path d="M56 36 L60 266" stroke={url("wood")} strokeWidth="3.8" />
          {/* crook */}
          <path d="M56 40 C56 28 48 22 40 24 C32 26 30 34 34 40" fill="none" stroke={INK} strokeWidth="6" />
          <path d="M56 40 C56 28 48 22 40 24 C32 26 30 34 34 40" fill="none" stroke={P.gold[2]} strokeWidth="3" />
          <circle cx="56" cy="46" r="3.4" fill={url("gold")} strokeWidth="1.3" />
          <path d="M34 42 L34 54" stroke={P.gold[1]} strokeWidth="1.4" strokeDasharray="2 1.5" />
          {/* lantern cage */}
          <circle cx={lx} cy={ly} r="9" fill={url("core")} stroke="none" filter="url(#glow)" />
          <path d="M26 58 L34 52 L42 58 Z" fill={url("gold")} strokeWidth="1.6" />
          <path d="M26 60 L42 60 L44 84 L24 84 Z" fill="none" strokeWidth="2" />
          <path d="M26 60 L42 60 L44 84 L24 84 Z" fill="none" stroke={P.gold[3]} strokeWidth="1" />
          <path d="M34 60 L34 84 M29 60 L28 84 M39 60 L40 84 M25 72 L43 72" fill="none" stroke={P.gold[1]} strokeWidth="1.1" />
          <path d="M24 84 L44 84 L40 90 L28 90 Z" fill={url("gold")} strokeWidth="1.5" />
          <path d="M34 90 L34 98" stroke={P.gold[1]} strokeWidth="1.6" />
          <path d="M31 98 L37 98 L34 104 Z" fill={P.verdigris[3]} strokeWidth="1" />
          {/* ribbons tied at the crook */}
          <path d="M52 44 C48 56 50 66 46 76 M56 46 C58 58 54 70 56 80" fill="none" stroke={P.oxblood[2]} strokeWidth="1.8" />
        </g>

        {/* near arm: bell sleeve and hand on the staff */}
        {strike ? (
          <g>
            <path d="M98 94 C86 96 70 100 58 102 L54 116 C66 118 80 116 92 114 Z" fill={url("robe")} strokeWidth="2.2" />
            <path d="M58 102 C52 118 50 134 54 150 C62 146 70 136 76 118 C70 118 62 118 56 116 Z" fill={url("cape")} strokeWidth="2" />
            <path d="M58 102 C52 118 50 134 54 150" fill="none" stroke={P.gold[3]} strokeWidth="2" />
            <path d="M44 100 C48 96 56 98 58 104 C58 110 52 114 46 112 C42 110 42 104 44 100 Z" fill={url("hand")} strokeWidth="1.6" />
            <path d="M46 102 L42 104 M46 106 L42 108 M47 110 L44 112" fill="none" strokeWidth="1" />
          </g>
        ) : (
          <g>
            <path d="M96 94 C86 104 74 124 66 140 L74 148 C86 136 96 122 104 110 Z" fill={url("robe")} strokeWidth="2.2" />
            <path d="M66 140 C62 156 64 176 70 190 C78 182 84 168 86 150 C80 150 72 148 66 140 Z" fill={url("cape")} strokeWidth="2" />
            <path d="M66 140 C62 156 64 176 70 190" fill="none" stroke={P.gold[3]} strokeWidth="2" />
            <path d="M52 140 C56 134 66 136 68 142 C68 150 62 154 56 152 C50 150 50 144 52 140 Z" fill={url("hand")} strokeWidth="1.6" />
            <path d="M54 142 L50 144 M54 146 L50 148 M55 150 L52 152" fill="none" strokeWidth="1" />
          </g>
        )}
      </g>

      <g stroke={INK} strokeLinejoin="round" strokeLinecap="round">
        {/* porcelain mask, turned toward the party */}
        <path d="M90 52 C94 44 106 42 112 48 C117 58 117 76 111 86 C105 92 95 90 90 82 C86 72 86 60 90 52 Z" fill={url("mask")} strokeWidth="2" />
        <path d="M108 48 C115 58 115 76 110 86 C105 91 100 91 97 90 C106 80 110 64 108 48 Z" fill={P.bone[2]} stroke="none" opacity="0.5" />
        {/* brow and nose ridge */}
        <path d="M89 60 C90 57 92 56 93 57 M92 62 C90 68 88 70 90 72" fill="none" strokeWidth="1.1" />
        {/* the single painted eye */}
        <path d="M92 62 C96 56 106 56 110 62 C106 68 96 68 92 62 Z" fill="#fff" strokeWidth="1.3" />
        <circle cx="100" cy="62" r="3.6" fill={P.verdigris[2]} strokeWidth="0.9" />
        <circle cx="100" cy="62" r="1.5" fill={INK} stroke="none" />
        <path d="M92 58 C96 52 106 52 112 58" fill="none" stroke={P.gold[2]} strokeWidth="1.3" />
        <path d="M94 57 L92 53 M98 55 L97 51 M103 55 L103 51 M107 56 L109 52" fill="none" strokeWidth="0.9" />
        {/* gilt tear-lines and a small closed mouth */}
        <path d="M99 68 C98 74 100 78 98 84 M104 68 C104 72 106 76 105 80" fill="none" stroke={P.gold[2]} strokeWidth="1.2" />
        <path d="M92 80 C94 81 96 81 97 80" fill="none" stroke={P.oxblood[2]} strokeWidth="1.4" />
      </g>
      <path d="M91 54 C94 47 102 45 108 47" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
      <path d="M89 66 C89 72 90 77 92 80" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      {/* the lantern's light (unfiltered) */}
      <g transform={staffT}>
        <circle cx={lx} cy={ly} r={strike ? 44 : 20} fill={url("blaze")} opacity={strike ? 1 : 0.55} />
        <circle cx={lx} cy={ly} r="8" fill={GLOW.rune} opacity="0.7" filter="url(#glow-soft)" />
        <circle cx={lx} cy={ly} r="3.2" fill="#fff" />
        {strike && (
          <g fill="none" stroke={GLOW.hex} strokeLinecap="round" filter="url(#glow)">
            <path d={`M${lx} ${ly - 30} L${lx + 26} ${ly - 15} L${lx + 26} ${ly + 15} L${lx} ${ly + 30} L${lx - 26} ${ly + 15} L${lx - 26} ${ly - 15} Z`} strokeWidth="1.6" opacity="0.9" />
            <path d={`M${lx} ${ly - 14} L${lx} ${ly - 44} M${lx + 13} ${ly + 7} L${lx + 38} ${ly + 22} M${lx - 13} ${ly + 7} L${lx - 38} ${ly + 22} M${lx + 13} ${ly - 7} L${lx + 40} ${ly - 22} M${lx - 13} ${ly - 7} L${lx - 34} ${ly - 20} M${lx} ${ly + 14} L${lx} ${ly + 42}`} stroke={GLOW.rune} strokeWidth="2" />
          </g>
        )}
      </g>
    </svg>
  );
}
