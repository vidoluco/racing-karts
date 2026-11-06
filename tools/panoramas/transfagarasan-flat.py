#!/usr/bin/env python3
"""The paintings and photos of Bâlea brought to one flat hand, the hand of the hero repaint. Local, no network.
python3 -I tools/panoramas/transfagarasan-flat.py grade <painting> <out.jpg> <hero.jpg> <hero-ridge.json> [--k .8] [--bottom .84]
python3 -I tools/panoramas/transfagarasan-flat.py flat <photo> <out.jpg> <hero.jpg> <hero-ridge.json> [--crop x0,y0,x1,y1]
python3 -I tools/panoramas/transfagarasan-flat.py lift <painting> <out.jpg>

grade: a painting of another hour (Summit Descent's carpazi.jpg, golden and pink), its Lab channels moved by histogram toward the land of the hero; nothing redrawn.
flat: a real photo, its shapes kept but all its fine texture melted into a few big flat masses (mean shift, median), then the hero's colours and a thin pen on the big edges only.
lift: the hero itself, a little brighter and more colourful, as friendly as the track round it."""
import argparse, json
import numpy as np, cv2

A = argparse.ArgumentParser()
A.add_argument('mode'); A.add_argument('src'); A.add_argument('out'); A.add_argument('hero', nargs='?'); A.add_argument('hero_ridge', nargs='?')
A.add_argument('--k', type=float, default=0.8); A.add_argument('--crop', default='0,0,1,1'); A.add_argument('--ink', type=float, default=0.35)
A.add_argument('--work', type=int, default=1898); A.add_argument('--lift', type=float, default=1.06); A.add_argument('--sat', type=float, default=1.28)
o = A.parse_args()

def read(p): return cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)
def lab(im): return cv2.cvtColor(im.astype(np.float32) / 255, cv2.COLOR_BGR2LAB)
def bgr(L): return np.clip(cv2.cvtColor(L, cv2.COLOR_LAB2BGR), 0, 1)
def write(p, f):
    cv2.imencode('.jpg', (f * 255 + 0.5).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 94])[1].tofile(p)
    print(p, f.shape[1], f.shape[0])
def lift(L):
    L = L.copy(); L[..., 0] = np.clip(100 * (L[..., 0] / 100) ** (1 / o.lift), 0, 100); L[..., 1] *= o.sat; L[..., 2] *= o.sat
    return L
def match(x, ref, mask=None):
    q = np.linspace(0.3, 99.7, 256); s = x if mask is None else x[mask]
    return np.interp(x, np.percentile(s, q), np.percentile(ref, q))
def hero_land():
    hero = read(o.hero); Hh, Hw = hero.shape[:2]
    ru, rv = zip(*json.load(open(o.hero_ridge)))
    rr = np.interp(np.arange(Hw) / Hw, ru, rv) * Hh
    m = (np.arange(Hh)[:, None] > rr[None, :] + 8) & (np.arange(Hh)[:, None] < 0.7 * Hh)
    return lift(lab(cv2.bilateralFilter(hero, 0, 24, 5)))[m]

im = read(o.src)
if o.mode == 'lift':
    write(o.out, bgr(lift(lab(im))))
elif o.mode == 'grade':
    ref, L = hero_land(), lab(im)
    res = L.copy()
    for c in range(3): res[..., c] = L[..., c] * (1 - o.k) + match(L[..., c], ref[:, c]) * o.k
    # the pink of its golden hour goes to the hero's olive and ochre
    res[..., 1] = np.where(res[..., 1] > 0, res[..., 1] * 0.45, res[..., 1])
    # its teal air over the plain and its dark firs stay as they are: graded they go to a grey that reads as a sea
    w = np.clip((-L[..., 1] - 1) / 7, 0, 1)[..., None]; res = res * (1 - w) + L * w
    # the plain in the V: pale teal air, by chroma and only inside the V, or it reads as a grey sea
    h, w = res.shape[:2]; U, V = np.meshgrid(np.linspace(0, 1, w, dtype=np.float32), np.linspace(0, 1, h, dtype=np.float32))
    box = np.clip((U - 0.40) / 0.04, 0, 1) * np.clip((0.80 - U) / 0.04, 0, 1) * np.clip((0.55 - V) / 0.06, 0, 1)
    air = box * np.clip((14 - np.hypot(res[..., 1], res[..., 2])) / 6, 0, 1) * 0.8
    air = cv2.GaussianBlur(air, (0, 0), 3)[..., None]
    res = res * (1 - air) + np.array([74, -8, -3], np.float32) * air
    write(o.out, bgr(lift(res)))
else:
    h, w = im.shape[:2]; x0, y0, x1, y1 = [float(v) for v in o.crop.split(',')]
    im = im[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)]
    f = o.work / im.shape[1]; s = cv2.resize(im, None, fx=f, fy=f, interpolation=cv2.INTER_AREA)
    # melt the texture: gravel and grass blades go, the big masses stay
    s = cv2.medianBlur(s, 5); s = cv2.pyrMeanShiftFiltering(s, 7, 16); s = cv2.medianBlur(s, 3)
    ref, L = hero_land(), lab(s); res = L.copy()
    for c in range(3): res[..., c] = match(L[..., c], ref[:, c])
    # soft edges between the masses, then the pen on the big edges only
    res[..., 0] = cv2.GaussianBlur(res[..., 0], (0, 0), 0.8)
    out = bgr(res)
    g = cv2.GaussianBlur(res[..., 0] / 100, (0, 0), 2.0); dog = g - cv2.GaussianBlur(g, (0, 0), 7.0)
    e = np.clip((-dog - 0.022) / 0.05, 0, 1); e = cv2.GaussianBlur(e, (0, 0), 0.7) * o.ink
    pen = np.array([40, 36, 34], np.float32) / 255
    write(o.out, out * (1 - e[..., None]) + pen * e[..., None])
