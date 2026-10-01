import { useEffect, useState } from "react";
import { api } from "../api";
import { refreshCharacter, refreshWorld } from "../game/flow";
import { toast, useStore } from "../state/store";
import { Panel } from "./Panel";
import { FormCard, Sparkline } from "./FormCard";
import { announceProgress } from "./craftActions";
import { crowns, essenceColor, essenceName, fmt, qualityName, signed } from "../economy/format";

/** What a price means for you, in a few words: the market's status, read as advice. */
const VERDICT: Record<string, string> = { cheap: "Cheap: a good buy", steady: "Fair price", rising: "Pricey", dear: "Dear: a good sell" };

type Tab = "market" | "forms" | "contracts" | "prophecy";

export function Bazaar() {
  const [tab, setTab] = useState<Tab>("market");
  const [bz, setBz] = useState<any>(null);
  const [inv, setInv] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const c = useStore((s) => s.character);

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
    >
      <div className="tabs">
        {(["market", "forms", "contracts", "prophecy"] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? "tab on" : "tab"} onClick={() => setTab(t)} data-testid={`tab-${t}`}>
            {t === "market" ? "Essences" : t === "forms" ? "Forms" : t === "contracts" ? `Contracts (${bz.contracts.length})` : "Prophecy"}
          </button>
        ))}
        <div className="hud-spacer" />
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
      </div>

      {bz.worldEvents.length > 0 && (
        <div className="events">
          {bz.worldEvents.map((e: string) => (
            <span key={e} className="event">
              {e}
            </span>
          ))}
        </div>
      )}
      {bz.rumors.map((r: any, i: number) => (
        <div key={i} className="event">
          Rumor: {r.text} ({r.runsLeft} runs left)
        </div>
      ))}

      {tab === "market" && (
        <table className="market" data-testid="essence-table">
          <thead>
            <tr>
              <th>Essence</th>
              <th>Last 10 turnings</th>
              <th>Price</th>
              <th>Buy / Sell</th>
              <th>Held</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {bz.essences.map((e: any) => (
              <tr key={e.id} data-testid={`essence-${e.id}`} data-status={e.status} data-price={e.price}>
                <td>
                  <span className="glyph" style={{ color: e.color }}>
                    {e.glyph}
                  </span>{" "}
                  <b>{e.name}</b>
                  <div className="dim small">{e.trend}</div>
                </td>
                <td>
                  <Sparkline values={e.history} color={e.color} />
                </td>
                <td>
                  <b className="mk-price">{fmt(e.price, 2)}</b> <span className={`status ${e.status}`}>{VERDICT[e.status] ?? e.status}</span>
                  <div className="dim small">{e.priceRatio === 1 ? "its usual price" : `${e.priceRatio < 1 ? "below" : "above"} its usual ${fmt(e.price / e.priceRatio, 1)}`}</div>
                </td>
                <td className="small">
                  {fmt(e.buyPrice, 2)} / {fmt(e.sellPrice, 2)}
                </td>
                <td>{e.held}</td>
                <td className="row">
                  {/* Each button says what the trade costs or pays, so there's no sum to do. */}
                  <button className="small" disabled={busy} onClick={() => act(() => api.buyEssence(e.id, 5), (o) => `Bought 5 ${e.name} for ${fmt(o.total, 1)}`)} data-testid={`buy-${e.id}`}>
                    Buy 5 <small>for {fmt(e.buyPrice * 5, 0)}</small>
                  </button>
                  <button className="small" disabled={busy || e.held < 5} onClick={() => act(() => api.sellEssence(e.id, 5), (o) => `Sold 5 ${e.name} for ${fmt(o.total, 1)}`)} data-testid={`sell-${e.id}`}>
                    Sell 5 <small>for {fmt(e.sellPrice * 5, 0)}</small>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

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
              <div>{ct.description}</div>
              <div className="dim small">
                {ct.reason} · {ct.turningsLeft} turning{ct.turningsLeft === 1 ? "" : "s"} left
              </div>
              {ct.eligibleArtifactIds.length === 0 ? (
                <div className="dim small">None of your Forms qualify yet. A Form counts once you Trial it in the Crucible.</div>
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
    </Panel>
  );
}

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
