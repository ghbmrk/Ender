// Read models for the Unreal client. Pure projections over the existing server services and
// domain packages: no game rule is re-implemented here.
import { ESSENCE_IDS, QUALITY_KEYS, percentile, percentileRank, round, type Candidate, type Contract, type EssenceId, type EvidenceTier, type FormQualities } from "@ender/shared";
import { BASE_FOCUS, FOCUS_COST, WORK_UNITS, artifactPower, masteryEffects, mirrorObjectives, qualityDistance, rawQualityValues, scoreObjective, technicalScore } from "@ender/domain";
import { CURRENCIES, ENEMIES, ESSENCES, QUALITY_DESCRIPTIONS, QUALITY_NAMES, RECIPE_DRIVERS, REALMS, BOSS, type EnemyKind } from "@ender/content";
import { essencePrice, essenceQty, evaluateForm, marketValue, productionCost, type MarketContext } from "@ender/economy";
import { ruleFantasyName } from "@ender/inference";
import type { Ctx } from "@ender/server/services/context";
import { HttpError, activeCharacterId, characterView, combatStatsFor, getMastery } from "@ender/server/services/character";
import { fantasyIdFor, realityIdForCandidate } from "@ender/server/services/artifacts";
import { realmGateView } from "@ender/server/services/market";
import { ARENA, nextRunSeed, realmPool } from "@ender/server/services/runs";
import { activeContracts, currentPrices, currentSnapshot, marketContext, pressure } from "@ender/server/services/world";

// ───────────────────────────── Words, not finance ─────────────────────────────

export type ScarcityWord = "very abundant" | "abundant" | "steady" | "scarce" | "very scarce";

/** Scarcity 0–100 as a word the Realm card can show (no financial vocabulary). */
export function scarcityWord(s: number): ScarcityWord {
  if (s >= 75) return "very scarce";
  if (s >= 60) return "scarce";
  if (s <= 25) return "very abundant";
  if (s <= 40) return "abundant";
  return "steady";
}

const ISSUER_WORD: Record<Contract["issuer"], string> = { royal: "Royal", noble: "Noble", smith: "Smiths'", scholar: "Scholars'" };

// ───────────────────────────── Candidates ─────────────────────────────

/** Resolve a Form id: the fantasy id (`form-…`) the client sees, or the underlying reality id. */
export function resolveCandidate(ctx: Ctx, id: string): Candidate {
  const realityId = realityIdForCandidate(ctx, id);
  if (!realityId) throw new HttpError(404, `no Form ${id}`);
  return ctx.reality.candidateSync(realityId);
}

export function realmOr404(id: string) {
  const r = REALMS.find((x) => x.id === id);
  if (!r) throw new HttpError(404, `no Realm ${id}`);
  return r;
}

export type EvaluationView = {
  technicalScore: number;
  productionCost: number;
  estimatedMarketValue: number;
  efficiencyScore: number;
  marginPotential: number;
  evidenceTier: EvidenceTier;
  power: number;
  valueBreakdown: ReturnType<typeof evaluateForm>["value"];
  contributions: ReturnType<typeof scoreObjective>["contributions"];
};

export function evaluationView(q: FormQualities, c: Candidate, realmId: string, tier: EvidenceTier, m: MarketContext): EvaluationView {
  const objective = realmOr404(realmId).objective;
  const ev = evaluateForm(q, c.recipe, objective, tier, m);
  return {
    technicalScore: ev.technicalScore,
    productionCost: ev.productionCost,
    estimatedMarketValue: ev.estimatedMarketValue,
    efficiencyScore: ev.efficiencyScore,
    marginPotential: ev.marginPotential,
    evidenceTier: tier,
    power: artifactPower(ev.technicalScore, tier),
    valueBreakdown: ev.value,
    contributions: scoreObjective(q, objective).contributions,
  };
}

const QUALITY_SOURCE: Record<(typeof QUALITY_KEYS)[number], string> = {
  burden: "molecularWeight",
  veil: "xlogp",
  reach: "tpsa",
  knots: "complexity",
  flex: "rotatableBondCount",
  bond: "2×hBondDonorCount + hBondAcceptorCount",
};

/** Scientific provenance: only returned when the client explicitly asks (`?provenance=1`). */
export function provenanceView(ctx: Ctx, c: Candidate) {
  const record = ctx.reality.record(c.id);
  const raw = record ? rawQualityValues(record) : undefined;
  const bands = ctx.reality.graph.bands;
  return {
    source: "pubchem",
    cid: c.id,
    pubchemUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${c.id}`,
    title: record?.title ?? null,
    molecularFormula: record?.molecularFormula ?? null,
    molecularWeight: record?.molecularWeight ?? null,
    xlogp: record?.xlogp ?? null,
    tpsa: record?.tpsa ?? null,
    complexity: record?.complexity ?? null,
    hBondDonorCount: record?.hBondDonorCount ?? null,
    hBondAcceptorCount: record?.hBondAcceptorCount ?? null,
    rotatableBondCount: record?.rotatableBondCount ?? null,
    descriptorSource: record?.descriptorSource ?? null,
    identitySource: record?.identitySource ?? null,
    normalization: QUALITY_KEYS.map((q) => ({ quality: q, source: QUALITY_SOURCE[q], raw: raw?.[q] ?? null, p05: bands[q].p05, p95: bands[q].p95, normalized: c.qualities[q] })),
    disclaimer: "Fantasy qualities are a game abstraction over cached public records; they are not scientific interpretation.",
  };
}

export function candidateView(ctx: Ctx, c: Candidate, opts: { realmId?: string; tier?: EvidenceTier; provenance?: boolean }) {
  const m = marketContext(ctx);
  const fantasyId = fantasyIdFor(c.id);
  const named = ruleFantasyName(fantasyId, c.qualities);
  return {
    id: fantasyId,
    name: named.fantasyName,
    epithet: named.epithet,
    qualities: c.qualities,
    qualityNames: QUALITY_NAMES,
    normalization: "p05 → 0, p95 → 100 over the Form corpus, clamped",
    recipe: {
      essenceCosts: c.recipe.essenceCosts,
      drivers: RECIPE_DRIVERS,
      costByEssence: Object.fromEntries(ESSENCE_IDS.filter((e) => essenceQty(c.recipe, e) > 0).map((e) => [e, round(essenceQty(c.recipe, e) * m.prices[e], 1)])),
    },
    productionCost: productionCost(c.recipe, m.prices),
    lore: ctx.reality.evidenceSync(c.id)[0]!,
    evaluation: opts.realmId ? { realmId: opts.realmId, ...evaluationView(c.qualities, c, opts.realmId, opts.tier ?? "trialed", m) } : null,
    ...(opts.provenance ? { provenance: provenanceView(ctx, c) } : {}),
  };
}

export function neighborsView(ctx: Ctx, c: Candidate, opts: { limit: number; depth: 1 | 2; realmId?: string; provenance?: boolean }) {
  const m = marketContext(ctx);
  const objective = opts.realmId ? realmOr404(opts.realmId).objective : null;
  return ctx.reality.neighborsSync(c.id, { depth: opts.depth, limit: opts.limit }).map((n) => {
    const fantasyId = fantasyIdFor(n.id);
    return {
      id: fantasyId,
      name: ruleFantasyName(fantasyId, n.qualities).fantasyName,
      qualities: n.qualities,
      distance: round(qualityDistance(c.qualities, n.qualities), 1),
      recipe: { essenceCosts: n.recipe.essenceCosts },
      productionCost: productionCost(n.recipe, m.prices),
      technicalScore: objective ? technicalScore(n.qualities, objective) : null,
      ...(opts.provenance ? { provenance: { source: "pubchem", cid: n.id } } : {}),
    };
  });
}

// ───────────────────────────── Deterministic evaluation ─────────────────────────────

export type EvalMode = "trial" | "mirror" | "deep-trial";

/** Stateless Trial / Mirror / Deep Trial of a catalogue Form against a Realm objective. */
export function evaluateCandidate(ctx: Ctx, c: Candidate, realmId: string, mode: EvalMode) {
  const m = marketContext(ctx);
  const objective = realmOr404(realmId).objective;
  const base = technicalScore(c.qualities, objective);
  let tier: EvidenceTier = "trialed";
  let mirror: { technicalScore: number; mirrorScores: number[]; tolerance: number; maxDeviation: number; consistent: boolean } | null = null;
  let alternatives = null;
  if (mode !== "trial") {
    const mirrorScores = mirrorObjectives(objective).map((o) => technicalScore(c.qualities, o));
    const tolerance = mode === "deep-trial" ? 9 : 6;
    const maxDeviation = round(Math.max(...mirrorScores.map((s) => Math.abs(s - base))), 1);
    mirror = { technicalScore: base, mirrorScores, tolerance, maxDeviation, consistent: maxDeviation <= tolerance };
    if (mirror.consistent) tier = "witnessed";
  }
  const evaluation = evaluationView(c.qualities, c, realmId, tier, m);
  if (mode === "deep-trial") {
    const alts = ctx.reality
      .neighborsSync(c.id, { limit: 16 })
      .map((n) => ({ id: fantasyIdFor(n.id), ev: evaluateForm(n.qualities, n.recipe, objective, "trialed", m) }));
    const bestTech = [...alts].sort((x, y) => y.ev.technicalScore - x.ev.technicalScore)[0]!;
    const bestMargin = [...alts].sort((x, y) => y.ev.marginPotential - x.ev.marginPotential)[0]!;
    alternatives = {
      strongestNeighbor: { id: bestTech.id, technicalScore: bestTech.ev.technicalScore, margin: bestTech.ev.marginPotential, beatsThis: bestTech.ev.technicalScore > evaluation.technicalScore },
      mostProfitableNeighbor: { id: bestMargin.id, technicalScore: bestMargin.ev.technicalScore, margin: bestMargin.ev.marginPotential, beatsThis: bestMargin.ev.marginPotential > evaluation.marginPotential },
    };
  }
  return { evaluation, mirror, alternatives };
}

/** Market facts an inference request may reference (same shape the crafting service sends). */
export function marketSummary(ctx: Ctx, recipe: Candidate["recipe"]) {
  const m = marketContext(ctx);
  const cost = productionCost(recipe, m.prices);
  const demand = m.contracts.filter((c) => c.requirement.maxEssence?.every((x) => essenceQty(recipe, x.essence) <= x.qty)).length;
  const costByEssence: Partial<Record<EssenceId, number>> = {};
  for (const e of ESSENCE_IDS) if (essenceQty(recipe, e) > 0) costByEssence[e] = round(essenceQty(recipe, e) * m.prices[e], 1);
  return { productionCost: cost, currentDemand: demand, essenceScarcity: m.scarcity, costByEssence };
}

// ───────────────────────────── World ─────────────────────────────

export function worldView(ctx: Ctx) {
  const s = currentSnapshot(ctx);
  const p = pressure(ctx);
  const prices = currentPrices(ctx);
  const essences = ESSENCE_IDS.map((e) => {
    const b = essencePrice(s, e, p[e]);
    return {
      id: e,
      name: ESSENCES[e].name,
      color: ESSENCES[e].color,
      glyph: ESSENCES[e].glyph,
      scarcity: s.essenceScarcity[e],
      scarcityWord: scarcityWord(s.essenceScarcity[e]),
      price: prices[e],
      basePrice: b.base,
      priceFactors: { externalScarcity: b.external, localSupplyDemand: b.local, worldModifier: b.world },
    };
  });
  return {
    date: s.date,
    snapshotId: s.id,
    index: s.index,
    total: ctx.world.snapshots.length,
    replay: { first: ctx.world.snapshots[0]!.date, last: ctx.world.snapshots.at(-1)!.date, hasNext: s.index + 1 < ctx.world.snapshots.length },
    scarcity: Object.fromEntries(ESSENCE_IDS.map((e) => [e, s.essenceScarcity[e]])) as Record<EssenceId, number>,
    prices,
    essences,
    modifiers: s.realmModifiers.map((mod) => ({ realmId: mod.realmId, essence: mod.essence, factor: mod.factor, note: mod.note })),
    formula: "price = basePrice × externalScarcityFactor × localSupplyDemandFactor × worldModifier",
  };
}

// ───────────────────────────── Realm card + preload ─────────────────────────────

/** How much a contract pays over what the Realm's typical eligible Forms would fetch at the Bazaar. */
function bountyPct(ctx: Ctx, c: Contract, realmId: string, m: MarketContext): number | null {
  const objective = realmOr404(realmId).objective;
  const plain = { ...m, contracts: [] };
  const ranked = ctx.reality
    .all()
    .map((x) => ({ x, s: technicalScore(x.qualities, objective) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, Math.floor(ctx.reality.all().length / 3))
    .filter(({ x }) => (c.requirement.maxEssence ?? []).every((r) => essenceQty(x.recipe, r.essence) <= r.qty));
  if (!ranked.length) return null;
  const values = ranked.map(({ x, s }) => marketValue(s, x.recipe, c.requirement.minTier ?? "trialed", plain).total).sort((a, b) => a - b);
  const median = percentile(values, 0.5);
  return median > 0 ? Math.round(100 * (c.reward / median - 1)) : null;
}

export function contractLabel(c: Contract, pct: number | null) {
  const who = `${ISSUER_WORD[c.issuer]} Demand`;
  const free = c.targetEssence && c.requirement.maxEssence?.some((x) => x.essence === c.targetEssence && x.qty === 0);
  if (free) {
    const name = ESSENCES[c.targetEssence!].name;
    return pct === null ? `${who}: ${name}-free Forms` : `${who}: ${name}-free Forms ${pct >= 0 ? "+" : "−"}${Math.abs(pct)}% bounty`;
  }
  return `${who}: ${c.title.split(": ").slice(1).join(": ") || c.title}`;
}

export function realmView(ctx: Ctx, realmId: string) {
  const realm = realmOr404(realmId);
  const s = currentSnapshot(ctx);
  const gate = realmGateView(ctx).find((g) => g.id === realm.id)!;
  const m = marketContext(ctx);
  const contracts = activeContracts(ctx, s);
  const fitById = new Map(gate.demand.map((d) => [d.contractId, d]));
  const charId = activeCharacterId(ctx);
  const character = characterView(ctx, charId);
  const kinds = Object.keys(realm.enemyWeights) as EnemyKind[];

  const card = {
    id: realm.id,
    name: realm.name,
    tagline: realm.tagline,
    difficulty: realm.difficulty,
    difficultyLabel: gate.difficultyLabel,
    expectedEssences: gate.expectedEssences.map((x) => ({
      essence: x.essence,
      name: x.name,
      share: x.share,
      scarcity: scarcityWord(s.essenceScarcity[x.essence]),
      glut: x.glut,
    })),
    scarcity: ESSENCE_IDS.map((e) => ({ essence: e, name: ESSENCES[e].name, level: Math.round(s.essenceScarcity[e]), word: scarcityWord(s.essenceScarcity[e]) })),
    contracts: contracts.map((c) => {
      const pct = bountyPct(ctx, c, realm.id, m);
      const fit = fitById.get(c.id);
      return {
        contractId: c.id,
        label: contractLabel(c, pct),
        issuer: c.issuer,
        essence: c.targetEssence ?? null,
        bountyPct: pct,
        reward: c.reward,
        fit: fit?.fit ?? null,
        arrows: fit?.arrows ?? null,
      };
    }),
    formBias: realm.bias,
    haulCrowns: gate.haulValue,
    events: gate.events,
  };

  const preload = {
    snapshotId: s.id,
    realm: { id: realm.id, palette: realm.palette, objective: realm.objective, essenceDrops: realm.essenceDrops, enemyWeights: realm.enemyWeights },
    enemies: Object.fromEntries(kinds.map((k) => [k, ENEMIES[k]])),
    boss: { name: BOSS.name, hp: Math.round(BOSS.hp * (1 + 0.25 * (realm.difficulty - 1))), wardTargets: BOSS.wardTargets },
    arena: ARENA,
    rooms: [
      ...[0, 1, 2, 3, 4].map((i) => ({ index: i, kind: "combat" })),
      { index: 5, kind: "shrine" },
      { index: 6, kind: "elite" },
      { index: 7, kind: "boss" },
    ],
    essences: Object.fromEntries(ESSENCE_IDS.map((e) => [e, { name: ESSENCES[e].name, color: ESSENCES[e].color, glyph: ESSENCES[e].glyph, flavor: ESSENCES[e].flavor }])),
    qualities: Object.fromEntries(QUALITY_KEYS.map((q) => [q, { name: QUALITY_NAMES[q], description: QUALITY_DESCRIPTIONS[q] }])),
    currencies: CURRENCIES,
    character: {
      id: character.id,
      level: character.level,
      focus: character.focus,
      maxFocus: character.maxFocus,
      stats: character.stats,
      equipped: character.equipped,
    },
    craft: { focusPerRealm: BASE_FOCUS, focusCost: FOCUS_COST, workUnits: WORK_UNITS },
    runStart: {
      method: "POST",
      path: "/api/runs",
      body: { realmId: realm.id },
      note: "Returns the full deterministic RunPlan (rooms, obstacles, waves, loot counts). Fetch it before loading the level; combat then needs no network until /api/runs/:id/checkpoint at the shrine and /api/runs/:id/complete.",
    },
  };
  return { card, preload };
}

// ───────────────────────────── Realm drop pool (prefetched) ─────────────────────────────

/**
 * Every Form that can drop in this Realm, so the client picks drops locally during combat.
 * Same pool and ordering the server's own run generator draws from (the whole corpus ranked by
 * technical score for the Realm objective). Fantasy ids and qualities only; nothing scientific.
 */
export function realmPoolView(ctx: Ctx, realmId: string) {
  const realm = realmOr404(realmId);
  const ranked = realmPool(ctx, realm.id);
  const scores = ranked.map((x) => x.s);
  const charId = activeCharacterId(ctx);
  const s = currentSnapshot(ctx);
  return {
    realmId: realm.id,
    snapshotId: s.id,
    nextRunSeed: nextRunSeed(ctx, charId),
    size: ranked.length,
    selection: {
      order: "candidates are listed by technicalPercentile ascending (the server's draw order)",
      rule: "drop index = floor(clamp(max(u1..u_draws)^0.85 + bonus/100, 0, 0.995) × size), u ~ U(0,1)",
      draws: { combat: 1, elite: 2, bossFirst: 3, bossSecond: 2 },
      lootPercentileBonus: combatStatsFor(ctx, charId).lootPercentileBonus,
      elitePercentileBonus: masteryEffects(getMastery(ctx, charId)).discoveryPercentile,
      report: "send drops as forms: [{ room, candidateId }] to POST /api/runs/:id/checkpoint and /complete",
    },
    candidates: ranked.map((x) => {
      const q = ctx.reality.candidateSync(x.id).qualities;
      return {
        id: fantasyIdFor(x.id),
        qualities: { burden: q.burden, veil: q.veil, reach: q.reach, knots: q.knots, flex: q.flex, bond: q.bond },
        technicalPercentile: round(100 * percentileRank(scores, x.s), 1),
      };
    }),
  };
}
