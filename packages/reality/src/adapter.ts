import type { Candidate, EvidenceSummary, FormRealityData, RealmObjective } from "@weave/shared";
import { scoreObjective, qualityDistance } from "@weave/domain";
import type { CandidateGraph } from "./graph";

export type SearchContext = { depth?: 1 | 2; limit?: number };
export type Evaluation = ReturnType<typeof scoreObjective>;

/** Boundary between the game and any real-data domain. The game sees only candidates, qualities, objectives, evidence. */
export interface RealityDomainAdapter {
  readonly domain: string;
  getCandidate(id: string): Promise<Candidate>;
  getNeighbors(id: string, context: SearchContext): Promise<Candidate[]>;
  evaluate(id: string, objective: RealmObjective): Promise<Evaluation>;
  getEvidence(id: string): Promise<EvidenceSummary[]>;
}

export type LoreRecord = { externalId: string; worksCount: number; query: string; fetchedAt: string };

export const loreTier = (worksCount: number | undefined): EvidenceSummary => {
  if (worksCount === undefined) return { tier: "unsynced", label: "Lore unread" };
  if (worksCount === 0) return { tier: "none", label: "No recorded lore" };
  if (worksCount < 20) return { tier: "sparse", label: "Sparse lore" };
  if (worksCount < 500) return { tier: "known", label: "Known lore" };
  return { tier: "extensive", label: "Extensive lore" };
};

export class PubChemRealityAdapter implements RealityDomainAdapter {
  readonly domain = "pubchem";
  private byId = new Map<string, CandidateGraph["candidates"][number]>();
  private records = new Map<string, FormRealityData>();
  private lore = new Map<string, LoreRecord>();

  constructor(
    readonly graph: CandidateGraph,
    records: FormRealityData[],
    lore: LoreRecord[] = [],
  ) {
    for (const c of graph.candidates) this.byId.set(c.id, c);
    for (const r of records) this.records.set(r.externalId, r);
    for (const l of lore) this.lore.set(l.externalId, l);
  }

  all(): Candidate[] {
    return this.graph.candidates;
  }

  candidateSync(id: string): Candidate {
    const c = this.byId.get(id);
    if (!c) throw new Error(`unknown candidate ${id}`);
    return c;
  }

  record(id: string): FormRealityData | undefined {
    return this.records.get(id);
  }

  async getCandidate(id: string) {
    return this.candidateSync(id);
  }

  neighborsSync(id: string, ctx: SearchContext = {}): Candidate[] {
    const c = this.candidateSync(id);
    const seen = new Set<string>([id]);
    const out: Candidate[] = [];
    const push = (nid: string) => {
      if (seen.has(nid)) return;
      seen.add(nid);
      out.push(this.candidateSync(nid));
    };
    for (const n of c.neighbors) push(n);
    if (ctx.depth === 2) for (const n of c.neighbors.slice(0, 6)) for (const m of this.candidateSync(n).neighbors.slice(0, 6)) push(m);
    out.sort((a, b) => qualityDistance(c.qualities, a.qualities) - qualityDistance(c.qualities, b.qualities) || a.id.localeCompare(b.id));
    return ctx.limit ? out.slice(0, ctx.limit) : out;
  }

  async getNeighbors(id: string, ctx: SearchContext) {
    return this.neighborsSync(id, ctx);
  }

  async evaluate(id: string, objective: RealmObjective) {
    return scoreObjective(this.candidateSync(id).qualities, objective);
  }

  evidenceSync(id: string): EvidenceSummary[] {
    return [loreTier(this.lore.get(id)?.worksCount)];
  }

  async getEvidence(id: string) {
    return this.evidenceSync(id);
  }
}
