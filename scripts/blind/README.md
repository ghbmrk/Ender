# Blind new-player loop

Each round, a brand-new small-model agent plays the built game as a first-time player. It gets no code, no notes, and no knowledge of the game, only screenshots and taps. Its friction becomes the next round's fixes.

1. `pnpm build:web`
2. Start a fresh driver; its new browser context means empty storage: `CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/blind/driver.mjs <outDir> 7777`
3. Give the agent `PROMPT.md` word for word. Never add the game's name, mechanics, goals or earlier findings.
4. Check its report against `<outDir>/actions.log` and the screenshots. Small models misremember, so trust the screenshots.
