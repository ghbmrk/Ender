import type { Intent } from "../entities/player";
import type { Rect } from "./geometry";

type Target = { x: number; y: number; r: number };
type Pt = { x: number; y: number };

const grow = (r: Rect, pad: number): Rect => ({ x: r.x - pad, y: r.y - pad, w: r.w + 2 * pad, h: r.h + 2 * pad });

/** Does segment a→b pass through rect r? (Liang–Barsky clipping.) */
function segmentHitsRect(a: Pt, b: Pt, r: Rect): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, a.x - r.x],
    [dx, r.x + r.w - a.x],
    [-dy, a.y - r.y],
    [dy, r.y + r.h - a.y],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return false;
  }
  return true;
}

const clear = (a: Pt, b: Pt, obstacles: Rect[], pad: number) => obstacles.every((o) => !segmentHitsRect(a, b, grow(o, pad)));

/** Next point to walk toward: the goal itself, or the best corner around the obstacle in the way. */
export function waypoint(me: Pt, goal: Pt, obstacles: Rect[], pad = 24): Pt {
  const blocking = obstacles.filter((o) => segmentHitsRect(me, goal, grow(o, pad)));
  if (!blocking.length) return goal;
  const first = blocking.sort((a, b) => Math.hypot(a.x + a.w / 2 - me.x, a.y + a.h / 2 - me.y) - Math.hypot(b.x + b.w / 2 - me.x, b.y + b.h / 2 - me.y))[0]!;
  const g = grow(first, pad + 6);
  const corners = [
    { x: g.x, y: g.y },
    { x: g.x + g.w, y: g.y },
    { x: g.x, y: g.y + g.h },
    { x: g.x + g.w, y: g.y + g.h },
  ];
  const reachable = corners.filter((c) => clear(me, c, obstacles, pad - 2));
  const pool = reachable.length ? reachable : corners;
  return pool.sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) + Math.hypot(goal.x - a.x, goal.y - a.y) - (Math.hypot(b.x - me.x, b.y - me.y) + Math.hypot(goal.x - b.x, goal.y - b.y)))[0]!;
}

/**
 * A simple deterministic combat bot used by E2E tests (and as a developer demo):
 * keeps a duelling distance from the nearest threat, kites telegraphs, fires constantly.
 */
export function autopilot(
  me: { x: number; y: number },
  targets: Target[],
  hazards: { x: number; y: number; r: number }[],
  goal: { x: number; y: number } | null,
  cds: { slip: number; unravel: number },
  obstacles: Rect[] = [],
): Intent {
  const intent: Intent = { moveX: 0, moveY: 0, aimX: 1, aimY: 0, fire: false, sever: false, slip: false, unravel: false, interact: false };
  let nearest: Target | null = null;
  let nd = Infinity;
  for (const t of targets) {
    const d = Math.hypot(t.x - me.x, t.y - me.y);
    if (d < nd) {
      nd = d;
      nearest = t;
    }
  }
  if (nearest) {
    const dx = nearest.x - me.x;
    const dy = nearest.y - me.y;
    intent.aimX = dx;
    intent.aimY = dy;
    intent.fire = true;
    if (!clear(me, nearest, obstacles, 0)) {
      // No line of fire: walk around the cover toward the target.
      const w = waypoint(me, nearest, obstacles);
      intent.moveX = w.x - me.x;
      intent.moveY = w.y - me.y;
    } else {
      const want = 230;
      const radial = nd > want + 30 ? 1 : nd < want - 30 ? -1 : 0;
      const t = performance.now() / 1400;
      intent.moveX = (dx / nd) * radial + (-dy / nd) * Math.sin(t) * 0.8;
      intent.moveY = (dy / nd) * radial + (dx / nd) * Math.sin(t) * 0.8;
    }
    const crowd = targets.filter((x) => Math.hypot(x.x - me.x, x.y - me.y) < 160).length;
    if (crowd >= 3 && cds.unravel <= 0) intent.unravel = true;
    if (nd < 110) intent.sever = true;
  } else if (goal) {
    const w = waypoint(me, goal, obstacles);
    intent.moveX = w.x - me.x;
    intent.moveY = w.y - me.y;
    intent.aimX = intent.moveX;
    intent.aimY = intent.moveY;
  }
  for (const h of hazards) {
    const d = Math.hypot(h.x - me.x, h.y - me.y);
    if (d < h.r + 25) {
      intent.moveX = (me.x - h.x) / (d || 1);
      intent.moveY = (me.y - h.y) / (d || 1);
      if (cds.slip <= 0) intent.slip = true;
    }
  }
  return intent;
}
