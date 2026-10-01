#!/usr/bin/env bash
# Rebuild Mark's playable demo (the game with on-device painted characters) from this checkout and push it to the
# root of ghbmrk/ender-hero-painter, served at https://ghbmrk.github.io/ender-hero-painter/ — the one link Mark plays.
# Run after every shipped change:  bash scripts/publish-pages.sh
# The painter model lives beside it in that repo (model/); this script never touches it. play/ forwards to the root
# (older links). Optional: TRAILER="..." appends lines (e.g. attribution) to the commit message.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
sha="$(git -C "$root" rev-parse --short HEAD)"
pages="${PAGES_DIR:-${TMPDIR:-/tmp}/ender-hero-painter}"
(cd "$root/apps/game" && pnpm -s build:pages >/dev/null 2>&1)
if [ -d "$pages/.git" ]; then git -C "$pages" fetch -q origin main && git -C "$pages" reset -q --hard origin/main
else git clone -q --depth 1 https://github.com/ghbmrk/ender-hero-painter.git "$pages"; fi
# Replace everything but the model, the readme and the Pages marker with the fresh build.
find "$pages" -mindepth 1 -maxdepth 1 ! -name .git ! -name model ! -name README.md ! -name .nojekyll -exec rm -rf {} +
cp -r "$root/apps/game/dist-pages/." "$pages/"
mkdir -p "$pages/play"
cat > "$pages/play/index.html" <<'HTML'
<!doctype html><meta charset="utf-8"><title>Ender</title><meta http-equiv="refresh" content="0; url=../">
<script>location.replace("../" + location.search + location.hash)</script><a href="../">Play Ender</a>
HTML
# The painter speed test (a page that times each engine variant on the phone).
mkdir -p "$pages/bench" && cp "$root/apps/hero-painter/bench/index.html" "$root/apps/hero-painter/engine.js" "$pages/bench/"
touch "$pages/.nojekyll"
git -C "$pages" add -A
if git -C "$pages" diff --cached --quiet; then echo "already matches $sha"; exit 0; fi
git -C "$pages" commit -q -m "Ender $sha${TRAILER:+

$TRAILER}"
for i in 1 2 3 4; do git -C "$pages" push -q origin HEAD:main && break || { git -C "$pages" pull -q --rebase origin main; sleep $((2 ** i)); }; done
echo "https://ghbmrk.github.io/ender-hero-painter/ now plays Ender $sha"
