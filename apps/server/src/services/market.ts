import { ESSENCE_IDS, rng, round, type EssenceId, type GearSlot } from "@weave/shared";
import { ESSENCES, REALMS, realmById } from "@weave/content";
import { brierQuality, masteryEffects, revealedQualityKeys, tierRank, technicalScore } from "@weave/domain";
import { essenceFreeDemand, essencePrices, essenceQty, marketValue, meetsContract, productionRecipe, salvageValue, PRESSURE_PER_UNIT } from "@weave/economy";
import { all, get, now, run, tx } from "../db";
import type { Ctx } from "./context";
import {
  HttpError,
  addItem,
  adjustCrowns,
  charRow,
  combatStatsFor,
  essences,
  getCharacter,
  getMastery,
  itemQty,
  passivesFor,
  recordMasteryEvent,
  type MasteryChange,
} from "./character";
import { artifactView, createArtifact, getArtifact, newId, trueEvaluation, trueQualities, type ArtifactRow } from "./artifacts";
import { activeContracts, addPressure, currentPrices, currentSnapshot, getState, marketContext, nextSnapshot, priceHistory, setState } from "./world";

const spreadFor = (ctx: Ctx, charId: string) => masteryEffects(getMastery(ctx, charId)).spread;

function logTx(ctx: Ctx, charId: string, assetType: "essence" | "artifact", assetId: string, side: "buy" | "sell", quantity: number, unitPrice: number, details?: unknown) {
  run(
    ctx.db,
    "INSERT INTO market_transactions (id, character_id, asset_type, asset_id, side, quantity, unit_price, world_snapshot_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    newId("tx"),
    charId,
    assetType,
    assetId,
    side,
    quantity,
    unitPrice,
    currentSnapshot(ctx).id,
    details ? JSON.stringify(details) : null,
    now(),
  );
}

export function trendText(name: string, prices: number[]): { text: string; change: number } {
  if (prices.length < 2) return { text: `${name} has only just come to market.`, change: 0 };
  const back = prices[Math.max(0, prices.length - 6)]!;
  const change = (prices[prices.length - 1]! - back) / back;
  const span = Math.min(5, prices.length - 1);
  const t =
    change > 0.25 ? "has risen sharply" : change > 0.08 ? "has risen" : change < -0.25 ? "has fallen sharply" : change < -0.08 ? "has eased" : "has held steady";
  return { text: `${name} ${t} over the last ${span === 1 ? "turning" : `${["", "", "two", "three", "four", "five"][span]} turnings`}.`, change: round(change, 3) };
}

// ───────────────────────────── Offers ─────────────────────────────

function ensureOffers(ctx: Ctx) {
  const s = currentSnapshot(ctx);
  if (get(ctx.db, "SELECT 1 FROM bazaar_offers WHERE snapshot_id = ?", s.id)) return;
  const r = rng(`offers:${s.id}`);
  const m = marketContext(ctx);
  const corpus = ctx.reality.all();
  for (let i = 0; i < 4; i++) {
    const realm = r.pick(REALMS);
    const c = corpus[Math.floor(r.next() * corpus.length)]!;
    const score = technicalScore(c.qualities, realm.objective);
    // Scholars price Veiled Forms on a hunch: half the expected value, with noise.
    const est = 0.5 * marketValue(score, c.recipe, "veiled", m).total;
    const price = round(Math.max(15, est * r.range(0.65, 1.35)));
    run(ctx.db, "INSERT INTO bazaar_offers (id, snapshot_id, reality_id, realm_id, price, status) VALUES (?, ?, ?, ?, ?, 'open')", `${s.id}:offer${i}`, s.id, c.id, realm.id, price);
  }
}

function offersView(ctx: Ctx, charId: string) {
  ensureOffers(ctx);
  const s = currentSnapshot(ctx);
  const rows = all<{ id: string; reality_id: string; realm_id: string; price: number; status: string }>(ctx.db, "SELECT * FROM bazaar_offers WHERE snapshot_id = ? ORDER BY id", s.id);
  const m = marketContext(ctx);
  const reveal = passivesFor(ctx, charId).arbitrageReveal;
  const ratio = (o: (typeof rows)[number]) => {
    const c = ctx.reality.candidateSync(o.reality_id);
    const v = marketValue(technicalScore(c.qualities, realmById(o.realm_id).objective), c.recipe, "trialed", m).total;
    return o.price / Math.max(1, v);
  };
  const open = rows.filter((o) => o.status === "open");
  const best = reveal && open.length ? open.reduce((a, b) => (ratio(a) <= ratio(b) ? a : b)) : null;
  return rows.map((o) => {
    const q = ctx.reality.candidateSync(o.reality_id).qualities;
    const keys = revealedQualityKeys(o.id, 2);
    return {
      id: o.id,
      realmId: o.realm_id,
      realmName: realmById(o.realm_id).name,
      price: o.price,
      status: o.status,
      revealed: Object.fromEntries(keys.map((k) => [k, q[k]])),
      mispriced: best?.id === o.id ? "The Scholars have badly underpriced this one." : null,
    };
  });
}

export function buyOffer(ctx: Ctx, charId: string, offerId: string) {
  const o = get<{ id: string; reality_id: string; realm_id: string; price: number; status: string }>(ctx.db, "SELECT * FROM bazaar_offers WHERE id = ?", offerId);
  if (!o || o.status !== "open") throw new HttpError(400, "offer not available");
  return tx(ctx.db, () => {
    adjustCrowns(ctx, charId, -o.price);
    run(ctx.db, "UPDATE bazaar_offers SET status = 'sold' WHERE id = ?", o.id);
    const a = createArtifact(ctx, charId, { realityId: o.reality_id, realmId: o.realm_id, origin: "bazaar", acquisitionCost: o.price });
    logTx(ctx, charId, "artifact", a.id, "buy", 1, o.price, { offerId });
    return { artifact: artifactView(ctx, a), crowns: charRow(ctx, charId).crowns };
  });
}

// ───────────────────────────── Essences ─────────────────────────────

export function tradeEssence(ctx: Ctx, charId: string, essence: EssenceId, side: "buy" | "sell", quantity: number) {
  if (!ESSENCE_IDS.includes(essence)) throw new HttpError(400, "unknown Essence");
  const qty = Math.floor(quantity);
  if (qty <= 0 || qty > 500) throw new HttpError(400, "bad quantity");
  return tx(ctx.db, () => {
    const price = currentPrices(ctx)[essence];
    const spread = spreadFor(ctx, charId);
    const unit = round(side === "buy" ? price * (1 + spread) : price * (1 - spread), 2);
    if (side === "buy") {
      adjustCrowns(ctx, charId, -round(unit * qty, 2));
      addItem(ctx, charId, "essence", essence, qty);
    } else {
      addItem(ctx, charId, "essence", essence, -qty);
      adjustCrowns(ctx, charId, round(unit * qty, 2));
    }
    // The market reacts: buying tightens local supply, selling loosens it.
    addPressure(ctx, essence, (side === "buy" ? 1 : -1) * PRESSURE_PER_UNIT * qty);
    logTx(ctx, charId, "essence", essence, side, qty, unit);
    return { essence, side, quantity: qty, unitPrice: unit, total: round(unit * qty, 2), newPrice: currentPrices(ctx)[essence], crowns: charRow(ctx, charId).crowns };
  });
}

/**
 * Pay a Form's production recipe: Essences from inventory first, any shortfall bought at the Bazaar.
 * Returns the Crown value of what was consumed.
 */
function payProduction(ctx: Ctx, charId: string, a: ArtifactRow) {
  const recipe = productionRecipe(trueQualities(ctx, a));
  const prices = currentPrices(ctx);
  const spread = spreadFor(ctx, charId);
  let crownsSpent = 0;
  let valueConsumed = 0;
  const used: Partial<Record<EssenceId, number>> = {};
  const bought: Partial<Record<EssenceId, number>> = {};
  for (const e of ESSENCE_IDS) {
    const need = essenceQty(recipe, e);
    if (!need) continue;
    const have = itemQty(ctx, charId, "essence", e);
    const fromInv = Math.min(have, need);
    const buy = need - fromInv;
    if (fromInv) addItem(ctx, charId, "essence", e, -fromInv);
    used[e] = fromInv;
    if (buy) {
      const cost = round(buy * prices[e] * (1 + spread), 2);
      adjustCrowns(ctx, charId, -cost);
      crownsSpent += cost;
      bought[e] = buy;
      addPressure(ctx, e, PRESSURE_PER_UNIT * buy);
      logTx(ctx, charId, "essence", e, "buy", buy, round(prices[e] * (1 + spread), 2), { for: a.id });
    }
    valueConsumed += need * prices[e];
  }
  run(ctx.db, "UPDATE artifacts SET bound = 1 WHERE id = ?", a.id);
  return { crownsSpent: round(crownsSpent, 2), productionCost: round(valueConsumed, 2), used, bought };
}

export function productionQuote(ctx: Ctx, charId: string, a: ArtifactRow) {
  const recipe = productionRecipe(trueQualities(ctx, a));
  const prices = currentPrices(ctx);
  const inv = essences(ctx, charId);
  const spread = spreadFor(ctx, charId);
  let crowns = 0;
  for (const e of ESSENCE_IDS) crowns += Math.max(0, essenceQty(recipe, e) - inv[e]) * prices[e] * (1 + spread);
  return { recipe: recipe.essenceCosts, crownsIfBought: round(crowns, 2), alreadyBound: !!a.bound };
}

// ───────────────────────────── Equipment ─────────────────────────────

export function equip(ctx: Ctx, charId: string, slot: GearSlot, artifactId: string | null) {
  if (!["blade", "ward", "sigil", "charm"].includes(slot)) throw new HttpError(400, "unknown slot");
  return tx(ctx.db, () => {
    const before = combatStatsFor(ctx, charId);
    const c = getCharacter(ctx, charId);
    const eq = { ...c.equipped };
    const prev = eq[slot];
    if (prev) run(ctx.db, "UPDATE artifacts SET status = 'held', equipped_slot = NULL WHERE id = ?", prev);
    let binding = null;
    if (artifactId) {
      const a = getArtifact(ctx, artifactId, charId);
      if (tierRank(a.evidence_tier) < 1) throw new HttpError(400, "Attune a Form before binding it");
      if (a.status !== "held" && a.status !== "equipped") throw new HttpError(400, `Form is ${a.status}`);
      if (a.equipped_slot && a.equipped_slot !== slot) delete eq[a.equipped_slot];
      // Binding manifests the Form: its production recipe must be paid once.
      if (!a.bound) binding = payProduction(ctx, charId, a);
      run(ctx.db, "UPDATE artifacts SET status = 'equipped', equipped_slot = ? WHERE id = ?", slot, a.id);
      eq[slot] = a.id;
    } else delete eq[slot];
    run(ctx.db, "UPDATE characters SET equipped = ? WHERE id = ?", JSON.stringify(eq), charId);
    return { equipped: eq, binding, statsBefore: before, stats: combatStatsFor(ctx, charId) };
  });
}

// ───────────────────────────── Selling Forms ─────────────────────────────

export function sellArtifact(ctx: Ctx, charId: string, artifactId: string, mode: "produce" | "salvage" = "produce") {
  const a = getArtifact(ctx, artifactId, charId);
  if (a.status !== "held" && a.status !== "equipped") throw new HttpError(400, `Form is ${a.status}`);
  return tx(ctx.db, () => {
    const spread = spreadFor(ctx, charId);
    const crownsBefore = charRow(ctx, charId).crowns;
    const mastery: MasteryChange[] = [];
    if (a.equipped_slot) {
      const eq = { ...getCharacter(ctx, charId).equipped };
      delete eq[a.equipped_slot];
      run(ctx.db, "UPDATE characters SET equipped = ? WHERE id = ?", JSON.stringify(eq), charId);
    }
    let payout: number;
    let production = { crownsSpent: 0, productionCost: 0 } as ReturnType<typeof payProduction> | { crownsSpent: number; productionCost: number };
    let bonus = 0;
    const ev = trueEvaluation(ctx, a);
    if (mode === "salvage") {
      payout = round(salvageValue(ev.technicalScore) * (1 - spread));
    } else {
      if (tierRank(a.evidence_tier) < 1) throw new HttpError(400, "Veiled Forms can only be salvaged");
      if (!a.bound) production = payProduction(ctx, charId, a);
      const passives = passivesFor(ctx, charId);
      const s = currentSnapshot(ctx);
      const scarcest = [...ESSENCE_IDS].sort((x, y) => s.essenceScarcity[y] - s.essenceScarcity[x]).slice(0, 2);
      if ((passives.contrarianBonus ?? 0) > 0 && ev.technicalScore >= 50 && scarcest.every((e) => essenceQty(ev.recipe, e) === 0)) bonus += passives.contrarianBonus!;
      if ((passives.patronBonus ?? 0) > 0 && a.origin === "bazaar" && a.acquisition_value && ev.estimatedMarketValue >= 1.2 * a.acquisition_value) bonus += passives.patronBonus!;
      payout = round(ev.estimatedMarketValue * (1 - spread) * (1 + bonus));
      // Buyers absorb supply: Smiths' appetite for this recipe's Essences eases slightly.
      for (const e of ESSENCE_IDS) if (essenceQty(ev.recipe, e)) addPressure(ctx, e, -0.004 * essenceQty(ev.recipe, e));
    }
    adjustCrowns(ctx, charId, payout);
    const profit = round(payout - production.productionCost - a.acquisition_cost);
    run(ctx.db, "UPDATE artifacts SET status = 'sold', equipped_slot = NULL WHERE id = ?", a.id);
    logTx(ctx, charId, "artifact", a.id, "sell", 1, payout, { mode, productionCost: production.productionCost, profit, bonus });
    if (mode === "produce" || a.origin === "bazaar") mastery.push(recordMasteryEvent(ctx, charId, "commerce", profit > 0 ? 1 : 0, `sell:${a.id}`));
    const crownsAfter = charRow(ctx, charId).crowns;
    return { payout, productionCost: production.productionCost, crownsSpentOnEssences: production.crownsSpent, profit, bonus, crownsBefore, crowns: crownsAfter, mastery, evaluation: { technicalScore: ev.technicalScore, marketValue: ev.estimatedMarketValue } };
  });
}

// ───────────────────────────── Contracts ─────────────────────────────

export function contractsView(ctx: Ctx, charId: string) {
  const held = all<ArtifactRow>(ctx.db, "SELECT * FROM artifacts WHERE character_id = ? AND status IN ('held','equipped') ORDER BY rowid", charId);
  return activeContracts(ctx).map((c) => {
    const s = currentSnapshot(ctx);
    const exp = get<{ expires_index: number }>(ctx.db, "SELECT expires_index FROM contracts WHERE id = ?", c.id)!.expires_index;
    const eligible = held
      .filter((a) => tierRank(a.evidence_tier) >= 2)
      .filter((a) => {
        const ev = trueEvaluation(ctx, a);
        return meetsContract(c, { qualities: ev.qualities, recipe: ev.recipe, tier: a.evidence_tier, power: ev.power, cost: ev.productionCost, efficiency: ev.efficiencyScore }).ok;
      })
      .map((a) => a.id);
    return { ...c, turningsLeft: exp - s.index + 1, eligibleArtifactIds: eligible };
  });
}

export function fulfillContract(ctx: Ctx, charId: string, contractId: string, artifactId: string) {
  const c = activeContracts(ctx).find((x) => x.id === contractId);
  if (!c) throw new HttpError(400, "contract not open");
  const a = getArtifact(ctx, artifactId, charId);
  if (a.status !== "held" && a.status !== "equipped") throw new HttpError(400, `Form is ${a.status}`);
  const ev = trueEvaluation(ctx, a);
  const check = meetsContract(c, { qualities: ev.qualities, recipe: ev.recipe, tier: a.evidence_tier, power: ev.power, cost: ev.productionCost, efficiency: ev.efficiencyScore });
  if (!check.ok) throw new HttpError(400, `Form does not meet the contract: ${check.failures.join("; ")}`);
  return tx(ctx.db, () => {
    const production = a.bound ? { crownsSpent: 0, productionCost: 0 } : payProduction(ctx, charId, a);
    if (a.equipped_slot) {
      const eq = { ...getCharacter(ctx, charId).equipped };
      delete eq[a.equipped_slot];
      run(ctx.db, "UPDATE characters SET equipped = ? WHERE id = ?", JSON.stringify(eq), charId);
    }
    adjustCrowns(ctx, charId, c.reward);
    run(ctx.db, "UPDATE artifacts SET status = 'delivered', equipped_slot = NULL WHERE id = ?", a.id);
    run(ctx.db, "UPDATE contracts SET status = 'fulfilled', fulfilled_by = ?, fulfilled_artifact_id = ? WHERE id = ?", charId, a.id, c.id);
    logTx(ctx, charId, "artifact", a.id, "sell", 1, c.reward, { contract: c.id, productionCost: production.productionCost });
    const profit = round(c.reward - production.productionCost - a.acquisition_cost);
    const mastery = [recordMasteryEvent(ctx, charId, "commerce", profit > 0 ? 1 : 0, `contract:${c.id}`)];
    return { contract: { ...c, status: "fulfilled" }, reward: c.reward, productionCost: production.productionCost, profit, crowns: charRow(ctx, charId).crowns, mastery };
  });
}

// ───────────────────────────── Prophecy ─────────────────────────────

const PROBS = [0.1, 0.3, 0.5, 0.7, 0.9];

export function makeProphecy(ctx: Ctx, charId: string, essence: EssenceId, probability: number) {
  if (!ESSENCE_IDS.includes(essence)) throw new HttpError(400, "unknown Essence");
  if (!PROBS.includes(probability)) throw new HttpError(400, "probability must be one of 10/30/50/70/90%");
  const s = currentSnapshot(ctx);
  const next = nextSnapshot(ctx, s);
  if (!next) throw new HttpError(400, "the replay has reached its final turning");
  const open = get(ctx.db, "SELECT 1 FROM prophecies WHERE character_id = ? AND essence = ? AND snapshot_id = ? AND status = 'open'", charId, essence, s.id);
  if (open) throw new HttpError(400, "you already hold a Prophecy on this Essence for this turning");
  const id = newId("proph");
  run(
    ctx.db,
    "INSERT INTO prophecies (id, character_id, essence, probability, snapshot_id, target_snapshot_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?)",
    id,
    charId,
    essence,
    probability,
    s.id,
    next.id,
    now(),
  );
  return { id, essence, probability, question: `Will ${ESSENCES[essence].name} grow scarcer by the next turning?` };
}

/** Historical replay: the next observation is already known, so settlement is immediate. */
export function resolveProphecy(ctx: Ctx, charId: string, id: string) {
  const p = get<{ id: string; essence: EssenceId; probability: number; snapshot_id: string; target_snapshot_id: string; status: string }>(
    ctx.db,
    "SELECT * FROM prophecies WHERE id = ? AND character_id = ?",
    id,
    charId,
  );
  if (!p) throw new HttpError(404, "no such Prophecy");
  if (p.status !== "open") throw new HttpError(400, "already resolved");
  const from = ctx.snapshotById.get(p.snapshot_id)!;
  const to = ctx.snapshotById.get(p.target_snapshot_id)!;
  const outcome: 0 | 1 = to.essenceScarcity[p.essence] > from.essenceScarcity[p.essence] ? 1 : 0;
  const { loss, quality } = brierQuality(p.probability, outcome);
  return tx(ctx.db, () => {
    run(ctx.db, "UPDATE prophecies SET status = 'resolved', outcome = ?, loss = ?, quality = ?, resolved_at = ? WHERE id = ?", outcome, loss, quality, now(), id);
    // Prophecy Mastery rewards calibration (Brier quality), not binary luck.
    const mastery = recordMasteryEvent(ctx, charId, "prophecy", quality, `prophecy:${id}`);
    return {
      id,
      essence: p.essence,
      probability: p.probability,
      outcome,
      scarcityBefore: from.essenceScarcity[p.essence],
      scarcityAfter: to.essenceScarcity[p.essence],
      loss,
      quality,
      mastery,
    };
  });
}

export function prophecyView(ctx: Ctx, charId: string) {
  const rows = all<{ id: string; essence: string; probability: number; status: string; outcome: number | null; quality: number | null; loss: number | null; snapshot_id: string }>(
    ctx.db,
    "SELECT id, essence, probability, status, outcome, quality, loss, snapshot_id FROM prophecies WHERE character_id = ? ORDER BY created_at DESC LIMIT 20",
    charId,
  );
  const resolved = rows.filter((r) => r.status === "resolved");
  const meanBrier = resolved.length ? round(resolved.reduce((s, r) => s + (r.loss ?? 0), 0) / resolved.length, 3) : null;
  return { recent: rows, meanBrier, calibration: calibrationTable(ctx, charId) };
}

function calibrationTable(ctx: Ctx, charId: string) {
  const rows = all<{ probability: number; outcome: number }>(ctx.db, "SELECT probability, outcome FROM prophecies WHERE character_id = ? AND status = 'resolved'", charId);
  return PROBS.map((p) => {
    const bucket = rows.filter((r) => r.probability === p);
    return { probability: p, count: bucket.length, hitRate: bucket.length ? round(bucket.reduce((s, r) => s + r.outcome, 0) / bucket.length, 2) : null };
  });
}

export function resolveDueProphecies(ctx: Ctx) {
  const s = currentSnapshot(ctx);
  const due = all<{ id: string; character_id: string }>(
    ctx.db,
    "SELECT p.id, p.character_id FROM prophecies p JOIN world_snapshots w ON w.id = p.target_snapshot_id WHERE p.status = 'open' AND w.idx <= ?",
    s.index,
  );
  return due.map((d) => resolveProphecy(ctx, d.character_id, d.id));
}

// ───────────────────────────── Rumors & currencies ─────────────────────────────

export function useCurrency(ctx: Ctx, charId: string, itemId: string) {
  if (itemQty(ctx, charId, "currency", itemId) < 1) throw new HttpError(400, "you hold none");
  const s = currentSnapshot(ctx);
  return tx(ctx.db, () => {
    if (itemId === "merchants-rumor") {
      const next = nextSnapshot(ctx, s);
      if (!next) throw new HttpError(400, "no future turning to whisper of");
      const e = [...ESSENCE_IDS].sort((a, b) => next.essenceScarcity[b] - s.essenceScarcity[b] - (next.essenceScarcity[a] - s.essenceScarcity[a]))[0]!;
      const rumors = getState<{ essence: EssenceId; text: string; runsLeft: number; snapshotId: string }[]>(ctx, `rumors:${charId}`, []);
      rumors.push({ essence: e, text: `Whispers say ${ESSENCES[e].name} will grow scarcer at the next turning.`, runsLeft: 3, snapshotId: s.id });
      setState(ctx, `rumors:${charId}`, rumors);
      addItem(ctx, charId, "currency", itemId, -1);
      return { used: itemId, rumor: rumors[rumors.length - 1] };
    }
    if (itemId === "royal-writ") {
      const prices = essencePrices(s);
      const e = [...ESSENCE_IDS].sort((a, b) => prices[b] / s.essenceBasePrice[b] - prices[a] / s.essenceBasePrice[a])[1]!;
      const c = {
        id: `${s.id}:writ:${newId("w")}`,
        snapshotId: s.id,
        issuer: "royal" as const,
        title: `Royal Writ: ${ESSENCES[e].name}-light Form`,
        description: `Deliver a Trialed Form with Power ≥ 50 using at most 3 ${ESSENCES[e].name}.`,
        requirement: { minPower: 50, maxEssence: [{ essence: e, qty: 3 }], minTier: "trialed" as const },
        reward: 210,
        reason: "The Crown answers your Writ.",
        targetEssence: e,
        status: "open" as const,
      };
      run(ctx.db, "INSERT INTO contracts (id, snapshot_id, data, status, expires_index) VALUES (?, ?, ?, 'open', ?)", c.id, s.id, JSON.stringify(c), s.index + 2);
      addItem(ctx, charId, "currency", itemId, -1);
      return { used: itemId, contract: c };
    }
    throw new HttpError(400, "this item is spent automatically (Broken Seal on Mirror, Wild Sigil on Temper)");
  });
}

export function rumors(ctx: Ctx, charId: string) {
  return getState<{ essence: EssenceId; text: string; runsLeft: number; snapshotId: string }[]>(ctx, `rumors:${charId}`, []).filter((r) => r.runsLeft > 0);
}

export function tickRumors(ctx: Ctx, charId: string) {
  const rs = getState<{ runsLeft: number }[]>(ctx, `rumors:${charId}`, []);
  setState(ctx, `rumors:${charId}`, rs.map((r) => ({ ...r, runsLeft: r.runsLeft - 1 })).filter((r) => r.runsLeft > 0));
}

// ───────────────────────────── Bazaar & Realm views ─────────────────────────────

export function bazaarView(ctx: Ctx, charId: string) {
  const s = currentSnapshot(ctx);
  const hist = priceHistory(ctx, 10);
  const spread = spreadFor(ctx, charId);
  const passives = passivesFor(ctx, charId);
  const me = masteryEffects(getMastery(ctx, charId));
  const inv = essences(ctx, charId);
  const bandWindow = ctx.world.snapshots.slice(Math.max(0, s.index - 52), s.index + 1).map((snap) => essencePrices(snap));
  const essencesOut = ESSENCE_IDS.map((e) => {
    const prices = hist.map((h) => h.prices[e]);
    const price = prices[prices.length - 1]!;
    const trend = trendText(ESSENCES[e].name, prices);
    const ratio = price / s.essenceBasePrice[e];
    const lo = Math.min(...bandWindow.map((p) => p[e]));
    const hi = Math.max(...bandWindow.map((p) => p[e]));
    // Prophecy Mastery narrows the Bazaar's uncertainty about the next turning.
    const nextUncertainty = round(price * 0.2 * (1 - me.prophecyBandShrink), 2);
    return {
      id: e,
      name: ESSENCES[e].name,
      color: ESSENCES[e].color,
      glyph: ESSENCES[e].glyph,
      price,
      buyPrice: round(price * (1 + spread), 2),
      sellPrice: round(price * (1 - spread), 2),
      held: inv[e],
      history: prices,
      trend: trend.text,
      change5: trend.change,
      status: ratio > 1.8 ? "dear" : ratio > 1.25 ? "rising" : ratio < 0.7 ? "cheap" : "steady",
      priceRatio: round(ratio, 2),
      band: passives.priceBand ? { low: round(lo, 2), high: round(hi, 2) } : null,
      nextUncertainty,
    };
  });
  const dearest = [...essencesOut].sort((a, b) => b.priceRatio - a.priceRatio)[0]!;
  return {
    snapshot: { id: s.id, date: s.date, index: s.index, total: ctx.world.snapshots.length },
    headline: `${dearest.name} is ${dearest.status === "dear" ? "dear" : "the costliest Essence"} this turning (×${dearest.priceRatio}).`,
    spread,
    essences: essencesOut,
    offers: offersView(ctx, charId),
    contracts: contractsView(ctx, charId),
    prophecies: prophecyView(ctx, charId),
    rumors: rumors(ctx, charId),
    worldEvents: s.realmModifiers.map((m) => m.note),
  };
}

/** Realm Gate: difficulty, expected Essences, demand signals and relevant contracts. */
export function realmGateView(ctx: Ctx) {
  const s = currentSnapshot(ctx);
  const prices = currentPrices(ctx);
  const contracts = activeContracts(ctx);
  return REALMS.map((r) => {
    const totalW = Object.values(r.essenceDrops).reduce((a, b) => a + b!, 0);
    const expected = (Object.entries(r.essenceDrops) as [EssenceId, number][])
      .map(([e, w]) => {
        const glut = s.realmModifiers.some((m) => m.realmId === r.id && m.essence === e && m.factor < 1);
        return { essence: e, name: ESSENCES[e].name, share: round((w * (glut ? 1.6 : 1)) / totalW, 2), price: prices[e], glut };
      })
      .sort((a, b) => b.share - a.share);
    const expectedUnits = 5 * 4.5 + 8 + 12;
    const haulValue = round(expected.reduce((sum, x) => sum + x.share * expectedUnits * x.price, 0));
    // Which contract demand this Realm's typical Forms can serve.
    const ranked = ctx.reality
      .all()
      .map((c) => ({ c, s: technicalScore(c.qualities, r.objective) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, Math.floor(ctx.reality.all().length / 3));
    const demand = contracts
      .filter((c) => c.targetEssence && c.requirement.maxEssence?.some((x) => x.qty === 0))
      .map((c) => {
        const e = c.targetEssence!;
        const fit = ranked.filter((x) => essenceQty(x.c.recipe, e) === 0).length / Math.max(1, ranked.length);
        return {
          contractId: c.id,
          label: `${ESSENCES[e].name}-free Forms`,
          arrows: fit > 0.5 ? "↑↑" : fit > 0.25 ? "↑" : "·",
          fit: round(fit, 2),
          reward: c.reward,
          text: c.description,
        };
      });
    return {
      id: r.id,
      name: r.name,
      tagline: r.tagline,
      difficulty: r.difficulty,
      difficultyLabel: ["I", "II", "III"][r.difficulty - 1],
      bias: r.bias,
      expectedEssences: expected,
      haulValue,
      demand,
      essenceFreeDemand: Object.fromEntries(ESSENCE_IDS.map((e) => [e, essenceFreeDemand(contracts, e)])),
      events: s.realmModifiers.filter((m) => m.realmId === r.id).map((m) => m.note),
    };
  });
}

export function sellPreview(ctx: Ctx, charId: string, artifactId: string) {
  const a = getArtifact(ctx, artifactId, charId);
  const quote = productionQuote(ctx, charId, a);
  return { quote, salvage: round(salvageValue(trueEvaluation(ctx, a).technicalScore) * (1 - spreadFor(ctx, charId))) };
}
