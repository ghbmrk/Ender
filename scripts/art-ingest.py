"""Fit painted images to the game: art/raw/<id>.(png|jpg|jpeg|webp) -> apps/game/src/art/painted/<id>.webp

    python3 scripts/art-ingest.py            # every raw image whose id is in art/prompts.json
    python3 scripts/art-ingest.py warden     # just these

Works the same for images rendered by scripts/art-generate.py and ones made elsewhere (e.g. Midjourney)
from the same prompts: name the file after the asset id and drop it in art/raw/.

  figure    the chroma-key screen (green, or the asset's "screen") is keyed out (flood fill from the edges), the figure is cropped to its
            silhouette with its feet on the bottom edge, and it is scaled down to FIG_H pixels tall (bosses keep
            their native height)
  backdrop  cover-cropped to the 1080x1920 portrait world
  cardart   cover-cropped square, 512px
  texture   512px square
A contact sheet of everything ingested is written to art/contact-sheet.png for review.
"""

import json
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
PROMPTS = ROOT / "art" / "prompts.json"
RAW = ROOT / "art" / "raw"
OUT = ROOT / "apps" / "game" / "src" / "art" / "painted"
FIG_H = 960  # duel staging: a normal foe stands ~560 world px, ~600 device px on a DPR-3 phone
BOSSES = {"king", "wyrm"}  # bosses stand ~1.4x taller: keep their native height
QUALITY = {"figure": 84, "backdrop": 78, "cardart": 80, "texture": 78}


def raw_file(asset_id: str) -> Path | None:
    for ext in ("png", "jpg", "jpeg", "webp"):
        p = RAW / f"{asset_id}.{ext}"
        if p.exists():
            return p
    return None


def cover(img: Image.Image, w: int, h: int) -> Image.Image:
    s = max(w / img.width, h / img.height)
    img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x, y = (img.width - w) // 2, (img.height - h) // 2
    return img.crop((x, y, x + w, y + h))


def flood(passable: np.ndarray, seeds: list[tuple[int, int]]) -> np.ndarray:
    """Pixels reachable from the seeds through passable pixels (4-connected)."""
    h, w = passable.shape
    seen = np.zeros((h, w), bool)
    q = deque(seeds)
    while q:
        y, x = q.popleft()
        if seen[y, x] or not passable[y, x]:
            continue
        seen[y, x] = True
        if y > 0:
            q.append((y - 1, x))
        if y < h - 1:
            q.append((y + 1, x))
        if x > 0:
            q.append((y, x - 1))
        if x < w - 1:
            q.append((y, x + 1))
    return seen


def screen_ratio(rgb: np.ndarray, screen: str) -> np.ndarray:
    """How strongly each pixel leans toward the chroma-key screen, 0..1, independent of brightness, so the
    screen's glow behind a figure and its dark vignette corners key out alike."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    if screen == "magenta":
        return np.clip((np.minimum(r, b) - g) / (np.maximum(r, b) + 1), 0, 1)
    return np.clip((g - np.maximum(r, b)) / (g + 1), 0, 1)


def key_out(img: Image.Image, screen: str, lo: float = 0.10, hi: float = 0.22) -> Image.Image:
    """Remove the chroma-key screen connected to the image edges; soft-edged alpha and edge despill."""
    rgb = np.asarray(img.convert("RGB")).astype(np.float32)
    h, w, _ = rgb.shape
    ratio = screen_ratio(rgb, screen)
    edges = [(0, x) for x in range(w)] + [(h - 1, x) for x in range(w)] + [(y, 0) for y in range(h)] + [(y, w - 1) for y in range(h)]
    seen = flood(ratio >= lo, edges)
    alpha = np.ones((h, w), np.float32)
    alpha[seen] = 1 - np.clip((ratio[seen] - lo) / (hi - lo), 0, 1)
    # Strong screen colour enclosed by the figure (between legs, under an arm) is screen too.
    inner = ~seen & (ratio >= 2 * hi)
    alpha[inner] = 0
    # Vignette corners and stray specks: keep only what connects to the centred figure (opaque pixels in the
    # middle column band).
    solid = alpha > 0.1
    mid = [(y, x) for y in range(h) for x in range(int(w * 0.45), int(w * 0.55)) if alpha[y, x] > 0.9]
    if mid:
        alpha[~flood(solid, mid)] = 0
    a = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    # Despill near the cut edge: remove the screen colour's excess over the other channel(s).
    edge = np.asarray(a.filter(ImageFilter.MinFilter(9))) < 255
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    if screen == "magenta":
        spill = np.where(edge, np.maximum(0, np.minimum(r, b) - g), 0)
        rgb[..., 0], rgb[..., 2] = r - spill, b - spill
    else:
        rgb[..., 1] = g - np.where(edge, np.maximum(0, g - np.maximum(r, b)), 0)
    out = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))
    out.putalpha(a)
    return out


def fit_figure(img: Image.Image, screen: str, boss: bool) -> Image.Image:
    cut = key_out(img, screen)
    box = cut.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
    if not box:
        raise ValueError("nothing left after keying out the background")
    cut = cut.crop(box)
    if boss or cut.height <= FIG_H:
        return cut
    s = FIG_H / cut.height
    return cut.resize((max(1, round(cut.width * s)), FIG_H), Image.LANCZOS)


def ingest(asset: dict) -> Path | None:
    src = raw_file(asset["id"])
    if not src:
        return None
    img = Image.open(src)
    kind = asset["kind"]
    if kind == "figure":
        img = fit_figure(img, asset.get("screen", "green"), asset["id"] in BOSSES)
    elif kind == "backdrop":
        img = cover(img.convert("RGB"), 1080, 1920)
    else:
        img = cover(img.convert("RGB"), 512, 512)
    OUT.mkdir(parents=True, exist_ok=True)
    dst = OUT / f"{asset['id']}.webp"
    img.save(dst, "WEBP", quality=QUALITY[kind], method=6)
    return dst


def contact_sheet(paths: list[Path]) -> None:
    if not paths:
        return
    cell = 300
    cols = 6
    rows = (len(paths) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, rows * cell), (40, 34, 30))
    for i, p in enumerate(paths):
        im = Image.open(p).convert("RGBA")
        im.thumbnail((cell - 10, cell - 10))
        x, y = (i % cols) * cell + (cell - im.width) // 2, (i // cols) * cell + (cell - im.height) // 2
        sheet.paste(im, (x, y), im)
    sheet.save(ROOT / "art" / "contact-sheet.png")


def main() -> None:
    ids = set(sys.argv[1:])
    assets = json.loads(PROMPTS.read_text())["assets"]
    done, missing = [], []
    for a in assets:
        if ids and a["id"] not in ids:
            continue
        try:
            p = ingest(a)
        except ValueError as e:
            print(f"{a['id']}: {e}")
            continue
        (done if p else missing).append(p or a["id"])
    total = sum(p.stat().st_size for p in done)
    print(f"ingested {len(done)} ({total / 1e6:.2f} MB)" + (f"; no raw image yet for: {', '.join(missing)}" if missing else ""))
    contact_sheet(done)


if __name__ == "__main__":
    main()
