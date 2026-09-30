# Maps

- `L_Crossing` — hub (GameDefaultMap): Realm Gate, Bazaar, Crucible, Grimoire, passive tree stations.
- `L_AshenVault` — the vertical-slice Realm (EditorStartupMap). `glass-fen` and `hollow-keep` reuse it
  until they have maps (`UEnderGameInstance::RealmMaps`).

A map containing an `AEnderEncounterDirector` or `AEnderBossArena` is treated as a Realm by
`AEnderGameMode`; opened directly (PIE) it runs offline with ordinary gear drops.
