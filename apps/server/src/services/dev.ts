import { readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { ESSENCE_IDS, QUALITY_KEYS } from "@weave/shared";
import { ESSENCE_MARKET_SERIES } from "@weave/content";
import { rawQualityValues } from "@weave/domain";
import { essencePrice } from "@weave/economy";
import { all } from "../db";
import type { Ctx } from "./context";
import { getArtifact, lineage, trueEvaluation, trueQualities } from "./artifacts";
import { currentSnapshot, pressure, activeContracts } from "./world";

export function provenance(ctx: Ctx, artifactId: string) {
  const a = getArtifact(ctx, artifactId);
  const record = ctx.reality.record(a.reality_id);
  const raw = record ? rawQualityValues(record) : undefined;
  const bands = ctx.reality.graph.bands;
  return {
    artifact: { id: a.id, tier: a.evidence_tier, realm: a.objective_id, name: a.fantasy_name },
    reality: {
      source: "pubchem",
      cid: a.reality_id,
      pubchemUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${a.reality_id}`,
      record,
    },
    mapping: QUALITY_KEYS.map((q) => ({
      quality: q,
      source: { burden: "molecularWeight", veil: "xlogp", reach: "tpsa", knots: "complexity", flex: "rotatableBondCount", bond: "2×hBondDonorCount + hBondAcceptorCount" }[q],
      raw: raw?.[q],
      band: bands[q],
      normalized: trueQualities(ctx, a)[q],
    })),
    evaluationNow: trueEvaluation(ctx, a, "trialed"),
    lineage: lineage(ctx, a.id),
    revisions: all(ctx.db, "SELECT revision, evidence_tier, note, created_at FROM artifact_revisions WHERE artifact_id = ? ORDER BY id", a.id),
    evaluations: all(ctx.db, "SELECT kind, technical_score, production_cost, market_value, efficiency_score, margin, snapshot_id, created_at FROM artifact_evaluations WHERE artifact_id = ? ORDER BY created_at", a.id),
    inference: all(ctx.db, "SELECT type, action, provider, request_hash, work_units, xp_awarded, created_at FROM inference_events WHERE artifact_id = ? ORDER BY created_at", a.id),
    lore: ctx.reality.evidenceSync(a.reality_id),
    disclaimer: "Fantasy qualities are a game abstraction over cached public records; they are not scientific interpretation.",
  };
}

export function economyDebug(ctx: Ctx) {
  const s = currentSnapshot(ctx);
  const bd = ctx.world.breakdowns[s.id]!;
  const p = pressure(ctx);
  return {
    snapshot: s,
    essences: ESSENCE_IDS.map((e) => ({
      essence: e,
      series: ESSENCE_MARKET_SERIES[e],
      observation: { date: bd[e].obsDate, ratePerEur: 1 / bd[e].value },
      scarcity: bd[e],
      price: essencePrice(s, e, p[e]),
      pressure: p[e],
    })),
    contracts: activeContracts(ctx),
    referenceCost: ctx.referenceCost,
    formula: {
      scarcity: "clamp(50 + 15·(|r|/σ52 − 0.8) + 10·zVol + 45·(pct52 − 0.5), 0, 100)",
      price: "base × 2^((scarcity−50)/35) × local(1 + NPC demand + player pressure) × world modifier",
      marketValue: "3·score + Smith demand + contract demand + scarcity avoidance + evidence premium",
    },
    source: "ECB euro foreign exchange reference rates (weekly, Friday close)",
  };
}

export function missingFixtures(ctx: Ctx) {
  const reqDir = resolve(ctx.config.dataDir, "inference-requests");
  const fixDir = resolve(ctx.config.dataDir, "inference-fixtures");
  const out: { type: string; hash: string }[] = [];
  if (!existsSync(reqDir)) return out;
  for (const type of readdirSync(reqDir)) {
    for (const f of readdirSync(join(reqDir, type))) {
      if (!f.endsWith(".json")) continue;
      const hash = f.replace(/\.json$/, "");
      if (!existsSync(join(fixDir, type, f))) out.push({ type, hash });
    }
  }
  return out;
}
