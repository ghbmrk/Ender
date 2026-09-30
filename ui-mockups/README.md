# Ender UI mockups

HTML/CSS reference mockups of Ender's UMG screens, at 1920×1080. They are the visual reference for building the `WBP_*` widgets (spec section 88). They are not game code.

| Screen | File | Widgets it covers |
| --- | --- | --- |
| In-combat HUD | `hud.html` (`?boss=1` for the boss bar) | WBP_HUD, WBP_SkillBar, WBP_Health, WBP_Thread, WBP_Draughts, WBP_EnemyHealth, WBP_BossHealth, WBP_LootLabel |
| Realm Gate | `realm-gate.html` | WBP_RealmGate |
| Crucible | `crucible.html` | WBP_Crucible, WBP_Inventory (equipped + held) |
| Bazaar | `bazaar.html` | WBP_Bazaar |

Rendered PNGs are in `shots/`.

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
node ui-mockups/render.mjs hud crucible     # just some screens
```

Add `?notes=1` to a page URL to show the spec-dimension annotations.
