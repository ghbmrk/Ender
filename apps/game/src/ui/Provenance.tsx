import { useEffect, useState } from "react";
import { api } from "../api";
import { refreshCharacter, refreshWorld } from "../game/flow";
import { toast, useStore } from "../state/store";
import { Panel } from "./Panel";
import { fmt } from "../economy/format";

/** Developer / advanced mode only: the real data under the fantasy. */
export function Provenance() {
  const focus = useStore((s) => s.crucibleFocus);
  const [arts, setArts] = useState<any[]>([]);
  const [sel, setSel] = useState<string | null>(focus ?? null);
  const [prov, setProv] = useState<any>(null);
  const [eco, setEco] = useState<any>(null);
  const [an, setAn] = useState<any>(null);
  const [missing, setMissing] = useState<any>(null);
  const [date, setDate] = useState("");
  const [tab, setTab] = useState<"form" | "economy" | "analytics">("form");
  useEffect(() => {
    api.grimoire().then((g) => {
      setArts(g.artifacts);
      if (!sel && g.artifacts[0]) setSel(g.artifacts[0].id);
    });
    api.devEconomy().then(setEco);
    api.analytics().then(setAn);
    api.missingFixtures().then(setMissing);
  }, []);
  useEffect(() => {
    if (sel) api.provenance(sel).then(setProv).catch((e) => toast(e.message, "loss"));
  }, [sel]);
  const replay = async () => {
    try {
      await api.replayDate(date);
      await Promise.all([refreshWorld(), refreshCharacter()]);
      setEco(await api.devEconomy());
      toast(`Replay moved to ${date}`, "info");
    } catch (e) {
      toast((e as Error).message, "loss");
    }
  };
  return (
    <Panel title="Provenance" subtitle="Developer view: the public records and formulas beneath the fantasy." wide testId="provenance">
      <div className="tabs">
        {(["form", "economy", "analytics"] as const).map((t) => (
          <button key={t} className={tab === t ? "tab on" : "tab"} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === "form" && (
        <div className="prov">
          <select value={sel ?? ""} onChange={(e) => setSel(e.target.value)}>
            {arts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.id}, {a.tier}, {a.status})
              </option>
            ))}
          </select>
          {prov && (
            <>
              <div className="kv">
                <div className="k">Source</div>
                <div className="v" data-testid="prov-cid">
                  PubChem CID {prov.reality.cid} — {prov.reality.record?.title} — {prov.reality.record?.molecularFormula}
                </div>
              </div>
              <div className="dim small">
                {prov.reality.record?.identitySource} · descriptors: {prov.reality.record?.descriptorSource}
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Quality</th>
                    <th>Source field</th>
                    <th>Raw</th>
                    <th>p05 → p95</th>
                    <th>Normalized</th>
                  </tr>
                </thead>
                <tbody>
                  {prov.mapping.map((m: any) => (
                    <tr key={m.quality}>
                      <td>{m.quality}</td>
                      <td>{m.source}</td>
                      <td>{fmt(m.raw, 2)}</td>
                      <td>
                        {fmt(m.band.p05, 1)} → {fmt(m.band.p95, 1)}
                      </td>
                      <td>{fmt(m.normalized, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div>
                Lineage: {prov.lineage.map((l: any) => `${l.parentId} → ${l.id}`).join(", ") || "none"} · Lore: {prov.lore.map((l: any) => l.label).join(", ")}
              </div>
              <h4>Inference events</h4>
              {prov.inference.map((i: any, k: number) => (
                <div key={k} className="small mono">
                  {i.action} · {i.provider} · {i.work_units} WU · {i.xp_awarded} XP · {i.request_hash.slice(0, 16)}…
                </div>
              ))}
              <div className="dim small">{prov.disclaimer}</div>
            </>
          )}
        </div>
      )}
      {tab === "economy" && eco && (
        <div className="prov">
          <div className="row">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="replay-date" />
            <button className="small" onClick={replay} disabled={!date}>
              Replay from date
            </button>
            <span className="dim small">
              Current turning {eco.snapshot.date} · {eco.source}
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Essence</th>
                <th>Series</th>
                <th>Obs.</th>
                <th>Return</th>
                <th>pct52</th>
                <th>Scarcity</th>
                <th>Price = base × ext × local × world</th>
              </tr>
            </thead>
            <tbody>
              {eco.essences.map((e: any) => (
                <tr key={e.essence}>
                  <td>{e.essence}</td>
                  <td>{e.series.label}</td>
                  <td>
                    {e.observation.date}: {fmt(e.observation.ratePerEur, 4)}
                  </td>
                  <td>{fmt(e.scarcity.latestReturn * 100, 2)}%</td>
                  <td>{fmt(e.scarcity.percentile52, 2)}</td>
                  <td>{fmt(e.scarcity.scarcity, 1)}</td>
                  <td>
                    {e.price.base} × {fmt(e.price.external, 2)} × {fmt(e.price.local, 2)} × {fmt(e.price.world, 2)} = <b>{fmt(e.price.price, 2)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {Object.entries(eco.formula).map(([k, v]) => (
            <div key={k} className="small mono">
              {k}: {v as string}
            </div>
          ))}
          {missing && <div className="small">Missing inference fixtures recorded: {missing.missing.length}</div>}
        </div>
      )}
      {tab === "analytics" && an && <pre className="mono small analytics">{JSON.stringify(an, null, 1)}</pre>}
    </Panel>
  );
}
