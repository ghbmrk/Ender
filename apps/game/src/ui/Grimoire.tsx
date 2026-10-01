import { useEffect, useState } from "react";
import { api } from "../api";
import { setState, toast, useStore } from "../state/store";
import { Panel } from "./Panel";
import { FormCard } from "./FormCard";
import { TIER_LABEL } from "../economy/format";

const FILTER_NAME: Record<string, string> = { all: "All", action: "Actions", modifier: "Modifiers", reaction: "Reactions", keystone: "Keystones", unwoven: "Not yet inscribed" };
/** Where a Form is and where it came from, in plain words. */
const STATUS_WORDS: Record<string, string> = { held: "in your collection", equipped: "in your collection", sold: "sold", delivered: "delivered on a Contract", tempered: "tempered into a new Form" };
const ORIGIN_WORDS: Record<string, string> = { seed: "a starting Form", drop: "found on an Expedition", temper: "made by Tempering", bazaar: "bought at the Bazaar" };

/** Artifact history: lineage chains and evidence. */
export function Grimoire() {
  const [g, setG] = useState<any>(null);
  const dev = useStore((s) => s.devMode);
  const [filter, setFilter] = useState("all");
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
  const roleOf = (leaf: any) => leaf.inscribedRole ?? "unwoven";
  const counts = leaves.reduce((m: Record<string, number>, l: any) => ((m[roleOf(l)] = (m[roleOf(l)] ?? 0) + 1), m), {});
  const shown = filter === "all" ? leaves : leaves.filter((l: any) => roleOf(l) === filter);
  return (
    <Panel title="Grimoire" subtitle="Every Form you have held, how it came to be, and what has been proven of it." wide testId="grimoire">
      {leaves.length === 0 && <p className="dim">Empty pages. Forms you find on Expeditions are written here.</p>}
      {/* One tap narrows the book to the kind of Form you are looking for. */}
      {leaves.length > 0 && (
        <div className="grim-filter" data-testid="grim-filter">
          {["all", "action", "modifier", "reaction", "keystone", "unwoven"]
            .filter((k) => k === "all" || counts[k])
            .map((k) => (
              <button key={k} className={`grim-chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>
                {FILTER_NAME[k]} <span>{k === "all" ? leaves.length : counts[k]}</span>
              </button>
            ))}
        </div>
      )}
      {shown
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
                      {TIER_LABEL[a.tier]} · {STATUS_WORDS[a.status] ?? a.status} · {ORIGIN_WORDS[a.origin] ?? a.origin}
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
