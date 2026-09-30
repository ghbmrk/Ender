# Combat spec: where each rule lives

The implementation spec is the source for every number here. This file maps each rule to its code and lists the calls made where the spec was silent or contradicted itself.

Combat numbers live in two layers:

1. **`game/Source/Ender/Rules/*.h`** is engine-free C++ with the spec defaults and the pure math: damage, timings, the Evade curve, Unravel radius, input buffer, attack tokens, encounter planning, boss state and loot. The Unreal module compiles it, and `tests/cpp/run.sh` compiles it with g++ or clang++ with no engine at all.
2. **Data Assets** (`UEnderAbilityDefinition`, `UEnderEnemyDefinition`, `UEnderEncounterDefinition`) hold the tuning designers change. `game/Tools/Python/create_ender_assets.py` generates them from `game/Content/Data/*.json`, and those JSON files are seeded with the same spec values.

## Map

| Spec | Rule code (engine-free) | Unreal code |
|---|---|---|
| §14 Binder capsule and movement | `CombatRules.h` `Binder::*` | `Character/EnderPlayerCharacter` |
| §15–16 camera, lookahead, follow | `CameraRules.h` | `Camera/EnderCameraRigComponent` |
| §17 input | none | `Character/EnderPlayerController` plus the `IMC_Binder` generated asset |
| §18 input buffer | `InputBufferCore.h` | `Combat/EnderCombatInputBuffer`, `UEnderAbilitySystemComponent::TryActivateFromBuffer` |
| §19 attributes | none | `AbilitySystem/EnderAttributeSet` |
| §20 tags | none | `AbilitySystem/EnderGameplayTags` (native tags) |
| §21 Windup/Active/Recovery, notify states | `FAbilityTiming` | `AbilitySystem/EnderGameplayAbility`, `AbilitySystem/Notifies/ANS_AttackWindow.h` (all five ANS classes) |
| §22 Thread | `Thread::*` | `EnderPlayerCharacter::Tick`, `ResetThreadForRoom` |
| §23 Thread Lash | `ThreadLash::*`, `FLashCombo` | `Abilities/EnderAbility_MeleeArc` |
| §24 Sever | `Sever::*` | `Abilities/EnderAbility_MeleeArc` (motion-warp target `Lunge`) |
| §25 Bind | `Bind::*` | `Abilities/EnderAbility_Radial` |
| §26 Unravel | `Unravel::RadiusAt` | `Abilities/EnderAbility_ExpandingRing` |
| §27 Warding Sigil | `WardingSigil::*` | `Abilities/EnderAbility_Barrier`, `EnderPlayerCharacter::HandleDamaged` |
| §28 Grand Fracture | `GrandFracture::*` | `Abilities/EnderAbility_SequencedStrikes` |
| §29 Evade | `Evade::*` (curve, invulnerability, direction) | `Abilities/EnderAbility_Evade` |
| §30 damage model | `Damage::*` | `AbilitySystem/EnderDamageExecution`, `Combat/EnderCombatStatics::ApplyDamage` |
| §31 hit detection | none | `Combat/EnderTargetSweepComponent` (SphereSweep, CapsuleSweep, ConeQuery, RadialQuery, LaneQuery) |
| §32 hit feel | `HitFeelFor` | `Combat/EnderHitFeelSubsystem`, `EnderCharacterBase::PlayHitFlash` and `PauseAnimation` |
| §33 health and Draughts | `Draught::*` | `Abilities/EnderAbility_Draught`, `EnderPlayerCharacter::OnDealtDamage` |
| §34–40 the Hushed, elites | `EnemyRules.h` | `AI/` |
| §41 attack tokens | `FAttackTokenPools` | `Combat/EnderCombatDirector` |
| §42 StateTree AI | `EnemyAIRules.h` | `AI/` (tasks, conditions, controller); layout in `game/Content/AI/STATETREE_LAYOUT.md` |
| §43 off-screen fairness | `Fairness::*` | `EnderCombatDirector` gate at windup start and again at execute |
| §44 telegraph minimums | `TelegraphMinimum`, `TelegraphMatches` | `AI/EnderTelegraph` (one shape drives the visual and the damage query) |
| §45–48 encounters, waves, rooms, pacing | `EncounterRules.h` | `Encounters/` |
| §50–54 Bound King | `BossRules.h` | `AI/EnderBoundKing` |
| §55–56 loot and Form bias | `LootRules.h` | `Items/` loot subsystem |
| §69 gear | `Gear::*` | `Inventory/` |
| §94 100 seeded rooms | `RoomSimulation.h` | automation test `Ender.Rules.SeededRooms` |

## Timing has one source

Montage notify states carry gameplay timing (§21). `create_ender_assets.py` writes `ANS_AttackWindow`, `ANS_CancelWindow`, `ANS_MovementOverride`, `ANS_Invulnerability` and `ANS_GameplayCueWindow` onto each montage from the ability JSON. That keeps the JSON as the single source of truth.

When a montage has no `ANS_AttackWindow` (placeholder animation), `UEnderGameplayAbility` runs the same Begin/End/cancel/movement events from the Definition on one timeline. There are no scattered timers in either path. Damage can only be applied between AttackWindow Begin and End (`UEnderGameplayAbility::DealDamage` enforces it).

## Choices where the spec is silent

| Topic | Choice | Why |
|---|---|---|
| "Third consecutive Lash within 1.2 s" | Each Lash must start within 1.2 s of the previous Lash's start. Any other ability, Evade included, breaks the chain. | This is the more forgiving reading. The stricter one (all three inside 1.2 s) needs cancels at 0.31 s to reach at all. |
| Thread gain from Lash | Gained once per swing that connects. It is not per enemy. | This stops a pack from filling Thread in one swing. |
| Draught key | Q on keyboard, D-pad Up on gamepad | §17 gives Draughts no binding. |
| Zoom input | Mouse wheel on `IA_Zoom` | §15 defines zoom steps but no binding. |
| Sigil cooldown reduction | Applies to skills and not to Evade | Evade's 1.65 s is a movement constant. |
| Player hit-stun | 0.20 s, cancels the running ability and holds the Binder still. It is suppressed by Barrier against normal enemies. | §27 implies hit-stun exists without defining it. |
| Elite threat cost | 2 × base cost + 2 (Husk 4, Hound 4, Wisp 6, Keeper 10, Seer 8) | §45 budgets the elite room at 17 without pricing the elite. |
| Elite room | One elite. It always opens the fight, and the remaining budget fills with normal roles. | "Elite 17" plus one modifier maximum |
| First-realm roster | Rooms 1–2 use Husk, Hound and Wisp. Keeper and Seer join from Room 3. | §74 puts them in rooms 3–4. |
| Evade velocity at t=0 | 35% of peak | The curve "accelerates 0–20%". Starting from zero would break "velocity change on the next movement tick". |
| Enemy attack aborted off-screen | An attacker that leaves the view (plus 8% margin) during windup aborts at execute and returns its token. | "No normal attack may hit the player from off-screen" (§43) |
| Global hitstop | World time dilation for 28 or 42 ms, counted in real time. UMG and audio don't read world dilation, so they keep running. | §32 |
| Crit roll | Rolled at hit time from the run's crit stream and carried in the effect context | This keeps it deterministic and replayable (§30). |

## Spec conflicts to resolve in tuning

The spec sets telegraph floors (§44) and also gives some boss attacks telegraphs below them. The code keeps the spec's attack numbers, classes each attack by the floor it meets, and the rule tests assert it:

| Attack | Spec telegraph | Floor it misses | Classed as |
|---|---|---|---|
| Bound King Sweep | 0.72 s | boss major 0.95 s | projectile (0.60 s) |
| Bound King Ink Lance | 0.70 s | boss major 0.95 s | projectile (0.60 s) |
| Manuscript Collapse | 1.15 s | boss lethal 1.20 s | boss major (0.95 s); 30 damage is not lethal from full health |

To follow the floors instead, raise these three in `BossRules.h` and in the Bound King's Data Asset.

## Verified here vs. untested

- **Verified** (`tests/cpp/run.sh`, g++ 13 and clang 18): every rule header, the Evade integral, Unravel continuity, damage and crit rate, input buffer ordering and expiry, token caps, telegraph floors, boss phases, stagger and exclusion, loot rates and bias, and 100 seeded rooms with 0 token violations, 0 prohibited spawns, 0 off-screen attacks and 0 cap violations.
- **Untested:** all Unreal C++ (never compiled; no engine in the build container), feel targets (input→animation ≤50 ms, damage/visual ≤20 cm, telegraph ≤50 ms), frame-rate targets and the Niagara, audio and material passes. These need a Windows machine with UE 5.8.3 (`docs/UNREAL_BUILD.md`).
