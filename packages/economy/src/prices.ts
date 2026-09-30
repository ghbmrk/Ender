import { ESSENCE_IDS, clamp, noise, round, type EssenceId, type RealmModifier, type WorldSnapshot } from "@ender/shared";
import { ESSENCES, REALMS } from "@ender/content";

/** Exogenous factor from external scarcity: 50 → ×1, each +35 doubles. */
export const externalScarcityFactor = (scarcity: number) => round(2 ** ((scarcity - 50) / 35), 4);

export type LocalDemandState = Record<EssenceId, number>; // player pressure, around 0

/**
 * Rule-based NPC actors that shape local supply/demand:
 * - Smiths hoard crafting Essences (Glass, Ember) and anything growing scarce.
 * - Merchants arbitrage player pressure back toward zero each tick.
 * - Salvagers and Scholars act on Forms (see valuation), not Essence prices.
 */
export function npcEssenceDemand(snapshot: Pick<WorldSnapshot, "essenceScarcity">, e: EssenceId): number {
  const smithBase = e === "glass" || e === "ember" ? 0.05 : 0;
  const hoarding = 0.1 * clamp((snapshot.essenceScarcity[e] - 60) / 40, 0, 1);
  return round(smithBase + hoarding, 4);
}

export const localDemandFactor = (snapshot: Pick<WorldSnapshot, "essenceScarcity">, e: EssenceId, pressure: number) =>
  round(clamp(1 + npcEssenceDemand(snapshot, e) + pressure, 0.75, 1.4), 4);

/** Merchants halve player-driven pressure every world tick. */
export const merchantDecay = (pressure: LocalDemandState): LocalDemandState =>
  Object.fromEntries(ESSENCE_IDS.map((e) => [e, round(pressure[e] * 0.5, 4)])) as LocalDemandState;

export const PRESSURE_PER_UNIT = 0.012;

/** Deterministic world modifiers for a snapshot: small caravans and blights. */
export function worldModifiers(snapshotId: string): RealmModifier[] {
  const out: RealmModifier[] = [];
  for (const e of ESSENCE_IDS) {
    const n = noise(`${snapshotId}:world:${e}`);
    if (Math.abs(n) > 0.75) {
      const factor = n > 0 ? 1.1 : 0.9;
      const realm = REALMS[Math.floor(((n + 1) / 2) * REALMS.length) % REALMS.length]!;
      out.push({
        realmId: realm.id,
        essence: e,
        factor,
        note: factor > 1 ? `A blight on ${ESSENCES[e].name} caravans` : `A glut of ${ESSENCES[e].name} from ${realm.name}`,
      });
    }
  }
  return out;
}

export const worldModifierFactor = (snapshot: Pick<WorldSnapshot, "realmModifiers">, e: EssenceId) =>
  snapshot.realmModifiers.filter((m) => m.essence === e).reduce((f, m) => f * m.factor, 1);

export type PriceBreakdown = {
  base: number;
  external: number;
  local: number;
  world: number;
  price: number;
};

/** Bazaar price = base × external scarcity × local supply-demand × world modifier. */
export function essencePrice(snapshot: WorldSnapshot, e: EssenceId, pressure = 0): PriceBreakdown {
  const base = snapshot.essenceBasePrice[e];
  const external = externalScarcityFactor(snapshot.essenceScarcity[e]);
  const local = localDemandFactor(snapshot, e, pressure);
  const world = worldModifierFactor(snapshot, e);
  return { base, external, local, world, price: round(base * external * local * world, 2) };
}

export function essencePrices(snapshot: WorldSnapshot, pressure?: Partial<LocalDemandState>): Record<EssenceId, number> {
  return Object.fromEntries(ESSENCE_IDS.map((e) => [e, essencePrice(snapshot, e, pressure?.[e] ?? 0).price])) as Record<EssenceId, number>;
}

export const basePrices = (): Record<EssenceId, number> =>
  Object.fromEntries(ESSENCE_IDS.map((e) => [e, ESSENCES[e].basePrice])) as Record<EssenceId, number>;
