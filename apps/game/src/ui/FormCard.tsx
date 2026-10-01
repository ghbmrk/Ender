import type { CSSProperties, ReactNode } from "react";
import { AFF_COLOR, AFF_DEEP } from "./affinity";
import { CardArt, formAffinities } from "./CardArt";
import { paintedCard } from "../art/painted";

function hashPct(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}
import { QUALITY_KEYS } from "@ender/shared";
import { QUALITY_DESCRIPTIONS } from "@ender/content";
import { TIER_LABEL, crowns, essenceColor, essenceGlyph, essenceName, fmt, qualityName } from "../economy/format";

export function QualityRunes({ qualities, highlight }: { qualities: Record<string, { value: number; exact: boolean; uncertainty?: number } | undefined>; highlight?: string[] }) {
  return (
    <div className="runes">
      {QUALITY_KEYS.map((q) => {
        const v = qualities[q];
        return (
          <div key={q} className={`rune ${v ? "" : "hidden"} ${highlight?.includes(q) ? "hl" : ""}`} title={(QUALITY_DESCRIPTIONS as Record<string, string>)[q]}>
            <span className="rn">{qualityName(q)}</span>
            <div className="rbar">
              {v && <div className="rfill" style={{ width: `${v.value}%`, opacity: v.exact ? 1 : 0.6 }} />}
              {v && !v.exact && v.uncertainty && <div className="rband" style={{ left: `${Math.max(0, v.value - v.uncertainty)}%`, width: `${Math.min(100, 2 * v.uncertainty)}%` }} />}
            </div>
            <span className="rv">{v ? `${v.exact ? "" : "≈"}${Math.round(v.value)}` : "?"}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Recipe({ recipe }: { recipe?: Record<string, number> }) {
  if (!recipe) return null;
  return (
    <div className="recipe">
      {Object.entries(recipe).map(([e, q]) => (
        <span key={e} className="ess-chip" style={{ borderColor: essenceColor(e), color: essenceColor(e) }}>
          {essenceGlyph(e)} {q} {essenceName(e)}
        </span>
      ))}
    </div>
  );
}

/**
 * A Form's worth in two numbers a player can act on: how strong it is and what it would fetch, with a
 * verdict on whether making it pays. The fuller breakdown (score, cost, margin, efficiency) stays in the
 * tooltip.
 */
export function EvalLine({ ev }: { ev: any }) {
  if (!ev) return <div className="eval dim">Unknown until Attuned.</div>;
  const t = ev.exact ? "" : "~";
  const detail = `Score ${t}${fmt(ev.technicalScore, 1)} · Cost ${t}${fmt(ev.productionCost)} · Margin ${t}${fmt(ev.margin)} · Efficiency ${t}${fmt(ev.efficiency)}`;
  return (
    <div className="eval" title={detail}>
      <span className="ev-big">
        <small>Power</small>
        <b>
          {t}
          {fmt(ev.power, 0)}
        </b>
      </span>
      <span className="ev-big">
        <small>Worth</small>
        <b>
          {t}
          {crowns(ev.marketValue)}
        </b>
      </span>
      <span className={`ev-verdict ${ev.margin >= 0 ? "good" : "bad"}`}>{ev.margin >= 0 ? `Pays ${t}${fmt(ev.margin)}` : "Costs more than it's worth"}</span>
    </div>
  );
}

export function FormCard({ a, children, compact, selected, onClick }: { a: any; children?: ReactNode; compact?: boolean; selected?: boolean; onClick?: () => void }) {
  const fam = a.familiar;
  const [dom, second] = a.tier === "veiled" ? [null, null] : formAffinities(a.qualities);
  // Colour identity: the frame takes the dominant Affinity's pigment (a Veiled Form is uncoloured).
  const style = dom ? ({ ["--aff" as string]: AFF_COLOR[dom], ["--aff-deep" as string]: AFF_DEEP[dom], ["--aff2" as string]: AFF_COLOR[second ?? dom] } as CSSProperties) : undefined;
  return (
    <div className={`form-card tier-${a.tier} ${dom ? `aff-${dom}` : "aff-none"} ${selected ? "selected" : ""} ${compact ? "compact" : ""}`} style={style} onClick={onClick} data-testid={`form-${a.id}`} data-tier={a.tier}>
      <div className="fc-head">
        <div>
          <div className="fc-name">{a.name}</div>
          {a.epithet && <div className="fc-epithet">{a.epithet}</div>}
        </div>
        <div className="fc-badges">
          <span className={`tier tier-${a.tier}`}>{TIER_LABEL[a.tier]}</span>
          {a.inscribedRole && <span className="slot-badge">{a.inscribedRole}</span>}
        </div>
      </div>
      {!compact && (
        <div className="fc-art">
          {dom && paintedCard(dom) ? (
            // The Affinity's painting, framed differently per Form so no two cards crop it alike.
            <div className="fc-paint" style={{ backgroundImage: `url(${paintedCard(dom)})`, backgroundPosition: `${(hashPct(a.id) * 100).toFixed(0)}% ${(hashPct(a.id + "y") * 100).toFixed(0)}%` }} />
          ) : (
            <CardArt seed={a.id} aff={dom} aff2={second} />
          )}
        </div>
      )}
      <div className="fc-realm">
        {dom ? <span className="fc-type-aff">{dom}</span> : <span className="fc-type-aff">Veiled</span>}
        {second && second !== dom && <span className="fc-type-aff"> / {second}</span>} Form <span className="fc-dash">·</span> Shaped by {a.realmName}
      </div>
      <div className="fc-rules">
        {!compact && <QualityRunes qualities={a.qualities} />}
        <EvalLine ev={a.evaluation} />
        {!compact && a.evaluation?.recipe && <Recipe recipe={a.evaluation.recipe} />}
        {!compact && fam?.attune && <div className="familiar">“{fam.attune.summary}”</div>}
        {!compact && fam?.critique && <div className="familiar crit">“{fam.critique.weakness.text}”</div>}
        {children}
      </div>
    </div>
  );
}

export function Sparkline({ values, color, width = 120, height = 30 }: { values: number[]; color: string; width?: number; height?: number }) {
  if (values.length < 2) return <svg width={width} height={height} />;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (width - 4) + 2},${height - 3 - ((v - lo) / span) * (height - 6)}`);
  return (
    <svg width={width} height={height} className="spark">
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <circle cx={pts.at(-1)!.split(",")[0]} cy={pts.at(-1)!.split(",")[1]} r="3" fill={color} />
    </svg>
  );
}
