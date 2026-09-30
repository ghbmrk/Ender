import type { EliteModifier, EnemyKind } from "@ender/content";
import { FIELD_CAP, type FoeSpec } from "./battle";

/** A wave as the run plan lists it: one entry per enemy (a swarm is four entries). */
export type PlannedFoe = { kind: EnemyKind; elite?: EliteModifier };

const WEIGHT: Record<EnemyKind, number> = { keeper: 3, seer: 2, hound: 1.5, husk: 1, wisp: 1, swarm: 1 };

/**
 * Turn a planned wave into a turn-based one: each group of up to four swarm entries is one Swarm, elites come first,
 * then the heaviest foes, up to the field cap. Order within the result is the planned order, so the same plan always
 * gives the same encounter.
 */
export function waveToEncounter(wave: PlannedFoe[], cap = FIELD_CAP): FoeSpec[] {
  const units: (FoeSpec & { order: number })[] = [];
  let swarmCount = 0;
  wave.forEach((f, order) => {
    if (f.kind === "swarm" && !f.elite) {
      if (swarmCount++ % 4 === 0) units.push({ kind: "swarm", order });
      return;
    }
    units.push({ kind: f.kind, elite: f.elite, order });
  });
  const ranked = [...units].sort((a, b) => (b.elite ? 1 : 0) - (a.elite ? 1 : 0) || WEIGHT[b.kind as EnemyKind] - WEIGHT[a.kind as EnemyKind] || a.order - b.order);
  return ranked
    .slice(0, cap)
    .sort((a, b) => a.order - b.order)
    .map(({ kind, elite }) => (elite ? { kind, elite } : { kind }));
}

/** The encounter for one room of a run plan. */
export function roomEncounter(room: { kind: string; waves: PlannedFoe[][] }): FoeSpec[][] {
  if (room.kind === "boss") return [[{ kind: "king" }]];
  return room.waves.map((w) => waveToEncounter(w)).filter((w) => w.length);
}
