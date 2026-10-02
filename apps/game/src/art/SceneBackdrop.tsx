import type { ComponentType } from "react";
import { BACKDROP_FLOOR, paintedBackdrop } from "./painted";

/** A scene's backdrop: the painted image for `id` when there is one, else the code-drawn SVG. */
export function SceneBackdrop({ id, Drawn, className = "backdrop-svg" }: { id: string; Drawn?: ComponentType<{ className?: string }>; className?: string }) {
  const src = paintedBackdrop(id);
  if (src) return <img src={src} className={`${className} painted`} alt="" draggable={false} />;
  return Drawn ? <Drawn className={className} /> : null;
}

/**
 * A painted backdrop placed so its ground meets a foe's feet at world y `feet`: scaled up just enough, its foot
 * fading into shadow under the hero (who covers it) rather than ending in a hard edge. Falls back to the plain
 * backdrop when the scene has no painting or no known ground line.
 */
export function GroundedBackdrop({ id, Drawn, feet, top }: { id: string; Drawn?: ComponentType<{ className?: string }>; feet: number; top: number }) {
  const src = paintedBackdrop(id);
  const floor = BACKDROP_FLOOR[id];
  if (!src || floor === undefined) return <SceneBackdrop id={id} Drawn={Drawn} />;
  // At least this zoom, and enough that the painting's top still reaches the screen's top (world y `top`).
  const k = Math.max(1.45, (feet - top) / (floor * 1920));
  const w = 1080 * k;
  const h = 1920 * k;
  const y = feet - floor * h;
  const box = { position: "absolute", left: (1080 - w) / 2, width: w, height: h } as const;
  return (
    <>
      <img src={src} className="grounded" style={{ ...box, top: y }} alt="" draggable={false} />
      <div className="grounded-fade" style={{ ...box, top: y + h - 260, height: 900 }} />
    </>
  );
}
