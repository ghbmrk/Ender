import { useId } from "react";
import { rng } from "./paint";

/**
 * The painted-light pass laid over a backdrop, in its 1080x1920 viewBox: a light bloom and god-rays
 * from the scene's key light, a haze band at the horizon for atmospheric perspective, pools of light
 * where the party and the foes stand (the stage of the card's art box), and a heavier vignette for
 * value contrast. Gradients and blend modes only (no filters), and the backdrop is static in battle,
 * so it rasterises once.
 */
export type AtmosphereProps = {
  /** Key light position (1080x1920 space) and colour. */
  light: { x: number; y: number; color: string; strength?: number };
  /** God-rays fanning down from the light: how many, the spread (radians) and how far they reach. */
  rays?: { n: number; spread: number; length: number; tilt?: number; seed?: number };
  /** Horizon haze: the band's centre y and its colour. */
  haze?: { y: number; color: string; opacity?: number };
  /** Light pools on the ground: [x, y, rx, ry]. Defaults to the battle's party and foe zones. */
  pools?: [number, number, number, number][];
  poolColor?: string;
  /** Edge darkening, 0..1. */
  vignette?: number;
};

export const BATTLE_POOLS: [number, number, number, number][] = [
  [330, 1300, 380, 150],
  [790, 960, 330, 130],
];

export function Atmosphere({ light, rays, haze, pools = BATTLE_POOLS, poolColor, vignette = 0.55 }: AtmosphereProps) {
  const u = useId().replace(/:/g, "");
  const id = (s: string) => `${u}-at-${s}`;
  const url = (s: string) => `url(#${id(s)})`;
  const k = light.strength ?? 1;
  const beams = rays
    ? (() => {
        const r = rng(rays.seed ?? 7);
        return Array.from({ length: rays.n }, (_, i) => {
          const t = rays.n === 1 ? 0.5 : i / (rays.n - 1);
          const a = (rays.tilt ?? 0) + (t - 0.5) * rays.spread + (r() - 0.5) * 0.08;
          const w = 0.02 + r() * 0.045;
          const L = rays.length * (0.75 + r() * 0.35);
          const p = (ang: number) => `${(light.x + Math.sin(ang) * L).toFixed(0)} ${(light.y + Math.cos(ang) * L).toFixed(0)}`;
          // Three nested wedges give each beam a soft edge without a blur filter.
          const wedge = (ww: number) => `M${light.x} ${light.y} L${p(a - ww)} L${p(a + ww)} Z`;
          return { ds: [wedge(w * 2.2), wedge(w * 1.4), wedge(w * 0.7)], o: 0.35 + r() * 0.65 };
        });
      })()
    : [];
  const pc = poolColor ?? light.color;
  return (
    <g pointerEvents="none">
      <defs>
        <radialGradient id={id("bloom")} cx={light.x} cy={light.y} r={520 * k} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={light.color} stopOpacity={0.55 * k} />
          <stop offset="0.25" stopColor={light.color} stopOpacity={0.2 * k} />
          <stop offset="1" stopColor={light.color} stopOpacity="0" />
        </radialGradient>
        {rays && (
          <radialGradient id={id("ray")} cx={light.x} cy={light.y} r={rays.length} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={light.color} stopOpacity={0.34 * k} />
            <stop offset="0.5" stopColor={light.color} stopOpacity={0.12 * k} />
            <stop offset="1" stopColor={light.color} stopOpacity="0" />
          </radialGradient>
        )}
        {haze && (
          <linearGradient id={id("haze")} x1="0" y1={haze.y - 220} x2="0" y2={haze.y + 260} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={haze.color} stopOpacity="0" />
            <stop offset="0.45" stopColor={haze.color} stopOpacity={haze.opacity ?? 0.28} />
            <stop offset="1" stopColor={haze.color} stopOpacity="0" />
          </linearGradient>
        )}
        <radialGradient id={id("pool")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={pc} stopOpacity="0.2" />
          <stop offset="0.6" stopColor={pc} stopOpacity="0.07" />
          <stop offset="1" stopColor={pc} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("vig")} cx="540" cy="1080" r="1250" gradientUnits="userSpaceOnUse">
          <stop offset="0.45" stopColor="#000" stopOpacity="0" />
          <stop offset="0.8" stopColor="#000" stopOpacity={vignette * 0.45} />
          <stop offset="1" stopColor="#000" stopOpacity={vignette} />
        </radialGradient>
      </defs>
      {haze && <rect width="1080" height="1920" fill={url("haze")} />}
      <g style={{ mixBlendMode: "screen" }}>
        <rect width="1080" height="1920" fill={url("bloom")} />
        {beams.map((b, i) => (
          <g key={i} opacity={b.o.toFixed(2)}>
            {b.ds.map((d, j) => (
              <path key={j} d={d} fill={url("ray")} opacity="0.4" />
            ))}
          </g>
        ))}
        {pools.map(([x, y, rx, ry], i) => (
          <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} fill={url("pool")} />
        ))}
      </g>
      <rect width="1080" height="1920" fill={url("vig")} />
    </g>
  );
}
