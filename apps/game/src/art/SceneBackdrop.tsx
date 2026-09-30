import type { ComponentType } from "react";
import { paintedBackdrop } from "./painted";

/** A scene's backdrop: the painted image for `id` when there is one, else the code-drawn SVG. */
export function SceneBackdrop({ id, Drawn, className = "backdrop-svg" }: { id: string; Drawn?: ComponentType<{ className?: string }>; className?: string }) {
  const src = paintedBackdrop(id);
  if (src) return <img src={src} className={`${className} painted`} alt="" draggable={false} />;
  return Drawn ? <Drawn className={className} /> : null;
}
