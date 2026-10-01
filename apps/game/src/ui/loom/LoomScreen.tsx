import { useEffect, useMemo, useRef, useState } from "react";
import {
  CAPACITY_COST,
  KEYSTONES,
  MODIFIER_TEXT,
  PARTY,
  REACTIONS,
  RIDER_TEXT,
  ROOTS,
  TEMPLATES,
  boardCells,
  compileLoom,
  diffLooms,
  hexDist,
  nodePotency,
  templateFor,
  type CompiledLoom,
  type LoomNode,
  type RootId,
} from "@ender/battle";
import { api } from "../../api";
import { leaveShrine, refreshLoom } from "../../game/flow";
import { DEMO_LOOMS } from "../../game/demo";
import { getState, setState, toast, useStore } from "../../state/store";
import { useStage, useWorldTop } from "../Stage";
import { AFF_COLOR, AFF_DEEP, AFF_GLYPH, ROLE_GLYPH, ROLE_NAME } from "../affinity";
import { Head } from "../battle/Figure";
import { sfx } from "../battle/sfx";
import { goTo } from "../../game/tutorial";
import { heroFigure, lookFor, partyRoots, rootLabel } from "../../game/hero";
import { Coach } from "../Coach";
import { CardArt } from "../CardArt";

/** Flat-topped hexes on the portrait stage. */
const HEX = 104;
const CX = 540;
const CY = 700;
const cellXY = (q: number, r: number): [number, number] => [CX + HEX * 1.5 * q, CY + HEX * Math.sqrt(3) * (r + q / 2)];
const hexPath = (x: number, y: number, s: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${i ? "L" : "M"}${(x + s * Math.cos(a)).toFixed(1)} ${(y + s * Math.sin(a)).toFixed(1)}`;
  }).join(" ") + " Z";
const TRAY_TOP = 1150;
const TRAY_H = 250;

type Layout = Record<RootId, LoomNode[]>;
type Drag = { node: LoomNode; from: "board" | "pool"; x: number; y: number; over: { q: number; r: number } | "tray" | null; moved: boolean };

const DEMO = new URLSearchParams(location.search).get("demo") === "loom";

export function LoomScreen() {
  const server = useStore((s) => s.loom);
  const editable = useStore((s) => s.loomEditable) || DEMO;
  const inRun = useStore((s) => !!s.expedition);
  const rank = DEMO ? 9 : (server?.rank ?? 1);
  /** Prologue: the player places their hero's first Form themselves. */
  const lesson = useStore((s) => s.tutorial === "form") && !DEMO;
  const me = useStore((s) => s.hero);
  const tutorial = useStore((s) => s.tutorial);
  const mine: RootId = me?.root ?? "quick";
  const roots = DEMO ? PARTY : partyRoots();
  const [hero, setHero] = useState<RootId>(lesson || tutorial ? mine : (me?.root ?? "iron"));
  const [layout, setLayout] = useState<Layout>(() => (DEMO ? (DEMO_LOOMS as Layout) : fromServer(server)));
  const [pool, setPool] = useState<LoomNode[]>(() => (DEMO ? [] : (server?.pool ?? [])));
  const [drag, setDrag] = useState<Drag | null>(null);
  const [detail, setDetail] = useState<LoomNode | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [diff, setDiff] = useState<string[]>([]);
  const press = useRef<{ id: string; t: number; timer: number; x: number; y: number } | null>(null);
  const lastTap = useRef<{ id: string; t: number } | null>(null);
  const { toStage: rawToStage } = useStage();
  const worldTop = useWorldTop();
  const toStage = (x: number, y: number) => {
    const p = rawToStage(x, y);
    return { x: p.x, y: p.y - worldTop };
  };

  useEffect(() => {
    if (!DEMO && !server) refreshLoom().catch((e) => toast(e.message, "loss"));
  }, []);
  useEffect(() => {
    if (DEMO || !server) return;
    setLayout(fromServer(server));
    setPool(server.pool ?? []);
  }, [server]);

  const nodes = layout[hero] ?? [];
  const compiled = useMemo(() => compileLoom(nodes, rank), [nodes, rank]);

  // What the board would compile to if the dragged node were dropped where it hovers (§93–94).
  const preview = useMemo(() => {
    if (!drag?.moved || !drag.over) return null;
    const next = moveNode(nodes, drag.node, drag.over);
    const c = compileLoom(next, rank);
    return { nodes: next, compiled: c, diff: diffLooms(compiled, c) };
  }, [drag?.over && JSON.stringify(drag.over), drag?.moved, nodes, rank]);

  const shown = preview?.nodes ?? nodes;
  const shownC = preview?.compiled ?? compiled;

  const commit = async (next: LoomNode[], nextPool: LoomNode[]) => {
    const d = diffLooms(compiled, compileLoom(next, rank));
    setDiff(d);
    setLayout((l) => ({ ...l, [hero]: next }));
    setPool(nextPool);
    sfx.tap();
    if (DEMO) return;
    try {
      await api.putLoom(
        hero,
        next.map((n) => ({ artifactId: n.formId, q: n.q, r: n.r })),
      );
      await refreshLoom();
    } catch (e) {
      toast((e as Error).message, "loss");
      await refreshLoom().catch(() => null);
    }
  };

  const removeToPool = (n: LoomNode) => commit(nodes.filter((x) => x.id !== n.id), [...pool, n]);

  // ───────────── pointer handling ─────────────
  const down = (e: React.PointerEvent, node: LoomNode, from: "board" | "pool") => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = toStage(e.clientX, e.clientY);
    const timer = window.setTimeout(() => {
      if (press.current?.id === node.id && !drag?.moved) {
        setDetail(node);
        press.current = null;
        setDrag(null);
      }
    }, 520);
    press.current = { id: node.id, t: performance.now(), timer, x: p.x, y: p.y };
    setDrag({ node, from, x: p.x, y: p.y, over: null, moved: false });
  };
  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = toStage(e.clientX, e.clientY);
    const moved = drag.moved || Math.hypot(p.x - (press.current?.x ?? p.x), p.y - (press.current?.y ?? p.y)) > 14;
    if (!editable) return;
    if (moved && press.current) clearTimeout(press.current.timer);
    setDrag({ ...drag, x: p.x, y: p.y, moved, over: moved ? hitTest(p.x, p.y, rank) : null });
  };
  const up = () => {
    const d = drag;
    const pr = press.current;
    if (pr) clearTimeout(pr.timer);
    press.current = null;
    setDrag(null);
    if (!d) return;
    if (!d.moved) {
      if (!pr) return; // long-press already opened the detail sheet
      const now = performance.now();
      if (editable && d.from === "board" && lastTap.current?.id === d.node.id && now - lastTap.current.t < 320) {
        lastTap.current = null;
        removeToPool(d.node);
        return;
      }
      lastTap.current = { id: d.node.id, t: now };
      setSelected(d.node.id);
      return;
    }
    if (!editable) return;
    if (d.over === "tray") {
      if (d.from === "board") removeToPool(d.node);
      return;
    }
    if (d.over) {
      const next = moveNode(nodes, d.node, d.over);
      const nextPool = d.from === "pool" ? pool.filter((x) => x.id !== d.node.id) : pool;
      // A node displaced from its cell by a pool drop goes back to the pool.
      const displaced = d.from === "pool" ? nodes.find((x) => x.q === (d.over as any).q && x.r === (d.over as any).r) : undefined;
      commit(
        displaced ? next.filter((x) => x.id !== displaced.id) : next,
        displaced ? [...nextPool, displaced] : nextPool,
      );
    }
  };

  const close = () => {
    if (inRun && editable && !DEMO) {
      leaveShrine()
        .then(() => toast("The Loom is set. Your party carries this weave until the next Shrine.", "info"))
        .catch((e) => toast((e as Error).message, "loss"));
    } else if (inRun) setState({ screen: "map" });
    else setState({ screen: "crossing" });
  };

  const lessonForm = lesson ? (pool.find((n) => n.role === "action") ?? nodes.find((n) => n.role === "action")) : undefined;
  const heroName = me?.name ?? ROOTS[mine].name;
  const lessonPlaced = !!lessonForm && hero === mine && nodes.some((n) => n.id === lessonForm.id);
  const lessonSkill = lessonPlaced ? compiled.actions.find((a) => a.nodeId === lessonForm!.id) : undefined;
  const coach = !lesson
    ? null
    : hero !== mine
      ? { text: `Open **${heroName}** to place the new Form.` }
      : !lessonPlaced
        ? { text: "A Form dropped! Forms are the pieces of your skill tree. **Drag it** onto a glowing cell beside your Root." }
        : !lessonSkill
          ? { text: "It's **dormant**: a node must touch the Root, or share an Affinity with a neighbour. Drag it beside the Root." }
          : {
              text: `**${lessonSkill.name}** is now ${heroName}'s skill. Your Loom is your skill tree: move a Form and the skills change.`,
              action: { label: "Fight", onClick: () => goTo("skill"), testId: "lesson-fight" },
            };

  const cells = boardCells(2);
  const radius = rank >= 8 ? 2 : 1;
  const byCell = new Map(shown.map((n) => [`${n.q},${n.r}`, n]));
  const dormant = new Set(shownC.dormantNodeIds);

  return (
    <div className="loom-screen" onPointerMove={move} onPointerUp={up} onPointerCancel={up} data-testid="loom">
      <div className="loom-bg" />
      <div className="world" style={{ top: worldTop }}>
      <header className="loom-head">
        <div className="loom-title">
          <h1>The Loom</h1>
          <div className="loom-sub">
            Rank {rank} · Capacity{" "}
            <b className={shownC.usedCapacity > shownC.capacity ? "bad" : ""}>
              {shownC.usedCapacity}/{shownC.capacity}
            </b>
            {!editable && <span className="lock"> · locked until a Shrine</span>}
          </div>
        </div>
        {!lesson && <button className="loom-done" onClick={close} data-testid="loom-done">
          {inRun && editable ? "Leave Shrine" : "Done"}
        </button>}
      </header>
      <div className="hero-tabs">
        {roots.map((r) => (
          <button key={r} className={`hero-tab ${r === hero ? "on" : ""} ${lesson && r === mine && hero !== mine ? "coach-pulse" : ""}`} onClick={() => (setHero(r), setDiff([]), setSelected(null))} data-testid={`loom-tab-${r}`}>
            <Head figure={heroFigure(r)} size={64} look={lookFor(r)} />
            <span>{rootLabel(r)}</span>
          </button>
        ))}
      </div>

      <svg className="loom-board" viewBox="0 0 1080 1920">
        {/* cells */}
        {cells.map(({ q, r }) => {
          const [x, y] = cellXY(q, r);
          const locked = hexDist(q, r) > radius;
          const hover = drag?.moved && drag.over && drag.over !== "tray" && drag.over.q === q && drag.over.r === r;
          const glow = lesson && hero === mine && !lessonPlaced && hexDist(q, r) === 1 && !byCell.has(`${q},${r}`);
          return <path key={`${q},${r}`} d={hexPath(x, y, HEX - 6)} className={`cell ${locked ? "locked" : ""} ${hover ? "hover" : ""} ${glow ? "coach-cell" : ""}`} data-testid={`cell-${q}_${r}`} />;
        })}
        {/* painted links */}
        {shownC.links.map((l) => {
          const a = l.a === "root" ? ([CX, CY] as [number, number]) : cellOf(shown, l.a);
          const b = l.b === "root" ? ([CX, CY] as [number, number]) : cellOf(shown, l.b);
          if (!a || !b) return null;
          const color = l.affinity === "root" ? "#ecc56a" : AFF_COLOR[l.affinity];
          return (
            <g key={`${l.a}-${l.b}`}>
              <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#1d1822" strokeWidth={26} strokeLinecap="round" />
              <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={color} strokeWidth={14} strokeLinecap="round" filter="url(#wc)" />
            </g>
          );
        })}
        {/* the Root */}
        <path d={hexPath(CX, CY, HEX - 10)} className="root-cell" />
        <text x={CX} y={CY + 72} className="root-label">
          {rootLabel(hero)}
        </text>
        {cells.map(({ q, r }) => {
          const n = byCell.get(`${q},${r}`);
          if (!n || (drag?.moved && n.id === drag.node.id && !preview)) return null;
          const [x, y] = cellXY(q, r);
          return <NodeHex key={n.id} n={n} x={x} y={y} dormant={dormant.has(n.id)} reason={shownC.dormancy[n.id]} selected={selected === n.id} ghost={drag?.moved && drag.node.id === n.id} />;
        })}
        {hexDist(0, 0) === 0 && <circle cx={CX} cy={CY - 10} r={0} />}
      </svg>
      <div className="root-head" style={{ left: CX - 50, top: CY - 70 }}>
        <Head figure={heroFigure(hero)} size={100} look={lookFor(hero)} />
      </div>
      {/* hit targets for board nodes (HTML, so long-press and drag work on touch) */}
      {nodes.map((n) => {
        const [x, y] = cellXY(n.q, n.r);
        return <div key={n.id} className="node-hit" style={{ left: x - HEX * 0.8, top: y - HEX * 0.8, width: HEX * 1.6, height: HEX * 1.6 }} onPointerDown={(e) => down(e, n, "board")} data-testid={`node-${n.id}`} />;
      })}

      <div className={`tray ${drag?.moved && drag.over === "tray" ? "hover" : ""}`} style={{ top: TRAY_TOP, height: TRAY_H }}>
        <div className="tray-label">
          Forms <span className="dim">· drag onto the Loom · hold for details</span>
        </div>
        <div className="tray-row">
          {pool.length === 0 && <div className="tray-empty">No unplaced nodes. Attune a Form, then Inscribe it at the Crucible.</div>}
          {pool.map((n) => (
            <div key={n.id} className={`tray-item ${lesson && n.id === lessonForm?.id && hero === mine ? "coach-pulse" : ""}`} onPointerDown={(e) => down(e, n, "pool")} data-testid={`pool-${n.id}`}>
              <svg viewBox="-80 -80 160 160" width={150} height={150}>
                <NodeHex n={n} x={0} y={0} small />
              </svg>
              <div className="tray-name">{n.name}</div>
            </div>
          ))}
        </div>
      </div>

      {coach && !drag?.moved && <Coach text={coach.text} action={coach.action} key={coach.text} style={coach.action ? { bottom: "calc(24px - (var(--stage-h) - 1920px) / 2)" } : { top: 985 }} />}
      <CompilePreview c={shownC} diff={preview?.diff ?? diff} previewing={!!preview} />

      {drag?.moved && (
        <svg className="drag-ghost" viewBox="0 0 1080 1920">
          <NodeHex n={drag.node} x={drag.x} y={drag.y - 40} lifted />
        </svg>
      )}
      </div>
      {detail && <NodeDetail n={detail} compiled={compiled} rank={rank} onClose={() => setDetail(null)} onRemove={editable && nodes.some((x) => x.id === detail.id) ? () => (removeToPool(detail), setDetail(null)) : undefined} />}
    </div>
  );
}

function fromServer(v: any): Layout {
  const out = {} as Layout;
  for (const r of PARTY) out[r] = (v?.heroes?.[r]?.nodes ?? []) as LoomNode[];
  return out;
}

function cellOf(nodes: LoomNode[], id: string): [number, number] | null {
  const n = nodes.find((x) => x.id === id);
  return n ? cellXY(n.q, n.r) : null;
}

/** Place `node` at `to`, swapping with whatever was there when it came from the board. */
function moveNode(nodes: LoomNode[], node: LoomNode, to: { q: number; r: number } | "tray"): LoomNode[] {
  if (to === "tray") return nodes.filter((x) => x.id !== node.id);
  const from = nodes.find((x) => x.id === node.id);
  const occupant = nodes.find((x) => x.q === to.q && x.r === to.r && x.id !== node.id);
  let out = nodes.filter((x) => x.id !== node.id).map((x) => (occupant && x.id === occupant.id ? (from ? { ...x, q: from.q, r: from.r } : x) : x));
  if (occupant && !from) out = out.filter((x) => x.id !== occupant.id).concat();
  return [...out, { ...node, q: to.q, r: to.r }];
}

function hitTest(x: number, y: number, rank: number): { q: number; r: number } | "tray" | null {
  if (y >= TRAY_TOP) return y < TRAY_TOP + TRAY_H ? "tray" : null;
  const radius = rank >= 8 ? 2 : 1;
  let best: { q: number; r: number } | null = null;
  let bd = Infinity;
  for (const c of boardCells(2)) {
    if (hexDist(c.q, c.r) > radius) continue;
    const [cx, cy] = cellXY(c.q, c.r);
    const d = Math.hypot(cx - x, cy - y);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return bd < HEX ? best : null;
}

/** A deterministic rune from the Form's id (§92: procedural, no image generation). */
function sigil(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  const rnd = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507)), ((h >>> 0) % 1000) / 1000);
  const pts = Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * Math.PI * 2 + rnd() * 0.4;
    const r = 18 + rnd() * 20;
    return [Math.cos(a) * r, Math.sin(a) * r] as [number, number];
  });
  const strokes: string[] = [];
  const n = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const a = pts[Math.floor(rnd() * 7)]!;
    const b = pts[Math.floor(rnd() * 7)]!;
    strokes.push(`M${a[0].toFixed(1)} ${a[1].toFixed(1)} Q${(rnd() * 16 - 8).toFixed(1)} ${(rnd() * 16 - 8).toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`);
  }
  return { d: strokes.join(" "), dot: rnd() > 0.5 };
}

function NodeHex({ n, x, y, dormant, reason, selected, small, lifted, ghost }: { n: LoomNode; x: number; y: number; dormant?: boolean; reason?: string; selected?: boolean; small?: boolean; lifted?: boolean; ghost?: boolean }) {
  const [a, b] = n.affinities;
  const s = small ? 70 : HEX - 12;
  const sg = sigil(n.formId);
  const k = s / 92;
  return (
    <g className={`node ${dormant ? "dormant" : ""} ${selected ? "selected" : ""} ${lifted ? "lifted" : ""} ${ghost ? "ghost" : ""} ev-${n.evidence}`}>
      <path d={hexPath(x, y, s)} fill={AFF_DEEP[a]} stroke="#1d1822" strokeWidth={10} />
      <path d={hexPath(x, y, s - 12)} fill={AFF_COLOR[a]} opacity={0.55} filter="url(#wc)" />
      <path d={hexPath(x, y, s - 4)} fill="none" stroke={AFF_COLOR[b]} strokeWidth={8} opacity={0.95} className="rim" />
      {n.evidence === "witnessed" && <path d={hexPath(x, y, s + 5)} fill="none" stroke="#ecc56a" strokeWidth={4} />}
      <g transform={`translate(${x} ${y - 8 * k}) scale(${k})`}>
        <path d={sg.d} stroke="#1d1822" strokeWidth={9} fill="none" strokeLinecap="round" />
        <path d={sg.d} stroke="#fbe8b0" strokeWidth={4} fill="none" strokeLinecap="round" />
        {sg.dot && <circle r={5} fill="#fbe8b0" />}
      </g>
      <text x={x - s * 0.52} y={y - s * 0.42} className="node-role">
        {ROLE_GLYPH[n.role]}
      </text>
      <text x={x + s * 0.5} y={y - s * 0.42} className="node-aff" fill={AFF_COLOR[b]}>
        {AFF_GLYPH[a]}
        {AFF_GLYPH[b]}
      </text>
      <text x={x} y={y + s * 0.62} className="node-name">
        {n.role === "action" ? TEMPLATES[templateFor(a)].name : ROLE_NAME[n.role]}
      </text>
      {!small && <text x={x} y={y + s * 0.34} className="node-score">{Math.round(n.technicalScore)}</text>}
      {dormant && (
        <text x={x} y={y + 6} className="node-dormant">
          DORMANT
        </text>
      )}
      {dormant && reason && (
        <text x={x} y={y + 30} className="node-reason">
          {reason}
        </text>
      )}
    </g>
  );
}

function CompilePreview({ c, diff, previewing }: { c: CompiledLoom; diff: string[]; previewing: boolean }) {
  return (
    <div className={`compile ${previewing ? "previewing" : ""}`} data-testid="compile-preview">
      <div className="compile-cols">
        <div>
          <h3>Actions</h3>
          {c.actions.length === 0 && <div className="dim">none</div>}
          {c.actions.map((a) => (
            <div key={a.nodeId} className="c-row">
              <span style={{ color: AFF_COLOR[a.dominant] }}>{AFF_GLYPH[a.dominant]}</span> {a.name} <b>{a.apCost} AP</b>
              <span className="dim"> · Break {Math.round(a.breakTotal)}</span>
            </div>
          ))}
        </div>
        <div>
          <h3>Reactions</h3>
          {c.reactions.length === 0 && <div className="dim">none</div>}
          {c.reactions.map((r) => (
            <div key={r.nodeId} className={`c-row ${r.executes ? "" : "dim"}`}>
              {r.name}
              {!r.executes && " (weaker)"}
            </div>
          ))}
          <h3>Keystone</h3>
          <div className="c-row">{c.keystone ? c.keystone.name : <span className="dim">none</span>}</div>
          <h3>Capacity</h3>
          <div className="c-row">
            <b className={c.usedCapacity > c.capacity ? "bad" : ""}>
              {c.usedCapacity} / {c.capacity}
            </b>
          </div>
        </div>
      </div>
      {diff.length > 0 && (
        <div className="c-diff">
          {diff.slice(0, 5).map((d) => (
            <div key={d} className={d.startsWith("−") ? "bad" : d.startsWith("+") ? "good" : ""}>
              {d}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NodeDetail({ n, compiled, rank, onClose, onRemove }: { n: LoomNode; compiled: CompiledLoom; rank: number; onClose: () => void; onRemove?: () => void }) {
  const [a, b] = n.affinities;
  const [market, setMarket] = useState<any>(null);
  useEffect(() => {
    if (DEMO) return;
    api
      .artifact(n.formId)
      .then(setMarket)
      .catch(() => null);
  }, [n.formId]);
  const act = compiled.actions.find((x) => x.nodeId === n.id);
  const react = compiled.reactions.find((x) => x.nodeId === n.id);
  const pot = nodePotency(n.technicalScore, n.evidence);
  const ev = market?.artifact?.evaluation;
  return (
    <div className="sheet-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()} data-testid="node-detail">
      <div className="sheet card-sheet" style={{ ["--aff" as string]: AFF_COLOR[a], ["--aff-deep" as string]: AFF_DEEP[a], ["--aff2" as string]: AFF_COLOR[b] }}>
        <div className="cs-title">
          <h2>{n.name}</h2>
          <span className="cs-cost" title="Capacity">{CAPACITY_COST[n.role]}</span>
        </div>
        <div className="cs-art">
          <CardArt seed={n.formId} aff={a} aff2={b} />
        </div>
        <div className="sheet-sub">
          {ROLE_GLYPH[n.role]} {ROLE_NAME[n.role]} · <span className="cs-aff" style={{ color: AFF_COLOR[a] }}>{a}</span> / <span className="cs-aff" style={{ color: AFF_COLOR[b] }}>{b}</span> · {n.evidence} · score {Math.round(n.technicalScore)}
        </div>
        <div className="cs-rules">
        <div className="sheet-kv">
          <span>Potency</span>
          <b>{pot.toFixed(2)}</b>
          <span>Capacity</span>
          <b>{CAPACITY_COST[n.role]}</b>
          {ev && (
            <>
              <span>Production cost</span>
              <b>{Math.round(ev.productionCost)} Crowns</b>
              <span>Resale value</span>
              <b>{Math.round(ev.marketValue)} Crowns</b>
              <span>Efficiency</span>
              <b>{(ev.efficiency ?? 0).toFixed?.(2) ?? ev.efficiency}</b>
            </>
          )}
        </div>
        {n.role === "action" && (
          <p>
            <b>{TEMPLATES[templateFor(a)].name}</b>: {TEMPLATES[templateFor(a)].desc}
            <br />
            Rider ({b}): {RIDER_TEXT[b]}
            {act && act.modifiers.length > 0 && (
              <>
                <br />
                Modified by: {act.modifiers.map((m) => m.affinity).join(", ")}
              </>
            )}
          </p>
        )}
        {n.role === "modifier" && (
          <p>
            Adjacent Actions: {MODIFIER_TEXT[a].action}
            <br />
            Adjacent Reactions: {MODIFIER_TEXT[a].reaction}
          </p>
        )}
        {n.role === "reaction" && (
          <p>
            <b>{REACTIONS[a].name}</b>: {REACTIONS[a].desc}
            {react && !react.executes && <span className="dim"> (a stronger Reaction with the same trigger takes precedence)</span>}
          </p>
        )}
        {n.role === "keystone" && (
          <p>
            <b>{KEYSTONES[a].name}</b>: {KEYSTONES[a].desc}
          </p>
        )}
        {compiled.dormancy[n.id] && <p className="bad">Dormant: {compiled.dormancy[n.id]}.</p>}
        </div>
        <div className="row end">
          {!DEMO && (
            <button onClick={() => setState({ panel: "crucible", crucibleFocus: n.formId, crucibleMode: "craft" })} disabled={!getState().loomEditable && !!getState().expedition}>
              Crucible
            </button>
          )}
          {onRemove && <button onClick={onRemove}>Lift off</button>}
          <button className="primary" onClick={onClose}>
            Close
          </button>
        </div>
        {rank < 8 && <p className="dim small">The outer ring opens at Loom Rank 8.</p>}
      </div>
    </div>
  );
}
