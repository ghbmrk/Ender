import { BRANCHES, PASSIVES } from "@ender/content";
import { canAllocate } from "@ender/domain";
import { now, run, tx } from "../db";
import type { Ctx } from "./context";
import { HttpError, charRow, characterView, passiveIds, policyFor } from "./character";

export function passivesView(ctx: Ctx, charId: string) {
  const allocated = passiveIds(ctx, charId);
  return {
    branches: BRANCHES,
    nodes: PASSIVES.map((p) => ({ ...p, allocated: allocated.includes(p.id), available: canAllocate(p.id, allocated).ok })),
    pointsAvailable: charRow(ctx, charId).passive_points,
    policy: policyFor(ctx, charId),
  };
}

export function allocatePassive(ctx: Ctx, charId: string, id: string) {
  const c = charRow(ctx, charId);
  if (c.passive_points < 1) throw new HttpError(400, "no passive points available");
  const check = canAllocate(id, passiveIds(ctx, charId));
  if (!check.ok) throw new HttpError(400, check.reason!);
  const before = policyFor(ctx, charId);
  tx(ctx.db, () => {
    run(ctx.db, "INSERT INTO passive_allocations (character_id, passive_id, allocated_at) VALUES (?, ?, ?)", charId, id, now());
    run(ctx.db, "UPDATE characters SET passive_points = passive_points - 1 WHERE id = ?", charId);
  });
  return { allocated: id, policyBefore: before, policy: policyFor(ctx, charId), character: characterView(ctx, charId) };
}
