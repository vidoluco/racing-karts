#!/usr/bin/env python3
# The painted forest of the Agung repaint, cut along its own tree line, laid all round the circle over the composed tiles: what stands in front of every direction is the painting's own hand, in place of the procedural belts.
# Run after compose-panorama.py: python3 -I tools/panoramas/bali-forest.py <tiles dir> [--check strip.jpg]
# Six mirrored copies, so it closes on itself with no seam; the row of a pixel depends only on its bearing, so the tiles agree where they overlap.
import argparse, os
import numpy as np, cv2

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PPD, TILE_W, TILE_H, TOP_TAN, BOTTOM_TAN = 30, 1860, 1121, 0.6, -0.052
CENTERS = [0, 60, 120, 180, 240, 300]
OFFSET = 7.6  # a mirror axis every 60 deg from here, so Agung (37.6) stands over the middle of a copy, never over an axis
# how high the tree line stands, degrees over the horizon: [bearing, half width, lift]. Low before the cone, a long wooded ridge across the south and west, as the real skyline has
BASE = 1.5
RISES = [(38, 40, -0.5), (345, 26, 0.9), (100, 16, 1.3), (180, 30, 1.0), (232, 34, 1.5), (285, 22, 0.8)]


def forest_cut():
    """The forest below its tree line, RGBA, the painting's own pixels, scaled to one copy of the circle."""
    img = cv2.imread(os.path.join(ROOT, 'data/raw/backdrop-photos/agung-gemini/agung.jpg'))
    H, W = img.shape[:2]
    y0 = int(0.54 * H)
    band = img[y0:int(0.985 * H)].astype(np.int32)
    b, g, r = band[..., 0], band[..., 1], band[..., 2]
    green = ((g - r > 16) & (g - b > 8)).astype(np.uint8)
    green = cv2.morphologyEx(green, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    ink = cv2.dilate(green, np.ones((5, 5), np.uint8)) & (band.sum(-1) < 240).astype(np.uint8)
    keep = green | ink
    # the body of the forest: solid under the first row where a real mass starts, the fronds above it stay one by one
    mass = cv2.morphologyEx(keep, cv2.MORPH_OPEN, np.ones((13, 13), np.uint8))
    body = np.maximum.accumulate(mass, axis=0)
    # fronds only near the mass: a stray green speck out in the mist goes
    near = cv2.dilate(body, np.ones((61, 21), np.uint8))
    alpha = np.maximum(body, keep & near).astype(np.float32)
    alpha = cv2.GaussianBlur(alpha, (0, 0), 0.8)
    line = np.argmax(mass, axis=0).astype(np.float32)
    top = float(np.median(line[line > 0]))  # the row that sits at the line's height
    w = int(round(60 * PPD))
    s = w / W
    h = int(round(band.shape[0] * s))
    rgb = (band.astype(np.float32) * alpha[..., None])
    rgb = cv2.resize(rgb, (w, h), interpolation=cv2.INTER_AREA)
    a = cv2.resize(alpha, (w, h), interpolation=cv2.INTER_AREA)
    return rgb, a, top * s


def circle(rgb, a):
    rows = []
    for arr in (rgb, a):
        rows.append(np.concatenate([arr if i % 2 == 0 else arr[:, ::-1] for i in range(6)], axis=1))
    return rows


def lift(bearing):
    """Degrees over the horizon of the tree line at this bearing, smooth and periodic."""
    out = np.full(bearing.shape, BASE, np.float32)
    for c, hw, by in RISES:
        d = np.abs(((bearing - c + 180) % 360) - 180) / hw
        out += by * np.where(d < 1, 0.5 + 0.5 * np.cos(np.pi * d), 0)
    # slow swell of the wooded land, whole cycles only so that it closes
    th = np.radians(bearing)
    return out + 0.22 * np.sin(5 * th + 1.1) + 0.14 * np.sin(11 * th + 0.4) + 0.08 * np.sin(23 * th + 2.0)


def lay(tile, center, RGB, A, top):
    """Over one tile. Rows are linear in tan(elevation), as the panels are."""
    H, W = tile.shape[:2]
    hz = TOP_TAN / (TOP_TAN - BOTTOM_TAN) * H
    per_deg = H / (TOP_TAN - BOTTOM_TAN) * np.pi / 180
    bearing = (center + (np.arange(W) + 0.5) / W * 62 - 31) % 360
    cols = ((bearing - OFFSET) % 360 * PPD).astype(int) % RGB.shape[1]
    row0 = hz - lift(bearing) * per_deg  # the tile row of the tree line per column
    out = tile.astype(np.float32).copy()
    n = RGB.shape[0]
    for x in range(W):
        y0 = int(row0[x] - top)
        ys = np.arange(max(0, y0), H)
        sy = np.minimum(ys - y0, n - 1)
        al = A[sy, cols[x]][:, None]
        out[ys, x] = out[ys, x] * (1 - al) + RGB[sy, cols[x]]
    return np.clip(out, 0, 255).astype(np.uint8)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('dir')
    ap.add_argument('--check')
    ap.add_argument('--quality', type=int, default=90)
    x = ap.parse_args()
    rgb, a, top = forest_cut()
    RGB, A = circle(rgb, a)
    for c in CENTERS:
        f = os.path.join(x.dir, f'bali-pano-{c:03d}.jpg')
        t = cv2.imread(f)
        assert t.shape[:2] == (TILE_H, TILE_W), t.shape
        cv2.imwrite(f, lay(t, c, RGB, A, top), [cv2.IMWRITE_JPEG_QUALITY, x.quality])
    if x.check:
        s = np.clip(RGB[:, :3600] + 255 * (1 - A[:, :3600, None]), 0, 255).astype(np.uint8)
        cv2.imwrite(x.check, cv2.resize(s, (1400, int(s.shape[0] * 1400 / s.shape[1]))))
