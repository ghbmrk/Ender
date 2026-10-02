import { ESSENCES } from "@ender/content";
import { setState, useStore } from "../state/store";
import { Panel } from "./Panel";
import { fmt } from "../economy/format";
import { learn, learned } from "../game/firstUse";

/**
 * What you hold, and what it is for (Mark, 2026-10-02: "unclear what Essences and Crowns do, where they come from, or
 * what the current balance is"). The chip shows the balance wherever you choose where to go next; a tap opens the purse.
 */
export function PurseChip({ className = "" }: { className?: string }) {
  const c = useStore((s) => s.character);
  if (!c) return null;
  const ess = Object.values((c.essences ?? {}) as Record<string, number>).reduce((a, b) => a + b, 0);
  return (
    <button className={`purse-chip ${learned("purse") ? "" : "unread"} ${className}`} onClick={() => setState({ purse: true })} data-testid="purse" aria-label="Your purse">
      <span className="pc-crowns">◈ {fmt(c.crowns)}</span>
      <span className="pc-ess">✦ {fmt(ess)}</span>
      {!learned("purse") && <i className="pc-new">?</i>}
    </button>
  );
}

export function PurseSheet() {
  const c = useStore((s) => s.character);
  const open = useStore((s) => s.purse);
  if (!open || !c) return null;
  learn("purse");
  const close = () => setState({ purse: false });
  const held = (c.essences ?? {}) as Record<string, number>;
  return (
    <Panel title="Your purse" onClose={close} testId="purse-sheet">
      <section className="purse-part">
        <div className="pp-head">
          <span className="pp-glyph crowns">◈</span>
          <b>{fmt(c.crowns)}</b> Crowns
        </div>
        <p>
          <b>Coin.</b> Won from fights and Mysteries, and earned selling at the <b>Bazaar</b>. Spend it there on <b>Veiled Forms</b> (new skills for your Loom) and on Essences.
        </p>
      </section>
      <section className="purse-part">
        <div className="pp-head">
          <span className="pp-glyph">✦</span>
          Essences
        </div>
        <div className="pp-ess">
          {Object.values(ESSENCES).map((e) => (
            <span key={e.id} className={held[e.id] ? "" : "none"} style={{ color: e.color }}>
              <i>{e.glyph}</i>
              <b>{fmt(held[e.id] ?? 0)}</b>
              <small>{e.name}</small>
            </span>
          ))}
        </div>
        <p>
          <b>Realm materials.</b> Each Realm drops its own kinds. Changing a woven Form's role on the <b>Loom</b> costs them, and so does making a Form to sell. Spares sell at the <b>Bazaar</b> for Crowns, at prices that change every day.
        </p>
      </section>
      <button
        className="big pp-go"
        onClick={() => setState({ purse: false, panel: "bazaar", bazaarTab: "market" })}
        data-testid="purse-bazaar"
      >
        Open the Bazaar
      </button>
    </Panel>
  );
}
