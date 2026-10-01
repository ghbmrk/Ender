import type { BattleSetup, FoeKind, LoomNode, RootId } from "@ender/battle";
import type { Hero } from "../art/look";
import { saveHero } from "./hero";
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
  /** Which defence buttons appear; "none" means the foe's blows simply miss (the first fight is about attacking). */
  defense: "none" | "dodge" | "both";
  /** How many timed sequences run in slow motion while the player learns them. */
  slow: number;
  coach: Partial<Record<CoachKey, string>>;
  setup: { waves: FoeKind[][]; foeScale: { hp: number; atk: number } };
  /** A win goes straight on to the next step, with no victory screen (the last fight before the Loom). */
  straightOn?: boolean;
};

export const LESSONS: Record<"strike" | "dodge" | "parry" | "skill", Lesson> = {
  strike: {
    step: "strike",
    title: "A Husk blocks the road",
    commands: "basic",
    defense: "none",
    slow: 2,
    coach: {
      command: "Tap **Basic** to attack.",
      attack: "Tap anywhere as the ring closes on the mark.",
      perfect: "**Perfect!** Well-timed strikes hit harder.",
      good: "Good. Tap a touch closer to the mark for a **Perfect**: it hits harder.",
      miss: "Missed the beat. Wait for the ring to meet the mark, then tap.",
    },
    setup: { waves: [["husk"]], foeScale: { hp: 0.5, atk: 0.4 } },
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
    setup: { waves: [["wisp"]], foeScale: { hp: 0.6, atk: 0.45 } },
  },
  parry: {
    step: "parry",
    // Strike, dodge and parry are learned: straight into the Loom to learn the skill tree.
    straightOn: true,
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
    setup: { waves: [["husk"]], foeScale: { hp: 0.65, atk: 0.45 } },
  },
  skill: {
    step: "skill",
    title: "A Keeper guards the Gate",
    commands: "all",
    defense: "both",
    slow: 0,
    coach: {
      skill: "Your new skill is ready. **Crafted Actions** spend the AP that Basic and Parry build.",
      broken: "**Broken!** It loses its turn and takes +25% damage. Heavy skills and Parries build Break.",
      ap: "Low on AP? **Basic** builds it back up.",
    },
    setup: { waves: [["keeper"]], foeScale: { hp: 0.4, atk: 0.4 } },
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

/** The hero's Root: its first Action is lifted off the board so the player places it themselves in the "form" lesson. */
const heroRoot = (): RootId => getState().hero?.root ?? "quick";

export async function startTutorial(hero?: Hero) {
  if (hero) saveHero(hero);
  await newBinder({ quiet: true });
  const root = heroRoot();
  const loom = getState().loom;
  const nodes: LoomNode[] = loom?.heroes?.[root]?.nodes ?? [];
  const action = nodes.find((n) => n.role === "action");
  if (action) {
    await api.putLoom(
      root,
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
    fieldCap: 1,
    calm: true,
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

/** Skipping puts the hero's lifted Action back so nobody is left without a skill. */
/** The dominant Affinity of each Root's starter Action (server grantStarterKit). */
const STARTER_AFFINITY: Record<RootId, string> = { iron: "burden", bond: "bond", quick: "flex" };

export async function skipTutorial() {
  const root = heroRoot();
  const loom = getState().loom;
  const placed: LoomNode[] = loom?.heroes?.[root]?.nodes ?? [];
  const pooled: LoomNode | undefined = (loom?.pool ?? []).find((n: LoomNode) => n.role === "action" && n.affinities[0] === STARTER_AFFINITY[root]);
  if (pooled && !placed.some((n) => n.role === "action") && !placed.some((n) => n.q === 1 && n.r === 0)) {
    await api
      .putLoom(root, [...placed.map((n) => ({ artifactId: n.formId, q: n.q, r: n.r })), { artifactId: pooled.formId, q: 1, r: 0 }])
      .catch(() => null);
    await refreshLoom().catch(() => null);
  }
  finishTutorial();
}
