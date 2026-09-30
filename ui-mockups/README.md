# Ender UI mockups

HTML/CSS reference mockups of Ender's UMG screens, at 1920×1080. They are the visual reference for building the `WBP_*` widgets (spec section 88). They are not game code.

| Screen | File | Widgets it covers |
| --- | --- | --- |
| In-combat HUD | `hud.html` (`?boss=1` for the boss bar) | WBP_HUD, WBP_SkillBar, WBP_Health, WBP_Thread, WBP_Draughts, WBP_EnemyHealth, WBP_BossHealth, WBP_LootLabel |
| Realm Gate | `realm-gate.html` | WBP_RealmGate |
| Crucible | `crucible.html` | WBP_Crucible, WBP_Inventory (equipped + held) |
| Bazaar | `bazaar.html` | WBP_Bazaar |

Rendered PNGs are in `shots/`.

## Combat scene stills

`scenes/scene.html?shot=room|boss|shrine` (add `&cb=1` for the colourblind telegraph hatch) is a three.js stand-in for the in-game look. It is not game code; it exists to judge camera framing, line weights, palette, telegraph readability and the watercolour treatment before the Unreal build runs. `hud.html?bg=scene` lays the HUD over the room still.

- Camera (section 15): 38° vertical FOV, 45° yaw, −52° pitch, 1550 cm arm, 90 cm target offset. Units are metres.
- Ink outlines (section 80): a class-ID pass stands in for custom stencil (1 player, 2 enemy, 3 elite, 4 boss, 5 interactable, 6 loot). The post shader draws edges from depth, normal and class discontinuities at 2.0 / 1.5 / 2.0 / 2.5 / 0.8 px, in #24212A, #30365A for the player and #543131 for elites.
- Watercolour (sections 77–79): continuous Lambert-style lighting with roughness 0.82 and no cel bands, then a post pass with ~2 px wet-pigment drift off the ink line, soft bleed, edge pooling capped at 8%, two-octave pigment variation (±5% brightness, ±7% saturation), granulation, and paper fibres at 0.035 / 0.020 amplitude. The paper is screen-space here; in Unreal it must be world-anchored.
- Telegraphs (section 83): a 25% danger wash with a 2 px ink rim, stepping to 55% with a cream rim when active. Colourblind mode adds a diagonal hatch and a thicker rim.
- Figures are articulated placeholders built from capsules and lathed cloth, shaped to fantasy archetypes: the Binder is a hooded mage with a staff, the Husk a hunched ghoul, the Hound a lean wolf, the Wisp a wraith, the Seer a hooded oracle with a lantern staff, the Keeper an armoured warden with a tower shield and maul, and the Bound King a crowned lich in chains. `?shot=lineup` shows them all from a closer camera. They are for silhouette and scale, not final models.

`vendor/three.module.min.js` is three.js r170 (MIT, `vendor/THREE_LICENSE`). It is used only by these mockups.

## What they follow

- Layout at 1080p (section 89): six 58×58 skill icons with a 7 px gap at bottom centre, a 46×46 Evade, health at bottom left with Thread directly below, a 180×180 minimap at top left, and the pinned contract at top right in two lines at most.
- Palette (section 76). Every colour is a token in `shared.css`. The Essence colours are muted mixes of that palette, because the web build's saturated Essence colours break the "no saturated primaries" rule.
- Type (section 90): Alegreya SC for display text and Atkinson Hyperlegible for body text. Both are SIL Open Font License fonts, vendored in `fonts/` from Google Fonts. They need a `docs/THIRD_PARTY.md` entry when they go into the game.
- Damage numbers (section 91): 18 px paper white, crits at 23 px ochre.
- Telegraphs (section 83): a 2 px ink perimeter with a 25% danger wash.
- No chat composer. The Familiar speaks in at most two lines.

## Data

`data/*.json` is a snapshot from the local reality service (`pnpm service`, port 8788) at replay turning 83 (2023-08-04), when Storm is very scarce. The Realm cards, contracts, Essence prices and history, Veiled Form offers, the Draith Thread evaluation, its three Temper candidates and the Familiar line are all real service output. The Crowns balance, level, held Forms other than Draith Thread, HP and cooldowns are placeholders.

The combat scene behind the HUD is a painted stand-in so the HUD can be judged in context. It is not an art target.

## Render

```sh
pnpm install
# In a cloud workspace, point at the preinstalled Chromium:
CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node ui-mockups/render.mjs
# WebGL scenes render with SwiftShader in headless Chromium (flags are set in render.mjs).
node ui-mockups/render.mjs hud crucible     # just some screens
```

Add `?notes=1` to a page URL to show the spec-dimension annotations.
