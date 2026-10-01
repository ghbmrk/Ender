import { useId } from "react";
import { INK, P, GLOW } from "../palette";
import type { FigureMeta, FigureProps } from "../types";
import { Emblem, HeroHead, heroColors, onField, emblemSpec, widen, type HeroColors } from "../hero";

/** The Ranger as drawn: verdigris cloak, rust scarf, auburn hair, oxblood-and-gold fletching. */
const DRAWN: HeroColors = { skin: P.skin, hair: P.ember, primary: P.verdigris, secondary: P.ember, accent: P.oxblood, glow: P.spirit, metal: P.steel };

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

/** A leg in dark breeches and a tall turned-down boot. */
function Leg({ hip, knee, ankle, cloth, far }: { hip: Pt; knee: Pt; ankle: Pt; cloth: string; far?: boolean }) {
  const [kx, ky] = knee;
  const [ax, ay] = ankle;
  const cx = kx + (ax - kx) * 0.22, cy = ky + (ay - ky) * 0.22;
  return (
    <g>
      <path d={seg(hip[0], hip[1], kx, ky, 17, 11, 1.5, 1)} fill={cloth} strokeWidth="2.2" />
      <path d={seg(kx, ky, ax, ay, 11, 8, 0.5, 3)} fill={far ? P.leather[0] : P.leather[1]} strokeWidth="2.2" />
      {/* turned-down cuff */}
      <path d={seg(cx - (ax - kx) * 0.04, cy - 3.5, cx + (ax - kx) * 0.04, cy + 3.5, 13.5, 12.5, 0.5, 1.2)} fill={far ? P.leather[1] : P.leather[2]} strokeWidth="1.8" />
      {!far && <path d={`M${kx + (ax - kx) * 0.4 - 2} ${ky + (ay - ky) * 0.4} L${kx + (ax - kx) * 0.95 - 2} ${ky + (ay - ky) * 0.95}`} fill="none" stroke={P.leather[3]} strokeWidth="1.1" opacity="0.8" />}
      {/* foot */}
      <path d={`M${ax - 6} ${ay - 2} C${ax} ${ay - 3} ${ax + 8} ${ay + 1} ${ax + 13} ${ay + 5} C${ax + 18} ${ay + 8} ${ax + 20} ${ay + 12} ${ax + 16} ${ay + 13} L${ax - 7} ${ay + 13} C${ax - 8} ${ay + 8} ${ax - 8} ${ay + 3} ${ax - 6} ${ay - 2} Z`} fill={far ? P.leather[0] : P.leather[1]} strokeWidth="2" />
      <path d={`M${ax - 7} ${ay + 11} L${ax + 17} ${ay + 11}`} stroke={P.leather[0]} strokeWidth="1.2" />
      <path d={`M${ax - 5} ${ay - 22} L${ax + 5} ${ay - 23} M${ax - 5} ${ay - 12} L${ax + 5} ${ay - 13}`} stroke={P.leather[0]} strokeWidth="1.2" opacity="0.9" />
    </g>
  );
}

export const meta: FigureMeta = { id: "ranger", viewBox: [0, 0, 200, 280], feet: { x: 100, y: 268 }, head: [96, 46, 44, 44], facing: "right" };

/**
 * The Ranger: a hooded archer in a verdigris cloak over a leather jerkin, with bracers, a rust scarf,
 * a quiver of fletched arrows and a longbow. Face visible in three-quarter profile, a strand of auburn hair.
 * Idle: bow held low, arrow nocked. Strike: the release, string snapping, arrow in flight.
 */
export default function Ranger({ viewBox, className, pose = "idle", look }: FigureProps) {
  const u = useId().replace(/:/g, "");
  const id = (s: string) => `${u}-${s}`;
  const url = (s: string) => `url(#${id(s)})`;
  const strike = pose === "strike";

  // Bow in nock-local coordinates: string on x=0, tips at y=±68, grip at (16, 0), arrows fly along +x.
  const bow = strike ? { x: 144, y: 92, a: 0 } : { x: 119, y: 147, a: 35 };
  const bowT = `translate(${bow.x} ${bow.y}) rotate(${bow.a})`;
  const bowHand: Pt = strike ? [160, 92] : [132, 156];
  const stringHand: Pt = strike ? [80, 78] : [119, 147];

  const C = heroColors(look, DRAWN);
  const PR = C.primary, SE = C.secondary, AC = C.accent, SK = C.skin, HR = C.hair;
  // fletching: the accent on two of the quiver's arrows and the nocked one
  const FL = look ? ["", AC[3], "", AC[2]] : ["", P.oxblood[3], "", P.gold[3]];
  const GRIP = look ? SE : P.oxblood;
  // Headwear: 0 the hood, 1 the hood thrown back, 2 bare-headed.
  const head = look?.head ?? 0;
  const shaved = look?.hairStyle === 3;
  const body = widen(look?.build, meta.feet.x);
  const unwiden = widen(look ? 1 / look.build : undefined, 114);
  const headTurn = strike ? "rotate(-3 112 90)" : undefined;

  return (
    <svg viewBox={viewBox ?? meta.viewBox.join(" ")} className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id("cloak")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={PR[3]} />
          <stop offset="0.4" stopColor={PR[2]} />
          <stop offset="1" stopColor={PR[0]} />
        </linearGradient>
        <linearGradient id={id("cloakBack")} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={PR[2]} />
          <stop offset="0.5" stopColor={PR[1]} />
          <stop offset="1" stopColor={PR[0]} />
        </linearGradient>
        <linearGradient id={id("jerkin")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.leather[4]} />
          <stop offset="0.45" stopColor={P.leather[3]} />
          <stop offset="1" stopColor={P.leather[1]} />
        </linearGradient>
        <linearGradient id={id("cloth")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={P.slate[3]} />
          <stop offset="1" stopColor={P.slate[1]} />
        </linearGradient>
        <linearGradient id={id("sleeve")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={PR[2]} />
          <stop offset="1" stopColor={PR[0]} />
        </linearGradient>
        <radialGradient id={id("face")} cx="0.7" cy="0.35" r="0.85">
          <stop offset="0" stopColor={SK[4]} />
          <stop offset="0.45" stopColor={SK[3]} />
          <stop offset="1" stopColor={SK[1]} />
        </radialGradient>
        <radialGradient id={id("hand")} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={SK[3]} />
          <stop offset="1" stopColor={SK[1]} />
        </radialGradient>
        <linearGradient id={id("scarf")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={SE[3]} />
          <stop offset="0.5" stopColor={SE[2]} />
          <stop offset="1" stopColor={SE[1]} />
        </linearGradient>
      </defs>

      {/* ground shadow */}
      <ellipse cx="102" cy="267" rx="58" ry="7" fill={INK} opacity="0.3" filter="url(#wc-wash)" />

      <g filter="url(#fig)" stroke={INK} strokeLinejoin="round" strokeLinecap="round">
        <g transform={body}>
        {/* ── quiver on the back, fletchings over the far shoulder ── */}
        <g transform={strike ? "rotate(-6 100 150)" : undefined}>
          <path d="M72 70 L78 88 M79 66 L83 86 M86 68 L88 86 M92 72 L91 88" stroke={P.leather[3]} strokeWidth="1.5" />
          <path d="M72 70 C68 64 68 58 70 54 C74 58 76 64 76 70 Z" fill={P.bone[4]} strokeWidth="1.2" />
          <path d="M79 66 C76 60 77 54 80 50 C83 55 83 61 82 66 Z" fill={FL[1]} strokeWidth="1.2" />
          <path d="M86 68 C84 62 86 56 89 53 C91 58 90 64 89 68 Z" fill={P.bone[4]} strokeWidth="1.2" />
          <path d="M92 72 C92 66 94 61 98 58 C98 64 96 69 94 72 Z" fill={FL[3]} strokeWidth="1.2" />
          <path d={seg(104, 152, 81, 86, 12, 16, 0.5, 0.5)} fill={P.leather[1]} strokeWidth="2.2" />
          <path d={seg(84, 94, 80, 83, 18, 18, 0, 0)} fill={P.leather[2]} strokeWidth="1.8" />
          <path d="M92 108 L99 128 M96 132 L102 148" stroke={P.leather[3]} strokeWidth="1" opacity="0.8" />
          <path d="M88 118 L96 114 M94 136 L101 133" stroke={P.gold[2]} strokeWidth="1.6" />
        </g>

        {/* ── cloak, hanging behind ── */}
        <path
          d={strike ? "M92 100 C78 116 64 144 52 172 C44 190 36 204 28 216 L40 214 L46 224 L56 214 L64 224 L72 212 L84 218 L100 168 Z" : "M92 100 C80 120 72 150 66 180 C62 200 60 214 58 226 L68 220 L74 230 L82 220 L90 228 L96 218 L102 170 Z"}
          fill={url("cloakBack")}
          strokeWidth="2.4"
        />
        <path d={strike ? "M76 124 C66 148 56 172 44 196 M88 138 C80 162 72 184 62 206" : "M80 124 C74 152 70 180 66 208 M90 138 C86 164 84 190 82 214"} fill="none" stroke={PR[0]} strokeWidth="1.2" opacity="0.75" />
        <path d={strike ? "M86 108 C74 124 64 146 56 164" : "M86 108 C78 126 74 146 70 166"} fill="none" stroke={PR[4]} strokeWidth="1.3" opacity="0.7" />

        {/* ── far arm ── */}
        {strike ? (
          <g>
            <path d={seg(96, 106, 68, 98, 12, 10, 1, 1)} fill={url("sleeve")} strokeWidth="2.1" />
            <path d={seg(68, 98, 78, 80, 10, 8, 0.5, 0.5)} fill={P.leather[1]} strokeWidth="2" />
            {/* open hand, just released */}
            <path d="M76 82 C74 76 76 72 80 71 L82 64 C82 62 85 62 85 64 L85 70 L88 65 C89 63 92 64 91 66 L88 72 L92 70 C94 69 95 72 93 73 L88 77 C88 81 84 84 80 84 Z" fill={url("hand")} strokeWidth="1.4" />
          </g>
        ) : (
          <path d={seg(96, 108, 98, 132, 12, 10, 1, 1)} fill={PR[1]} strokeWidth="2.1" />
        )}

        {/* ── legs ── */}
        <Leg hip={strike ? [96, 162] : [96, 160]} knee={strike ? [80, 208] : [90, 208]} ankle={strike ? [70, 254] : [85, 254]} cloth={P.slate[2]} far />
        <Leg hip={strike ? [114, 160] : [112, 160]} knee={strike ? [134, 204] : [122, 208]} ankle={strike ? [138, 254] : [126, 254]} cloth={url("cloth")} />

        {/* ── jerkin with tassets, belt and lacing ── */}
        <path d="M93 158 L124 156 C126 166 128 174 129 184 L117 186 L111 177 L105 186 L91 184 C91 175 92 166 93 158 Z" fill={url("jerkin")} strokeWidth="2.1" />
        <path d="M111 177 L111 158" stroke={P.leather[1]} strokeWidth="1.1" />
        <path d="M94 104 L122 102 C127 116 127 132 123 146 L124 160 L93 162 C91 144 89 124 94 104 Z" fill={url("jerkin")} strokeWidth="2.3" />
        <path d="M114 104 C120 118 121 134 118 148 L124 160 C127 146 127 116 122 102 Z" fill={P.leather[0]} stroke="none" opacity="0.45" />
        <path d="M96 110 C95 124 95 138 96 150" fill="none" stroke={P.leather[4]} strokeWidth="1.3" opacity="0.8" />
        {/* lacing */}
        <path d="M116 110 L120 114 M120 110 L116 114 M116 118 L120 122 M120 118 L116 122 M116 126 L120 130 M120 126 L116 130" stroke={P.bone[3]} strokeWidth="0.9" />
        <path d="M118 106 L118 146" stroke={P.leather[0]} strokeWidth="1" />
        {/* quiver strap across the chest */}
        <path d="M94 110 L121 142 L119 150 L92 118 Z" fill={P.leather[1]} strokeWidth="1.5" />
        <circle cx="108" cy="130" r="2" fill={P.gold[3]} strokeWidth="1" />
        {/* belt, pouch and knife */}
        <path d="M92 152 C104 155 116 154 125 150 L126 158 C116 162 104 163 92 160 Z" fill={P.leather[0]} strokeWidth="1.7" />
        <path d="M108 153 L114 152 L114 159 L108 160 Z" fill="none" stroke={P.gold[3]} strokeWidth="1.5" />
        <path d="M94 160 L104 160 L104 172 C100 174 96 174 94 172 Z" fill={P.leather[2]} strokeWidth="1.5" />
        <path d="M94 164 L104 164" stroke={P.leather[0]} strokeWidth="1" />
        <path d="M120 157 L126 176 L129 175 L124 156 Z" fill={P.leather[1]} strokeWidth="1.3" />
        <path d="M119 154 L124 152" stroke={P.gold[3]} strokeWidth="2" />

        {/* the hood thrown back: a heavy fold of cloth behind the neck */}
        {look && head === 1 && (
          <g transform={headTurn}>
            <path d="M110 82 C102 75 88 74 79 81 C72 87 71 97 74 105 C84 111 100 111 113 106 C115 97 114 88 110 82 Z" fill={url("cloak")} strokeWidth="2.3" />
            {/* the hood's open mouth, its lining in shadow */}
            <path d="M108 83 C100 78 89 78 82 84 C80 87 80 90 81 92 C89 88 99 88 109 92 Z" fill={PR[0]} strokeWidth="1.4" />
            <path d="M78 96 C86 102 98 104 110 101 M76 89 C78 95 84 99 92 101" fill="none" stroke={PR[0]} strokeWidth="1.1" opacity="0.8" />
            <path d="M80 82 C86 77 95 76 103 78" fill="none" stroke={PR[4]} strokeWidth="1.3" opacity="0.85" />
          </g>
        )}
        {look && head !== 0 && (
          <g transform={headTurn}>
            <g transform={unwiden}>
              <HeroHead c={C} hairStyle={look.hairStyle} layer="back" />
            </g>
          </g>
        )}

        {/* ── cloak drape over the near shoulder, clasp ── */}
        <path d="M98 100 C110 96 124 98 130 108 C132 118 128 126 124 132 C120 122 112 114 100 112 Z" fill={url("cloak")} strokeWidth="2.2" />
        <path d="M112 106 C120 110 126 118 126 128" fill="none" stroke={PR[0]} strokeWidth="1.1" opacity="0.8" />
        <path d="M102 102 C110 99 120 100 126 104" fill="none" stroke={PR[4]} strokeWidth="1.2" opacity="0.8" />

        {/* ── scarf ── */}
        <path d={strike ? "M104 100 C92 104 80 104 66 110 C72 112 74 116 74 120 C84 112 94 110 104 108 Z" : "M104 100 C96 106 90 112 84 122 C90 122 92 126 92 130 C96 120 100 114 106 108 Z"} fill={url("scarf")} strokeWidth="1.8" />
        <path d="M100 92 C110 97 122 97 129 92 C131 98 129 104 123 108 C114 110 104 108 98 104 Z" fill={url("scarf")} strokeWidth="2" />
        <path d="M102 100 C110 103 118 103 126 100" fill="none" stroke={SE[1]} strokeWidth="1.1" opacity="0.9" />
        <path d="M104 95 C110 98 118 98 124 96" fill="none" stroke={SE[4]} strokeWidth="1" opacity="0.8" />

        {/* the cloak clasp, bearing the player's emblem */}
        {look && (
          <g>
            <circle cx="101" cy="107" r="7.4" fill={P.gold[2]} strokeWidth="1.6" />
            <circle cx="101" cy="107" r="5.6" fill={PR[1]} strokeWidth="0.9" />
            <Emblem seed={look.emblem} x={101} y={107} size={8.6} fill={onField(PR[1], emblemSpec(look.emblem).tincture === "secondary" ? SE : AC)} dark={PR[0]} />
            <path d="M96.6 102.6 C98.6 101 101.6 100.6 104 101.4" fill="none" stroke={P.gold[4]} strokeWidth="0.9" opacity="0.9" />
          </g>
        )}

        {/* ── head: bare or the hood thrown back ── */}
        {look && head !== 0 ? (
          <g transform={headTurn}>
            <g transform={unwiden}>
              <HeroHead c={C} hairStyle={look.hairStyle} layer="front" />
            </g>
          </g>
        ) : (
        /* ── head: hood, face in three-quarter profile, auburn hair ── */
        <g transform={headTurn}><g transform={unwiden}>
          <path d="M111 48 C97 46 87 54 85 67 C83 78 81 87 76 95 C85 97 92 101 99 104 L118 101 C124 94 128 82 128 70 C128 58 122 50 111 48 Z" fill={url("cloak")} strokeWidth="2.5" />
          <path d="M85 70 C84 80 81 88 76 95 C85 97 92 101 99 104 L104 102 C96 94 90 84 88 70 Z" fill={PR[0]} stroke="none" opacity="0.5" />
          <path d="M90 58 C96 51 104 49 112 50" fill="none" stroke={PR[4]} strokeWidth="1.5" opacity="0.85" />
          {/* hood lining in shadow behind the face */}
          <path d="M113 55 C104 62 102 78 106 92 L120 98 L126 66 Z" fill={PR[0]} strokeWidth="1.2" />
          {/* hair framing the face */}
          {!shaved && <path d="M114 56 C107 62 105 74 107 86 C109 92 112 95 115 96 C114 86 114 72 118 60 Z" fill={HR[1]} strokeWidth="1.2" />}
          {/* face */}
          <path d="M116 59 C121 57 126 59 128 63 L129 67 C130 69 132 72 133 74.5 C132.5 76 131 76.5 129.5 77 C129.5 78.5 129 79.5 128.5 80.5 C128.5 82 128 83.5 126.5 85 C126 87.5 124 89.5 121 90 C117 90 114 88 112 85 C111 78 112 68 116 59 Z" fill={url("face")} strokeWidth="1.8" />
          {/* shade under the brow and along the jaw */}
          <path d="M113 70 C116 74 118 80 117 87 L112 85 C111 80 111 74 113 70 Z" fill={SK[1]} stroke="none" opacity="0.45" />
          <path d="M129.5 77 C128 78 127 78 126 77.5" fill="none" stroke={SK[0]} strokeWidth="0.9" />
          <path d="M128.3 81.2 L125.5 81.6" stroke={P.oxblood[1]} strokeWidth="1.1" />
          {/* eye and brow */}
          <path d="M121 68.5 C122.5 67 125.5 67 126.5 68.5 C125.5 69.6 123 70 121 68.5 Z" fill={INK} strokeWidth="0.6" />
          <circle cx="124.6" cy="68.4" r="0.6" fill={PR[4]} stroke="none" />
          <path d="M120 65.5 C122.5 64 125.5 64 127.5 65.2" fill="none" stroke={HR[0]} strokeWidth="1.3" />
          <path d="M126 60.5 C128 62 129 65 129.5 68" fill="none" stroke={SK[4]} strokeWidth="1" opacity="0.9" />
          {/* the loose auburn strand across the temple */}
          {!shaved && (
            <g>
              <path d="M116 60 C112.5 68 112 77 114 85 C115.5 91 118 95 122 98" fill="none" stroke={HR[1]} strokeWidth="2.2" />
              <path d="M116 60 C112.5 68 112 77 114 85 C115.5 91 118 95 122 98" fill="none" stroke={HR[3]} strokeWidth="0.8" />
              <path d="M121 59 C119.5 61 119.5 63 120.5 65" fill="none" stroke={HR[2]} strokeWidth="1.3" />
            </g>
          )}
          {/* hood rim over the brow */}
          <path d="M108 56 C116 50 126 52 130 62 C127 60 122 58 116 59 C113 60 110 62 108 64 Z" fill={url("cloak")} strokeWidth="1.8" />
          <path d="M110 56 C117 52 125 54 129 60" fill="none" stroke={PR[4]} strokeWidth="1" opacity="0.8" />
        </g></g>
        )}

        {/* ── bow, string and arrow ── */}
        <g transform={bowT}>
          {/* string */}
          <path d="M0 -68 L0 68" stroke={P.bone[4]} strokeWidth="0.9" />
          {strike && (
            <g fill="none" stroke={P.bone[4]} strokeWidth="0.7" opacity="0.6">
              <path d="M0 -68 Q-7 0 0 68" />
              <path d="M0 -68 Q5 0 0 68" opacity="0.6" />
            </g>
          )}
          {/* arrow: nocked in idle, in flight in the strike */}
          <g transform={strike ? "translate(6 0)" : undefined}>
            <path d="M-1 0 L44 0" stroke={INK} strokeWidth="3" />
            <path d="M-1 0 L44 0" stroke={P.leather[3]} strokeWidth="1.4" />
            <path d="M42 -3.2 L51 0 L42 3.2 Z" fill={P.steel[3]} strokeWidth="1.2" />
            <path d="M1 0 L8 -4 L14 -4 L10 0 Z" fill={FL[1]} strokeWidth="1" />
            <path d="M1 0 L8 4 L14 4 L10 0 Z" fill={P.bone[4]} strokeWidth="1" />
          </g>
          {/* longbow limbs */}
          <path d="M0 -68 C8 -60 16 -40 17 -14 L17 14 C16 40 8 60 0 68" fill="none" stroke={INK} strokeWidth="5.2" />
          <path d="M0 -68 C8 -60 16 -40 17 -14 L17 14 C16 40 8 60 0 68" fill="none" stroke={P.leather[2]} strokeWidth="3" />
          <path d="M3 -62 C9 -54 14 -38 15.5 -16 M15.5 16 C14 38 9 54 3 62" fill="none" stroke={P.leather[4]} strokeWidth="0.9" opacity="0.8" />
          {/* nocks and grip wrap */}
          <path d="M-1 -68 L2 -71 M-1 68 L2 71" stroke={P.bone[3]} strokeWidth="2.2" />
          <path d="M14.5 -8 L19.5 -8 L19.5 8 L14.5 8 Z" fill={GRIP[2]} strokeWidth="1.3" />
          <path d="M15 -4 L19 -4 M15 0 L19 0 M15 4 L19 4" stroke={GRIP[0]} strokeWidth="0.8" />
        </g>

        {/* ── string hand (idle, pinching the nock) ── */}
        {!strike && (
          <g>
            <path d={seg(98, 132, stringHand[0] - 3, stringHand[1] - 1, 10, 8, 0.5, 0.5)} fill={P.leather[1]} strokeWidth="2" />
            <path d="M113 142 C116 140 121 141 123 144 C124 148 122 151 118 151 C115 151 112 148 113 142 Z" fill={url("hand")} strokeWidth="1.4" />
            <path d="M117 144 L122 146" stroke={SK[0]} strokeWidth="0.8" />
          </g>
        )}

        {/* ── near (bow) arm ── */}
        {strike ? (
          <g>
            <path d={seg(112, 104, 136, 97, 13, 10, 1.5, 1)} fill={url("sleeve")} strokeWidth="2.2" />
            <path d={seg(136, 97, 156, 93, 10, 8.5, 0.5, 0.5)} fill={P.leather[1]} strokeWidth="2.1" />
            <path d="M140 92 L141 102 M147 91 L148 100" stroke={P.gold[2]} strokeWidth="1.3" />
            <path d="M138 93 C144 91 150 91 154 90" fill="none" stroke={P.leather[3]} strokeWidth="1" opacity="0.8" />
          </g>
        ) : (
          <g>
            <path d={seg(114, 106, 122, 132, 13, 10, 1.5, 1)} fill={url("sleeve")} strokeWidth="2.2" />
            <path d={seg(122, 132, bowHand[0] - 1, bowHand[1] - 3, 10, 8.5, 0.5, 0.5)} fill={P.leather[1]} strokeWidth="2.1" />
            <path d="M121 138 L128 136 M124 146 L131 143" stroke={P.gold[2]} strokeWidth="1.3" />
            <path d="M119 134 C121 140 124 146 128 150" fill="none" stroke={P.leather[3]} strokeWidth="1" opacity="0.8" />
          </g>
        )}
        {/* fist around the grip */}
        <path d={`M${bowHand[0] - 5} ${bowHand[1] - 5} C${bowHand[0] - 1} ${bowHand[1] - 8} ${bowHand[0] + 5} ${bowHand[1] - 6} ${bowHand[0] + 5} ${bowHand[1]} C${bowHand[0] + 5} ${bowHand[1] + 5} ${bowHand[0]} ${bowHand[1] + 7} ${bowHand[0] - 4} ${bowHand[1] + 5} C${bowHand[0] - 7} ${bowHand[1] + 2} ${bowHand[0] - 7} ${bowHand[1] - 2} ${bowHand[0] - 5} ${bowHand[1] - 5} Z`} fill={url("hand")} strokeWidth="1.5" />
        <path d={`M${bowHand[0] - 2} ${bowHand[1] - 2} L${bowHand[0] + 4} ${bowHand[1] - 1} M${bowHand[0] - 2} ${bowHand[1] + 2} L${bowHand[0] + 4} ${bowHand[1] + 3}`} stroke={SK[0]} strokeWidth="0.8" />
        </g>
      </g>

      <g transform={body}>
      {/* ── the arrow's flight (strike), a verdigris glint of the ranger's focus ── */}
      {strike ? (
        <g fill="none" strokeLinecap="round">
          <path d="M172 86.5 L190 86.5 M168 97.5 L186 97.5 M178 83 L188 83" stroke={P.bone[4]} strokeWidth="1.1" opacity="0.85" />
          <circle cx="200" cy="92" r="6" fill={look ? C.glow[3] : GLOW.hex} opacity="0.45" filter="url(#glow-soft)" />
          <circle cx="200" cy="92" r="1.8" fill="#ffffff" filter="url(#glow)" />
        </g>
      ) : (
        <g transform={bowT}>
          <circle cx="51" cy="0" r="4" fill={look ? C.glow[3] : GLOW.hex} opacity="0.4" filter="url(#glow-soft)" />
          <circle cx="50.5" cy="0" r="1.2" fill="#ffffff" filter="url(#glow)" />
        </g>
      )}
      </g>
    </svg>
  );
}
