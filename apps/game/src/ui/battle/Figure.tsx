import { memo } from "react";
import { figureFor } from "../../art/registry";
import { paintedFigure } from "../../art/painted";
import type { Pose } from "../../art/types";

/** Stage px per viewBox unit, per painted figure. */
export const FIG_SCALE: Record<string, number> = {
  warden: 1.3,
  binder: 1.3,
  ranger: 1.3,
  husk: 1.2,
  wisp: 1.15,
  hound: 1.25,
  swarm: 1.2,
  keeper: 1.3,
  seer: 1.2,
  king: 1.5,
  wyrm: 1.45,
};

export function figureBox(figure: string, scale = FIG_SCALE[figure] ?? 1.2) {
  const m = figureFor(figure).meta;
  const [, , w, h] = m.viewBox;
  return { w: w * scale, h: h * scale, feetX: m.feet.x * scale, feetY: m.feet.y * scale, meta: m };
}

/** A painted figure standing with its feet at (x, y) in stage px. Memoised so filters are not re-rasterised needlessly. */
export const Fig = memo(function Fig({ figure, pose = "idle", scale, className }: { figure: string; pose?: Pose; scale?: number; className?: string }) {
  const F = figureFor(figure).default;
  const b = figureBox(figure, scale);
  const painted = paintedFigure(figure);
  if (painted)
    // A painted cut-out is cropped to its silhouette: stand it on the same feet, as tall as the drawn figure.
    return (
      <div className={className} style={{ position: "absolute", left: -b.w / 2, top: -b.feetY, width: b.w, height: b.feetY }}>
        <img src={painted} className="fig-img" alt="" draggable={false} />
      </div>
    );
  return (
    <div className={className} style={{ position: "absolute", left: -b.feetX, top: -b.feetY, width: b.w, height: b.h }}>
      <F pose={pose} className="fig-svg" />
    </div>
  );
});

/** A head crop of a figure, for the timeline and portraits. */
export const Head = memo(function Head({ figure, size }: { figure: string; size: number }) {
  const mod = figureFor(figure);
  const [x, y, s] = mod.meta.head;
  const F = mod.default;
  const painted = paintedFigure(figure);
  if (painted)
    return (
      <div className="head" style={{ width: size, height: size }}>
        <img src={painted} className="head-img" alt="" draggable={false} />
      </div>
    );
  return (
    <div className="head" style={{ width: size, height: size }}>
      <F viewBox={`${x} ${y} ${s} ${s}`} className="fig-svg" />
    </div>
  );
});
