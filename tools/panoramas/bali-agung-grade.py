#!/usr/bin/env python3
# Regrades the hero repaint of Gunung Agung to what the Muncan and Bandem photos show: the cone smooth and hazy blue-brown, its hard inked gullies closed and replaced by fine ones, a dark forest belt on the lower flanks, the mist at its foot gone.
# python3 -I tools/panoramas/bali-agung-grade.py <agung.jpg> <ridge.json> <out.jpg>
import json, sys
import numpy as np, cv2

src, ridge_file, out = sys.argv[1:4]
img = cv2.imread(src).astype(np.float32)
H, W = img.shape[:2]
rng = np.random.default_rng(7)
ridge = np.array(json.load(open(ridge_file)), np.float32)
R = np.interp(np.arange(W) / W, ridge[:, 0], ridge[:, 1]) * H  # row of the ridge per column
ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
hexc = lambda h: np.array([int(h[5:7], 16), int(h[3:5], 16), int(h[1:3], 16)], np.float32)
smooth = lambda a, b, x: (lambda t: t * t * (3 - 2 * t))(np.clip((x - a) / (b - a), 0, 1))
noise = lambda sx, sy: cv2.resize(rng.random((max(2, H // sy + 2), max(2, W // sx + 2)), dtype=np.float32), (W, H), interpolation=cv2.INTER_CUBIC)

# where the cone is and where the painted forest already stands
b, g, r = img[..., 0], img[..., 1], img[..., 2]
green = ((g - r > 20) & (ys > 0.5 * H)).astype(np.uint8)
green = cv2.morphologyEx(green, cv2.MORPH_OPEN, np.ones((31, 31), np.uint8))
green = np.maximum.accumulate(green, axis=0).astype(np.float32)
green = cv2.GaussianBlur(green, (0, 0), 3)
cone = smooth(-1.5, 1.5, ys - R)

# the ink closed, the rest smoothed: what is left is the big form of the slope
closed = cv2.morphologyEx(img, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
closed = cv2.GaussianBlur(closed, (0, 0), 5)
L = cv2.cvtColor(np.clip(closed, 0, 255).astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
low = cv2.GaussianBlur(L, (0, 0), 70)
s = np.clip(0.5 + (L - low) * 1.25 + (low - 0.55) * 0.55, 0, 1)
stops = [(0.0, '#4c4c58'), (0.32, '#736a66'), (0.6, '#9a8876'), (0.82, '#b8a286'), (1.0, '#d8c19e')]
tone = np.stack([np.interp(s, [q[0] for q in stops], [hexc(q[1])[i] for q in stops]) for i in range(3)], -1).astype(np.float32)

# the fine gullies: thin lines that run out from the summit along the fall of the slope
sx = float(np.argmin(R)); sy = float(R.min())
theta = np.arctan2(xs - sx, ys - sy + 90) + 0.05 * (noise(180, 140) - 0.5) + 0.012 * (noise(40, 30) - 0.5)
line = rng.random(2400).astype(np.float32)
line = cv2.GaussianBlur(line[None, :], (0, 0), 1.1)[0]
g1 = np.interp(theta, np.linspace(-1.75, 1.75, 2400), line)
g1 = (g1 - g1.mean()) / (g1.std() + 1e-6)
up = np.clip((ys - R) / np.maximum(820 - R, 40), 0, 1)
tone *= (1 + 0.07 * np.clip(g1, -2, 2) * smooth(0.02, 0.2, up) * (1 - smooth(0.5, 0.75, up)))[..., None]

# air: cooler and paler toward the foot, where there is more of it
air = (0.14 + 0.2 * smooth(0.1, 0.8, up))[..., None]
tone = tone * (1 - air) + hexc('#a9c6de') * air

# the forest belt, its top wandering up the gullies and down the ribs, its mass in lumps of crown, paler with height
foot = 0.6 * H
belt_h = np.minimum(0.5 * (foot - R), 0.21 * H)
top = foot - belt_h + 44 * (noise(120, 90) - 0.5) + 24 * (noise(30, 24) - 0.5) - 13 * np.clip(g1, -1.5, 1.5)
beltA = smooth(-6, 7, ys - top)
crown = 0.55 * noise(14, 11) + 0.45 * noise(6, 5)
bt = np.clip((ys - top) / np.maximum(belt_h, 30), 0, 1)
belt = (hexc('#50716a')[None, None] * (1 - bt[..., None]) + hexc('#1d4630')[None, None] * bt[..., None]) * (0.78 + 0.44 * crown)[..., None]
out_img = tone * (1 - beltA[..., None]) + belt * beltA[..., None]
# a scrub of olive just above the belt, so it does not stop at a line
scrub = smooth(-46, 0, ys - top) * (1 - beltA) * 0.4
out_img = out_img * (1 - scrub[..., None]) + hexc('#6e7a62') * scrub[..., None]

mix = (cone * (1 - green))[..., None]
res = img * (1 - mix) + out_img * mix
cv2.imwrite(out, np.clip(res, 0, 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 94])
