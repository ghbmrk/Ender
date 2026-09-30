# UI

Widget Blueprints and their C++ parents (`Source/Ender/UI`). `AEnderHUD` loads them from these paths.

| Widget | Parent | Notes |
|---|---|---|
| WBP_HUD | UEnderHUDWidget | children named SkillBar, Health, Thread, Draughts, BossHealth, Minimap, PinnedContractText, InteractPromptText, FocusText, DamageNumberLayer (full-screen Canvas Panel) |
| WBP_SkillBar | UEnderSkillBarWidget | bottom-centre, six 58×58 icons 7 px apart, Evade 46×46 |
| WBP_Health | UEnderHealthWidget | bottom-left; HealthBar, BarrierBar, HealthText |
| WBP_Thread | UEnderThreadWidget | directly below health; ThreadBar #6676B8 |
| WBP_Draughts | UEnderDraughtsWidget | ChargesText |
| WBP_EnemyHealth | UEnderEnemyHealthWidget | |
| WBP_BossHealth | UEnderBossHealthWidget | HealthBar, StaggerBar, NameText |
| WBP_LootLabel | UEnderLootLabelWidget | LabelText; shown while Alt is held |
| WBP_Inventory | UEnderInventoryWidget | Tab |
| WBP_Crucible | UEnderCrucibleWidget | Temper, Fracture / Mirror / Deep Trial critiques, trials |
| WBP_Bazaar | UEnderBazaarWidget | essences, veiled Forms, contracts, prophecies 10/30/50/70/90 % |
| WBP_PassiveTree | UEnderPassiveTreeWidget | |
| WBP_RealmGate | UEnderRealmGateWidget | M in the Crossing |
| WBP_Attunement | UEnderAttunementWidget | 0.8 s reveal, Familiar reading ≤ 2 lines |
| WBP_Grimoire | UEnderGrimoireWidget | |

Layout reference 1920×1080: minimap top-left 180×180, pinned contract top-right (two lines max).
No chat composer anywhere.

Fonts (`UI/Fonts`): **Alegreya SC** for titles and numbers (set `DamageNumberFont` on WBP_HUD),
**Atkinson Hyperlegible** for body text. Both are SIL OFL; see docs/THIRD_PARTY.md.
Damage numbers: 18 px paper white #F2ECDE, crits 23 px ochre #C88A2E, 0.65 s, at most 18 on screen.
