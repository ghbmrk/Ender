import { ESSENCE_IDS, QUALITY_KEYS, hash32, round, type QualityKey, type SearchPolicy } from "@ender/shared";
import { FORM_NOUNS, NAME_PREFIX, NAME_SUFFIX, QUALITY_NAMES, ESSENCES } from "@ender/content";
import { normalizePolicy, scoreObjective, weaknesses } from "@ender/domain";
import { requestHash } from "./hash";
import {
  DEFAULT_WU,
  type AttuneRequest,
  type AttuneResult,
  type CritiqueRequest,
  type CritiqueResult,
  type InferenceEnvelope,
  type InferenceProvider,
  type TransformRequest,
  type TransformResult,
} from "./types";

const EPITHET_BY_QUALITY: Record<QualityKey, [high: string, low: string]> = {
  burden: ["the Leaden", "the Featherlight"],
  veil: ["of Deep Water", "the Unhidden"],
  reach: ["the Far-Reaching", "the Inward"],
  knots: ["of Many Knots", "the Plain"],
  flex: ["the Writhing", "the Rigid"],
  bond: ["the Clasping", "the Aloof"],
};

const LOW_TEXT: Record<QualityKey, string> = {
  burden: "Too much Burden.",
  veil: "Its Veil sits wrong for this Realm.",
  reach: "Its Reach falls short.",
  knots: "Too few Knots to hold the pattern.",
  flex: "Its Flex works against the Realm.",
  bond: "Its Bond is misjudged.",
};

export function ruleFantasyName(fantasyId: string, q: AttuneRequest["artifact"]["qualities"]) {
  const h = hash32(fantasyId);
  const name = `${NAME_PREFIX[h % NAME_PREFIX.length]}${NAME_SUFFIX[(h >>> 8) % NAME_SUFFIX.length]} ${FORM_NOUNS[(h >>> 16) % FORM_NOUNS.length]}`;
  const extreme = [...QUALITY_KEYS].sort((a, b) => Math.abs(q[b] - 50) - Math.abs(q[a] - 50))[0]!;
  const epithet = EPITHET_BY_QUALITY[extreme][q[extreme] >= 50 ? 0 : 1];
  return { fantasyName: name, epithet };
}

const env = <T>(kind: "attune" | "transform" | "critique", request: unknown, result: T): InferenceEnvelope<T> => ({
  result,
  usage: { workUnits: DEFAULT_WU[kind] },
  provenance: { provider: "rule", requestHash: requestHash(kind, request) },
});

export function ruleAttune(req: AttuneRequest): AttuneResult {
  const q = req.artifact.qualities;
  const { technicalScore, contributions } = scoreObjective(q, req.realmObjective);
  const observations = contributions.map((c) => {
    const significance = c.satisfaction >= 70 ? "strong" : c.satisfaction <= 35 ? "weak" : Math.abs(c.satisfaction - 50) < 8 ? "uncertain" : "neutral";
    const verb = significance === "strong" ? "serves the Realm well" : significance === "weak" ? "fights the Realm" : "is middling here";
    return { quality: c.quality, significance, text: `${QUALITY_NAMES[c.quality]} reads near ${Math.round(q[c.quality])}; it ${verb}.` } as const;
  });
  const p = normalizePolicy(req.buildPolicy);
  let suggestedAction: AttuneResult["suggestedAction"];
  if (technicalScore >= 65) suggestedAction = p.evidence >= 0.2 ? "trial" : "equip";
  else if (technicalScore >= 42) suggestedAction = "transform";
  else suggestedAction = p.exploration > 0.3 ? "transform" : "sell";
  if (p.arbitrage >= 0.25 && req.marketContext.productionCost > 250 && technicalScore < 70) suggestedAction = "sell";
  const { fantasyName, epithet } = ruleFantasyName(req.artifact.fantasyId, q);
  const strongest = [...contributions].sort((a, b) => b.satisfaction - a.satisfaction)[0]!;
  const weakest = [...contributions].sort((a, b) => a.satisfaction - b.satisfaction)[0]!;
  return {
    fantasyName,
    epithet,
    observations: [...observations],
    suggestedAction,
    summary: `Its ${QUALITY_NAMES[strongest.quality]} is its gift; its ${QUALITY_NAMES[weakest.quality]} is its flaw. I would ${suggestedAction}.`,
  };
}

type Feature = "improve" | "explore" | "repair" | "economize" | "profit" | "evidence";
const FEATURE_POLICY: Record<Feature, keyof SearchPolicy> = {
  improve: "optimization",
  explore: "exploration",
  repair: "critique",
  economize: "efficiency",
  profit: "arbitrage",
  evidence: "evidence",
};

/** Rank candidates by the character's SearchPolicy. Exported for tests and analytics. */
export function rankCandidates(req: TransformRequest) {
  const cands = req.candidates;
  const weakest = weaknesses(req.artifact.qualities, req.realmObjective)[0]!;
  const loreRank = { unsynced: 0.5, none: 0.2, sparse: 0.45, known: 0.75, extensive: 1 } as const;
  const raw = cands.map((c) => {
    const repairSat = scoreObjective(c.qualities, req.realmObjective).contributions.find((x) => x.quality === weakest.quality)!.satisfaction;
    return {
      c,
      f: {
        improve: c.predictedTechnicalScore - req.artifact.predictedTechnicalScore,
        explore: c.distance,
        repair: repairSat - weakest.satisfaction,
        economize: c.efficiency,
        profit: c.marketValue - c.productionCost,
        evidence: loreRank[c.lore] - c.distance / 100,
      } as Record<Feature, number>,
    };
  });
  const feats = Object.keys(FEATURE_POLICY) as Feature[];
  const lo = {} as Record<Feature, number>;
  const hi = {} as Record<Feature, number>;
  for (const k of feats) {
    lo[k] = Math.min(...raw.map((r) => r.f[k]));
    hi[k] = Math.max(...raw.map((r) => r.f[k]));
  }
  // Squared policy weights: a build's dominant instincts dominate its choices.
  const p = normalizePolicy(req.buildPolicy);
  const sq = feats.reduce((s, k) => s + p[FEATURE_POLICY[k]] ** 2, 0) || 1;
  const w = {} as Record<Feature, number>;
  for (const k of feats) w[k] = p[FEATURE_POLICY[k]] ** 2 / sq;
  w.economize += req.costWeight * 0.5;
  w.profit += req.costWeight * 0.5;
  return raw
    .map((r) => {
      const parts = feats.map((k) => [k, w[k] * (hi[k] > lo[k] ? (r.f[k] - lo[k]) / (hi[k] - lo[k]) : 0.5)] as const);
      const utility = parts.reduce((s, [, v]) => s + v, 0);
      const emphasis = [...parts].sort((a, b) => b[1] - a[1])[0]![0];
      return { candidate: r.c, utility: round(utility, 4), emphasis, features: r.f };
    })
    .sort((a, b) => b.utility - a.utility || a.candidate.candidateId.localeCompare(b.candidate.candidateId));
}

const RATIONALE: Record<Feature, (c: TransformRequest["candidates"][number]) => string> = {
  improve: (c) => `A truer answer to the Realm: it should score near ${Math.round(c.predictedTechnicalScore)}.`,
  explore: (c) => `A far step from the original, into unwalked ground.`,
  repair: () => `It mends the flaw that weighs on the original most.`,
  economize: (c) => `Cheap to make at ${Math.round(c.productionCost)} Crowns for what it does.`,
  profit: (c) => `Buyers would pay near ${Math.round(c.marketValue)}; the margin is good.`,
  evidence: () => `A Form whose nature is better attested.`,
};

export function ruleTransform(req: TransformRequest): TransformResult {
  const ranked = rankCandidates(req).slice(0, req.count);
  return {
    choices: ranked.map((r) => ({ candidateId: r.candidate.candidateId, emphasis: r.emphasis, rationale: RATIONALE[r.emphasis](r.candidate) })),
    summary: `I followed your ${Object.entries(normalizePolicy(req.buildPolicy)).sort((a, b) => b[1] - a[1])[0]![0]} instinct.`,
  };
}

export function ruleCritique(req: CritiqueRequest): CritiqueResult {
  const q = req.artifact.qualities;
  const ws = weaknesses(q, req.realmObjective);
  const score = scoreObjective(q, req.realmObjective).technicalScore;
  const tech = (i: number) => ({ kind: "technical" as const, quality: ws[i]!.quality, text: LOW_TEXT[ws[i]!.quality] });
  const cost = req.marketContext.productionCost;
  const costliest = ESSENCE_IDS.filter((e) => (req.marketContext.costByEssence[e] ?? 0) > 0).sort(
    (a, b) => (req.marketContext.costByEssence[b] ?? 0) - (req.marketContext.costByEssence[a] ?? 0),
  )[0];
  const share = costliest && cost > 0 ? (req.marketContext.costByEssence[costliest] ?? 0) / cost : 0;
  const economic =
    costliest && share > 0.4 && req.marketContext.essenceScarcity[costliest] > 60
      ? {
          kind: "economic" as const,
          essence: costliest,
          text: `${score >= 60 ? "Technically strong, but" : "Worse still,"} its ${ESSENCES[costliest].name} cost makes it commercially weak.`,
        }
      : undefined;
  let weakness: CritiqueResult["weakness"] = tech(0);
  let secondary: CritiqueResult["secondary"] = req.wantSecond ? tech(1) : undefined;
  if (economic && score >= 60) {
    secondary = req.wantSecond ? weakness : undefined;
    weakness = economic;
  } else if (economic && req.wantSecond) secondary = economic;
  let verdict: CritiqueResult["verdict"] = score >= 65 ? "sound" : score < 40 ? "flawed" : "fragile";
  if (req.trial) {
    const dev = Math.max(...req.trial.mirrorScores.map((m) => Math.abs(m - req.trial!.technicalScore)));
    verdict = dev <= req.trial.tolerance ? (req.trial.technicalScore >= 50 ? "sound" : "fragile") : "fragile";
  }
  return {
    weakness,
    secondary,
    verdict,
    summary:
      req.mode === "fracture"
        ? `The crack runs through its ${weakness.quality ? QUALITY_NAMES[weakness.quality] : weakness.essence ? ESSENCES[weakness.essence].name : "making"}.`
        : verdict === "sound"
          ? "The reflections agree; it holds under other lights."
          : "Under other lights it wavers.",
  };
}

export class RuleInferenceProvider implements InferenceProvider {
  readonly name = "rule" as const;
  async attune(r: AttuneRequest) {
    return env("attune", r, ruleAttune(r));
  }
  async transform(r: TransformRequest) {
    return env("transform", r, ruleTransform(r));
  }
  async critique(r: CritiqueRequest) {
    return env("critique", r, ruleCritique(r));
  }
}
