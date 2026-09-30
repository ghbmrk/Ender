/**
 * Validates every fixture in data/inference-fixtures: filename = request hash, schema,
 * matching recorded request, no invented candidate IDs, no invented numbers.
 * Exits non-zero on any error.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { validateFixture, type InferenceKind } from "@ender/inference";
import { DATA_DIR } from "./paths";

const KINDS: InferenceKind[] = ["attune", "transform", "critique"];
let errors = 0;
let count = 0;
for (const kind of KINDS) {
  const dir = resolve(DATA_DIR, "inference-fixtures", kind);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    count++;
    const fixture = JSON.parse(readFileSync(resolve(dir, f), "utf8"));
    const problems: string[] = [];
    if (fixture.type !== kind) problems.push(`type ${fixture.type} ≠ folder ${kind}`);
    if (`${fixture.requestHash}.json` !== f) problems.push("filename does not match requestHash");
    if (!fixture.fixtureVersion || !fixture.author) problems.push("missing fixtureVersion/author");
    const reqPath = resolve(DATA_DIR, "inference-requests", kind, f);
    if (!existsSync(reqPath)) problems.push("no recorded request with this hash");
    else problems.push(...validateFixture(kind, JSON.parse(readFileSync(reqPath, "utf8")).request, fixture));
    if (problems.length) {
      errors += problems.length;
      console.log(`✗ ${kind}/${f}`);
      for (const p of problems) console.log(`    ${p}`);
    }
  }
}
console.log(`${count} fixture(s) checked, ${errors} error(s).`);
process.exit(errors ? 1 : 0);
