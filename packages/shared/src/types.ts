// Core shared types for The Weave. Browser-safe: no Node imports here.

export const QUALITY_KEYS = ["burden", "veil", "reach", "knots", "flex", "bond"] as const;
export type QualityKey = (typeof QUALITY_KEYS)[number];
export type FormQualities = Record<QualityKey, number>;

export const ESSENCE_IDS = ["ember", "tide", "storm", "root", "glass", "ash"] as const;
export type EssenceId = (typeof ESSENCE_IDS)[number];

export type FormRealityData = {
  source: "pubchem";
  externalId: string;
  molecularFormula: string;
  molecularWeight: number;
  xlogp?: number;
  tpsa?: number;
  complexity?: number;
  hBondDonorCount?: number;
  hBondAcceptorCount?: number;
  rotatableBondCount?: number;
  title?: string;
  descriptorSource?: string;
  identitySource?: string;
};

export type ObjectiveConstraint =
  | { quality: QualityKey; mode: "maximize" | "minimize"; weight: number }
  | { quality: QualityKey; mode: "target"; target: number; tolerance: number; weight: number };

export type RealmObjective = { id: string; constraints: ObjectiveConstraint[] };

export type ProductionRecipe = { essenceCosts: Partial<Record<EssenceId, number>> };

export type EvidenceTier = "veiled" | "attuned" | "trialed" | "witnessed";
export const EVIDENCE_TIERS: EvidenceTier[] = ["veiled", "attuned", "trialed", "witnessed"];

export type ArtifactEvaluation = {
  technicalScore: number;
  productionCost: number;
  estimatedMarketValue: number;
  efficiencyScore: number;
  marginPotential: number;
};

export type SearchPolicy = {
  exploration: number;
  optimization: number;
  critique: number;
  evidence: number;
  efficiency: number;
  arbitrage: number;
};
export const POLICY_KEYS = ["exploration", "optimization", "critique", "evidence", "efficiency", "arbitrage"] as const;

export type MasteryDomain = "discovery" | "craft" | "proof" | "prophecy" | "efficiency" | "commerce";
export const MASTERY_DOMAINS: MasteryDomain[] = ["discovery", "craft", "proof", "prophecy", "efficiency", "commerce"];
export type MasteryState = { successes: number; failures: number; opportunities: number };

export type GearSlot = "blade" | "ward" | "sigil" | "charm";
export const GEAR_SLOTS: GearSlot[] = ["blade", "ward", "sigil", "charm"];

export type CombatStats = {
  maxHealth: number;
  moveSpeed: number;
  attackDamage: number;
  attackSpeed: number;
  critChance: number;
  critMultiplier: number;
  armor: number;
  cooldownRate: number;
  projectileSpeed: number;
  areaMultiplier: number;
};

export type Character = {
  id: string;
  name: string;
  level: number;
  xp: number;
  crowns: number;
  focus: number;
  mastery: Record<MasteryDomain, MasteryState>;
  passivePointsAvailable: number;
  buildPolicy: SearchPolicy;
  equipped: Partial<Record<GearSlot, string>>;
};

export type Artifact = {
  id: string;
  characterId: string;
  realitySource: "pubchem";
  realityId: string;
  revision: number;
  fantasyName?: string;
  epithet?: string;
  objectiveId: string;
  qualities: FormQualities;
  productionRecipe: ProductionRecipe;
  evidenceTier: EvidenceTier;
  technicalScore?: number;
  productionCost?: number;
  marketValue?: number;
  efficiencyScore?: number;
  lineageParentIds: string[];
  createdAt: string;
  origin: "drop" | "temper" | "bazaar" | "seed";
  acquisitionCost: number;
  acquisitionValue?: number;
  status: "held" | "equipped" | "sold" | "delivered" | "shattered";
  equippedSlot?: GearSlot;
  bound?: boolean;
};

export type WorldSnapshot = {
  id: string;
  index: number;
  date: string;
  essenceScarcity: Record<EssenceId, number>;
  essenceBasePrice: Record<EssenceId, number>;
  realmModifiers: RealmModifier[];
  marketObservationIds: string[];
};

export type RealmModifier = { realmId: string; essence: EssenceId; factor: number; note: string };

export type EvidenceSummary = { tier: "none" | "sparse" | "known" | "extensive" | "unsynced"; label: string };

export type ContractRequirement = {
  minPower?: number;
  maxEssence?: { essence: EssenceId; qty: number }[];
  qualityBounds?: { quality: QualityKey; min?: number; max?: number }[];
  minEfficiency?: number;
  maxCost?: number;
  minTier?: EvidenceTier;
};

export type Contract = {
  id: string;
  snapshotId: string;
  issuer: "noble" | "royal" | "smith" | "scholar";
  title: string;
  description: string;
  requirement: ContractRequirement;
  reward: number;
  reason: string;
  targetEssence?: EssenceId;
  status: "open" | "fulfilled" | "expired";
};

export type MarketTransaction = {
  id: string;
  characterId: string;
  assetType: "essence" | "artifact";
  assetId: string;
  side: "buy" | "sell";
  quantity: number;
  unitPrice: number;
  worldSnapshotId: string;
  createdAt: string;
};

export type InferenceProviderName = "fixture" | "rule" | "future-chatgpt";

export type InferenceEvent = {
  id: string;
  characterId: string;
  artifactId?: string;
  type: "attune" | "transform" | "critique";
  action: CraftAction;
  requestHash: string;
  provider: InferenceProviderName;
  workUnits: number;
  xpAwarded: number;
  createdAt: string;
};

export type CraftAction = "attune" | "fracture" | "temper" | "trial" | "mirror" | "deep-trial";

/** A real-data-backed candidate Form in the search universe. */
export type Candidate = {
  id: string;
  qualities: FormQualities;
  recipe: ProductionRecipe;
  neighbors: string[];
};
