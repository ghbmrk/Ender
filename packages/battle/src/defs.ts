import type { EnemyKind } from "@ender/content";

/**
 * Ender's turn-based combat data. Numbers here are the tuning surface: the engine (battle.ts) holds no magic numbers
 * beyond the rules themselves.
 *
 * Timing: every hero skill is a short sequence of timed presses ("beats", ms after the skill starts); every foe attack is
 * a sequence of hits (ms after the wind-up starts) that the player can dodge or parry.
 */

export type HeroId = "binder" | "warden" | "ranger";
export type FoeKind = EnemyKind | "king";
export type Grade = "perfect" | "good" | "miss";
export type Defense = "parry" | "dodge" | "hit";

export type SkillTarget = "foe" | "all-foes" | "ally" | "self";

export type Skill = {
  id: string;
  name: string;
  hero: HeroId;
  /** AP spent. Basic attacks cost 0 and give AP instead (apGain). */
  ap: number;
  apGain?: number;
  target: SkillTarget;
  /** When each timed press lands, in ms after the skill starts. */
  beats: number[];
  /** Damage per beat, as a multiple of the hero's attack. */
  power: number;
  /** Break (stagger) per beat. */
  breakPower: number;
  /** Healing per beat, as a multiple of the hero's attack. */
  heal?: number;
  /** Self: damage taken ×0.6 for this many of the hero's turns. */
  guard?: number;
  /** Self: foes must target this hero for this many of the hero's turns. */
  taunt?: number;
  /** Target takes +30% damage for this many of its turns. */
  mark?: number;
  desc: string;
};

export const SKILLS: Skill[] = [
  // The Binder: thread-mage. Damage, area, healing.
  { id: "bolt", name: "Thread Bolt", hero: "binder", ap: 0, apGain: 1, target: "foe", beats: [650], power: 1.0, breakPower: 8, desc: "A quick bolt. +1 AP (+2 on a perfect press)." },
  { id: "lash", name: "Thread Lash", hero: "binder", ap: 2, target: "foe", beats: [600, 900], power: 0.95, breakPower: 12, desc: "Two lashes of thread." },
  { id: "mend", name: "Mend", hero: "binder", ap: 2, target: "ally", beats: [700], power: 0, breakPower: 0, heal: 1.9, desc: "Knit an ally's wounds closed." },
  { id: "unravel", name: "Unravel", hero: "binder", ap: 4, target: "all-foes", beats: [600, 1050], power: 0.85, breakPower: 10, desc: "Pull every foe's threads at once." },
  { id: "sever", name: "Sever", hero: "binder", ap: 5, target: "foe", beats: [550, 850, 1300], power: 1.35, breakPower: 22, desc: "Three cuts; the last one lands late." },
  // The Warden: shield-knight. Break, protection.
  { id: "strike", name: "Strike", hero: "warden", ap: 0, apGain: 1, target: "foe", beats: [600], power: 0.9, breakPower: 12, desc: "A sword stroke. +1 AP (+2 on a perfect press)." },
  { id: "bash", name: "Shield Bash", hero: "warden", ap: 1, target: "foe", beats: [650], power: 0.7, breakPower: 30, desc: "Heavy break damage." },
  { id: "bulwark", name: "Bulwark", hero: "warden", ap: 2, target: "self", beats: [700], power: 0, breakPower: 0, guard: 2, taunt: 2, desc: "Draw every attack and take 40% less for two turns." },
  { id: "cleave", name: "Cleave", hero: "warden", ap: 3, target: "all-foes", beats: [600, 1000], power: 0.8, breakPower: 14, desc: "A wide sweep through every foe." },
  // The Ranger: archer. Precision, marks, volleys.
  { id: "arrow", name: "Arrow", hero: "ranger", ap: 0, apGain: 1, target: "foe", beats: [700], power: 1.05, breakPower: 6, desc: "A single arrow. +1 AP (+2 on a perfect press)." },
  { id: "mark", name: "Mark Prey", hero: "ranger", ap: 1, target: "foe", beats: [650], power: 0.5, breakPower: 4, mark: 3, desc: "The target takes 30% more damage for 3 turns." },
  { id: "twin", name: "Twin Shot", hero: "ranger", ap: 2, target: "foe", beats: [550, 800], power: 1.0, breakPower: 8, desc: "Two arrows in quick succession." },
  { id: "volley", name: "Volley", hero: "ranger", ap: 4, target: "all-foes", beats: [500, 750, 1000], power: 0.6, breakPower: 6, desc: "Rain arrows on every foe." },
];

export const skillById = (id: string) => {
  const s = SKILLS.find((x) => x.id === id);
  if (!s) throw new Error(`unknown skill ${id}`);
  return s;
};
export const skillsFor = (hero: HeroId) => SKILLS.filter((s) => s.hero === hero);

export type HeroDef = { id: HeroId; name: string; title: string; hp: number; atk: number; armor: number; speed: number; crit: number };

/** Companions scale from the Binder's stats (which come from equipped Forms and passives), so gear lifts the whole party. */
export const HEROES: Record<HeroId, HeroDef> = {
  binder: { id: "binder", name: "Binder", title: "Thread-mage", hp: 1, atk: 1, armor: 0, speed: 100, crit: 0 },
  warden: { id: "warden", name: "Warden", title: "Shield-knight", hp: 1.4, atk: 0.85, armor: 0.15, speed: 85, crit: -0.02 },
  ranger: { id: "ranger", name: "Ranger", title: "Archer", hp: 0.85, atk: 1.05, armor: 0, speed: 115, crit: 0.06 },
};
export const PARTY_ORDER: HeroId[] = ["warden", "binder", "ranger"];

export type FoeHit = { t: number; power: number };
export type FoeAttack = {
  id: string;
  name: string;
  /** What the wind-up looks like, shown as the attack's caption. */
  tell: string;
  target: "one" | "all";
  hits: FoeHit[];
  weight: number;
  /** Only chosen from this boss phase on. */
  minPhase?: number;
  /** Heals the most wounded ally instead of attacking (no hits). */
  healAlly?: number;
};

export type FoeDef = { kind: FoeKind; name: string; hp: number; atk: number; speed: number; armor: number; breakMax: number; attacks: FoeAttack[] };

const hits = (...xs: [number, number][]) => xs.map(([t, power]) => ({ t, power }));

/** Turn-based foes. hp/atk come from the shared enemy table (content/realms.ts) scaled for turns. */
export const FOES: Record<FoeKind, Omit<FoeDef, "hp" | "atk"> & { hpScale: number; atkScale: number }> = {
  husk: {
    kind: "husk", name: "Husk", hpScale: 1.5, atkScale: 1, speed: 80, armor: 0, breakMax: 40,
    attacks: [
      { id: "rake", name: "Rake", tell: "draws back its claws", target: "one", hits: hits([900, 0.6], [1250, 0.6]), weight: 3 },
      { id: "lurch", name: "Lurch", tell: "sways… and lurches", target: "one", hits: hits([1500, 1.1]), weight: 2 },
    ],
  },
  wisp: {
    kind: "wisp", name: "Wisp", hpScale: 1.5, atkScale: 1.1, speed: 105, armor: 0, breakMax: 30,
    attacks: [
      { id: "chill", name: "Chill Touch", tell: "reaches slowly…", target: "one", hits: hits([1700, 1.1]), weight: 3 },
      { id: "wail", name: "Wail", tell: "draws a rattling breath", target: "all", hits: hits([1100, 0.55]), weight: 2 },
    ],
  },
  hound: {
    kind: "hound", name: "Hound", hpScale: 1.5, atkScale: 1.1, speed: 125, armor: 0, breakMax: 35,
    attacks: [
      { id: "pounce", name: "Pounce", tell: "crouches low", target: "one", hits: hits([700, 1.1]), weight: 3 },
      { id: "savage", name: "Savage", tell: "snarls and circles", target: "one", hits: hits([850, 0.45], [1100, 0.45], [1350, 0.5]), weight: 2 },
    ],
  },
  keeper: {
    kind: "keeper", name: "Keeper", hpScale: 1.3, atkScale: 1, speed: 65, armor: 0.2, breakMax: 70,
    attacks: [
      { id: "slam", name: "Maul Slam", tell: "raises the maul high", target: "all", hits: hits([1800, 1.2]), weight: 2 },
      { id: "shove", name: "Shield Shove", tell: "sets its shield", target: "one", hits: hits([900, 0.8]), weight: 3 },
    ],
  },
  seer: {
    kind: "seer", name: "Seer", hpScale: 1.5, atkScale: 0.7, speed: 90, armor: 0, breakMax: 35,
    attacks: [
      { id: "hex", name: "Lantern Hex", tell: "lifts the lantern", target: "one", hits: hits([800, 0.5], [1150, 0.5], [1800, 0.65]), weight: 3 },
      { id: "kindle", name: "Kindle", tell: "whispers to the flame", target: "one", hits: [], weight: 2, healAlly: 1.6 },
    ],
  },
  swarm: {
    kind: "swarm", name: "Swarm", hpScale: 6, atkScale: 1.6, speed: 120, armor: 0, breakMax: 30,
    attacks: [
      { id: "sting", name: "Sting Storm", tell: "the wings rise as one", target: "one", hits: hits([900, 0.35], [1160, 0.35], [1420, 0.35], [1680, 0.4]), weight: 3 },
      { id: "scatter", name: "Scatter", tell: "the swarm splits apart", target: "all", hits: hits([1000, 0.5]), weight: 2 },
    ],
  },
  king: {
    kind: "king", name: "The Bound King", hpScale: 1, atkScale: 1, speed: 95, armor: 0, breakMax: 100,
    attacks: [
      { id: "pages", name: "Page Storm", tell: "pages tear loose and whirl", target: "one", hits: hits([800, 0.4], [1050, 0.4], [1450, 0.45], [1650, 0.45], [2150, 0.6]), weight: 3 },
      { id: "chains", name: "Chain Lash", tell: "the chains draw taut", target: "all", hits: hits([1100, 0.75], [1550, 0.75]), weight: 2, minPhase: 2 },
      { id: "judgement", name: "Crown's Judgement", tell: "the crown blazes", target: "one", hits: hits([2300, 2.0]), weight: 2, minPhase: 3 },
    ],
  },
};

/** Base damage of the King's hits (the shared enemy table has no King row). */
export const KING_ATK = 16;
/** The King's health is the run plan's figure scaled for turns. */
export const KING_HP_SCALE = 0.35;

export const RULES = {
  apStart: 2,
  apMax: 9,
  perfectApBonus: 1,
  parryAp: 1,
  gradeMult: { perfect: 1.5, good: 1, miss: 0.5 } as Record<Grade, number>,
  brokenTakenMult: 1.5,
  markTakenMult: 1.3,
  guardTakenMult: 0.6,
  counterPower: 1.4,
  counterBreak: 18,
  /** Ward (King): damage while up, ward loss per damage, damage while down. */
  wardUpMult: 0.6,
  wardLossPerDamage: 0.8,
  wardLossPerBreak: 0.5,
  wardRestore: 60,
  volatileBurst: { id: "burst", name: "Volatile Burst", tell: "its body splits with light", target: "all" as const, hits: hits([1000, 1.0]), weight: 0 },
  /** Between battles in a run. */
  reviveFraction: 0.25,
  restFraction: 0.2,
};

/** Timing windows in ms (half-widths). A "whiffed" defence locks the buttons briefly so mashing fails. */
export const WINDOWS = {
  attack: { perfect: 70, good: 160 },
  defense: { parry: 95, dodge: 190, whiffLockout: 450 },
};
export type Assist = "gentle" | "standard" | "exacting";
export const ASSIST_SCALE: Record<Assist, number> = { gentle: 1.6, standard: 1, exacting: 0.7 };
