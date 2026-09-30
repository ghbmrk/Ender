# Ender

A top-down dark-fantasy ARPG whose crafting, economy and progression are coupled to real external data. Forms you find are real PubChem compounds wearing fantasy qualities. Essence prices move with real ECB exchange-rate history. The Familiar that reads your Forms costs you Focus and teaches you (XP), but only objectively good decisions earn Mastery.

This repository holds two clients over one set of rules and data:

- **`game/`** is the native Unreal Engine 5.8 vertical slice (C++, GAS, Enhanced Input, StateTree, Niagara, UMG), which is the target build. It talks only to the local **`reality-service/`** (port 8788). The C++ has not been compiled yet, so treat it as unbuilt until the first Windows build. `docs/UNREAL_BUILD.md` covers building it, `docs/IMPLEMENTATION_STATUS.md` shows what exists for each of the 50 implementation steps, and `docs/COMBAT_SPEC.md`, `ART_SPEC.md`, `ECONOMY_SPEC.md`, `REALITY_SPEC.md` and `THIRD_PARTY.md` hold the specs.
- **`apps/game`** is the earlier TypeScript/Phaser prototype and no-install web build. It stays playable in a browser while the Unreal client is brought up.

The loop is the same in both: fight, loot, Attune, Temper, Trial, sell or equip, watch the world turn, and adapt.

## Play it

```bash
pnpm install
pnpm dev          # server on :8787, game on http://127.0.0.1:5173
```

You don't need an AI account, API key, database setup or paid service. `pnpm dev` works offline: every seed is committed, SQLite is Node's built-in `node:sqlite`, and inference comes from committed fixtures with a deterministic rule fallback.

Requirements: Node 22.13 or newer (for `node:sqlite`) and pnpm 10.

### No-install web build

```bash
pnpm build:web    # → apps/game/dist-web/ender.html (one self-contained file)
pnpm dev:web      # the same in-page mode with hot reload
```

The web build runs the whole server inside the page. It uses the same services and routes as `apps/server`, with sql.js instead of `node:sqlite` and the seeds and fixtures bundled in. Open `ender.html` from disk or host it anywhere; progress is saved to the browser's IndexedDB.

### Controls

WASD move · mouse aim · LMB Thread Bolt · RMB Sever · Space Slip · Q Unravel · E interact · Tab inventory.

### A 20-minute loop

1. In the **Crossing**, walk to the **Bazaar** (E). One Essence is dear this turning: on the default start date (2023-08-04) Storm costs about ×2 its usual price, and a Royal Contract wants a Storm-free Form.
2. At the **Realm Gate**, each Realm shows its haul value and the demand signals it answers. Pick one because of the market.
3. Fight through 5 chambers, a shrine (Attune a Veiled Form there), an elite, and **the Bound King** (3 phases; break his Epistemic Ward by bringing well-evidenced Forms).
4. In the **Crucible**: Attune, Temper (choose among neighbouring Forms), Trial (exact truth), Fracture (name a weakness), and Mirror (robustness). The compare table sets power against production cost and efficiency.
5. Bind the best Form as gear and get stronger. Sell another for Crowns, or deliver it to a contract.
6. Spend passive points. Different builds make the Familiar search differently.
7. Let the world turn (finish a run, or "Wait for the next turning"). Prices move, contracts change, and the best strategy changes with them.
8. Make a **Prophecy** about scarcity; it is scored by Brier loss and trains Prophecy Mastery.
9. Toggle **Developer Provenance** on the title screen to see the real data behind any Form.

## Zero paid inference

The MVP uses no paid LLM API: no OpenAI, Anthropic, Gemini or hosted inference, and no user-supplied AI keys.

- Everything goes through `InferenceProvider` (`packages/inference`). At runtime it is always `FixtureInferenceProvider`: request → canonical JSON → SHA-256 → `data/inference-fixtures/<type>/<hash>.json`, with `RuleInferenceProvider` as the fallback.
- `ChatGPTPlanInferenceProvider` is a stub that throws. It is never selected.
- `pnpm test:no-paid-inference` fails on any commercial AI SDK in manifests or the lockfile, any AI key env var or LLM endpoint in source, or any network call during a full crafting session.

### Fixtures

The fixtures are hand-authored by the coding agent from recorded requests. They never invent candidate IDs or numbers, and the validator enforces both.

```bash
pnpm fixtures:collect --clean   # replay a deterministic session, record every request
pnpm fixtures:list              # which requests lack a fixture
pnpm fixtures:validate          # hash, schema, no invented IDs, no invented numbers
```

There are 16 Attune, 6 Transform and 16 Critique fixtures. Prompts for authors (and a future provider) are in `prompts/`. Set `ENDER_STRICT_FIXTURES=1` to make a missing fixture an error instead of a rule fallback.

## Real data

| Game concept | Source | Seed |
|---|---|---|
| Forms (240 compounds) | PubChem | `data/seed/pubchem/compounds.json`, `candidate-graph.json` |
| Essence scarcity (weekly, 2022-01-07 onward after 52 warm-up weeks) | ECB euro reference rates: Ember USD, Tide JPY, Storm ZAR, Root CHF, Glass GBP, Ash NOK | `data/seed/markets/ecb-exr.json` |
| Lore tier (evidence) | OpenAlex works counts | `data/seed/openalex/lore.json` (not yet synced) |

Refresh with `pnpm data:sync` (or `data:sync:pubchem`, `:markets`, `:openalex`), then `pnpm data:build`. Syncs run outside gameplay; the game never fetches during a Realm.

**Provenance caveat for the committed seeds.** They were built in a sandbox where `pubchem.ncbi.nlm.nih.gov`, `data-api.ecb.europa.eu`, `www.ecb.europa.eu` and `api.openalex.org` were blocked, so each came from a mirror of the same source:

- **PubChem:** CID, formula, molecular weight and SMILES come verbatim from the PubChem extract shipped in the `chemicals` PyPI package (v1.5.2). logP, TPSA, complexity, H-bond counts and rotatable bonds were computed by RDKit from those SMILES, not by PubChem. Every record says which in `descriptorSource` (`scripts/bootstrap/pubchem_mirror_seed.py`). Running `pnpm data:sync:pubchem` with network access replaces them with PubChem's own computed properties.
- **ECB:** the ECB's own `eurofxref-hist` file, as bundled in the `currencyconverter` PyPI package (0.18.22), loaded with `pnpm data:sync:markets --from-file`.
- **OpenAlex:** not synced, so every Form shows "Lore unread".

Syncing OpenAlex or PubChem changes inference requests, so rerun `pnpm fixtures:collect` and author fixtures for the new requests. Until then the rule provider covers them.

## Tests

```bash
pnpm test                    # unit + integration + no-paid-inference (Vitest)
pnpm test:e2e                # Playwright E2E 1–7 and the §70 economic loop
pnpm typecheck
```

- **Unit** (`packages/*/test`): normalization, objective scoring, recipes, production cost, market value, efficiency, scarcity, local demand, contracts, artifact power, XP, levels, Mastery, Work Units, Brier scoring, SearchPolicy, candidate ranking, fixture hashing and validation. The required §69 Storm scenario is in `packages/economy/test/storm-scenario.test.ts`.
- **Integration** (`tests/integration`): each arrow of the loop through the HTTP API, from combat → loot to Prophecy → Mastery.
- **Rule core** (`tests/cpp/run.sh`, no Unreal needed): combat timings, the Evade curve, Unravel radius, the damage model, the input buffer, attack tokens, telegraph floors, the Bound King and loot bias. It also runs the §94 simulation of 100 seeded rooms: token caps, spawn legality, off-screen fairness and enemy caps.
- **E2E** (`tests/e2e`): new Binder kills the Bound King; equip changes stats; a Forge passive reaches the Temper request; Explorer and Smith choose differently from identical candidates; the Merchant avoids costly Forms; a turning moves prices and contracts; everything works with external hosts blocked; the full §70 loop.

E2E starts its own server on :8797 and game on :5183 with a fresh database. Combat tests use the autopilot (`?autoplay=1&god=1&speed=2&dmg=6`), which drives the same input interface as the keyboard.

## Layout

```
game             Unreal project: Source/Ender (C++), Config, Content (data + READMEs), Tools (asset generator, shaders, paper texture)
game/Source/Ender/Rules  engine-free combat/encounter/loot rules, also built by tests/cpp
reality-service  local HTTP service for the Unreal client (wraps apps/server; spec endpoints + /api/*)
docs             combat, art, economy, reality, third-party, build and status docs
apps/game        Vite + React + Phaser client (combat, hub, UI); src/standalone = in-page server
apps/server      Fastify + node:sqlite; services hold all rules; browser.ts = same routes in-page
packages/shared  types, rng, canonical JSON, SHA-256
packages/content Essences, Realms, enemies, boss, passives, names
packages/domain  qualities, objectives, power, XP/levels, Mastery, SearchPolicy, readings
packages/economy scarcity, prices, recipes, valuation, contracts, snapshots
packages/reality RealityDomainAdapter + PubChemRealityAdapter
packages/inference providers, schemas, hashing, fixture store and validation
prompts          attune / transform / critique authoring prompts
data             committed seeds, fixtures, recorded requests
scripts          data sync, candidate graph, fixture tools, web bundler
tests            integration, e2e, no-paid-inference
```

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `ENDER_DB` | `.local/ender.sqlite` | SQLite file (created automatically) |
| `ENDER_START_DATE` | `2023-08-04` | Replay date a new world starts on |
| `ENDER_STRICT_FIXTURES` | off | `1`: missing fixture is an error |
| `ENDER_RECORD_REQUESTS` | on | `0`: don't write missing requests to `data/inference-requests` |
| `ENDER_DEV_ROUTES` | on | `0`: disable `/api/dev/*` (provenance, grants) |
| `PORT` / `GAME_PORT` | 8787 / 5173 | server / client ports |
