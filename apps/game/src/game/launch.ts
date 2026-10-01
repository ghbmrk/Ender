import { api } from "../api";
import { lookFromSeed, newSeed, randomName } from "../art/look";
import { getState, setState, toast } from "../state/store";
import { continueGame } from "./flow";
import { HERO_ROOT } from "./hero";
import { goTo, savedStep, startTutorial, tutorialDone } from "./tutorial";

/**
 * How the game opens. Signing in (a placeholder for now) is remembered in this browser, so a signed-in
 * player skips the landing screen and lands straight in the game. Hero select and hero creation are
 * never on the way in; they are reached by going back from the game.
 */
const KEY = "ender:signed-in";

export function signedIn() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function signIn() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* private mode: the landing screen simply shows again next time */
  }
}

/** Into the game: the saved hero where they left off, or, for a first-timer, a fresh hero straight into the prologue. */
export async function enterGame() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      openSave(),
      new Promise((_, no) => (timer = setTimeout(() => no(new Error("The save took too long to load. Tap Sign in to try again.")), 10000))),
    ]);
  } catch (e) {
    // Never strand the player on a blank or frozen screen: back to the landing, with the reason.
    setState({ screen: "landing" });
    toast((e as Error).message || "Couldn't open the game", "loss");
  } finally {
    clearTimeout(timer);
  }
}

async function openSave() {
  const saved =
    !!getState().hero ||
    !!savedStep() ||
    tutorialDone() ||
    (await api
      .character()
      .then((c) => c.xp > 0 || c.crowns !== 250 || c.level > 1)
      .catch(() => false));
  if (!saved) {
    await startTutorial({ root: HERO_ROOT, name: randomName(), look: lookFromSeed(newSeed()) });
    return;
  }
  await continueGame();
  const step = savedStep();
  if (step) goTo(step);
}
