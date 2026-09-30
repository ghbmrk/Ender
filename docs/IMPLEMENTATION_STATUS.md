# Implementation status (spec §100, steps 1–50)

Nothing under `game/` has been compiled. The container that wrote it has no Unreal Engine, so every UE class is **unbuilt** until the first Windows build (`docs/UNREAL_BUILD.md`). What *is* verified:

- **Rules tests** (`tests/cpp/run.sh`, g++ and clang++, `-Werror`): the engine-free headers in `game/Source/Ender/Rules/` that every UE class delegates its numbers and decisions to. This includes the §94 100-seeded-room simulation.
- **Service tests** (`pnpm test`, `pnpm test:no-paid-inference`, `pnpm fixtures:validate`): the TypeScript reality service, economy, inference fixtures and the web build.

Column meanings:

- **Code** is what exists in the repo.
- **Editor content** is what a person must still author in the editor, such as meshes, montages, Niagara systems, sounds, StateTree assets and maps. `game/Tools/Python/create_ender_assets.py` creates the data assets, input assets and ability/enemy Blueprints it can. The per-folder `game/Content/*/README.md` files list the rest.
- **Verified** says which tests cover the step. "Unbuilt" means C++ that has never been compiled.

| # | Step | Code | Editor content | Verified |
|---|---|---|---|---|
| 1 | Project + C++ module | `Ender.uproject`, targets, `Ender.Build.cs`, config | none | Unbuilt |
| 2 | Fixed camera | `EnderCameraRigComponent` (SmoothDamp follow, lookahead, lag clamp, zoom, kicks) | none | Rules (`CameraRules.h`); UE unbuilt |
| 3 | Movement + aiming | `EnderPlayerCharacter`, `EnderPlayerController` (camera-relative move, mouse/stick aim) | Input assets (script) | Unbuilt |
| 4 | Evade | `EnderAbility_Evade` (speed curve, invulnerability window, direction choice) | Evade montage (optional; fallback timeline) | Rules (`Evade::*`); UE unbuilt |
| 5 | GAS initialization | ASC, attribute set, effect context, globals, damage execution, code-defined GEs, tags | none | Unbuilt |
| 6 | Thread Lash | `EnderAbility_MeleeArc` (3-hit combo, lunge, Thread gain) | Lash montages | Rules (`ThreadLash`, `FLashCombo`); UE unbuilt |
| 7 | Husk | `EnderEnemyCharacter`, `EnderEnemyDefinition`, StateTree tasks | Mesh, montages, StateTree asset (`Content/AI/STATETREE_LAYOUT.md`) | Rules (`EnemyRules.h`, `EnemyAIRules.h`); UE unbuilt |
| 8 | Hit queries + feedback | `EnderTargetSweepComponent`, `EnderHitFeelSubsystem` (hitstop, flash, camera kick), damage numbers | Hit Niagara, sounds | Rules (`HitFeelFor`, `DamageNumbers`); UE unbuilt |
| 9 | Sever | `EnderAbility_MeleeArc` (Sever config) | Montage | Rules; UE unbuilt |
| 10 | Attack token director | `EnderCombatDirector` (Melee 4 / Ranged 2 / Heavy 1, off-screen fairness) | none | Rules + §94 room simulation; UE unbuilt |
| 11 | Hound | Enemy definition + StateTree tasks | Mesh, montages | Rules; UE unbuilt |
| 12 | Wisp | `EnderEnemyProjectile`, AI pool | Mesh, projectile Niagara | Rules; UE unbuilt |
| 13 | Encounter director | `EnderEncounterDirector`, spawn points, waves, reinforcement | Encounter placement in maps | Rules + §94 simulation; UE unbuilt |
| 14 | Bind | `EnderAbility_Radial` (pull, bosses never pulled) | Montage, Niagara | Rules; UE unbuilt |
| 15 | Unravel | `EnderAbility_ExpandingRing` | Montage, Niagara | Rules (`Unravel::RadiusAt`); UE unbuilt |
| 16 | Warding Sigil | `EnderAbility_Barrier` | Niagara | Rules; UE unbuilt |
| 17 | Grand Fracture | `EnderAbility_SequencedStrikes` | Montage, Niagara | Rules; UE unbuilt |
| 18 | Keeper | Enemy definition, hazard pool | Mesh, montages | Rules; UE unbuilt |
| 19 | Seer | Enemy definition (support/buff) | Mesh, montages | Rules; UE unbuilt |
| 20 | Elite modifiers | `Elite::ApplyElite` (Hardened, Volatile), elite room plan | Elite material tint | Rules; UE unbuilt |
| 21 | Bound King Phase 1 | `EnderBoundKing`, `EnderBossArena`, `EnderTelegraph` | Boss mesh, montages, arena map | Rules (`BossRules.h`); UE unbuilt |
| 22 | Boss stagger | `FBoundKingState` stagger meter, decay, break | Stagger cue | Rules; UE unbuilt |
| 23 | Bound King Phases 2–3 | Phase transitions, adds at 80%, attack selection | Same as 21 | Rules; UE unbuilt |
| 24 | Loot | `EnderLootSubsystem`, `EnderLootDrop`, Form bias | Drop mesh, `WBP_LootLabel` | Rules (`LootRules.h`); UE unbuilt |
| 25 | Inventory + equipment | `EnderInventoryComponent` (gear slots, reapply on spawn) | `WBP_Inventory` | Rules (`Gear::*`); UE unbuilt |
| 26 | Reality service | `reality-service/` (Fastify, port 8788; all §-listed endpoints plus `/realm/:id/pool`); `EnderRealityClient` | none | Service tests; UE client unbuilt |
| 27 | PubChem seed Forms | 240 committed records in `data/seed/pubchem/` (see the provenance caveat in `REALITY_SPEC.md`) | none | `fixtures:validate` |
| 28 | Form scoring | `packages/reality`, `packages/domain` | none | Service tests |
| 29 | Attunement | `POST /attune`; UE Familiar menu | `WBP_Familiar` | Service tests; UE unbuilt |
| 30 | Inference fixture system | `packages/inference` (fixtures + rule provider only) | none | `test:no-paid-inference`, `fixtures:validate` |
| 31 | Temper / Fracture / Trial / Mirror | Service routes; UE Familiar actions | Same widget | Service tests; UE unbuilt |
| 32 | XP + Work Units | Service progression; `workUnitsFor` | none | Service tests |
| 33 | Passive tree + SearchPolicy | Service; UE passives panel | `WBP_Passives` | Service tests (§97 builds); UE unbuilt |
| 34 | Mastery | Service | none | Service tests |
| 35 | Market snapshots | `packages/economy`, committed snapshots | none | Service tests (§96) |
| 36 | Essence economy | `packages/economy` | none | Service tests (§96) |
| 37 | Bazaar | `GET /bazaar`; UE Bazaar menu | `WBP_Bazaar` | Service tests; UE unbuilt |
| 38 | Production cost | `packages/economy` | none | Service tests |
| 39 | Contracts | `GET /contracts`; UE contracts panel | Widget | Service tests; UE unbuilt |
| 40 | Realm/economy integration | Pool prefetch, reported drops (`forms`) at checkpoint/complete, `EnderRealmSubsystem`, `EnderGameInstance::EnterRealm` | Realm gate map | Service tests; UE unbuilt |
| 41 | Prophecy | `POST /prophecy`, `/prophecy/resolve` | Widget | Service tests; UE unbuilt |
| 42 | Watercolor master material | `Tools/Art/Shaders/WatercolorPigment.hlsl`, `T_PaperGrain.png` (generated, seed 1127) | Master material graph wrapping the Custom node | Texture generated; HLSL not compiled |
| 43 | Outline post-process | `Tools/Art/Shaders/InkOutline.hlsl`, custom-depth stencil on characters | Post-process material + volume | Not compiled; `ESceneTextureId` indices need checking on 5.8 |
| 44 | Niagara art pass | Cue hooks (`GameplayCue.*` tags, `ANS_GameplayCueWindow`) | All Niagara systems | Not started beyond hooks |
| 45 | Audio pass | Audio random stream reserved; cue hooks | All sounds | Not started beyond hooks |
| 46 | First-20-minute onboarding | Tutorial realm flag (boss skips Phase 3), `RealmFlowRules.h` segment order | Tutorial map, prompts | Rules; UE unbuilt |
| 47 | Analytics | `EnderTelemetrySubsystem` (local JSONL, no network) | none | Rules (`TelemetryRules.h`); UE unbuilt |
| 48 | Performance profiling | Enemy/projectile pooling, capped counts | Needs a build to profile | Not done |
| 49 | Combat tuning | All numbers are the spec's, in `Rules/*.h` and `Content/Data/*.json` | Needs play | Not done |
| 50 | Economy tuning | §96 economic tests pass on the committed data | Needs play | Partially (tests only) |

## Known spec conflicts

`COMBAT_SPEC.md` ("Spec conflicts") lists the places where the spec contradicts itself. It also gives the choice made for each, for example boss telegraphs that fall below the spec's own telegraph floors.

## First build checklist

1. Generate project files and build `EnderEditor` (Development Editor, Win64).
2. Fix whatever the compiler finds. `UNREAL_BUILD.md` lists the engine APIs most likely to need adjusting.
3. Run `create_ender_assets.py` from the editor's Python console.
4. Run the automation tests `Ender.Rules.*` in Session Frontend.
5. Start `pnpm service` (port 8788), then play in editor from `L_Crossing`.
