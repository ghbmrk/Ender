# Building and running the Unreal client

The Unreal project is `game/Ender.uproject`: UE 5.8.3, C++ module `Ender`. It targets Windows 10/11 x64 and also builds on Apple Silicon macOS (see below). It has never been compiled. The repository's build container is Linux with no engine, so the first build on a real machine will surface compile errors, and they should be fixed there.

## Requirements

- Windows 10/11 x64. The reference hardware for the performance targets is a Ryzen 5 3600, an RTX 3060 or RX 6600, 16 GB of RAM, at 1080p.
- Unreal Engine 5.8.3 from the Epic launcher or a source build.
- Visual Studio 2022 with the "Game development with C++" workload, including the MSVC toolchain the 5.8 release notes name.
- Node 22.13+ and pnpm 10 for the reality service.

## Building on macOS (Apple Silicon)

The code has no Windows-specific parts, so a Mac can compile it, run the automation tests and play it in the editor. The performance targets still refer to the Windows reference hardware.

1. Install Xcode (the version the UE 5.8 release notes name), open it once to accept the licence, and install Unreal Engine 5.8 from the Epic Games Launcher. It lands in `/Users/Shared/Epic Games/UE_5.8`.
2. Build the editor target:

   ```sh
   UE="/Users/Shared/Epic Games/UE_5.8"
   "$UE/Engine/Build/BatchFiles/Mac/Build.sh" EnderEditor Mac Development -Project="$PWD/game/Ender.uproject" -waitmutex
   ```

3. Run the rules automation tests headless:

   ```sh
   "$UE/Engine/Binaries/Mac/UnrealEditor.app/Contents/MacOS/UnrealEditor" "$PWD/game/Ender.uproject" \
     -ExecCmds="Automation RunTests Ender.Rules; Quit" -unattended -nullrhi -nosplash -log
   ```

4. The steps under "First run" below are the same on a Mac, apart from these path changes.

## First run

1. **Start the reality service**, and leave it running:

   ```powershell
   pnpm install
   pnpm service
   ```

   It listens on `127.0.0.1:8788`, works offline and needs no API key.

2. **Generate project files and build.** Right-click `game/Ender.uproject`, choose "Generate Visual Studio project files", open `Ender.sln` and build the `EnderEditor` target in `Development Editor | Win64`. Or run:

   ```powershell
   & "<UE>\Engine\Build\BatchFiles\Build.bat" EnderEditor Win64 Development "<repo>\game\Ender.uproject" -waitmutex
   ```

3. **Import source art.** In the editor, import `game/Content/Materials/Source/T_PaperGrain.png` to `/Game/Materials/Textures`. Use Grayscale, turn sRGB off, and choose Masks compression.

4. **Generate Data Assets, input and montage notifies.** Run Tools → Execute Python Script → `game/Tools/Python/create_ender_assets.py`, or headless:

   ```powershell
   & "<UE>\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "<repo>\game\Ender.uproject" -run=pythonscript -script="<repo>\game\Tools\Python\create_ender_assets.py"
   ```

   The script is idempotent: re-running it updates assets and never duplicates them.

5. **Author the content that can only be made in the editor.** `game/Content/*/README.md` lists every asset by name:
   - the two maps (`L_Crossing`, `L_AshenVault`)
   - Binder and Hushed Blueprints on CC0 KayKit rigs
   - the StateTree asset, following `game/Content/AI/STATETREE_LAYOUT.md`
   - `M_Ender_Watercolor_Master` and `PP_Ender_InkOutline` from `game/Tools/Art/Shaders/*.hlsl`
   - the Niagara systems and the WBP widgets

6. **Play.** Press Play in `L_AshenVault` for combat, or start from `L_Crossing` for the full loop.

## Tests

| What | How | Needs Unreal |
|---|---|---|
| Rule core, including the 100 seeded rooms | `tests/cpp/run.sh` (Linux/macOS, or Git Bash on Windows) | no |
| Same rules inside the module | Session Frontend → Automation → `Ender.Rules.*` | yes |
| Reality service, economy, builds, no-paid-inference | `pnpm test`, `pnpm test:no-paid-inference` | no |

## Remote Control option

This project can also be built from a Claude session on your own Windows machine through Remote Control. Point it at a folder containing this repository and an installed UE 5.8.3. That session can build, run the automation tests and fix compile errors in place.

## Engine APIs to check on the first compile

None of this code has been through UnrealHeaderTool or MSVC yet. These are the calls whose exact 5.8 signature or availability was not verifiable offline:

- GAS: `UGameplayAbility::GetAssetTags`, `FGameplayEffectSpec::AddDynamicAssetTag`, `AbilityTask_ApplyRootMotionConstantForce` parameters, `FRootMotionSource_MoveToForce` setup.
- StateTree: `UStateTreeComponent::SetStateTree`, `FStateTreeTaskCommonBase` instance-data binding in `EnderStateTreeTasks`.
- HTTP/JSON: `IHttpRequest::SetTimeout`.
- Collision: `Engine/OverlapResult.h` include path, `FMath::RandPointInCircle`.
- Attributes: gear bonuses use `SetNumericAttributeBase`.
- UMG: `UTextBlock::SetFont`/`SetJustification`, `UUserWidget::GetGameInstance<T>`, `SetIsFocusable`.
- Reflection: `FProperty::ImportText_Direct`.
- UHT: `constexpr` arrays at namespace scope in headers that also declare reflected types.
- Materials: `ESceneTextureId` indices used in `Tools/Art/Shaders/InkOutline.hlsl`.
- Python (`create_ender_assets.py`): the input mapping context property is `mappings` in 5.5 and `default_key_mappings` later (the script tries both); `unreal.InputAction_Factory`, `unreal.InputMappingContext_Factory`; `AnimationLibrary.add_animation_notify_state_event`.
