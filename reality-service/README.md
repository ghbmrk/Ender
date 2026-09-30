# @ender/reality-service

This is the local HTTP service for the native Unreal client (`game/`). The client talks only to this service. It never queries PubChem, OpenAlex or the ECB market series itself. Everything is served from cached seeds and deterministic rules.

This package contains no game logic of its own. It is the existing Ender server (`apps/server`, `buildApp()`), with the Unreal endpoint contract registered on the same Fastify instance. All `/api/*` routes (runs, checkpoints, inventory, equipment, passives, Bazaar trades, contracts, dev/provenance, and so on) remain available on the same port. Domain rules come from `@ender/domain`, `@ender/economy`, `@ender/reality` and `@ender/inference`.

## Run

```sh
pnpm --filter @ender/reality-service start     # or: pnpm service
pnpm --filter @ender/reality-service dev       # watch mode; or: pnpm service:dev
```

| Setting | Default | Env |
| --- | --- | --- |
| Port | **8788**. The web build's server (`apps/server`, `pnpm dev`) already uses 8787, so both can run side by side. | `PORT` (or `ENDER_SERVICE_PORT`) |
| Host | `127.0.0.1` | `HOST` |
| Save (SQLite, `node:sqlite`) | `.local/reality-service.sqlite`, kept separate from the web server's `.local/ender.sqlite` | `ENDER_DB` |
| Seed/data root | repo-root `data/` | `ENDER_DATA_DIR` |
| Replay start date | `2023-08-04` | `ENDER_START_DATE` |
| Strict fixtures (throw instead of rule fallback) | off | `ENDER_STRICT_FIXTURES=1` |
| Record missing inference requests | on | `ENDER_RECORD_REQUESTS=0` to disable |

## Data layout

The service reads the same seeds as the web build, from repo-root `data/`. Nothing is copied or moved. The spec's `reality-service/…` layout maps onto the existing folders like this:

| Spec path | Actual path (shared with the web build) |
| --- | --- |
| `reality-service/data/pubchem/` | `data/seed/pubchem/` (`compounds.json`, `candidate-graph.json`) |
| `reality-service/data/markets/` | `data/seed/markets/` (`ecb-exr.json`) |
| `reality-service/data/openalex/` | `data/seed/openalex/` (`lore.json` when synced) |
| `reality-service/inference-fixtures/` | `data/inference-fixtures/<attune\|transform\|critique>/<hash>.json` |
| `reality-service/inference-requests/` | `data/inference-requests/<type>/<hash>.json` (missing fixtures are recorded here) |
| `reality-service/prompts/` | `prompts/` |

Seeds are refreshed with the existing root scripts (`pnpm data:sync`, `pnpm data:build`). Fixtures are managed with `pnpm fixtures:list | fixtures:validate | fixtures:collect`.

## Zero paid inference

`attune`, `transform` and `critique` go through `FixtureInferenceProvider`. It looks up a fixture by the SHA-256 of the canonical request. If no fixture exists, it falls back to `RuleInferenceProvider`. `ChatGPTPlanInferenceProvider` is a stub that throws. It is never selected, and the envelope refuses any provider other than `fixture` or `rule`. `tests/no-paid-inference` scans this package's source and `package.json`, and checks that its inference endpoints make no network calls.

## Endpoints

Request bodies and query strings are validated with Zod. Invalid input returns `400 { error, issues }`. An unknown Form or Realm returns `404`.

Form ids are fantasy ids (`form-…`). `/candidate/:id` also accepts the underlying reality id.

### `GET /world`
Returns the current replay turning:
- `date`, `snapshotId`, `index`, `total` and the `replay` range
- `scarcity` per Essence (Ember, Tide, Storm, Root, Glass, Ash; 0–100)
- in-game `prices`
- per-Essence `priceFactors`
- world `modifiers` (caravan blights and gluts)

Price = `basePrice × externalScarcityFactor × localSupplyDemandFactor × worldModifier`.

### `GET /realm/:id`
- `card` is the Realm card, written in fantasy terms only (no financial vocabulary):
  - difficulty
  - expected Essence families, each with a scarcity word
  - `scarcity` indicators (`very abundant | abundant | steady | scarce | very scarce`)
  - `contracts` with a relevance label such as `Royal Demand: Storm-free Forms +71% bounty`. The percentage is the reward relative to the median sale value of the Realm's typical eligible Forms.
  - `formBias`, `haulCrowns` and `events`
- `preload` is everything to load before entering, so that combat never waits on the network:
  - Realm palette, objective, drops and enemy weights
  - enemy stats and the boss
  - arena size and room sequence
  - Essence, quality and currency display data
  - character stats and Focus
  - Focus and Work Unit costs
  - `runStart`: `POST /api/runs {realmId}` returns the full deterministic RunPlan (rooms, waves, obstacles, loot). After that, the only calls during a run are `/api/runs/:id/checkpoint` (at the shrine) and `/api/runs/:id/complete`.

### `GET /realm/:id/pool`
This is the Form drop pool to prefetch before entering a Realm. With it, drops can be chosen locally during combat, without network calls.

The pool is exactly what the server's own run generator draws from (`realmPool` in `apps/server/src/services/runs.ts`). That is the whole candidate corpus, ranked by technical score for the Realm's objective. It is listed in the same ascending order.

Each candidate has:
- its fantasy `id`
- the six `qualities` (burden, veil, reach, knots, flex, bond; 0–100)
- `technicalPercentile` (0–100 within this pool)

Nothing scientific is included.

The response also has:
- `nextRunSeed`: the seed that the next `POST /api/runs` will issue (`<characterId>:<n>`). The returned `plan.seed` confirms it.
- `selection`: the server's draw rule. The drop index is `floor(clamp(max(u₁..u_draws)^0.85 + bonus/100, 0, 0.995) × size)`. It lists the draws per room kind, plus the character's loot and elite percentile bonuses.

#### Reporting drops: `forms` on `/api/runs/:id/checkpoint` and `/api/runs/:id/complete`
The client sends the Forms that actually dropped as `forms: [{ room, candidateId }]`, where `candidateId` is a fantasy id or a reality id.

When `forms` is present:
- The server creates exactly those Forms for the rooms granted by that call, instead of the plan's picks.
- A Form for a room that was already banked is ignored.
- The whole call is rejected with `400`, granting nothing, if any `candidateId` is not in the Realm's pool, or if its `room` is not in `roomsCleared`.

When `forms` is absent, the server picks Forms itself. This is unchanged, and the web build does not send `forms`.

### `GET /candidate/:id[?realm=<realmId>&tier=<tier>&provenance=1]`
Returns a PubChem-backed Form:
- qualities Burden, Veil, Reach, Knots, Flex and Bond (0–100, p05→0 and p95→100 over the corpus)
- `recipe`, using the drivers Burden→Ash, Knots→Glass, Veil→Tide, Reach→Root, Flex→Storm, Bond→Ember
- `productionCost` = Σ qty × current Essence price
- lore tier

With `realm`, the response adds `evaluation`: `technicalScore`, `estimatedMarketValue`, `efficiencyScore`, `marginPotential`, `evidenceTier` (default `trialed`) and `power`.

Scientific fields (CID, formula, MW, XLogP, TPSA, complexity, H-bond counts, rotatable bonds, normalisation bands) appear only with `?provenance=1`.

### `GET /candidate/:id/neighbors[?limit=12&depth=1|2&realm=&provenance=1]`
Returns nearest neighbours in the candidate graph: fantasy ids, qualities, distance and production cost. With `realm`, each neighbour also gets a `technicalScore`.

### `POST /evaluate`
Runs a deterministic evaluation. `mode` is `trial` (default), `mirror` or `deep-trial`.
- `{ candidateId, realmId, mode }` is stateless. Mirror checks four perturbed objectives, and the Form becomes `witnessed` when consistent. Deep Trial also compares the Form's neighbours.
- `{ artifactId, mode }` runs the real crafting action on a held Form. It spends Focus, logs Work Units, awards XP and changes tier.

Both return `cost: { focus, workUnits }`.

### `POST /attune`, `POST /transform`, `POST /critique`
These are inference calls. Every response uses this envelope:

```json
{ "result": { … }, "usage": { "workUnits": 1 }, "provenance": { "provider": "fixture" | "rule", "requestHash": "<sha256>" } }
```

- Stateless, on a catalogue Form: `{ candidateId, realmId, preset? }`. The policy comes from `preset` (explorer/smith/inquisitor/merchant) or the active character's effective policy. `/transform` also takes `count` (1–4). `/critique` takes `mode`: `fracture | mirror | deep`.
- Stateful, on a held Form: `{ artifactId }`. This runs the real Attune, Temper-options or Fracture/Mirror/Deep Trial action. State changes (artifact, mastery, Focus spent, XP) come back under `game`. To pick a Temper option, call `POST /api/artifacts/:id/temper {choice}`.

Work Units: Attune 1, Fracture 1, Temper 3, Mirror 3, Deep Trial 5. XP = `round(20 × WU^0.72)`, awarded once per character × artifact revision × action.

### `GET /bazaar`, `GET /contracts`
These are the active character's Bazaar view and the open contracts, each with a `label`. Trades use `/api/bazaar/buy|sell`, and fulfilment uses `/api/contracts/:id/fulfill`.

### `POST /prophecy`, `POST /prophecy/resolve`
- `POST /prophecy` takes `{ essence, probability ∈ {0.1, 0.3, 0.5, 0.7, 0.9} }`. It forecasts whether the Essence's scarcity will rise at the next replay step.
- `POST /prophecy/resolve` takes `{ id }`. It settles against the known next turning, with `loss = (p − outcome)²` and `quality = 1 − loss`. The quality feeds Prophecy Mastery.

### `GET /health`
Returns `{ ok, service: "reality", provider }`.

## Tests

- `reality-service/test/reality-service.test.ts` checks every endpoint above through Fastify `inject`, including the Realm pool and client-reported `forms` on checkpoint/complete. It validates the response shapes and the inference envelope, and checks that `/candidate/:id` hides scientific terms unless `?provenance=1` is set.
- `reality-service/test/builds.test.ts` is the §97 build test. Explorer, Smith, Inquisitor and Merchant face identical candidate contexts and must diverge pairwise, both in their top pick and in their ordering.
- `packages/economy/test/storm-scenario.test.ts` is the §96 economic test. It uses Storm LOW and Storm HIGH snapshots with Form A (technical 85, heavy Storm) and Form B (technical 78, no Storm). The Storm-free contract appears only in snapshot B.
- `tests/no-paid-inference` includes this package.
