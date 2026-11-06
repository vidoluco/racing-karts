#!/usr/bin/env python3
# Puts the hero repaint on the real bearings and writes its ridge. Batur (55.4) and Abang (113.2) stand closer in degrees than the scale we give the cone would set them,
# so only the columns of the lake and the far low rim between them are squeezed: both silhouettes keep their proportions. Rows untouched.
# Its two ends stop in mid slope, so the rim and Abang's flank run on as flat paint, falling gently: never the slab of a picture's edge.
# Run from the repo root: python3 -I tools/panoramas/batur-fit.py  (prints the width and summit_u for batur-recipe.py)
import json, os, subprocess, sys, tempfile
import numpy as np, cv2
src = 'data/raw/backdrop-photos/batur-gemini/batur.jpg'
DEG_PER_PX = 0.04538  # the scale of the whole painting: the cone at 18 degrees
A, B = 0.55, 0.82     # the columns that may be squeezed, in fractions of the painting
im = cv2.imread(src); h, w = im.shape[:2]
# the ridge of the untouched painting, to find the two summits
tmp = tempfile.mkdtemp()
subprocess.run([sys.executable, '-I', 'tools/trace-ridge.py', src, f'{tmp}/r.json', '--points', '1400'], check=True, stdout=subprocess.DEVNULL)
R0 = np.array(json.load(open(f'{tmp}/r.json')))
def top(a, b):
    m = (R0[:, 0] > a) & (R0[:, 0] < b); return float(R0[m][np.argmin(R0[m, 1]), 0])
bat, aba = top(.3, .5), top(.8, 1)
want = (113.2 - 55.4) / DEG_PER_PX / w  # Abang from Batur, in fractions of the painting
K = 1 - (aba - bat - want) / (B - A)    # mean squeeze of the columns between A and B
print('K', round(K, 3))
xs = np.linspace(0, 1, 8001)
c, hw = (A + B) / 2, (B - A) / 2
prof = np.where((xs > A) & (xs < B), 1 - (np.abs(xs - c) / hw) ** 4, 0.0)  # no kink at its two ends
sp = 1 - prof * (1 - K) / (prof[(xs > A) & (xs < B)].mean())
out_of_in = np.concatenate([[0], np.cumsum(sp[:-1]) / 8000])  # position after the squeeze, of each column of the painting
n = int(round(out_of_in[-1] * w))
ix = np.interp((np.arange(n) + .5) / w, out_of_in, xs) * w - .5
mx, my = np.meshgrid(ix.astype(np.float32), np.arange(h, dtype=np.float32))
out = cv2.remap(im, mx, my, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
cv2.imwrite(f'{tmp}/fit.png', out)
subprocess.run([sys.executable, '-I', 'tools/trace-ridge.py', f'{tmp}/fit.png', f'{tmp}/f.json', '--points', '1000'], check=True, stdout=subprocess.DEVNULL)
R = np.array(json.load(open(f'{tmp}/f.json')))
# the run on: flat land tone down each column, taken from under the crest; the composer cuts it along the ridge
PAD_L, PAD_R = 440, 380
rr = (np.interp((np.arange(n) + .5) / n, R[:, 0], R[:, 1]) * h).astype(int)
def land_col(x):
    y = min(h - 1, rr[x] + 70)
    col = out[:, x].astype(np.float32).copy()
    col[:y] = np.median(out[y:y + 60, max(0, x - 40):x + 40].reshape(-1, 3), axis=0)
    return cv2.GaussianBlur(col[:, None, :], (1, 0), 0, sigmaY=22)[:, 0]
L, Rr = land_col(30), land_col(n - 30)
# the painting's left edge is the rim in its own shadow: the run on goes to the far rim's lit mauve (batur-farrim.py), so it stays far off
far = np.array([0x96, 0x7e, 0x9a], np.float32)  # BGR of #9a7e96
row = np.arange(h, dtype=np.float32)[:, None]
L = far * (1 - 0.18 * np.clip((row - rr[30]) / 300, 0, 1))
left = np.repeat(L[:, None], PAD_L, 1)
right = np.repeat(Rr[:, None], PAD_R, 1)
# join: the painting melts into the flat tone over 60 columns on each side
J = 150
o2 = out.astype(np.float32).copy()
tL = np.clip(1 - np.arange(J, dtype=np.float32) / J, 0, 1)[None, :, None]
for x in range(J):
    y = rr[x] + 4
    o2[y:, x] = o2[y:, x] * (1 - tL[0, x, 0]) + L[y:] * tL[0, x, 0]
    y = rr[n - 1 - x] + 4
    o2[y:, n - 1 - x] = o2[y:, n - 1 - x] * (1 - tL[0, x, 0]) + Rr[y:] * tL[0, x, 0]
final = np.clip(np.concatenate([left, o2, right], 1), 0, 255).astype(np.uint8)
os.makedirs('data/raw/backdrop-photos/batur-gemini-fit', exist_ok=True)
cv2.imwrite('data/raw/backdrop-photos/batur-gemini-fit/batur.jpg', final, [cv2.IMWRITE_JPEG_QUALITY, 96])
N = final.shape[1]
# the ridge: traced on the painting, then a long gentle fall on each run on, a little uneven
smooth = lambda t: t * t * (3 - 2 * t)
vL0, vR0 = float(R[3, 1]), float(R[-4, 1])
foot = 0.66  # row the left end comes down to, in fractions of the image
pts = []
for i in range(0, PAD_L, 6):
    t = 1 - i / PAD_L
    pts.append([i / N, vL0 + (foot - vL0) * smooth(t) + 0.004 * np.sin(i * 0.031) * t])
for u, v in R:
    pts.append([(PAD_L + u * n) / N, v])
for i in range(0, PAD_R, 6):
    t = i / PAD_R
    pts.append([(PAD_L + n + i) / N, vR0 + (0.70 - vR0) * smooth(t) + 0.004 * np.sin(i * 0.027) * t])
json.dump([[round(float(a), 5), round(float(b), 5)] for a, b in pts], open('tools/panoramas/batur-ridge.json', 'w'))
P = np.array(pts)
m = (P[:, 0] > .3) & (P[:, 0] < .55); su = float(P[m][np.argmin(P[m, 1]), 0]); sv = float(P[m][np.argmin(P[m, 1]), 1])
print('size', N, h, 'width', round(N * DEG_PER_PX, 1), 'summit_u', round(su, 5), 'summit_v', round(sv, 4), 'ends bearing', round(55.4 - su * N * DEG_PER_PX, 1), round(55.4 + (1 - su) * N * DEG_PER_PX, 1))
m = P[:, 0] > su + .2; print('abang_u', P[m][np.argmin(P[m, 1])], 'bearing', round(55.4 + (P[m][np.argmin(P[m, 1]), 0] - su) * N * DEG_PER_PX, 1))
