#!/usr/bin/env python3
# The caldera rim on the bearings the hero repaint does not reach: the real skyline from batur-paint.py, taken down to two or three flat mauve tones in the repaint's own colours, so it stays a faint layer behind the painting and adds no hand of its own.
# Run from the repo root: python3 -I tools/panoramas/batur-farrim.py
import json
import numpy as np, cv2
im = cv2.imread('data/raw/backdrop-photos/batur-dem-paint/caldera.jpg')
im = cv2.bilateralFilter(cv2.GaussianBlur(im, (0, 0), 9), 21, 60, 21)
L = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
lo, hi = np.percentile(L, [8, 92])
s = np.clip((L - lo) / (hi - lo), 0, 1)
s = cv2.GaussianBlur(s, (0, 0), 6)
stops = [(0, '#8d7690'), (0.5, '#a9879c'), (1, '#cda39e')]
rgb = lambda h: [int(h[5:7], 16), int(h[3:5], 16), int(h[1:3], 16)]
# above the ridge the same flat tone, so the ridge can be raised where it dips behind the end of the repaint
R = np.array(json.load(open('tools/panoramas/batur-caldera-ridge.json')))
H, W = s.shape
u = (np.arange(W) + .5) / W
r = (np.interp(u, R[:, 0], R[:, 1]) * H).astype(int) + 6
for x in range(W):
    s[:r[x], x] = s[min(H - 1, r[x]), x]
# the rim of the repaint stands at 12 deg where it ends: the real skyline's dip there is lifted so that the rim runs on behind it
hy = np.radians(240) / (W / H)  # tan per image height
top = float(R[np.argmin(np.abs(R[:, 0] - 0.48846)), 1])
el = lambda v: np.degrees(np.arctan((top - v) * hy + np.tan(np.radians(12.5))))
ev = lambda d: top - (np.tan(np.radians(d)) - np.tan(np.radians(12.5))) / hy
b = 55.4 + (R[:, 0] - 0.48846) * 240
target = np.interp(b, [-40, -22, -8, 12, 24], [0, 7.2, 8.6, 9.2, 5])
v2 = np.where(target > 0, np.minimum(R[:, 1], ev(target)), R[:, 1])
json.dump([[round(float(a), 5), round(float(c), 5)] for a, c in zip(R[:, 0], v2)], open('tools/panoramas/batur-rimfar-ridge.json', 'w'))
out = np.stack([np.interp(s, [q[0] for q in stops], [rgb(q[1])[i] for q in stops]) for i in range(3)], -1)
cv2.imwrite('data/raw/backdrop-photos/batur-gemini-fit/rim-far.jpg', np.clip(out, 0, 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 93])
