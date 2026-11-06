#!/usr/bin/env python3
"""A real photograph repainted as a cartoon of the same mountains at another hour: the shapes are the photo's own, nothing is invented.
python3 -I tools/paint-toon.py <in.jpg> <out.jpg> [--crop x0,y0,x1,y1] [--scale 1.7] [--hint recipe.json:file_in_recipe] [--ramps name]

Used for the sides of a panorama where no hand repaint exists, so that they sit next to one. Three colour ramps, chosen per pixel by what the
photo says is there (excess green is grass, pale and grey is snow, the rest is rock), run over the photo's own light after the overcast is
taken out of it and its tones are gathered into flat planes. Crests take the first sun; the pen follows the photo's dark lines."""
import argparse, json
import numpy as np, cv2

RAMPS = {
    # Bâlea as the photos have it, late morning in summer: dark grey schist, grey scree, muted green grass, cold shade. Read off 02.09.2025 Balea-See and Baleasee
    'balea_day': {
        'grass': ['#2c4436', '#3e5a3e', '#566f44', '#6f8450', '#8d9a5c', '#b0b06e'],
        'rock': ['#2b2f38', '#40444c', '#5a5c60', '#777775', '#96948c', '#b9b5a8', '#dcd8ca'],
        'snow': ['#a8b8cc', '#d4dee8', '#f0f4f6', '#ffffff'],
        'glow': '#fff2dc', 'ink': '#1e2228',
    },
    # read off the hand repaint of the Stoschmidt photo (balea-gemini): olive and ochre grass, charcoal schist, grey scree, a clean sky
    'balea_hero': {
        'grass': ['#454a2c', '#5f6133', '#7d7a3e', '#9a8f48', '#b4a258', '#cdb878'],
        'rock': ['#2b2d2f', '#3c3f40', '#4f5150', '#6a6a64', '#838179', '#9c9a8e', '#bdb9aa'],
        'snow': ['#9fb2c4', '#c8d4dc', '#e8ecee', '#fbfbf8'],
        'glow': '#fff0d8', 'ink': '#1f2124',
    },
    # sampled from Summit Descent's repaint of Bâlea (docs/backdrops-howto.md): rose rock, olive and gold grass, lilac shade
    'balea': {
        'grass': ['#5e7a6c', '#7a8f74', '#97986a', '#aea262', '#c2b068', '#d6c27c'],
        'rock': ['#8a7694', '#a98a9e', '#c99aa0', '#e2ac9e', '#f2c0aa', '#fad6c0'],
        'snow': ['#b4a8cc', '#dccfe0', '#f8ece6', '#fff8f2'],
        'glow': '#ffb49a', 'ink': '#3a2f46',
    },
}

def rgb(h): return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255
def ramp(t, names):
    c = np.stack([rgb(n) for n in names]); x = np.linspace(0, 1, len(names))
    return np.stack([np.interp(t, x, c[:, k]) for k in range(3)], -1).astype(np.float32)
def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
def blur(a, s): return cv2.GaussianBlur(a, (0, 0), s)

def paint(src, crop, scale, hint, R, levels=6, glow=0.55, ink=0.5, flat=0.75, sm=1.0, sky_l=0.6):
    h, w = src.shape[:2]
    x0, y0, x1, y1 = crop
    src = src[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)]
    src = cv2.resize(src, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    H, W = src.shape[:2]
    # flat planes that keep the photo's edges
    k = sm * scale
    s = cv2.edgePreservingFilter(src, flags=1, sigma_s=int(40 * k), sigma_r=0.3)
    s = cv2.bilateralFilter(s, 0, 30, 6 * k)
    f = s.astype(np.float32) / 255
    b, g, r = f[..., 0], f[..., 1], f[..., 2]
    L = 0.3 * r + 0.59 * g + 0.11 * b
    V, Mi = f.max(-1), f.min(-1)
    sat = (V - Mi) / (V + 1e-3)
    # what is there: little patches of either go, the painter works in big shapes
    exg = (g - np.maximum(r, b)) / (V + 1e-3)
    warm = (r - b) / (V + 1e-3)
    grass = sstep(0.0, 0.07, blur(exg, 3 * k))
    grass = np.maximum(grass, sstep(0.16, 0.34, blur(warm, 3 * k)) * sstep(-0.12, 0.0, blur(g - r, 3 * k)))
    sz = int(9 * k) | 1
    el = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (sz, sz))
    grass = cv2.morphologyEx(cv2.morphologyEx(grass.astype(np.float32), cv2.MORPH_CLOSE, el), cv2.MORPH_OPEN, el)
    grass = blur(grass, 1.4 * k)
    snow = sstep(0.68, 0.8, L) * (1 - sstep(0.1, 0.2, sat))
    snow = blur(snow, 0.8 * k)
    # the overcast out, and the big forms up: light at the scale of a spur and a gully carries the picture, the grain of the grass goes
    form = blur(L, 7 * k) - blur(L, 70 * k)
    det = L - blur(L, 7 * k)
    def tone(mask, gain_det):
        lo = form + gain_det * det
        m = mask > 0.5
        a, z = np.percentile(lo[m], [2, 98]) if m.sum() > 500 else (lo.min(), lo.max())
        t = np.clip((lo - a) / (z - a + 1e-4), 0, 1)
        q = t * lev; base = np.floor(q); fr = q - base
        return blur(((base + sstep(soft, 1 - soft, fr)) / lev).astype(np.float32), 0.7 * k)
    # grass in long soft gradients, rock in hard planes
    lev, soft = 3, 0.12
    tg = tone(grass, 0.2)
    lev, soft = levels, 0.3
    tr = tone(1 - grass, flat)
    col = ramp(tr, R['rock'])
    col = col * (1 - grass[..., None]) + ramp(tg, R['grass']) * grass[..., None]
    col = col * (1 - snow[..., None]) + ramp(np.clip((L - 0.55) / 0.4, 0, 1), R['snow']) * snow[..., None]
    # the sky, flooded down from the top of the picture: its lower edge is the true ridge, and it leaves no fringe
    open_sky = ((L > sky_l) & (sat < 0.22)) | ((b > g + 0.05) & (b > r + 0.1) & (L > 0.42))
    open_sky = cv2.morphologyEx(open_sky.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab = cv2.connectedComponents(open_sky, connectivity=4)
    top = np.unique(lab[0][lab[0] > 0])
    flood = np.isin(lab, top)
    row = np.where(flood.all(0), H - 1, (~flood).argmax(0)).astype(np.float32)
    # where the flood leaked down a pale gully the ridge stays where it was: narrow dips in it go
    wide = np.ones((1, int(30 * scale) | 1), np.uint8)
    row = cv2.dilate(cv2.erode(row.reshape(1, -1), wide), wide).ravel()
    row = cv2.GaussianBlur(row.reshape(1, -1), (0, 0), 1.5).ravel()
    # a sketched ridge, when there is one, is how low the flood may go
    if hint is not None:
        row = np.minimum(row, np.interp(np.arange(W, dtype=np.float32) / W, hint[:, 0], hint[:, 1]) * H + 0.012 * H)
        row = cv2.GaussianBlur(row.astype(np.float32).reshape(1, -1), (0, 0), 1.5).ravel()
    ridge = np.stack([np.arange(W, dtype=np.float32) / (W - 1), row / H], 1)
    rows = np.arange(H, dtype=np.float32)[:, None]
    col[(rows < row[None, :] + 2) | (flood & (rows < row[None, :] + 0.04 * H))] = rgb(R['rock'][2])
    # the crests take the first sun
    if True:
        d = (np.arange(H, dtype=np.float32)[:, None] - row[None, :]) / H
        sun = np.exp(-np.maximum(d, 0) / 0.09) * glow
        col = col * (1 - sun[..., None] * 0.55) + (col * rgb(R['glow']) * 1.5) * sun[..., None] * 0.55
    # the pen: the photo's dark lines, thin
    fine = cv2.GaussianBlur(cv2.cvtColor(src, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255, (0, 0), 0.9 * scale)
    dog = fine - blur(fine, 3.2 * scale)
    line = sstep(0.03, 0.09, -blur(dog, 0.5 * scale)) * ink * (1 - 0.65 * grass) * ~flood
    col = col * (1 - line[..., None]) + rgb(R['ink']) * line[..., None]
    return (np.clip(col, 0, 1)[..., ::-1] * 255 + 0.5).astype(np.uint8), ridge

if __name__ == '__main__':
    A = argparse.ArgumentParser()
    A.add_argument('src'); A.add_argument('out')
    A.add_argument('--crop', default='0,0,1,1'); A.add_argument('--scale', type=float, default=1.7)
    A.add_argument('--hint'); A.add_argument('--ramps', default='balea')
    A.add_argument('--glow', type=float, default=0.55); A.add_argument('--ink', type=float, default=0.5)
    A.add_argument('--sky', type=float, default=0.6); A.add_argument('--levels', type=int, default=6); A.add_argument('--flat', type=float, default=0.75); A.add_argument('--sm', type=float, default=1.0)
    o = A.parse_args()
    img = cv2.imdecode(np.fromfile(o.src, np.uint8), cv2.IMREAD_COLOR)
    if img is None: raise SystemExit(f'cannot read {o.src}')
    hint = None
    if o.hint:
        path, key = o.hint.split(':')
        ph = [p for p in json.load(open(path, encoding='utf8'))['photos'] if key in (p['id'], p['file'])][0]
        hint = np.array(ph['ridge_sketch'], np.float32)
    res, ridge = paint(img, [float(v) for v in o.crop.split(',')], o.scale, hint, RAMPS[o.ramps], levels=o.levels, glow=o.glow, ink=o.ink, flat=o.flat, sm=o.sm, sky_l=o.sky)
    ok, buf = cv2.imencode('.jpg', res, [cv2.IMWRITE_JPEG_QUALITY, 92])
    buf.tofile(o.out)
    # the ridge it found, as ridge_hint for the recipe
    json.dump([[round(float(a), 4), round(float(b), 4)] for a, b in ridge[:: max(1, len(ridge) // 240)]], open(o.out + '.ridge.json', 'w'))
    print(o.out, res.shape[1], 'x', res.shape[0])
