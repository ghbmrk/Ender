import { useState } from "react";
import { CAPACITY_COST, KEYSTONES, MODIFIER_TEXT, REACTIONS, TEMPLATES, templateFor, type Affinity } from "@ender/battle";
import { FOCUS_COST } from "@ender/domain";
import { api } from "../../api";
import { refreshCharacter, refreshLoom } from "../../game/flow";
import { toast, useStore } from "../../state/store";
import { crowns, essenceColor, essenceGlyph, essenceName, fmt } from "../../economy/format";
import { announceProgress } from "../craftActions";
import { sfx } from "../battle/sfx";
import { ROLE_GLYPH } from "../affinity";

/**
 * Weaving: the whole of crafting on the Loom screen. A new Form is revealed with one tap, then becomes a node
 * (Action, Modifier, Reaction or Keystone) and goes straight onto the board. The choices open up gradually:
 * a first-time weaver sees only Action, then Modifier, then Reaction, then Keystone.
 */
export type Role = "action" | "modifier" | "reaction" | "keystone";
const KEY = "ender:weaves";
export function weaves() {
  try {
    return Number(localStorage.getItem(KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}
function bumpWeaves() {
  try {
    localStorage.setItem(KEY, String(weaves() + 1));
  } catch {
    /* private mode */
  }
}
/** Which roles a weaver has met so far. */
export function unlockedRoles(n = weaves()): Role[] {
  return n < 1 ? ["action"] : n < 2 ? ["action", "modifier"] : n < 4 ? ["action", "modifier", "reaction"] : ["action", "modifier", "reaction", "keystone"];
}
const ROLE_NAME: Record<Role, string> = { action: "Action", modifier: "Modifier", reaction: "Reaction", keystone: "Keystone" };
const ROLE_HINT: Record<Role, string> = {
  action: "a skill you use in battle",
  modifier: "strengthens the nodes beside it",
  reaction: "fires on its own when something happens",
  keystone: "one rule that changes how you fight",
};

function becomes(aff: [Affinity, Affinity], role: Role) {
  if (role === "action") return `${TEMPLATES[templateFor(aff[0])].name}, with a ${aff[1]} edge`;
  if (role === "modifier") return MODIFIER_TEXT[aff[0]].action;
  if (role === "reaction") return REACTIONS[aff[0]].desc;
  return `${KEYSTONES[aff[0]].name}: ${KEYSTONES[aff[0]].desc}`;
}

/** Forms not yet woven: held, not Inscribed, not on any Loom. */
export const isRaw = (a: any) => a.status === "held" && !a.inscribedRole && !a.loom;

/**
 * The roles to offer: the ones met so far, plus the cheapest one that still fits on the Loom when none of
 * those does (so a first weave never has to put an existing skill to sleep).
 */
export function offeredRoles(free: number, keystoneOk: boolean, n = weaves()): Role[] {
  const all: Role[] = ["action", "modifier", "reaction", "keystone"];
  const ok = (r: Role) => r !== "keystone" || keystoneOk;
  const met = unlockedRoles(n).filter(ok);
  if (met.some((r) => CAPACITY_COST[r] <= free)) return met;
  const fit = all.filter(ok).filter((r) => CAPACITY_COST[r] <= free).sort((a, b) => CAPACITY_COST[a] - CAPACITY_COST[b])[0];
  return fit ? [fit, ...met] : met;
}

export function WeaveSheet({ form, free, onClose, onWoven }: { form: any; free: number; onClose: () => void; onWoven: (artifactId: string) => void }) {
  const c = useStore((s) => s.character);
  const [a, setA] = useState(form);
  const [busy, setBusy] = useState(false);
  const [justRevealed, setJustRevealed] = useState(false);
  const focus = c?.focus ?? 0;
  const have = (c?.essences ?? {}) as Record<string, number>;
  // Weaving a new Form is free; only giving a woven one a different role costs Essences (server loom.inscribe).
  const cost = a.inscribedRole ? Object.entries((a.inscribeCost ?? {}) as Record<string, number>).filter(([, q]) => q > 0) : [];
  const afford = cost.every(([e, q]) => (have[e] ?? 0) >= q);
  const roles = offeredRoles(free, !!a.keystoneEligible);
  // A role met for the first time says so, so each new kind of piece arrives on its own (Mark, 2026-10-02).
  const fresh = weaves() > 0 ? unlockedRoles().filter((r) => !unlockedRoles(weaves() - 1).includes(r)) : [];

  const reveal = async () => {
    setBusy(true);
    try {
      const out = await api.attune(a.id);
      announceProgress(out);
      sfx.perfect();
      setA(out.artifact);
      setJustRevealed(true);
      await refreshCharacter();
    } catch (e) {
      toast((e as Error).message, "loss");
    } finally {
      setBusy(false);
    }
  };
  const weave = async (role: Role) => {
    setBusy(true);
    try {
      await api.inscribe(a.id, role);
      bumpWeaves();
      sfx.ap();
      await Promise.all([refreshCharacter(), refreshLoom()]);
      onWoven(a.id);
    } catch (e) {
      toast((e as Error).message, "loss");
      setBusy(false);
    }
  };

  return (
    <div className="weave-backdrop" onPointerDown={(e) => (e.stopPropagation(), e.target === e.currentTarget && onClose())}>
      <div className={`weave-sheet ${justRevealed ? "just-revealed" : ""}`} data-testid="weave-sheet">
        {justRevealed && <div className="ws-burst" aria-hidden />}
        <div className="ws-head">
          <div>
            <h2>{a.tier === "veiled" ? "A veiled Form" : a.name}</h2>
            <div className="ws-sub">
              {a.tier === "veiled"
                ? "A fight dropped it. Spend Focus to reveal what it is: a better Form makes a stronger skill and sells for more."
                : "Choose what it becomes. It goes straight onto your Loom."}
            </div>
          </div>
          <button className="ws-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {a.tier === "veiled" ? (
          <button className="big primary ws-main" disabled={busy || focus < FOCUS_COST.attune} onClick={reveal} data-testid="weave-reveal">
            Reveal · {FOCUS_COST.attune} Focus
            {focus < FOCUS_COST.attune && <small>No Focus left this Expedition</small>}
          </button>
        ) : (
          <>
            {/* What the reveal found: how hard it will hit as a skill, and what it would sell for. */}
            {justRevealed && a.evaluation && (
              <div className="ws-eval" data-testid="weave-eval">
                <span>
                  <small>Power</small>
                  <b>{fmt(a.evaluation.power, 0)}</b>
                  <i>how hard it hits as a skill</i>
                </span>
                <span>
                  <small>Worth</small>
                  <b>{crowns(a.evaluation.marketValue)}</b>
                  <i>what it sells for</i>
                </span>
              </div>
            )}
            {cost.length > 0 && (
              <div className={`ws-cost ${afford ? "" : "short"}`}>
                Costs{" "}
                {cost.map(([e, q]) => (
                  <span key={e} style={{ color: essenceColor(e) }}>
                    {essenceGlyph(e)} {q} {essenceName(e)}{" "}
                  </span>
                ))}
                {!afford && <b> · not enough</b>}
              </div>
            )}
            <div className="ws-roles">
              {roles.map((r) => (
                <button key={r} className="ws-role" disabled={busy || !afford || !a.affinities} onClick={() => weave(r)} data-testid={`weave-${r}`}>
                  <span className="ws-role-name">
                    <b className={`ws-role-sigil role-${r}`}>{ROLE_GLYPH[r]}</b>
                    {ROLE_NAME[r]} {fresh.includes(r) && <em className="ws-new">New</em>} <small>{ROLE_HINT[r]}</small>
                  </span>
                  {a.affinities && <span className="ws-role-does">{becomes(a.affinities, r)}</span>}
                  <span className={`ws-role-fit ${CAPACITY_COST[r] <= free ? "" : "full"}`}>
                    {CAPACITY_COST[r] <= free ? `Uses ${CAPACITY_COST[r]} of your ${free} free capacity` : `Your Loom is full: it would put a skill to sleep`}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
