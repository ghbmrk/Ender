/** Your best climb in each Realm, kept on this device: the furthest step reached and whether its Boss fell. */
export type Record = { step: number; of: number; cleared: boolean };
const KEY = "ender:best";

export function bests(): { [realm: string]: Record } {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

/** Saves a finished run; says whether it beat the old best (a first run in a Realm counts). */
export function noteRun(realm: string, run: Record): boolean {
  const all = bests();
  const old = all[realm];
  const better = !old || (run.cleared && !old.cleared) || (!old.cleared && run.step > old.step);
  if (better) {
    all[realm] = run;
    try {
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch {
      /* private mode: the record just isn't kept */
    }
  }
  return better && !!old;
}
