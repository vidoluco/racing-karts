#!/usr/bin/env python3
"""The two great mountains of antelao, painted locally from the real photos, in the same plain language as the 3D world: flat soft planes of a few tones,
no pen, the air of the distance read off the photo itself. No redraw of any shape: every ridge, ledge, gully and scree fan is where the photo has it.
python3 -I tools/panoramas/antelao-paint.py [pelmo] [antelao]
Writes data/raw/backdrop-photos/antelao-soft/<name>.jpg and tools/panoramas/antelao[-pelmo]-ridge.json. Local, no network."""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
PH = os.path.join(ROOT, 'data/raw/backdrop-photos')


def hexrgb(h):
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (1, 3, 5)], np.float32)


def ramp(x, stops):
    xs = [s[0] for s in stops]
    cs = np.stack([hexrgb(s[1]) for s in stops])
    return np.stack([np.interp(x, xs, cs[:, k]) for k in range(3)], axis=-1).astype(np.float32)


def sm(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def noise(h, w, s, seed):
    r = np.random.default_rng(seed)
    n = r.random((int(h / s) + 3, int(w / s) + 3), dtype=np.float32)
    return cv2.resize(n, (w, h), interpolation=cv2.INTER_CUBIC)


# the rock of the hour: blue mauve shade, warm limestone in the light. Less pink than the old repaint: real Dolomite rock at five in the afternoon
ROCK = [[0, '#343f5a'], [0.14, '#4c5270'], [0.3, '#6b6780'], [0.46, '#8f7d88'], [0.62, '#b4958b'], [0.78, '#d9b294'], [0.9, '#efcfa8'], [1, '#fae6c8']]
SPRUCE = [[0, '#141f2b'], [0.35, '#1d2d37'], [0.7, '#2a3f47'], [1, '#3e5659']]
LARCH = [[0, '#4a3226'], [0.5, '#855031'], [1, '#c07a38']]
AIR = '#8c93b8'


def flat(lum, tones, soft):
    """Soft edged flat tones: the same shape of light as a toon ramp on the 3D rock."""
    x = np.clip(lum, 0, 1) * tones
    f = np.floor(x)
    return (f + sm(0.5 - soft, 0.5 + soft, x - f)) / tones


def land_paint(rgb, ridge_px, tones, tree_v, far_blue, gamma, lo, hi, seed, larch_gain, clahe=2.0, veg_l=(0.56, 0.68), far_box=None):
    h, w = rgb.shape[:2]
    # flat shapes along the rock's own edges: no lines to draw afterwards, the planes meet each other
    flatrgb = cv2.pyrMeanShiftFiltering(rgb[:, :, ::-1], 6, 13, maxLevel=1)[:, :, ::-1]
    flatrgb = cv2.bilateralFilter(flatrgb, 0, 12, 2)
    lab = cv2.cvtColor(flatrgb.astype(np.float32) / 255.0, cv2.COLOR_RGB2LAB)
    L, A, B = lab[..., 0] / 100.0, lab[..., 1], lab[..., 2]
    land = (np.arange(h, dtype=np.float32)[:, None] >= ridge_px[None, :]).astype(np.float32)
    Lo, Hi = np.percentile(L[land > 0.5], [lo, hi])
    x = np.clip((L - Lo) / (Hi - Lo), 0, 1) ** gamma
    # the form inside the shade: a hollow in shadow keeps its ledges, or it reads as a flat stain
    cl = cv2.createCLAHE(clipLimit=clahe, tileGridSize=(8, 8)).apply((x * 255).astype(np.uint8)).astype(np.float32) / 255.0
    x = x * 0.45 + cl * 0.55
    # rock and scree
    col = ramp(flat(x, tones, 0.2), ROCK)
    # uneven: big soft stains across the face, so no two planes of one tone are the same colour and the face stops being an even field of facets
    st = noise(h, w, w / 40.0, seed) * 0.6 + noise(h, w, w / 130.0, seed + 1) * 0.4
    col = col * (0.9 + 0.2 * st[..., None])
    # forest: dark and under the tree line. Green or shaded rock above that line stays rock, a bright fan under it stays scree: that is what breaks the forest
    Y = np.arange(h, dtype=np.float32)[:, None]
    tl = np.interp((np.arange(w, dtype=np.float32) + 0.5) / w, *zip(*tree_v)).astype(np.float32) * h
    tl = tl + (noise(1, w, w / 60.0, seed + 2)[0] - 0.5) * h * 0.03 + (noise(1, w, w / 240.0, seed + 5)[0] - 0.5) * h * 0.02
    under = sm(0.0, h * 0.012, Y - tl[None, :])
    veg = under * (1 - sm(veg_l[0], veg_l[1], L))
    veg = cv2.GaussianBlur(veg, (0, 0), 1.2)
    gold = sm(4.0, 16.0, B) * sm(0.0, 8.0, A + 3)
    tex = noise(h, w, 3.2, seed + 3) * 0.55 + noise(h, w, 8.0, seed + 4) * 0.45
    fl = np.clip(L * 1.5 + (tex - 0.5) * 0.55, 0, 1)
    fc = ramp(flat(fl, 5, 0.2), SPRUCE)
    fg = ramp(flat(np.clip(L * 1.5 + (tex - 0.5) * 0.7, 0, 1), 4, 0.2), LARCH)
    f = fc * (1 - (gold * larch_gain)[..., None]) + fg * (gold * larch_gain)[..., None]
    col = col * (1 - veg[..., None]) + f * veg[..., None]
    # the air: the far ranges behind the mountain go pale and flat, the ridge behind the ridge. far_box [u0, v1]: right of u0 and over row v1
    if far_box:
        U = (np.arange(w, dtype=np.float32) + 0.5)[None, :] / w
        hz = sm(far_box[0] - 0.015, far_box[0] + 0.015, U) * (1 - sm(far_box[1] - 0.02, far_box[1] + 0.02, Y / h)) * far_blue
        col = col * (1 - hz[..., None]) + hexrgb(AIR) * hz[..., None]
    return np.clip(col, 0, 1), veg


def run(name, src, out, ridge_json, width, trace, **kw):
    rgb = np.asarray(Image.open(src).convert('RGB'), np.uint8)
    H0, W0 = rgb.shape[:2]
    if width != W0:
        rgb = cv2.resize(rgb, (width, int(round(H0 * width / W0))), interpolation=cv2.INTER_AREA if width < W0 else cv2.INTER_CUBIC)
    h, w = rgb.shape[:2]
    # the ridge: blue sky down to the first thing that is not sky, in Lab, per column; the summit row comes from it, so it has to be good
    lab = cv2.GaussianBlur(cv2.cvtColor(rgb.astype(np.float32) / 255.0, cv2.COLOR_RGB2LAB), (0, 0), 1.0)
    d, start = 3, trace.get('start', 0.02)
    grow = np.linalg.norm(lab[d:] - lab[:-d], axis=2)
    brk = trace.get('brk', 7.0)
    r = np.zeros(w, np.float32)
    s0 = int(start * h)
    for x in range(w):
        col = grow[s0:, x]
        hit = np.argmax(col > brk) if (col > brk).any() else col.size - 1
        r[x] = s0 + hit + d * 0.5
    # a column that misses comes back from its neighbours
    k = int(w * 0.004) | 1
    pad = np.pad(r, k, mode='edge')
    med = np.median(np.lib.stride_tricks.sliding_window_view(pad, k), axis=1)[k // 2 + 1:][:w]
    r = np.where(np.abs(r - med) > h * 0.012, med, r).astype(np.float32)
    col, veg = land_paint(rgb, r, **kw)
    Y = np.arange(h, dtype=np.float32)[:, None]
    a = np.clip(Y - r[None, :] + 0.5, 0, 1)[..., None]
    sky = np.asarray(rgb, np.float32) / 255.0
    res = sky * (1 - a) + col * a
    Image.fromarray((res * 255).astype(np.uint8)).save(out, quality=93)
    us = (np.arange(0, w, max(1, w // 1200)) + 0.5) / w
    pts = [[round(float(u), 5), round(float(r[int(u * w)] / h), 5)] for u in us]
    json.dump(pts, open(ridge_json, 'w'))
    print(name, 'size', w, h, 'apex', int(np.argmin(r)), round(float(r.min() / h), 3), file=sys.stderr)


which = sys.argv[1:] or ['pelmo', 'antelao']
OUT = os.path.join(PH, 'antelao-soft')
os.makedirs(OUT, exist_ok=True)
if 'pelmo' in which:
    # Villanova di Borca, the view this road has: the Pelmo with its throne and the Pelmetto apart on the right, behind a wooded ridge
    run('pelmo', os.path.join(PH, 'pelmo-villanova/Il_monte_Pelmo_da_Villanova_di_Borca_di_Cadore.jpg'), os.path.join(OUT, 'pelmo-soft.jpg'),
        os.path.join(ROOT, 'tools/panoramas/antelao-pelmo-ridge.json'), 2048, {'start': 0.2, 'brk': 6.0},
        tones=8, tree_v=[[0, 0.66], [0.2, 0.68], [0.5, 0.72], [1, 0.74]], far_blue=0.0, gamma=1.1, lo=2, hi=99.5, seed=7, larch_gain=0.7, clahe=3.0)
if 'antelao' in which:
    # San Vito: the single point, rock on the upper part only, pale gullies running down into the dark wood
    run('antelao', os.path.join(PH, 'antelao-sanvito/Monte_Antelao,_3264_m_und_San_Vito_di_Cadore.jpg'), os.path.join(OUT, 'antelao-soft.jpg'),
        os.path.join(ROOT, 'tools/panoramas/antelao-ridge.json'), 2880, {'start': 0.03, 'brk': 5.0},
        tones=8, tree_v=[[0, 0.40], [0.14, 0.42], [0.3, 0.43], [0.42, 0.43], [0.5, 0.41], [0.62, 0.36], [0.72, 0.36], [0.85, 0.40], [1, 0.42]], far_blue=0.55, far_box=[0.665, 0.355], gamma=1.05, lo=1, hi=99.5, seed=11, larch_gain=0.8, clahe=2.0)
