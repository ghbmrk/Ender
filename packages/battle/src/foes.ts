import type { StatusId } from "./defs";

/**
 * Six normal archetypes, two elites and two bosses (§96). Hits land at `t` ms after the wind-up starts; each hit is
 * defended on its own (§70).
 */
export type FoeHit = { t: number; power: number; status?: StatusId };
export type FoeAttack = {
  id: string;
  name: string;
  /** What the wind-up looks like (the attack's caption). */
  tell: string;
  target: "one" | "all";
  hits: FoeHit[];
  weight: number;
  minPhase?: number;
  /** Heals the most wounded ally by this fraction of its max HP instead of attacking. */
  healAlly?: number;
};
export type FoeKind = "husk" | "wisp" | "hound" | "keeper" | "seer" | "swarm" | "ironbound" | "cinder" | "king" | "wyrm";
export type FoeDef = {
  kind: FoeKind;
  /** Which painted figure to draw. */
  figure: string;
  name: string;
  hp: number;
  atk: number;
  speed: number;
  /** Multiplier on Break taken. */
  breakTaken: number;
  tier: "normal" | "elite" | "boss";
  attacks: FoeAttack[];
  /** Plays when it dies (volatile elites). */
  deathBurst?: FoeAttack;
  /** Boss phases: at these HP fractions, summon these. */
  phases?: { at: number; summon: FoeKind[] }[];
  blurb: string;
};

const h = (...xs: ([number, number] | [number, number, StatusId])[]) => xs.map(([t, power, status]) => ({ t, power, ...(status ? { status } : {}) }));

export const FOES: Record<FoeKind, FoeDef> = {
  husk: {
    kind: "husk", figure: "husk", name: "Husk", hp: 190, atk: 16, speed: 80, breakTaken: 1, tier: "normal", blurb: "Slow, heavy-handed. Its lurch comes late.",
    attacks: [
      { id: "rake", name: "Rake", tell: "draws back its claws", target: "one", hits: h([900, 0.7], [1250, 0.7]), weight: 3 },
      { id: "lurch", name: "Lurch", tell: "sways… then lurches", target: "one", hits: h([1500, 1.3]), weight: 2 },
    ],
  },
  wisp: {
    kind: "wisp", figure: "wisp", name: "Wisp", hp: 140, atk: 14, speed: 105, breakTaken: 1.1, tier: "normal", blurb: "Its touch is slow and chilling.",
    attacks: [
      { id: "chill", name: "Chill Touch", tell: "reaches out slowly…", target: "one", hits: h([1600, 1.3, "slow"]), weight: 3 },
      { id: "wail", name: "Wail", tell: "draws a rattling breath", target: "all", hits: h([1100, 0.6]), weight: 2 },
    ],
  },
  hound: {
    kind: "hound", figure: "hound", name: "Hound", hp: 160, atk: 15, speed: 120, breakTaken: 1, tier: "normal", blurb: "Fast. Its pounce comes early.",
    attacks: [
      { id: "pounce", name: "Pounce", tell: "crouches low", target: "one", hits: h([700, 1.2]), weight: 3 },
      { id: "savage", name: "Savage", tell: "snarls and circles", target: "one", hits: h([850, 0.55], [1050, 0.55], [1370, 0.6]), weight: 2 },
    ],
  },
  keeper: {
    kind: "keeper", figure: "keeper", name: "Keeper", hp: 420, atk: 22, speed: 65, breakTaken: 0.6, tier: "normal", blurb: "A wall of iron. Break it before it swings.",
    attacks: [
      { id: "slam", name: "Maul Slam", tell: "raises the maul high", target: "all", hits: h([1800, 1.1]), weight: 2 },
      { id: "shove", name: "Shield Shove", tell: "sets its shield", target: "one", hits: h([900, 0.9]), weight: 3 },
    ],
  },
  seer: {
    kind: "seer", figure: "seer", name: "Seer", hp: 170, atk: 13, speed: 90, breakTaken: 1.1, tier: "normal", blurb: "Hexes in an uneven rhythm; mends its allies.",
    attacks: [
      { id: "hex", name: "Lantern Hex", tell: "lifts the lantern", target: "one", hits: h([800, 0.6], [1150, 0.6], [1800, 0.7, "burn"]), weight: 3 },
      { id: "kindle", name: "Kindle", tell: "whispers to the flame", target: "one", hits: [], weight: 2, healAlly: 0.2 },
    ],
  },
  swarm: {
    kind: "swarm", figure: "swarm", name: "Swarm", hp: 200, atk: 10, speed: 115, breakTaken: 1.2, tier: "normal", blurb: "Many small stings in a steady beat.",
    attacks: [
      { id: "sting", name: "Sting Storm", tell: "the wings rise as one", target: "one", hits: h([900, 0.45], [1160, 0.45], [1420, 0.45], [1680, 0.5, "poison"]), weight: 3 },
      { id: "scatter", name: "Scatter", tell: "the swarm splits apart", target: "all", hits: h([1000, 0.7]), weight: 2 },
    ],
  },
  ironbound: {
    kind: "ironbound", figure: "keeper", name: "Ironbound Keeper", hp: 820, atk: 26, speed: 70, breakTaken: 0.4, tier: "elite", blurb: "Elite. Barely breaks; parries wear it down.",
    attacks: [
      { id: "slam", name: "Maul Slam", tell: "raises the maul high", target: "all", hits: h([1800, 1.1]), weight: 2 },
      { id: "double", name: "Twin Blow", tell: "hefts the maul twice", target: "one", hits: h([1000, 0.9], [1650, 1.1]), weight: 3 },
    ],
  },
  cinder: {
    kind: "cinder", figure: "hound", name: "Cinder Hound", hp: 380, atk: 18, speed: 125, breakTaken: 1, tier: "elite", blurb: "Elite. Bursts into flame when it dies.",
    attacks: [
      { id: "pounce", name: "Burning Pounce", tell: "crouches, smouldering", target: "one", hits: h([700, 1.2, "burn"]), weight: 3 },
      { id: "savage", name: "Savage", tell: "snarls and circles", target: "one", hits: h([850, 0.55], [1050, 0.55], [1370, 0.6]), weight: 2 },
    ],
    deathBurst: { id: "burst", name: "Cinder Burst", tell: "its body splits with fire", target: "all", hits: h([1000, 1.0, "burn"]), weight: 0 },
  },
  king: {
    kind: "king", figure: "king", name: "The Bound King", hp: 1900, atk: 20, speed: 95, breakTaken: 0.5, tier: "boss", blurb: "Boss. Summons help as his seals fall.",
    attacks: [
      { id: "pages", name: "Page Storm", tell: "pages tear loose and whirl", target: "one", hits: h([800, 0.4], [1050, 0.4], [1450, 0.45], [1650, 0.45], [2150, 0.6]), weight: 3 },
      { id: "chains", name: "Chain Lash", tell: "the chains draw taut", target: "all", hits: h([1100, 0.75], [1550, 0.75]), weight: 2, minPhase: 2 },
      { id: "judgement", name: "Crown's Judgement", tell: "the crown blazes", target: "one", hits: h([2300, 2.0, "burn"]), weight: 2, minPhase: 3 },
    ],
    phases: [
      { at: 0.66, summon: ["husk", "wisp"] },
      { at: 0.33, summon: ["hound", "seer"] },
    ],
  },
  wyrm: {
    kind: "wyrm", figure: "wyrm", name: "The Fen Wyrm", hp: 1700, atk: 21, speed: 100, breakTaken: 0.5, tier: "boss", blurb: "Boss. Sprays glass in long bursts; dives late.",
    attacks: [
      { id: "spray", name: "Glass Spray", tell: "its throat glows", target: "one", hits: h([700, 0.35], [900, 0.35], [1100, 0.35], [1300, 0.35], [1500, 0.45, "slow"]), weight: 3 },
      { id: "coil", name: "Coil Crush", tell: "coils tighten", target: "all", hits: h([1400, 1.0, "slow"]), weight: 2 },
      { id: "dive", name: "Tidal Dive", tell: "sinks beneath the water…", target: "one", hits: h([2100, 2.0]), weight: 2, minPhase: 2 },
    ],
    phases: [{ at: 0.5, summon: ["wisp", "wisp"] }],
  },
};
