/** Lists recorded inference requests and whether each has a fixture. */
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { DATA_DIR } from "./paths";

const KINDS = ["attune", "transform", "critique"] as const;
const reqDir = resolve(DATA_DIR, "inference-requests");
const fixDir = resolve(DATA_DIR, "inference-fixtures");
const ls = (d: string) => (existsSync(d) ? readdirSync(d).filter((f) => f.endsWith(".json")) : []);

let missing = 0;
for (const kind of KINDS) {
  const requests = ls(resolve(reqDir, kind));
  const fixtures = new Set(ls(resolve(fixDir, kind)));
  const open = requests.filter((f) => !fixtures.has(f));
  missing += open.length;
  console.log(`${kind.padEnd(9)} fixtures ${String(fixtures.size).padStart(3)}  requests ${String(requests.length).padStart(3)}  missing ${open.length}`);
  for (const f of open) console.log(`  missing  ${kind}/${f}`);
}
console.log(missing ? `\n${missing} request(s) need fixtures. Author them in data/inference-fixtures/<type>/<hash>.json, then run pnpm fixtures:validate.` : "\nEvery recorded request has a fixture.");
