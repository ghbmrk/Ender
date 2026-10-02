import type { BattleSetup, FoeKind, LoomNode, RootId } from "@ender/battle";
import type { Hero } from "../art/look";
import { saveHero } from "./hero";
import { api } from "../api";
import { getState, setState } from "../state/store";
import { compiledParty, newBinder, refreshLoom } from "./flow";

/**
 * The prologue: a new party walks straight into a fight, and each encounter teaches one thing (§101):
 * timed strikes, Dodge and Parry in one fight, then a Form becomes a skill on the Loom, then AP and Break.
 */
export type TutStep = "strike" | "dodge" | "parry" | "form" | "skill" | "gate";

/** Words the coach says at moments in a practice fight. Each is said once. */
export type CoachKey = "command" | "attack" | "perfect" | "good" | "miss" | "ap" | "defend" | "dodged" | "parried" | "hit" | "skill" | "broken" | "now";

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
  /** Defences taught in turn against one foe, each once: the lesson ends when the last one lands. */
  drills?: ("dodge" | "parry")[];
  /** What the coach says once the drill moves on to Parry (overrides `coach`). */
  parryCoach?: Partial<Record<CoachKey, string>>;
};

export const LESSONS: Record<"dodge" | "parry" | "skill", Lesson> = {
  // Strike, Dodge and Parry in one fight against one foe (Mark, 22:05): you strike first, then dodge its blow once
  // and parry it once; the lesson ends on the first clean Parry.
  dodge: {
    step: "dodge",
    straightOn: true,
    title: "A Husk blocks the road",
    commands: "basic",
    defense: "both",
    drills: ["dodge", "parry"],
    slow: 2,
    coach: {
      command: "Tap **Basic** to attack.",
      attack: "Tap anywhere as the ring closes on the mark.",
      perfect: "**Perfect!** Well-timed strikes hit harder.",
      good: "Good. Tap a touch closer to the mark for a **Perfect**: it hits harder.",
      miss: "Missed the beat. Wait for the ring to meet the mark, then tap.",
      defend: "It strikes back! Tap **DODGE** as the red ring closes on your hero.",
      dodged: "**Dodged.** Near the ring it grazes you; right on it, the blow misses. Next, the harder one: **PARRY**.",
      hit: "Too early or too late. Tap **DODGE** just as the ring closes.",
      ap: "Each Basic also builds **AP**: the blue pips. Crafted skills spend it.",
      now: "**Now!** Tap **DODGE**.",
    },
    parryCoach: {
      command: "Attack with **Basic**. When it strikes back, tap **PARRY** as the ring closes.",
      defend: "Now **PARRY**. Only a perfect tap counts: it blocks the blow and **strikes back**. Miss it and the hit lands.",
      parried: "**Parried!** You struck back, took **+1 AP**, and the Husk took Break.",
      dodged: "Dodge keeps you safe, but only Parry strikes back. Try **PARRY** on the next blow.",
      hit: "A Parry is perfect or nothing. Tap it right as the ring meets the mark.",
      now: "**Now!** Tap **PARRY** as the blow lands.",
    },
    setup: { waves: [["husk"]], foeScale: { hp: 0.9, atk: 0.45 } },
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
      // Said at each of your turns, so the last blow's "Parry is tight" never sits over the cards when Parry can't be used.
      command: "Attack with **Basic**. When it strikes back, tap **PARRY** as the ring closes.",
      defend: "Now try **PARRY**. Only a perfect tap counts: it blocks the blow and **strikes back**. Miss it and the hit lands.",
      parried: "**Parried!** You struck back, took **+1 AP**, and the Husk took Break.",
      dodged: "Dodge keeps you safe, but only Parry strikes back. Try **PARRY** on the next blow.",
      hit: "A Parry is perfect or nothing. Tap it right as the ring meets the mark.",
      now: "**Now!** Tap **PARRY** as the blow lands.",
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
      // Every lesson holds an unanswered blow at contact, so this one needs its "now" too, or the fight just stops.
      now: "**Now!** Tap **DODGE** or **PARRY**.",
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
  goTo("dodge");
}

export function goTo(step: TutStep) {
  // Strike, Dodge and Parry are one lesson now; a save left on "strike" starts it.
  if (step === "strike") step = "dodge";
  save(step);
  if (step === "form") setState({ tutorial: step, screen: "loom", loomEditable: true, panel: null });
  // The last step isn't left to the player to find: the Gate opens with its Realms, and the coach says what they're
  // for and where their Essences sell (Mark, 22:05).
  else if (step === "gate") setState({ tutorial: step, screen: "crossing", loomEditable: true, panel: "gate" });
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

// Dodge and Parry are one lesson now ("dodge"); a save left on "parry" still goes on to the Loom.
const NEXT: Record<TutStep, TutStep | "done"> = { strike: "dodge", dodge: "form", parry: "form", form: "skill", skill: "gate", gate: "done" };

/**
 * The Training Yard: the Dodge and Parry lesson again, any time, without touching tutorial progress. Players who
 * skipped the prologue had no way to learn the two defences before the first real foe swung.
 */
export function practiseDefence() {
  setState({ tutorial: "dodge", practice: true, screen: "battle", panel: null, tutorialRun: (getState().tutorialRun ?? 0) + 1 });
}
/** Back from the Training Yard to the Crossing, tutorial progress as it was. */
export function leavePractice() {
  setState({ tutorial: null, practice: false, screen: "crossing", panel: null });
}

/** After a practice fight: a loss simply retries it, a win moves on. */
export function lessonEnded(step: TutStep, won: boolean) {
  if (getState().practice) {
    if (won) return leavePractice();
    return setState({ tutorialRun: (getState().tutorialRun ?? 0) + 1 });
  }
  if (!won) return goTo(step);
  const n = NEXT[step];
  if (n === "done") return finishTutorial();
  goTo(n);
}

export function finishTutorial(panel: "gate" | null = null) {
  save("done");
  setState({ tutorial: null, screen: "crossing", panel, loomEditable: true });
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
  // Home is the Realm choice: skipping lands there, as finishing the prologue does.
  finishTutorial("gate");
}
