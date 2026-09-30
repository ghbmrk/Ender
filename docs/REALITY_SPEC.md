# Reality spec: real data, fixtures, and zero paid inference

## Boundary (§6)

The Unreal client never queries PubChem, OpenAlex or market sources. It talks only to the local reality service (`reality-service/`, default `http://127.0.0.1:8788`). Everything a Realm needs is fetched before the Realm loads:

- the candidate pool with each Form's six qualities
- prices and contracts
- the run seed

`UEnderRealityClient` refuses requests while a Realm is active. The only exception is run checkpoints, which are queued and sent at room clear and at the Reward Altar. Combat never waits on the network.

**Endpoints:** `GET /world`, `GET /realm/:id`, `GET /candidate/:id`, `GET /candidate/:id/neighbors`, `GET /realm/:id/pool`, `POST /evaluate`, `POST /attune`, `POST /transform`, `POST /critique`, `GET /bazaar`, `GET /contracts`, `POST /prophecy`, `POST /prophecy/resolve`. All earlier `/api/*` routes remain available. The client prefetches a Realm's whole Form pool from `/realm/:id/pool` (fantasy ids, six qualities, technical percentile, the next run seed) and reports what actually dropped as `forms: [{ room, candidateId }]` on `POST /api/runs/:id/checkpoint` and `/complete`, so banked Artifacts match the drops; the server rejects Forms outside the Realm's pool with 400. Shapes are documented in `reality-service/README.md`.

## Forms (§7–8)

There are 240 real PubChem compounds (`data/seed/pubchem/`). Each stores:

- CID, molecular formula, molecular weight
- XLogP, TPSA, complexity
- H-bond donors and acceptors
- rotatable bond count

These become fantasy qualities (`packages/domain/src/qualities.ts`):

| Quality | Source value |
|---|---|
| Burden | molecular weight |
| Veil | XLogP |
| Reach | TPSA |
| Knots | complexity |
| Flex | rotatable bonds |
| Bond | 2·donors + acceptors |

Each is normalized to corpus percentiles (p05 = 0, p95 = 100, clamped outside that range). Scientific terms appear only in developer provenance: `GET /candidate/:id?provenance=1` and the in-game provenance toggle.

This is a real-data ranking and search prototype. It makes no claim of novel molecular discovery.

**Seed provenance caveat** (also in the root README): the sandbox that built the seeds could not reach PubChem, so the base records came from the PubChem extract in the `chemicals` package. Descriptors were computed with RDKit from SMILES, and each record says so in `descriptorSource`. Running `pnpm data:sync:pubchem` with network access replaces them with PubChem's own computed properties.

## Monster → Form bias (§56)

| Enemy | Biased quality |
|---|---|
| Husk | Burden |
| Hound | Flex |
| Wisp | Reach |
| Keeper | Knots |
| Seer | Veil / Bond |

The kills that produce a drop weight candidate selection toward high values of those qualities (`game/Source/Ender/Rules/LootRules.h`, `FFormBias` and `ChooseCandidate`). This lets players farm parts of the search space on purpose. The standalone rule tests check that farming Hounds yields markedly higher-Flex Forms than farming Husks.

## Inference (§5, §57–60)

**Provider chain:** `FixtureInferenceProvider`, falling back to `RuleInferenceProvider`. `ChatGPTPlanInferenceProvider` exists as a stub that throws `NotImplemented` and is never selected.

- The fixture provider canonicalizes the request, hashes it with SHA-256 and looks for `data/inference-fixtures/<type>/<hash>.json`.
- On a miss it records `data/inference-requests/<type>/<hash>.json`, then either throws `FixtureRequired` (strict mode, `ENDER_STRICT_FIXTURES=1`) or uses the rule provider.
- Every response uses the same envelope: `{ result, usage: { workUnits }, provenance: { provider, requestHash } }`.

**What inference may and may not do.** It may interpret, rank, critique and recommend. It may not change source values, award XP or Mastery, declare evaluation success, grant loot or move prices. XP comes from Work Units (below); Mastery comes from objective outcomes only.

**Work Units** (`packages/domain/src/progression.ts`, `packages/inference`):

| Action | Work Units | Focus cost (12 Focus per Realm) |
|---|---|---|
| Attune | 1 | 1 |
| Fracture | 1 | 1 |
| Temper | 3 | 2 |
| Mirror | 3 | 2 |
| Deep Trial | 5 | 3 |

- XP is `round(20 × WU^0.72)`, awarded once per character × artifact revision × action type.
- Level thresholds are `round(100 × (level − 1)^1.55)`, with a cap of 30.
- Mastery is `100 × (s+2)/(s+f+4) × (1 − e^(−opportunities/12))`.

**Fixture workflow (§60):** the coding agent reads each recorded request and reasons over only the supplied context. It writes a schema-valid result that uses only the supplied IDs and invents no numbers. `pnpm fixtures:validate` enforces the hash, the schema, the no-invented-IDs rule and the no-invented-numbers rule.

## Offline (§98)

After `pnpm install` and with the committed seeds, the service and the whole slice run with the internet disabled. Network access is needed only for the explicit `pnpm data:sync*` refresh commands.

If the service itself is unreachable, the Unreal client falls back to ordinary loot so combat stays playable (§101: the game must stand without the reality layer).

## No-paid-inference test (§99)

`pnpm test:no-paid-inference` (`tests/no-paid-inference/`) fails when:

- a commercial LLM SDK appears in any manifest or the lockfile
- an AI API key or LLM endpoint appears in source (the web build, the server and `reality-service/`)
- a full crafting session, or any of the service's inference endpoints, makes a network call
