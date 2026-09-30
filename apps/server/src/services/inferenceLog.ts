import type { CraftAction } from "@ender/shared";
import { WORK_UNITS, xpAwardKey, xpForWorkUnits } from "@ender/domain";
import type { InferenceEnvelope, InferenceKind } from "@ender/inference";
import { now, run } from "../db";
import type { Ctx } from "./context";
import { awardXp } from "./character";
import { newId } from "./artifacts";

/**
 * Every inference call is logged here and converted to Work Units → Attunement XP.
 * Fixture/rule calls use the action's normalized WU; a future provider would convert usage metadata.
 * XP is granted at most once per (character, artifact revision, action).
 */
export function logInference(
  ctx: Ctx,
  p: { charId: string; artifactId?: string; revision?: number; kind: InferenceKind; action: CraftAction; env: InferenceEnvelope<unknown>; runId?: string | null },
) {
  const workUnits = p.env.provenance.provider === "future-chatgpt" ? p.env.usage.workUnits : WORK_UNITS[p.action];
  const key = xpAwardKey(p.charId, p.artifactId ?? "none", p.revision ?? 1, p.action);
  const { xp, levelsGained } = awardXp(ctx, p.charId, key, xpForWorkUnits(workUnits));
  run(
    ctx.db,
    "INSERT INTO inference_events (id, character_id, artifact_id, type, action, request_hash, provider, work_units, xp_awarded, run_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    newId("inf"),
    p.charId,
    p.artifactId ?? null,
    p.kind,
    p.action,
    p.env.provenance.requestHash,
    p.env.provenance.provider,
    workUnits,
    xp,
    p.runId ?? null,
    now(),
  );
  return { workUnits, xp, levelsGained, provider: p.env.provenance.provider, requestHash: p.env.provenance.requestHash, repeated: xp === 0 };
}
