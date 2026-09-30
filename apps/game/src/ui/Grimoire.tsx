import { useEffect, useState } from "react";
import { api } from "../api";
import { setState, toast, useStore } from "../state/store";
import { Panel } from "./Panel";
import { FormCard } from "./FormCard";
import { TIER_LABEL } from "../economy/format";

/** Artifact history: lineage chains and evidence. */
export function Grimoire() {
  const [g, setG] = useState<any>(null);
  const dev = useStore((s) => s.devMode);
  useEffect(() => {
    api.grimoire().then(setG).catch((e) => toast(e.message, "loss"));
  }, []);
  if (!g) return <Panel title="Grimoire">Turning pages…</Panel>;
  const byId = new Map(g.artifacts.map((a: any) => [a.id, a]));
  const chainOf = (id: string) => {
    const out: any[] = [];
    let cur: any = byId.get(id);
    while (cur) {
      out.unshift(cur);
      cur = cur.parentId ? byId.get(cur.parentId) : null;
    }
    return out;
  };
  const leaves = g.artifacts.filter((a: any) => !g.lineage.some((l: any) => l.parent_id === a.id));
  return (
    <Panel title="Grimoire" subtitle="Every Form you have held, how it came to be, and what has been proven of it." wide testId="grimoire">
      {leaves.length === 0 && <p className="dim">Empty pages.</p>}
      {leaves
        .slice()
        .reverse()
        .map((leaf: any) => {
          const chain = chainOf(leaf.id);
          return (
            <div key={leaf.id} className="lineage">
              {chain.map((a, i) => (
                <div key={a.id} className="lineage-step">
                  {i > 0 && <span className="arrow">⟶ tempered ⟶</span>}
                  <FormCard a={a} compact>
                    <div className="dim small">
                      {TIER_LABEL[a.tier]} · {a.status} · from {a.origin}
                      {dev && (
                        <button className="ghost small" onClick={() => setState({ panel: "provenance", crucibleFocus: a.id })}>
                          provenance
                        </button>
                      )}
                    </div>
                  </FormCard>
                </div>
              ))}
            </div>
          );
        })}
    </Panel>
  );
}
