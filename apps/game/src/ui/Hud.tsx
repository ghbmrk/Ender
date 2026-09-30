import { useEffect, useState } from "react";
import { bus, type HudState } from "../state/bus";
import { setState, useStore } from "../state/store";
import { crowns, fmt } from "../economy/format";

function Bar({ value, max, color, label, testId }: { value: number; max: number; color: string; label?: string; testId?: string }) {
  return (
    <div className="bar" data-testid={testId}>
      <div className="fill" style={{ width: `${Math.max(0, Math.min(100, (100 * value) / Math.max(1, max)))}%`, background: color }} />
      {label && <span>{label}</span>}
    </div>
  );
}

const ABILITIES = [
  { k: "bolt", key: "LMB", name: "Thread Bolt" },
  { k: "sever", key: "RMB", name: "Sever" },
  { k: "slip", key: "Space", name: "Slip" },
  { k: "unravel", key: "Q", name: "Unravel" },
] as const;

export function Hud() {
  const c = useStore((s) => s.character);
  const screen = useStore((s) => s.screen);
  const dev = useStore((s) => s.devMode);
  const run = useStore((s) => s.run);
  const [hud, setHud] = useState<HudState | null>(null);
  useEffect(() => {
    const off = bus.on("hud:tick", setHud);
    return () => {
      off();
    };
  }, []);
  if (!c) return null;
  const xpInto = c.xp - c.xpForLevel;
  const xpSpan = (c.xpForNext ?? c.xp) - c.xpForLevel;
  return (
    <>
      <div className="hud-top" data-testid="hud">
        <div className="hud-id">
          <div className="lvl" data-testid="level">
            Lv {c.level}
          </div>
          <div>
            <div className="name">{c.name}</div>
            <Bar value={xpInto} max={xpSpan || 1} color="linear-gradient(90deg,#6b4fa8,#b58cff)" label={`${fmt(c.xp)} XP`} testId="xp-bar" />
          </div>
        </div>
        <div className="hud-stat" title="Crowns" data-testid="crowns">
          {crowns(c.crowns)}
        </div>
        <div className="hud-stat focus" title="Focus: spent on the Familiar's work" data-testid="focus">
          ✦ {c.focus} Focus
        </div>
        {c.passivePointsAvailable > 0 && (
          <button className="hud-badge" onClick={() => setState({ panel: "passives" })} data-testid="passive-points">
            {c.passivePointsAvailable} passive point{c.passivePointsAvailable > 1 ? "s" : ""}
          </button>
        )}
        <div className="hud-stat dim">Turning of {c.world.date}</div>
        <div className="hud-spacer" />
        {screen === "crossing" && (
          <button className="ghost small" onClick={() => setState({ panel: "inventory" })}>
            Inventory (Tab)
          </button>
        )}
        {dev && (
          <button className="ghost small" onClick={() => setState({ panel: "provenance" })} data-testid="open-provenance">
            Provenance
          </button>
        )}
      </div>

      {screen === "realm" && hud && (
        <>
          <div className="hud-bottom">
            <Bar value={hud.hp} max={hud.maxHp} color="linear-gradient(90deg,#8a1c1c,#d64545)" label={`${hud.hp} / ${hud.maxHp}`} testId="hp-bar" />
            <div className="abilities">
              {ABILITIES.map((a) => {
                const cd = hud.cooldowns[a.k];
                const max = hud.cooldownMax[a.k];
                return (
                  <div key={a.k} className={`ability ${cd > 0 ? "cooling" : ""}`}>
                    <div className="cd" style={{ height: `${(100 * cd) / Math.max(0.001, max)}%` }} />
                    <b>{a.key}</b>
                    <span>{a.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="hud-room" data-testid="room">
            {hud.roomKind === "boss" ? "Throne" : hud.roomKind === "shrine" ? "Shrine" : hud.roomKind === "elite" ? "Elite chamber" : `Chamber ${hud.room + 1} of 5`}
            {hud.enemiesLeft > 0 && ` · ${hud.enemiesLeft} foes`}
            {run && <span className="dim"> · {run.realmId.replace("-", " ")}</span>}
          </div>
          {hud.boss && (
            <div className="boss-bar" data-testid="boss-bar">
              <div className="boss-name">
                The Bound King · Phase {hud.boss.phase}
                <span className={hud.boss.wardRatio >= 1 ? "good" : "bad"}>
                  {" "}
                  · Ward {hud.boss.vulnerable ? "BROKEN" : `${hud.boss.ward}%`} · your Forms {hud.boss.wardRatio >= 1 ? "overpower" : "strain against"} it (target {hud.boss.wardTarget})
                </span>
              </div>
              <Bar value={hud.boss.hp} max={hud.boss.maxHp} color="linear-gradient(90deg,#5a1030,#c02a5a)" />
              <Bar value={hud.boss.vulnerable ? 0 : hud.boss.ward} max={100} color="linear-gradient(90deg,#4a3a8a,#b58cff)" />
            </div>
          )}
          {hud.prompt && <div className="hud-prompt">{hud.prompt}</div>}
        </>
      )}
      {screen === "crossing" && <div className="hud-hint">Walk to a station and press E · The Bazaar shows what the world needs; the Realm Gate shows where to find it.</div>}
    </>
  );
}
