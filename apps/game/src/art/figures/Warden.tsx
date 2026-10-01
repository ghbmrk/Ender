import { useId } from "react";
import { INK, P, GLOW } from "../palette";
import type { FigureMeta, FigureProps } from "../types";
import { Emblem, HeroHead, cropFor, emblemFill, emblemSpec, heroColors, widen, type HeroColors, type Ramp } from "../hero";

/** The Warden as drawn: oxblood tabard and plume, gold trim, steel plate. */
const DRAWN: HeroColors = { skin: P.skin, hair: P.ember, primary: P.oxblood, secondary: P.gold, accent: P.oxblood, glow: P.ember, metal: P.steel };
/** Where a bare head sits in the helm's place (head frame → figure). */
const HEAD_AT = "translate(8.4 18.4) scale(0.88)";

type Pt = [number, number];

/** A tapered limb segment from A to B (widths wa→wb), sides bowed outward by ba / bb. */
function seg(ax: number, ay: number, bx: number, by: number, wa: number, wb: number, ba = 0, bb = 0) {
  const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l, ny = dx / l;
  const f = (n: number) => n.toFixed(1);
  const a1: Pt = [ax + (nx * wa) / 2, ay + (ny * wa) / 2], b1: Pt = [bx + (nx * wb) / 2, by + (ny * wb) / 2];
  const b2: Pt = [bx - (nx * wb) / 2, by - (ny * wb) / 2], a2: Pt = [ax - (nx * wa) / 2, ay - (ny * wa) / 2];
  const m1: Pt = [(a1[0] + b1[0]) / 2 + nx * ba, (a1[1] + b1[1]) / 2 + ny * ba];
  const m2: Pt = [(a2[0] + b2[0]) / 2 - nx * bb, (a2[1] + b2[1]) / 2 - ny * bb];
  return `M${f(a1[0])} ${f(a1[1])} Q${f(m1[0])} ${f(m1[1])} ${f(b1[0])} ${f(b1[1])} L${f(b2[0])} ${f(b2[1])} Q${f(m2[0])} ${f(m2[1])} ${f(a2[0])} ${f(a2[1])} Z`;
}

/** An armoured leg: cuisse, greave with a calf swell, knee cop with a fan, pointed sabaton. */
function Leg({ hip, knee, ankle, fill, far, M }: { hip: Pt; knee: Pt; ankle: Pt; fill: string; far?: boolean; M: Ramp }) {
  const [kx, ky] = knee;
  const [ax, ay] = ankle;
  const L = (t: number): Pt => [kx + (ax - kx) * t, ky + (ay - ky) * t];
  return (
    <g>
      <path d={seg(hip[0], hip[1], kx, ky, 19, 13, 1.5, 1.5)} fill={fill} strokeWidth="2.2" />
      <path d={seg(kx, ky, ax, ay, 13, 8, 1, 4)} fill={fill} strokeWidth="2.2" />
      <path d={`M${L(0.25)[0] - 2} ${L(0.25)[1]} L${L(0.92)[0] - 1.5} ${L(0.92)[1]}`} stroke={far ? M[3] : M[4]} strokeWidth="1.2" opacity="0.8" />
      <path d={`M${L(0.3)[0] + 3} ${L(0.3)[1]} L${L(0.92)[0] + 2.5} ${L(0.92)[1]}`} stroke={M[0]} strokeWidth="1" opacity="0.7" fill="none" />
      {/* sabaton */}
      <path d={`M${ax - 7} ${ay - 1} C${ax - 1} ${ay - 4} ${ax + 9} ${ay - 1} ${ax + 15} ${ay + 4} C${ax + 21} ${ay + 7} ${ax + 24} ${ay + 11} ${ax + 20} ${ay + 13} L${ax - 8} ${ay + 13} C${ax - 9} ${ay + 8} ${ax - 9} ${ay + 3} ${ax - 7} ${ay - 1} Z`} fill={fill} strokeWidth="2" />
      <path d={`M${ax + 3} ${ay} L${ax + 5} ${ay + 12} M${ax + 10} ${ay + 2} L${ax + 12} ${ay + 12}`} stroke={M[0]} strokeWidth="1" />
      {/* knee cop */}
      <path d={`M${kx - 5} ${ky + 2} C${kx - 11} ${ky + 2} ${kx - 12} ${ky + 10} ${kx - 8} ${ky + 13} C${kx - 5} ${ky + 12} ${kx - 3} ${ky + 9} ${kx - 3} ${ky + 6}`} fill={M[far ? 2 : 3]} strokeWidth="1.5" />
      <path d={`M${kx - 6} ${ky - 1} C${kx - 5} ${ky - 8} ${kx + 6} ${ky - 9} ${kx + 8} ${ky - 1} C${kx + 9} ${ky + 6} ${kx + 3} ${ky + 10} ${kx - 1} ${ky + 9} C${kx - 5} ${ky + 8} ${kx - 7} ${ky + 4} ${kx - 6} ${ky - 1} Z`} fill={fill} strokeWidth="1.9" />
      <circle cx={kx + 1} cy={ky} r="1.4" fill={P.gold[3]} stroke="none" />
      {!far && <path d={`M${kx - 3} ${ky - 5} C${kx} ${ky - 7} ${kx + 4} ${ky - 7} ${kx + 6} ${ky - 4}`} fill="none" stroke="#fff4dc" strokeWidth="1" opacity="0.8" />}
    </g>
  );
}

/**
 * An open-faced helm (a rounded bascinet with cheek plates, a gold brow band and a short crest), drawn in
 * the shared head frame over a HeroHead: the face shows, and the hair spills out at the brow and nape.
 */
function OpenHelm({ M, plume, hair, shaved, transform, url }: { M: Ramp; plume: Ramp; hair: Ramp; shaved: boolean; transform: string; url: (s: string) => string }) {
  return (
    <g transform={transform}>
      {/* a fringe of hair under the brow band */}
      {!shaved && (
        <path d="M129.4 62.8 C128.6 64.6 127.4 65 126.2 64.6 C125.6 65.8 124 66 122.8 65.2 C122 66.4 120.2 66.6 119 65.8 C118 67.2 116.4 67.8 115 67.6 L116 63.6 Z" fill={hair[2]} strokeWidth="1.1" />
      )}
      {/* crest tuft in the accent colour, set in a socket at the back of the crown */}
      <path d="M106 48.6 C101 41 93.4 38.4 86 40.6 C90.6 42.6 93 45.6 93.6 49.4 C89.6 49 87 50.4 85.4 53 C91 52.2 96.4 53 101.4 55 Z" fill={plume[2]} strokeWidth="1.8" />
      <path d="M104 47.6 C99 43 93 41.6 88.6 42 M101.8 52.6 C97 51.4 92 51.6 88 52.8" fill="none" stroke={plume[0]} strokeWidth="0.9" opacity="0.8" />
      <path d="M103 45 C99 42.2 95 41.2 91 41.6" fill="none" stroke={plume[4]} strokeWidth="1" opacity="0.8" />
      {/* the bowl, open from the brow down past the cheek */}
      <path d="M129.8 63.2 C130.4 54.4 123.4 46.4 113.6 46.4 C103.4 46.4 97.4 54 97.4 64.6 C97.4 71.6 99 77.8 101.6 82.6 L107.8 84.4 C108.2 80.2 108.4 75.6 109.6 71.4 C111.6 66.6 116.4 63.6 121.4 62.8 C124.6 62.4 127.6 62.6 129.8 63.2 Z" fill={url("helm")} strokeWidth="2.2" />
      <path d="M122 48 C127.4 51.6 129.8 56.6 129.8 62.6 C127 62.2 124.6 62.2 122 62.6 C123.4 58 123.4 52.6 122 48 Z" fill={M[0]} stroke="none" opacity="0.35" />
      <path d="M101.4 60 C102.4 54.4 106.6 50 112.4 48.8" fill="none" stroke="#fff4dc" strokeWidth="1.3" opacity="0.75" />
      {/* the central ridge */}
      <path d="M114 46.6 C121.6 47.8 127.6 53.4 129 60.6" fill="none" stroke={M[4]} strokeWidth="1.1" opacity="0.8" />
      {/* cheek plate, hinged at the temple, leaving the face open */}
      <path d="M110.2 69.6 C113 72.4 114.8 77.2 114.8 82 C113.6 85.6 110.4 87.2 107.2 86.4 C105.6 83 105.2 78.4 106 74 Z" fill={url("steel")} strokeWidth="1.6" />
      <path d="M112.2 76 C112.6 79 112.4 81.8 111.2 84" fill="none" stroke={M[0]} strokeWidth="0.9" opacity="0.8" />
      <circle cx="109.6" cy="73.6" r="1" fill={P.gold[3]} strokeWidth="0.5" />
      {/* gold brow band along the open edge, and the nape flare */}
      <path d="M129.8 63.2 C127.6 62.6 124.6 62.4 121.4 62.8 C116.4 63.6 111.6 66.6 109.6 71.4" fill="none" stroke={INK} strokeWidth="3.6" />
      <path d="M129.8 63.2 C127.6 62.6 124.6 62.4 121.4 62.8 C116.4 63.6 111.6 66.6 109.6 71.4" fill="none" stroke={url("gold")} strokeWidth="2" />
      <path d="M97.6 72 C98.6 77 100 80.6 101.6 82.6 L107.8 84.4" fill="none" stroke={P.gold[2]} strokeWidth="1.5" />
      <circle cx="104" cy="58" r="0.9" fill={M[4]} strokeWidth="0.5" />
      <circle cx="100.6" cy="68" r="0.9" fill={M[4]} strokeWidth="0.5" />
    </g>
  );
}

/** The player's arms on the heater shield: a field (plain, per pale, per bend or with a chief) and the emblem. */
function ShieldArms({ look, field, charge }: { look: NonNullable<FigureProps["look"]>; field: Ramp; charge: string }) {
  const clip = useId().replace(/[^a-zA-Z0-9_-]/g, "") + "-shield";
  const s = emblemSpec(look.emblem);
  return (
    <g>
      <clipPath id={clip}>
        <path d="M125 120 C138 115 153 115 163 121 C164 151 159 183 141 211 C129 190 123 158 125 120 Z" />
      </clipPath>
      <g clipPath={`url(#${clip})`} stroke="none">
        {s.field === "pale" && <path d="M143.5 100 L175 100 L175 230 L142 230 Z" fill={field[1]} opacity="0.85" />}
        {s.field === "bend" && <path d="M118 112 L175 200 L175 230 L110 230 L110 112 Z" fill={field[1]} opacity="0.85" />}
        {s.field === "chief" && (
          <g>
            <path d="M110 100 L175 100 L175 133 C160 131 140 131 110 134 Z" fill={field[0]} opacity="0.85" />
            <path d="M118 133.6 C138 131.2 156 131 170 132.8" fill="none" stroke={P.gold[3]} strokeWidth="1.6" />
          </g>
        )}
      </g>
      <Emblem seed={look.emblem} x={143.5} y={s.field === "chief" ? 159 : 153} size={s.field === "chief" ? 23 : 27} fill={charge} dark={field[0]} />
    </g>
  );
}

/** The portrait crop for a bare or open head, which sits lower than the helm or hood. */
const BARE_CROP = [86, 56, 46, 46];

export const meta: FigureMeta ={ id: "warden", viewBox: [0, 0, 200, 280], feet: { x: 100, y: 268 }, head: [84, 52, 46, 46], facing: "right" };

/**
 * The Warden: a knight in steel plate and an oxblood tabard bearing a gold tower,
 * great helm with a visor slit and an oxblood plume, a heater shield held forward and a longsword.
 * Strike: lunges in with a downward chop, the blade leaving a bright arc.
 */
export default function Warden({ viewBox, className, pose = "idle", look }: FigureProps) {
  const u = useId().replace(/:/g, "");
  const id = (s: string) => `${u}-${s}`;
  const url = (s: string) => `url(#${id(s)})`;
  const strike = pose === "strike";
  const lean = strike ? "matrix(1 0 -0.06 1 16 0)" : undefined;
  // Sword in hand-local coordinates: grip at 0,0, blade along -y.
  const sw = strike ? { x: 108, y: 44, a: 126 } : { x: 80, y: 154, a: -16 };
  const C = heroColors(look, DRAWN);
  const M = C.metal, PR = C.primary, AC = C.accent, SE = C.secondary;
  // Headwear: 0 the great helm with its plume, 1 an open-faced helm, 2 bare-headed.
  const head = look?.head ?? 0;
  // Build widens the body about the feet; the head is narrowed back so the face keeps its proportions.
  const body = widen(look?.build, meta.feet.x);
  const unwiden = widen(look ? 1 / look.build : undefined, 110);
  const charge = look ? emblemFill(look, C, PR[2]) : undefined;

  return (
    <svg viewBox={cropFor(viewBox, meta.head, look && head !== 0 ? BARE_CROP : undefined) ?? meta.viewBox.join(" ")} className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id("steel")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={M[4]} />
          <stop offset="0.35" stopColor={M[3]} />
          <stop offset="0.75" stopColor={M[2]} />
          <stop offset="1" stopColor={M[1]} />
        </linearGradient>
        <linearGradient id={id("steelDark")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={M[3]} />
          <stop offset="0.6" stopColor={M[2]} />
          <stop offset="1" stopColor={M[0]} />
        </linearGradient>
        <linearGradient id={id("helm")} x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0" stopColor={M[4]} />
          <stop offset="0.45" stopColor={M[3]} />
          <stop offset="1" stopColor={M[1]} />
        </linearGradient>
        <linearGradient id={id("tabard")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={PR[3]} />
          <stop offset="0.4" stopColor={PR[2]} />
          <stop offset="1" stopColor={PR[0]} />
        </linearGradient>
        <linearGradient id={id("shield")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={PR[3]} />
          <stop offset="0.45" stopColor={PR[2]} />
          <stop offset="1" stopColor={PR[0]} />
        </linearGradient>
        <linearGradient id={id("plume")} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={AC[3]} />
          <stop offset="1" stopColor={AC[1]} />
        </linearGradient>
        <linearGradient id={id("gold")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.gold[4]} />
          <stop offset="0.5" stopColor={P.gold[3]} />
          <stop offset="1" stopColor={P.gold[1]} />
        </linearGradient>
        <linearGradient id={id("blade")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={P.steel[4]} />
          <stop offset="0.5" stopColor="#ffffff" />
          <stop offset="0.55" stopColor={P.steel[3]} />
          <stop offset="1" stopColor={P.steel[2]} />
        </linearGradient>
        <radialGradient id={id("boss")} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={P.gold[4]} />
          <stop offset="0.6" stopColor={P.gold[2]} />
          <stop offset="1" stopColor={P.gold[0]} />
        </radialGradient>
      </defs>

      {/* ground shadow */}
      <ellipse cx="102" cy="267" rx="66" ry="7.5" fill={INK} opacity="0.32" filter="url(#wc-wash)" />

      <g filter="url(#fig)" stroke={INK} strokeLinejoin="round" strokeLinecap="round">
        <g transform={body}>
        <g transform={lean}>
          {head === 0 && (
          <g transform={unwiden}>
          <g transform="translate(108 99) scale(0.76) translate(-108 -99)">
{/* ── plume, streaming back from the crest ── */}
          <path
            d={strike ? "M104 52 C96 38 80 32 62 38 C50 42 42 52 36 64 C44 60 50 60 54 62 C50 68 48 74 50 80 C58 70 66 64 76 62 C84 60 94 58 104 58 Z" : "M104 52 C98 38 84 32 70 36 C60 40 56 50 54 64 C60 58 64 57 68 58 C64 66 64 72 66 80 C72 70 78 64 86 61 C92 59 98 58 104 58 Z"}
            fill={url("plume")}
            strokeWidth="2.3"
          />
          <path d={strike ? "M98 48 C86 42 70 44 58 52 M96 54 C82 54 70 60 60 70" : "M98 47 C88 42 76 44 66 52 M96 54 C86 56 76 62 70 70"} fill="none" stroke={AC[0]} strokeWidth="1.1" opacity="0.8" />
          <path d={strike ? "M96 42 C84 36 72 38 64 42" : "M96 42 C88 37 78 38 72 42"} fill="none" stroke={AC[4]} strokeWidth="1.2" opacity="0.8" />
          </g>
          </g>
          )}

          {/* ── far (back) leg ── */}
          <Leg hip={strike ? [92, 168] : [90, 166]} knee={strike ? [76, 210] : [85, 210]} ankle={strike ? [62, 254] : [81, 254]} fill={url("steelDark")} far M={M} />

          {/* ── chainmail skirt ── */}
          <path d={strike ? "M80 160 L128 158 C132 176 136 192 138 204 C120 210 96 212 76 206 C76 190 78 174 80 160 Z" : "M80 160 L124 158 C126 176 128 192 128 206 C112 210 92 212 76 206 C76 190 78 174 80 160 Z"} fill={M[2]} strokeWidth="2" />
          <path d={strike ? "M80 196 C98 200 118 200 136 196 M79 188 C98 192 118 192 134 188" : "M79 196 C96 200 112 200 127 196 M79 188 C96 192 112 192 126 188"} fill="none" stroke={M[0]} strokeWidth="1" strokeDasharray="1.6 1.8" opacity="0.9" />
          <path d={strike ? "M78 204 C98 208 118 208 137 203" : "M77 204 C94 208 112 208 127 204"} fill="none" stroke={M[4]} strokeWidth="0.9" strokeDasharray="1.6 1.8" opacity="0.8" />

          {/* ── near (front) leg ── */}
          <Leg hip={strike ? [120, 168] : [114, 166]} knee={strike ? [146, 206] : [126, 210]} ankle={strike ? [152, 254] : [131, 254]} fill={url("steel")} M={M} />

          {/* ── far arm (behind the body in idle) ── */}
          {!strike && (
            <g>
              <path d="M80 110 C72 118 70 130 72 142 C74 150 78 154 84 154 C88 148 88 138 88 128 Z" fill={url("steelDark")} strokeWidth="2.1" />
              <path d="M72 134 C74 130 80 130 84 134" fill="none" stroke={M[0]} strokeWidth="1.1" />
            </g>
          )}

          {/* ── tabard over the breastplate ── */}
          <path d={strike ? "M80 108 L126 106 C130 126 132 146 132 160 C135 172 138 186 141 198 L118 202 L112 190 L104 202 L77 200 C78 184 80 170 80 150 C78 136 78 120 80 108 Z" : "M80 108 L124 106 C127 126 128 146 128 160 C129 174 130 186 131 200 L114 202 L108 190 L102 202 L77 200 C78 184 80 170 80 150 C78 136 78 120 80 108 Z"} fill={url("tabard")} strokeWidth="2.4" />
          <path d={strike ? "M112 110 C118 140 124 170 130 198 L141 198 C138 186 134 170 132 150 C132 136 130 120 126 108 Z" : "M110 110 C116 140 120 170 122 200 L131 200 C131 190 130 176 128 158 C128 140 127 124 124 108 Z"} fill={PR[0]} stroke="none" opacity="0.45" />
          <path d="M90 164 C88 176 87 188 86 198 M100 166 C100 176 101 186 102 198" fill="none" stroke={PR[0]} strokeWidth="1.2" opacity="0.8" />
          <path d="M84 112 C82 130 82 146 84 158" fill="none" stroke={PR[4]} strokeWidth="1.3" opacity="0.7" />
          {/* gold hem on the tabard */}
          <path d={strike ? "M77 200 L104 202 L112 190 L118 202 L141 198" : "M77 200 L102 202 L108 190 L114 202 L131 200"} fill="none" stroke={SE[3]} strokeWidth="2.2" />
          {/* the emblem: the player's own arms, or the gold tower */}
          {look ? (
            <g transform={strike ? "translate(3 0)" : undefined}>
              <Emblem seed={look.emblem} x={101.5} y={132} size={22} fill={charge!} dark={PR[0]} />
            </g>
          ) : (
          <g transform={strike ? "translate(3 0)" : undefined}>
            <path d="M94 122 L94 118 L97 118 L97 121 L100 121 L100 118 L103 118 L103 121 L106 121 L106 118 L109 118 L109 122 L107 124 L108 142 L95 142 L96 124 Z" fill={url("gold")} strokeWidth="1.3" />
            <path d="M100 142 L100 136 C100 133 104 133 104 136 L104 142 Z" fill={PR[0]} strokeWidth="0.9" />
            <path d="M98 128 L99 128 M104 128 L105 128" stroke={PR[0]} strokeWidth="1.6" />
            <path d="M92 145 L111 145" stroke={P.gold[3]} strokeWidth="1.8" />
          </g>
          )}
          {/* sword belt */}
          <path d={strike ? "M79 156 C96 161 114 160 132 154 L133 162 C114 168 96 169 79 164 Z" : "M79 156 C94 161 110 160 128 155 L129 163 C110 168 94 169 79 164 Z"} fill={P.leather[1]} strokeWidth="1.8" />
          <path d={strike ? "M110 158 L118 157 L118 165 L110 166 Z" : "M106 158 L114 157 L114 165 L106 166 Z"} fill="none" stroke={P.gold[3]} strokeWidth="1.8" />

          {/* a bare or open-helmed head's neck, under the gorget */}
          {look && head !== 0 && (
            <g transform={unwiden}>
              <HeroHead c={C} hairStyle={look.hairStyle} layer="back" transform={HEAD_AT} />
            </g>
          )}

          {/* ── gorget and far pauldron ── */}
          <path d="M92 94 L122 93 L125 106 L90 108 Z" fill={url("steelDark")} strokeWidth="2" />
          <path d="M91 101 L124 100" stroke={M[0]} strokeWidth="1" />
          <path d="M92 104 C84 100 76 104 73 114 C72 122 74 128 78 130 C84 126 90 120 94 114 Z" fill={url("steelDark")} strokeWidth="2.1" />
          <path d="M75 118 C80 116 86 114 92 110" fill="none" stroke={M[0]} strokeWidth="1" />

          {/* ── far arm raised for the chop (behind the helm) ── */}
          {strike && (
            <g>
              <path d={seg(86, 110, 80, 76, 15, 12, 2, 1)} fill={url("steelDark")} strokeWidth="2.1" />
              <path d={seg(80, 76, 106, 48, 12, 10, 1, 1)} fill={url("steel")} strokeWidth="2.1" />
              <circle cx="80" cy="76" r="6.5" fill={M[3]} strokeWidth="1.6" />
              <path d="M78 110 C80 100 90 96 98 102 C100 110 96 116 88 118 Z" fill={url("steelDark")} strokeWidth="2" />
            </g>
          )}

          {look && head !== 0 ? (
            <g transform={unwiden}>
              <HeroHead c={C} hairStyle={look.hairStyle} layer="front" transform={HEAD_AT} />
              {head === 1 && <OpenHelm M={M} plume={AC} hair={C.hair} shaved={look.hairStyle === 3} transform={HEAD_AT} url={url} />}
            </g>
          ) : (
          <g transform={unwiden}>
          <g transform="translate(108 99) scale(0.76) translate(-108 -99)">
{/* ── great helm ── */}
          <path d="M91 60 C94 50 110 47 121 51 C128 54 131 62 131 70 L131 88 C126 96 110 99 95 97 C90 88 89 72 91 60 Z" fill={url("helm")} strokeWidth="2.6" />
          <path d="M120 52 C127 56 129 62 129 70 L129 88 C126 92 122 95 116 96 L118 58 Z" fill={M[0]} stroke="none" opacity="0.4" />
          <path d="M95 62 C94 72 94 84 96 94" fill="none" stroke="#fff4dc" strokeWidth="1.4" opacity="0.75" />
          {/* brow band and front ridge in gold */}
          <path d="M91 64 C104 62 118 62 131 66" fill="none" stroke={INK} strokeWidth="4.4" />
          <path d="M91 64 C104 62 118 62 131 66" fill="none" stroke={url("gold")} strokeWidth="2.6" />
          <path d="M124 53 C126 66 126 82 124 96" fill="none" stroke={INK} strokeWidth="4" />
          <path d="M124 53 C126 66 126 82 124 96" fill="none" stroke={P.gold[3]} strokeWidth="2.2" />
          {/* visor slit with a warm glint inside */}
          <path d="M108 72 L131 71 L131 75 L108 76 Z" fill="#120e14" strokeWidth="1.2" />
          <ellipse cx="127" cy="73.4" rx="2" ry="1" fill={look ? C.glow[3] : GLOW.ember} stroke="none" filter="url(#glow)" />
          {/* breaths */}
          <path d="M116 82 L117 88 M120 82 L121 88 M129 81 L129 87" stroke={INK} strokeWidth="1.5" />
          {/* rivets */}
          <circle cx="98" cy="70" r="1.1" fill={M[4]} strokeWidth="0.6" />
          <circle cx="98" cy="88" r="1.1" fill={M[4]} strokeWidth="0.6" />
          <path d="M96 50 L112 49" fill="none" stroke={M[4]} strokeWidth="1" opacity="0.7" />
          {/* crest socket */}
          <path d="M101 52 L108 50 L108 46 L101 47 Z" fill={P.gold[2]} strokeWidth="1.3" />
          </g>
          </g>
          )}
          {/* ── sword and sword hand ── */}
          <g transform={`translate(${sw.x} ${sw.y}) rotate(${sw.a})`}>
            {/* blade */}
            <path d="M-3.4 -8 L-3.2 -80 L0 -90 L3.2 -80 L3.4 -8 Z" fill={url("blade")} strokeWidth="1.9" />
            <path d="M0 -10 L0 -80" stroke={P.steel[2]} strokeWidth="0.9" />
            {/* crossguard, grip, pommel */}
            <path d="M-12 -8 C-8 -10 8 -10 12 -8 L12 -5 C8 -6 -8 -6 -12 -5 Z" fill={url("gold")} strokeWidth="1.5" />
            <path d="M-2.2 -5 L2.2 -5 L2.2 12 L-2.2 12 Z" fill={P.leather[1]} strokeWidth="1.3" />
            <circle cx="0" cy="15" r="3.4" fill={url("boss")} strokeWidth="1.4" />
          </g>
          {/* sword hand gauntlet */}
          <path d={`M${sw.x - 5} ${sw.y - 4} C${sw.x - 3} ${sw.y - 8} ${sw.x + 5} ${sw.y - 8} ${sw.x + 6} ${sw.y - 2} C${sw.x + 7} ${sw.y + 4} ${sw.x + 2} ${sw.y + 7} ${sw.x - 3} ${sw.y + 5} C${sw.x - 6} ${sw.y + 3} ${sw.x - 7} ${sw.y} ${sw.x - 5} ${sw.y - 4} Z`} fill={url("steel")} strokeWidth="1.7" />
          <path d={`M${sw.x - 3} ${sw.y - 1} L${sw.x + 4} ${sw.y - 2} M${sw.x - 3} ${sw.y + 2} L${sw.x + 4} ${sw.y + 1}`} stroke={M[0]} strokeWidth="0.9" />

        </g>

        {/* ── near arm (shield arm) and pauldron ── */}
        <g>
          <path d="M112 112 C122 116 130 126 134 138 L144 146 L138 154 C128 150 120 140 114 130 Z" fill={url("steel")} strokeWidth="2.1" />
          <path d="M104 104 C112 95 130 96 136 108 C139 116 137 123 132 127 C122 125 110 122 104 117 Z" fill={url("steel")} strokeWidth="2.3" />
          <path d="M106 118 C116 124 126 127 133 128 L131 134 C122 132 112 129 105 124 Z" fill={url("steelDark")} strokeWidth="1.7" />
          <path d="M108 104 C114 99 124 99 130 104" fill="none" stroke="#fff4dc" strokeWidth="1.3" opacity="0.8" />
          <path d="M104 110 C114 116 126 119 136 118" fill="none" stroke={P.gold[3]} strokeWidth="1.8" />
          <circle cx="112" cy="110" r="1.2" fill={P.gold[4]} stroke="none" />
          <circle cx="128" cy="113" r="1.2" fill={P.gold[4]} stroke="none" />
        </g>

        {/* ── heater shield held forward ── */}
        <g transform={strike ? "translate(2 20) rotate(-8 142 164)" : undefined}>
          {/* rim thickness on the far edge */}
          <path d="M122 118 C120 120 118 124 118 130 C117 160 124 190 138 216 L141 214 C128 190 121 158 122 118 Z" fill={P.gold[1]} strokeWidth="1.8" />
          <path d="M122 117 C136 111 154 111 166 118 C168 150 162 186 141 216 C127 192 120 158 122 117 Z" fill={url("shield")} strokeWidth="2.7" />
          {/* shadow wash on the lower right */}
          <path d="M146 130 C152 128 160 126 164 124 C164 156 158 186 141 214 C146 190 148 160 146 130 Z" fill={PR[0]} stroke="none" opacity="0.45" />
          {/* gold rim */}
          <path d="M125 120 C138 115 153 115 163 121 C164 151 159 183 141 211 C129 190 123 158 125 120 Z" fill="none" stroke={INK} strokeWidth="3.8" />
          <path d="M125 120 C138 115 153 115 163 121 C164 151 159 183 141 211 C129 190 123 158 125 120 Z" fill="none" stroke={url("gold")} strokeWidth="2.2" />
          {look ? (
            <ShieldArms look={look} field={PR} charge={charge!} />
          ) : (
            <g>
              {/* gold bands to the boss */}
              <path d="M144 118 L143 150 M143 150 L141 206 M126 150 L162 150" fill="none" stroke={P.gold[2]} strokeWidth="1.8" opacity="0.9" />
              <circle cx="143" cy="150" r="8.5" fill={url("boss")} strokeWidth="2" />
              <circle cx="143" cy="150" r="4.2" fill="none" stroke={P.gold[0]} strokeWidth="1" />
              <circle cx="141" cy="147.5" r="1.6" fill="#fff6d8" stroke="none" />
            </g>
          )}
          {/* rivets on the rim */}
          <circle cx="132" cy="119" r="1" fill={P.gold[4]} stroke="none" />
          <circle cx="156" cy="119" r="1" fill={P.gold[4]} stroke="none" />
          <circle cx="129" cy="178" r="1" fill={P.gold[4]} stroke="none" />
          <circle cx="156" cy="180" r="1" fill={P.gold[4]} stroke="none" />
          {/* warm highlight on the lit upper edge and a scuff */}
          <path d="M127 124 C136 119 148 118 158 121" fill="none" stroke={PR[4]} strokeWidth="1.3" opacity="0.8" />
          <path d="M132 170 L138 176 M150 132 L156 136" stroke={PR[0]} strokeWidth="1" opacity="0.8" />
        </g>
        </g>
      </g>

      <g transform={body}>
      {/* swing arc of the chop, unfiltered so it stays crisp */}
      {strike && (
        <g fill="none" strokeLinecap="round">
          <path d="M58 34 C84 6 150 2 180 42 C192 60 197 84 195 108" stroke={P.gold[4]} strokeWidth="6" opacity="0.35" filter="url(#glow-soft)" />
          <path d="M66 26 C94 4 152 6 178 40 C190 56 195 78 195 100" stroke="#fff6d8" strokeWidth="2.2" opacity="0.85" filter="url(#glow)" />
          <path d="M84 20 C110 10 150 14 172 42 C182 56 188 72 190 90" stroke={P.gold[4]} strokeWidth="1.2" opacity="0.7" />
        </g>
      )}
      </g>
    </svg>
  );
}
