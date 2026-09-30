import { clamp, round, type FormQualities, type ObjectiveConstraint, type QualityKey, type RealmObjective } from "@ender/shared";

export type Contribution = {
  quality: QualityKey;
  mode: ObjectiveConstraint["mode"];
  weight: number;
  /** 0..100 satisfaction of this constraint. */
  satisfaction: number;
  /** weight × satisfaction — points contributed to technicalScore. */
  points: number;
  /** weight × (100 − satisfaction) — points lost. */
  loss: number;
};

export function constraintSatisfaction(c: ObjectiveConstraint, v: number): number {
  switch (c.mode) {
    case "maximize":
      return clamp(v, 0, 100);
    case "minimize":
      return clamp(100 - v, 0, 100);
    case "target": {
      const z = (v - c.target) / Math.max(1, c.tolerance);
      return clamp(100 * Math.exp(-0.5 * z * z), 0, 100);
    }
  }
}

export function scoreObjective(q: FormQualities, objective: RealmObjective) {
  const totalWeight = objective.constraints.reduce((s, c) => s + c.weight, 0) || 1;
  const contributions: Contribution[] = objective.constraints.map((c) => {
    const w = c.weight / totalWeight;
    const s = constraintSatisfaction(c, q[c.quality]);
    return { quality: c.quality, mode: c.mode, weight: w, satisfaction: round(s, 1), points: round(w * s, 2), loss: round(w * (100 - s), 2) };
  });
  const technicalScore = round(clamp(contributions.reduce((s, c) => s + c.weight * c.satisfaction, 0), 0, 100), 1);
  return { technicalScore, contributions };
}

export const technicalScore = (q: FormQualities, o: RealmObjective) => scoreObjective(q, o).technicalScore;

/** Constraints ordered by points lost, largest first. */
export function weaknesses(q: FormQualities, o: RealmObjective): Contribution[] {
  return [...scoreObjective(q, o).contributions].sort((a, b) => b.loss - a.loss);
}

/** Perturbed copies of an objective used by Mirror's robustness check. */
export function mirrorObjectives(o: RealmObjective): RealmObjective[] {
  const shifts = [
    [1.2, 0.8, 1, 1],
    [0.8, 1.2, 1, 1],
    [1, 1, 1.2, 0.8],
    [1, 0.9, 0.9, 1.2],
  ];
  return shifts.map((s, i) => ({
    id: `${o.id}~mirror${i}`,
    constraints: o.constraints.map((c, j) => {
      const w = c.weight * (s[j % s.length] ?? 1);
      if (c.mode === "target") return { ...c, weight: w, target: c.target + (i % 2 === 0 ? 5 : -5) };
      return { ...c, weight: w };
    }),
  }));
}
