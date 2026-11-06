#!/usr/bin/env python3
"""Central Jakarta through its own haze, one closed panorama for tiles: python3 -I tools/panoramas/jakarta-paint.py [--preview p.jpg] [--out dir] [--quality q] [--check dir] [--no-tiles]

A city of towers sixty kilometres from its volcanoes is mostly air. tools/compose-panorama.py cuts its photos into flat shapes, which on a mountain
reads as rock and on a tower reads as a photo cut out with scissors, so this place has its own hand: every skyline is the real one from a photo, its
outline kept sharp and its inside melted into the air by distance, the way the same towers look from the Monas on a hot afternoon. Gede with Pangrango
and Salak are the real ridges traced from photos taken in the city, at their true bearings and as far away as they are: pale, soft and separate, with
the air at their feet. Nothing here is placed by a filter's mood: the bearings, the ridges and the skylines come from the photos, only the air is painted.
Everything here is seen from eye level, from the street: a line of rain trees, band behind band, and the towers standing up out of them, with the real skylines of two photos and the ones people point at, at their true bearings. A city seen from high up (the old hand repaint) behind a street camera read as a painted wall.
The painted Monas stands at its true bearing from Manggarai, and that bearing hardly moves along the kampung and Menteng half of the lap.
Next to the tiles: jakarta-hero-far.jpg, the same pixels with no Monas, shown (def showWithin) once the 3D monument is close enough to be the same size: there is only ever one Monas.
Prints the panels for def.backdrops on stdout."""
import argparse, json, math, os, sys
import numpy as np, cv2
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
PPD, TOP_TAN, BOT_TAN = 45, 0.6, -0.052
CENTER, ALT = (-6.2098, 106.8502), 12   # Manggarai: def.horizon.center
# read off the painting's own sky, at the elevations it stands at here
SKY = [(-8, '#f2cfa4'), (0, '#f2d0a6'), (6, '#f1d0a8'), (8.5, '#edd8ba'), (10, '#e6e3d0'), (12, '#d2e8e2'), (14, '#b6dce8'), (16, '#a8d5e8'), (24, '#80c6e6'), (40, '#5cb0e4'), (60, '#4aa4e2')]
HAZE = '#f1d3ae'
MIST = '#d2c6a6'
PHOTOS = 'data/raw/backdrop-photos'

# Traced by eye on the photos taken from the city, x in px of a 1800 px crop and y in px: where the photo shows a ridge through cloud, this is the ridge.
# Gede's side is on the left looking south, Pangrango the top of the massif in the middle of the photo.
PANGRANGO = {
    'name': 'Gunung Pangrango', 'lat': -6.7705, 'lon': 106.9636, 'altitude': 3019, 'elevation': 8.6, 'source': 'jk-gede',
    'ridge': [(120, 330), (240, 290), (350, 240), (400, 208), (470, 172), (535, 158), (590, 172), (630, 160), (680, 132), (735, 115), (800, 108), (860, 128), (905, 148), (960, 168), (1060, 186), (1140, 208), (1210, 236), (1290, 266), (1420, 298), (1600, 330)],
    'top': (800, 108), 'foot': 372, 'width': 33,
}
SALAK = {
    'name': 'Gunung Salak', 'lat': -6.7167, 'lon': 106.7333, 'altitude': 2211, 'elevation': 6.9, 'source': 'jk-salak',
    'ridge': [(180, 330), (290, 290), (380, 250), (500, 205), (600, 166), (680, 145), (760, 126), (830, 124), (880, 117), (930, 108), (965, 104), (1010, 118), (1070, 150), (1110, 180), (1190, 196), (1270, 218), (1400, 246), (1560, 272), (1760, 330)],
    'top': (965, 104), 'foot': 356, 'width': 26,
}
# The skylines, far to near. crop: of the photo, as the ridge traced in the recipe. x: the part of that crop used. horizon: where the city meets its roofs, in the crop. px: of the crop's own 2200 px width per degree. air: how far off.
CITY = [
    {'id': 'jk-gambir-east', 'file': 'View_of_Gambir_from_Monas,_December_2011.jpg', 'crop': (0.0, 0.2, 1.0, 0.37), 'x': (0.01, 0.99), 'horizon': 0.97, 'at': 12, 'px': 38, 'air': 0.58, 'fade': 6, 'seeds': (0.3, 0.97)},
    {'id': 'jk-banner', 'file': 'Central_Jakarta_banner_Thamrin-Sudirman.jpg', 'crop': (0.22, 0.03, 1, 0.5), 'x': (0.01, 0.99), 'horizon': 0.92, 'at': 276, 'px': 52, 'air': 0.34, 'fade': 5, 'seeds': (0.1, 0.98), 'skip': [(0.634, 0.672)]},
]

def hexrgb(h): return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255
def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
def blur(a, s): return cv2.GaussianBlur(a, (0, 0), float(s))
def bearing_to(a, b):
    la, lo, lb, lob = map(math.radians, (a[0], a[1], b[0], b[1]))
    y, x = math.sin(lob - lo) * math.cos(lb), math.cos(la) * math.sin(lb) - math.sin(la) * math.cos(lb) * math.cos(lob - lo)
    d = 2 * 6371000 * math.asin(math.sqrt(math.sin((lb - la) / 2) ** 2 + math.cos(la) * math.cos(lb) * math.sin((lob - lo) / 2) ** 2))
    return (math.degrees(math.atan2(y, x)) + 360) % 360, d
def fbm2(h, w, sx, sy, seed, oct=4):
    """2D value noise wrapping in x: sx, sy are the cell sizes in px of the first octave."""
    rng = np.random.default_rng(seed); out = np.zeros((h, w), np.float32); amp = 1.0; tot = 0.0
    for _ in range(oct):
        cw, ch = max(2, int(round(w / sx))), max(2, int(round(h / sy)))
        g = rng.random((ch + 2, cw)).astype(np.float32); g = np.hstack([g, g[:, :1]])
        out += amp * cv2.resize(g, (w, h), interpolation=cv2.INTER_CUBIC); tot += amp; amp *= 0.5; sx = max(2, sx / 2); sy = max(2, sy / 2)
    return out / tot

class Canvas:
    def __init__(self):
        self.W = 360 * PPD; self.ptan = PPD * 180 / math.pi
        self.H = int(round((TOP_TAN - BOT_TAN) * self.ptan))
        self.row_tan = TOP_TAN - np.arange(self.H, dtype=np.float32) / self.ptan
        self.row_el = np.degrees(np.arctan(self.row_tan))
        self.img = None
    def row_of(self, el): return (TOP_TAN - math.tan(math.radians(el))) * self.ptan
    # lay colour over the wrapped circle: a block at column x0, with an alpha
    def lay(self, x0, y0, col, a):
        h, w = a.shape[:2]; xs = (int(x0) + np.arange(w)) % self.W; y0 = int(y0)
        ya, yb = max(0, y0), min(self.H, y0 + h)
        if yb <= ya: return
        sub = self.img[ya:yb][:, xs]; A = a[ya - y0:yb - y0][..., None]
        C = col[ya - y0:yb - y0] if col.ndim == 3 else col
        self.img[ya:yb, xs] = sub * (1 - A) + C * A

def paint_sky(C):
    xs = np.array([e for e, _ in SKY], np.float32); cs = np.stack([hexrgb(c) for _, c in SKY])
    sky = np.stack([np.interp(C.row_el, xs, cs[:, k]) for k in range(3)], 1)[:, None, :].repeat(C.W, 1).astype(np.float32)
    b = np.arange(C.W, dtype=np.float32) / PPD
    da = np.abs(((b - 262 + 180) % 360) - 180)
    glow = np.exp(-(da / 55) ** 2)[None, :] * np.exp(-np.clip(C.row_el[:, None], 0, None) / 12)
    sky = sky * (1 - 0.5 * glow[..., None]) + hexrgb('#ffe6bc') * 0.5 * glow[..., None]
    C.img = sky
    # thin high streaks with no edge at all: the air over a tropical city
    n = fbm2(C.H, C.W, 900, 60, 21, 4); n2 = fbm2(C.H, C.W, 300, 30, 23, 3)
    el = C.row_el[:, None]
    m = sstep(0.54, 0.76, n * 0.8 + n2 * 0.3) * np.exp(-((el - 19) / 8.0) ** 2) * 0.42
    C.img = C.img * (1 - m[..., None]) + hexrgb('#fff4e8') * m[..., None]

def cumulus(C, b, el, size, seed):
    """A heap with no base line. Each lobe is a soft blob; noise tears the edge; the belly thins out into the air, because a cloud in haze has no underside to rule."""
    rng = np.random.default_rng(seed); k = 2     # worked at half size
    w, h = int(size * 2.5 * PPD / k), int(size * 1.35 * PPD / k)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32); f = np.zeros((h, w), np.float32)
    base = h * 0.8; lobes = int(16 + size * 2.2)
    for i in range(lobes):
        t = rng.random(); x = w * (0.1 + 0.8 * t); env = np.sin(math.pi * t) ** 0.8
        y = base - rng.random() ** 0.8 * env * h * 0.62; r = (0.06 + 0.11 * rng.random()) * w * (0.55 + 0.6 * env)
        f += np.exp(-(((xx - x) ** 2 + ((yy - y) * 1.1) ** 2) / (r * r)))
    n = fbm2(h, w, max(6, w / 9), max(6, w / 12), seed + 1, 4)
    f = f + (n - 0.5) * 1.1
    a = sstep(0.62, 0.86, f)
    belly = sstep(base + h * 0.1, base - h * 0.16, yy + (n - 0.5) * h * 0.26)
    a *= belly
    # lit from above and from the sun in the west
    soft = blur(f, 5)
    gy = soft - np.roll(soft, 10, axis=0); gx = soft - np.roll(soft, -9, axis=1)
    lit = sstep(-0.22, 0.34, gy * 1.0 + gx * 0.3)[..., None] * 0.72 + 0.28 * sstep(base, 0, yy)[..., None]
    lit = np.clip(lit, 0, 1)
    col = hexrgb('#c8c6d6') * (1 - lit) + hexrgb('#fff7ea') * lit
    a = cv2.resize(a, (w * k, h * k), interpolation=cv2.INTER_LINEAR); col = cv2.resize(col, (w * k, h * k), interpolation=cv2.INTER_LINEAR)
    C.lay(b * PPD - w * k / 2, C.row_of(el) - h * k * 0.8, col, a * 0.94)

def paint_clouds(C):
    rng = np.random.default_rng(77); placed = []
    tries = 0
    while len(placed) < 15 and tries < 400:
        tries += 1
        b = rng.random() * 360; el = 9 + rng.random() * 12; size = 3.4 + rng.random() ** 1.6 * 6
        if any(abs(((b - q[0] + 180) % 360) - 180) < 15 + q[2] for q in placed): continue
        # none over the volcanoes: the sky above them has to stay open for their outline
        if abs(((b - 178 + 180) % 360) - 180) < 30 and el < 15: continue
        placed.append((b, el, size))
    for i, (b, el, size) in enumerate(placed): cumulus(C, b, el, size, 300 + i * 7)

def volcano(C, V):
    bearing, dist = bearing_to(CENTER, (V['lat'], V['lon']))
    true_el = math.degrees(math.atan2(V['altitude'] - ALT, dist))
    tx, ty = V['top']; foot = V['foot']; pts = V['ridge']
    # the scale across: width of the massif from one end of the trace to the other; up: top of the trace to its elevation
    x0, x1 = pts[0][0], pts[-1][0]; pdeg = (x1 - x0) / V['width']; up = V['elevation'] / (foot - ty)
    bs = np.arange(int((bearing + (x0 - tx) / pdeg - 3) * PPD), int((bearing + (x1 - tx) / pdeg + 3) * PPD))
    deg = (bs / PPD - bearing) * pdeg + tx
    rid = np.interp(deg, [p[0] for p in pts], [p[1] for p in pts], left=foot, right=foot)
    rid = (foot - rid) * up   # elevation of the ridge over each column
    rid = blur(rid.astype(np.float32).reshape(1, -1), 0.17 * PPD)[0]
    # raised a touch so the smoothing does not take the top down from where it is declared
    rid *= V['elevation'] / rid.max()
    top_col = int(np.argmax(rid))
    H = C.row_of(-0.4); y0 = int(C.row_of(V['elevation'] + 1)); h = int(H - y0); w = len(bs)
    el = C.row_el[y0:y0 + h][:, None]; R = rid[None, :]
    px = 1 / PPD
    a = sstep(-1.2 * px, 1.2 * px, R - el)
    # the fall lines of an old volcano: soft and radial, gathered toward the top. Never contours.
    dx = ((bs / PPD) - bs[top_col] / PPD)[None, :]; t = np.clip(el / V['elevation'], 0, 1)
    u = dx / np.maximum(1 - t, 0.06)
    uu = (((u + 40) * 6) % 1023).astype(np.float32); vv = np.broadcast_to(t * 220, uu.shape).astype(np.float32)
    n = fbm2(256, 1024, 40, 200, 17 if V is PANGRANGO else 29, 3)
    fall = cv2.remap(n, uu, vv, cv2.INTER_LINEAR, borderMode=cv2.BORDER_WRAP)
    side = np.clip(dx / (V['width'] * 0.5), -1, 1)       # the sun is in the west, on the right looking south
    light = 0.5 + 0.16 * side + (fall - 0.5) * 0.28 + 0.08 * t
    light = np.clip(light, 0, 1)[..., None]
    col = hexrgb('#7f94ad') * (1 - light) + hexrgb('#b5c0c8') * light
    # the air eats the foot: nothing of a volcano sixty kilometres off is sharp below its shoulders
    air = (1 - sstep(0.5, V['elevation'] * 0.72, el))[..., None] * 0.92
    col = col * (1 - air) + hexrgb(HAZE) * air
    C.lay(bs[0], y0, col.astype(np.float32), a.astype(np.float32))
    return {'bearing': float(bs[top_col] / PPD), 'true_el': true_el, 'dist': dist, 'col': float(bs[top_col] / PPD), 'row': float(C.row_of(V['elevation']))}

def towers_far(C):
    """The city goes on beyond the photos: rows of far towers as air with an outline, thin toward the south so that the volcanoes stand clear."""
    for layer, (seed, air, hmax, step) in enumerate([(5, 0.8, 2.6, 0.9), (6, 0.68, 3.4, 1.3)]):
        rng = np.random.default_rng(seed); tone = hexrgb('#93a3b4') * (1 - air) + hexrgb(HAZE) * air
        b = 0.0
        H0 = int(C.row_of(0.1))
        while b < 360:
            w = 0.26 + rng.random() * 0.8; d = abs(((b - 178 + 180) % 360) - 180)
            south = sstep(16, 44, d) * 0.86 + 0.14
            # and thin where the start straight looks at the Monas (heading 324): the monument stands against the sky
            d2 = abs(((b - 324 + 180) % 360) - 180); south *= sstep(8, 26, d2) * 0.72 + 0.28
            cluster = 0.5 + 0.5 * math.sin(b * 0.11 + seed) * math.sin(b * 0.043 + seed * 2)
            h = (0.5 + rng.random() ** 2.2 * hmax * (0.35 + 0.65 * cluster)) * south
            x = int(b * PPD); y = int(C.row_of(h)); wp = int(w * PPD)
            shade = 1 - 0.06 * rng.random()
            xs = (x + np.arange(wp)) % C.W
            C.img[y:H0][:, xs] = tone * shade
            if rng.random() < 0.25:   # a crown or a mast
                xm = (x + wp // 2 + np.arange(max(2, wp // 5))) % C.W; C.img[int(C.row_of(h + 0.25 + rng.random() * 0.3)):y][:, xm] = tone * shade
            b += w + rng.random() * step

def city_photo(C, P, check=None):
    path = os.path.join(ROOT, PHOTOS, P['id'], P['file'])
    im = Image.open(path).convert('RGB'); W0, H0 = im.size; c = P['crop']
    im = im.crop((int(c[0] * W0), int(c[1] * H0), int(c[2] * W0), int(c[3] * H0)))
    w = 2200; h = int(im.height * w / im.width); a = np.asarray(im.resize((w, h), Image.LANCZOS))
    # the ridge: flood from sky and from land, then straighten what a shimmer has bitten
    m = np.zeros((h, w), np.int32); m[:max(2, int(h * P['seeds'][0]))] = 1; m[int(h * P['seeds'][1]):] = 2
    bgr = cv2.bilateralFilter(a[:, :, ::-1], 0, 14, 3)
    cv2.watershed(bgr, m)
    land = (m == 2).astype(np.uint8)
    land = cv2.morphologyEx(land, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    r = np.where(land.any(0), land.argmax(0), h - 1).astype(np.float32)
    r = cv2.medianBlur(r.reshape(1, -1), 5)[0]
    x0, x1 = int(P['x'][0] * w), int(P['x'][1] * w)
    hor = P['horizon'] * h
    for s0, s1 in P.get('skip', []):   # what is not the city: a mast, a billboard. The line goes across it and the air takes the rest
        i0, i1 = int(s0 * w), int(s1 * w); r[i0:i1] = np.median(r[max(0, i0 - 12):i0])
    if check:
        v = a.copy()
        for x in range(w): v[max(0, int(r[x]) - 2):int(r[x]) + 2, x] = (255, 0, 60)
        v[int(hor):int(hor) + 3, :] = (0, 255, 0); v[:, [x0, x1 - 1]] = (0, 255, 0)
        Image.fromarray(v).resize((1400, int(h * 1400 / w))).save(os.path.join(check, P['id'] + '.jpg'))
    # scaled to the canvas: px per degree of this crop against the canvas's own
    k = PPD / P['px']; W1 = int((x1 - x0) * k); H1 = int(hor * k)
    roi = a[:int(hor), x0:x1]
    # melt the inside into broad planes of light, keep the edges of buildings
    sm = roi.astype(np.uint8)
    for _ in range(3): sm = cv2.bilateralFilter(sm, 0, 26, 7)
    sm = cv2.resize(sm, (W1, H1), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    L = sm.mean(-1); blurL = blur(L, 30)
    # how a facade differs from its surroundings, not how bright the photo happened to be
    t = np.clip(0.5 + (L - blurL) * 1.5 + (blurL - np.median(blurL)) * 0.4, 0, 1)
    air = P['air']; dark, light = hexrgb('#587088'), hexrgb('#c4ccd0')
    hue = sm / np.maximum(L[..., None], 0.05)                                  # a trace of the photo's own colour stays in the tone
    col = (dark * (1 - t[..., None]) + light * t[..., None]) * (0.86 + 0.14 * np.clip(hue, 0.6, 1.5))
    col = col * (1 - air) + hexrgb(HAZE) * air
    # alpha from the ridge, on the canvas, sharp to a pixel; rows run to the horizon at the foot of the crop
    rr = cv2.resize(r[x0:x1].reshape(1, -1), (W1, 1), interpolation=cv2.INTER_AREA)[0] * k
    rows = np.arange(H1, dtype=np.float32)[:, None]
    al = sstep(-0.8, 0.8, rows - rr[None, :])
    # both sides thin into the air, and the feet go under the band of roofs
    f = P['fade'] * PPD; xs = np.arange(W1, dtype=np.float32)
    al *= sstep(0, f, xs)[None, :] * sstep(W1, W1 - f, xs)[None, :]
    foot = sstep(0, 0.28 * H1, H1 - rows)                                       # the air thickens toward the ground
    col = col * foot[..., None] + (col * 0.45 + hexrgb(HAZE) * 0.55) * (1 - foot[..., None])
    # the crop's foot sits on the horizon at elevation 0.5
    y0 = C.row_of(0.5) - H1
    C.lay(P['at'] * PPD - W1 / 2, y0, col.astype(np.float32), al.astype(np.float32))

def roofs(C):
    """The band every skyline stands in: thousands of small roofs and rain trees going off into the air. Real Jakarta from any height."""
    rng = np.random.default_rng(9); H = C.H
    ye = C.row_of(1.15); yb = C.row_of(-1.0)
    C.img[int(C.row_of(0.42)):] = hexrgb(MIST)
    n = int(360 * 26)
    tones = [hexrgb(q) for q in ('#b8765a', '#c58a64', '#a56a54', '#a39a8e', '#cfc6b0', '#8d9a7c', '#7f9272', '#aa7e62', '#d8cdb8')]
    order = rng.random(n).argsort()
    for i in order:
        b = rng.random() * C.W; e = rng.random(); y = ye + (yb - ye) * e ** 0.8
        w = int(5 + rng.random() * (14 + 26 * e)); h = int(2 + rng.random() * (5 + 14 * e)); kind = rng.integers(len(tones))
        air = 0.74 - 0.42 * e
        tone = tones[kind] * (1 - air) + hexrgb(HAZE) * air
        x = int(b); xs = (x + np.arange(w)) % C.W; yy = int(y)
        if kind in (5, 6):
            # a tree: a round crown
            r = max(3, w // 2); yy2, xx2 = np.ogrid[-r:r + 1, -r:r + 1]; m = (xx2 * xx2 + yy2 * yy2 * 1.3 <= r * r)
            ya = max(0, yy - r); sub = np.arange(x, x + 2 * r + 1) % C.W
            reg = C.img[ya:ya + m.shape[0]][:, sub]; reg[m[:reg.shape[0]]] = tone; C.img[ya:ya + m.shape[0], sub] = reg
        else:
            C.img[yy:yy + h, xs] = tone
            C.img[yy:yy + 1, xs] = tone * 0.9 + hexrgb(HAZE) * 0.1
    # and the air over the whole foot of the world
    el = C.row_el[:, None]; a = (sstep(1.9, 0.0, el) * 0.34)[..., None]
    C.img = C.img * (1 - a) + hexrgb(HAZE) * a


HERO_BEARING, HERO_EL = 325.5, 9.4   # the flame: at this bearing, at this elevation, exactly the size the 3D Monas has at 797 m, where the two change over
SHOW_R = 797
# The monument's true profile, half width and height in metres, the same as landmarks/jakarta.js: cup on a waist, slim shaft, flared look-out.
MONAS_PROFILE = [(15, 3.4), (13, 5), (13.4, 8), (16.5, 11.5), (21.5, 14.6), (25.5, 16.6), (26.8, 17.4), (26.8, 18.6), (24.4, 19), (10, 20.6), (5, 22.4), (4.55, 60), (4.15, 100), (3.95, 112.6), (5.2, 114), (6.7, 115.4), (6.7, 116.4), (5.6, 116.8), (3.2, 117.3), (2.5, 118.2)]
def paint_monas(C):
    k0 = math.tan(math.radians(HERO_EL)) * C.ptan / 132; ss = 3; k = k0 * ss
    w, h = int(2 * 30 * k) | 1, int(136 * k); xc = w // 2
    ys = (h - np.arange(h, dtype=np.float32) - 0.5) / k     # metres over the ground, by row
    hw = np.interp(ys, [p[1] for p in MONAS_PROFILE], [p[0] for p in MONAS_PROFILE], left=35, right=0)
    # the flame: fat at the belly, rugged, gathering to one point
    tf = np.clip((ys - 118.4) / 13.6, 0, 1); rng = np.random.default_rng(31)
    jag = np.interp(np.arange(h, dtype=np.float32), np.linspace(0, h, 60), 1 + (rng.random(60) - 0.5) * 0.5)
    flame = np.where(ys >= 118.2, np.clip(np.sin(np.pi * tf ** 0.55), 0, 1) ** 0.8 * 3.05 * (1 - tf * 0.24) * jag + 0.05, 0)
    hw = np.where(ys >= 118.2, flame, hw); hw = np.where(ys > 132, 0, hw)
    xx = (np.arange(w, dtype=np.float32) - xc)[None, :] / k
    al = sstep(0.2, -0.2, np.abs(xx) - hw[:, None]).astype(np.float32)
    # the sun is on the left looking north west: one lit face, one in shade, and a soft edge between them
    lit = sstep(1.0, -1.0, xx / np.maximum(hw[:, None], 0.5) * 2 + 0.5)
    stone = hexrgb('#b8ad9e')[None, None] * (1 - lit[..., None]) + hexrgb('#fbf5e6')[None, None] * lit[..., None]
    # under the lip of the cup it goes into shade, and the look-out throws a little on the shaft
    sh = np.ones_like(ys); sh = np.where((ys > 3.4) & (ys < 16.6), 0.66 + 0.34 * sstep(8, 16.6, ys), sh); sh = np.where((ys > 112.6) & (ys < 115.4), 0.74, sh)
    col = stone * sh[:, None, None]
    gold = np.stack([hexrgb('#c8922a') * (1 - lit[r0, :, None]) + hexrgb('#ffe07a') * lit[r0, :, None] for r0 in range(h)])
    col = np.where((ys >= 118.2)[:, None, None], gold, col).astype(np.float32)
    col = col * 0.86 + hexrgb(HAZE) * 0.14
    al2 = cv2.resize(al, (w // ss, h // ss), interpolation=cv2.INTER_AREA); col2 = cv2.resize(col, (w // ss, h // ss), interpolation=cv2.INTER_AREA)
    C.lay(HERO_BEARING * PPD - al2.shape[1] / 2, C.row_of(0) - al2.shape[0], col2, al2.astype(np.float32))

# Where the far towers really gather, as seen from Manggarai: bearing, half spread, share of height, how many.
CLUSTERS = [(292, 16, 1.0, 26), (250, 12, 0.9, 20), (205, 10, 0.72, 12), (328, 12, 0.5, 8), (35, 18, 0.55, 12), (98, 18, 0.5, 10), (140, 14, 0.4, 7)]
def tower_block(C, b, w, h, air, seed, crown=0, body=None):
    """One far tower from eye level: it stands up out of the trees, a lit face and a dark one, the air thickening toward its foot."""
    rng = np.random.default_rng(seed); wp = max(3, int(w * PPD)); H0 = C.row_of(0); y0 = int(C.row_of(h + {0: 0, 1: 0.7, 2: 1.0, 3: 0.9, 4: 1.2, 5: 1.4}[crown] * h / 6)); hp = int(H0 - y0)
    if hp < 2: return
    yy = np.arange(hp, dtype=np.float32); xs = (np.arange(wp, dtype=np.float32) + 0.5) / wp - 0.5
    rows_el = (H0 - (y0 + yy)) / C.ptan; rows_el = np.degrees(np.arctan(rows_el))[:, None]
    # the outline in elevation by column, from the crown
    top = np.full((wp,), float(h), np.float32); xn = xs + 0.5
    if crown == 1: top = np.where(np.abs(xs) < 0.28, h * 1.1, np.where(np.abs(xs) < 0.42, h * 1.05, h))
    elif crown == 2: top = np.where(np.abs(xs) < 0.05 + 0.4 / wp, h * 1.16, np.where(np.abs(xs) < 0.3, h * 1.04, h))
    elif crown == 3: top = h * (1 + 0.15 * xn)
    elif crown == 4: top = h * (1 + 0.2 * np.cos(np.clip(xn, 0, 1) * 1.36) ** 2)       # the nib
    elif crown == 5: top = np.where((np.abs(xs) < 0.46) & (((xs + 0.5) * 7 % 1) < 0.62), h * (1.14 - 0.3 * np.abs(xs)), h)    # the fins of a crown
    al = sstep(-0.6 / PPD, 0.6 / PPD, top[None, :] - rows_el).astype(np.float32)
    d = ((b - 262 + 180) % 360) - 180
    lit_left = d > 0    # looking along b, is the western sun on the left of the view
    side = sstep(0.1, -0.02, xs) if lit_left else sstep(-0.1, 0.02, xs)
    dk = body if body is not None else (hexrgb('#3f5468') if rng.random() < 0.68 else hexrgb('#a7a39c'))
    col = dk * (0.72 + 0.62 * side[None, :, None])
    # floors, hardly there, and the sky going down the glass
    fl = 1 + 0.05 * np.sign(np.sin(yy * 0.9 + rng.random() * 6))[:, None, None]; col = col * fl
    sky = sstep(0.3, 1.0, rows_el / max(h, 0.1))[..., None] * 0.18; col = col * (1 - sky) + hexrgb('#b7d3de') * sky
    a2 = np.clip(air + (1 - air) * sstep(h * 0.55, 0, rows_el) * 0.62, 0, 1)[..., None]
    col = col * (1 - a2) + hexrgb(HAZE) * a2
    C.lay(b * PPD - wp / 2, y0, col.astype(np.float32), al)
def far_towers(C):
    # thin toward the volcanoes, and none in front of the sky behind the Monas
    def room(b):
        d = abs(((b - 178 + 180) % 360) - 180); d2 = abs(((b - HERO_BEARING + 180) % 360) - 180)
        return (sstep(10, 30, d) * 0.9 + 0.1) * (sstep(3.0, 7.0, d2) * 0.9 + 0.1)
    # a low city all the way round, then the clusters, far to near
    rng = np.random.default_rng(5); b = 0.0
    while b < 360:
        w = 0.25 + rng.random() * 0.55; h = (1.7 + rng.random() ** 2 * 2.4) * room(b)
        tower_block(C, b, w, h, 0.78, int(b * 7) + 1); b += w + rng.random() * 1.3
    for layer, (air, hk, wk) in enumerate([(0.68, 0.62, 0.85), (0.46, 0.86, 1), (0.28, 1.0, 1.1)]):
        rng = np.random.default_rng(100 + layer)
        for (bc, spread, share, n) in CLUSTERS:
            for q in range(int(n * (1.2 - layer * 0.28))):
                b = bc + (rng.random() + rng.random() - 1) * spread; r = room(b)
                h = (2.4 + rng.random() ** 1.5 * 5.6) * share * hk * r; w = (0.34 + rng.random() * 0.62) * wk
                if h < 0.8: continue
                tower_block(C, b, w, h, air, 1000 * layer + int(b * 13) + q, crown=int(rng.choice([0, 0, 0, 1, 2, 3, 5])))
    # the ones people point at, at their true bearings from here
    for b, w, h, crown, body in [(296.5, 1.0, 6.6, 4, '#35607f'), (289.5, 1.5, 5.2, 5, '#1f2a33'), (283, 0.9, 7.2, 3, '#33566a'), (246.5, 0.8, 7.6, 2, '#2c4b60'), (251, 1.6, 4.8, 5, '#1f2a33'), (309, 0.9, 7.8, 2, '#2f5468')]:
        tower_block(C, b, w, h, 0.2, int(b * 3), crown=crown, body=hexrgb(body))

def tree_line(C):
    """Eye level: what a driver sees past the last street is the top of the next street's rain trees, band behind band, the towers standing up out of them."""
    H0 = C.row_of(0); xs_deg = np.arange(C.W, dtype=np.float32) / PPD
    d2 = np.abs(((xs_deg - HERO_BEARING + 180) % 360) - 180); dip = (sstep(1.6, 4.0, d2) * 0.72 + 0.28)
    for layer, (top, spread, air, n, seed, rmin, rmax) in enumerate([(0.9, 0.5, 0.62, 2600, 61, 7, 16), (1.45, 0.7, 0.42, 1800, 62, 9, 24), (2.05, 0.9, 0.24, 1200, 63, 14, 36)]):
        rng = np.random.default_rng(seed); p = np.zeros(C.W, np.float32)
        slow = fbm2(2, C.W, 700, 2, seed, 3)[0] * 1.6 - 0.3
        for i in range(n):
            x = rng.random() * C.W; r = rmin + rng.random() ** 2 * (rmax - rmin); hc = (top + (rng.random() - 0.5) * spread) * C.ptan * math.pi / 180 * slow[int(x) % C.W]
            xi = (int(x) + np.arange(-int(r), int(r) + 1)) % C.W; u = np.arange(-int(r), int(r) + 1, dtype=np.float32) / r
            p[xi] = np.maximum(p[xi], hc + np.sqrt(np.maximum(0, 1 - u * u)) * r * 0.62)
        p = np.maximum(p, top * 0.6 * C.ptan * math.pi / 180) * dip   # no slits of sky through the wood
        h = int(p.max()) + 4; y0 = int(H0) - h + 2; yy = np.arange(C.H - y0, dtype=np.float32)[:, None]
        rows = y0 + yy; depth = rows - (H0 - p[None, :])
        a = sstep(-0.8, 0.8, depth).astype(np.float32)
        n1 = fbm2(int(C.H - y0), C.W, 26, 12, seed + 5, 3); n2 = fbm2(int(C.H - y0), C.W, 7, 5, seed + 6, 2)
        l = np.clip(0.62 - depth * 0.02 + (n1 - 0.5) * 1.1 + (n2 - 0.5) * 0.55, 0, 1)[..., None]
        col = hexrgb('#2f5f3e') * (1 - l) + hexrgb('#86ad5c') * l
        col = col * (1 - air) + hexrgb(HAZE) * air
        C.lay(0, y0, col.astype(np.float32), a)
    C.img[int(C.row_of(-1.2)):] = hexrgb(MIST)
    el = C.row_el[:, None]; m = (sstep(1.1, -0.2, el) * 0.16)[..., None]
    C.img = C.img * (1 - m) + hexrgb(HAZE) * m

def paint_all(o):
    C = Canvas()
    paint_sky(C); paint_clouds(C)
    pang = volcano(C, PANGRANGO); sal = volcano(C, SALAK)
    print(f"Pangrango at {pang['bearing']:.1f}, true {pang['true_el']:.1f} deg, painted {PANGRANGO['elevation']}; Salak at {sal['bearing']:.1f}, true {sal['true_el']:.1f}, painted {SALAK['elevation']}", file=sys.stderr)
    el = C.row_el[:, None]; m = (sstep(3.2, 0.3, el) * 0.5)[..., None]; C.img = C.img * (1 - m) + hexrgb(HAZE) * m
    for P in CITY: city_photo(C, P, o.check)
    far_towers(C)
    base = C.img.copy()
    paint_monas(C); tree_line(C); img = np.clip(C.img, 0, 1).copy()
    C.img = base; tree_line(C); far = np.clip(C.img, 0, 1).copy()
    return C, pang, img, far

def main():
    A = argparse.ArgumentParser(); A.add_argument('--preview'); A.add_argument('--out', default=os.path.join(ROOT, 'assets/backdrops')); A.add_argument('--quality', type=int, default=86); A.add_argument('--check'); A.add_argument('--no-tiles', action='store_true')
    o = A.parse_args()
    C, pang, img, far = paint_all(o)
    if o.preview:
        Image.fromarray((img[::2, ::2] * 255 + 0.5).astype(np.uint8)).save(o.preview, quality=88)
    if o.no_tiles: return
    ptan = C.ptan; panels, total = [], 0; half = 31; Hf = float(C.H)
    for c in (0, 60, 120, 180, 240, 300):
        x = int(round((c - half) * PPD)); cols = (x + np.arange(2 * half * PPD)) % C.W
        name = f'jakarta-pano-{c:03d}.jpg'; path = os.path.join(o.out, name)
        Image.fromarray((img[:, cols] * 255 + 0.5).astype(np.uint8)).save(path, quality=o.quality, subsampling=1, optimize=True, progressive=True)
        total += os.path.getsize(path)
        q = {'file': name, 'width': 2 * half, 'edge': 0, 'rise': 0, 'baseHaze': [1, 1.01, 0], 'mist': MIST}
        if c == 300:
            top = {'name': 'Monas', 'lat': -6.1754, 'lon': 106.8272, 'altitude': 144, 'u': round(0.5 + (HERO_BEARING - c) / (2 * half), 4), 'row': round(C.row_of(HERO_EL) / Hf, 5)}
            q['summit'] = top; q['elevation'] = HERO_EL
            q['compressed'] = f'true 3.2 deg from Manggarai: it stands as a long lens on the whole half lap sees it, and exactly the size the 3D Monas has where the two change over (showWithin, {SHOW_R} m)'
        elif c == 180:
            q['summit'] = {'name': PANGRANGO['name'], 'lat': PANGRANGO['lat'], 'lon': PANGRANGO['lon'], 'altitude': PANGRANGO['altitude'], 'u': round(0.5 + (pang['bearing'] - c) / (2 * half), 5), 'row': round(pang['row'] / Hf, 5)}
            q['elevation'] = PANGRANGO['elevation']
            q['compressed'] = f"true {pang['true_el']:.1f} deg from the Monas: a long lens on a clear morning, standing over the towers, still as far away as it is"
        else:
            q['bearing'] = c; q['elevation'] = 0; q['row'] = round(TOP_TAN * ptan / Hf, 5)
        panels.append(q)
    # the same pixels with no Monas, for when the 3D Monas is the one in view
    img2 = far; hw = 4
    x = int(round((HERO_BEARING - hw) * PPD)); cols = (x + np.arange(2 * hw * PPD)) % C.W; name = 'jakarta-hero-far.jpg'; path = os.path.join(o.out, name)
    Image.fromarray((img2[:, cols] * 255 + 0.5).astype(np.uint8)).save(path, quality=o.quality, subsampling=1, optimize=True, progressive=True)
    total += os.path.getsize(path)
    panels.append({'file': name, 'width': 2 * hw, 'edge': 0, 'rise': 0, 'baseHaze': [1, 1.01, 0], 'mist': MIST, 'bearing': HERO_BEARING, 'elevation': 0, 'row': round(TOP_TAN * ptan / Hf, 5), 'showWithin': {'x': 0, 'z': 0, 'r': SHOW_R}})
    print(f'{total / 1048576:.2f} MB', file=sys.stderr)
    print(',\n'.join('    ' + json.dumps(q, ensure_ascii=False) for q in panels))

if __name__ == '__main__':
    main()
