import { paintedBackdrop } from "../art/painted";
import { useEffect, useState } from "react";
import { startExpedition, refreshWorld } from "../game/flow";
import { setState, toast, useStore } from "../state/store";
import { Panel } from "./Panel";
import { bests } from "../game/records";
import { finishTutorial } from "../game/tutorial";
import { crowns, essenceColor, essenceGlyph } from "../economy/format";

export function RealmGate() {
  const world = useStore((s) => s.world);
  /** The prologue's last step: the Gate opened for you, with what Realms and the Bazaar are for. */
  const lesson = useStore((s) => s.tutorial === "gate");
  const [busy, setBusy] = useState(false);
  const [contracts, setContracts] = useState(false);
  useEffect(() => {
    refreshWorld().catch((e) => toast(e.message, "loss"));
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
      {lesson ? (
        <p className="gate-why gate-lesson" data-testid="coach">
          <span className="gl-mark">✦</span>Pick a <b>Realm</b> to set out. Each drops different <b>Essences</b>, which sell at the <b>Bazaar</b> between any two fights. Today's prices decide which Realm pays best; start with the marked one.
        </p>
      ) : (
        <p className="gate-why">Each Realm drops different Essences. Today's prices set what a run there is worth.</p>
      )}
      {/* Every Realm on one screen, no scrolling (Mark, 22:31): one compact row each, the whole row enters. */}
      <div className="realm-list">
        {world.realms.map((r: any) => {
          const want = r.demand.find((d: any) => d.arrows !== "·");
          return (
            <button
              key={r.id}
              className={`realm-row ${lesson && r.id === nextUp ? "coach-pulse" : ""} ${busy ? "going" : ""}`}
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
        <button onClick={() => setState({ screen: "loom", panel: null, loomEditable: true })} data-testid="gate-loom">
          The Loom
        </button>
      </div>
      <div className="contracts-strip">
        <button className="realm-more" onClick={() => setContracts(!contracts)}>
          Open contracts ({world.contracts.length}) {contracts ? "▴" : "▾"}
        </button>
        {contracts && world.contracts.map((c: any) => (
          <div key={c.id} className="contract-line">
            <b>{c.title}</b> — {c.description} <span className="reward">{crowns(c.reward)}</span>
            <div className="dim small">{c.reason}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
