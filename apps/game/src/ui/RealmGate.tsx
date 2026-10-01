import { paintedBackdrop } from "../art/painted";
import { useEffect, useState } from "react";
import { startExpedition, refreshWorld } from "../game/flow";
import { toast, useStore } from "../state/store";
import { Panel } from "./Panel";
import { bests } from "../game/records";
import { crowns, essenceColor, essenceGlyph } from "../economy/format";

export function RealmGate() {
  const world = useStore((s) => s.world);
  const [busy, setBusy] = useState(false);
  /** Each Realm reads as one line and a button; the market detail opens on request. */
  const [open, setOpen] = useState<string | null>(null);
  const [contracts, setContracts] = useState(false);
  useEffect(() => {
    refreshWorld().catch((e) => toast(e.message, "loss"));
  }, []);
  const best = bests();
  if (!world) return <Panel title="Realm Gate">Listening to the Gate…</Panel>;
  const go = async (id: string) => {
    setBusy(true);
    try {
      await startExpedition(id);
    } catch (e) {
      toast((e as Error).message, "loss");
      setBusy(false);
    }
  };
  return (
    <Panel title="Realm Gate" subtitle={world.headline} wide testId="realm-gate">
      <div className="realm-grid">
        {world.realms.map((r: any) => (
          <div key={r.id} className="realm-card" data-testid={`realm-${r.id}`}>
            <div className={`realm-head ${paintedBackdrop(r.id) ? "has-art" : ""}`} style={paintedBackdrop(r.id) ? { ["--realm-art" as string]: `url(${paintedBackdrop(r.id)})` } : undefined}>
              <h3>{r.name}</h3>
              <span className="diff">Difficulty {r.difficultyLabel}</span>
              {best[r.id] && (
                <span className={`realm-best ${best[r.id]!.cleared ? "cleared" : ""}`}>
                  {best[r.id]!.cleared ? "♚ Cleared" : `Best: step ${best[r.id]!.step} of ${best[r.id]!.of}`}
                </span>
              )}
            </div>
            <p className="dim">{r.tagline}</p>
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
            {r.events.map((e: string) => (
              <div key={e} className="event">
                {e}
              </div>
            ))}
              </div>
            )}
            {/* Details sits beside Set out, so the Essences get their row to themselves. */}
            <div className="realm-actions">
                <button className="realm-more" onClick={() => setOpen(open === r.id ? null : r.id)} data-testid={`realm-more-${r.id}`}>
                  {open === r.id ? "Less" : "Details"}
                </button>
              <button className="primary" disabled={busy} onClick={() => go(r.id)} data-testid={`enter-${r.id}`}>
                Set out
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
