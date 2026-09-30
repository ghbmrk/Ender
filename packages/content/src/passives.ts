import type { SearchPolicy } from "@ender/shared";

export type PassiveEffects = {
  policy?: Partial<SearchPolicy>;
  /** Multiplier on Attune reading noise (lower = sharper readings). */
  readingNoise?: number;
  /** Extra qualities revealed on Veiled drops. */
  extraReveal?: number;
  /** Added tolerance for Mirror consistency. */
  mirrorTolerance?: number;
  /** Temper also searches neighbours-of-neighbours. */
  deepNeighborhood?: boolean;
  /** Temper Focus discount. */
  temperDiscount?: number;
  /** Multiplier on noise the Familiar sees when critiquing. */
  critiqueNoise?: number;
  /** Fracture names the second weakness too. */
  secondWeakness?: boolean;
  /** Multiplier on Ward damage vs. the Bound King. */
  wardDamage?: number;
  bonusFocus?: number;
  /** First N Attunes per Realm cost no Focus. */
  freeAttunes?: number;
  /** Multiplier on unused-Focus conversion to Crowns. */
  focusConversion?: number;
  /** Show historical price band in the Bazaar. */
  priceBand?: boolean;
  /** Extra production-cost weighting during candidate ranking. */
  costWeight?: number;
  /** Sell bonus for Forms avoiding the two scarcest Essences. */
  contrarianBonus?: number;
  /** Craft Mastery also credits score-per-Crown improvements. */
  valueSmith?: boolean;
  /** Reveal one mispriced Bazaar Form per refresh. */
  arbitrageReveal?: boolean;
  /** Bonus on selling a bought Form whose value rose ≥20%. */
  patronBonus?: number;
  damagePct?: number;
  healthFlat?: number;
  critChance?: number;
};

export type PassiveNode = {
  id: string;
  branch: BranchId;
  name: string;
  depth: number;
  requires?: string;
  description: string;
  effects: PassiveEffects;
};

export type BranchId = "sight" | "wildcraft" | "forge" | "ruin" | "efficiency" | "ledger";

export const BRANCHES: { id: BranchId; name: string; theme: string; color: string }[] = [
  { id: "sight", name: "Sight", theme: "Evidence and identification", color: "#7fe3e0" },
  { id: "wildcraft", name: "Wildcraft", theme: "Exploration and novelty", color: "#5fbf62" },
  { id: "forge", name: "Forge", theme: "Optimization", color: "#e8743b" },
  { id: "ruin", name: "Ruin", theme: "Critique and falsification", color: "#d64545" },
  { id: "efficiency", name: "Efficiency", theme: "Useful output per thought", color: "#d6c25b" },
  { id: "ledger", name: "Ledger", theme: "Economic optimization", color: "#b58cff" },
];

export const PASSIVES: PassiveNode[] = [
  { id: "keen-eye", branch: "sight", depth: 1, name: "Keen Eye", description: "Attuned readings are 40% sharper. +3% crit.", effects: { policy: { evidence: 0.15 }, readingNoise: 0.6, critChance: 0.03 } },
  { id: "cartographer", branch: "sight", depth: 2, requires: "keen-eye", name: "Cartographer", description: "Veiled Forms reveal one more quality.", effects: { policy: { evidence: 0.1 }, extraReveal: 1 } },
  { id: "deep-reading", branch: "sight", depth: 3, requires: "cartographer", name: "Deep Reading", description: "Mirror tolerates 2 more points of disagreement.", effects: { policy: { evidence: 0.2 }, mirrorTolerance: 2 } },

  { id: "wandering-hand", branch: "wildcraft", depth: 1, name: "Wandering Hand", description: "Search favours unfamiliar Forms. +5% damage.", effects: { policy: { exploration: 0.2 }, damagePct: 0.05 } },
  { id: "strange-paths", branch: "wildcraft", depth: 2, requires: "wandering-hand", name: "Strange Paths", description: "Temper searches neighbours of neighbours.", effects: { policy: { exploration: 0.15 }, deepNeighborhood: true } },
  { id: "unbound-search", branch: "wildcraft", depth: 3, requires: "strange-paths", name: "Unbound Search", description: "Exploration dominates the Familiar's search.", effects: { policy: { exploration: 0.25 } } },

  { id: "tempered-purpose", branch: "forge", depth: 1, name: "Tempered Purpose", description: "Search favours direct improvement. +5% damage.", effects: { policy: { optimization: 0.2 }, damagePct: 0.05 } },
  { id: "narrow-search", branch: "forge", depth: 2, requires: "tempered-purpose", name: "Narrow Search", description: "Sharper focus on the objective, less wandering.", effects: { policy: { optimization: 0.15, exploration: -0.1 } } },
  { id: "master-smith", branch: "forge", depth: 3, requires: "narrow-search", name: "Master Smith", description: "Temper costs 1 less Focus.", effects: { policy: { optimization: 0.25 }, temperDiscount: 1 } },

  { id: "doubt-everything", branch: "ruin", depth: 1, name: "Doubt Everything", description: "The Familiar critiques with half the noise.", effects: { policy: { critique: 0.2 }, critiqueNoise: 0.5 } },
  { id: "heretic", branch: "ruin", depth: 2, requires: "doubt-everything", name: "Heretic", description: "Fracture names the second weakness as well.", effects: { policy: { critique: 0.15 }, secondWeakness: true } },
  { id: "weak-point", branch: "ruin", depth: 3, requires: "heretic", name: "Weak Point", description: "+15% damage to the Bound King's Ward.", effects: { policy: { critique: 0.25 }, wardDamage: 1.15 } },

  { id: "spare-thought", branch: "efficiency", depth: 1, name: "Spare Thought", description: "+1 Focus per Realm. +20 health.", effects: { policy: { efficiency: 0.2 }, bonusFocus: 1, healthFlat: 20 } },
  { id: "economy-of-motion", branch: "efficiency", depth: 2, requires: "spare-thought", name: "Economy of Motion", description: "First Attune each Realm costs no Focus.", effects: { policy: { efficiency: 0.15 }, freeAttunes: 1 } },
  { id: "conservation", branch: "efficiency", depth: 3, requires: "economy-of-motion", name: "Conservation", description: "Unused Focus converts to twice the Crowns.", effects: { policy: { efficiency: 0.25 }, focusConversion: 2 } },

  { id: "merchants-eye", branch: "ledger", depth: 1, name: "Merchant's Eye", description: "Reveal each Essence's historical price band.", effects: { policy: { arbitrage: 0.1 }, priceBand: true } },
  { id: "lean-forge", branch: "ledger", depth: 2, requires: "merchants-eye", name: "Lean Forge", description: "Candidate ranking weighs production cost more.", effects: { policy: { efficiency: 0.1, arbitrage: 0.1 }, costWeight: 0.5 } },
  { id: "contrarian", branch: "ledger", depth: 3, requires: "lean-forge", name: "Contrarian", description: "+10% sale value for viable Forms avoiding the two scarcest Essences.", effects: { policy: { arbitrage: 0.15 }, contrarianBonus: 0.1 } },
  { id: "value-smith", branch: "ledger", depth: 3, requires: "lean-forge", name: "Value Smith", description: "Craft Mastery also credits better score-per-Crown.", effects: { policy: { efficiency: 0.1 }, valueSmith: true } },
  { id: "arbitrage", branch: "ledger", depth: 4, requires: "contrarian", name: "Arbitrage", description: "Reveal one mispriced Form per Bazaar refresh.", effects: { policy: { arbitrage: 0.15 }, arbitrageReveal: true } },
  { id: "patron", branch: "ledger", depth: 4, requires: "value-smith", name: "Patron", description: "+15% when selling a bought Form whose value rose 20%.", effects: { policy: { arbitrage: 0.1 }, patronBonus: 0.15 } },
];

export const passiveById = (id: string) => PASSIVES.find((p) => p.id === id);
