import { useEffect, useState } from "react";
import { CURRENCIES } from "@ender/content";
import { api } from "../api";
import { refreshCharacter } from "../game/flow";
import { setState, toast, useStore } from "../state/store";
import { Panel } from "./Panel";
import { FormCard } from "./FormCard";
import { essenceColor, essenceGlyph, essenceName, fmt } from "../economy/format";

export function Inventory() {
  const [inv, setInv] = useState<any>(null);
  const c = useStore((s) => s.character);
  const screen = useStore((s) => s.screen);
  const load = () => api.inventory().then(setInv);
  useEffect(() => {
    load().catch((e) => toast(e.message, "loss"));
  }, []);
  if (!inv || !c) return <Panel title="Inventory">…</Panel>;
  const equipped = (slot: string) => inv.artifacts.find((a: any) => a.id === inv.equipped[slot]);
  const use = async (id: string) => {
    try {
      const out = await api.useItem(id);
      toast(out.rumor?.text ?? (out.contract ? `New contract: ${out.contract.title}` : "Used"), "info");
      await refreshCharacter();
      await load();
    } catch (e) {
      toast((e as Error).message, "loss");
    }
  };
  const unequip = async (slot: string) => {
    await api.equip(slot, null);
    await refreshCharacter();
    await load();
  };
  return (
    <Panel title="Inventory" subtitle={`Damage ${fmt(c.stats.attackDamage, 1)} · Health ${fmt(c.stats.maxHealth)} · Cooldowns ×${fmt(c.stats.cooldownRate, 2)} · Loot +${fmt(c.stats.lootPercentileBonus, 1)} pct`} wide testId="inventory">
      <div className="slots">
        {["blade", "ward", "sigil", "charm"].map((s) => {
          const a = equipped(s);
          return (
            <div key={s} className="slot" data-testid={`slot-${s}`}>
              <div className="slot-name">{s}</div>
              {a ? (
                <>
                  <div>{a.name}</div>
                  <div className="dim small">power {fmt(a.evaluation?.power, 1)}</div>
                  <button className="ghost small" onClick={() => unequip(s)}>
                    unbind
                  </button>
                </>
              ) : (
                <div className="dim small">empty</div>
              )}
            </div>
          );
        })}
      </div>
      <div className="essence-row">
        {Object.entries(inv.essences).map(([e, q]) => (
          <span key={e} className="ess-chip" style={{ color: essenceColor(e), borderColor: essenceColor(e) }}>
            {essenceGlyph(e)} {q as number} {essenceName(e)}
          </span>
        ))}
      </div>
      {inv.currencies.length > 0 && (
        <div className="currencies">
          {inv.currencies.map((x: any) => (
            <div key={x.item_id} className="currency">
              <b>
                {(CURRENCIES as any)[x.item_id]?.name} ×{x.quantity}
              </b>
              <div className="dim small">{(CURRENCIES as any)[x.item_id]?.description}</div>
              {(x.item_id === "merchants-rumor" || x.item_id === "royal-writ") && (
                <button className="small" onClick={() => use(x.item_id)}>
                  Use
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="inv-grid">
        {inv.artifacts.map((a: any) => (
          <FormCard key={a.id} a={a} compact onClick={() => screen === "crossing" && setState({ panel: "crucible", crucibleMode: "craft" })} />
        ))}
        {Array.from({ length: Math.max(0, 12 - inv.artifacts.length) }).map((_, i) => (
          <div key={`e${i}`} className="inv-empty" />
        ))}
      </div>
    </Panel>
  );
}
