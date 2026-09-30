# Economy spec

The economy runs in the reality service (`reality-service/`, which reuses `packages/economy`, `packages/domain` and `apps/server`). The Unreal client displays it and sends player actions. Everything is deterministic: a world replay date plus the player's own actions give the same prices, contracts and valuations every time.

## Essences and the hidden market mapping (§9)

Six Essences map to six ECB euro reference-rate series (`packages/content/src/essences.ts`, `ESSENCE_MARKET_SERIES`):

| Essence | Series |
|---|---|
| Ember | USD |
| Tide | JPY |
| Storm | ZAR |
| Root | CHF |
| Glass | GBP |
| Ash | NOK |

The mapping is shown only in the developer provenance view. Players never see real prices or currency names.

**Scarcity** (`packages/economy/src/scarcity.ts`) is computed on weekly Friday closes:

```
scarcity = clamp(50 + 15·(|r|/σ52 − 0.8) + 10·zVol + 45·(pct52 − 0.5), 0, 100)
```

- `r` is the latest weekly log return.
- `σ52` is the trailing 52-week standard deviation of returns.
- `zVol = (σ8/σ52 − 1)/0.35`.
- `pct52` is the latest value's percentile in its 52-week window.

The spec's formula (§9) is labelled an example. This one keeps its two terms (standardized absolute return and standardized volatility) and adds a level term, so a currency that stays weak for weeks stays scarce instead of snapping back to 50 after one quiet week.

## Price (§10)

```
price = basePrice × externalScarcityFactor × localSupplyDemandFactor × worldModifier
```

(`packages/economy/src/prices.ts`)

| Term | Definition |
|---|---|
| `externalScarcityFactor` | `2^((scarcity − 50)/35)`: 50 gives ×1, and every +35 doubles the price |
| `localSupplyDemandFactor` | `clamp(1 + npcDemand + playerPressure, 0.75, 1.4)`. Each unit the player buys adds 0.012 pressure and each unit sold removes it. Merchants halve pressure every world step. Smiths add demand for Glass and Ember and hoard any Essence above 60 scarcity. |
| `worldModifier` | Deterministic caravan blights and gluts per snapshot (×1.1 / ×0.9) |

Real prices are never shown. The Bazaar shows Crowns and scarcity words (scarce / steady / abundant). Merchant's Eye adds a recent price band.

## Recipes and production cost (§11)

`packages/economy/src/recipe.ts`:

- Each fantasy quality at 35 or above demands its Essence: `qty = round((q − 25)/6)`.
- The quality → Essence mapping is Burden → Ash, Knots → Glass, Veil → Tide, Reach → Root, Flex → Storm, Bond → Ember.
- A Form with no high quality still needs 1 Ash.
- `productionCost = Σ qty × current Essence price`.

This is a game abstraction, not manufacturing data.

## Evaluation (§12)

Every evaluated Form carries `technicalScore`, `productionCost`, `estimatedMarketValue`, `efficiencyScore`, `marginPotential` and `evidenceTier`.

| Quantity | Definition |
|---|---|
| `technicalScore` | The Realm objective's weighted constraint satisfaction over the six qualities (`packages/domain/src/objective.ts`) |
| `estimatedMarketValue` | `3·technical + Smith demand + open-contract demand + scarcity avoidance + evidence premium` (`packages/economy/src/valuation.ts`) |
| `efficiencyScore` | `100·ratio/(ratio+1)`, where `ratio = (technical/100)/(cost/referenceCost)` |
| `marginPotential` | value − cost |
| `artifactPower` | `technicalScore × evidence multiplier`, clamped to 0–110. Multipliers: Veiled .70, Attuned .85, Trialed 1.00, Witnessed 1.10. |

The cost/performance tension is required, and a test enforces it (next section).

## Required economic test (§96)

`packages/economy/test/storm-scenario.test.ts` sets up:

- Snapshot A (Storm scarcity low) and snapshot B (Storm scarcity high).
- Form A: technical 85 with a high Storm cost.
- Form B: technical 78 with no Storm.

It asserts that A is competitive or better under snapshot A, that B is better or strongly competitive under snapshot B, and that snapshot B generates a Storm-free contract.

## Contracts (§13)

`packages/economy/src/contracts.ts` follows the spec's chain:

1. Detect the most expensive Essence relative to its base price.
2. Measure how much of the known recipe corpus leans on it (cost share above 25%).
3. Issue a substitution contract ("Deliver a Trialed Form with Power ≥ N that needs no Storm"). N is calibrated to the 60th percentile of eligible candidates.
4. Set the reward to `clamp(150 + 200·(ratio − 1) + 100·dependentShare, 150, 450)`.

A second Noble contract appears when another Essence is above ×1.35. Rotating commissions cover the other spec examples, each calibrated on the corpus:

- Knots ≥ 70 under a production-cost cap
- efficiency ≥ N
- a light, potent Form
- a Witnessed Form with at most 2 of one Essence

## Bazaar actors (§71)

Smith, Scholar, Merchant, Salvager and Noble House are rule-based, in `prices.ts` and `valuation.ts`. None of them calls inference.

## Prophecy (§72)

The player forecasts whether an Essence's scarcity rises at the next replay step, choosing 10/30/50/70/90%. Resolution uses the next historical snapshot:

```
loss = (p − outcome)²
quality = 1 − loss
```

This feeds Prophecy Mastery.

## Realm gate (§73)

Each Realm card shows difficulty, expected Essence families, scarcity words, contract relevance (for example "Royal Demand: Storm-free Forms +38% bounty") and Form bias. The copy uses no financial terms. The reality service serves it from `GET /realm/:id`.

## Tuning status

The formulas and the §96 test pass in CI. How the economy feels over a 20-minute session was tuned only in the web build. Step 50 (economy tuning) has not been done against the Unreal client.
