/**
 * Renders every figure in src/art/figures (idle and strike poses, plus the head crop) and every
 * backdrop in src/art/backdrops into one HTML page, for screenshots:
 *   cd apps/game && npx tsx scripts/gallery.tsx && node ../../scripts/shoot-gallery.mjs
 */
import { readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { ArtDefs } from "../src/art/defs";

const here = dirname(fileURLToPath(import.meta.url));
const only = process.argv[2];
const figDir = resolve(here, "../src/art/figures");
const bgDir = resolve(here, "../src/art/backdrops");

async function load(dir: string) {
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".tsx"));
  } catch {}
  const out = [];
  for (const f of files) {
    if (only && !f.toLowerCase().includes(only.toLowerCase())) continue;
    out.push({ file: f, mod: await import(pathToFileURL(resolve(dir, f)).href) });
  }
  return out;
}

const figs = await load(figDir);
const bgs = await load(bgDir);
const cells = figs
  .map(({ file, mod }) => {
    const C = mod.default;
    const m = mod.meta;
    const [x, y, w, h] = m.viewBox;
    const scale = 320 / Math.max(h, 1);
    const size = `width:${Math.round(w * scale)}px;height:${Math.round(h * scale)}px`;
    const head = m.head.join(" ");
    return `<div class="cell"><div class="row"><div style="${size}">${renderToStaticMarkup(<C pose="idle" />)}</div><div style="${size}">${renderToStaticMarkup(
      <C pose="strike" />,
    )}</div><div class="head">${renderToStaticMarkup(<C viewBox={head} />)}</div></div><div class="label">${file} · ${m.facing} · vb ${x} ${y} ${w} ${h}</div></div>`;
  })
  .join("\n");
const backs = bgs
  .map(({ file, mod }) => {
    const C = mod.default;
    return `<div class="cell"><div style="width:390px;height:520px">${renderToStaticMarkup(<C />)}</div><div class="label">${file}</div></div>`;
  })
  .join("\n");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;padding:16px;background:#e9dcc0;font:13px sans-serif;color:#222}
.grid{display:flex;flex-wrap:wrap;gap:18px}
.cell{background:#efe3c8;border:1px solid #c9b58f;padding:10px}
.row{display:flex;gap:10px;align-items:flex-end}
.row svg,.cell svg{width:100%;height:100%;display:block;overflow:visible}
.head{width:72px;height:72px;border-radius:50%;overflow:hidden;background:#2a2533;border:2px solid #c9953a}
.label{margin-top:6px;opacity:.7}
.dark{background:#1b1822}
</style></head><body>${renderToStaticMarkup(<ArtDefs />)}<div class="grid">${cells}</div><div class="grid" style="margin-top:18px">${backs}</div></body></html>`;
mkdirSync(resolve(here, "../../../art-shots"), { recursive: true });
writeFileSync(resolve(here, "../../../art-shots/gallery.html"), html);
console.log(`gallery: ${figs.length} figures, ${bgs.length} backdrops`);
