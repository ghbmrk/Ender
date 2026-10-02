// Fails when a stylesheet has unbalanced braces. One missing "}" silently swallows every rule after it in the
// minified build (a merge once dropped the coach, card-glow and blind.css styles this way).
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
const dir = resolve(import.meta.dirname, "../../apps/game/src");
let bad = 0;
for (const f of readdirSync(dir).filter((f) => f.endsWith(".css"))) {
  const t = readFileSync(resolve(dir, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const open = (t.match(/{/g) ?? []).length;
  const close = (t.match(/}/g) ?? []).length;
  if (open !== close) (bad++, console.error(`${f}: ${open} "{" vs ${close} "}"`));
}
if (bad) process.exit(1);
console.log("css braces balanced");
