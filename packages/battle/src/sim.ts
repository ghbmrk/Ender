import { TEMPLATES, type Defense, type Grade } from "./defs";
import type { Battle, Command } from "./battle";

/**
 * A scripted player for tests and balance sims only (the game has no auto-battle). It spends AP on the costliest
 * affordable Action, links the ally with the most AP-hungry kit, and otherwise uses Basic.
 */
export function scriptedCommand(b: Battle, actorId: string, grade: Grade = "good"): Command {
  const me = b.unit(actorId);
  const foes = b.living("foe");
  const target = [...foes].sort((a, c) => Number(!!c.broken) - Number(!!a.broken) || a.hp - c.hp || (a.id < c.id ? -1 : 1))[0]!;
  const affordable = b
    .actionsOf(actorId)
    .filter((a) => b.costOf(actorId, a.nodeId) <= me.ap)
    .sort((a, c) => c.apCost - a.apCost || (a.nodeId < c.nodeId ? -1 : 1));
  const pick = affordable[0];
  if (!pick) return { actor: actorId, command: "basic", target: target.id, grades: [grade] };
  const beats = TEMPLATES[pick.template].beats.length || 1;
  const ally = b.living("party").filter((p) => p.id !== actorId).sort((a, c) => a.ap - c.ap)[0];
  return { actor: actorId, command: pick.nodeId, target: target.id, ally: ally?.id, grades: Array.from({ length: beats }, () => grade), weakPoint: pick.weakPoint && grade === "perfect" };
}

/** Play a battle to the end with the scripted player; `defend(k)` picks the defence for the k-th impact overall. */
export function simulate(b: Battle, opts: { grade?: Grade; defend?: (k: number) => Defense; maxTurns?: number } = {}) {
  let n = 0;
  let k = 0;
  const defend = opts.defend ?? (() => "hit" as Defense);
  const react = () => {
    while (b.reactions.length && b.outcome === "ongoing") {
      const plan = b.reactions.shift()!;
      b.resolveFoe(plan, plan.attack.hits.map(() => defend(k++)));
      b.settle();
    }
  };
  while (b.outcome === "ongoing" && n++ < (opts.maxTurns ?? 500)) {
    const turn = b.nextTurn();
    if (b.outcome !== "ongoing") break;
    if (!turn.skipped) {
      const a = turn.actor;
      if (a.side === "party") b.resolveHero(scriptedCommand(b, a.id, opts.grade));
      else {
        const plan = b.planFoe(a.id);
        b.resolveFoe(plan, plan.attack.hits.map(() => defend(k++)));
      }
    }
    b.settle();
    react();
  }
  return { turns: n };
}
