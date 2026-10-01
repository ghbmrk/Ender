import type { QualityKey } from "@ender/shared";

/**
 * Ender's reactive turn-based combat and the Loom, as numbers. Everything here follows the "Crafted Skill Tree +
 * Reactive Turn-Based Mobile Combat" spec; where the spec is silent the choice is marked "(Ender default)".
 */

export type Affinity = QualityKey; // burden | veil | reach | knots | flex | bond
export const AFFINITIES: Affinity[] = ["burden", "veil", "reach", "knots", "flex", "bond"];
export const AFFINITY_NAMES: Record<Affinity, string> = { burden: "Burden", veil: "Veil", reach: "Reach", knots: "Knots", flex: "Flex", bond: "Bond" };

export type Grade = "perfect" | "good" | "miss";
export type Defense = "perfect-parry" | "parry" | "perfect-dodge" | "dodge" | "hit";
export const isParry = (d: Defense) => d === "parry" || d === "perfect-parry";
export const isDodge = (d: Defense) => d === "dodge" || d === "perfect-dodge";

// ───────────────────────── Roots (§5) ─────────────────────────

export type RootId = "iron" | "quick" | "bond";
export type RootDef = { id: RootId; name: string; hero: string; hp: number; speed: number; basic: number; basicAp: number; intrinsic: string };
export const ROOTS: Record<RootId, RootDef> = {
  iron: { id: "iron", name: "Iron Root", hero: "warden", hp: 120, speed: 90, basic: 40, basicAp: 2, intrinsic: "+20% Break dealt by successful Parries" },
  quick: { id: "quick", name: "Quick Root", hero: "ranger", hp: 100, speed: 110, basic: 35, basicAp: 2, intrinsic: "Perfect timed attacks reduce next-turn initiative delay by 10%" },
  bond: { id: "bond", name: "Bond Root", hero: "binder", hp: 105, speed: 100, basic: 32, basicAp: 2, intrinsic: "Successful Parry gives 1 AP to the party member with the least AP" },
};
export const PARTY: RootId[] = ["iron", "bond", "quick"];

// ───────────────────────── Loom (§6–13) ─────────────────────────

export type Role = "action" | "modifier" | "reaction" | "keystone";
export const CAPACITY_COST: Record<Role, number> = { action: 3, modifier: 1, reaction: 2, keystone: 3 };
export const ROLE_LIMIT: Partial<Record<Role, number>> = { action: 4, reaction: 2, keystone: 1 };
const CAPACITY_BY_RANK: [number, number][] = [
  [20, 16], [19, 15], [17, 14], [15, 13], [13, 12], [11, 11], [9, 10], [7, 9], [5, 8], [3, 7], [1, 6],
];
export const capacityForRank = (rank: number) => CAPACITY_BY_RANK.find(([r]) => rank >= r)?.[1] ?? 6;
export const boardRadius = (rank: number) => (rank >= 8 ? 2 : 1);
export const EVIDENCE_BONUS = { veiled: 0, attuned: 0, trialed: 0.05, witnessed: 0.1 } as const;
export type Evidence = keyof typeof EVIDENCE_BONUS;
/** §24 */
export const nodePotency = (technicalScore: number, evidence: Evidence) => Math.round((0.8 + technicalScore * 0.004 + EVIDENCE_BONUS[evidence]) * 1000) / 1000;
/** §39 */
export const keystoneEligible = (technicalScore: number, evidence: Evidence) => evidence === "witnessed" && technicalScore >= 80;

/** §7 and §14: the two strongest qualities, ties broken by the fixed quality order. */
export function affinitiesOf(q: Record<Affinity, number>): [Affinity, Affinity] {
  const s = [...AFFINITIES].sort((a, b) => q[b] - q[a] || AFFINITIES.indexOf(a) - AFFINITIES.indexOf(b));
  return [s[0]!, s[1]!];
}

// ───────────────────────── Actions (§16–23) ─────────────────────────

export type ActionTemplate = "crush" | "mark" | "lance" | "pattern" | "flurry" | "link";
export type TemplateDef = {
  id: ActionTemplate;
  name: string;
  affinity: Affinity;
  ap: number;
  /** Damage per hit as a multiple of the character's Basic damage. */
  potency: number;
  hits: number;
  /** Break per hit. The spec gives Crush's 32; the others are Ender defaults. */
  breakPer: number;
  /** Timed presses in ms after the command starts; empty for weak-point Actions. */
  beats: number[];
  desc: string;
};
export const TEMPLATES: Record<ActionTemplate, TemplateDef> = {
  crush: { id: "crush", name: "Crush", affinity: "burden", ap: 3, potency: 1.25, hits: 1, breakPer: 32, beats: [650], desc: "One heavy blow. Big Break." },
  mark: { id: "mark", name: "Mark", affinity: "veil", ap: 2, potency: 0.75, hits: 1, breakPer: 8, beats: [600], desc: "Marks the target: its next 3 damaging hits take +12% (4 on a Perfect)." },
  lance: { id: "lance", name: "Lance", affinity: "reach", ap: 2, potency: 1.0, hits: 1, breakPer: 10, beats: [], desc: "Tap a weak point within 0.9 s for ×1.40 damage and +10 Break." },
  pattern: { id: "pattern", name: "Pattern", affinity: "knots", ap: 3, potency: 0.55, hits: 2, breakPer: 10, beats: [550, 900], desc: "Two hits; the second +50% if the target has a condition. Two Perfects store a Pattern stack; at 3 the next Pattern is free." },
  flurry: { id: "flurry", name: "Flurry", affinity: "flex", ap: 2, potency: 0.38, hits: 3, breakPer: 6, beats: [500, 720, 940], desc: "Three quick hits; each Perfect +15%. Three Perfects refund 1 AP." },
  link: { id: "link", name: "Link", affinity: "bond", ap: 2, potency: 0.65, hits: 1, breakPer: 8, beats: [650], desc: "Choose an ally: their next Action gets +20% potency (+1 AP on a Perfect)." },
};
export const templateFor = (a: Affinity): ActionTemplate => (Object.values(TEMPLATES).find((t) => t.affinity === a) as TemplateDef).id;

export const RIDER_TEXT: Record<Affinity, string> = {
  burden: "+15 Break, +1 AP cost",
  veil: "+15% crit chance against debuffed targets",
  reach: "Weak-point targeting (+15% bonus if already a weak-point Action)",
  knots: "+20% potency when a condition is satisfied",
  flex: "Perfect command: next-turn initiative delay −8%",
  bond: "Successful use gives the lowest-AP ally +1 AP (once per turn)",
};
export const MODIFIER_TEXT: Record<Affinity, { action: string; reaction: string }> = {
  burden: { action: "+18% Break, −8% damage", reaction: "Success grants a Barrier of 6% max HP" },
  veil: { action: "+10% crit chance against debuffed enemies", reaction: "Success Marks the attacker for 1 hit" },
  reach: { action: "+20% weak-point multiplier (multi-target: +1 target)", reaction: "Counterattacks may hit any enemy" },
  knots: { action: "+15% potency per satisfied condition (max +30%)", reaction: "A full defensive sequence stores 1 Pattern stack" },
  flex: { action: "Perfect command: initiative delay −10%", reaction: "Perfect Parry: 20% chance to act one place sooner" },
  bond: { action: "25% of AP generated also goes to the lowest-AP ally", reaction: "Success heals the lowest-health ally 4% max HP" },
};

// ───────────────────────── Reactions (§32–38) ─────────────────────────

export type ReactionTrigger = "perfect-parry" | "dodge" | "full-parry" | "perfect-dodge" | "parry";
export const REACTIONS: Record<Affinity, { name: string; trigger: ReactionTrigger; desc: string }> = {
  burden: { name: "Iron Ward", trigger: "perfect-parry", desc: "Perfect Parry: Barrier of 10% max HP" },
  veil: { name: "Veiled Riposte", trigger: "perfect-parry", desc: "Perfect Parry: Mark the attacker for 2 hits" },
  reach: { name: "Far Sight", trigger: "dodge", desc: "Successful Dodge: next single-target Action reveals weak points for +300 ms" },
  knots: { name: "Knotted Guard", trigger: "full-parry", desc: "Parry every hit: +1 Pattern; at 3 the next Action costs 2 less AP" },
  flex: { name: "Quickstep", trigger: "perfect-dodge", desc: "Perfect Dodge: next-turn initiative delay −15%" },
  bond: { name: "Shared Thread", trigger: "parry", desc: "Successful Parry: lowest-AP ally +1 AP; Perfect also heals them 3% max HP" },
};

// ───────────────────────── Keystones (§39–45) ─────────────────────────

export const KEYSTONES: Record<Affinity, { name: string; desc: string }> = {
  burden: { name: "Heavy Weave", desc: "All Actions +1 AP, +25% potency, +25% Break" },
  veil: { name: "Hidden Edge", desc: "Crits deal no extra damage; they Mark for 2 hits instead. Marked bonus becomes +20%" },
  reach: { name: "Far Thread", desc: "All single-target Actions get weak points (+25%); Reach Actions +20% more" },
  knots: { name: "Living Pattern", desc: "Every third different Action costs 0 AP" },
  flex: { name: "Quickened Loom", desc: "Perfect attacks and Perfect Parries: initiative delay −8% (max 24%)" },
  bond: { name: "One Thread", desc: "When this character gains AP, an ally with ≤2 AP gains 1 (once per party action)" },
};

// ───────────────────────── Combat rules (§61–72) ─────────────────────────

export const RULES = {
  apMax: 9,
  apStart: 3,
  apPerTurn: 1,
  timing: { perfect: 70, good: 150 },
  gradeMult: { perfect: 1.25, good: 1, miss: 0.8 } as Record<Grade, number>,
  flurryPerfect: 1.15,
  /**
   * Defence windows, ms relative to impact [early, late] (Mark, 2026-10-01): Dodge is the wide, forgiving one and
   * only avoids the hit. Parry has one tight window: inside it the hit is blocked and answered with a counter;
   * outside it the Parry does nothing and the full hit lands.
   */
  dodge: [-260, 100] as const,
  parry: [-70, 60] as const,
  perfectParry: [-70, 60] as const,
  /** (Ender default) A Perfect Dodge uses the Parry window. */
  perfectDodge: [-120, 90] as const,
  parryAp: 1,
  parryBreak: 10,
  counterPotency: 0.65,
  weakPointMs: 900,
  weakPointMult: 1.4,
  weakPointBreak: 10,
  markBonus: 0.12,
  hiddenEdgeMarkBonus: 0.2,
  markHits: 3,
  brokenTakenMult: 1.25,
  critChance: 0.05,
  critMult: 1.5,
  /** (Ender default) Basic attack Break. */
  basicBreak: 8,
  slow: 0.2,
  fractureBreakMult: 1.2,
  statusRounds: 2,
  burnPct: 0.08,
  poisonMaxHpPct: 0.05,
  dotRounds: 3,
  /** (Ender default) initiative bonuses stack to at most this. */
  initiativeCap: 0.4,
  reviveFraction: 0.25,
  restFraction: 0.2,
  /** Health a hero mends between the duels of one fight. */
  duelBreath: 0.12,
};
export type StatusId = "marked" | "slow" | "fracture" | "burn" | "poison";
export const STATUS_NAMES: Record<StatusId, string> = { marked: "Marked", slow: "Slow", fracture: "Fracture", burn: "Burn", poison: "Poison" };

export const WEAKPOINT_MIN_PX = 72;
