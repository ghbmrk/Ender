"""
Offline bootstrap for the PubChem seed, used when pubchem.ncbi.nlm.nih.gov is
unreachable (e.g. a sandbox with a restrictive egress policy).

Source of identity data: the "chemical identifiers pubchem small.tsv" table
shipped in the `chemicals` PyPI package (ChEDL, v1.5.2), which is an extract
of PubChem records: CID, CAS, molecular formula, molecular weight, canonical
SMILES, InChI, names.

CID / formula / molecular weight are taken verbatim from that PubChem extract.
The remaining descriptors (logP, TPSA, complexity, H-bond donors/acceptors,
rotatable bonds) are NOT PubChem-computed values here: they are computed
locally by RDKit from the PubChem SMILES, and every record says so in
`descriptorSource`. Running `pnpm data:sync:pubchem` with network access
replaces them with PubChem's own XLogP3 / TPSA / Complexity / counts.

Usage:
  python3 -m pip install rdkit
  python3 scripts/bootstrap/pubchem_mirror_seed.py <path/to/chemical identifiers pubchem small.tsv>
"""
import json
import sys
from pathlib import Path

from rdkit import Chem, RDLogger
from rdkit.Chem import Crippen, Descriptors, GraphDescriptors, Lipinski, rdMolDescriptors
import rdkit

RDLogger.DisableLog("rdApp.*")

TARGET = 240
ALLOWED = set("CHNOSPFClBrI")


def eligible(row):
    cid, cas, formula, mw, smiles = row[:5]
    if not cid.isdigit() or "." in smiles or not smiles:
        return None
    try:
        mw = float(mw)
    except ValueError:
        return None
    if mw < 60 or mw > 650:
        return None
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    atoms = {a.GetSymbol() for a in mol.GetAtoms()}
    if "C" not in atoms or not atoms <= {"C", "H", "N", "O", "S", "P", "F", "Cl", "Br", "I"}:
        return None
    if mol.GetNumHeavyAtoms() < 4:
        return None
    name = row[9] if len(row) > 9 and row[9] else (row[8] if len(row) > 8 else "")
    return {
        "cid": cid,
        "formula": formula,
        "mw": mw,
        "smiles": smiles,
        "name": name,
        "mol": mol,
    }


def main():
    src = Path(sys.argv[1])
    rows = [l.rstrip("\n").split("\t") for l in src.read_text(encoding="utf-8").splitlines()]
    cands = [c for c in (eligible(r) for r in rows) if c]
    cands.sort(key=lambda c: int(c["cid"]))
    stride = len(cands) / TARGET
    picked = [cands[int(i * stride)] for i in range(TARGET)]
    out = []
    for c in picked:
        mol = c["mol"]
        out.append(
            {
                "source": "pubchem",
                "externalId": c["cid"],
                "molecularFormula": c["formula"],
                "molecularWeight": round(c["mw"], 3),
                "xlogp": round(Crippen.MolLogP(mol), 2),
                "tpsa": round(rdMolDescriptors.CalcTPSA(mol), 2),
                "complexity": round(GraphDescriptors.BertzCT(mol), 1),
                "hBondDonorCount": Lipinski.NumHDonors(mol),
                "hBondAcceptorCount": Lipinski.NumHAcceptors(mol),
                "rotatableBondCount": rdMolDescriptors.CalcNumRotatableBonds(mol),
                "title": c["name"],
                "smiles": c["smiles"],
                "descriptorSource": f"rdkit-{rdkit.__version__} (Crippen logP, Ertl TPSA, BertzCT) from PubChem SMILES",
                "identitySource": "PubChem extract in PyPI chemicals==1.5.2",
            }
        )
    dest = Path(__file__).resolve().parents[2] / "data/seed/pubchem/compounds.json"
    dest.write_text(json.dumps({"generatedBy": "scripts/bootstrap/pubchem_mirror_seed.py", "count": len(out), "compounds": out}, indent=1))
    print(f"wrote {len(out)} compounds from {len(cands)} eligible -> {dest}")


if __name__ == "__main__":
    main()
