import { useEffect, useState } from "react";
import { Guide, type GuideStep } from "./Guide";
import { learned, visit } from "../game/firstUse";
import { api } from "../api";
import { refreshCharacter, refreshWorld, toRealmChoice } from "../game/flow";
import { getState, setState, toast, useStore } from "../state/store";
import { Panel } from "./Panel";
import { FormCard, Sparkline } from "./FormCard";
import { announceProgress } from "./craftActions";
import { crowns, essenceColor, essenceName, fmt, qualityName, signed } from "../economy/format";


type Tab = "market" | "forms" | "contracts" | "prophecy";

/** The Bazaar opens up a visit at a time (Mark, 2026-10-02): selling first, then buying, Forms, Contracts, and
 *  last Prophecy and Waiting. Each new part gets one guided step the visit it appears. */
const BAZAAR_GUIDES: { id: string; from: number; steps: GuideStep[] }[] = [
  {
    id: "bazaar-1",
    from: 1,
    steps: [
      { text: <>The <b>Bazaar</b>. The <b>Essences</b> you find on runs sell here for <b>Crowns</b>.</> },
      { text: <>Prices move every day. The line shows the last few days; <b>+%</b> means above its usual price, the time to sell.</> },
      { text: <>Tap an Essence to <b>sell</b> some. Crowns buy what a run doesn't drop.</> },
    ],
  },
  { id: "bazaar-buy", from: 2, steps: [{ text: <>New: <b>Buy</b>. Short of an Essence? Buy it here. <b>Good buy</b> marks one cheaper than usual.</> }] },
  { id: "bazaar-forms", from: 3, steps: [{ text: <>New: <b>Forms</b>. Sell a Form you won't weave. A better Form sells for more.</> }] },
  { id: "bazaar-contracts", from: 4, steps: [{ text: <>New: <b>Contracts</b>. A buyer wants a kind of Form and pays well for one that fits.</> }] },
  { id: "bazaar-prophecy", from: 5, steps: [{ text: <>New: <b>Prophecy</b> bets on where a price goes next, and <b>Wait</b> lets a day pass without a run.</> }] },
];
const TAB_FROM: Record<Tab, number> = { market: 1, forms: 3, contracts: 4, prophecy: 5 };

export function Bazaar() {
  const [tab, setTab] = useState<Tab>(() => getState().bazaarTab ?? "market");
  // How deep this visit goes: one more part each time the Bazaar opens.
  const [depth] = useState(() => visit("bazaar"));
  const [asked] = useState(() => getState().bazaarTab);
  const tabs = (["market", "forms", "contracts", "prophecy"] as Tab[]).filter((t) => depth >= TAB_FROM[t] || t === asked);
  const guide = BAZAAR_GUIDES.find((g) => depth >= g.from && !learned(g.id));
  useEffect(() => () => setState({ bazaarTab: undefined }), []);
  const [bz, setBz] = useState<any>(null);
  const [inv, setInv] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const c = useStore((s) => s.character);
  /** Back from a run: the Bazaar is a stop on the way to the next Realm choice, so it leads on there. */
  const homeward = useStore((s) => !!s.homeward);

  const load = async () => {
    const [b, i] = await Promise.all([api.bazaar(), api.inventory()]);
    setBz(b);
    setInv(i);
  };
  useEffect(() => {
    load().catch((e) => toast(e.message, "loss"));
  }, []);

  const act = async (fn: () => Promise<any>, msg?: (o: any) => string) => {
    setBusy(true);
    try {
      const out = await fn();
      announceProgress(out);
      if (msg) toast(msg(out), "gain");
      await refreshCharacter();
      await load();
      return out;
    } catch (e) {
      toast((e as Error).message, "loss");
    } finally {
      setBusy(false);
    }
  };

  if (!bz) return <Panel title="The Bazaar">The stalls are opening…</Panel>;

  return (
    <Panel
      title="The Bazaar"
      subtitle={
        <>
          <span data-testid="bazaar-headline">{bz.headline}</span> · Turning {bz.snapshot.date}
        </>
      }
      wide
      testId="bazaar"
      onClose={homeward ? toRealmChoice : undefined}
    >
      {guide && <Guide key={guide.id} id={guide.id} steps={guide.steps} />}
      {(tabs.length > 1 || depth >= 5) && (
      <div className="tabs">
        {tabs.map((t) => (
          <button key={t} className={tab === t ? "tab on" : "tab"} onClick={() => setTab(t)} data-testid={`tab-${t}`}>
            {t === "market" ? "Market" : t === "forms" ? "Forms" : t === "contracts" ? `Contracts (${bz.contracts.length})` : "Prophecy"}
          </button>
        ))}
        <div className="hud-spacer" />
        {depth >= 5 && (
        <button
          className="ghost small"
          disabled={busy}
          onClick={() =>
            act(
              async () => {
                const r = await api.advance(1);
                await refreshWorld();
                return r;
              },
              (r) => `A turning passes: ${r.from.date} → ${r.snapshot.date}`,
            )
          }
          data-testid="advance-world"
          title="Let a turning of the world pass without entering a Realm"
        >
          Wait for the next turning
        </button>
        )}
      </div>
      )}

      {depth >= 4 && bz.worldEvents.length > 0 && (
        <div className="events">
          {bz.worldEvents.map((e: string) => (
            <span key={e} className="event">
              {e}
            </span>
          ))}
        </div>
      )}
      {depth >= 4 && bz.rumors.map((r: any, i: number) => (
        <div key={i} className="event">
          Rumor: {r.text} ({r.runsLeft} runs left)
        </div>
      ))}

      {tab === "market" && <Market bz={bz} busy={busy} act={act} purse={c?.crowns ?? 0} canBuy={depth >= 2} />}

      {tab === "forms" && (
        <div className="bz-forms">
          <h4>Your Forms</h4>
          <div className="dim small">
            Selling produces the Form for its buyer: you pay its recipe at today's prices, they pay its value. Veiled Forms can only be salvaged. Spread {Math.round(bz.spread * 1000) / 10}%.
          </div>
          <div className="form-grid">
            {inv.artifacts.map((a: any) => (
              <FormCard key={a.id} a={a} compact>
                <div className="row">
                  {a.tier !== "veiled" && (
                    <button
                      className="small primary"
                      disabled={busy}
                      onClick={() => act(() => api.sellArtifact(a.id, "produce"), (o) => `Sold for ${crowns(o.payout)} · cost ${crowns(o.productionCost)} · profit ${signed(o.profit)}`)}
                      data-testid={`sell-form-${a.id}`}
                    >
                      Produce &amp; sell
                    </button>
                  )}
                  <button className="small" disabled={busy} onClick={() => act(() => api.sellArtifact(a.id, "salvage"), (o) => `Salvaged for ${crowns(o.payout)}`)} data-testid={`salvage-${a.id}`}>
                    Salvage
                  </button>
                </div>
              </FormCard>
            ))}
          </div>
          <h4>Veiled Forms for sale</h4>
          <div className="offers">
            {bz.offers.map((o: any) => (
              <div key={o.id} className={`offer ${o.status}`} data-testid={`offer-${o.id}`}>
                <div>
                  <b>Veiled Form</b> <span className="dim">from {o.realmName}</span>
                </div>
                <div className="small">
                  {Object.entries(o.revealed).map(([q, v]) => (
                    <span key={q}>
                      {qualityName(q)} {Math.round(v as number)}{" "}
                    </span>
                  ))}
                </div>
                {o.mispriced && <div className="good small">{o.mispriced}</div>}
                <button className="small" disabled={busy || o.status !== "open" || (c?.crowns ?? 0) < o.price} onClick={() => act(() => api.buyOffer(o.id), () => "The Scholars hand it over, still veiled.")}>
                  {o.status === "open" ? `Buy · ${crowns(o.price)}` : "Sold"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "contracts" && (
        <div className="contracts" data-testid="contracts">
          {bz.contracts.length === 0 && <p className="dim">No open contracts this turning.</p>}
          {bz.contracts.map((ct: any) => (
            <div key={ct.id} className="contract" data-testid={`contract-${ct.id}`} data-target={ct.targetEssence ?? ""}>
              <div className="row between">
                <b>{ct.title}</b>
                <span className="reward">{crowns(ct.reward)}</span>
              </div>
              <ul className="ct-wants" data-testid="ct-wants">
                {wants(ct.requirement).map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
              <div className="dim small">
                {ct.reason} · {ct.turningsLeft} turning{ct.turningsLeft === 1 ? "" : "s"} left
              </div>
              {ct.eligibleArtifactIds.length === 0 ? (
                <div className="ct-near small" data-testid="ct-near">
                  {ct.closest ? (
                    <>
                      Closest: <b>{inv.artifacts.find((x: any) => x.id === ct.closest.id)?.name ?? ct.closest.name ?? "a Form"}</b>, {ct.closest.gaps.map(gapText).join(", ")}.
                    </>
                  ) : ct.untrialed > 0 ? (
                    `None of your Forms are Trialed yet. Trial one in the Crucible to see if it fits.`
                  ) : (
                    "None of your Forms fit yet. Forms drop on Expeditions."
                  )}
                </div>
              ) : (
                <div className="row">
                  {ct.eligibleArtifactIds.map((id: string) => {
                    const f = inv.artifacts.find((x: any) => x.id === id);
                    return (
                      <button
                        key={id}
                        className="small primary"
                        disabled={busy}
                        onClick={() => act(() => api.fulfill(ct.id, id), (o) => `Contract fulfilled: ${crowns(o.reward)} (production ${crowns(o.productionCost)})`)}
                        data-testid={`fulfill-${id}`}
                      >
                        Deliver {f?.name ?? id}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "prophecy" && <Prophecy bz={bz} busy={busy} act={act} />}
      {homeward && (
        <div className="row end bz-onward">
          <button className="primary" onClick={toRealmChoice} data-testid="to-realms">
            Choose your next Realm
          </button>
        </div>
      )}
    </Panel>
  );
}

/** A Contract's needs in plain words, one per line. */
function wants(r: any): string[] {
  const out: string[] = [];
  // Every Contract wants a Trialed Form; only the stricter Mirror proof is worth its own line.
  if (r.minTier === "witnessed") out.push("Proven in the Mirror");
  if (r.minPower !== undefined) out.push(`Power ${r.minPower} or more`);
  for (const x of r.maxEssence ?? []) out.push(x.qty === 0 ? `No ${essenceName(x.essence)} in it` : `At most ${x.qty} ${essenceName(x.essence)}`);
  for (const b of r.qualityBounds ?? []) {
    if (b.min !== undefined) out.push(`${qualityName(b.quality)} ${b.min} or more`);
    if (b.max !== undefined) out.push(`${qualityName(b.quality)} ${b.max} or less`);
  }
  if (r.maxCost !== undefined) out.push(`Costs at most ${crowns(r.maxCost)} to make`);
  if (r.minEfficiency !== undefined) out.push(`Good value: score ${r.minEfficiency} or more for its cost`);
  return out;
}

/** How far a Form falls short, in a few words. */
const gapText = (g: any): string => gapWords(g, (n: number) => Math.max(1, Math.ceil(n)));
const gapWords = (g: any, up: (n: number) => number): string =>
  g.kind === "tier"
    ? "needs a Mirror reading"
    : g.kind === "power"
      ? `${up(g.need - g.have)} Power short`
      : g.kind === "essence"
        ? `${up(g.have - g.need)} ${essenceName(g.essence)} too many`
        : g.kind === "quality"
          ? g.dir === "min"
            ? `${up(g.need - g.have)} ${qualityName(g.quality)} short`
            : `${up(g.have - g.need)} ${qualityName(g.quality)} over`
          : g.kind === "cost"
            ? `${crowns(up(g.have - g.need))} too costly`
            : `value ${up(g.need - g.have)} short`;

const PROBS = [0.1, 0.3, 0.5, 0.7, 0.9];

function Prophecy({ bz, busy, act }: { bz: any; busy: boolean; act: (fn: () => Promise<any>, msg?: (o: any) => string) => Promise<any> }) {
  const [essence, setEssence] = useState("storm");
  const [p, setP] = useState(0.5);
  const open = bz.prophecies.recent.filter((r: any) => r.status === "open");
  return (
    <div className="prophecy" data-testid="prophecy">
      <p>Will an Essence grow scarcer by the next turning? State how sure you are. You are scored on calibration, not luck.</p>
      <div className="row">
        {bz.essences.map((e: any) => (
          <button key={e.id} className={essence === e.id ? "tab on" : "tab"} onClick={() => setEssence(e.id)} style={{ color: essenceColor(e.id) }} data-testid={`proph-${e.id}`}>
            {e.name}
          </button>
        ))}
      </div>
      <div className="row">
        {PROBS.map((x) => (
          <button key={x} className={p === x ? "tab on" : "tab"} onClick={() => setP(x)} data-testid={`prob-${Math.round(x * 100)}`}>
            {Math.round(x * 100)}%
          </button>
        ))}
        <button className="primary" disabled={busy} onClick={() => act(() => api.prophesy(essence, p), () => `Prophecy spoken: ${essenceName(essence)} rises, ${Math.round(p * 100)}%`)} data-testid="make-prophecy">
          Speak the Prophecy
        </button>
      </div>
      <div className="dim small">Next-turning uncertainty for {essenceName(essence)}: ±{fmt(bz.essences.find((e: any) => e.id === essence)?.nextUncertainty, 2)} (narrows with Prophecy Mastery).</div>
      {open.map((r: any) => (
        <div key={r.id} className="row between prophecy-line">
          <span>
            {essenceName(r.essence)} rises · {Math.round(r.probability * 100)}%
          </span>
          <button className="small" disabled={busy} onClick={() => act(() => api.resolveProphecy(r.id), (o) => `${essenceName(o.essence)} ${o.outcome ? "rose" : "did not rise"} (${fmt(o.scarcityBefore, 1)} → ${fmt(o.scarcityAfter, 1)}) · Brier ${fmt(o.loss, 2)}`)} data-testid={`resolve-${r.id}`}>
            Reveal the next turning
          </button>
        </div>
      ))}
      <h4>Calibration</h4>
      <table>
        <thead>
          <tr>
            <th>You said</th>
            <th>Times</th>
            <th>It happened</th>
          </tr>
        </thead>
        <tbody>
          {bz.prophecies.calibration.map((r: any) => (
            <tr key={r.probability}>
              <td>{Math.round(r.probability * 100)}%</td>
              <td>{r.count}</td>
              <td>{r.hitRate === null ? "—" : `${Math.round(r.hitRate * 100)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {bz.prophecies.meanBrier !== null && <div className="dim small">Mean Brier loss {bz.prophecies.meanBrier} (lower is better; always saying 50% scores 0.25).</div>}
    </div>
  );
}

/**
 * The Essence market, laid out like a trading screen: pick Buy or Sell, scan one list sorted by the best deal for
 * that side (price, how far it sits from its usual, what you hold), then tap a row for a trade sheet with the
 * price history, a quantity, the total and what you'll hold after, and one button that says exactly what happens.
 */
function Market({ bz, busy, act, purse, canBuy }: { bz: any; busy: boolean; act: (fn: () => Promise<any>, msg?: (o: any) => string) => Promise<any>; purse: number; canBuy: boolean }) {
  // A first visit only sells: what the run brought home is what there is to do.
  const [mode, setMode] = useState<"buy" | "sell">(canBuy ? "buy" : "sell");
  const [pick, setPick] = useState<string | null>(null);
  const rows = [...bz.essences].sort((a: any, b: any) =>
    mode === "buy" ? a.priceRatio - b.priceRatio : (b.held > 0 ? 1 : 0) - (a.held > 0 ? 1 : 0) || b.priceRatio - a.priceRatio,
  );
  const picked = pick ? bz.essences.find((e: any) => e.id === pick) : null;
  return (
    <div className="mk" data-testid="essence-table">
      <div className="mk-top">
        {canBuy ? (
          <div className="mk-mode" role="tablist">
            <button className={mode === "buy" ? "on" : ""} onClick={() => setMode("buy")} data-testid="mk-buy">
              Buy
            </button>
            <button className={mode === "sell" ? "on" : ""} onClick={() => setMode("sell")} data-testid="mk-sell">
              Sell
            </button>
          </div>
        ) : (
          <b className="mk-only">Sell your Essences</b>
        )}
        <div className="mk-purse">
          <small>Your Crowns</small>
          <b>{fmt(purse, 0)}</b>
        </div>
      </div>
      <div className="mk-hint dim small">{mode === "buy" ? "Cheapest against its usual price first." : "Best price for what you hold first."}</div>
      <ul className="mk-list">
        {rows.map((e: any) => {
          const pct = Math.round((e.priceRatio - 1) * 100);
          const price = mode === "buy" ? e.buyPrice : e.sellPrice;
          const deal = mode === "buy" ? e.priceRatio <= 0.85 : e.priceRatio >= 1.2;
          const off = mode === "sell" && e.held === 0;
          return (
            <li key={e.id}>
              <button className={`mk-row ${off ? "off" : ""}`} onClick={() => setPick(e.id)} data-testid={`essence-${e.id}`} data-status={e.status} data-price={e.price}>
                <span className="mk-glyph" style={{ color: e.color }}>
                  {e.glyph}
                </span>
                <span className="mk-name">
                  <b>{e.name}</b>
                  <small>{off ? "None held" : `You hold ${e.held}`}</small>
                </span>
                <Sparkline values={e.history} color={e.color} width={110} height={40} />
                <span className="mk-price">
                  <b>{fmt(price, 1)}</b>
                  <small className={pct === 0 ? "" : (pct < 0) === (mode === "buy") ? "good" : "bad"}>{pct === 0 ? "usual" : `${pct > 0 ? "+" : ""}${pct}% vs usual`}</small>
                </span>
                {deal && <span className="mk-deal">{mode === "buy" ? "Good buy" : "Good sell"}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {picked && <TradeSheet e={picked} mode={mode} purse={purse} busy={busy} act={act} onMode={canBuy ? setMode : undefined} onClose={() => setPick(null)} />}
    </div>
  );
}

function TradeSheet({ e, mode, purse, busy, act, onMode, onClose }: { e: any; mode: "buy" | "sell"; purse: number; busy: boolean; act: (fn: () => Promise<any>, msg?: (o: any) => string) => Promise<any>; onMode?: (m: "buy" | "sell") => void; onClose: () => void }) {
  const each = mode === "buy" ? e.buyPrice : e.sellPrice;
  const max = mode === "buy" ? Math.floor(purse / e.buyPrice) : e.held;
  const [qty, setQty] = useState(Math.min(5, Math.max(1, max)));
  const q = Math.max(0, Math.min(qty, max));
  const total = each * q;
  const usual = e.price / e.priceRatio;
  return (
    <div className="mk-sheet-back" onClick={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div className="mk-sheet" data-testid="trade-sheet">
        <header>
          <span className="mk-glyph" style={{ color: e.color }}>
            {e.glyph}
          </span>
          <b>{e.name}</b>
          <button className="ghost close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <PriceChart e={e} usual={usual} />
        <div className="mk-facts">
          <span>
            Now <b>{fmt(e.price, 1)}</b>
          </span>
          <span>
            Usual <b>{fmt(usual, 1)}</b>
          </span>
          <span>
            Year <b>{fmt(e.band.low, 1)}–{fmt(e.band.high, 1)}</b>
          </span>
        </div>
        {onMode && (
        <div className="mk-mode wide">
          <button className={mode === "buy" ? "on" : ""} onClick={() => onMode!("buy")}>
            Buy at {fmt(e.buyPrice, 1)}
          </button>
          <button className={mode === "sell" ? "on" : ""} onClick={() => onMode!("sell")}>
            Sell at {fmt(e.sellPrice, 1)}
          </button>
        </div>
        )}
        <div className="mk-qty">
          <button onClick={() => setQty(Math.max(1, q - 1))} disabled={q <= 1} aria-label="One fewer">
            −
          </button>
          <b data-testid="trade-qty">{q}</b>
          <button onClick={() => setQty(Math.min(max, q + 1))} disabled={q >= max} aria-label="One more">
            +
          </button>
          {[5, 10].map((n) => (
            <button key={n} className="chip" onClick={() => setQty(Math.min(n, max))} disabled={max < 1}>
              {n}
            </button>
          ))}
          <button className="chip" onClick={() => setQty(max)} disabled={max < 1}>
            Max
          </button>
        </div>
        <dl className="mk-sum">
          <dt>{mode === "buy" ? "You pay" : "You get"}</dt>
          <dd>
            <b>{fmt(total, 0)}</b> Crowns
          </dd>
          <dt>After</dt>
          <dd>
            {fmt(mode === "buy" ? purse - total : purse + total, 0)} Crowns · {mode === "buy" ? e.held + q : e.held - q} {e.name}
          </dd>
        </dl>
        <button
          className="big primary mk-go"
          disabled={busy || q < 1}
          onClick={() =>
            act(
              () => (mode === "buy" ? api.buyEssence(e.id, q) : api.sellEssence(e.id, q)),
              (o) => `${mode === "buy" ? "Bought" : "Sold"} ${q} ${e.name} for ${fmt(o.total, 0)} Crowns`,
            )
          }
          data-testid={`${mode}-${e.id}`}
        >
          {q < 1 ? (mode === "buy" ? "Not enough Crowns" : `No ${e.name} to sell`) : `${mode === "buy" ? "Buy" : "Sell"} ${q} ${e.name} for ${fmt(total, 0)}`}
        </button>
      </div>
    </div>
  );
}

/** The last turnings' price as a filled line, with the usual price dashed across it. */
function PriceChart({ e, usual }: { e: any; usual: number }) {
  const W = 900;
  const H = 220;
  const v: number[] = e.history;
  if (v.length < 2) return null;
  const lo = Math.min(...v, usual) * 0.95;
  const hi = Math.max(...v, usual) * 1.05;
  const y = (p: number) => H - 12 - ((p - lo) / (hi - lo || 1)) * (H - 24);
  const x = (i: number) => 8 + (i / (v.length - 1)) * (W - 16);
  const line = v.map((p, i) => `${x(i)},${y(p)}`).join(" ");
  return (
    <svg className="mk-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <polygon points={`${x(0)},${H} ${line} ${x(v.length - 1)},${H}`} fill={e.color} opacity={0.18} />
      <line x1={0} x2={W} y1={y(usual)} y2={y(usual)} stroke="#d9cfb8" strokeWidth={3} strokeDasharray="14 10" opacity={0.7} />
      <polyline points={line} fill="none" stroke={e.color} strokeWidth={6} strokeLinejoin="round" />
      <circle cx={x(v.length - 1)} cy={y(v[v.length - 1]!)} r={11} fill={e.color} stroke="#120c10" strokeWidth={4} />
    </svg>
  );
}
