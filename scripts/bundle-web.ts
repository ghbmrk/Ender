/**
 * Turns the Vite web build (apps/game/dist-web) into single self-contained pages:
 *   dist-web/ender.html   full document: open it from disk or host it anywhere
 *   dist-web/artifact.html    the same page as a body fragment, for hosts that supply the document shell
 * No network is needed at runtime: the server, seeds and fixtures are all inside.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT } from "./paths";

const dist = resolve(ROOT, "apps/game/dist-web");
const html = readFileSync(resolve(dist, "index.html"), "utf8");
const assets = readdirSync(resolve(dist, "assets"));
const css = assets.filter((f) => f.endsWith(".css")).map((f) => readFileSync(resolve(dist, "assets", f), "utf8")).join("\n");
const jsFile = assets.find((f) => f.endsWith(".js"));
if (!jsFile || assets.filter((f) => f.endsWith(".js")).length !== 1) throw new Error(`expected exactly one JS chunk, got ${assets.join(", ")}`);
const js = readFileSync(resolve(dist, "assets", jsFile), "utf8").replace(/<\/script/gi, "<\\/script");

const title = html.match(/<title>.*?<\/title>/)?.[0] ?? "<title>Ender</title>";
const icon = html.match(/<link rel="icon" href="[^"]*"\s*\/?>/)?.[0] ?? "";
const style = `<style>\n${css}\n</style>`;
const script = `<script type="module">\n${js}\n</script>`;

// Shown until the game draws its first screen (the script is large), so a slow phone never sees a blank page.
const root = `<div id="root"><div style="position:fixed;inset:0;display:grid;place-items:center;background:#0b0910;color:#c3ccd7;font:600 18px system-ui,sans-serif;letter-spacing:.2em">LOADING ENDER</div></div>`;
writeFileSync(
  resolve(dist, "ender.html"),
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="UTF-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n${title}\n${icon}\n${style}\n</head>\n<body>\n${root}\n${script}\n</body>\n</html>\n`,
);
writeFileSync(resolve(dist, "artifact.html"), `${title}\n${style}\n${root}\n${script}\n`);
const mb = (s: string) => (Buffer.byteLength(s) / 1e6).toFixed(2);
console.log(`ender.html + artifact.html written (${mb(js)} MB script, ${mb(css)} MB css)`);

// The split build (apps/game/dist-split): a small first script that draws the title, with the rest fetched beside it.
// artifact.html is its body fragment; the files under assets/ are published next to it.
const split = resolve(ROOT, "apps/game/dist-split");
const shtml = readFileSync(resolve(split, "index.html"), "utf8");
const head = shtml.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? "";
const links = head
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => /^<(script|link rel="(stylesheet|modulepreload)")/.test(l));
writeFileSync(resolve(split, "artifact.html"), `${title}\n${links.join("\n")}\n${root}\n`);
console.log(`dist-split/artifact.html written (${readdirSync(resolve(split, "assets")).length} supporting files)`);
