#!/usr/bin/env python3
"""A real photograph repainted by regions traced by hand: the shapes and the light are the photo's own, the colour of each kind of ground is told, not guessed.
python3 -I tools/paint-regions.py tools/panoramas/<recipe>.json

Why not planes(): on a mountain lit evenly under a haze its tones are noise, and cut into flat shapes they read as camouflage. Here each region runs the photo's
own broad light through one ramp, gathered softly into a few tones along the grain, so a lava flow stays one dark body and a forested ridge stays a forest with its spurs.
Output: a `painted: true` image for tools/compose-panorama.py, with its ridge. Recipe: { out: [{ id, file, crop, width_px, out, ridge, regions, ramps }] }.
A region: { ramp, poly: [[u, v], ...] in fractions of the whole photo, soft (px), lo, hi (percentiles of the photo's light inside it), gamma, air: [colour, amount], local, green: { ramp, from, to } }. Later over earlier."""
import json, os, sys
import numpy as np, cv2
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)


def apply_ramp(t, stops):
    cs = np.stack([hexrgb(c) for c in stops])
    xs = np.linspace(0, 1, len(stops))
    return np.stack([np.interp(t, xs, cs[:, k]) for k in range(3)], axis=-1).astype(np.float32)


def soft_tones(v, n, soft):
    """Gather a light into n tones: the steps stay, their edges are a soft brush and not a cut."""
    x = np.clip(v, 0, 1) * n
    i = np.floor(x)
    f = x - i
    w = np.clip((f - (0.5 - soft)) / max(2 * soft, 1e-3), 0, 1)
    return np.clip((i + w * w * (3 - 2 * w)) / n, 0, 1)


def paint(spec):
    src = spec['file']
    im = Image.open(os.path.join(ROOT, 'data/raw/backdrop-photos', spec['id'], src)).convert('RGB')
    W0, H0 = im.size
    x0, y0, x1, y1 = spec['crop']
    w = int(spec['width_px'])
    cropw = (x1 - x0) * W0
    h = int(round((y1 - y0) * H0 * w / cropw))
    rgb = np.asarray(im.crop((int(x0 * W0), int(y0 * H0), int(x1 * W0), int(y1 * H0))).resize((w, h), Image.LANCZOS), np.float32) / 255
    k = w / 4000
    uv = lambda p: [(p[0] - x0) / (x1 - x0) * w, (p[1] - y0) / (y1 - y0) * h]
    L = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)[..., 0] / 100
    # the true ridge: the strongest fall of light near the line traced by eye, and everything over it takes the tone under it, or the sky would run through the ramp
    us, vs = zip(*[uv(p) for p in spec['ridge']])
    trace = np.interp(np.arange(w, dtype=np.float32), us, vs)
    win = int(spec.get('ridge_win', 0.006) * h / (y1 - y0) * (y1 - y0))
    Ls = cv2.GaussianBlur(L, (0, 0), 1.0 * k)
    grad = np.zeros_like(Ls)
    grad[1:-1] = Ls[:-2] - Ls[2:]
    ridge = np.zeros(w, np.float32)
    for c in range(w):
        a, b = max(1, int(trace[c]) - win), min(h - 2, int(trace[c]) + win)
        ridge[c] = a + int(np.argmax(grad[a:b + 1, c]))
    # a wide window can catch a bright fleck under the crest: one column never disagrees with its neighbours
    ridge = np.array([np.median(ridge[max(0, c - 18):c + 19]) for c in range(w)], np.float32)
    ridge = cv2.GaussianBlur(ridge.reshape(1, -1), (0, 0), 1.6 * k)[0]
    for c in range(w):
        r = int(ridge[c] + 7 * k) + 1
        if r < h:
            rgb[:r, c] = rgb[min(h - 1, r + int(3 * k) + 1), c]
    L = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)[..., 0] / 100
    # the rock's grain, read with an edge keeping filter: flows and spurs stay, the speckle of houses and trees goes
    base = cv2.bilateralFilter(cv2.GaussianBlur(L, (0, 0), 1.2 * k), int(9 * k) | 1, 0.07, 5 * k)
    base = cv2.bilateralFilter(base, int(9 * k) | 1, 0.05, 5 * k)
    exg = cv2.GaussianBlur(rgb[..., 1] - 0.5 * (rgb[..., 0] + rgb[..., 2]), (0, 0), 3 * k)
    out = np.ones((h, w, 3), np.float32) * hexrgb('#808080')
    for R in spec['regions']:
        m8 = np.zeros((h, w), np.uint8)
        cv2.fillPoly(m8, [np.array([uv(p) for p in R['poly']], np.int32)], 255, lineType=cv2.LINE_AA)
        m = m8.astype(np.float32) / 255
        if R.get('soft'):
            m = cv2.GaussianBlur(m, (0, 0), R['soft'] * k)
        inside = m8 > 128
        lo, hi = np.percentile(base[inside], [R.get('lo', 2), R.get('hi', 98)])
        v = np.clip((base - lo) / max(hi - lo, 1e-3), 0, 1)
        if R.get('local'):
            broad = cv2.GaussianBlur(base, (0, 0), 70 * k)
            v = np.clip(v + R['local'] * (base - broad) / max(hi - lo, 1e-3), 0, 1)
        v = v ** R.get('gamma', 1.0)
        t = soft_tones(v, R.get('tones', 6), R.get('step_soft', 0.3))
        col = apply_ramp(t, R['ramps']) if 'ramps' in R else apply_ramp(t, spec['ramps'][R['ramp']])
        if R.get('green'):
            G = R['green']
            g = np.clip((exg - G['from']) / max(G['to'] - G['from'], 1e-3), 0, 1)
            g = cv2.GaussianBlur(g, (0, 0), 2.5 * k)[..., None]
            col = col * (1 - g) + apply_ramp(t, spec['ramps'][G['ramp']]) * g
        if R.get('flat'):
            # still water: the far shore's dark reflection, a pale band of sky on it, faint streaks. The photo's own light is noise on a hazy lake
            F = R['flat']
            ys = np.arange(h, dtype=np.float32)[:, None] / h
            tt = np.clip((ys - F['from']) / max(F['to'] - F['from'], 1e-3), 0, 1)
            cs = np.stack([hexrgb(c) for c in F['colors']])
            xs = np.linspace(0, 1, len(cs))
            col = np.stack([np.interp(tt, xs, cs[:, q]) for q in range(3)], axis=-1).astype(np.float32).repeat(w, axis=1)
            rng = np.random.default_rng(3)
            st = cv2.GaussianBlur(rng.random((h, w), dtype=np.float32), (0, 0), sigmaX=60 * k, sigmaY=1.2 * k)
            col = col * (1 + F.get('streak', 0.5) * (st - st.mean())[..., None] / max(float(st.std()), 1e-3) * 0.12)
        if R.get('air'):
            c, a = R['air']
            col = col * (1 - a) + hexrgb(c) * a
        # a faint trace of the photo's fine light, so that big shapes do not read as felt
        fine = L - cv2.GaussianBlur(L, (0, 0), 4 * k)
        col = col * (1 + R.get('detail', 0.35) * np.clip(fine, -0.2, 0.2)[..., None])
        out = out * (1 - m[..., None]) + col * m[..., None]
    # the pen: thin, broken, only in the deepest gullies
    pen = spec.get('pen', 0)
    if pen:
        gr = cv2.GaussianBlur(L, (0, 0), 1.6 * k) - cv2.GaussianBlur(L, (0, 0), 6 * k)
        line = np.clip((-gr - 0.035) / 0.03, 0, 1) * cv2.GaussianBlur(np.random.default_rng(5).random((h, w), dtype=np.float32), (0, 0), 7 * k) * 2
        out = out * (1 - pen * np.clip(line, 0, 1)[..., None])
    path = os.path.join(ROOT, 'data/raw/backdrop-photos', spec['out'])
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)).save(path, quality=93, subsampling=0)
    step = max(1, w // 400)
    json.dump([[round(float(c / w), 4), round(float(ridge[c] / h), 4)] for c in range(0, w, step)] + [[1.0, round(float(ridge[-1] / h), 4)]], open(path + '.ridge.json', 'w'))
    print(path, w, h)


if __name__ == '__main__':
    for s in json.load(open(sys.argv[1]))['out']:
        paint(s)
