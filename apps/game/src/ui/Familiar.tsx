// The Familiar keeps working while you're away (thread "Agent play while away"). Behind ?familiar=1 until Mark has
// seen it. A chip on the Crossing shows its task and Focus; on return, a few cards show what mattered.
import { useEffect, useState } from "react";
import { api } from "../api";
import { refreshCharacter } from "../game/flow";
import { setState, toast, useStore } from "../state/store";
import { Panel } from "./Panel";
import "../familiar.css";

const FLAG = "ender:familiar";
export function familiarOn(): boolean {
  try {
    const q = new URLSearchParams(location.search).get("familiar");
    if (q !== null) localStorage.setItem(FLAG, q === "0" ? "0" : "1");
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

const ORDER: (string | null)[] = [null, "validate", "cheaper"];
type Card = { kind: string; title: string; line: string; formIds: string[]; proposal?: { swapInto: string; replace: string } };
type Session = { focusSpent: number; tally: Record<string, number>; xpGained: number; cards: Card[] };
const VERB: Record<string, string> = { trial: "Trial", attune: "Attune", mirror: "Mirror", temper: "Temper" };

export function FamiliarChip() {
  const [f, setF] = useState<any>(null);
  // Coming back is the trigger: the Familiar spends its reserve now (milliseconds of rule work) and reports over
  // whatever sheet is open; closing it returns to the Realm choice, which is home.
  useEffect(() => {
    api
      .familiarReturn()
      .then((r) => {
        setF(r.familiar);
        if (r.session?.focusSpent || r.session?.cards.length) setState({ panel: "familiar", familiarAway: r.session });
        if (r.session) refreshCharacter().catch(() => {});
      })
      .catch(() => {});
  }, []);
  if (!f) return null;
  const cycle = async () => {
    const next = ORDER[(ORDER.indexOf(f.mandate?.id ?? null) + 1) % ORDER.length] ?? null;
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
