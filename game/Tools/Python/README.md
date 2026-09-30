# Editor Python tools

`create_ender_assets.py` builds Ender's data assets from `Content/Data/*.json`. It is
idempotent: run it again after editing the JSON and the assets are updated in place.

Requirements: the Python Editor Script Plugin (enabled in `Ender.uproject`) and a compiled
Ender module (the script calls `EnderContentLibrary`, `EnderEnemyDefinition.apply_rule_defaults`).

## Run

In the editor: **Tools → Execute Python Script…** and pick this file.

Headless:

```
UnrealEditor-Cmd.exe "C:\path\Ender.uproject" -run=pythonscript -script="C:\path\game\Tools\Python\create_ender_assets.py"
UnrealEditor-Cmd.exe "C:\path\Ender.uproject" -run=pythonscript -script="C:\path\game\Tools\Python\create_ender_assets.py --only input,loot"
```

## What it makes

| Section | Source | Assets |
|---|---|---|
| `input` | input.json | `/Game/Input/IA_*`, `/Game/Input/IMC_Binder` (WASD/sticks, mouse and gamepad bindings) |
| `abilities` | abilities.json | `/Game/Abilities/Data/DA_Ability_<Name>` (`UEnderAbilityDefinition`) |
| `montages` | abilities.json | notify states on the `Ender` track of each ability montage that exists |
| `blueprints` | abilities.json | `/Game/Abilities/GA_*` with `Definition` set; `/Game/Characters/BP_Binder` with `StartupAbilities` (only when empty unless `--force-binder`) |
| `enemies` | enemies.json | `/Game/Enemies/Data/DA_<Archetype>` filled by `ApplyRuleDefaults`; class and StateTree wired when present |
| `encounters` | encounters.json | `/Game/Encounters/DA_Encounter_Room1..4`, `DA_Encounter_Elite` |
| `loot` | loot.json | `/Game/Data/DA_LootProfile_Default` |

Missing optional inputs (montages, BP enemy classes, StateTrees, `BP_LootDrop`) are skipped
and the native classes are used; run the script again once they exist.
