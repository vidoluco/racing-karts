#!/usr/bin/env python3
"""The ridge of a hand repaint with a clean gradient sky, for a recipe's `ridge_file`. Local, no network.
python3 -I tools/trace-ridge.py <painting> <out.json> [--check out.jpg] [--from 0.05] [--break 9] [--points 688]

Walking down each column from the top: the first real break in the smooth sky, which is the pen on the crest. A pale crest that misses the pen
for a few columns comes back from its neighbours. Writes [[u, v], ...] in fractions of the whole image. --check draws the line on the painting: look at it.
"""
import argparse
import json

import cv2
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument('painting')
ap.add_argument('out')
ap.add_argument('--check', default=None)
ap.add_argument('--from', dest='start', type=float, default=0.05, help='rows above this fraction are surely sky')
ap.add_argument('--break', dest='brk', type=float, default=9.0, help='change in Lab over 4 rows that says the sky has ended')
ap.add_argument('--points', type=int, default=688)
ap.add_argument('--inset', type=float, default=1.5, help='px down from the first break, so no sky of the painting stays over the pen')
a = ap.parse_args()

im = np.asarray(Image.open(a.painting).convert('RGB'), dtype=np.float32) / 255.0
H, W = im.shape[:2]
lab = cv2.GaussianBlur(cv2.cvtColor(im, cv2.COLOR_RGB2LAB), (0, 0), 1.0)
d, start = 4, int(a.start * H)
diff = np.linalg.norm(lab[d:] - lab[:-d], axis=2)
r = np.zeros(W, np.float32)
for x in range(W):
    hit = np.nonzero(diff[start:, x] > a.brk)[0]
    r[x] = hit[0] + start + d * 0.5 if hit.size else H * 0.6
k = np.ones((1, 9), np.uint8)
closed = cv2.dilate(cv2.erode(r.reshape(1, -1), k), k)[0]
r = np.minimum(r, closed) + a.inset
n = a.points
pts = [[round((i + 0.5) / n, 5), round(float(np.min(r[int(i * W / n):max(int(i * W / n) + 1, int((i + 1) * W / n))])) / H, 5)] for i in range(n)]
json.dump(pts, open(a.out, 'w'))
print(f'summit at u {np.argmin(r) / W:.4f}, v {r.min() / H:.4f}')
if a.check:
    vis = (im * 255).astype(np.uint8)
    for x in range(W):
        vis[max(0, int(r[x]) - 1):int(r[x]) + 1, x] = (0, 255, 0)
    Image.fromarray(vis).save(a.check, quality=90)
