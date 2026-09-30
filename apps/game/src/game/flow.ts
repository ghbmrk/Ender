import { PARTY, ROOTS, compileLoom, type BattleSetup, type FoeKind, type LoomNode, type RootId } from "@ender/battle";
import { api } from "../api";
import { getState, setState, toast, type MapNode } from "../state/store";
import type { BattleResult } from "../ui/battle/BattleScreen";

export async function refreshCharacter() {
  const character = await api.character();
  setState({ character });
  return character;
}

export async function refreshWorld() {
  const world = await api.world();
  setState({ world });
  return world;
}

export async function refreshLoom() {
  const loom = await api.loom();
  setState({ loom });
  return loom;
}

export async function newBinder(preset?: string) {
  await api.reset(preset ? { preset } : {});
  await Promise.all([refreshCharacter(), refreshWorld(), refreshLoom()]);
  setState({ screen: "crossing", panel: null, expedition: null, loomEditable: true });
  toast("Your party gathers at the Crossing. Weave a Loom, then take the Gate.", "info");
}

export async function continueGame() {
  await Promise.all([refreshCharacter(), refreshWorld(), refreshLoom()]);
  // Pick up an Expedition left mid-way.
  const active = await api.activeRun().catch(() => null);
  if (active?.plan && active.status === "active") {
    const visited = (active.visited ?? []) as string[];
    setState({ expedition: { plan: active.plan, visited, at: visited.at(-1) ?? null, partyHp: {}, loom: active.loom ?? null } });
  }
  setState({ screen: getState().expedition ? "map" : "crossing", panel: null, loomEditable: !getState().expedition });
}

/** The compiled Loom of each hero: the Expedition's saved snapshot when there is one, else the live Loom. */
export function compiledParty() {
  const snap = getState().expedition?.loom;
  const live = getState().loom;
  const rank = snap?.rank ?? live?.rank ?? 1;
  const nodesOf = (root: RootId) => (snap ? (snap.heroes?.[root] ?? []) : (live?.heroes?.[root]?.nodes ?? [])) as LoomNode[];
  return PARTY.map((root) => ({ root, loom: compileLoom(nodesOf(root), rank) }));
}

/** Leaving a Shrine locks the Loom again and saves the snapshot the party fights with. */
export async function leaveShrine() {
  const ex = getState().expedition;
  if (!ex) return;
  const out = await api.checkpoint(ex.plan.runId);
  setState({ expedition: { ...ex, loom: out.loom ?? ex.loom }, loomEditable: false, screen: "map" });
}

export async function startExpedition(realmId: string) {
  const out = await api.startRun(realmId);
  if (out.focusConverted) toast(`Unspent Focus became ${out.focusConverted} Crowns`, "gain");
  await Promise.all([refreshCharacter(), refreshLoom()]);
  setState({ expedition: { plan: out.plan, visited: [], at: null, partyHp: {}, loom: out.loom ?? null }, screen: "map", panel: null, loomEditable: false });
}

export function nodeById(id: string): MapNode | undefined {
  return getState().expedition?.plan.map.layers.flat().find((n) => n.id === id);
}

/** Nodes the party may step to next. */
export function reachable(): MapNode[] {
  const ex = getState().expedition;
  if (!ex) return [];
  const layers = ex.plan.map.layers;
  if (!ex.at) return layers[0] ?? [];
  const here = nodeById(ex.at);
  return (here?.links ?? []).map((id) => nodeById(id)!).filter(Boolean);
}

export async function stepTo(node: MapNode) {
  const ex = getState().expedition!;
  setState({ expedition: { ...ex, at: node.id, visited: [...ex.visited, node.id] } });
  if (node.encounter) {
    setState({ battle: { nodeId: node.id, kind: node.kind, waves: node.encounter.waves, difficulty: node.encounter.difficulty }, screen: "battle" });
    return;
  }
  const out = await api.runNode(ex.plan.runId, { nodeId: node.id, outcome: "skip" });
  await refreshCharacter();
  if (node.kind === "shrine") {
    toast("A Shrine: the Loom may be rewoven here.", "info");
    setState({ loomEditable: true, screen: "loom" });
  } else if (node.kind === "attunement") setState({ panel: "crucible", crucibleMode: "craft" });
  else if (node.kind === "bazaar" || node.kind === "contract") setState({ panel: "bazaar" });
  if (out?.rewards && hasRewards(out.rewards)) setState({ rewards: { ...out.rewards, title: out.title ?? "Found" }, panel: node.kind === "mystery" ? "rewards" : getState().panel });
  if (out?.encounter) setState({ battle: { nodeId: node.id, kind: "combat", waves: out.encounter.waves, difficulty: out.encounter.difficulty }, screen: "battle" });
}

const hasRewards = (r: any) => !!(r && (r.crowns || r.forms?.length || Object.keys(r.essences ?? {}).length || r.mirrorCharges));

export function battleSetup(): BattleSetup {
  const s = getState();
  const ex = s.expedition!;
  const b = s.battle!;
  return {
    seed: `${ex.plan.seed}|${b.nodeId}`,
    party: compiledParty().map((p) => ({ ...p, hp: ex.partyHp[p.root] })),
    waves: b.waves as FoeKind[][],
    difficulty: b.difficulty,
  };
}

export async function endBattle(r: BattleResult) {
  const s = getState();
  const ex = s.expedition!;
  const b = s.battle!;
  if (r.outcome === "defeat") {
    await api.runNode(ex.plan.runId, { nodeId: b.nodeId, outcome: "defeat", kills: r.kills }).catch(() => null);
    await finishExpedition("death");
    return;
  }
  const out = await api.runNode(ex.plan.runId, { nodeId: b.nodeId, outcome: "victory", kills: r.kills });
  const partyHp = r.partyHp;
  setState({ expedition: { ...ex, partyHp }, battle: null, screen: "map" });
  await refreshCharacter();
  if (b.kind === "boss") {
    setState({ rewards: { ...out.rewards, title: "The Boss falls" } });
    await finishExpedition("victory");
    return;
  }
  setState({ screen: "map", rewards: { ...out.rewards, title: b.kind === "elite" ? "Elite spoils" : "Spoils" }, panel: hasRewards(out.rewards) ? "rewards" : null });
}

export async function finishExpedition(outcome: "victory" | "death" | "abandon") {
  const ex = getState().expedition;
  if (!ex) return;
  const out = await api.completeRun(ex.plan.runId, { outcome });
  await Promise.all([refreshCharacter(), refreshWorld(), refreshLoom()]);
  setState({ runSummary: { ...out, outcome, realmId: ex.plan.realmId, rewards: getState().rewards }, panel: "summary", expedition: null, battle: null, screen: "crossing", loomEditable: true });
}

export function returnToCrossing() {
  setState({ screen: "crossing", panel: null, runSummary: null, loomEditable: true });
}

export const heroName = (root: RootId) => ROOTS[root].name;
