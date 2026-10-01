import { paintedBackdrop } from "../art/painted";
import { useEffect, useState } from "react";
import { startExpedition, refreshWorld } from "../game/flow";
import { toast, useStore } from "../state/store";
import { Panel } from "./Panel";
import { bests } from "../game/records";
import { finishTutorial } from "../game/tutorial";
import { crowns, essenceColor, essenceGlyph } from "../economy/format";

export function RealmGate() {
  const world = useStore((s) => s.world);
  /** The prologue's last step: the Gate opened for you, with what Realms and the Bazaar are for. */
  const lesson = useStore((s) => s.tutorial === "gate");
  const [busy, setBusy] = useState(false);
  /** Each Realm reads as one line and a button; the market detail opens on request. */
  const [open, setOpen] = useState<string | null>(null);
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
      <div className="realm-grid">
        {world.realms.map((r: any) => (
          <div key={r.id} className="realm-card" data-testid={`realm-${r.id}`}>
            {/* The painting is the biggest thing on the card, so a tap on it enters too. */}
            <div className={`realm-head ${paintedBackdrop(r.id) ? "has-art" : ""} ${lesson && r.id === nextUp ? "coach-pulse" : ""}`} style={paintedBackdrop(r.id) ? { ["--realm-art" as string]: `url(${paintedBackdrop(r.id)})` } : undefined} onClick={() => go(r.id)} role="button" data-testid={`realm-art-${r.id}`}>
              {r.id === nextUp && <span className="realm-next">{fresh ? "Start here" : "Next"}</span>}
              <h3>{r.name}</h3>
              <span className="diff">Difficulty {r.difficultyLabel}</span>
              {best[r.id] && (
                <span className={`realm-best ${best[r.id]!.cleared ? "cleared" : ""}`}>
                  {best[r.id]!.cleared ? "♚ Cleared" : `Best: step ${best[r.id]!.step} of ${best[r.id]!.of}`}
                </span>
              )}
            </div>
            <p className="dim">{r.tagline}</p>
            {/* What this Realm gives you right now, before you choose it. */}
            <div className="realm-why">
              <span className="haul">
                ≈ <b>{crowns(r.haulValue)}</b> in Essences today
              </span>
              {r.id === richest && world.realms.length > 1 && <span className="why-tag">Pays best</span>}
              {r.demand
                .filter((d: any) => d.arrows !== "·")
                .slice(0, 1)
                .map((d: any) => (
                  <span key={d.contractId} className="why-tag want">
                    Wanted: {d.label} · {crowns(d.reward)}
                  </span>
                ))}
              {r.events.slice(0, 1).map((e: string) => (
                <span key={e} className="why-event">{e}</span>
              ))}
            </div>
            <div className="realm-chips">
              <span className="chips-label">Drops</span>
              {r.expectedEssences.slice(0, 3).map((e: any) => (
                <span key={e.essence} className="ess-chip" style={{ color: essenceColor(e.essence), borderColor: essenceColor(e.essence) }}>
                  {essenceGlyph(e.essence)} {e.name}
                </span>
              ))}
            </div>
            {open === r.id && (
              <div className="realm-details">
            <div className="kv">
              <div className="k">Forms here are</div>
              <div className="v">{r.bias.join(" · ")}</div>
            </div>
            <div className="kv">
              <div className="k">Likely Essences</div>
              <div className="v">
                {r.expectedEssences.slice(0, 3).map((e: any) => (
                  <span key={e.essence} className="ess-chip" style={{ color: essenceColor(e.essence), borderColor: essenceColor(e.essence) }}>
                    {essenceGlyph(e.essence)} {e.name} {Math.round(e.share * 100)}% · {e.price.toFixed(1)}
                    {e.glut ? " · glut" : ""}
                  </span>
                ))}
              </div>
            </div>
            <div className="kv">
              <div className="k">Expected haul</div>
              <div className="v">≈ {crowns(r.haulValue)} in Essences at today's prices</div>
            </div>
            <div className="kv">
              <div className="k">Demand</div>
              <div className="v">
                {r.demand.length === 0 && <span className="dim">No special demand</span>}
                {r.demand.map((d: any) => (
                  <div key={d.contractId} className={`demand ${d.arrows === "↑↑" ? "hot" : ""}`}>
                    {d.label} <b>{d.arrows}</b> <span className="dim">· contract {crowns(d.reward)}</span>
                  </div>
                ))}
              </div>
            </div>
              </div>
            )}
            {/* Details sits beside Enter, so the Essences get their row to themselves. */}
            <div className="realm-actions">
                <button className="realm-more" onClick={() => setOpen(open === r.id ? null : r.id)} data-testid={`realm-more-${r.id}`}>
                  {open === r.id ? "Less" : "Details"}
                </button>
              <button className={`primary ${busy ? "going" : ""}`} onClick={() => go(r.id)} data-testid={`enter-${r.id}`}>
                Enter
              </button>
            </div>
          </div>
        ))}
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
