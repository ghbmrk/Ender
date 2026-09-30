# Encounters

- `DA_Encounter_Room1`…`Room4`, `DA_Encounter_Elite` — `UEnderEncounterDefinition` (room kind, roster, seed offset),
  generated from `Content/Data/encounters.json`. Waves are planned by the engine-free rules from the run seed.
- In a Realm map, place per room: one `AEnderEncounterDirector` (set `Definition`, resize `CombatArea`, add
  `CorridorProbes`), its `AEnderSpawnPoint`s and door actors, then press **Validate Room** on the director.
- Boss room: one `AEnderBossArena` with `BossDefinition` = `DA_BoundKing`.
- Shrine, altar, portal and Crossing stations are `AEnderRealmInteractable` with the matching `Interaction`.
- Realm order: Entry → Room 1 → Connector → Room 2 → Attunement Shrine → Room 3 → Room 4 → Elite →
  Recovery Space → Boss → Reward Altar → Return Portal.
