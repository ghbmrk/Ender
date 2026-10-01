import { memo, useEffect, useRef, useState } from "react";
import { figureFor } from "../../art/registry";
import { paintedFigure } from "../../art/painted";
import type { Pose } from "../../art/types";
import type { HeroLook } from "../../art/look";

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
export const Fig = memo(function Fig({ figure, pose = "idle", scale, className, look, bake }: { figure: string; pose?: Pose; scale?: number; className?: string; look?: HeroLook; bake?: boolean }) {
  const F = figureFor(figure).default;
  const b = figureBox(figure, scale);
  if (bake && (look || !paintedFigure(figure)))
    return <BakedFig figure={figure} pose={pose} scale={scale} className={className} look={look} />;
  // The player's own hero is always drawn from their look, never swapped for shared painted art.
  const painted = look ? undefined : paintedFigure(figure);
  if (painted)
    // A painted cut-out is cropped to its silhouette: stand it on the same feet, as tall as the drawn figure.
    return (
      <div className={className} style={{ position: "absolute", left: -b.w / 2, top: -b.feetY, width: b.w, height: b.feetY }}>
        <img src={painted} className="fig-img" alt="" draggable={false} />
      </div>
    );
  return (
    <div className={className} style={{ position: "absolute", left: -b.feetX, top: -b.feetY, width: b.w, height: b.h }}>
      <F pose={pose} className="fig-svg" look={look} />
    </div>
  );
});

/** A head crop of a figure, for the timeline and portraits. */
export const Head = memo(function Head({ figure, size, look }: { figure: string; size: number; look?: HeroLook }) {
  const mod = figureFor(figure);
  const [x, y, s] = mod.meta.head;
  const F = mod.default;
  const painted = look ? undefined : paintedFigure(figure);
  if (painted)
    return (
      <div className="head" style={{ width: size, height: size }}>
        <img src={painted} className="head-img" data-fig={figure} alt="" draggable={false} />
      </div>
    );
  return (
    <div className="head" style={{ width: size, height: size }}>
      <F viewBox={`${x} ${y} ${s} ${s}`} className="fig-svg" look={look} />
    </div>
  );
});

/*
 * Baked figures. A drawn figure's watercolour filter (turbulence, lighting) is far too costly to
 * re-run whenever its layer repaints, which in a fight is every few frames: that was the stutter.
 * So in fights each pose is drawn once, filter and all, into a bitmap, and the bitmap is what moves.
 */
const POSES: Pose[] = ["idle", "strike"];
const bakedUrls = new Map<string, string>();
const baking = new Map<string, Promise<string>>();

/** The shared <defs> a figure's markup points at (filters, gradients), copied in so it renders on its own. */
function defsFor(markup: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  const visit = (text: string) => {
    for (const m of text.matchAll(/url\(#([\w-]+)\)|href="#([\w-]+)"/g)) {
      const id = m[1] ?? m[2]!;
      if (seen.has(id)) continue;
      seen.add(id);
      const el = document.getElementById(id);
      if (!el || markup.includes(`id="${id}"`)) continue;
      out.push(el.outerHTML);
      visit(el.outerHTML);
    }
  };
  visit(markup);
  return out.join("");
}

function bakeSvg(svg: SVGSVGElement, w: number, h: number, flip: boolean): Promise<string> {
  let markup = svg.outerHTML;
  // Mirrored figures keep the plain wash (see .flip in frame.css), since page CSS can't reach inside an image.
  if (flip) markup = markup.replaceAll('filter="url(#fig)"', 'filter="url(#wc)"');
  const res = Math.min(2, Math.max(0.75, (window.innerWidth / 1080) * (window.devicePixelRatio || 1)));
  const W = Math.round(w * res);
  const H = Math.round(h * res);
  markup = markup
    .replace(/^<svg/, `<svg width="${W}" height="${H}"`)
    .replace(/\s(xmlns(:xlink)?)="[^"]*"/g, "")
    .replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"')
    .replace(/^(<svg[^>]*>)/, `$1<defs>${defsFor(markup)}</defs>`);
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup);
  const img = new Image();
  img.src = url;
  return img
    .decode()
    .then(
      () =>
        new Promise<string>((done) => {
          try {
            const c = document.createElement("canvas");
            c.width = W;
            c.height = H;
            c.getContext("2d")!.drawImage(img, 0, 0, W, H);
            c.toBlob((blob) => done(blob ? URL.createObjectURL(blob) : url), "image/png");
          } catch {
            done(url);
          }
        }),
    )
    .catch(() => url);
}

function BakedFig({ figure, pose = "idle", scale, className, look }: { figure: string; pose?: Pose; scale?: number; className?: string; look?: HeroLook }) {
  const F = figureFor(figure).default;
  const b = figureBox(figure, scale);
  const flip = /\bflip\b/.test(className ?? "");
  const keyOf = (p: Pose) => `${figure}|${p}|${Math.round(b.w)}|${flip}|${look ? JSON.stringify(look) : ""}`;
  const [, setTick] = useState(0);
  const src = useRef<HTMLDivElement>(null);
  const missing = POSES.filter((p) => !bakedUrls.has(keyOf(p)));
  useEffect(() => {
    let live = true;
    for (const p of missing) {
      const k = keyOf(p);
      const svg = src.current?.querySelector<SVGSVGElement>(`[data-pose-wrap="${p}"] > svg`);
      if (!svg || baking.has(k)) continue;
      const job = bakeSvg(svg, b.w, b.h, flip).then((u) => {
        bakedUrls.set(k, u);
        baking.delete(k);
        return u;
      });
      baking.set(k, job);
    }
    Promise.all(missing.map((p) => baking.get(keyOf(p)))).then(() => live && setTick((t) => t + 1));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing.join()]);
  const url = bakedUrls.get(keyOf(pose));
  return (
    <div className={className} style={{ position: "absolute", left: -b.feetX, top: -b.feetY, width: b.w, height: b.h }}>
      {url ? <img src={url} className="fig-svg fig-baked" alt="" draggable={false} /> : <F pose={pose} className="fig-svg" look={look} />}
      {missing.length > 0 && (
        // Off-screen sources for the bake: display:none, so they cost nothing to draw.
        <div ref={src} className="fig-bake-src" style={{ display: "none" }}>
          {missing.map((p) => (
            <div key={p} data-pose-wrap={p}>
              <F pose={p} className="fig-svg" look={look} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
