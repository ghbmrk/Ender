import { returnToCrossing } from "../game/flow";
import { useStore } from "../state/store";
import { Panel } from "./Panel";
import { essenceColor, essenceGlyph, essenceName } from "../economy/format";

export function RunSummary() {
  const s = useStore((st) => st.runSummary);
  if (!s) return null;
  const title = s.outcome === "victory" ? "Expedition complete" : s.outcome === "death" ? "Driven back" : "You withdrew";
  return (
    <Panel title={title} onClose={returnToCrossing} testId="run-summary">
      <div className="summary">
        {s.outcome === "death" && <p className="dim">You keep everything you found. Rest at the Crossing and try again.</p>}
        {s.totals && (
          <div className="loot">
            <div className="loot-tile crowns">
              <span className="lt-glyph">◈</span>
              <b>{s.totals.crowns ?? 0}</b>
              <span className="lt-name">Crowns</span>
            </div>
            {Object.entries(s.totals.essences ?? {}).map(([e, q]) => (
              <div key={e} className="loot-tile" style={{ ["--c" as string]: essenceColor(e) }}>
                <span className="lt-glyph">{essenceGlyph(e)}</span>
                <b>{q as number}</b>
                <span className="lt-name">{essenceName(e)}</span>
              </div>
            ))}
            {!!s.totals.forms && (
              <div className="loot-tile form">
                <span className="lt-glyph">?</span>
                <b>{s.totals.forms}</b>
                <span className="lt-name">{s.totals.forms === 1 ? "Form found" : "Forms found"}</span>
              </div>
            )}
          </div>
        )}
        {s.worldTurned && (
          <div className="event">
            Time passed in the world while you were away, and prices have moved.
          </div>
        )}
        {s.worldTurned?.settledProphecies?.map((p: any) => (
          <div key={p.id} className="event">
            Prophecy on {essenceName(p.essence)} settled: {p.outcome ? "it rose" : "it did not rise"}
          </div>
        ))}
      </div>
      <div className="row end">
        <button className="primary" onClick={returnToCrossing} data-testid="return-crossing">
          Return to the Crossing
        </button>
      </div>
    </Panel>
  );
}
