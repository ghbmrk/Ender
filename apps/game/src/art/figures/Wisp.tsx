import { useId } from "react";
import { INK, P, GLOW } from "../palette";
import type { FigureMeta, FigureProps } from "../types";

export const meta: FigureMeta = { id: "wisp", viewBox: [0, 0, 200, 280], feet: { x: 104, y: 264 }, head: [60, 36, 72, 72], facing: "left" };

/** The Wisp: a hooded wraith of layered, tattered spirit-veils, with cold eyes and long grasping spectral hands. */
export default function Wisp({ viewBox, className, pose = "idle" }: FigureProps) {
  const u = useId().replace(/:/g, "");
  const id = (s: string) => `${u}-${s}`;
  const url = (s: string) => `url(#${id(s)})`;
  const strike = pose === "strike";

  /* a long spectral finger: ink under-stroke, pale core */
  const finger = (d: string, w = 2.1) => (
    <g>
      <path d={d} fill="none" stroke={P.spirit[0]} strokeWidth={w + 2} />
      <path d={d} fill="none" stroke={P.spirit[4]} strokeWidth={w} />
    </g>
  );

  return (
    <svg viewBox={viewBox ?? meta.viewBox.join(" ")} className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id("veil")} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={P.spirit[2]} stopOpacity="0.95" />
          <stop offset="0.45" stopColor={P.spirit[1]} stopOpacity="0.85" />
          <stop offset="1" stopColor={P.violet[1]} stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id={id("veilBack")} x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor={P.violet[2]} stopOpacity="0.8" />
          <stop offset="1" stopColor={P.violet[3]} stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id={id("veilFront")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.spirit[3]} stopOpacity="0.85" />
          <stop offset="0.6" stopColor={P.spirit[2]} stopOpacity="0.55" />
          <stop offset="1" stopColor={P.sapphire[1]} stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id={id("hood")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.spirit[3]} />
          <stop offset="0.4" stopColor={P.spirit[2]} />
          <stop offset="1" stopColor={P.violet[0]} />
        </linearGradient>
        <linearGradient id={id("edge")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={INK} />
          <stop offset="0.55" stopColor={P.violet[0]} stopOpacity="0.8" />
          <stop offset="1" stopColor={P.violet[1]} stopOpacity="0.15" />
        </linearGradient>
        <radialGradient id={id("void")} cx="0.4" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#0b1830" />
          <stop offset="1" stopColor="#05060d" />
        </radialGradient>
        <radialGradient id={id("burst")}>
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.3" stopColor={GLOW.cold} />
          <stop offset="0.7" stopColor={P.spirit[3]} stopOpacity="0.5" />
          <stop offset="1" stopColor={P.spirit[2]} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("core")}>
          <stop offset="0" stopColor={GLOW.cold} stopOpacity="0.7" />
          <stop offset="1" stopColor={P.spirit[2]} stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="104" cy="264" rx="44" ry="6" fill={INK} opacity="0.26" filter="url(#wc-wash)" />
      <ellipse cx="100" cy="263" rx="26" ry="3.5" fill={P.spirit[2]} opacity="0.25" filter="url(#glow-soft)" />

      <g transform={strike ? "translate(-14 -4) rotate(-7 110 140)" : undefined}>
        {/* trailing wisps behind */}
        <g fill="none" strokeLinecap="round" opacity="0.6">
          <path d={strike ? "M150 150 C176 170 188 200 196 236" : "M146 160 C164 190 170 214 186 240"} stroke={P.spirit[3]} strokeWidth="3" />
          <path d={strike ? "M140 176 C162 200 172 226 186 256" : "M138 186 C150 210 156 232 170 254"} stroke={P.violet[3]} strokeWidth="2.2" />
          <path d={strike ? "M126 196 C140 220 148 238 164 258" : "M120 206 C126 226 132 240 144 256"} stroke={P.spirit[4]} strokeWidth="1.6" />
        </g>

        <g filter="url(#fig)" stroke={INK} strokeLinejoin="round" strokeLinecap="round">
          {/* back veil: violet, trailing furthest */}
          <path
            d={strike
              ? "M110 78 C136 80 158 100 168 130 C176 156 184 184 198 214 C188 212 180 208 176 204 C182 222 190 236 198 248 C186 244 176 236 168 226 C168 240 170 252 174 262 C162 252 154 240 150 228 C142 238 136 246 124 252 C128 236 128 222 124 210 C110 180 104 130 110 78 Z"
              : "M108 78 C134 80 154 100 162 130 C170 160 174 188 188 216 C178 214 172 210 166 206 C172 224 178 238 186 252 C174 246 166 238 158 228 C158 242 160 254 164 264 C152 254 144 242 140 230 C132 240 124 248 112 254 C116 238 116 224 112 212 C98 180 98 130 108 78 Z"}
            fill={url("veilBack")}
            strokeWidth="1.6"
            stroke={url("edge")}
          />
          {/* main veil */}
          <path
            d={strike
              ? "M78 112 C68 146 76 184 96 212 C100 224 104 236 104 248 C110 236 114 228 116 222 C124 236 134 248 146 256 C142 242 140 232 140 224 C152 238 166 248 184 252 C172 238 166 226 164 218 C174 226 186 230 196 230 C180 214 170 190 162 160 C156 136 148 120 140 108 Z"
              : "M76 112 C64 146 70 184 88 214 C92 226 92 238 90 250 C98 240 102 232 106 224 C112 238 118 250 128 260 C126 246 126 236 126 228 C136 242 148 252 162 258 C154 244 150 232 148 224 C158 232 170 238 182 240 C168 222 160 196 156 162 C152 136 148 120 140 108 Z"}
            fill={url("veil")}
            stroke={url("edge")}
            strokeWidth="2.2"
          />
          {/* veil folds */}
          <g fill="none" stroke={P.spirit[0]} strokeWidth="1.2" opacity="0.6">
            <path d="M92 130 C86 160 84 190 88 222" />
            <path d="M112 128 C110 162 112 196 118 232" />
            <path d="M130 124 C132 156 138 190 146 226" />
          </g>
          <g fill="none" stroke={P.spirit[4]} strokeWidth="1.1" opacity="0.55">
            <path d="M82 124 C74 150 70 176 72 204" />
            <path d="M102 130 C98 160 98 190 102 220" />
          </g>
          {/* sheer inner layer drifting in front */}
          <path d={strike ? "M88 130 C84 160 92 190 108 214 C112 226 116 236 120 246 C124 232 126 222 128 214 C134 222 142 230 152 236 C144 214 138 186 136 150 Z" : "M86 130 C80 160 84 190 96 214 C100 226 102 236 104 248 C110 234 114 224 116 216 C122 226 130 234 140 240 C132 216 128 188 128 150 Z"} fill={P.spirit[4]} opacity="0.18" stroke="none" />
          <path d={strike ? "M100 150 C104 180 112 206 124 230" : "M96 150 C98 180 104 206 112 232"} fill="none" stroke={P.spirit[4]} strokeWidth="1" opacity="0.5" />
          {/* ghost-light in the chest */}
          <ellipse cx="108" cy="150" rx="24" ry="30" fill={url("core")} stroke="none" />

          {/* far arm */}
          {strike ? (
            <g>
              <path d="M92 116 C80 114 64 112 50 110 L48 124 C62 126 76 128 90 132 Z" fill={P.spirit[1]} strokeWidth="1.8" opacity="0.9" />
              <path d="M50 108 L42 104 L46 114 L40 120 L48 126 Z" fill={P.spirit[2]} strokeWidth="1.4" opacity="0.9" />
              {finger("M44 112 C36 108 28 104 20 104", 1.8)}
              {finger("M44 116 C36 116 28 116 20 118", 1.8)}
              {finger("M44 120 C38 124 30 128 24 132", 1.8)}
            </g>
          ) : (
            <g>
              <path d="M90 116 C80 118 66 120 54 118 L52 132 C64 134 78 134 90 130 Z" fill={P.spirit[1]} strokeWidth="1.8" opacity="0.9" />
              <path d="M54 116 L46 114 L50 122 L44 128 L52 134 Z" fill={P.spirit[2]} strokeWidth="1.4" opacity="0.9" />
              {finger("M48 122 C40 118 34 118 28 122", 1.8)}
              {finger("M48 126 C40 126 34 130 30 136", 1.8)}
              {finger("M48 130 C44 136 40 140 38 146", 1.8)}
            </g>
          )}

          {/* front drape over the shoulders */}
          <path d="M72 108 C88 100 124 98 146 108 C150 124 148 140 142 154 C138 146 134 142 130 140 C130 150 128 158 124 166 C120 156 116 150 112 146 C110 154 106 160 100 164 C100 154 98 146 94 142 C90 148 86 150 80 150 C84 142 84 134 82 128 C76 122 72 116 72 108 Z" fill={url("veilFront")} strokeWidth="1.8" />
          <path d="M84 110 C100 106 122 106 140 112" fill="none" stroke={P.spirit[4]} strokeWidth="1.3" opacity="0.8" />

          {/* hood */}
          <path d="M68 92 C64 66 80 42 106 36 C122 32 136 34 150 26 C146 40 150 56 150 74 C150 94 144 110 132 120 C116 124 96 124 82 120 C74 112 70 102 68 92 Z" fill={url("hood")} strokeWidth="2.5" />
          {/* frayed tail of the hood */}
          <path d="M150 26 C156 34 160 44 158 56 C154 50 152 46 148 44 C150 50 150 56 148 60 C146 50 146 40 150 26 Z" fill={P.violet[1]} strokeWidth="1.6" />
          {/* hood shadow side */}
          <path d="M142 46 C148 62 148 84 144 100 C140 110 134 116 126 120 C136 104 140 80 138 58 Z" fill={P.violet[0]} stroke="none" opacity="0.5" />
          {/* hood folds and rim light */}
          <path d="M116 40 C126 56 130 80 126 104 M132 36 C140 54 142 76 138 96" fill="none" stroke={P.sapphire[0]} strokeWidth="1.2" opacity="0.7" />
          <path d="M72 80 C76 60 88 46 104 40" fill="none" stroke={P.spirit[4]} strokeWidth="1.6" opacity="0.9" />
          {/* the dark face opening */}
          <path d="M70 96 C68 78 78 62 96 56 C108 60 114 72 114 88 C112 102 102 114 88 118 C78 114 72 106 70 96 Z" fill={url("void")} strokeWidth="2" />
          {/* hood lip */}
          <path d="M70 96 C68 78 78 62 96 56 C108 60 114 72 114 88" fill="none" stroke={P.spirit[3]} strokeWidth="1.8" />
          <path d="M74 84 C80 70 90 64 100 64 C108 68 110 76 110 84 C100 78 86 78 74 84 Z" fill="#04050b" stroke="none" opacity="0.7" />
          {/* cold eyes: narrow, slanted, burning */}
          <path d="M75 86 C80 86 86 88 89 91 C84 92 79 91 75 86 Z" fill={GLOW.cold} stroke="none" filter="url(#glow)" />
          <path d="M95 91 C99 88 105 86 110 85 C107 90 101 92 95 91 Z" fill={GLOW.cold} stroke="none" filter="url(#glow)" />
          <path d="M79 88 L87 90.5 M97 90.5 L106 87" stroke="#fff" strokeWidth="1" />
          

          {/* near arm */}
          {strike ? (
            <g>
              <path d="M112 118 C96 124 76 128 56 130 L54 146 C74 148 96 146 116 140 Z" fill={url("hood")} strokeWidth="2.2" />
              <path d="M90 128 C82 132 72 136 62 138" fill="none" stroke={P.sapphire[0]} strokeWidth="1.1" opacity="0.7" />
              <path d="M92 144 C94 154 96 162 100 170 C100 164 102 160 104 158 C108 164 112 168 118 170 C112 162 108 152 106 142 Z" fill={P.spirit[2]} strokeWidth="1.4" opacity="0.85" />
              <path d="M56 128 L46 124 L52 134 L42 140 L54 144 L50 152 L60 148 Z" fill={P.spirit[2]} strokeWidth="1.6" />
              {finger("M50 132 C40 126 32 122 22 120")}
              {finger("M48 136 C38 134 28 134 18 136")}
              {finger("M48 140 C38 142 30 146 20 152")}
              {finger("M52 144 C46 150 40 156 34 162")}
            </g>
          ) : (
            <g>
              <path d="M114 118 C104 128 90 138 76 146 C70 148 64 150 58 152 L64 168 C76 164 90 158 104 150 C116 142 124 132 126 122 Z" fill={url("hood")} strokeWidth="2.2" />
              <path d="M104 134 C94 142 84 150 72 156" fill="none" stroke={P.sapphire[0]} strokeWidth="1.1" opacity="0.7" />
              <path d="M110 122 C100 132 88 140 76 146" fill="none" stroke={P.spirit[4]} strokeWidth="1.1" opacity="0.7" />
              {/* tatters hanging from the sleeve */}
              <path d="M96 146 C94 156 92 164 88 172 C92 168 96 166 98 164 C100 170 100 176 98 182 C104 172 106 160 104 146 Z" fill={P.spirit[2]} strokeWidth="1.4" opacity="0.85" />
              {/* tattered cuff */}
              <path d="M58 150 L48 150 L54 158 L46 166 L58 166 L56 174 L66 168 Z" fill={P.spirit[2]} strokeWidth="1.6" />
              {finger("M52 156 C42 154 34 156 28 160")}
              {finger("M52 160 C42 162 36 168 32 176")}
              {finger("M54 164 C48 172 46 180 46 188")}
              {finger("M58 166 C58 174 60 180 64 186", 1.8)}
            </g>
          )}
        </g>

        {/* cold burst released from the hands */}
        {strike && (
          <g>
            <circle cx="16" cy="136" r="26" fill={url("burst")} />
            <g stroke={GLOW.cold} strokeLinecap="round" strokeWidth="1.6" opacity="0.9">
              <path d="M16 136 L-6 124 M16 136 L-4 150 M16 136 L2 112 M16 136 L4 162 M16 136 L-8 137" />
            </g>
            <circle cx="16" cy="136" r="5" fill="#fff" filter="url(#glow)" />
          </g>
        )}
        {/* eye halo, unfiltered */}
        <ellipse cx="92" cy="89" rx="17" ry="6" fill={GLOW.cold} opacity="0.3" filter="url(#glow-soft)" />
      </g>
    </svg>
  );
}
