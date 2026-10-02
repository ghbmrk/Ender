import { paintedBackdrop } from "../art/painted";
import { useEffect, useState, type ReactNode } from "react";
import { startExpedition, refreshWorld } from "../game/flow";
import { getState, setState, toast, useStore } from "../state/store";
import { Panel } from "./Panel";
import { PurseChip } from "./Purse";
import { bests } from "../game/records";
import { finishTutorial } from "../game/tutorial";
import { crowns, essenceColor, essenceGlyph } from "../economy/format";

/** The first Realm choice, taught a part at a time: what a Realm gives you, what it's worth, the tags, then go. */
const GATE_STEPS: { focus: string; text: ReactNode }[] = [
  { focus: "realm", text: <>Each <b>Realm</b> is a run of fights that ends in a boss. Every win drops a <b>Form</b> for your <b>Loom</b>, so any Realm makes you stronger.</> },
  { focus: "haul", text: <><b>≈ ◈ today</b> is what a run's <b>Essences</b> sell for at the <b>Bazaar</b>, which opens between any two fights. Prices change every day.</> },
  { focus: "tags", text: <><b>Pays best</b> marks today's richest Realm. <b>Wanted</b> means an open contract pays extra for Forms found there.</> },
  { focus: "next", text: <>Harder Realms hit harder. Start with the marked one: <b>tap it to set out</b>.</> },
];

export function RealmGate() {
  const world = useStore((s) => s.world);
  /** The prologue's last step: the Gate opened for you, with what Realms and the Bazaar are for. */
  const lesson = useStore((s) => s.tutorial === "gate");
  const [busy, setBusy] = useState(false);
  const [contracts, setContracts] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => {
    // Signing in has just read the world; a second read on open only delayed the Realm choice. Read it when missing.
    if (!getState().world) refreshWorld().catch((e) => toast(e.message, "loss"));
  }, []);
  const best = bests();
  // The first Realm you haven't cleared is where to go next; a new player sees "Start here" on the easiest.
  const nextUp = (world?.realms ?? []).find((r: any) => !best[r.id]?.cleared)?.id;
  const fresh = !Object.keys(best).length;
  if (!world) return <Panel title="Choose a Realm">Listening to the Gate…</Panel>;
  // Which Realm's Essences are worth the most at today's prices: the reason to pick one Realm over another.
  const richest = [...world.realms].sort((a: any, b: any) => b.haulValue - a.haulValue)[0]?.id;
  const go = async (id: string) => {
    if (busy) return;
    setBusy(true);
    if (lesson) finishTutorial();
    try {
      await startExpedition(id);
    } catch (e) {
      toast((e as Error).message, "loss");
      setBusy(false);
    }
  };
  return (
    <Panel title="Choose a Realm" subtitle={world.headline} wide testId="realm-gate">
      {/* The first Realm choice is walked through, one part of the cards at a time (Mark, 22:50). Each tap moves on;
          tapping a Realm sets out at any point. */}
      {lesson && (
        <button className="gate-why gate-lesson" onClick={() => setStep((n) => Math.min(n + 1, GATE_STEPS.length - 1))} data-testid="coach">
          <span className="gl-text">{GATE_STEPS[step]!.text}</span>
          <span className="gl-foot">
            <span className="gl-pips">
              {GATE_STEPS.map((_, i) => (
                <i key={i} className={i <= step ? "on" : ""} />
              ))}
            </span>
            {step < GATE_STEPS.length - 1 && <span className="gl-next" data-testid="gate-next">Next ›</span>}
          </span>
        </button>
      )}
      {/* Every Realm on one screen, no scrolling (Mark, 22:31): one compact row each, the whole row enters. */}
      <div className="realm-list" data-focus={lesson ? GATE_STEPS[step]!.focus : undefined}>
        {world.realms.map((r: any) => {
          const want = r.demand.find((d: any) => d.arrows !== "·");
          return (
            <button
              key={r.id}
              className={`realm-row ${r.id === nextUp ? "next-up" : ""} ${lesson && r.id === nextUp && step === GATE_STEPS.length - 1 ? "coach-pulse" : ""} ${busy ? "going" : ""}`}
              onClick={() => go(r.id)}
              data-testid={`enter-${r.id}`}
            >
              <span className="rr-art" style={paintedBackdrop(r.id) ? { backgroundImage: `url(${paintedBackdrop(r.id)})` } : undefined} data-testid={`realm-art-${r.id}`} />
              <span className="rr-body" data-testid={`realm-${r.id}`}>
                <span className="rr-top">
                  <b className="rr-name">{r.name}</b>
                  <span className="rr-diff">Difficulty {r.difficultyLabel}</span>
                </span>
                <span className="rr-haul">
                  ≈ <b>{crowns(r.haulValue)}</b> today
                  {r.expectedEssences.slice(0, 3).map((e: any) => (
                    <i key={e.essence} style={{ color: essenceColor(e.essence) }} title={e.name}>
                      {essenceGlyph(e.essence)}
                    </i>
                  ))}
                </span>
                <span className="rr-tags">
                  {r.id === nextUp && <span className="realm-next">{fresh ? "Start here" : "Next"}</span>}
                  {r.id === richest && world.realms.length > 1 && <span className="why-tag">Pays best</span>}
                  {want && <span className="why-tag want">Wanted: {want.label}</span>}
                  {best[r.id] && <span className={`realm-best ${best[r.id]!.cleared ? "cleared" : ""}`}>{best[r.id]!.cleared ? "♚ Cleared" : `Best: step ${best[r.id]!.step} of ${best[r.id]!.of}`}</span>}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {/* The Loom is never far: weave what the last run dropped before choosing the next. */}
      <div className="row gate-tools">
        <button className="realm-more" onClick={() => setContracts(!contracts)}>
          Contracts ({world.contracts.length}) {contracts ? "▴" : "▾"}
        </button>
        <PurseChip />
        <button onClick={() => setState({ screen: "loom", panel: null, loomEditable: true })} data-testid="gate-loom">
          The Loom
        </button>
      </div>
      {contracts && (
        <div className="contracts-strip">
          {world.contracts.map((c: any) => (
            <div key={c.id} className="contract-line">
              <b>{c.title}</b> — {c.description} <span className="reward">{crowns(c.reward)}</span>
              <div className="dim small">{c.reason}</div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
