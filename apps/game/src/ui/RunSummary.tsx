import { returnToCrossing } from "../game/flow";
import { useStore } from "../state/store";
import { Panel } from "./Panel";
import { crowns, essenceName, fmt } from "../economy/format";

export function RunSummary() {
  const s = useStore((st) => st.runSummary);
  if (!s) return null;
  const kills = Object.values(s.combat.kills as Record<string, number>).reduce((a, b) => a + b, 0);
  return (
    <Panel title={s.status === "victory" ? "The King is unbound" : s.status === "death" ? "Your thread was cut" : "You withdrew"} onClose={returnToCrossing} testId="run-summary">
      <div className="summary">
        <div>
          Time <b>{fmt(s.combat.durationMs / 1000)}s</b> · Foes felled <b>{kills}</b> · Ward breaks <b>{s.combat.wardBreaks}</b>
        </div>
        <div>
          Gathered this run: <b>{crowns(s.loot.crowns)}</b>
          {Object.entries(s.loot.essences).map(([e, q]) => (
            <span key={e}>
              {" "}
              · {q as number} {essenceName(e)}
            </span>
          ))}
        </div>
        <div>
          Forms from this run: <b>{s.runArtifacts.length}</b> ({s.runArtifacts.filter((a: any) => a.tier === "veiled").length} still veiled)
        </div>
        {s.worldTurned && (
          <div className="event">
            A turning passes while you travel: {s.worldTurned.from} → {s.worldTurned.to}. Prices have moved.
          </div>
        )}
        {s.worldTurned?.settledProphecies?.map((p: any) => (
          <div key={p.id} className="event">
            Prophecy on {essenceName(p.essence)} settled: {p.outcome ? "it rose" : "it did not rise"} · calibration {Math.round(p.quality * 100)}%
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
