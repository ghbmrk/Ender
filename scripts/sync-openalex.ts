/**
 * Counts OpenAlex works mentioning each Form's source compound, for the lore tier
 * shown as evidence (none / sparse / known / extensive). Writes data/seed/openalex/lore.json.
 *
 *   pnpm data:sync:openalex [--limit N]
 *   OPENALEX_MAILTO=you@example.org pnpm data:sync:openalex   # OpenAlex "polite pool"
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { DATA_DIR } from "./paths";

const DEST = resolve(DATA_DIR, "seed/openalex/lore.json");
const i = process.argv.indexOf("--limit");
const limit = i >= 0 ? Number(process.argv[i + 1]) : Infinity;
const mailto = process.env.OPENALEX_MAILTO;

async function main() {
  const compounds = JSON.parse(readFileSync(resolve(DATA_DIR, "seed/pubchem/compounds.json"), "utf8")).compounds as { externalId: string; title: string }[];
  const records = [];
  for (const c of compounds.slice(0, limit)) {
    const query = `"${c.title}"`;
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=1&select=id${mailto ? `&mailto=${encodeURIComponent(mailto)}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OpenAlex HTTP ${res.status} for ${c.title}`);
    const body = (await res.json()) as { meta: { count: number } };
    records.push({ externalId: c.externalId, worksCount: body.meta.count, query, fetchedAt: new Date().toISOString() });
    process.stdout.write(`\r${records.length}/${Math.min(limit, compounds.length)}`);
    await new Promise((r) => setTimeout(r, 120));
  }
  mkdirSync(resolve(DATA_DIR, "seed/openalex"), { recursive: true });
  writeFileSync(DEST, JSON.stringify({ generatedBy: "scripts/sync-openalex.ts", source: "OpenAlex works search", records }, null, 1));
  console.log(`\nwrote ${records.length} lore records → ${DEST}`);
}

main().catch((e) => {
  console.error(`sync-openalex failed: ${e.message}\nWithout lore.json every Form shows "Lore unread"; nothing else changes.`);
  process.exit(1);
});
