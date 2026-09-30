# Enemies (the Hushed and the Bound King)

- `Data/DA_Husk`, `DA_Hound`, `DA_Wisp`, `DA_Keeper`, `DA_Seer`, `DA_BoundKing` — `UEnderEnemyDefinition`,
  numbers from the engine-free rules (generated from `Content/Data/enemies.json`).
- Optional per-archetype Blueprints: `Husk/BP_Husk`, `Hound/BP_Hound`, `Wisp/BP_Wisp`, `Keeper/BP_Keeper`,
  `Seer/BP_Seer`, `BoundKing/BP_BoundKing` (mesh and cues only; behaviour stays in C++).
- StateTrees live in `/Game/AI` (see `AI/STATETREE_LAYOUT.md`).
- Stencils: 2 enemy, 3 elite (edge #543131), 4 boss.
