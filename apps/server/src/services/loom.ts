import { ESSENCE_IDS, type EssenceId } from "@ender/shared";
import { PARTY, affinitiesOf, boardRadius, capacityForRank, compileLoom, hexDist, keystoneEligible, type Affinity, type LoomNode, type Role, type RootId } from "@ender/battle";
import { productionRecipe } from "@ender/economy";
import { all, now, run, tx } from "../db";
import type { Ctx } from "./context";
import { HttpError, charRow, essences, itemQty, addItem } from "./character";
import { ruleFantasyName } from "@ender/inference";
import { artifactView, createArtifact, makeReadings, formAffinities, getArtifact, loomScore, trueQualities, type ArtifactRow } from "./artifacts";

export const ROLES: Role[] = ["action", "modifier", "reaction", "keystone"];
/** Cells a node may occupy: the radius-2 board minus the Root. Cells beyond the Rank's radius are accepted but compile dormant. */
export const MAX_RADIUS = 2;

const isLive = (a: ArtifactRow) => a.status === "held" || a.status === "equipped";

/** A Form as a Loom node, exactly the @ender/battle shape (q/r omitted for the unplaced pool). */
export function loomNodeOf(ctx: Ctx, a: ArtifactRow): Omit<LoomNode, "q" | "r"> {
  return {
    id: a.id,
    formId: a.id,
    name: a.fantasy_name ?? "Veiled Form",
    role: a.inscribed_role!,
    affinities: formAffinities(ctx, a)!,
    technicalScore: loomScore(ctx, a) ?? 0,
    evidence: a.evidence_tier,
  };
}

type SlotRow = { root: RootId; artifact_id: string; q: number; r: number };

export function heroNodes(ctx: Ctx, charId: string, root: RootId): LoomNode[] {
  return all<SlotRow>(ctx.db, "SELECT root, artifact_id, q, r FROM loom_nodes WHERE character_id = ? AND root = ? ORDER BY q, r", charId, root).map((s) => ({
    ...loomNodeOf(ctx, getArtifact(ctx, s.artifact_id)),
    q: s.q,
    r: s.r,
  }));
}

/** The three heroes' Looms as plain node lists: what a run snapshots when leaving a Shrine (§80). */
export function loomSnapshot(ctx: Ctx, charId: string) {
  const rank = charRow(ctx, charId).level;
  return { rank, heroes: Object.fromEntries(PARTY.map((root) => [root, heroNodes(ctx, charId, root)])) as Record<RootId, LoomNode[]> };
}
export type LoomSnapshot = ReturnType<typeof loomSnapshot>;

export function loomView(ctx: Ctx, charId: string) {
  const rank = charRow(ctx, charId).level;
  const heroes = Object.fromEntries(
    PARTY.map((root) => {
      const nodes = heroNodes(ctx, charId, root);
      return [root, { nodes, compiled: compileLoom(nodes, rank) }];
    }),
  ) as Record<RootId, { nodes: LoomNode[]; compiled: ReturnType<typeof compileLoom> }>;
  const pool = all<ArtifactRow>(
    ctx.db,
    "SELECT a.* FROM artifacts a LEFT JOIN loom_nodes l ON l.artifact_id = a.id WHERE a.character_id = ? AND a.status IN ('held','equipped') AND a.inscribed_role IS NOT NULL AND l.artifact_id IS NULL ORDER BY a.rowid",
    charId,
  ).map((a) => loomNodeOf(ctx, a));
  return { rank, capacity: capacityForRank(rank), radius: boardRadius(rank), heroes, pool };
}

/**
 * Replace one hero's layout. Editing is only meant to happen at a Shrine or in the hub between expeditions (§79);
 * that lock is enforced client-side (Ender default) — combat always uses the run's saved snapshot, so edits made
 * elsewhere cannot change a fight already in progress.
 */
export function setLoom(ctx: Ctx, charId: string, root: RootId, nodes: { artifactId: string; q: number; r: number }[]) {
  if (!PARTY.includes(root)) throw new HttpError(400, `unknown Root ${root}`);
  const cells = new Set<string>();
  const ids = new Set<string>();
  for (const n of nodes) {
    if (!Number.isInteger(n.q) || !Number.isInteger(n.r)) throw new HttpError(400, "cells must be integer axial coordinates");
    const d = hexDist(n.q, n.r);
    if (d === 0) throw new HttpError(400, "the centre cell is the Root");
    if (d > MAX_RADIUS) throw new HttpError(400, `cell ${n.q},${n.r} is off the board`);
    const cell = `${n.q},${n.r}`;
    if (cells.has(cell)) throw new HttpError(400, `cell ${cell} is used twice`);
    cells.add(cell);
    if (ids.has(n.artifactId)) throw new HttpError(400, `Form ${n.artifactId} is placed twice`);
    ids.add(n.artifactId);
    const a = getArtifact(ctx, n.artifactId, charId);
    if (!isLive(a)) throw new HttpError(400, `Form is ${a.status}`);
    if (!a.inscribed_role) throw new HttpError(400, "Inscribe a Form before placing it on the Loom");
  }
  tx(ctx.db, () => {
    run(ctx.db, "DELETE FROM loom_nodes WHERE character_id = ? AND root = ?", charId, root);
    // A Form lives on one hero only: placing it here lifts it from any other Loom.
    for (const id of ids) run(ctx.db, "DELETE FROM loom_nodes WHERE artifact_id = ?", id);
    for (const n of nodes) run(ctx.db, "INSERT INTO loom_nodes (character_id, root, artifact_id, q, r) VALUES (?, ?, ?, ?, ?)", charId, root, n.artifactId, n.q, n.r);
  });
  return loomView(ctx, charId);
}

/** Lift a Form off every Loom (sold, delivered, shattered). */
export const unplace = (ctx: Ctx, artifactId: string) => run(ctx.db, "DELETE FROM loom_nodes WHERE artifact_id = ?", artifactId);

/** Temper replaces the underlying Form but the Loom slot and inscribed role carry over to the child (§52). */
export function carryInscription(ctx: Ctx, parent: ArtifactRow, childId: string) {
  if (parent.inscribed_role) run(ctx.db, "UPDATE artifacts SET inscribed_role = ?, bound = 1 WHERE id = ?", parent.inscribed_role, childId);
  run(ctx.db, "UPDATE loom_nodes SET artifact_id = ? WHERE artifact_id = ?", childId, parent.id);
}

/**
 * INSCRIBE (§51): choose the Form's Loom role. The first weave is free; a change of role costs the production recipe in Essences
 * from inventory (never auto-bought). A placed Form stays placed.
 */
export function inscribe(ctx: Ctx, charId: string, artifactId: string, role: Role) {
  const a = getArtifact(ctx, artifactId, charId);
  if (!isLive(a)) throw new HttpError(400, `Form is ${a.status}`);
  if (a.evidence_tier === "veiled") throw new HttpError(400, "Attune a Form before Inscribing it");
  if (!ROLES.includes(role)) throw new HttpError(400, `unknown role ${role}`);
  if (role === "keystone" && !keystoneEligible(loomScore(ctx, a) ?? 0, a.evidence_tier))
    throw new HttpError(400, "only a Witnessed Form with technical score ≥ 80 can be a Keystone");
  if (a.inscribed_role === role) throw new HttpError(400, `already Inscribed as ${role}`);
  // The first weave is free, so a Form never sits unusable for want of Essences (Mark, 2026-10-02: the roles
  // all greyed out after a reveal). Changing a woven Form's role charges its recipe.
  const recipe = a.inscribed_role ? productionRecipe(trueQualities(ctx, a)).essenceCosts : {};
  const cost = ESSENCE_IDS.filter((e) => (recipe[e] ?? 0) > 0).map((e) => [e, recipe[e]!] as [EssenceId, number]);
  for (const [e, q] of cost) if (itemQty(ctx, charId, "essence", e) < q) throw new HttpError(400, `not enough ${e}`);
  return tx(ctx.db, () => {
    for (const [e, q] of cost) addItem(ctx, charId, "essence", e, -q);
    run(ctx.db, "UPDATE artifacts SET inscribed_role = ?, bound = 1 WHERE id = ?", role, a.id);
    run(
      ctx.db,
      "INSERT INTO artifact_revisions (artifact_id, revision, evidence_tier, note, created_at) VALUES (?, ?, ?, ?, ?)",
      a.id,
      a.revision,
      a.evidence_tier,
      a.inscribed_role ? `re-inscribed ${a.inscribed_role} → ${role}` : `inscribed as ${role}`,
      now(),
    );
    return { artifact: artifactView(ctx, getArtifact(ctx, a.id)), essences: essences(ctx, charId), spent: Object.fromEntries(cost) };
  });
}

/**
 * A new party starts with a small woven Loom so the first fight already shows what crafted nodes do (Ender default):
 * per hero one Attuned Action on the first ring and one Modifier beside it, drawn deterministically from the corpus.
 */
const STARTER: Record<RootId, { action: Affinity; modifier: Affinity }> = {
  iron: { action: "burden", modifier: "knots" },
  bond: { action: "bond", modifier: "bond" },
  quick: { action: "flex", modifier: "flex" },
};
export function grantStarterKit(ctx: Ctx, charId: string) {
  const corpus = [...ctx.reality.all()].sort((a, b) => a.id.localeCompare(b.id));
  const used = new Set<string>();
  const pick = (dominant: Affinity, mid: boolean) => {
    const pool = corpus.filter((c) => !used.has(c.id) && affinitiesOf(c.qualities as Record<Affinity, number>)[0] === dominant);
    const c = pool[mid ? Math.floor(pool.length / 2) : Math.floor(pool.length / 3)] ?? corpus.find((x) => !used.has(x.id))!;
    used.add(c.id);
    return c;
  };
  tx(ctx.db, () => {
    for (const root of PARTY) {
      const cells: [Role, Affinity, number, number][] = [
        ["action", STARTER[root].action, 1, 0],
        ["modifier", STARTER[root].modifier, 1, -1],
      ];
      for (const [role, aff, q, r] of cells) {
        const c = pick(aff, role === "action");
        const a = createArtifact(ctx, charId, { realityId: c.id, realmId: "ashen-vault", origin: "seed", tier: "attuned", acquisitionCost: 0 });
        const readings = makeReadings(ctx, a, 1);
        const named = ruleFantasyName(c.id, readings.qualities);
        run(ctx.db, "UPDATE artifacts SET readings = ?, fantasy_name = ?, epithet = ?, revealed = '[]', inscribed_role = ?, bound = 1 WHERE id = ?", JSON.stringify(readings), named.fantasyName, named.epithet, role, a.id);
        run(ctx.db, "INSERT INTO loom_nodes (character_id, root, artifact_id, q, r) VALUES (?, ?, ?, ?, ?)", charId, root, a.id, q, r);
      }
    }
  });
}
