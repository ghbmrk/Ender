import { z } from "zod";
import { ESSENCE_IDS, QUALITY_KEYS, type EssenceId, type EvidenceSummary, type FormQualities, type RealmObjective, type SearchPolicy } from "@ender/shared";

const quality = z.enum(QUALITY_KEYS);
const essence = z.enum(ESSENCE_IDS);

export type MarketContextSummary = {
  productionCost: number;
  currentDemand: number;
  essenceScarcity: Record<EssenceId, number>;
};

export type AttuneRequest = {
  artifact: { fantasyId: string; qualities: FormQualities };
  realmObjective: RealmObjective;
  marketContext: MarketContextSummary;
  buildPolicy: SearchPolicy;
  knownEvidence: EvidenceSummary[];
};

export const AttuneResultSchema = z.object({
  fantasyName: z.string().min(2).max(40),
  epithet: z.string().min(2).max(60),
  observations: z
    .array(
      z.object({
        quality,
        significance: z.enum(["strong", "weak", "uncertain", "neutral"]),
        text: z.string().min(2).max(140),
      }),
    )
    .min(1)
    .max(6),
  suggestedAction: z.enum(["equip", "transform", "trial", "sell"]),
  summary: z.string().min(2).max(200),
});
export type AttuneResult = z.infer<typeof AttuneResultSchema>;

export type TransformCandidate = {
  candidateId: string;
  qualities: FormQualities;
  predictedTechnicalScore: number;
  productionCost: number;
  marketValue: number;
  distance: number;
  efficiency: number;
  lore: EvidenceSummary["tier"];
};

export type TransformRequest = {
  artifact: { fantasyId: string; qualities: FormQualities; predictedTechnicalScore: number; productionCost: number };
  realmObjective: RealmObjective;
  candidates: TransformCandidate[];
  marketContext: MarketContextSummary;
  buildPolicy: SearchPolicy;
  /** Extra production-cost weighting from passives (Lean Forge). */
  costWeight: number;
  count: number;
};

export const TransformResultSchema = z.object({
  choices: z
    .array(
      z.object({
        candidateId: z.string(),
        emphasis: z.enum(["improve", "explore", "repair", "economize", "profit", "evidence"]),
        rationale: z.string().min(2).max(140),
      }),
    )
    .min(1)
    .max(4),
  summary: z.string().min(2).max(200),
});
export type TransformResult = z.infer<typeof TransformResultSchema>;

export type CritiqueRequest = {
  mode: "fracture" | "mirror" | "deep";
  artifact: { fantasyId: string; qualities: FormQualities };
  realmObjective: RealmObjective;
  marketContext: MarketContextSummary & { costByEssence: Partial<Record<EssenceId, number>> };
  buildPolicy: SearchPolicy;
  /** Mirror/deep: deterministic trial facts the critique may reference. */
  trial?: { technicalScore: number; mirrorScores: number[]; tolerance: number };
  wantSecond: boolean;
};

const weakness = z.object({
  kind: z.enum(["technical", "economic"]),
  quality: quality.optional(),
  essence: essence.optional(),
  text: z.string().min(2).max(160),
});
export const CritiqueResultSchema = z.object({
  weakness,
  secondary: weakness.optional(),
  verdict: z.enum(["sound", "fragile", "flawed"]),
  summary: z.string().min(2).max(200),
});
export type CritiqueResult = z.infer<typeof CritiqueResultSchema>;

/**
 * Plan: the Familiar's next move while the player is away (thread "Agent play while away"). The caller lists the
 * legal moves; the provider picks one or stops. `ruleValue` is the rules' own value per Focus, a hint a model may
 * ignore. A model is meant to answer this rarely (the player's plan quota is the attention budget), never per action.
 */
export type PlanOption = { id: string; label: string; focusCost: number; ruleValue: number; facts: Record<string, string | number | boolean | null> };
export type PlanRequest = {
  question: "next-move" | "temper-pick";
  mandate: { id: string; title: string };
  focusLeft: number;
  target?: { name: string; power: number | null; cost: number | null } | null;
  options: PlanOption[];
};

export const PlanResultSchema = z.object({
  /** An option id, or "stop" when nothing is worth the attention. */
  choice: z.string(),
  rationale: z.string().min(2).max(160),
});
export type PlanResult = z.infer<typeof PlanResultSchema>;

export type InferenceKind = "attune" | "transform" | "critique" | "plan";

export type InferenceEnvelope<T> = {
  result: T;
  usage: { workUnits: number; inputUnits?: number; outputUnits?: number; reasoningUnits?: number };
  provenance: { provider: "fixture" | "rule" | "future-chatgpt"; requestHash: string; fixtureVersion?: string };
};

/** The only way any subsystem may obtain inference. */
export interface InferenceProvider {
  readonly name: "fixture" | "rule" | "future-chatgpt";
  attune(request: AttuneRequest): Promise<InferenceEnvelope<AttuneResult>>;
  transform(request: TransformRequest): Promise<InferenceEnvelope<TransformResult>>;
  critique(request: CritiqueRequest): Promise<InferenceEnvelope<CritiqueResult>>;
  plan(request: PlanRequest): Promise<InferenceEnvelope<PlanResult>>;
}

export const RESULT_SCHEMAS = {
  attune: AttuneResultSchema,
  transform: TransformResultSchema,
  critique: CritiqueResultSchema,
  plan: PlanResultSchema,
} as const;

/** Default normalized Work Units per inference call. */
export const DEFAULT_WU: Record<InferenceKind, number> = { attune: 1, transform: 3, critique: 1, plan: 0 };
