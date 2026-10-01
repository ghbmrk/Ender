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

/**
 * A fight's spoils as a passing moment, not a stop: the tiles tally in a strip across the top of the map, then fade.
 * The map stays live underneath (the next stop is already lit), so a win flows straight into the next choice.
 */
export function SpoilsStrip() {
  const r = useStore((s) => s.spoils);
  const c = useStore((s) => s.character);
  useEffect(() => {
    if (!r) return;
    sfx.loot((r.crowns > 0 ? 1 : 0) + Object.keys(r.essences ?? {}).length + (r.forms?.length ?? 0));
    const t = setTimeout(() => setState({ spoils: null }), 2600);
    return () => clearTimeout(t);
  }, [r?.at]);
  if (!r) return null;
  return (
    <div className="spoils-strip" key={r.at} data-testid="spoils">
      <div className="ss-title">{r.title ?? "Spoils"}</div>
      <div className="ss-tiles">
        {r.crowns > 0 && (
          <span className="ss-tile">
            <i>◈</i> +<Tally to={r.crowns} delay={0} /> <small>{c ? `${c.crowns} in all` : "Crowns"}</small>
          </span>
        )}
        {Object.entries(r.essences ?? {}).map(([e, q], i) => (
          <span key={e} className="ss-tile" style={{ color: essenceColor(e) }}>
            <i>{essenceGlyph(e)}</i> +<Tally to={q as number} delay={(i + 1) * 90} /> <small>{essenceName(e)}</small>
          </span>
        ))}
        {r.mirrorCharges > 0 && (
          <span className="ss-tile">
            <i>✧</i> ×{r.mirrorCharges} <small>Mirror</small>
          </span>
        )}
      </div>
    </div>
  );
}
