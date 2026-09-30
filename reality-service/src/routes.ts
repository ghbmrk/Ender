// The Unreal client's endpoint contract. Every handler validates input with Zod and delegates to
// the existing server services / domain packages; inference goes only through ctx.inference
// (FixtureInferenceProvider → RuleInferenceProvider fallback).
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ESSENCE_IDS, EVIDENCE_TIERS, round, type EvidenceTier } from "@ender/shared";
import { REALMS } from "@ender/content";
import { FOCUS_COST, PRESET_POLICIES, WORK_UNITS, mirrorObjectives, qualityDistance, technicalScore } from "@ender/domain";
import { efficiencyScore, marketValue, productionCost } from "@ender/economy";
import type { AttuneRequest, CritiqueRequest, InferenceEnvelope, TransformRequest } from "@ender/inference";
import type { Ctx } from "@ender/server/services/context";
import { HttpError, activeCharacterId, policyFor } from "@ender/server/services/character";
import { fantasyIdFor } from "@ender/server/services/artifacts";
import { attune, deepTrial, fracture, mirror, temperOptions, trial } from "@ender/server/services/craft";
import { bazaarView, contractsView, makeProphecy, resolveProphecy } from "@ender/server/services/market";
import { currentSnapshot, marketContext } from "@ender/server/services/world";
import { get } from "@ender/server/db";
import {
  candidateView,
  contractLabel,
  evaluateCandidate,
  marketSummary,
  neighborsView,
  realmOr404,
  realmPoolView,
  realmView,
  resolveCandidate,
  scarcityWord,
  worldView,
} from "./views";

const realmId = z.enum(REALMS.map((r) => r.id) as [string, ...string[]]);
const preset = z.enum(Object.keys(PRESET_POLICIES) as [keyof typeof PRESET_POLICIES, ...(keyof typeof PRESET_POLICIES)[]]);
const tier = z.enum(EVIDENCE_TIERS as [EvidenceTier, ...EvidenceTier[]]);
const flag = z
  .union([z.literal("1"), z.literal("0"), z.literal("true"), z.literal("false")])
  .optional()
  .transform((v) => v === "1" || v === "true");

/** An inference call is either on a held artifact (stateful: Focus, XP, Mastery) or a catalogue Form (stateless). */
const target = z.object({
  artifactId: z.string().min(1).optional(),
  candidateId: z.string().min(1).optional(),
  realmId: realmId.optional(),
  preset: preset.optional(),
});
const requireTarget = (b: z.infer<typeof target>) => !!b.artifactId || (!!b.candidateId && !!b.realmId);
const targetMessage = { message: "give either artifactId, or candidateId + realmId" };

export const Schemas = {
  candidateQuery: z.object({ provenance: flag, realm: realmId.optional(), tier: tier.optional() }),
  neighborsQuery: z.object({
    provenance: flag,
    realm: realmId.optional(),
    limit: z.coerce.number().int().min(1).max(32).default(12),
    depth: z.coerce.number().int().min(1).max(2).default(1),
  }),
  evaluate: z
    .object({ mode: z.enum(["trial", "mirror", "deep-trial"]).default("trial"), artifactId: z.string().min(1).optional(), candidateId: z.string().min(1).optional(), realmId: realmId.optional() })
    .refine(requireTarget, targetMessage),
  attune: target.refine(requireTarget, targetMessage),
  transform: target.extend({ count: z.number().int().min(1).max(4).default(3), wildSigil: z.boolean().optional() }).refine(requireTarget, targetMessage),
  critique: target.extend({ mode: z.enum(["fracture", "mirror", "deep"]).default("fracture") }).refine(requireTarget, targetMessage),
  prophecy: z.object({ essence: z.enum(ESSENCE_IDS), probability: z.union([z.literal(0.1), z.literal(0.3), z.literal(0.5), z.literal(0.7), z.literal(0.9)]) }),
  prophecyResolve: z.object({ id: z.string().min(1) }),
};

export type Envelope<T> = {
  result: T;
  usage: { workUnits: number };
  provenance: { provider: "fixture" | "rule"; requestHash: string; fixtureVersion?: string };
};

function provider(p: string): "fixture" | "rule" {
  if (p !== "fixture" && p !== "rule") throw new HttpError(500, `inference provider ${p} is not allowed`);
  return p;
}

const envelope = <T>(env: InferenceEnvelope<T>, workUnits = env.usage.workUnits): Envelope<T> => ({
  result: env.result,
  usage: { workUnits },
  provenance: {
    provider: provider(env.provenance.provider),
    requestHash: env.provenance.requestHash,
    ...(env.provenance.fixtureVersion ? { fixtureVersion: env.provenance.fixtureVersion } : {}),
  },
});

/** Re-shape a crafting-service result (which logs inference) as an envelope; state changes go in `game`. */
const fromLog = <T>(result: T, log: { workUnits: number; provider: string; requestHash: string }, game: Record<string, unknown>) => ({
  result,
  usage: { workUnits: log.workUnits },
  provenance: { provider: provider(log.provider), requestHash: log.requestHash },
  game,
});

const policyOf = (ctx: Ctx, p?: keyof typeof PRESET_POLICIES) => (p ? { ...PRESET_POLICIES[p] } : policyFor(ctx, activeCharacterId(ctx)));

export function registerRealityRoutes(app: FastifyInstance, ctx: Ctx) {
  app.get("/health", async () => ({ ok: true, service: "reality", provider: ctx.inference.name, fallback: "rule" }));

  // ─────────── World & Realms ───────────
  app.get("/world", async () => worldView(ctx));

  app.get<{ Params: { id: string } }>("/realm/:id", async (req) => realmView(ctx, req.params.id));
  app.get<{ Params: { id: string } }>("/realm/:id/pool", async (req) => realmPoolView(ctx, req.params.id));

  // ─────────── Forms (candidate graph) ───────────
  app.get<{ Params: { id: string } }>("/candidate/:id", async (req) => {
    const q = Schemas.candidateQuery.parse(req.query ?? {});
    return candidateView(ctx, resolveCandidate(ctx, req.params.id), { realmId: q.realm, tier: q.tier, provenance: q.provenance });
  });

  app.get<{ Params: { id: string } }>("/candidate/:id/neighbors", async (req) => {
    const q = Schemas.neighborsQuery.parse(req.query ?? {});
    const c = resolveCandidate(ctx, req.params.id);
    return { id: fantasyIdFor(c.id), neighbors: neighborsView(ctx, c, { limit: q.limit, depth: q.depth as 1 | 2, realmId: q.realm, provenance: q.provenance }) };
  });

  // ─────────── Deterministic evaluation ───────────
  app.post("/evaluate", async (req) => {
    const b = Schemas.evaluate.parse(req.body ?? {});
    const cost = { focus: FOCUS_COST[b.mode], workUnits: WORK_UNITS[b.mode] };
    if (b.artifactId) {
      const charId = activeCharacterId(ctx);
      const out = b.mode === "trial" ? trial(ctx, charId, b.artifactId) : b.mode === "mirror" ? await mirror(ctx, charId, b.artifactId) : await deepTrial(ctx, charId, b.artifactId);
      return { mode: b.mode, source: "artifact", cost, ...out };
    }
    const c = resolveCandidate(ctx, b.candidateId!);
    return { mode: b.mode, source: "candidate", candidateId: fantasyIdFor(c.id), realmId: b.realmId!, cost, ...evaluateCandidate(ctx, c, b.realmId!, b.mode) };
  });

  // ─────────── Inference (fixture → rule) ───────────
  app.post("/attune", async (req) => {
    const b = Schemas.attune.parse(req.body ?? {});
    if (b.artifactId) {
      const out = await attune(ctx, activeCharacterId(ctx), b.artifactId);
      return fromLog(out.familiar, out.inference, { artifact: out.artifact, mastery: out.mastery, focusSpent: out.focusSpent, xpAwarded: out.inference.xp });
    }
    const c = resolveCandidate(ctx, b.candidateId!);
    const ms = marketSummary(ctx, c.recipe);
    const request: AttuneRequest = {
      artifact: { fantasyId: fantasyIdFor(c.id), qualities: c.qualities },
      realmObjective: realmOr404(b.realmId!).objective,
      marketContext: { productionCost: ms.productionCost, currentDemand: ms.currentDemand, essenceScarcity: ms.essenceScarcity },
      buildPolicy: policyOf(ctx, b.preset),
      knownEvidence: ctx.reality.evidenceSync(c.id),
    };
    return envelope(await ctx.inference.attune(request));
  });

  app.post("/transform", async (req) => {
    const b = Schemas.transform.parse(req.body ?? {});
    if (b.artifactId) {
      const charId = activeCharacterId(ctx);
      const out = await temperOptions(ctx, charId, b.artifactId, { wildSigil: b.wildSigil });
      const result = { choices: out.options, summary: out.familiar };
      const game = { focusSpent: out.focusSpent, pending: out.pending, chooseWith: { method: "POST", path: `/api/artifacts/${b.artifactId}/temper`, body: { choice: "<candidateId>" } } };
      if (out.inference) return fromLog(result, out.inference, { ...game, xpAwarded: out.inference.xp });
      // A Temper already in progress: return its options again (no new work).
      const prior = get<{ provider: string; request_hash: string }>(
        ctx.db,
        "SELECT provider, request_hash FROM inference_events WHERE artifact_id = ? AND action = 'temper' ORDER BY rowid DESC LIMIT 1",
        b.artifactId,
      );
      if (!prior) throw new HttpError(409, "Temper in progress but its inference record is missing");
      return fromLog(result, { workUnits: 0, provider: prior.provider, requestHash: prior.request_hash }, game);
    }
    const c = resolveCandidate(ctx, b.candidateId!);
    const objective = realmOr404(b.realmId!).objective;
    const m = marketContext(ctx);
    const ms = marketSummary(ctx, c.recipe);
    const request: TransformRequest = {
      artifact: { fantasyId: fantasyIdFor(c.id), qualities: c.qualities, predictedTechnicalScore: technicalScore(c.qualities, objective), productionCost: ms.productionCost },
      realmObjective: objective,
      candidates: ctx.reality.neighborsSync(c.id, { limit: 12 }).map((n) => {
        const pred = technicalScore(n.qualities, objective);
        const cost = productionCost(n.recipe, m.prices);
        return {
          candidateId: fantasyIdFor(n.id),
          qualities: n.qualities,
          predictedTechnicalScore: pred,
          productionCost: cost,
          marketValue: marketValue(pred, n.recipe, "attuned", m).total,
          distance: round(qualityDistance(c.qualities, n.qualities), 1),
          efficiency: efficiencyScore(pred, cost, m.referenceCost),
          lore: ctx.reality.evidenceSync(n.id)[0]!.tier,
        };
      }),
      marketContext: { productionCost: ms.productionCost, currentDemand: ms.currentDemand, essenceScarcity: ms.essenceScarcity },
      buildPolicy: policyOf(ctx, b.preset),
      costWeight: 0,
      count: b.count,
    };
    return envelope(await ctx.inference.transform(request));
  });

  app.post("/critique", async (req) => {
    const b = Schemas.critique.parse(req.body ?? {});
    if (b.artifactId) {
      const charId = activeCharacterId(ctx);
      if (b.mode === "fracture") {
        const out = await fracture(ctx, charId, b.artifactId);
        return fromLog(out.critique, out.inference, { artifact: out.artifact, mastery: out.mastery, focusSpent: out.focusSpent, xpAwarded: out.inference.xp });
      }
      if (b.mode === "mirror") {
        const out = await mirror(ctx, charId, b.artifactId);
        return fromLog(out.familiar, out.inference, { artifact: out.artifact, mirror: out.mirror, focusSpent: out.focusSpent, xpAwarded: out.inference.xp });
      }
      const out = await deepTrial(ctx, charId, b.artifactId);
      return fromLog(out.critique, out.inference, { artifact: out.artifact, mirror: out.mirror, alternatives: out.alternatives, mastery: out.mastery, focusSpent: out.focusSpent, xpAwarded: out.inference.xp });
    }
    const c = resolveCandidate(ctx, b.candidateId!);
    const objective = realmOr404(b.realmId!).objective;
    let trialFacts: CritiqueRequest["trial"];
    if (b.mode !== "fracture") {
      const base = technicalScore(c.qualities, objective);
      trialFacts = { technicalScore: base, mirrorScores: mirrorObjectives(objective).map((o) => technicalScore(c.qualities, o)), tolerance: b.mode === "deep" ? 9 : 6 };
    }
    const request: CritiqueRequest = {
      mode: b.mode,
      artifact: { fantasyId: fantasyIdFor(c.id), qualities: c.qualities },
      realmObjective: objective,
      marketContext: marketSummary(ctx, c.recipe),
      buildPolicy: policyOf(ctx, b.preset),
      trial: trialFacts,
      wantSecond: b.mode === "deep",
    };
    return envelope(await ctx.inference.critique(request));
  });

  // ─────────── Bazaar, Contracts, Prophecy ───────────
  app.get("/bazaar", async () => bazaarView(ctx, activeCharacterId(ctx)));

  app.get("/contracts", async () => {
    const s = currentSnapshot(ctx);
    return {
      snapshotId: s.id,
      date: s.date,
      contracts: contractsView(ctx, activeCharacterId(ctx)).map((c) => ({ ...c, label: contractLabel(c, null) })),
    };
  });

  app.post("/prophecy", async (req) => {
    const b = Schemas.prophecy.parse(req.body ?? {});
    const s = currentSnapshot(ctx);
    const out = makeProphecy(ctx, activeCharacterId(ctx), b.essence, b.probability);
    return { ...out, snapshotId: s.id, date: s.date, scarcityNow: s.essenceScarcity[b.essence], scarcityWord: scarcityWord(s.essenceScarcity[b.essence]) };
  });

  app.post("/prophecy/resolve", async (req) => {
    const b = Schemas.prophecyResolve.parse(req.body ?? {});
    const out = resolveProphecy(ctx, activeCharacterId(ctx), b.id);
    return { ...out, scoring: "Brier: loss = (p − outcome)², quality = 1 − loss" };
  });
}
