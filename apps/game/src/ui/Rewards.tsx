import { useEffect, useState } from "react";
import { setState, useStore } from "../state/store";
import { sfx } from "./battle/sfx";
import { Panel } from "./Panel";
import { essenceColor, essenceGlyph, essenceName } from "../economy/format";

/** Spoils after a fight or a Mystery (§78): Essences, Veiled Forms, Mirror charges. No equipment. */
export function Rewards() {
  const r = useStore((s) => s.rewards);
  useEffect(() => {
    if (r) sfx.loot((r.crowns > 0 ? 1 : 0) + Object.keys(r.essences ?? {}).length + (r.forms?.length ?? 0));
  }, [r]);
  const c = useStore((s) => s.character);
  if (!r) return null;
  const close = () => setState({ panel: null, rewards: null });
  return (
    <Panel title={r.title ?? "Spoils"} onClose={close} testId="rewards">
      {/* Loot lands as tiles, one after another, so a haul feels like a haul. */}
      <div className="loot">
        {r.crowns > 0 && (
          <div className="loot-tile crowns">
            <span className="lt-glyph">◈</span>
            <b>
              +<Tally to={r.crowns} delay={0} />
            </b>
            <span className="lt-name">Crowns</span>
            {c && <span className="lt-have">{c.crowns} in all</span>}
          </div>
        )}
        {Object.entries(r.essences ?? {}).map(([e, q], i) => (
          <div key={e} className="loot-tile" style={{ ["--c" as string]: essenceColor(e) }}>
            <span className="lt-glyph">{essenceGlyph(e)}</span>
            <b>
              +<Tally to={q as number} delay={(i + (r.crowns > 0 ? 1 : 0)) * 90} />
            </b>
            <span className="lt-name">{essenceName(e)}</span>
            {c?.essences?.[e] !== undefined && <span className="lt-have">{c.essences[e]} in all</span>}
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

/** A number that counts up as its tile lands, so each gain registers. */
function Tally({ to, delay }: { to: number; delay: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return setN(to);
    let raf = 0;
    const start = performance.now() + delay + 120;
    const step = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - start) / 420));
      setN(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, delay]);
  return <>{n}</>;
}
