import { PARTY, ROOTS, compileLoom, type BattleSetup, type FoeKind, type LoomNode, type RootId } from "@ender/battle";
import { api } from "../api";
import { getState, setState, toast, type MapNode } from "../state/store";
import { DUEL_ATK, DUEL_FIELD_CAP, DUEL_HP, heroFigure, partyRoots, saveHero } from "./hero";
import { lookFromSeed, newSeed, randomName } from "../art/look";
import type { BattleResult } from "../ui/battle/BattleScreen";
import { bests, noteRun } from "./records";

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

export async function newBinder(opts: { preset?: string; quiet?: boolean } = {}) {
  await api.reset(opts.preset ? { preset: opts.preset } : {});
  await Promise.all([refreshCharacter(), refreshWorld(), refreshLoom()]);
  if (opts.quiet) return;
  setState({ screen: "crossing", panel: null, expedition: null, loomEditable: true });
  toast("Welcome to the Crossing. Shape your skills on the Loom, then Set out.", "info", true);
}

export async function continueGame() {
  await Promise.all([refreshCharacter(), refreshWorld(), refreshLoom()]);
  // Pick up an Expedition left mid-way.
  const active = await api.activeRun().catch(() => null);
  if (active?.plan && active.status === "active") {
    const visited = (active.visited ?? []) as string[];
    setState({ expedition: { plan: active.plan, visited, at: visited.at(-1) ?? null, partyHp: {}, loom: active.loom ?? null } });
  }
  // Saves from before heroes were made get one, so every fight is still a duel.
  if (!getState().hero) {
    const hero = { root: "iron" as const, name: randomName(), look: lookFromSeed(newSeed()) };
    saveHero(hero);
  }
  // Home is the Realm choice (Mark, 22:28): the loop is Realm choice, a Realm, the Bazaar, then the Realm choice again.
  setState({ screen: getState().expedition ? "map" : "crossing", panel: getState().expedition ? null : "gate", loomEditable: !getState().expedition });
}

/** The compiled Loom of each hero: the Expedition's saved snapshot when there is one, else the live Loom. */
export function compiledParty() {
  const snap = getState().expedition?.loom;
  const live = getState().loom;
  const rank = snap?.rank ?? live?.rank ?? 1;
  const nodesOf = (root: RootId) => (snap ? (snap.heroes?.[root] ?? []) : (live?.heroes?.[root]?.nodes ?? [])) as LoomNode[];
  const hero = getState().hero;
  return partyRoots().map((root) => ({ root, loom: compileLoom(nodesOf(root), rank), ...(hero?.root === root ? { name: hero.name, figure: heroFigure(root) } : {}) }));
}

/** Leaving a Shrine locks the Loom again and saves the snapshot the party fights with. */
export async function leaveShrine() {
  const ex = getState().expedition;
  if (!ex) return;
  const out = await api.checkpoint(ex.plan.runId);
  setState({ expedition: { ...ex, loom: out.loom ?? ex.loom }, loomEditable: false, screen: "map" });
}

/** What the hero carried when the Expedition began, so the summary can show the haul. */
let runStart: { crowns: number; essences: Record<string, number> } | null = null;
let runForms = 0;
/** Count Forms as they drop during an Expedition. */
export const noteForms = (r: any) => void (runForms += r?.forms?.length ?? 0);

export async function startExpedition(realmId: string) {
  const out = await api.startRun(realmId);
  if (out.focusConverted) toast(`Unspent Focus became ${out.focusConverted} Crowns`, "gain");
  await Promise.all([refreshCharacter(), refreshLoom()]);
  const c = getState().character;
  runStart = { crowns: c?.crowns ?? 0, essences: { ...(c?.essences ?? {}) } };
  runForms = 0;
  setState({ expedition: { plan: out.plan, visited: [], at: null, partyHp: {}, loom: out.loom ?? null }, screen: "map", panel: null, loomEditable: false });
}

/** The Realm to go to next: the first one not yet cleared (a new player's is the easiest), else the last. */
export async function nextRealm(): Promise<string> {
  const world = getState().world ?? (await refreshWorld());
  const { bests } = await import("./records");
  const best = bests();
  const realms: { id: string }[] = world.realms;
  return (realms.find((r) => !best[r.id]?.cleared) ?? realms[realms.length - 1]!).id;
}

/** Set out: straight into the next Realm, no choosing. Choosing a different Realm is the Gate's job. */
export async function setOut() {
  await startExpedition(await nextRealm());
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

/** The share of max health a Shrine mends. */
const SHRINE_MEND = 1 / 3;

export async function stepTo(node: MapNode) {
  const ex = getState().expedition!;
  setState({ expedition: { ...ex, at: node.id, visited: [...ex.visited, node.id] } });
  if (node.encounter) {
    setState({ battle: { nodeId: node.id, kind: node.kind, waves: node.encounter.waves, difficulty: node.encounter.difficulty }, screen: "battle" });
    return;
  }
  const out = await api.runNode(ex.plan.runId, { nodeId: node.id, outcome: "skip" });
  noteForms(out?.rewards);
  await refreshCharacter();
  if (node.kind === "shrine") {
    // A Shrine is a rest: it mends a third of your health, so a hurt hero has a reason to route through one.
    const cur = getState().expedition!;
    const healed: Partial<Record<RootId, number>> = {};
    let gained = 0;
    for (const r of partyRoots()) {
      const max = ROOTS[r].hp;
      const hp = cur.partyHp[r] ?? max;
      healed[r] = Math.min(max, hp + Math.round(max * SHRINE_MEND));
      gained += healed[r]! - hp;
    }
    // The rest is its own moment on the map; from there you rework the Loom or move straight on.
    const root = partyRoots()[0]!;
    setState({ expedition: { ...cur, partyHp: { ...cur.partyHp, ...healed } }, loomEditable: true, rest: { gained, hp: healed[root]!, max: ROOTS[root].hp } });
  } else if (node.kind === "attunement") {
    // Crafting lives on the Loom: an Attunement says how many Forms are waiting, then opens it or lets you move on.
    const inv = await api.inventory().catch(() => null);
    const raw = (inv?.artifacts ?? []).filter((a: any) => a.status === "held" && !a.inscribedRole && !a.loom).length;
    const pool = (getState().loom?.pool ?? []).length;
    setState({ loomEditable: true, attune: { forms: raw + pool } });
  }
  else if (node.kind === "bazaar" || node.kind === "contract") setState({ panel: "bazaar", bazaarTab: node.kind === "contract" ? "contracts" : "market" });
  if (out?.rewards && hasRewards(out.rewards)) {
    const rewards = { ...out.rewards, title: out.title ?? "Found" };
    // A Mystery's cache tallies in the passing strip, like a fight's spoils: no panel to dismiss.
    setState(node.kind === "mystery" ? { rewards, spoils: { ...rewards, at: Date.now() } } : { rewards });
  }
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
    // Every fight is one foe, one on one (Mark, 20:42): an encounter saved with more keeps only its first.
    waves: [[(b.waves as FoeKind[][]).flat()[0] ?? "husk"]],
    difficulty: b.difficulty,
    fieldCap: DUEL_FIELD_CAP,
    foeScale: { hp: DUEL_HP[b.kind === "boss" ? "boss" : b.kind === "elite" ? "elite" : "normal"], atk: DUEL_ATK[b.kind === "boss" ? "boss" : b.kind === "elite" ? "elite" : "normal"] },
  };
}

export async function endBattle(r: BattleResult) {
  const s = getState();
  const ex = s.expedition!;
  const b = s.battle!;
  if (r.outcome === "defeat") {
    await api.runNode(ex.plan.runId, { nodeId: b.nodeId, outcome: "defeat", kills: r.kills }).catch(() => null);
    await finishExpedition("death", r.foe);
    return;
  }
  const out = await api.runNode(ex.plan.runId, { nodeId: b.nodeId, outcome: "victory", kills: r.kills });
  noteForms(out?.rewards);
  const partyHp = r.partyHp;
  setState({ expedition: { ...ex, partyHp }, battle: null, screen: "map" });
  await refreshCharacter();
  if (b.kind === "boss") {
    setState({ rewards: { ...out.rewards, title: "The Boss falls" } });
    await finishExpedition("victory");
    return;
  }
  const rewards = { ...out.rewards, title: b.kind === "elite" ? "Elite spoils" : "Spoils" };
  // Something to weave? Crafting follows the fight on one screen, with the spoils shown at its top.
  const [inv] = await Promise.all([api.inventory().catch(() => null), refreshLoom().catch(() => null)]);
  const raw = (inv?.artifacts ?? []).some((a: any) => a.status === "held" && !a.inscribedRole && !a.loom);
  const pool = (getState().loom as any)?.pool?.length > 0;
  if (raw || pool) {
    setState({ screen: "loom", loomEditable: true, afterFight: true, rewards, panel: null });
    return;
  }
  // No stop for the spoils: they tally in a strip over the map while the next stop lights up.
  setState({ screen: "map", rewards, panel: null, spoils: hasRewards(out.rewards) ? { ...rewards, at: Date.now() } : null });
}

export async function finishExpedition(outcome: "victory" | "death" | "abandon", fellTo?: BattleResult["foe"]) {
  const ex = getState().expedition;
  if (!ex) return;
  const out = await api.completeRun(ex.plan.runId, { outcome });
  await Promise.all([refreshCharacter(), refreshWorld(), refreshLoom()]);
  const c = getState().character;
  const essences: Record<string, number> = {};
  for (const [e, q] of Object.entries((c?.essences ?? {}) as Record<string, number>)) {
    const d = q - (runStart?.essences[e] ?? 0);
    if (d > 0) essences[e] = d;
  }
  const totals = out.totals ?? (runStart ? { crowns: Math.max(0, (c?.crowns ?? 0) - runStart.crowns), essences, forms: runForms } : undefined);
  const reached = { step: ex.visited.length, of: ex.plan.map.layers.length };
  const firstClear = outcome === "victory" && !bests()[ex.plan.realmId]?.cleared;
  const newBest = noteRun(ex.plan.realmId, { ...reached, cleared: outcome === "victory" });
  setState({ runSummary: { ...out, totals, outcome, reached, newBest, firstClear, boss: ex.plan.boss, fellTo, realmId: ex.plan.realmId, rewards: getState().rewards }, panel: "summary", expedition: null, battle: null, screen: "crossing", loomEditable: true });
}

/** After a run's summary: the Bazaar, to sell the haul, on the way back to the Realm choice. */
export function toBazaar() {
  setState({ screen: "crossing", panel: "bazaar", bazaarTab: "market", homeward: true, runSummary: null, loomEditable: true });
}

/** Home: the Realm choice, over the Crossing. */
export function toRealmChoice() {
  setState({ screen: "crossing", panel: "gate", homeward: false, runSummary: null, loomEditable: true });
}

export const heroName = (root: RootId) => ROOTS[root].name;
