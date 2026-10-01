import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { figureFor } from "../../art/registry";
import { paintedFigure } from "../../art/painted";
import type { Pose } from "../../art/types";
import type { HeroLook } from "../../art/look";
import type { Art } from "../../art/ondevice/store";

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
export const Fig = memo(function Fig({ figure, pose = "idle", scale, className, look, bake, art }: { figure: string; pose?: Pose; scale?: number; className?: string; look?: HeroLook; bake?: boolean; art?: Art }) {
  const F = figureFor(figure).default;
  const b = figureBox(figure, scale);
  // Art painted on this device (art/ondevice) stands in for everything else once it's ready.
  if (art)
    return (
      <div className={`${className ?? ""} fig-ondevice ${look ? "is-hero" : ""}`} style={{ position: "absolute", left: -b.w / 2, top: -b.feetY, width: b.w, height: b.feetY }}>
        <ArtCanvas art={art} className="fig-img" />
      </div>
    );
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
export const Head = memo(function Head({ figure, size, look, art }: { figure: string; size: number; look?: HeroLook; art?: Art }) {
  const mod = figureFor(figure);
  const [x, y, s] = mod.meta.head;
  const F = mod.default;
  if (art)
    return (
      <div className={`head head-ondevice ${look ? "is-hero" : ""}`} style={{ width: size, height: size }}>
        <ArtCanvas art={art} className="head-img" />
      </div>
    );
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
/** A baked pose: a canvas holding the drawn figure (copied onto each figure that shows it), or, if a canvas
 *  can't be made, the figure's SVG as an image URL. Never PNG-encoded: toBlob took seconds on phones. */
type Baked = HTMLCanvasElement | string;
const BAKE_MAX = 640;
const bakedUrls = new Map<string, Baked>();
const baking = new Map<string, Promise<Baked>>();

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

function bakeSvg(svg: SVGSVGElement, w: number, h: number, flip: boolean): Promise<Baked> {
  let markup = svg.outerHTML;
  // Mirrored figures keep the plain wash (see .flip in frame.css), since page CSS can't reach inside an image.
  if (flip) markup = markup.replaceAll('filter="url(#fig)"', 'filter="url(#wc)"');
  // The watercolour filter costs per pixel, so every pose is baked once at BAKE_MAX px on its long side, whatever
  // size it shows at, and scaled on screen: the texture hides the softness, and one bake serves every screen.
  const res = BAKE_MAX / Math.max(w, h);
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
      (): Baked => {
        try {
          const c = document.createElement("canvas");
          c.width = W;
          c.height = H;
          const g = c.getContext("2d")!;
          g.drawImage(img, 0, 0, W, H);
          // Pay for the filter now, inside the bake, rather than on the first frame that shows the figure.
          g.getImageData(0, 0, 1, 1);
          return c;
        } catch {
          return url;
        }
      },
    )
    .catch(() => url);
}

/** Bakes run one at a time in idle moments, so a burst of new figures never blocks a tap for long. */
let bakeChain: Promise<unknown> = Promise.resolve();
const idle = () =>
  new Promise<void>((r) => ("requestIdleCallback" in window ? requestIdleCallback(() => r(), { timeout: 400 }) : setTimeout(r, 16)));
/** While a timing ring is closing, bakes wait: one can take a few hundred ms on a phone and would stall the beat. */
let held = false;
export const holdBakes = (on: boolean) => {
  held = on;
};
const unheld = () =>
  new Promise<void>((r) => {
    const check = () => (held ? setTimeout(check, 120) : r());
    check();
  });
function queueBake<T>(job: () => Promise<T>): Promise<T> {
  const run = bakeChain.then(unheld).then(idle).then(unheld).then(job);
  bakeChain = run.catch(() => undefined);
  return run;
}

/** Bakes these figures ahead of need (hidden), e.g. the foes waiting on the map, so their fight opens instantly. */
export function Prebake({ figures }: { figures: { figure: string; look?: HeroLook; flip?: boolean }[] }) {
  return (
    <div className="fig-prebake" style={{ display: "none" }} aria-hidden>
      {figures.map((f, i) => (
        <BakedFig key={`${f.figure}${i}`} figure={f.figure} scale={1} className={f.flip ? "flip" : undefined} look={f.look} only="bake" />
      ))}
    </div>
  );
}

/** Shows a baked pose: a canvas copy (one fast draw), or the image fallback. */
function BakedImage({ baked }: { baked: Baked }) {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const host = box.current;
    if (!host || typeof baked === "string") return;
    // The baked canvas itself goes on screen when nothing else shows it (the usual case: no copy at all);
    // a second figure in the same pose gets a copy.
    let c = baked;
    if (baked.isConnected) {
      c = document.createElement("canvas");
      c.width = baked.width;
      c.height = baked.height;
      c.getContext("2d")?.drawImage(baked, 0, 0);
    }
    c.className = "fig-svg fig-baked";
    host.appendChild(c);
    return () => c.remove();
  }, [baked]);
  if (typeof baked === "string") return <img src={baked} className="fig-svg fig-baked" alt="" draggable={false} />;
  return <div ref={box} className="fig-baked" />;
}

function BakedFig({ figure, pose = "idle", scale, className, look, only }: { figure: string; pose?: Pose; scale?: number; className?: string; look?: HeroLook; only?: "bake" }) {
  const F = figureFor(figure).default;
  const b = figureBox(figure, scale);
  const flip = /\bflip\b/.test(className ?? "");
  const keyOf = (p: Pose) => `${figure}|${p}|${flip}|${look ? JSON.stringify(look) : ""}`;
  const [, setTick] = useState(0);
  const src = useRef<HTMLDivElement>(null);
  const missing = POSES.filter((p) => !bakedUrls.has(keyOf(p)));
  useEffect(() => {
    let live = true;
    for (const p of missing) {
      const k = keyOf(p);
      const svg = src.current?.querySelector<SVGSVGElement>(`[data-pose-wrap="${p}"] > svg`);
      if (!svg || baking.has(k)) continue;
      const base = figureBox(figure, 1);
      const job = queueBake(() => bakeSvg(svg, base.w, base.h, flip)).then((u) => {
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
  const baked = bakedUrls.get(keyOf(pose));
  return (
    <div className={className} style={{ position: "absolute", left: -b.feetX, top: -b.feetY, width: b.w, height: b.h }}>
      {/* Until the bake lands, the figure shows without its costly filter (fig-unbaked), so the first frame is quick. */}
      {only === "bake" ? null : baked ? <BakedImage baked={baked} /> : <F pose={pose} className="fig-svg fig-unbaked" look={look} />}
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

/** Shows an on-device paint: one bitmap draw into a canvas the size of the cut-out, scaled by CSS. */
export function ArtCanvas({ art, className }: { art: Art; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = art.w;
    c.height = art.h;
    c.getContext("2d")?.drawImage(art.bmp, 0, 0);
  }, [art]);
  return <canvas ref={ref} width={art.w} height={art.h} className={`${className ?? ""} art-ondevice`} />;
}
