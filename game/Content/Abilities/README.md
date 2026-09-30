# Abilities

- `Data/DA_Ability_<Name>` — `UEnderAbilityDefinition` per skill (ThreadLash, Sever, Bind, Unravel,
  WardingSigil, GrandFracture, Evade, Draught), generated from `Content/Data/abilities.json`.
- `GA_ThreadLash`, `GA_Sever` (`UEnderAbility_MeleeArc`), `GA_Bind` (`_Radial`), `GA_Unravel` (`_ExpandingRing`),
  `GA_WardingSigil` (`_Barrier`), `GA_GrandFracture` (`_SequencedStrikes`), `GA_Evade`, `GA_Draught` —
  thin Blueprints whose only change is `Definition`.
- Input slots: 1 Lash (LMB/RT), 2 Sever (RMB/LT), 3 Bind (1/X), 4 Unravel (2/Y), 5 Warding Sigil (3/RB),
  6 Grand Fracture (4/LB), Evade (Space/B), Draught (Q/D-pad up).
