#!/usr/bin/env python3
"""Generates Ender's original procedural paper texture (docs/ART_SPEC.md §Paper).

1024×1024, 8-bit grayscale, tileable, deterministic (seed 1127). Pure Python, no deps.

Encoding: value = 0.5 + 0.5 * (0.035·L + 0.020·S) / 0.055, where L is the large-fibre
field and S the small-fibre field, each in [-1, 1]. The material decodes
offset = (tex − 0.5) · 2 · 0.055 and applies it to albedo brightness, so the spec's
amplitudes (large 0.035, small 0.020) are exact at full weight. Sample it in world
space (anchored, never screen space) so it cannot swim with the camera.

    python3 game/Tools/Art/generate_paper_grain.py game/Content/Materials/Source/T_PaperGrain.png
"""
import math
import random
import struct
import sys
import zlib

N = 1024
LARGE_AMP, SMALL_AMP = 0.035, 0.020


def periodic_value_noise(n, cells, rng):
    """Smooth tileable value noise in [-1, 1] on an n×n grid with `cells` lattice cells per side."""
    lattice = [[rng.uniform(-1, 1) for _ in range(cells)] for _ in range(cells)]
    out = [0.0] * (n * n)
    step = cells / n
    for y in range(n):
        fy = y * step
        y0 = int(fy) % cells
        y1 = (y0 + 1) % cells
        ty = fy - int(fy)
        ty = ty * ty * (3 - 2 * ty)
        row0, row1 = lattice[y0], lattice[y1]
        base = y * n
        for x in range(n):
            fx = x * step
            x0 = int(fx) % cells
            x1 = (x0 + 1) % cells
            tx = fx - int(fx)
            tx = tx * tx * (3 - 2 * tx)
            a = row0[x0] + (row0[x1] - row0[x0]) * tx
            b = row1[x0] + (row1[x1] - row1[x0]) * tx
            out[base + x] = a + (b - a) * ty
    return out


def fibres(n, count, length, width, rng):
    """Short wrapped strokes at random orientations, accumulated then normalised to [-1, 1]."""
    acc = [0.0] * (n * n)
    for _ in range(count):
        cx, cy = rng.uniform(0, n), rng.uniform(0, n)
        ang = rng.uniform(0, math.pi)
        dx, dy = math.cos(ang), math.sin(ang)
        ln = length * rng.uniform(0.5, 1.5)
        strength = rng.uniform(0.4, 1.0) * (1 if rng.random() < 0.7 else -1)  # mostly raised, some pressed
        steps = int(ln)
        for s in range(steps):
            t = s - steps / 2
            # Gentle curl so fibres aren't ruler-straight.
            curl = math.sin(s / max(1.0, ln) * math.pi) * width
            px = cx + dx * t - dy * curl
            py = cy + dy * t + dx * curl
            fade = math.sin(math.pi * s / steps)
            for w in range(-int(width), int(width) + 1):
                qx = int(px - dy * w) % n
                qy = int(py + dx * w) % n
                falloff = 1.0 - abs(w) / (width + 1)
                acc[qy * n + qx] += strength * fade * falloff
    return soft_normalise(acc)


def box_blur_wrap(img, n, r):
    """Separable wrapped box blur, softens fibres into paper rather than scratches."""
    tmp = [0.0] * (n * n)
    k = 2 * r + 1
    for y in range(n):
        base = y * n
        s = sum(img[base + (x % n)] for x in range(-r, r + 1))
        for x in range(n):
            tmp[base + x] = s / k
            s += img[base + (x + r + 1) % n] - img[base + (x - r) % n]
    out = [0.0] * (n * n)
    for x in range(n):
        s = sum(tmp[(y % n) * n + x] for y in range(-r, r + 1))
        for y in range(n):
            out[y * n + x] = s / k
            s += tmp[((y + r + 1) % n) * n + x] - tmp[((y - r) % n) * n + x]
    return out


def normalise(v):
    peak = max(1e-9, max(abs(x) for x in v))
    return [x / peak for x in v]


def soft_normalise(v, pct=0.995):
    """Scale so the 99.5th-percentile magnitude maps to 1, then clamp: overlaps can't flatten the rest."""
    mags = sorted(abs(x) for x in v)
    ref = max(1e-9, mags[int(pct * (len(mags) - 1))])
    return [max(-1.0, min(1.0, x / ref)) for x in v]


def write_png_gray(path, n, pixels):
    raw = b"".join(b"\x00" + bytes(pixels[y * n:(y + 1) * n]) for y in range(n))

    def chunk(kind, data):
        c = struct.pack(">I", len(data)) + kind + data
        return c + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", n, n, 8, 0, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "T_PaperGrain.png"
    rng = random.Random(1127)
    # Large field: long soft fibres over broad cloudiness (sizing and pulp density).
    cloud = periodic_value_noise(N, 6, rng)
    long_fibres = box_blur_wrap(fibres(N, 1400, 110, 2.0, rng), N, 1)
    large = soft_normalise([0.35 * c + 0.65 * f for c, f in zip(cloud, long_fibres)])
    # Small field: dense short fibres and fine tooth.
    tooth = periodic_value_noise(N, 256, rng)
    short_fibres = fibres(N, 16000, 22, 1.0, rng)
    small = soft_normalise([0.25 * t + 0.75 * f for t, f in zip(tooth, short_fibres)])

    total = LARGE_AMP + SMALL_AMP
    pixels = []
    for l, s in zip(large, small):
        v = 0.5 + 0.5 * (LARGE_AMP * l + SMALL_AMP * s) / total
        pixels.append(max(0, min(255, int(round(v * 255)))))
    write_png_gray(out, N, pixels)
    print(f"wrote {out} ({N}x{N}, mean {sum(pixels) / len(pixels):.1f})")


if __name__ == "__main__":
    main()
