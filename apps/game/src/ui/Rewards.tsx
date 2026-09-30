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
      <div className="rewards">
        {r.crowns > 0 && <div className="reward-line">+{r.crowns} Crowns</div>}
        {Object.entries(r.essences ?? {}).map(([e, q]) => (
          <div key={e} className="reward-line" style={{ color: essenceColor(e) }}>
            {essenceGlyph(e)} +{q as number} {essenceName(e)}
          </div>
        ))}
        {(r.forms ?? []).map((f: any) => (
          <div key={f.id} className="reward-line form">
            ◇ {f.fantasyName ?? f.name ?? "A Veiled Form"} <span className="dim">· veiled</span>
          </div>
        ))}
        {r.mirrorCharges > 0 && <div className="reward-line">✧ Mirror charge ×{r.mirrorCharges}</div>}
        {r.note && <p className="dim">{r.note}</p>}
      </div>
      <div className="row end">
        <button className="primary" onClick={close} data-testid="rewards-ok">
          Onward
        </button>
      </div>
    </Panel>
  );
}
