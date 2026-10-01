import { RULES, type Defense, type Grade } from "./defs";

/**
 * Live timing trackers (§64, §67–69). The UI feeds them press times (ms since the sequence started) and they grade
 * each beat or impact. They are pure: the same presses always give the same grades.
 */

/** Attack beats: one press per beat; Perfect ±70 ms, Good ±150 ms, otherwise Miss. Unpressed beats are Misses. */
export class AttackTracker {
  private grades: (Grade | null)[];
  constructor(
    readonly beats: number[],
    private scale = 1,
  ) {
    this.grades = beats.map(() => null);
  }
  press(t: number): { index: number; grade: Grade } | null {
    const good = RULES.timing.good * this.scale;
    const perfect = RULES.timing.perfect * this.scale;
    const index = this.grades.findIndex((g, i) => g === null && t <= this.beats[i]! + good);
    if (index < 0) return null;
    // A press long before the beat is ignored rather than wasting the beat.
    if (t < this.beats[index]! - 2 * good) return null;
    const dt = Math.abs(t - this.beats[index]!);
    const grade: Grade = dt <= perfect ? "perfect" : dt <= good ? "good" : "miss";
    this.grades[index] = grade;
    return { index, grade };
  }
  expire(t: number): number[] {
    const good = RULES.timing.good * this.scale;
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

const within = (dt: number, [lo, hi]: readonly [number, number], scale: number) => dt >= lo * scale && dt <= hi * scale;

/**
 * Enemy impacts: every impact gets exactly one defensive input. A press always applies to the next impact that has
 * not resolved yet; if it falls outside that impact's window the input is consumed and the impact lands (§69).
 */
export class DefenseTracker {
  private results: (Defense | null)[];
  constructor(
    readonly impacts: number[],
    private scale = 1,
  ) {
    this.results = impacts.map(() => null);
  }
  press(t: number, kind: "parry" | "dodge"): { index: number; result: Defense } | null {
    this.expire(t);
    const index = this.results.findIndex((r) => r === null);
    if (index < 0) return null;
    const dt = t - this.impacts[index]!;
    // A press well before any window is ignored rather than spending the defence, so an eager tap is not punished.
    if (dt < (RULES.dodge[0] - 200) * this.scale) return null;
    let result: Defense = "hit";
    if (kind === "parry") result = within(dt, RULES.perfectParry, this.scale) ? "perfect-parry" : within(dt, RULES.parry, this.scale) ? "parry" : "hit";
    else result = within(dt, RULES.perfectDodge, this.scale) ? "perfect-dodge" : within(dt, RULES.dodge, this.scale) ? "dodge" : "hit";
    this.results[index] = result;
    return { index, result };
  }
  /** Impacts whose last possible input time has passed land. Returns the indices that just resolved. */
  expire(t: number): number[] {
    const late = Math.max(RULES.dodge[1], RULES.parry[1]) * this.scale;
    const out: number[] = [];
    this.results.forEach((r, i) => {
      if (r === null && t > this.impacts[i]! + late) {
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
