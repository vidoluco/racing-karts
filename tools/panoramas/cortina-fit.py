#!/usr/bin/env python3
"""The Tofane repaint is a winter view with the bell tower in front of it. This takes the tower off (the rock either side, moved across, the 3D tower is the real one) and turns the snow under the tree line to the gold of October: same shapes, same flat colours, snow only as a first dusting on the high ledges.
python3 -I tools/panoramas/cortina-fit.py. Writes data/raw/backdrop-photos/cortina-tofane-gemini/cortina-tofane-autumn.jpg. Local, no network."""
import os

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
D = os.path.join(ROOT, 'data/raw/backdrop-photos/cortina-tofane-gemini')
a = np.array(Image.open(os.path.join(D, 'cortina-tofane.jpg')).convert('RGB'), np.float32) / 255.0
h, w = a.shape[:2]


def sm(p, q, x):
    t = np.clip((x - p) / (q - p), 0, 1)
    return t * t * (3 - 2 * t)


# the tower: the columns it stands in, mirrored in from both sides, soft where the two meet
x0, x1, y0, y1 = int(0.232 * w), int(0.32 * w), int(0.2 * h), int(0.86 * h)
out = a.copy()
shift = x1 - x0 + 12
for x in range(x0, x1):
    # the face to the right of the tower, moved across: a mirror shows as a mirror
    out[y0:y1, x] = a[y0:y1, x + shift]
# melt it in at the top so that no edge shows on the rock
m = np.zeros((h, w), np.float32)
m[y0:y1, x0:x1] = 1
m = cv2.GaussianBlur(m, (0, 0), 12)[..., None]
out = a * (1 - m) + out * m
out[y0 + 40:y1, x0:x1] = cv2.GaussianBlur(out, (0, 0), 2.2)[y0 + 40:y1, x0:x1]

# autumn under the tree line
Y = (np.arange(h, dtype=np.float32) / h)[:, None]
hsv = cv2.cvtColor(out, cv2.COLOR_RGB2HSV)
sat, val = hsv[..., 1], hsv[..., 2]
snow = sm(0.62, 0.86, val) * (1 - sm(0.16, 0.34, sat))
below = sm(0.36, 0.5, Y)
low = cv2.GaussianBlur(val, (0, 0), 3)
gold = np.stack([np.interp(low, [0.5, 0.75, 1.0], c) for c in ([0.66, 0.8, 0.88], [0.46, 0.6, 0.7], [0.26, 0.33, 0.4])], axis=-1)
k = (snow * below)[..., None]
out = out * (1 - k) + gold.astype(np.float32) * k
# the blue dark of the winter forest towards the spruce of the other paintings, and larch among it
forest = (1 - sm(0.3, 0.55, val)) * sm(0.42, 0.6, Y)
tint = out * np.array([1.02, 1.0, 0.92], np.float32)
out = out * (1 - forest[..., None]) + tint * forest[..., None]
Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(os.path.join(D, 'cortina-tofane-autumn.jpg'), quality=94)
