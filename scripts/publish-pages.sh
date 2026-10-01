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
# Guard: this build must carry the painter (the game paints its characters on device only when it does).
grep -q '\./model/' "$root/apps/game/dist-pages/assets/"index-*.js || { echo "publish-pages: build has no painter path (VITE_PAINTER_BASE); not publishing" >&2; exit 1; }
if [ -d "$pages/.git" ]; then git -C "$pages" fetch -q origin main && git -C "$pages" reset -q --hard origin/main
else git clone -q --depth 1 https://github.com/ghbmrk/ender-hero-painter.git "$pages"; fi
# Replace everything but the model, the readme, the Pages marker and assets with the fresh build. The previous
# build's assets stay one more publish: a page opened before this push still asks for them (Sign in loads a part).
prev="$(cat "$pages/assets/.build-files" 2>/dev/null || ls "$pages/assets" 2>/dev/null || true)"
find "$pages" -mindepth 1 -maxdepth 1 ! -name .git ! -name model ! -name README.md ! -name .nojekyll ! -name assets -exec rm -rf {} +
now="$(ls "$root/apps/game/dist-pages/assets")"
if [ -d "$pages/assets" ]; then
  for f in "$pages"/assets/*; do b="$(basename "$f")"; grep -qxF "$b" <<<"$now"$'\n'"$prev" || rm -f "$f"; done
fi
cp -r "$root/apps/game/dist-pages/." "$pages/"
printf '%s\n' "$now" > "$pages/assets/.build-files"
mkdir -p "$pages/play"
cat > "$pages/play/index.html" <<'HTML'
<!doctype html><meta charset="utf-8"><title>Ender</title><meta http-equiv="refresh" content="0; url=../">
<script>location.replace("../" + location.search + location.hash)</script><a href="../">Play Ender</a>
HTML
# The painter speed test (a page that times each engine variant on the phone).
mkdir -p "$pages/bench" && cp "$root/apps/hero-painter/bench/index.html" "$root/apps/hero-painter/engine.js" "$pages/bench/"
touch "$pages/.nojekyll"
[ -f "$pages/model/manifest.json" ] || { echo "publish-pages: model/manifest.json missing in the Pages repo; not publishing" >&2; exit 1; }
git -C "$pages" add -A
if git -C "$pages" diff --cached --quiet; then echo "already matches $sha"; exit 0; fi
git -C "$pages" commit -q -m "Ender $sha${TRAILER:+

$TRAILER}"
for i in 1 2 3 4; do git -C "$pages" push -q origin HEAD:main && break || { git -C "$pages" pull -q --rebase origin main; sleep $((2 ** i)); }; done
echo "https://ghbmrk.github.io/ender-hero-painter/ now plays Ender $sha"
