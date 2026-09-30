/**
 * Small deterministic helpers shared by the painted backdrops (seeded scatter, perspective
 * flagstones). Everything is seeded so server and client renders match.
 */

export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export type Stone = { d: string; cx: number; cy: number; shade: number; depth: number; dash: string };

/**
 * Staggered flagstones on a ground plane in true perspective. `tile` is a stone's width in px on
 * the bottom row; `z0` sets how steeply the rows foreshorten (bigger = flatter, more distant view).
 */
export function flagstones(o: {
  vpX: number;
  horizon: number;
  bottom: number;
  tile: number;
  z0: number;
  seed: number;
  width?: number;
  minRow?: number;
  aspect?: number; // stone depth / width on the ground
}): Stone[] {
  const r = rng(o.seed);
  const W = o.width ?? 390;
  const A = o.bottom - o.horizon;
  const f = o.tile * o.z0;
  const asp = o.aspect ?? 1;
  const Y = (z: number) => o.horizon + (A * o.z0) / z;
  const X = (x: number, z: number) => o.vpX + (f * x) / z;
  const j = (v: number, a: number) => v + (r() - 0.5) * a;
  const stones: Stone[] = [];
  const zs: number[] = [];
  for (let z = o.z0; ; z += asp) {
    zs.push(z);
    if (Y(z) - Y(z + asp) < (o.minRow ?? 2.2)) break;
  }
  const n = zs.length;
  for (let i = 0; i < n; i++) {
    const za = zs[i]!;
    const zb = za + asp;
    const y0 = Y(zb);
    const y1 = Y(za);
    const off = i % 2 ? 0.5 : 0;
    const a = (y1 - y0) * 0.1 + 0.2;
    const span = Math.ceil(((W / 2 + 40) * zb) / f) + 1;
    for (let c = -span; c <= span; c++) {
      const c0 = c + off - 0.5;
      const c1 = c0 + 1;
      const p = [
        [X(c0, zb), y0],
        [X(c1, zb), y0],
        [X(c1, za), y1],
        [X(c0, za), y1],
      ].map(([x, y]) => [j(x!, a * 2), j(y!, a)] as const);
      const xs = p.map((q) => q[0]);
      if (Math.max(...xs) < -10 || Math.min(...xs) > W + 10) continue;
      const per = 6 + (y1 - y0) * 2.2;
      const dash = `${(per * (0.8 + r() * 1.6)).toFixed(1)} ${(per * (0.1 + r() * 0.5)).toFixed(1)} ${(per * (0.4 + r())).toFixed(1)} ${(per * r() * 0.3).toFixed(1)}`;
      const q = (u: number) => u.toFixed(1);
      const d = `M${q(p[0]![0])} ${q(p[0]![1])}Q${q(j((p[0]![0] + p[1]![0]) / 2, a))} ${q(j(p[0]![1], a))} ${q(p[1]![0])} ${q(p[1]![1])}L${q(p[2]![0])} ${q(p[2]![1])}Q${q(j((p[2]![0] + p[3]![0]) / 2, a))} ${q(j(p[2]![1], a))} ${q(p[3]![0])} ${q(p[3]![1])}Z`;
      stones.push({ d, cx: (p[0]![0] + p[2]![0]) / 2, cy: (y0 + y1) / 2, shade: r() * 2 - 1, depth: (y1 - o.horizon) / A, dash });
    }
  }
  return stones;
}

/** Scattered points inside a box, with a per-point size and a 0..1 random value. */
export function scatter(n: number, seed: number, x: number, y: number, w: number, h: number) {
  const r = rng(seed);
  return Array.from({ length: n }, () => ({ x: x + r() * w, y: y + r() * h, s: r(), t: r() }));
}

/**
 * Battle backdrops are authored in a 540x960 space and scaled x2 into the 1080x1920 viewBox.
 * busy(x, y) in that space: 0 inside the calm figure zones (party lower-left, foes upper-right)
 * and fading out below the battlefield (the action-card area), 1 elsewhere.
 */
export function busy(x: number, y: number) {
  const party = Math.hypot((x - 155) / 140, (y - 535) / 95);
  const foes = Math.hypot((x - 390) / 135, (y - 395) / 95);
  const b = Math.min(1, Math.max(0, Math.min(party, foes) - 0.6) * 1.6);
  return y > 630 ? b * Math.max(0.35, 1 - (y - 630) / 200) : b;
}

/** Faint dashed horizontal strokes for the far band of a floor, where flagstones get too thin to draw. */
export function farLines(seed: number, horizon: number, to: number, n: number, width = 540) {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n;
    const y = horizon + (to - horizon) * t * t;
    const segs: string[] = [];
    let x = -20 + r() * 20;
    while (x < width + 20) {
      const len = 10 + r() * 50 * (0.4 + t);
      segs.push(`M${x.toFixed(1)} ${(y + (r() - 0.5) * 0.8).toFixed(1)}h${len.toFixed(1)}`);
      x += len + 4 + r() * 30;
    }
    return { d: segs.join(""), t };
  });
}
