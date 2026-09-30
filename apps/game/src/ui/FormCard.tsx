import type { CSSProperties, ReactNode } from "react";
import { AFF_COLOR, AFF_DEEP } from "./affinity";
import { CardArt, formAffinities } from "./CardArt";
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

export function EvalLine({ ev }: { ev: any }) {
  if (!ev) return <div className="eval dim">Unknown until Attuned.</div>;
  const t = ev.exact ? "" : "~";
  return (
    <div className="eval">
      <span title="Technical score against the Realm's hidden law">
        Score <b>{t}{fmt(ev.technicalScore, 1)}</b>
      </span>
      <span title="Artifact power = score × evidence">
        Power <b>{t}{fmt(ev.power, 1)}</b>
      </span>
      <span title="Production cost at today's prices">
        Cost <b>{t}{crowns(ev.productionCost)}</b>
      </span>
      <span title="What buyers pay for the produced Form">
        Value <b>{t}{crowns(ev.marketValue)}</b>
      </span>
      <span className={ev.margin >= 0 ? "good" : "bad"} title="Value − cost">
        Margin <b>{t}{fmt(ev.margin)}</b>
      </span>
      <span title="Useful power per Crown (0–100)">
        Eff. <b>{t}{fmt(ev.efficiency)}</b>
      </span>
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
          <CardArt seed={a.id} aff={dom} aff2={second} />
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
