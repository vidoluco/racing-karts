#!/usr/bin/env python3
"""The other photos of Bâlea in the hand of the hero repaint (balea-gemini). Local, no network.
python3 -I tools/panoramas/transfagarasan-paint.py <photo> <out.jpg> <hero.jpg> <hero-ridge.json> [--crop x0,y0,x1,y1] [--bottom .84]

The photo's own shapes, nothing invented: smoothed along its edges, its Lab channels matched by histogram to the land of the repaint, so grass goes to the
repaint's olive and ochre and schist to its charcoal with no mask to go to camouflage; light gathered into soft steps, and a thin pen on the deepest lines.
Writes the out.jpg.ridge.json the recipe takes as ridge_hint."""
import argparse, json
import numpy as np, cv2

A = argparse.ArgumentParser()
A.add_argument('src'); A.add_argument('out'); A.add_argument('hero'); A.add_argument('hero_ridge')
A.add_argument('--crop', default='0,0,1,1'); A.add_argument('--scale', type=float, default=1.3); A.add_argument('--ridge', default=None)
A.add_argument('--steps', type=int, default=9); A.add_argument('--ink', type=float, default=0.62); A.add_argument('--bottom', type=float, default=1.0)
o = A.parse_args()

def read(p): return cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)
def lab(im): return cv2.cvtColor(im.astype(np.float32) / 255, cv2.COLOR_BGR2LAB)
def match(x, x_mask, ref):
    q = np.linspace(0.2, 99.8, 256)
    return np.interp(x, np.percentile(x[x_mask], q), np.percentile(ref, q))

hero = read(o.hero); Hh, Hw = hero.shape[:2]
ru, rv = zip(*json.load(open(o.hero_ridge)))
rr = np.interp(np.arange(Hw) / Hw, ru, rv) * Hh
hm = (np.arange(Hh)[:, None] > rr[None, :] + 8) & (np.arange(Hh)[:, None] < 0.7 * Hh)
hl = lab(cv2.bilateralFilter(hero, 0, 24, 5))

im = read(o.src); h, w = im.shape[:2]
x0, y0, x1, y1 = [float(v) for v in o.crop.split(',')]
im = im[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)]
im = cv2.resize(im, None, fx=o.scale, fy=o.scale, interpolation=cv2.INTER_CUBIC)
H, W = im.shape[:2]
ridge = json.load(open(o.ridge))
row = np.interp(np.arange(W) / (W - 1), [a for a, _ in ridge], [b for _, b in ridge]) * H
land = (np.arange(H)[:, None] > row[None, :] + 6)

s = cv2.edgePreservingFilter(im, flags=1, sigma_s=int(22 * o.scale), sigma_r=0.28)
s = cv2.bilateralFilter(s, 0, 26, 4 * o.scale)
L = lab(s)
out = np.zeros_like(L)
for c in range(3): out[..., c] = match(L[..., c], land, hl[..., c][hm])
# the light in soft steps, big forms stronger than grain: as the repaint's planes
l = out[..., 0] / 100
form = l - cv2.GaussianBlur(l, (0, 0), 60 * o.scale)
l = np.clip(l + 0.35 * form, 0, 1)
q = l * o.steps; b = np.floor(q); f = q - b
t = np.clip((f - 0.28) / 0.44, 0, 1); t = t * t * (3 - 2 * t)
out[..., 0] = cv2.GaussianBlur(((b + t) / o.steps).astype(np.float32), (0, 0), 0.6 * o.scale) * 100
res = cv2.cvtColor(out, cv2.COLOR_LAB2BGR)
# the pen
g = cv2.GaussianBlur(cv2.cvtColor(s, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255, (0, 0), 0.8 * o.scale)
dog = g - cv2.GaussianBlur(g, (0, 0), 3.0 * o.scale)
e = np.clip((-dog - 0.018) / 0.05, 0, 1) * o.ink
ink = np.array([36, 33, 31], np.float32) / 255
res = res * (1 - e[..., None]) + ink * e[..., None]
if o.bottom < 1:
    k = int(o.bottom * H); res = res[:k]; row = row / o.bottom * (H / H)
Ho = res.shape[0]
cv2.imencode('.jpg', (np.clip(res, 0, 1) * 255 + 0.5).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 92])[1].tofile(o.out)
json.dump([[round(i / (W - 1), 4), round(float(row[i] / H), 4)] for i in range(0, W, max(1, W // 240))], open(o.out + '.ridge.json', 'w'))
print(o.out, W, Ho)
