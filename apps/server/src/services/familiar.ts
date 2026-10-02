// The Familiar keeps working while the player is away (thread "Agent play while away", 2026-10-02).
// It is a second driver for the same systems: every action below is the same service function the player's
// buttons call, with the same Focus costs and preconditions. Nothing here grants rewards for elapsed time;
// time only refills the attention budget (one daily Watch), and every outcome comes from an action performed.
// Decisions are rules over what the player can also see (Readings until a Trial), so no paid inference.
import { round } from "@ender/shared";
import { get, now } from "../db";
import type { Ctx } from "./context";
import { artifactView, getArtifact, heldArtifacts, type ArtifactRow } from "./artifacts";
import { charRow } from "./character";
import { attune, mirror, temperChoose, temperOptions, trial } from "./craft";
import { getState, setState } from "./world";

export type MandateId = "validate" | "cheaper";
export type Mandate = { id: MandateId; /** "cheaper": the Form to undercut; default: the costliest woven Form. */ targetId?: string };

export const MANDATES: Record<MandateId, { title: string; line: string }> = {
  validate: { title: "Check my Forms", line: "Attune, Trial and Mirror what you hold, woven Forms first." },
  cheaper: { title: "Find a cheaper Form", line: "Temper spare Forms toward one that matches a woven Form's Power for less." },
};

/** One Realm's worth of Focus per real day; the reserve never holds more than two. */
export const WATCH_FOCUS = 12;
export const RESERVE_CAP = 24;
const MAX_STEPS = 40;

type FamiliarState = { mandate: Mandate | null; reserve: number; watchDay: string | null };
const key = (charId: string) => `familiar:${charId}`;
const lastKey = (charId: string) => `familiar-last:${charId}`;

export function familiarState(ctx: Ctx, charId: string): FamiliarState {
  return getState<FamiliarState>(ctx, key(charId), { mandate: null, reserve: 0, watchDay: null });
}
const save = (ctx: Ctx, charId: string, s: FamiliarState) => setState(ctx, key(charId), s);

export function setMandate(ctx: Ctx, charId: string, mandate: Mandate | null) {
  const s = familiarState(ctx, charId);
  save(ctx, charId, { ...s, mandate });
  return familiarView(ctx, charId);
}

/** Unspent Realm Focus goes to the Familiar (instead of Crowns) once a mandate is set. Returns the amount banked. */
export function bankFocus(ctx: Ctx, charId: string, focus: number): number {
  const s = familiarState(ctx, charId);
  if (!s.mandate || focus <= 0) return 0;
  const banked = Math.min(focus, RESERVE_CAP - s.reserve);
  if (banked > 0) save(ctx, charId, { ...s, reserve: s.reserve + banked });
  return Math.max(0, banked);
}

/** The daily Watch: attention, not reward. Refills once per calendar day and never stacks past the cap. */
function refreshWatch(s: FamiliarState, day: string): FamiliarState {
  if (s.watchDay === day) return s;
  return { ...s, reserve: Math.min(RESERVE_CAP, s.reserve + WATCH_FOCUS), watchDay: day };
}

// ───────────────────────────── State the loop reasons over ─────────────────────────────

type FormInfo = { row: ArtifactRow; name: string; woven: boolean; exact: boolean; power: number | null; cost: number | null };

function info(ctx: Ctx, a: ArtifactRow): FormInfo {
  const v = artifactView(ctx, a);
  const ev = v.evaluation as { power?: number; productionCost?: number } | null;
  return { row: a, name: v.name, woven: !!v.loom, exact: a.evidence_tier === "trialed" || a.evidence_tier === "witnessed", power: ev?.power ?? null, cost: ev?.productionCost ?? null };
}

const forms = (ctx: Ctx, charId: string) => heldArtifacts(ctx, charId).map((a) => info(ctx, a));

type Option = { action: "trial" | "attune" | "mirror" | "temper"; form: FormInfo; cost: number; value: number };

/** Legal moves under the mandate, each valued per Focus. Same preconditions as the services. */
function options(ctx: Ctx, charId: string, m: Mandate, focus: number, target: FormInfo | null, touched: Set<string>): Option[] {
  const out: Option[] = [];
  for (const f of forms(ctx, charId)) {
    const tier = f.row.evidence_tier;
    // A Trial is free and turns a guess into a fact: always worth it.
    if (tier === "attuned") out.push({ action: "trial", form: f, cost: 0, value: 10 });
    if (tier === "veiled") out.push({ action: "attune", form: f, cost: 1, value: m.id === "validate" ? 3 : target && f.row.objective_id === target.row.objective_id ? 3 : 1 });
    if (m.id === "validate" && tier === "trialed" && !touched.has(f.row.id)) out.push({ action: "mirror", form: f, cost: 2, value: f.woven ? 8 : 3 });
    // Temper commits to a choice, so the Familiar only tempers spare Forms; a woven slot is the player's call.
    if (m.id === "cheaper" && target && f.exact && !f.woven && f.row.id !== target.row.id && !touched.has(f.row.id))
      out.push({ action: "temper", form: f, cost: 2, value: f.row.objective_id === target.row.objective_id ? 5 : 2 });
  }
  return out.filter((o) => o.cost <= focus);
}

function pickTarget(ctx: Ctx, charId: string, m: Mandate): FormInfo | null {
  if (m.id !== "cheaper") return null;
  if (m.targetId) {
    const a = get<ArtifactRow>(ctx.db, "SELECT * FROM artifacts WHERE id = ? AND character_id = ?", m.targetId, charId);
    if (a && (a.status === "held" || a.status === "equipped")) return info(ctx, a);
  }
  const exact = forms(ctx, charId).filter((f) => f.exact && f.cost !== null);
  const pool = exact.some((f) => f.woven) ? exact.filter((f) => f.woven) : exact;
  return pool.sort((a, b) => b.cost! - a.cost!)[0] ?? null;
}

// ───────────────────────────── Outcomes and the return summary ─────────────────────────────

export type CardKind = "improved" | "unusual" | "failed" | "economy" | "decision";
export type Card = { kind: CardKind; title: string; line: string; leverage: number; formIds: string[]; proposal?: { swapInto: string; replace: string } };
export type Session = {
  at: string;
  mandate: Mandate;
  focusSpent: number;
  reserveLeft: number;
  steps: number;
  actions: { action: Option["action"]; formId: string; focus: number }[];
  tally: Record<string, number>;
  xpGained: number;
  cards: Card[];
};

const MAX_CARDS = 5;

/** Rank by leverage and keep at most five; routine volume stays in the tally. */
export function rankCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => b.leverage - a.leverage).slice(0, MAX_CARDS);
}

// ───────────────────────────── The loop ─────────────────────────────

/**
 * Called when the player returns. Refills the Watch, spends the reserve through the real services, and stores a
 * session for the summary. `today` is injectable for tests (YYYY-MM-DD).
 */
export async function familiarReturn(ctx: Ctx, charId: string, today = new Date().toISOString().slice(0, 10)): Promise<Session | null> {
  let s = refreshWatch(familiarState(ctx, charId), today);
  save(ctx, charId, s);
  const m = s.mandate;
  if (!m || s.reserve <= 0) return null;

  // The Familiar spends its own reserve through the player's Focus column, so costs and checks are identical.
  const playerFocus = charRow(ctx, charId).focus;
  const setFocus = (n: number) => ctx.db.prepare("UPDATE characters SET focus = ? WHERE id = ?").run(n, charId);
  const xp0 = charRow(ctx, charId).xp;
  setFocus(s.reserve);

  const actions: Session["actions"] = [];
  const cards: Card[] = [];
  const touched = new Set<string>();
  const witnessed: string[] = [];
  const unsteady: string[] = [];
  let target = pickTarget(ctx, charId, m);
  const searched: { from: string; power: number; cost: number }[] = [];
  let found: FormInfo | null = null;
  let steps = 0;

  try {
    while (steps++ < MAX_STEPS) {
      const focus = charRow(ctx, charId).focus;
      if (m.id === "cheaper" && !target) target = pickTarget(ctx, charId, m);
      const opts = options(ctx, charId, m, focus, target, touched);
      if (!opts.length) break;
      // Best value per Focus; ties broken by the order the player sees Forms in (stable, so runs are reproducible).
      const best = opts.reduce((a, b) => (b.value / Math.max(1, b.cost) > a.value / Math.max(1, a.cost) ? b : a));
      const id = best.form.row.id;
      if (best.action === "trial") trial(ctx, charId, id);
      else if (best.action === "attune") await attune(ctx, charId, id);
      else if (best.action === "mirror") {
        touched.add(id); // one Mirror per Form per session: a failed check isn't retried
        const r = await mirror(ctx, charId, id);
        (r.mirror.consistent ? witnessed : unsteady).push(id);
      } else {
        // Temper: take the option that best closes on the target (Power at least the target's, for less).
        touched.add(id);
        const t = await temperOptions(ctx, charId, id);
        const T = target!;
        const u = (o: (typeof t.options)[number]) => Math.min(0, o.predictedTechnicalScore - T.power!) * 2 + ((T.cost! - o.productionCost) / Math.max(1, T.cost!)) * 50;
        const pick = [...t.options].sort((a, b) => u(b) - u(a))[0];
        if (pick) {
          const child = temperChoose(ctx, charId, id, pick.candidateId).artifact.id;
          trial(ctx, charId, child); // free; the claim is checked before it's reported
          const c = info(ctx, getArtifact(ctx, child));
          searched.push({ from: id, power: c.power ?? 0, cost: c.cost ?? 0 });
          if (c.power! >= T.power! - 1 && c.cost! <= T.cost! * 0.9 && (!found || c.cost! < found.cost!)) found = c;
        }
      }
      // Actual Focus, not the list price: a Mirror charge or Broken Seal pays for some of it.
      actions.push({ action: best.action, formId: id, focus: focus - charRow(ctx, charId).focus });
    }
  } finally {
    const left = charRow(ctx, charId).focus;
    setFocus(playerFocus);
    s = { ...familiarState(ctx, charId), reserve: left };
    save(ctx, charId, s);
  }

  const focusSpent = actions.reduce((n, a) => n + a.focus, 0);
  if (!actions.length) return null;

  const listNames = (xs: string[]) => (xs.length <= 2 ? xs.join(" and ") : `${xs.slice(0, 2).join(", ")} and ${xs.length - 2} more`);
  // Cards. Leverage is a rough common scale: what the player would most regret not knowing.
  const name = (id: string) => artifactView(ctx, getArtifact(ctx, id)).name;
  if (witnessed.length) {
    const woven = witnessed.filter((id) => !!artifactView(ctx, getArtifact(ctx, id)).loom);
    cards.push({
      kind: "improved",
      title: woven.length ? `${woven.length} woven Form${woven.length > 1 ? "s" : ""} now Witnessed` : `${witnessed.length} Form${witnessed.length > 1 ? "s" : ""} Witnessed`,
      line: `${listNames(witnessed.map(name))} held up under Mirror checks, so ${witnessed.length > 1 ? "they count" : "it counts"} as proven for Keystones and contracts.`,
      leverage: 40 + 10 * woven.length,
      formIds: witnessed,
    });
  }
  for (const id of unsteady)
    cards.push({ kind: "failed", title: `${name(id)} failed its Mirror check`, line: "Its score swings under other conditions. Worth knowing before you build around it.", leverage: artifactView(ctx, getArtifact(ctx, id)).loom ? 70 : 35, formIds: [id] });
  if (m.id === "cheaper" && target) {
    if (found) {
      const f = found as FormInfo;
      const saving = round(100 * (1 - f.cost! / target.cost!));
      cards.push({
        kind: "decision",
        title: `A cheaper match for ${target.name}`,
        line: `${f.name}: Power ${round(f.power!)} vs ${round(target.power!)}, ${saving}% cheaper to make. Trialed.${target.woven ? " Swap it into the Loom?" : ""}`,
        leverage: 60 + saving,
        formIds: [f.row.id, target.row.id],
        proposal: target.woven ? { swapInto: f.row.id, replace: target.row.id } : undefined,
      });
    } else if (searched.length)
      cards.push({
        kind: "failed",
        title: `No cheaper match for ${target.name} yet`,
        line: `Tempered ${searched.length} spare Form${searched.length > 1 ? "s" : ""} toward it; the closest reached Power ${round(Math.max(...searched.map((x) => x.power)))} (needs ${round(target.power! - 1)}) under ${round(target.cost! * 0.9)} cost. A different Realm's Forms may get closer.`,
        leverage: 45,
        formIds: [target.row.id],
      });
  }

  const tally: Record<string, number> = {};
  for (const a of actions) tally[a.action] = (tally[a.action] ?? 0) + 1;
  const session: Session = { at: now(), mandate: m, focusSpent, reserveLeft: s.reserve, steps: actions.length, actions, tally, xpGained: charRow(ctx, charId).xp - xp0, cards: rankCards(cards) };
  setState(ctx, lastKey(charId), session);
  return session;
}

export function lastSession(ctx: Ctx, charId: string): Session | null {
  return getState<Session | null>(ctx, lastKey(charId), null);
}

export function familiarView(ctx: Ctx, charId: string) {
  const s = familiarState(ctx, charId);
  return { mandate: s.mandate, mandates: MANDATES, reserve: s.reserve, watch: WATCH_FOCUS, cap: RESERVE_CAP, last: lastSession(ctx, charId) };
}
