import { useEffect, useState } from "react";
import { HeroPrebake } from "../battle/HeroPrebake";
import { sfx } from "../battle/sfx";
import { FOES, PARTY, ROOTS, type FoeKind, type RootId } from "@ender/battle";
import { rootLabel, heroFigure, lookFor, partyRoots } from "../../game/hero";
import { getState as getStoreState } from "../../state/store";
import { backdropFor } from "../../art/registry";
import { SceneBackdrop } from "../../art/SceneBackdrop";
import { finishExpedition, leaveShrine, nodeById, reachable, stepTo } from "../../game/flow";
import { setState, toast, useStore, type MapNode } from "../../state/store";
import { Head } from "../battle/Figure";
import { FoeHead, HeroHead } from "../battle/ArtHeads";
import { prepaintFoes } from "../../art/ondevice/useArt";
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
/** Whether a path of links runs from one stop to another further on. */
function leadsTo(from: MapNode, id: string, seen = new Set<string>()): boolean {
  if (from.links.includes(id)) return true;
  return from.links.some((l) => {
    if (seen.has(l)) return false;
    seen.add(l);
    const n = nodeById(l);
    return !!n && leadsTo(n, id, seen);
  });
}

/** What a reachable node holds, in a few words, for the nodes that aren't fights. */
const PEEK: Record<string, string> = {
  shrine: "rest and heal",
  attunement: "weave your Forms",
  bazaar: "buy and sell",
  contract: "take a paid job",
  mystery: "anything at all",
};
/** Health the dock last showed, so a Shrine or a fight's change can play out when you come back to the map. */
const shownHp: Partial<Record<RootId, number>> = {};
/** Runs that have already had their Boss approach moment. */
const warned = new Set<string>();

const REALM_NAME: Record<string, string> = { "ashen-vault": "The Ashen Vault", "glass-fen": "The Glass Fen", "hollow-keep": "The Hollow Keep" };


/** The branching Expedition route (§76–77), climbing from the bottom of the screen to the Boss at the top. */
export function MapScreen() {
  const ex = useStore((s) => s.expedition);
  const { h } = useStage();
  // Route between the header (top) and the thumb-zone dock (health and Loom, bottom).
  const TOP = 290;
  const BOTTOM = h - 370;
  useStore((s) => s.panel);
  const [reveal, setReveal] = useState<{ node: MapNode; open: boolean } | null>(null);
  const [omen, setOmen] = useState<MapNode | null>(null);
  const rest = useStore((s) => s.rest);
  const attune = useStore((s) => s.attune);
  useEffect(() => {
    if (rest) sfx.loot(2);
  }, [rest]);
  // Health bars start where you last saw them and settle to where they are now.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 350);
    return () => clearTimeout(t);
  }, []);
  const bossNext = ex ? reachable().filter((n) => n.kind === "boss") : [];
  // The Boss's moment waits for a Shrine's rest to be dismissed, so the two never stack.
  const omenKey = ex && bossNext.length && ex.at && !rest && !attune ? ex.plan.runId : null;
  useEffect(() => {
    if (!omenKey || warned.has(omenKey)) return;
    warned.add(omenKey);
    sfx.telegraph();
    setOmen(bossNext[0]!);
    const t = setTimeout(() => setOmen(null), 4200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [omenKey]);
  // A Mystery turns itself over the moment you arrive: the tap on the stop was the choice, so no second tap to reveal it.
  const turn = () => {
    if (!reveal || reveal.open) return;
    setReveal({ ...reveal, open: true });
    if (reveal.node.encounter) sfx.telegraph();
    else sfx.loot(3);
    const n = reveal.node;
    setTimeout(() => {
      setReveal(null);
      stepTo(n).catch((e) => toast((e as Error).message, "loss"));
    }, n.encounter ? 1100 : 800);
  };
  useEffect(() => {
    if (!reveal || reveal.open) return;
    const t = setTimeout(turn, 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal]);
  const openLoom = () => setState({ attune: null, screen: "loom" });
  const moveOn = () => {
    setState({ attune: null });
    leaveShrine().catch((e) => toast((e as Error).message, "loss"));
  };
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
  const reach = reachable();
  const next = new Set(reach.map((n) => n.id));
  // Paint the foes ahead on this device while the player weighs the map, so each fight opens with its art ready.
  useEffect(() => prepaintFoes(reach), [reach.map((n) => n.id).join()]);
  // A tap on a stop you can't reach yet says where you can go, and the reachable stops flash.
  const [nudge, setNudge] = useState(0);
  const Back = backdropFor(ex.plan.realmId, false)?.default;
  const go = (n: MapNode): void => {
    if (reveal) return;
    // A tap on a stop further on goes by the way there; when that way is a fight, say so, so a Shrine never seems to turn into a foe.
    const by = (v: MapNode): void => {
      if (n.layer > anchor && v.encounter && v.kind !== "mystery")
        toast(`${withArticle(FOES[v.encounter.waves.flat()[0] as FoeKind]?.name ?? "Something")} stands between you and the ${n.label ?? KIND[n.kind]?.name ?? "stop"}.`);
      return go(v);
    };
    // With one way on there is no choice to make, so a tap on any stop takes that way.
    if (reach.length === 1 && !next.has(n.id)) return by(reach[0]!);
    // A tap on a stop further on that only one glowing stop leads to takes that stop: the tap says where you want to go.
    if (!next.has(n.id) && n.layer > anchor) {
      const via = reach.filter((r) => leadsTo(r, n.id));
      if (via.length === 1) return by(via[0]!);
    }
    if (!next.has(n.id)) {
      if (n.layer > anchor) {
        setNudge((k) => k + 1);
        // Say it in words too: a flash alone reads as nothing happening.
        toast("That stop is further on. Tap a glowing one first.");
      }
      return;
    }
    sfx.step();
    // A Mystery is a moment: a sealed card you turn over before finding out what it holds.
    if (n.kind === "mystery") return setReveal({ node: n, open: false });
    stepTo(n).catch((e) => toast((e as Error).message, "loss"));
  };
  const here = ex.at ? nodeById(ex.at) : null;
  return (
    <div
      className="map-screen"
      data-testid="map"
      // With one way on, a tap on the open map between stops takes it too: a miss is never a dead tap.
      // With a choice, a tap just beside a stop counts as a tap on the nearest one (which takes it, goes by the way
      // there, or says why not): thumbs land a little off the coin.
      onClick={(e) => {
        const t = e.target as Element;
        if (!(t === e.currentTarget || t.closest(".backdrop"))) return;
        if (reach.length === 1) return go(reach[0]!);
        let best: { n: MapNode; d: number } | null = null;
        for (const n of layers.flat()) {
          const r = e.currentTarget.querySelector(`[data-testid="map-node-${n.id}"]`)?.getBoundingClientRect();
          if (!r) continue;
          const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
          if (d < r.width * 1.25 && (!best || d < best.d)) best = { n, d };
        }
        if (best) go(best.n);
      }}
    >
      <div className="backdrop dimmed">
        <SceneBackdrop id={ex.plan.realmId} Drawn={Back} />
      </div>
      <HeroPrebake />
      <header className="map-head">
        <div>
          <div className="map-title">{REALM_NAME[ex.plan.realmId] ?? ex.plan.realmId}</div>
          <div className="map-sub">
            {ex.at ? `Step ${anchor + 1} of ${layers.length}. ` : ""}
            {layers.length - 1 - anchor <= 1 && ex.at
              ? "The Boss is next."
              : reach.length === 1
                ? `Tap the glowing ${KIND[reach[0]!.kind]?.name ?? "stop"} to go on.`
                : "Tap a glowing stop to choose your path."}
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
            className={`map-node k-${n.kind} ${n.layer < anchor ? "past" : n.layer === anchor && ex.at !== n.id ? "passed" : ""} ${next.has(n.id) ? "next" : ""} ${visited ? "visited" : ""} ${ex.at === n.id ? "here" : ""} ${next.has(n.id) && nudge ? `nudge-${nudge % 2}` : ""} ${!next.has(n.id) && n.layer > anchor ? "ahead" : ""}`}
            style={{ left: x, top: y }}
            onClick={() => go(n)}
            aria-disabled={!next.has(n.id)}
            data-testid={`map-node-${n.id}`}
            data-kind={n.kind}
          >
            {/* The choices in front of you show what they hold: the foe you'd face, or what you'd find. */}
            {next.has(n.id) && n.encounter && n.kind !== "mystery" ? (
              <span className="mn-foe">
                <span className="mn-face">
                  <FoeHead kind={n.encounter.waves.flat()[0]!} nodeId={n.id} size={124} />
                </span>
                {n.encounter.waves.flat().length > 1 && <b className="mn-more">×{n.encounter.waves.flat().length}</b>}
              </span>
            ) : (
              <span className="mn-glyph">{k.glyph}</span>
            )}
            <span className="mn-name">
              {n.label ?? k.name}
              {next.has(n.id) && (!n.encounter || n.kind === "mystery") && PEEK[n.kind] && <small className="mn-peek">{PEEK[n.kind]}</small>}
              {next.has(n.id) && n.encounter && n.kind !== "mystery" && <small className="mn-peek">{FOES[n.encounter.waves.flat()[0] as FoeKind]?.name ?? "foes"}</small>}
            </span>
          </button>
        );
      })}
      {here && (
        <div className="map-marker" style={{ left: pos(here)[0], top: pos(here)[1] }}>
          <HeroHead size={70} />
        </div>
      )}
      {reveal && (
        <div className="mystery-veil" data-testid="mystery">
          <button
            className={`mystery-card ${reveal.open ? "open" : ""} ${reveal.node.encounter ? "ambush" : "cache"}`}
            data-testid="mystery-card"
            onClick={turn}
          >
            <span className="mc-back">
              <b>?</b>
            </span>
            <span className="mc-face">
              {reveal.node.encounter ? (
                <>
                  <FoeHead kind={reveal.node.encounter.waves.flat()[0] ?? "husk"} nodeId={reveal.node.id} size={220} />
                  <b>Ambush!</b>
                  <small>{withArticle(FOES[reveal.node.encounter.waves.flat()[0] as FoeKind]?.name ?? "Something")} springs out</small>
                </>
              ) : (
                <>
                  <i className="mc-glow">◈</i>
                  <b>A hidden cache</b>
                  <small>A Form to weave, and more</small>
                </>
              )}
            </span>
          </button>
        </div>
      )}
      {rest && (
        <div className="shrine-rest" data-testid="shrine-rest">
          <div className="sr-card">
            <i className="sr-glow">✧</i>
            <b>You rest at the Shrine</b>
            <span className="sr-gain">{rest.gained > 0 ? `+${rest.gained} health` : "You are already whole"}</span>
            <div className="gbar hp hero">
              <div style={{ width: `${(rest.hp / rest.max) * 100}%` }} />
            </div>
            <small>
              {rest.hp}/{rest.max}. The Loom is open here if you want to rework it.
            </small>
            <div className="sr-actions">
              <button className="big" onClick={() => setState({ rest: null, screen: "loom" })} data-testid="shrine-loom">
                Rework Loom
              </button>
              <button
                className="big primary"
                onClick={() => {
                  setState({ rest: null });
                  leaveShrine().catch((e) => toast((e as Error).message, "loss"));
                }}
                data-testid="shrine-continue"
              >
                Move on
              </button>
            </div>
          </div>
        </div>
      )}
      {attune && (
        <div className="shrine-rest attune" data-testid="attune">
          <div className="sr-card">
            <i className="sr-glow">◬</i>
            <b>An Attunement</b>
            <span className={`sr-gain ${attune.forms ? "" : "none"}`}>{attune.forms ? `${attune.forms} ${attune.forms === 1 ? "Form" : "Forms"} to weave` : "Nothing to weave yet"}</span>
            <small>{attune.forms ? "Weave what you found into your skills before the next fight." : "Forms you find in fights can be woven here. Move on for now."}</small>
            {/* With Forms waiting, weaving is the main act; with none, moving on is, and the Loom stays a tap away. */}
            <div className="sr-actions">
              {attune.forms ? (
                <>
                  <button className="big" onClick={moveOn} data-testid="attune-later">
                    Later
                  </button>
                  <button className="big primary" onClick={openLoom} data-testid="attune-go">
                    Weave
                  </button>
                </>
              ) : (
                <>
                  <button className="big" onClick={openLoom} data-testid="attune-loom">
                    Open Loom
                  </button>
                  <button className="big primary" onClick={moveOn} data-testid="attune-go">
                    Move on
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {omen && omen.encounter && (
        <button className="boss-omen" onClick={() => setOmen(null)} data-testid="boss-omen">
          <span className="bo-face">
            <FoeHead kind={omen.encounter.waves.flat()[0] ?? "husk"} nodeId={omen.id} size={260} />
          </span>
          <b>{FOES[omen.encounter.waves.flat()[0] as FoeKind]?.name ?? "The Boss"}</b>
          <small>waits at the top of the climb</small>
          {/* One thing worth knowing before the fight: the blow that ends most runs, and how it announces itself. */}
          {heaviest(omen.encounter.waves.flat()[0] as FoeKind) && (
            <span className="bo-tip">
              Its heaviest blow is <b>{heaviest(omen.encounter.waves.flat()[0] as FoeKind)!.name}</b>. When you see “{heaviest(omen.encounter.waves.flat()[0] as FoeKind)!.tell}”, get ready to parry.
            </span>
          )}
        </button>
      )}
      {/* Thumb-zone dock: your health on the left, the Loom on the right. */}
      <div className="map-dock map-party">
        {partyRoots().map((r: RootId) => {
          const hp = ex.partyHp[r] ?? ROOTS[r].hp;
          const was = shownHp[r] ?? hp;
          const shown = settled ? hp : was;
          if (settled) shownHp[r] = hp;
          const gain = hp - was;
          return (
            <div key={r} className="mp-hero">
              {lookFor(r) ? <HeroHead size={96} /> : <Head figure={heroFigure(r)} size={96} />}
              <div className="mp-hp">
                <span className="mp-name">{rootLabel(r)}</span>
                <div className="gbar hp hero">
                  <div style={{ width: `${(shown / ROOTS[r].hp) * 100}%` }} />
                </div>
                <span>
                  {hp}/{ROOTS[r].hp} health
                </span>
                {gain !== 0 && <b key={`${hp}-${was}`} className={`mp-delta ${gain > 0 ? "up" : "down"}`}>{gain > 0 ? `+${gain}` : gain}</b>}
              </div>
            </div>
          );
        })}
        {/* The Bazaar is open between every fight (Mark, 20:42), beside the Loom. */}
        <div className="mp-actions">
          <button className="big" onClick={() => setState({ panel: "bazaar", bazaarTab: "market" })} data-testid="map-bazaar">
            Bazaar
          </button>
          <button className="big" onClick={() => setState({ screen: "loom" })} data-testid="map-loom">
            Loom
          </button>
        </div>
      </div>
    </div>
  );
}

/** "A Keeper", "An Ironbound Keeper", "The Bound King". */
const withArticle = (name: string) => (/^The /.test(name) || name === "Something" ? name : `${/^[AEIOU]/.test(name) ? "An" : "A"} ${name}`);

/** A foe's hardest-hitting attack (by its biggest single blow). */
const heaviest = (kind: FoeKind) => [...(FOES[kind]?.attacks ?? [])].sort((a, b) => Math.max(...b.hits.map((x) => x.power)) - Math.max(...a.hits.map((x) => x.power)))[0];
