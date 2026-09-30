# Characters

- `BP_Binder` — Blueprint of `AEnderPlayerCharacter` (mesh, anim BP, `StartupAbilities` = the `GA_*` in /Game/Abilities).
  `AEnderGameMode` spawns it when it exists, else the native class. `create_ender_assets.py --only blueprints` creates it.
- Outline: custom depth stencil 1 (player), edge colour #30365A.
