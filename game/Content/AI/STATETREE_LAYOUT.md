# StateTree layout for the Hushed and the Bound King

Two assets, authored in the editor from the C++ nodes in `Source/Ender/AI/EnderStateTreeTasks.h`.
The nodes are thin: all behaviour is in `AEnderEnemyCharacter`, `AEnderBoundKing` and
`AEnderAIController`, so the trees only decide order.

Both assets use:

- **Schema:** `StateTree AI Component` (`UStateTreeAIComponentSchema`).
  - AI Controller Class: `AEnderAIController`
  - Context Actor Class: `AEnderEnemyCharacter` (`AEnderBoundKing` for the boss tree)
- Every Ender node has an `Actor` property in its *Context* category. It binds to the
  context actor automatically; leave it bound.
- Assign the asset on each `UEnderEnemyDefinition` (**StateTree** field). All five Hushed
  archetypes share `ST_Hushed`; `DA_BoundKing` uses `ST_BoundKing`. `AEnderAIController.DefaultStateTree`
  is the fallback when a definition has none.

"Check X" below means an **Ender Enemy Check** condition with `Check = X`; "not X" means the
same condition with `bInvert` ticked.

## ST_Hushed (Husk, Hound, Wisp, Keeper, Seer)

```
Root
└─ Alive
   ├─ Disabled                         enter: Check Disabled
   │  ├─ Dead                          enter: Check Dead        task: Ender Disabled   (no transitions; the brain is stopped on death)
   │  ├─ Staggered                     enter: Check Staggered   task: Ender Disabled   On Succeeded → Combat
   │  └─ Rooted                        enter: Check Rooted      task: Ender Disabled   On Succeeded → Combat
   └─ Combat                           transition: On Tick, Check Disabled → Disabled   (priority High)
      ├─ AcquireTarget                 enter: not HasTarget     task: Ender Acquire Target   On Succeeded → Combat
      ├─ Engage
      │  ├─ MaintainRange              enter: Check Ranged      task: Ender Maintain Range (MaxSeconds 3)
      │  │                                                      On Succeeded → RequestAttackToken · On Failed → Reposition
      │  └─ Approach                                            task: Ender Approach (RangeScale 1)
      │                                                         On Succeeded → RequestAttackToken · On Failed → Combat
      ├─ Attack                        (only entered by transition)
      │  ├─ RequestAttackToken                                  task: Ender Request Attack Token (MaxWaitSeconds 0.4)
      │  │                                                      On Succeeded → Telegraph · On Failed → Reposition
      │  ├─ Telegraph                                           task: Ender Telegraph
      │  │                                                      On Succeeded → Execute · On Failed → Reposition
      │  ├─ Execute                                             task: Ender Execute
      │  │                                                      On Succeeded → Recover · On Failed → Reposition
      │  └─ Recover                                             task: Ender Recover
      │                                                         On Completed → Combat
      └─ Reposition                    (only entered by transition)
                                                                task: Ender Reposition (0.6–1.2 s, MeleeExtraRadius 120)
                                                                On Completed → Combat
```

Why it is shaped this way:

- **Tokens before windup.** Telegraph is only reachable from RequestAttackToken's success, and
  `BeginTelegraph()` refuses to start without a held token. Without one the enemy holds and faces
  the Binder for up to 0.4 s ("threaten"), then circles in Reposition ("orbit") and tries again.
- **Tokens always come back.** Recover ends → released. Telegraph/Execute/Recover exited early
  (the Combat → Disabled transition on stagger or root, or death) → the task's ExitState calls
  `AbortAttack()`, which cancels the telegraph and releases. The enemy also aborts on its own when
  State.Staggered / State.Rooted / Effect.Root is added, so this holds even if a transition is missing.
- **Off-screen fairness** is inside the enemy/director calls: RequestAttackToken fails while the enemy
  is outside the viewport + 8%, and an attack whose attacker left the screen before its telegraph
  resolved aborts instead of hitting.
- **Hound orbit gate.** `IsAttackReady` refuses the first leap until the Hound has spent 0.45 s in
  Reposition, so a Hound approaches, fails its first token request, circles, then leaps.
- **Seer pool cap / projectile cap** are also in `IsAttackReady` (2 live pools per Seer, 24 shots).

## ST_BoundKing

```
Root
└─ Alive
   ├─ Dead                             enter: Check Dead               task: Ender Disabled
   ├─ PhaseTransition                  enter: Check BossTransitioning  task: Ender Disabled   On Succeeded → Combat
   ├─ Staggered                        enter: Check Staggered          task: Ender Disabled   On Succeeded → Combat
   └─ Combat                           transition: On Tick, Check Disabled → Alive   (priority High)
      ├─ AcquireTarget                 enter: not HasTarget   task: Ender Acquire Target   On Succeeded → Combat
      ├─ Approach                                             task: Ender Approach (RangeScale 1, MaxSeconds 1.5)
      │                                                       On Completed → BossAttack
      └─ BossAttack                    (only entered by transition)
                                                              task: Ender Boss Attack
                                                              On Succeeded → Approach · On Failed → Approach
```

- The boss needs no tokens and is exempt from the off-screen rule.
- `Ender Boss Attack` asks `AEnderBoundKing::TryStartBossAttack()`, which draws from the run's
  BossPattern stream through `FBoundKingState::ChooseAttack` (phase gating, cooldowns, and never
  Manuscript Collapse together with Bound Circle). Approach's 1.5 s cap keeps the boss from chasing
  forever when only ranged attacks (Ink Lance, Chain Pull) are off cooldown.
- Transitions (2.0 s, invulnerable) and the 4.5 s stagger are rules-state timers; the tree just
  waits in PhaseTransition / Staggered until `IsDisabled()` clears.
