import { WINDOWS, type Defense, type Grade } from "./defs";

/**
 * Live timing trackers. The UI feeds them press times (ms since the sequence started, from performance.now())
 * and they grade each beat or hit. They are pure, so the same presses always give the same grades.
 */

/** Attack beats: one press per beat, graded by distance to the beat. Unpressed beats are misses. */
export class AttackTracker {
  private grades: (Grade | null)[];
  constructor(readonly beats: number[], private scale = 1) {
    this.grades = beats.map(() => null);
  }
  /** The beat index a press at time t would grade, and its grade; null if no beat is in reach. */
  press(t: number): { index: number; grade: Grade } | null {
    const good = WINDOWS.attack.good * this.scale;
    const perfect = WINDOWS.attack.perfect * this.scale;
    // The earliest ungraded beat that has not fully passed.
    const index = this.grades.findIndex((g, i) => g === null && t <= this.beats[i]! + good);
    if (index < 0) return null;
    const dt = Math.abs(t - this.beats[index]!);
    // Too early for this beat: ignore the press rather than burn the beat.
    if (t < this.beats[index]! - good * 1.8) return null;
    const grade: Grade = dt <= perfect ? "perfect" : dt <= good ? "good" : "miss";
    this.grades[index] = grade;
    return { index, grade };
  }
  /** Beats whose window has passed without a press become misses. */
  expire(t: number): number[] {
    const good = WINDOWS.attack.good * this.scale;
    const out: number[] = [];
    this.grades.forEach((g, i) => {
      if (g === null && t > this.beats[i]! + good) {
        this.grades[i] = "miss";
        out.push(i);
      }
    });
    return out;
  }
  get done() {
    return this.grades.every((g) => g !== null);
  }
  result(): Grade[] {
    return this.grades.map((g) => g ?? "miss");
  }
}

/**
 * Enemy hits: Dodge (wide window) or Parry (tight window). A press claims the nearest unresolved hit within its window,
 * even one still to come. A press that claims nothing is a whiff and locks both buttons briefly.
 */
export class DefenseTracker {
  private results: (Defense | null)[];
  private lockedUntil = -Infinity;
  constructor(readonly hits: number[], private scale = 1) {
    this.results = hits.map(() => null);
  }
  press(t: number, kind: "parry" | "dodge"): { index: number; result: Defense } | { whiff: true } | { locked: true } {
    if (t < this.lockedUntil) return { locked: true };
    const w = (kind === "parry" ? WINDOWS.defense.parry : WINDOWS.defense.dodge) * this.scale;
    let best = -1;
    let bestDt = Infinity;
    this.results.forEach((r, i) => {
      if (r !== null) return;
      const dt = Math.abs(t - this.hits[i]!);
      if (dt <= w && dt < bestDt) {
        best = i;
        bestDt = dt;
      }
    });
    if (best < 0) {
      this.lockedUntil = t + WINDOWS.defense.whiffLockout;
      return { whiff: true };
    }
    this.results[best] = kind;
    return { index: best, result: kind };
  }
  /** Hits whose time has come without a successful press land. Call every frame; returns the hits that just resolved as "hit". */
  expire(t: number): number[] {
    const out: number[] = [];
    // A hit lands once it can no longer be claimed by even the widest window.
    const w = WINDOWS.defense.dodge * this.scale;
    this.results.forEach((r, i) => {
      if (r === null && t > this.hits[i]! + w) {
        this.results[i] = "hit";
        out.push(i);
      }
    });
    return out;
  }
  resultAt(i: number) {
    return this.results[i];
  }
  get done() {
    return this.results.every((r) => r !== null);
  }
  result(): Defense[] {
    return this.results.map((r) => r ?? "hit");
  }
}
