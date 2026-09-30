import type { Intent } from "../entities/player";

type Target = { x: number; y: number; r: number };

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
    const want = 230;
    const radial = nd > want + 30 ? 1 : nd < want - 30 ? -1 : 0;
    const t = performance.now() / 1400;
    intent.moveX = (dx / nd) * radial + (-dy / nd) * Math.sin(t) * 0.8;
    intent.moveY = (dy / nd) * radial + (dx / nd) * Math.sin(t) * 0.8;
    const crowd = targets.filter((x) => Math.hypot(x.x - me.x, x.y - me.y) < 160).length;
    if (crowd >= 3 && cds.unravel <= 0) intent.unravel = true;
    if (nd < 110) intent.sever = true;
  } else if (goal) {
    intent.moveX = goal.x - me.x;
    intent.moveY = goal.y - me.y;
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
