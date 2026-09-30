import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { refreshCharacter } from "../game/flow";
import { toast, useStore } from "../state/store";
import { Panel } from "./Panel";
import { EvalLine, FormCard, QualityRunes, Recipe } from "./FormCard";
import { announceProgress } from "./craftActions";
import { TIER_LABEL, crowns, fmt, qualityName, essenceName } from "../economy/format";

const SLOTS = [
  { id: "blade", name: "Blade", effect: "damage" },
  { id: "ward", name: "Ward", effect: "health" },
  { id: "sigil", name: "Sigil", effect: "cooldowns" },
  { id: "charm", name: "Charm", effect: "loot quality" },
];

export function Crucible() {
  const c = useStore((s) => s.character);
  const mode = useStore((s) => s.crucibleMode ?? "craft");
  const [forms, setForms] = useState<any[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [temper, setTemper] = useState<any>(null);
  const [shatter, setShatter] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wild, setWild] = useState(false);
  const [quote, setQuote] = useState<any>(null);

  const load = async (keep?: string) => {
    const inv = await api.inventory();
    setForms(inv.artifacts);
    const want = keep ?? sel;
    if (want && inv.artifacts.some((a: any) => a.id === want)) setSel(want);
    else setSel(inv.artifacts.find((a: any) => (mode === "mirror" ? a.tier === "trialed" : true))?.id ?? inv.artifacts[0]?.id ?? null);
  };
  useEffect(() => {
    load().catch((e) => toast(e.message, "loss"));
  }, []);
  const a = forms.find((f) => f.id === sel);
  useEffect(() => {
    setQuote(null);
    if (a && a.tier !== "veiled") api.artifact(a.id).then((r) => setQuote(r.sale)).catch(() => {});
  }, [sel, a?.tier]);

  const hasWild = (c?.currencies ?? []).some((x: any) => x.item_id === "wild-sigil" && x.quantity > 0);
  const temperCost = Math.max(0, 2 - (c?.passiveEffects?.temperDiscount ?? 0));

  const act = async (label: string, fn: () => Promise<any>, after?: (out: any) => string | undefined) => {
    setBusy(true);
    try {
      const out = await fn();
      announceProgress(out);
      setResult({ label, out });
      await refreshCharacter();
      await load(after?.(out));
    } catch (e) {
      toast((e as Error).message, "loss");
    } finally {
      setBusy(false);
    }
  };

  const startTemper = async () => {
    if (!a) return;
    setBusy(true);
    try {
      const out = await api.temper(a.id, { wildSigil: wild && hasWild });
      announceProgress(out);
      setTemper({ parent: a, ...out });
      await refreshCharacter();
    } catch (e) {
      toast((e as Error).message, "loss");
    } finally {
      setBusy(false);
    }
  };
  const chooseTemper = async (candidateId: string) => {
    setShatter(candidateId);
    setBusy(true);
    try {
      const out = await api.temper(temper.parent.id, { choice: candidateId });
      await new Promise((r) => setTimeout(r, 650));
      announceProgress(out);
      toast(`${out.artifact.name} takes shape; the other possibilities shatter.`, "info");
      setTemper(null);
      setShatter(null);
      setResult({ label: "Temper", out });
      await refreshCharacter();
      await load(out.artifact.id);
    } catch (e) {
      toast((e as Error).message, "loss");
      setShatter(null);
    } finally {
      setBusy(false);
    }
  };

  const evaluated = useMemo(() => forms.filter((f) => f.evaluation), [forms]);
  const bestPower = evaluated.reduce((m, f) => (f.evaluation.power > (m?.evaluation.power ?? -1) ? f : m), null as any);
  const bestMargin = evaluated.reduce((m, f) => (f.evaluation.margin > (m?.evaluation.margin ?? -1e9) ? f : m), null as any);

  return (
    <Panel title={mode === "mirror" ? "The Mirror" : "The Crucible"} subtitle={`✦ ${c?.focus ?? 0} Focus · each act of the Familiar costs Focus and teaches you (XP); only true results earn Mastery.`} wide testId="crucible">
      <div className="crucible">
        <div className="form-list">
          {forms.length === 0 && <p className="dim">You hold no Forms. Fight in a Realm to find them.</p>}
          {forms.map((f) => (
            <FormCard key={f.id} a={f} compact selected={f.id === sel} onClick={() => setSel(f.id)} />
          ))}
        </div>
        <div className="form-detail">
          {a ? (
            <>
              <FormCard a={a} />
              <div className="actions">
                {a.tier === "veiled" && (
                  <button className="primary" disabled={busy} onClick={() => act("Attune", () => api.attune(a.id))} data-testid="act-attune">
                    Attune · 1 ✦
                  </button>
                )}
                {a.tier === "attuned" && (
                  <button className="primary" disabled={busy} onClick={() => act("Trial", () => api.trial(a.id))} data-testid="act-trial">
                    Trial · free
                  </button>
                )}
                {(a.tier === "trialed" || a.tier === "witnessed") && (
                  <button disabled={busy} onClick={() => act("Trial", () => api.trial(a.id))} data-testid="act-retrial">
                    Re-Trial at today's prices
                  </button>
                )}
                {a.tier === "trialed" && (
                  <button className={mode === "mirror" ? "primary" : ""} disabled={busy} onClick={() => act("Mirror", () => api.mirror(a.id))} data-testid="act-mirror">
                    Mirror · 2 ✦
                  </button>
                )}
                {a.tier !== "veiled" && (
                  <>
                    <button disabled={busy} onClick={() => act("Fracture", () => api.fracture(a.id))} data-testid="act-fracture">
                      Fracture · 1 ✦
                    </button>
                    <button disabled={busy || a.status === "equipped"} onClick={startTemper} data-testid="act-temper" title={a.status === "equipped" ? "Unequip first" : ""}>
                      Temper · {temperCost} ✦
                    </button>
                    {a.tier !== "witnessed" && (
                      <button disabled={busy} onClick={() => act("Deep Trial", () => api.deepTrial(a.id))} data-testid="act-deep">
                        Deep Trial · 3 ✦
                      </button>
                    )}
                  </>
                )}
                {hasWild && a.tier !== "veiled" && (
                  <label className="check">
                    <input type="checkbox" checked={wild} onChange={(e) => setWild(e.target.checked)} /> spend a Wild Sigil on the next Temper
                  </label>
                )}
              </div>
              {a.tier !== "veiled" && (
                <div className="bind">
                  <div className="dim small">
                    Binding manifests the Form: its recipe is paid once (from your Essences, the rest bought at the Bazaar)
                    {quote?.quote && !quote.quote.alreadyBound && <> — shortfall today ≈ {crowns(quote.quote.crownsIfBought)}</>}
                    {quote?.quote?.alreadyBound && <> — already bound</>}.
                  </div>
                  <div className="row">
                    {SLOTS.map((s) => (
                      <button
                        key={s.id}
                        className="small"
                        disabled={busy}
                        onClick={() =>
                          act(`Bind as ${s.name}`, () => api.equip(s.id, a.id), () => a.id)
                        }
                        data-testid={`equip-${s.id}`}
                      >
                        Bind as {s.name} <span className="dim">({s.effect})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {result && <ActionResult r={result} />}
            </>
          ) : (
            <p className="dim">Select a Form.</p>
          )}
        </div>
      </div>

      {evaluated.length > 1 && (
        <div className="compare" data-testid="compare">
          <h4>Compare: power against price</h4>
          <table>
            <thead>
              <tr>
                <th>Form</th>
                <th>Evidence</th>
                <th>Score</th>
                <th>Power</th>
                <th>Cost</th>
                <th>Value</th>
                <th>Margin</th>
                <th>Eff.</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {evaluated.map((f) => (
                <tr key={f.id} className={f.id === sel ? "sel" : ""} onClick={() => setSel(f.id)}>
                  <td>{f.name}</td>
                  <td>{TIER_LABEL[f.tier]}</td>
                  <td>
                    {f.evaluation.exact ? "" : "~"}
                    {fmt(f.evaluation.technicalScore, 1)}
                  </td>
                  <td>{fmt(f.evaluation.power, 1)}</td>
                  <td>{crowns(f.evaluation.productionCost)}</td>
                  <td>{crowns(f.evaluation.marketValue)}</td>
                  <td className={f.evaluation.margin >= 0 ? "good" : "bad"}>{fmt(f.evaluation.margin)}</td>
                  <td>{fmt(f.evaluation.efficiency)}</td>
                  <td className="dim small">
                    {f === bestPower && "strongest "}
                    {f === bestMargin && "most profitable"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="dim small">The strongest Form is not always the one worth making: production cost moves with the world's scarcities.</div>
        </div>
      )}

      {temper && (
        <div className="temper-overlay" data-testid="temper-choices">
          <h3>Three Forms answer the Familiar's search</h3>
          <div className="dim">
            {temper.familiar ?? "The choices still hang in the air."} {temper.offered ? `(${temper.offered} nearby Forms considered)` : ""}
          </div>
          <div className="temper-grid">
            {temper.options.map((o: any) => (
              <div key={o.candidateId} className={`temper-card ${shatter && shatter !== o.candidateId ? "shatter" : ""} ${shatter === o.candidateId ? "chosen" : ""}`} data-testid={`temper-option-${o.candidateId}`} data-emphasis={o.emphasis}>
                <div className="fc-name">{o.name}</div>
                <div className="emph">{o.emphasis}</div>
                <div className="familiar">“{o.rationale}”</div>
                <div className="eval">
                  <span>
                    Predicted <b>~{fmt(o.predictedTechnicalScore, 1)}</b>
                  </span>
                  <span>
                    Cost <b>{crowns(o.productionCost)}</b>
                  </span>
                  <span>
                    Value <b>{crowns(o.marketValue)}</b>
                  </span>
                  <span>
                    Distance <b>{fmt(o.distance, 1)}</b>
                  </span>
                </div>
                <button className="primary" disabled={busy} onClick={() => chooseTemper(o.candidateId)} data-testid={`choose-${o.candidateId}`}>
                  Choose
                </button>
              </div>
            ))}
          </div>
          <div className="dim small">
            Original: predicted ~{fmt(temper.parent.evaluation?.technicalScore, 1)} · cost {crowns(temper.parent.evaluation?.productionCost)}
          </div>
        </div>
      )}
    </Panel>
  );
}

function ActionResult({ r }: { r: { label: string; out: any } }) {
  const o = r.out;
  return (
    <div className="result" data-testid="action-result">
      <h4>{r.label}</h4>
      {o.evaluation && o.evaluation.contributions && (
        <div className="trial">
          <div className="dim small">The Form enters the apparatus; each law it answers to lights in turn.</div>
          {o.evaluation.contributions.map((c: any, i: number) => (
            <div key={c.quality} className="contrib" style={{ animationDelay: `${i * 180}ms` }}>
              <span>
                {qualityName(c.quality)} ({c.mode === "target" ? "balanced" : c.mode === "maximize" ? "more is better" : "less is better"}, weight {Math.round(c.weight * 100)}%)
              </span>
              <div className="rbar">
                <div className="rfill" style={{ width: `${c.satisfaction}%` }} />
              </div>
              <b>+{fmt(c.points, 1)}</b>
            </div>
          ))}
          <div className="trial-sum">
            Technical score <b data-testid="trial-score">{fmt(o.evaluation.technicalScore, 1)}</b>
            {o.evaluation.predictedScore !== null && o.evaluation.predictedScore !== undefined && <span className="dim"> (you read ~{fmt(o.evaluation.predictedScore, 1)})</span>} · power {fmt(o.evaluation.power, 1)} · cost{" "}
            {crowns(o.evaluation.productionCost)} · value {crowns(o.evaluation.marketValue)} · efficiency {fmt(o.evaluation.efficiency)}
          </div>
        </div>
      )}
      {o.mirror && (
        <div>
          Reflections under other lights: {o.mirror.mirrorScores.map((s: number) => fmt(s, 1)).join(" · ")} (drift {fmt(o.mirror.maxDeviation, 1)}, tolerance {o.mirror.tolerance}) —{" "}
          <b>{o.mirror.consistent ? "consistent: Witnessed" : "inconsistent: not yet Witnessed"}</b>
        </div>
      )}
      {o.critique && (
        <div className="familiar crit">
          “{o.critique.weakness.text}” {o.critique.secondary && <>Also: “{o.critique.secondary.text}”</>} <span className="dim">({o.critique.verdict})</span>
        </div>
      )}
      {o.familiar?.summary && r.label === "Mirror" && <div className="familiar">“{o.familiar.summary}”</div>}
      {o.alternatives && (
        <div className="dim">
          Nearby, the strongest Form scores {fmt(o.alternatives.strongestNeighbor.technicalScore, 1)}
          {o.alternatives.strongestNeighbor.beatsThis ? " (better than this)" : ""}; the most profitable has margin {fmt(o.alternatives.mostProfitableNeighbor.margin)}.
        </div>
      )}
      {o.stats && (
        <div>
          Bound. Damage {fmt(o.statsBefore.attackDamage, 1)} → <b>{fmt(o.stats.attackDamage, 1)}</b> · Health {fmt(o.statsBefore.maxHealth)} → <b>{fmt(o.stats.maxHealth)}</b> · Cooldowns ×
          {fmt(o.stats.cooldownRate, 2)} · Loot +{fmt(o.stats.lootPercentileBonus, 1)} pct
          {o.binding && (
            <span className="dim">
              {" "}
              · paid {crowns(o.binding.productionCost)} in Essences{o.binding.crownsSpent ? ` (${crowns(o.binding.crownsSpent)} bought)` : ""}
            </span>
          )}
        </div>
      )}
      {o.outcome && (
        <div className="dim">
          {o.outcome.improved ? "The new Form truly answers the Realm better." : "The new Form is not clearly better; Trial it to be sure."}
        </div>
      )}
      {o.artifact && r.label === "Temper" && <Recipe recipe={o.artifact.evaluation?.recipe} />}
      {o.artifact && r.label === "Attune" && o.familiar && (
        <div className="familiar-box">
          <b>
            {o.familiar.fantasyName}, {o.familiar.epithet}
          </b>
          <ul>
            {o.familiar.observations.map((x: any, i: number) => (
              <li key={i} className={x.significance}>
                {x.text}
              </li>
            ))}
          </ul>
          <div>
            Suggests: <b>{o.familiar.suggestedAction}</b>
          </div>
          <QualityRunes qualities={o.artifact.qualities} />
          <EvalLine ev={o.artifact.evaluation} />
        </div>
      )}
      {o.inference && (
        <div className="dim small">
          {o.inference.provider === "fixture" ? "Familiar (recorded)" : "Familiar (rules)"} · {o.inference.workUnits} WU · +{o.inference.xp} XP
        </div>
      )}
      {o.productionCost !== undefined && o.payout !== undefined && (
        <div>
          Sold for {crowns(o.payout)} · production {crowns(o.productionCost)} · profit <b className={o.profit >= 0 ? "good" : "bad"}>{fmt(o.profit)}</b>
        </div>
      )}
      {o.binding === null && o.stats && <div className="dim small">Already bound; no cost.</div>}
      {o.reward && <div>Contract reward {crowns(o.reward)}</div>}
      {o.used && <div>{Object.entries(o.used).map(([e, q]) => `${q} ${essenceName(e)}`).join(", ")}</div>}
    </div>
  );
}
