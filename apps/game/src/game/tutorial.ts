import type { BattleSetup, FoeKind, LoomNode } from "@ender/battle";
import { api } from "../api";
import { getState, setState } from "../state/store";
import { compiledParty, newBinder, refreshLoom } from "./flow";

/**
 * The prologue: a new party walks straight into a fight, and each encounter teaches one thing (§101):
 * timed strikes, then Dodge, then Parry, then a Form becomes a skill on the Loom, then AP and Break.
 */
export type TutStep = "strike" | "dodge" | "parry" | "form" | "skill" | "gate";

/** Words the coach says at moments in a practice fight. Each is said once. */
export type CoachKey = "command" | "attack" | "perfect" | "good" | "miss" | "ap" | "defend" | "dodged" | "parried" | "hit" | "skill" | "broken";

export type Lesson = {
  step: TutStep;
  title: string;
  /** "basic" hides crafted Actions; "all" shows them. */
  commands: "basic" | "all";
  /** Which defence buttons appear. */
  defense: "dodge" | "both";
  /** How many timed sequences run in slow motion while the player learns them. */
  slow: number;
  coach: Partial<Record<CoachKey, string>>;
  setup: { waves: FoeKind[][]; foeScale: { hp: number; atk: number } };
};

export const LESSONS: Record<"strike" | "dodge" | "parry" | "skill", Lesson> = {
  strike: {
    step: "strike",
    title: "A Husk blocks the road",
    commands: "basic",
    defense: "both",
    slow: 2,
    coach: {
      command: "Tap **Basic** to attack.",
      attack: "Tap anywhere as the ring closes on the mark.",
      perfect: "**Perfect!** Well-timed strikes hit harder.",
      good: "Good. Tap a touch closer to the mark for a **Perfect**: it hits harder.",
      miss: "Missed the beat. Wait for the ring to meet the mark, then tap.",
    },
    setup: { waves: [["husk"]], foeScale: { hp: 0.35, atk: 0.4 } },
  },
  dodge: {
    step: "dodge",
    title: "A Wisp drifts closer",
    commands: "basic",
    defense: "dodge",
    slow: 1,
    coach: {
      command: "Attack with **Basic** again.",
      defend: "It strikes back! Tap **DODGE** as the red ring closes on your hero.",
      dodged: "**Dodged.** Dodge is forgiving: its window is wide.",
      hit: "Too early or too late. Tap **DODGE** just as the ring closes.",
      ap: "Each Basic also builds **AP**: the blue pips. Crafted skills spend it.",
    },
    setup: { waves: [["wisp"]], foeScale: { hp: 1.3, atk: 0.45 } },
  },
  parry: {
    step: "parry",
    title: "A Husk lurches out",
    commands: "basic",
    defense: "both",
    slow: 1,
    coach: {
      defend: "Now try **PARRY**. Its window is tight, but it pays: **+1 AP** and **Break** on the foe.",
      parried: "**Parried!** +1 AP, and the Husk took Break.",
      dodged: "Safe, but Dodge earns nothing. Try **PARRY** on the next blow.",
      hit: "Parry is tight. Tap it right as the ring closes.",
    },
    setup: { waves: [["husk"]], foeScale: { hp: 1.6, atk: 0.45 } },
  },
  skill: {
    step: "skill",
    title: "A Keeper guards the Gate",
    commands: "all",
    defense: "both",
    slow: 0,
    coach: {
      skill: "Your Loom made new skills. **Crafted Actions** spend the AP that Basic and Parry build.",
      broken: "**Broken!** It loses its turn and takes +25% damage. Heavy skills and Parries build Break.",
      ap: "Low on AP? **Basic** builds it back up.",
    },
    setup: { waves: [["keeper"]], foeScale: { hp: 0.8, atk: 0.5 } },
  },
};

const KEY = "ender:tutorial";
export function tutorialDone() {
  try {
    return localStorage.getItem(KEY) === "done";
  } catch {
    return false;
  }
}
function save(step: TutStep | "done") {
  try {
    localStorage.setItem(KEY, step);
  } catch {
    /* private mode */
  }
}
export function savedStep(): TutStep | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && v !== "done" ? (v as TutStep) : null;
  } catch {
    return null;
  }
}

/** Quick's first Action, lifted off the board so the player places it themselves in the "form" lesson. */
const QUICK = "quick" as const;

export async function startTutorial() {
  await newBinder({ quiet: true });
  const loom = getState().loom;
  const nodes: LoomNode[] = loom?.heroes?.[QUICK]?.nodes ?? [];
  const action = nodes.find((n) => n.role === "action");
  if (action) {
    await api.putLoom(
      QUICK,
      nodes.filter((n) => n.id !== action.id).map((n) => ({ artifactId: n.formId, q: n.q, r: n.r })),
    );
    await refreshLoom();
  }
  goTo("strike");
}

export function goTo(step: TutStep) {
  save(step);
  if (step === "form") setState({ tutorial: step, screen: "loom", loomEditable: true, panel: null });
  else if (step === "gate") setState({ tutorial: step, screen: "crossing", loomEditable: true, panel: null });
  else setState({ tutorial: step, screen: "battle", panel: null, tutorialRun: (getState().tutorialRun ?? 0) + 1 });
}

export function lessonSetup(l: Lesson): BattleSetup {
  return {
    seed: `prologue|${l.step}|${getState().tutorialRun ?? 0}`,
    party: compiledParty(),
    waves: l.setup.waves,
    difficulty: 1,
    foeScale: l.setup.foeScale,
  };
}

const NEXT: Record<TutStep, TutStep | "done"> = { strike: "dodge", dodge: "parry", parry: "form", form: "skill", skill: "gate", gate: "done" };

/** After a practice fight: a loss simply retries it, a win moves on. */
export function lessonEnded(step: TutStep, won: boolean) {
  if (!won) return goTo(step);
  const n = NEXT[step];
  if (n === "done") return finishTutorial();
  goTo(n);
}

export function finishTutorial() {
  save("done");
  setState({ tutorial: null, screen: "crossing", panel: null, loomEditable: true });
}

/** Skipping puts Quick's lifted Action back so nobody is left without a skill. */
export async function skipTutorial() {
  const loom = getState().loom;
  const placed: LoomNode[] = loom?.heroes?.[QUICK]?.nodes ?? [];
  const pooled: LoomNode | undefined = (loom?.pool ?? []).find((n: LoomNode) => n.role === "action" && n.affinities[0] === "flex");
  if (pooled && !placed.some((n) => n.role === "action") && !placed.some((n) => n.q === 1 && n.r === 0)) {
    await api
      .putLoom(QUICK, [...placed.map((n) => ({ artifactId: n.formId, q: n.q, r: n.r })), { artifactId: pooled.formId, q: 1, r: 0 }])
      .catch(() => null);
    await refreshLoom().catch(() => null);
  }
  finishTutorial();
}
