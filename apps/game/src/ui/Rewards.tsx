import { setState, useStore } from "../state/store";
import { Panel } from "./Panel";
import { essenceColor, essenceGlyph, essenceName } from "../economy/format";

/** Spoils after a fight or a Mystery (§78): Essences, Veiled Forms, Mirror charges. No equipment. */
export function Rewards() {
  const r = useStore((s) => s.rewards);
  if (!r) return null;
  const close = () => setState({ panel: null, rewards: null });
  return (
    <Panel title={r.title ?? "Spoils"} onClose={close} testId="rewards">
      {/* Loot lands as tiles, one after another, so a haul feels like a haul. */}
      <div className="loot">
        {r.crowns > 0 && (
          <div className="loot-tile crowns">
            <span className="lt-glyph">◈</span>
            <b>+{r.crowns}</b>
            <span className="lt-name">Crowns</span>
          </div>
        )}
        {Object.entries(r.essences ?? {}).map(([e, q]) => (
          <div key={e} className="loot-tile" style={{ ["--c" as string]: essenceColor(e) }}>
            <span className="lt-glyph">{essenceGlyph(e)}</span>
            <b>+{q as number}</b>
            <span className="lt-name">{essenceName(e)}</span>
          </div>
        ))}
        {(r.forms ?? []).map((f: any) => (
          <div key={f.id} className="loot-tile form">
            <span className="lt-glyph">?</span>
            <b>New Form</b>
            <span className="lt-name">{f.fantasyName ?? f.name ?? "veiled"}</span>
          </div>
        ))}
        {r.mirrorCharges > 0 && (
          <div className="loot-tile mirror">
            <span className="lt-glyph">✧</span>
            <b>×{r.mirrorCharges}</b>
            <span className="lt-name">Mirror charge</span>
          </div>
        )}
      </div>
      {r.note && <p className="dim">{r.note}</p>}
      <div className="row end">
        <button className="primary" onClick={close} data-testid="rewards-ok">
          Onward
        </button>
      </div>
    </Panel>
  );
}
