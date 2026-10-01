import { returnToCrossing } from "../game/flow";
import { useEffect } from "react";
import { useStore } from "../state/store";
import { sfx } from "./battle/sfx";
import { Panel } from "./Panel";
import { FOES, type FoeKind } from "@ender/battle";
import { Head } from "./battle/Figure";
import { essenceColor, essenceGlyph, essenceName } from "../economy/format";

export function RunSummary() {
  const s = useStore((st) => st.runSummary);
  useEffect(() => {
    if (!s) return;
    sfx.loot(1 + Object.keys(s.totals?.essences ?? {}).length + (s.totals?.forms ? 1 : 0));
    if (s.newBest || s.outcome === "victory") sfx.best();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s]);
  if (!s) return null;
  const boss = s.boss ? FOES[s.boss as FoeKind] : undefined;
  const title = s.outcome === "victory" ? "Realm cleared" : s.outcome === "death" ? "Driven back" : "You withdrew";
  return (
    <Panel title={title} onClose={returnToCrossing} testId="run-summary">
      <div className="summary">
        {/* A win shows what you beat: the Boss, crossed out in gold, and the whole climb lit. */}
        {s.outcome === "victory" && (
          <div className="sum-win">
            <span className="sw-face">
              <Head figure={boss?.figure ?? s.boss ?? "husk"} size={110} />
              <i className="sw-slash" />
            </span>
            <div className="sw-text">
              <span>
                <b>{boss?.name ?? "The Boss"}</b> is beaten.
              </span>
              {s.firstClear && <em className="sum-best">First clear</em>}
              {s.reached?.of > 0 && (
                <div className="sum-track won">
                  {Array.from({ length: s.reached.of }, (_, i) => (
                    <i key={i} className={i === s.reached.of - 1 ? "on crown" : "on"} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {s.outcome !== "victory" && s.reached?.step > 0 && (
          <div className="sum-reach">
            <span>
              You reached step <b>{s.reached.step}</b> of {s.reached.of}
              {s.newBest && <em className="sum-best">New best</em>}
            </span>
            <div className="sum-track">
              {Array.from({ length: s.reached.of }, (_, i) => (
                <i key={i} className={i < s.reached.step ? "on" : i === s.reached.of - 1 ? "boss" : ""} />
              ))}
            </div>
          </div>
        )}
        {s.outcome === "death" && s.fellTo && (
          <div className="sum-fell">
            {/^The /.test(s.fellTo.name) ? "" : "The "}
            <b>{s.fellTo.name}</b>
            {s.fellTo.boss ? ", the Boss," : ""} had <b>{Math.max(1, Math.round(s.fellTo.left * 100))}%</b> of its health left.
            <div className="gbar hp">
              <div style={{ width: `${Math.max(2, s.fellTo.left * 100)}%` }} />
            </div>
          </div>
        )}
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
