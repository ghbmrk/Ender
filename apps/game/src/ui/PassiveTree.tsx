import { useEffect, useState } from "react";
import { POLICY_KEYS } from "@ender/shared";
import { api } from "../api";
import { refreshCharacter } from "../game/flow";
import { toast, useStore } from "../state/store";
import { Panel } from "./Panel";

const POLICY_LABEL: Record<string, string> = { exploration: "Exploration", optimization: "Optimization", critique: "Critique", evidence: "Evidence", efficiency: "Efficiency", arbitrage: "Arbitrage" };

/** Six radial branches. Each node reshapes the SearchPolicy that the Familiar's search receives. */
export function PassiveTree() {
  const [t, setT] = useState<any>(null);
  const c = useStore((s) => s.character);
  const load = () => api.passives().then(setT);
  useEffect(() => {
    load().catch((e) => toast(e.message, "loss"));
  }, []);
  if (!t) return <Panel title="Passive Tree">…</Panel>;
  const cx = 330;
  const cy = 300;
  const pos = (branchIdx: number, depth: number, sibling: number, siblings: number) => {
    const base = (branchIdx / 6) * Math.PI * 2 - Math.PI / 2;
    const spread = siblings > 1 ? (sibling - (siblings - 1) / 2) * 0.28 : 0;
    const r = 60 + depth * 62;
    return { x: cx + Math.cos(base + spread) * r, y: cy + Math.sin(base + spread) * r };
  };
  const nodes = t.nodes.map((n: any) => {
    const bi = t.branches.findIndex((b: any) => b.id === n.branch);
    const same = t.nodes.filter((m: any) => m.branch === n.branch && m.depth === n.depth);
    return { ...n, bi, color: t.branches[bi].color, ...pos(bi, n.depth, same.indexOf(same.find((m: any) => m.id === n.id)), same.length) };
  });
  const allocate = async (id: string) => {
    try {
      const out = await api.allocate(id);
      toast(`${nodes.find((n: any) => n.id === id)?.name} awakened`, "mastery");
      await refreshCharacter();
      await load();
      return out;
    } catch (e) {
      toast((e as Error).message, "loss");
    }
  };
  return (
    <Panel title="Passive Tree" subtitle={`${t.pointsAvailable} point${t.pointsAvailable === 1 ? "" : "s"} to spend · Levels come from directing the Familiar; the tree decides how it searches.`} wide testId="passive-tree">
      <div className="tree-wrap">
        <svg width={660} height={600} className="tree">
          {t.branches.map((b: any, i: number) => {
            const end = pos(i, 4.4, 0, 1);
            const label = pos(i, 5, 0, 1);
            return (
              <g key={b.id}>
                <line x1={cx} y1={cy} x2={end.x} y2={end.y} stroke={b.color} strokeOpacity={0.25} strokeWidth={2} />
                <text x={label.x} y={label.y} fill={b.color} textAnchor="middle" fontSize={15} fontFamily="Georgia, serif">
                  {b.name}
                </text>
              </g>
            );
          })}
          {nodes
            .filter((n: any) => n.requires)
            .map((n: any) => {
              const p = nodes.find((m: any) => m.id === n.requires);
              return <line key={`l-${n.id}`} x1={p.x} y1={p.y} x2={n.x} y2={n.y} stroke={n.color} strokeOpacity={n.allocated ? 0.9 : 0.35} strokeWidth={n.allocated ? 3 : 1.5} />;
            })}
          <circle cx={cx} cy={cy} r={26} fill="#1b1624" stroke="#c9a24a" strokeWidth={2} />
          <text x={cx} y={cy + 5} textAnchor="middle" fill="#e8d9a8" fontSize={13} fontFamily="Georgia, serif">
            Binder
          </text>
          {nodes.map((n: any) => (
            <g
              key={n.id}
              className={`node ${n.allocated ? "on" : ""} ${n.available && t.pointsAvailable > 0 ? "avail" : ""}`}
              onClick={() => !n.allocated && n.available && t.pointsAvailable > 0 && allocate(n.id)}
              data-testid={`node-${n.id}`}
            >
              <title>{`${n.name}: ${n.description}`}</title>
              <circle cx={n.x} cy={n.y} r={16} fill={n.allocated ? n.color : "#15121c"} stroke={n.color} strokeWidth={n.available ? 2.5 : 1} strokeOpacity={n.available || n.allocated ? 1 : 0.4} />
              <text x={n.x} y={n.y + 30} textAnchor="middle" fill={n.allocated ? "#fff" : "#a39cb0"} fontSize={11}>
                {n.name}
              </text>
            </g>
          ))}
        </svg>
        <div className="policy">
          <h4>Your search policy</h4>
          <div className="dim small">Sent with every Temper, Attune and critique. It is, in effect, the algorithm your Familiar runs.</div>
          {POLICY_KEYS.map((k) => (
            <div key={k} className="policy-row" data-testid={`policy-${k}`} data-value={t.policy[k]}>
              <span>{POLICY_LABEL[k]}</span>
              <div className="rbar">
                <div className="rfill" style={{ width: `${t.policy[k] * 100}%` }} />
              </div>
              <b>{t.policy[k].toFixed(2)}</b>
            </div>
          ))}
          <h4>Mastery</h4>
          {Object.entries(c?.masteryDisplay ?? {}).map(([k, v]) => (
            <div key={k} className="policy-row">
              <span style={{ textTransform: "capitalize" }}>{k}</span>
              <div className="rbar">
                <div className="rfill mastery" style={{ width: `${v as number}%` }} />
              </div>
              <b>{(v as number).toFixed(1)}</b>
            </div>
          ))}
          <div className="dim small">Mastery grows only when choices objectively succeed; it sharpens specific powers, never raw damage.</div>
        </div>
      </div>
    </Panel>
  );
}
