// The Familiar keeps working while you're away (thread "Agent play while away"). A chip on the Crossing shows its
// task and Focus; on return, a few cards show what mattered.
import { useEffect, useState } from "react";
import { api } from "../api";
import { refreshCharacter } from "../game/flow";
import { setState, toast, useStore } from "../state/store";
import { Panel } from "./Panel";
import "../familiar.css";

const FLAG = "ender:familiar";
/**
 * Baby-stepped like the Crossing's stations: the Familiar appears after the fourth weave, when there are Forms worth
 * checking. ?familiar=1 shows it early and ?familiar=0 hides it (both remembered on this device).
 */
export function familiarOn(weaves: number): boolean {
  try {
    const q = new URLSearchParams(location.search).get("familiar");
    if (q !== null) localStorage.setItem(FLAG, q === "0" ? "0" : "1");
    const forced = localStorage.getItem(FLAG);
    return forced === null ? weaves >= 4 : forced === "1";
  } catch {
    return weaves >= 4;
  }
}

/** First sight of the Familiar: one line on what it is, once. */
const MET = "ender:familiar-met";
function firstMeeting(): boolean {
  try {
    if (localStorage.getItem(MET)) return false;
    localStorage.setItem(MET, "1");
    return true;
  } catch {
    return false;
  }
}

let returned = false;

/** One task to start with; "Find a cheaper Form" joins at Loom Rank 3. */
const orderFor = (rank: number): (string | null)[] => (rank >= 3 ? [null, "validate", "cheaper"] : [null, "validate"]);
type Card = { kind: string; title: string; line: string; formIds: string[]; proposal?: { swapInto: string; replace: string } };
type Session = { focusSpent: number; tally: Record<string, number>; xpGained: number; cards: Card[] };
const VERB: Record<string, string> = { trial: "Trial", attune: "Attune", mirror: "Mirror", temper: "Temper" };

export function FamiliarChip({ rank }: { rank: number }) {
  const [f, setF] = useState<any>(null);
  // Coming back is the trigger: the Familiar spends its reserve now (milliseconds of rule work) and reports over
  // whatever sheet is open; closing it returns to the Realm choice, which is home.
  useEffect(() => {
    // Once per visit (page load), not on every trip back to the Crossing: it works while you're away, not between fights.
    const call = returned ? api.familiar().then((familiar) => ({ familiar, session: null })) : api.familiarReturn();
    returned = true;
    call
      .then((r) => {
        setF(r.familiar);
        if (!r.familiar.mandate && firstMeeting()) toast("Your Familiar can keep working while you're away. Tap it to give it a task.", "gain", true);
        if (r.session?.focusSpent || r.session?.cards.length) setState({ panel: "familiar", familiarAway: r.session });
        if (r.session) refreshCharacter().catch(() => {});
      })
      .catch(() => {});
  }, []);
  if (!f) return null;
  const cycle = async () => {
    const order = orderFor(rank);
    const next = order[(order.indexOf(f.mandate?.id ?? null) + 1) % order.length] ?? null;
    const r = await api.familiarMandate(next).catch((e: Error) => (toast(e.message, "loss"), null));
    if (r) setF(r);
  };
  const m = f.mandate ? f.mandates[f.mandate.id] : null;
  return (
    <button className="fam-chip" onClick={cycle} data-testid="familiar-chip">
      <span className="fam-what">{m ? `Familiar: ${m.title}` : "Familiar resting"}</span>
      <span className="fam-focus">{m ? `${f.reserve} Focus saved · tap to change` : "tap to give it a task"}</span>
    </button>
  );
}

export function FamiliarAway() {
  const s = useStore((st) => st.familiarAway) as Session | null | undefined;
  if (!s) return null;
  const close = () => setState({ panel: "gate", familiarAway: null });
  const tally = Object.entries(s.tally)
    .map(([k, n]) => `${n} ${VERB[k] ?? k}${n > 1 ? "s" : ""}`)
    .join(", ");
  return (
    <Panel title="While you were away" onClose={close} testId="familiar-away">
      <div className="fam-list">
        {s.cards.map((c, i) => (
          <div key={i} className={`fam-card k-${c.kind}`}>
            <b>{c.title}</b>
            <p>{c.line}</p>
            {c.proposal && (
              <button className="fam-act" onClick={() => setState({ panel: null, familiarAway: null, screen: "loom", loomEditable: true })}>
                Open the Loom
              </button>
            )}
          </div>
        ))}
        <p className="fam-tally">
          Also: {tally}. {s.focusSpent} Focus spent, +{s.xpGained} XP.
        </p>
        <button className="primary" onClick={close} data-testid="familiar-away-ok">
          Onward
        </button>
      </div>
    </Panel>
  );
}
