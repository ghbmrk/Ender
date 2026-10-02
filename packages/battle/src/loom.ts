import {
  CAPACITY_COST,
  KEYSTONES,
  MODIFIER_TEXT,
  MODIFIER_WORD,
  REACTIONS,
  RIDER_TEXT,
  ROLE_LIMIT,
  TEMPLATES,
  boardRadius,
  capacityForRank,
  keystoneEligible,
  nodePotency,
  templateFor,
  type Affinity,
  type ActionTemplate,
  type Evidence,
  type ReactionTrigger,
  type Role,
} from "./defs";

/** A crafted Form placed on a character's Loom (§82). */
export type LoomNode = {
  id: string;
  formId: string;
  name: string;
  role: Role;
  q: number;
  r: number;
  affinities: [Affinity, Affinity];
  technicalScore: number;
  evidence: Evidence;
};

export type Dormancy = "locked cell" | "occupied" | "disconnected" | "over capacity" | "role limit" | "keystone not eligible";

export type CompiledAction = {
  nodeId: string;
  formName: string;
  template: ActionTemplate;
  name: string;
  dominant: Affinity;
  rider: Affinity;
  nodePotency: number;
  /** Adjacent Modifiers' dominant Affinities (with their potencies). */
  modifiers: { affinity: Affinity; potency: number }[];
  apCost: number;
  hits: number;
  /** Per-hit damage as a % of Basic damage, before timing (display). */
  damagePct: number;
  /** Total Break at Good timing (display). */
  breakTotal: number;
  weakPoint: boolean;
  weakPointMult: number;
  beats: number[];
  summary: string[];
};

export type CompiledReaction = {
  nodeId: string;
  formName: string;
  name: string;
  affinity: Affinity;
  trigger: ReactionTrigger;
  nodePotency: number;
  modifiers: { affinity: Affinity; potency: number }[];
  /** False when a stronger Reaction with the same trigger is connected. */
  executes: boolean;
  summary: string[];
};

export type CompiledKeystone = { nodeId: string; formName: string; affinity: Affinity; name: string; nodePotency: number; desc: string };

export type CompiledLoom = {
  rank: number;
  capacity: number;
  usedCapacity: number;
  radius: number;
  actions: CompiledAction[];
  reactions: CompiledReaction[];
  keystone?: CompiledKeystone;
  activeNodeIds: string[];
  dormantNodeIds: string[];
  dormancy: Record<string, Dormancy>;
  /** BFS distance from the Root for active nodes. */
  distance: Record<string, number>;
  /** Painted links between adjacent connected cells, coloured by the shared Affinity ("root" for Root links). */
  links: { a: string; b: string; affinity: Affinity | "root" }[];
};

export const HEX_DIRS: [number, number][] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];
export const hexDist = (q: number, r: number) => (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
export const adjacent = (a: { q: number; r: number }, b: { q: number; r: number }) => hexDist(a.q - b.q, a.r - b.r) === 1;
export const sharedAffinity = (a: LoomNode, b: LoomNode): Affinity | null => a.affinities.find((x) => b.affinities.includes(x)) ?? null;

/** All cells of the radius-2 board except the Root, in a fixed order. */
export function boardCells(radius = 2): { q: number; r: number }[] {
  const out: { q: number; r: number }[] = [];
  for (let q = -radius; q <= radius; q++) for (let r = -radius; r <= radius; r++) if (hexDist(q, r) <= radius && !(q === 0 && r === 0)) out.push({ q, r });
  return out;
}

/** §84 priority: closest to the Root wins, then lower q, then lower r. */
const byPriority = (dist: Record<string, number>) => (a: LoomNode, b: LoomNode) => (dist[a.id] ?? 99) - (dist[b.id] ?? 99) || a.q - b.q || a.r - b.r;

function reach(nodes: LoomNode[]): Record<string, number> {
  const dist: Record<string, number> = {};
  const queue: LoomNode[] = [];
  for (const n of nodes)
    if (hexDist(n.q, n.r) === 1) {
      dist[n.id] = 1;
      queue.push(n);
    }
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of nodes) {
      if (dist[n.id] !== undefined || !adjacent(cur, n) || !sharedAffinity(cur, n)) continue;
      dist[n.id] = dist[cur.id]! + 1;
      queue.push(n);
    }
  }
  return dist;
}

/**
 * Compile a Loom into a combat kit (§84), deterministically:
 * reachability from the Root → Capacity (farthest first) → role limits → Modifier adjacency → Actions → Reactions → Keystone.
 * Removing a node can cut others off, so the first three steps repeat until nothing changes.
 */
export function compileLoom(all: LoomNode[], rank: number): CompiledLoom {
  const capacity = capacityForRank(rank);
  const radius = boardRadius(rank);
  const dormancy: Record<string, Dormancy> = {};
  const sorted = [...all].sort((a, b) => a.q - b.q || a.r - b.r || a.id.localeCompare(b.id));
  const seen = new Set<string>();
  let live: LoomNode[] = [];
  for (const n of sorted) {
    const cell = `${n.q},${n.r}`;
    if (hexDist(n.q, n.r) > radius || hexDist(n.q, n.r) === 0) dormancy[n.id] = "locked cell";
    else if (seen.has(cell)) dormancy[n.id] = "occupied";
    else if (n.role === "keystone" && !keystoneEligible(n.technicalScore, n.evidence)) dormancy[n.id] = "keystone not eligible";
    else live.push(n);
    seen.add(cell);
  }

  let dist: Record<string, number> = {};
  for (let guard = 0; guard < 64; guard++) {
    dist = reach(live);
    const cut = live.filter((n) => dist[n.id] === undefined);
    for (const n of cut) dormancy[n.id] = "disconnected";
    live = live.filter((n) => dist[n.id] !== undefined);
    const used = live.reduce((s, n) => s + CAPACITY_COST[n.role], 0);
    if (used > capacity) {
      const drop = [...live].sort(byPriority(dist)).at(-1)!;
      dormancy[drop.id] = "over capacity";
      live = live.filter((n) => n !== drop);
      continue;
    }
    let changed = false;
    for (const [role, limit] of Object.entries(ROLE_LIMIT) as [Role, number][]) {
      const ofRole = live.filter((n) => n.role === role).sort(byPriority(dist));
      for (const n of ofRole.slice(limit)) {
        dormancy[n.id] = "role limit";
        changed = true;
      }
    }
    if (changed) {
      live = live.filter((n) => !dormancy[n.id]);
      continue;
    }
    break;
  }

  const links: CompiledLoom["links"] = [];
  for (const n of live) if (hexDist(n.q, n.r) === 1) links.push({ a: "root", b: n.id, affinity: "root" });
  for (let i = 0; i < live.length; i++)
    for (let j = i + 1; j < live.length; j++) {
      const s = adjacent(live[i]!, live[j]!) ? sharedAffinity(live[i]!, live[j]!) : null;
      if (s) links.push({ a: live[i]!.id, b: live[j]!.id, affinity: s });
    }

  const pot = (n: LoomNode) => nodePotency(n.technicalScore, n.evidence);
  const modsFor = (n: LoomNode) =>
    live.filter((m) => m.role === "modifier" && adjacent(m, n)).sort(byPriority(dist)).map((m) => ({ affinity: m.affinities[0], potency: pot(m) }));
  const keyNode = live.find((n) => n.role === "keystone");
  const keystone: CompiledKeystone | undefined = keyNode && {
    nodeId: keyNode.id,
    formName: keyNode.name,
    affinity: keyNode.affinities[0],
    name: KEYSTONES[keyNode.affinities[0]].name,
    nodePotency: pot(keyNode),
    desc: KEYSTONES[keyNode.affinities[0]].desc,
  };

  const actions = live
    .filter((n) => n.role === "action")
    .sort(byPriority(dist))
    .map((n) => compileAction(n, pot(n), modsFor(n), keystone?.affinity));
  const reactionsRaw = live
    .filter((n) => n.role === "reaction")
    .sort(byPriority(dist))
    .map<CompiledReaction>((n) => {
      const def = REACTIONS[n.affinities[0]];
      const mods = modsFor(n);
      return {
        nodeId: n.id,
        formName: n.name,
        name: def.name,
        affinity: n.affinities[0],
        trigger: def.trigger,
        nodePotency: pot(n),
        modifiers: mods,
        executes: true,
        summary: [def.desc, ...mods.map((m) => `${cap(m.affinity)} Modifier: ${MODIFIER_TEXT[m.affinity].reaction}`)],
      };
    });
  // §32: only the strongest connected Reaction of each trigger type executes.
  for (const r of reactionsRaw) {
    const best = reactionsRaw.filter((x) => x.trigger === r.trigger).sort((a, b) => b.nodePotency - a.nodePotency)[0]!;
    r.executes = best === r;
  }

  const activeNodeIds = live.map((n) => n.id);
  return {
    rank,
    capacity,
    radius,
    usedCapacity: live.reduce((s, n) => s + CAPACITY_COST[n.role], 0),
    actions,
    reactions: reactionsRaw,
    keystone,
    activeNodeIds,
    dormantNodeIds: all.map((n) => n.id).filter((id) => !activeNodeIds.includes(id)),
    dormancy,
    distance: dist,
    links,
  };
}

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** A skill is named by where it sits: the strongest touching Modifier lends its word ("Knotted Crush"). */
export function skillName(base: string, mods: { affinity: Affinity; potency: number }[]): string {
  const top = [...mods].sort((a, b) => b.potency - a.potency)[0];
  return top ? `${MODIFIER_WORD[top.affinity]} ${base}` : base;
}

function compileAction(n: LoomNode, potency: number, mods: { affinity: Affinity; potency: number }[], key?: Affinity): CompiledAction {
  const [dominant, rider] = n.affinities;
  const tpl = TEMPLATES[templateFor(dominant)];
  let ap = tpl.ap + (rider === "burden" ? 1 : 0) + (key === "burden" ? 1 : 0);
  let dmg = tpl.potency * potency;
  let brk = tpl.breakPer * tpl.hits * potency + (rider === "burden" ? 15 : 0);
  for (const m of mods) {
    if (m.affinity === "burden") {
      brk *= 1.18;
      dmg *= 0.92;
    }
  }
  if (key === "burden") {
    dmg *= 1.25;
    brk *= 1.25;
  }
  const lanceLike = tpl.id === "lance";
  const weakPoint = lanceLike || rider === "reach" || key === "reach";
  let wp = weakPoint ? 1.4 : 1;
  if (lanceLike && rider === "reach") wp += 0.15;
  if (weakPoint) for (const m of mods) if (m.affinity === "reach") wp += 0.2;
  if (key === "reach") wp += lanceLike ? 0.25 + 0.2 : 0.25;
  ap = Math.max(0, ap);
  return {
    nodeId: n.id,
    formName: n.name,
    template: tpl.id,
    name: skillName(tpl.name, mods),
    dominant,
    rider,
    nodePotency: potency,
    modifiers: mods,
    apCost: ap,
    hits: tpl.hits,
    damagePct: Math.round(dmg * 100),
    breakTotal: Math.round(brk),
    weakPoint,
    weakPointMult: Math.round(wp * 100) / 100,
    beats: tpl.beats,
    summary: [
      tpl.desc,
      `Rider (${cap(rider)}): ${RIDER_TEXT[rider]}`,
      ...mods.map((m) => `${cap(m.affinity)} Modifier: ${MODIFIER_TEXT[m.affinity].action}`),
      ...(key ? [`Keystone: ${KEYSTONES[key].name}`] : []),
    ],
  };
}

/** What changed between two compiles, for the Loom's live preview (§94). */
export function diffLooms(before: CompiledLoom, after: CompiledLoom): string[] {
  const out: string[] = [];
  const key = (a: CompiledAction) => a.nodeId;
  for (const a of after.actions) {
    const b = before.actions.find((x) => key(x) === key(a));
    if (!b) out.push(`+ ${a.name} (${a.apCost} AP)`);
    else {
      if (b.name !== a.name) out.push(`${b.name} → ${a.name}`);
      if (b.apCost !== a.apCost) out.push(`${a.name}: AP ${b.apCost} → ${a.apCost}`);
      if (b.breakTotal !== a.breakTotal) out.push(`${a.name}: Break ${b.breakTotal} → ${a.breakTotal}`);
      if (b.damagePct !== a.damagePct) out.push(`${a.name}: potency ${b.damagePct}% → ${a.damagePct}%`);
    }
  }
  for (const b of before.actions) if (!after.actions.some((a) => key(a) === key(b))) out.push(`− ${b.name}`);
  const rn = (l: CompiledLoom) => l.reactions.filter((r) => r.executes).map((r) => r.name);
  for (const r of rn(after)) if (!rn(before).includes(r)) out.push(`+ Reaction ${r}`);
  for (const r of rn(before)) if (!rn(after).includes(r)) out.push(`− Reaction ${r}`);
  if (before.keystone?.name !== after.keystone?.name) out.push(after.keystone ? `Keystone: ${after.keystone.name}` : `− Keystone ${before.keystone!.name}`);
  if (before.usedCapacity !== after.usedCapacity) out.push(`Capacity ${before.usedCapacity} → ${after.usedCapacity} / ${after.capacity}`);
  return out;
}
