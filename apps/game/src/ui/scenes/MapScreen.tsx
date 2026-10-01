import { sfx } from "../battle/sfx";
import { FOES, PARTY, ROOTS, type FoeKind, type RootId } from "@ender/battle";
import { rootLabel, heroFigure, lookFor, partyRoots } from "../../game/hero";
import { getState as getStoreState } from "../../state/store";
import { backdropFor } from "../../art/registry";
import { SceneBackdrop } from "../../art/SceneBackdrop";
import { finishExpedition, nodeById, reachable, stepTo } from "../../game/flow";
import { setState, toast, useStore, type MapNode } from "../../state/store";
import { Head } from "../battle/Figure";
import { useStage } from "../Stage";

const KIND: Record<string, { glyph: string; name: string }> = {
  combat: { glyph: "⚔", name: "Fight" },
  elite: { glyph: "☠", name: "Elite" },
  shrine: { glyph: "✧", name: "Shrine" },
  attunement: { glyph: "◬", name: "Attunement" },
  bazaar: { glyph: "⚖", name: "Bazaar" },
  contract: { glyph: "✉", name: "Contract" },
  mystery: { glyph: "?", name: "Mystery" },
  boss: { glyph: "♚", name: "Boss" },
};
/** What a reachable node holds, in a few words, for the nodes that aren't fights. */
const PEEK: Record<string, string> = {
  shrine: "rework your Loom",
  attunement: "weave your Forms",
  bazaar: "buy and sell",
  contract: "take a paid job",
  mystery: "anything at all",
};
const REALM_NAME: Record<string, string> = { "ashen-vault": "The Ashen Vault", "glass-fen": "The Glass Fen", "hollow-keep": "The Hollow Keep" };


/** The branching Expedition route (§76–77), climbing from the bottom of the screen to the Boss at the top. */
export function MapScreen() {
  const ex = useStore((s) => s.expedition);
  const { h } = useStage();
  // Route between the header (top) and the thumb-zone dock (health and Loom, bottom).
  const TOP = 290;
  const BOTTOM = h - 370;
  useStore((s) => s.panel);
  if (!ex) return null;
  const layers = ex.plan.map.layers;
  // The route scrolls as you climb: where you stand sits at the bottom, so the next choice is always under
  // the thumb, and the layers left to climb spread over the rest of the screen.
  const anchor = ex.at ? (nodeById(ex.at)?.layer ?? 0) : 0;
  const step = (BOTTOM - TOP) / Math.max(1, layers.length - 1 - anchor);
  const pos = (n: MapNode): [number, number] => {
    const layer = layers[n.layer]!;
    const i = layer.findIndex((x) => x.id === n.id);
    const y = BOTTOM - step * (n.layer - anchor);
    const x = layer.length === 1 ? 540 : 200 + (680 * i) / (layer.length - 1);
    // A little hand-drawn wobble, deterministic per node.
    const w = ((n.id.charCodeAt(n.id.length - 1) * 37) % 60) - 30;
    return [x + w, y];
  };
  const next = new Set(reachable().map((n) => n.id));
  const Back = backdropFor(ex.plan.realmId, false)?.default;
  const go = (n: MapNode) => {
    if (!next.has(n.id)) return;
    sfx.step();
    stepTo(n).catch((e) => toast((e as Error).message, "loss"));
  };
  const here = ex.at ? nodeById(ex.at) : null;
  return (
    <div className="map-screen" data-testid="map">
      <div className="backdrop dimmed">
        <SceneBackdrop id={ex.plan.realmId} Drawn={Back} />
      </div>
      <header className="map-head">
        <div>
          <div className="map-title">{REALM_NAME[ex.plan.realmId] ?? ex.plan.realmId}</div>
          <div className="map-sub">
            {ex.at ? `Step ${anchor + 1} of ${layers.length}. ` : ""}
            {layers.length - 1 - anchor <= 1 && ex.at ? "The Boss is next." : "Choose your path."}
          </div>
        </div>
        {/* Withdrawing is rare and final, so it sits up top, out of the thumb's way. */}
      <button
        className="map-withdraw"
        onClick={() => {
          if (confirm("Withdraw from this Expedition? You keep what you found.")) finishExpedition("abandon").catch((e) => toast(e.message, "loss"));
        }}
      >
        Withdraw
      </button>
      </header>
      <svg className="map-svg" viewBox={`0 0 1080 ${h}`} style={{ height: h }}>
        {layers.flat().flatMap((n) =>
          n.links.map((l) => {
            const m = nodeById(l);
            if (!m || n.layer < anchor) return null;
            const [x1, y1] = pos(n);
            const [x2, y2] = pos(m);
            const walked = ex.visited.includes(n.id) && ex.visited.includes(l);
            return <path key={`${n.id}-${l}`} d={`M${x1} ${y1} Q${(x1 + x2) / 2 + (y1 % 40) - 20} ${(y1 + y2) / 2} ${x2} ${y2}`} className={`map-link ${walked ? "walked" : ""}`} />;
          }),
        )}
      </svg>
      {layers.flat().map((n) => {
        const [x, y] = pos(n);
        const k = KIND[n.kind] ?? { glyph: "•", name: n.kind };
        const visited = ex.visited.includes(n.id);
        return (
          <button
            key={n.id}
            className={`map-node k-${n.kind} ${n.layer < anchor ? "past" : n.layer === anchor && ex.at !== n.id ? "passed" : ""} ${next.has(n.id) ? "next" : ""} ${visited ? "visited" : ""} ${ex.at === n.id ? "here" : ""}`}
            style={{ left: x, top: y }}
            onClick={() => go(n)}
            disabled={!next.has(n.id)}
            data-testid={`map-node-${n.id}`}
            data-kind={n.kind}
          >
            {/* The choices in front of you show what they hold: the foe you'd face, or what you'd find. */}
            {next.has(n.id) && n.encounter ? (
              <span className="mn-foe">
                <span className="mn-face">
                  <Head figure={FOES[n.encounter.waves.flat()[0] as FoeKind]?.figure ?? n.encounter.waves.flat()[0]!} size={124} />
                </span>
                {n.encounter.waves.flat().length > 1 && <b className="mn-more">×{n.encounter.waves.flat().length}</b>}
              </span>
            ) : (
              <span className="mn-glyph">{k.glyph}</span>
            )}
            <span className="mn-name">
              {n.label ?? k.name}
              {next.has(n.id) && !n.encounter && PEEK[n.kind] && <small className="mn-peek">{PEEK[n.kind]}</small>}
              {next.has(n.id) && n.encounter && <small className="mn-peek">{FOES[n.encounter.waves.flat()[0] as FoeKind]?.name ?? "foes"}</small>}
            </span>
          </button>
        );
      })}
      {here && (
        <div className="map-marker" style={{ left: pos(here)[0], top: pos(here)[1] }}>
          <Head figure={heroFigure(getStoreState().hero?.root ?? "iron")} look={getStoreState().hero?.look} size={70} />
        </div>
      )}
      {/* Thumb-zone dock: your health on the left, the Loom on the right. */}
      <div className="map-dock map-party">
        {partyRoots().map((r: RootId) => {
          const hp = ex.partyHp[r] ?? ROOTS[r].hp;
          return (
            <div key={r} className="mp-hero">
              <Head figure={heroFigure(r)} size={96} look={lookFor(r)} />
              <div className="mp-hp">
                <span className="mp-name">{rootLabel(r)}</span>
                <div className="gbar hp hero">
                  <div style={{ width: `${(hp / ROOTS[r].hp) * 100}%` }} />
                </div>
                <span>
                  {hp}/{ROOTS[r].hp}
                </span>
              </div>
            </div>
          );
        })}
        <button className="big" onClick={() => setState({ screen: "loom" })} data-testid="map-loom">
          Loom
        </button>
      </div>
    </div>
  );
}
