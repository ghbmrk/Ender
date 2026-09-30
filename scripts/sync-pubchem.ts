/**
 * Refreshes data/seed/pubchem/compounds.json from PubChem PUG REST.
 *
 *   pnpm data:sync:pubchem                 # re-fetch the committed CID list
 *   pnpm data:sync:pubchem --cids 1-4000   # sample a CID range (stride to --target, default 240)
 *
 * Then run `pnpm data:build` to rebuild the candidate graph. The game never calls
 * PubChem at runtime; it only reads the committed seed.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DATA_DIR } from "./paths";

const PROPS = "MolecularFormula,MolecularWeight,XLogP,TPSA,Complexity,HBondDonorCount,HBondAcceptorCount,RotatableBondCount,Title,CanonicalSMILES";
const DEST = resolve(DATA_DIR, "seed/pubchem/compounds.json");
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const target = Number(arg("--target") ?? 240);
const ALLOWED = new Set(["C", "H", "N", "O", "S", "P", "F", "Cl", "Br", "I"]);

function requestedCids(): number[] {
  const range = arg("--cids");
  if (range) {
    const [a, b] = range.split("-").map(Number);
    return Array.from({ length: b! - a! + 1 }, (_, i) => a! + i);
  }
  if (!existsSync(DEST)) throw new Error("no committed seed; pass --cids <from-to>");
  return JSON.parse(readFileSync(DEST, "utf8")).compounds.map((c: { externalId: string }) => Number(c.externalId));
}

type Row = Record<string, string | number | undefined> & { CID: number };

async function fetchBatch(cids: number[]): Promise<Row[]> {
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/property/${PROPS}/JSON`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: `cid=${cids.join(",")}` });
    if (res.ok) return ((await res.json()) as { PropertyTable: { Properties: Row[] } }).PropertyTable.Properties;
    if (res.status !== 503 && res.status !== 429) throw new Error(`PubChem HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
  throw new Error("PubChem kept throttling; try again later");
}

function eligible(r: Row) {
  const mw = Number(r.MolecularWeight);
  const f = String(r.MolecularFormula ?? "");
  const atoms = new Set([...f.matchAll(/[A-Z][a-z]?/g)].map((m) => m[0]));
  return r.XLogP !== undefined && mw >= 60 && mw <= 650 && atoms.has("C") && [...atoms].every((a) => ALLOWED.has(a)) && !f.includes(".");
}

async function main() {
  const cids = requestedCids();
  const rows: Row[] = [];
  for (let i = 0; i < cids.length; i += 200) {
    rows.push(...(await fetchBatch(cids.slice(i, i + 200))));
    process.stdout.write(`\rfetched ${Math.min(i + 200, cids.length)}/${cids.length}`);
    await new Promise((r) => setTimeout(r, 250)); // PubChem asks for ≤5 requests/s
  }
  const ok = rows.filter(eligible);
  const stride = Math.max(1, ok.length / target);
  const picked = arg("--cids") ? Array.from({ length: Math.min(target, ok.length) }, (_, i) => ok[Math.floor(i * stride)]!) : ok;
  const compounds = picked.map((r) => ({
    source: "pubchem",
    externalId: String(r.CID),
    molecularFormula: r.MolecularFormula,
    molecularWeight: Number(r.MolecularWeight),
    xlogp: Number(r.XLogP),
    tpsa: Number(r.TPSA ?? 0),
    complexity: Number(r.Complexity ?? 0),
    hBondDonorCount: Number(r.HBondDonorCount ?? 0),
    hBondAcceptorCount: Number(r.HBondAcceptorCount ?? 0),
    rotatableBondCount: Number(r.RotatableBondCount ?? 0),
    title: r.Title,
    smiles: r.CanonicalSMILES ?? r.SMILES,
    descriptorSource: "PubChem PUG REST computed properties",
    identitySource: "PubChem PUG REST",
  }));
  writeFileSync(DEST, JSON.stringify({ generatedBy: "scripts/sync-pubchem.ts", fetchedAt: new Date().toISOString(), count: compounds.length, compounds }, null, 1));
  console.log(`\nwrote ${compounds.length} compounds → ${DEST}\nnext: pnpm data:build`);
}

main().catch((e) => {
  console.error(`sync-pubchem failed: ${e.message}\nThe committed seed is unchanged; the game keeps working offline.`);
  process.exit(1);
});
