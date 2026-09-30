# Art spec: the watercolor-and-ink look

**Target:** dark-fantasy 3D forms with ink-defined silhouettes, filled with hand-painted watercolor washes on paper grain, under restrained physical lighting. It should not be photoreal, cel-shaded, anime toon, Borderlands-style, Diablo-style or generic low-poly.

## Palette (sRGB)

| Role | Hex | Role | Hex |
|---|---|---|---|
| Ink | `#24212A` | Paper Light | `#E7DDC6` |
| Player edge accent | `#30365A` | Warm Stone | `#A89A83` |
| Elite | `#543131` | Cold Stone | `#777B80` |
| Interactable | `#315B57` | Moss | `#65715D` |
| Player Thread | `#6676B8` | Umber | `#776054` |
| Health | `#B84F49` | Deep Wash | `#393641` |
| Danger | `#E16A54` | Rare | `#597DA2` |
| Hazard | `#9A8D42` | Exceptional | `#8667A3` |
| Interact | `#5B9486` | High Value | `#C09A50` |

No saturated primary colors.

## Materials

**`M_Ender_Watercolor_Master`** parameters:

| Parameter | Default | Metal preset |
|---|---|---|
| BasePigment | per asset | |
| PaperScale | 1 tile / 256 cm | |
| PigmentVariance | 1 | |
| EdgePooling | 1 | |
| Granulation | 0.6 | |
| Wetness | 0.3 | |
| Roughness | 0.82 | 0.68 |
| Specular | 0.22 | 0.30 |
| Metallic | 0 | 0.65 |

The body is one Custom node: `game/Tools/Art/Shaders/WatercolorPigment.hlsl`. The file header lists its inputs. What it does:

- **Pigment variation (§79):** two octaves of world-space value noise (about 1.8 m and 45 cm) give ±5% brightness and ±7% saturation.
- **Pooling:** up to 8% darkening at silhouettes (rim term) and creases (vertex-color cavity).
- **Granulation:** pigment settling into low paper tooth.
- **Lighting:** it only shapes albedo, so lighting stays continuous. There are no N·L bands and no stepped shading.

## Paper (§78)

`game/Content/Materials/Source/T_PaperGrain.png` is an original procedural texture: 1024×1024 grayscale, tileable, deterministic.

- **Generator:** `game/Tools/Art/generate_paper_grain.py`, pure Python with seed 1127.
- **Amplitudes:** large fibers 0.035, small fibers 0.020, encoded around mid-gray. The material decodes `(tex − 0.5) × 2 × 0.055`.
- **Anchoring:** sample it with world-aligned (triplanar) UVs, never screen UVs, so it cannot swim when the camera moves.
- **Import settings:** Grayscale, sRGB off, Masks compression.

## Outlines (§80)

`PP_Ender_InkOutline` is a post-process material (Before Tonemapping). It reads Custom Depth and Custom Stencil. The body is `game/Tools/Art/Shaders/InkOutline.hlsl`.

| Stencil | What | Width at 1080p | Ink |
|---|---|---|---|
| 1 | Player | 2.0 px | `#30365A` |
| 2 | Enemy | 1.5 px | `#24212A` |
| 3 | Elite | 2.0 px | `#543131` |
| 4 | Boss | 2.5 px | `#24212A` |
| 5 | Interactable | 1.5 px | `#315B57` |
| 6 | Valuable loot | 2.0 px | `#24212A` |
| none | Environment (depth/normal edges) | 0.8 px | `#24212A`, fading with distance |

- **Width scaling:** widths scale with `ViewSize.y / 1080`.
- **Line color:** ink multiplies toward the ink color and never replaces pixels with black.
- **Setup:** `r.CustomDepth=3` (Custom Depth with stencil) is set in `DefaultEngine.ini`.
- **Code:** `AEnderCharacterBase::SetOutlineStencil` sets the stencil on every mesh the character owns.

Before first use, verify the `ESceneTextureId` indices the shader uses (`#define`s at its top) against the 5.8 engine source. They have been stable across 5.x, but they have not been checked on 5.8.

## VFX (§81–84)

These Niagara systems are to be authored: `NS_InkImpact_Small`, `NS_InkImpact_Heavy`, `NS_PigmentDeath`, `NS_WatercolorTrail`, `NS_TelegraphCircle`, `NS_TelegraphCone`, `NS_LootBeam`, `NS_FormReveal`, `NS_ThreadLash`, `NS_Sever`, `NS_Bind`, `NS_Unravel`, `NS_GrandFracture`.

**Look:** they should read as wet pigment, brush strokes, ink droplets, paper bleed and paint breakup. No neon plasma, generic sparks, stock fireballs or thick volumetric magic.

**Readability priority:** enemy lethal telegraph > player position > active enemy > player attack VFX > interactable > loot > scenery. A lower layer may never cover a higher one. Enforce it with translucency sort priority, in that order.

**Size budgets:**

| Effect | Max screen share | Max duration |
|---|---|---|
| Basic | 4% | 0.25 s |
| Core | 8% | 0.45 s |
| Cooldown | 12% | 0.65 s |
| Ultimate | 22% | 1.0 s |

Enemy death takes 0.75–1.25 s, then pigment breakup; the corpse is gone at 3.0 s. There is no gore.

**Telegraphs (§83):**

- Danger `#E16A54`, 2 px ink perimeter, 25% watercolor fill, animated brush.
- On activation the fill goes to 55% and the perimeter flashes cream for 70 ms.
- Colorblind mode uses a diagonal animated hatch and a thicker boundary.
- The telegraph actor and the damage query share one shape and one timer (`AI/EnderTelegraph`), which is how the 20 cm / 50 ms match is kept.

## Audio (§86–87)

Each major hit has three layers: transient, body and texture. The texture layer is paper tear, brush strike, ink snap or dry parchment fracture.

- **Variation:** pitch ±4% and gain ±1.5 dB. The same variant never plays twice in a row when there are alternatives.
- **Priority:** lethal telegraph > player damage > player heavy impact > boss > player basic > loot > ambience.
- **Ducking:** music ducks −2.5 dB over 0.18 s when the Binder loses ≥20 HP in one hit (`AEnderPlayerCharacter::OnHeavyDamageTaken`). Grand Fracture ducks ambience −3 dB over 0.25 s.

## Type (§90)

Alegreya SC for headings and Atkinson Hyperlegible for everything else, both SIL OFL. Damage numbers are 18 px paper-white, and crits are 23 px ochre.

## Status

- **Committed:** the paper texture, its generator, the two shader bodies and the palette.
- **Not in the repo yet:** meshes, animations, Niagara systems, sounds and the `.uasset` materials. They need the editor, and every external asset must be listed in `docs/THIRD_PARTY.md` before it is committed.
