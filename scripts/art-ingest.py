"""Fit painted images to the game: art/raw/<id>.(png|jpg|jpeg|webp) -> apps/game/src/art/painted/<id>.webp

    python3 scripts/art-ingest.py            # every raw image whose id is in art/prompts.json
    python3 scripts/art-ingest.py warden     # just these

Works the same for images rendered by scripts/art-generate.py and ones made elsewhere (e.g. Midjourney)
from the same prompts: name the file after the asset id and drop it in art/raw/.

  figure    the flat background is keyed out (flood fill from the edges), the figure is cropped to its
            silhouette with its feet on the bottom edge, and it is scaled to FIG_H pixels tall
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
FIG_H = 720
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


def key_out(img: Image.Image) -> Image.Image:
    """Remove a flat background connected to the image edges; soft-edged alpha."""
    rgb = np.asarray(img.convert("RGB")).astype(np.float32)
    h, w, _ = rgb.shape
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, axis=0)
    dist = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    spread = np.percentile(np.sqrt(((border - bg) ** 2).sum(axis=1)), 90)
    lo, hi = max(14.0, spread * 1.3), max(40.0, spread * 2.6)
    # Flood fill from every edge pixel through "background-like" pixels.
    seen = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        q.extend([(0, x), (h - 1, x)])
    for y in range(h):
        q.extend([(y, 0), (y, w - 1)])
    while q:
        y, x = q.popleft()
        if seen[y, x] or dist[y, x] > hi:
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
    alpha = np.ones((h, w), np.float32)
    ramp = np.clip((dist - lo) / (hi - lo), 0, 1)
    alpha[seen] = ramp[seen]
    a = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = img.convert("RGB")
    out.putalpha(a)
    return out


def fit_figure(img: Image.Image) -> Image.Image:
    cut = key_out(img)
    box = cut.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
    if not box:
        raise ValueError("nothing left after keying out the background")
    cut = cut.crop(box)
    s = FIG_H / cut.height
    return cut.resize((max(1, round(cut.width * s)), FIG_H), Image.LANCZOS)


def ingest(asset: dict) -> Path | None:
    src = raw_file(asset["id"])
    if not src:
        return None
    img = Image.open(src)
    kind = asset["kind"]
    if kind == "figure":
        img = fit_figure(img)
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
