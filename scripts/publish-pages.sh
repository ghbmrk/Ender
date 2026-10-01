#!/usr/bin/env bash
# Rebuild the public playable demo (the game with on-device painted characters) from this checkout and push it to
# ghbmrk/ender-hero-painter under play/, served at https://ghbmrk.github.io/ender-hero-painter/play/.
# Run after every artifact publish, so the two links stay the same game:  bash scripts/publish-pages.sh
# The painter model lives beside it in that repo (model/); this script never touches it.
# Optional: TRAILER="..." appends lines (e.g. attribution) to the commit message.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
sha="$(git -C "$root" rev-parse --short HEAD)"
pages="${PAGES_DIR:-${TMPDIR:-/tmp}/ender-hero-painter}"
(cd "$root/apps/game" && pnpm -s build:pages >/dev/null 2>&1)
if [ -d "$pages/.git" ]; then git -C "$pages" fetch -q origin main && git -C "$pages" reset -q --hard origin/main
else git clone -q --depth 1 https://github.com/ghbmrk/ender-hero-painter.git "$pages"; fi
rm -rf "$pages/play" && cp -r "$root/apps/game/dist-pages" "$pages/play"
git -C "$pages" add -A play
if git -C "$pages" diff --cached --quiet; then echo "play/ already matches $sha"; exit 0; fi
git -C "$pages" commit -q -m "Sync play/ to Ender $sha${TRAILER:+

$TRAILER}"
for i in 1 2 3 4; do git -C "$pages" push -q origin HEAD:main && break || { git -C "$pages" pull -q --rebase origin main; sleep $((2 ** i)); }; done
echo "play/ now matches Ender $sha"
