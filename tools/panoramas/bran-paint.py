#!/usr/bin/env python3
"""The two great mountains of Bran, painted from their real ground: the Bucegi wall and the knife edge of Piatra Craiului. Local, no network.
python3 -I tools/panoramas/bran-paint.py [--only bucegi|piatra] [--preview out.jpg]   after node tools/panoramas/bran-dem.mjs

Every column looks along its true bearing from the track's real place through Copernicus GLO-30, so the outline is the real skyline; only its height is scaled, by one factor, as a long lens does.
On that ground: the flutes of the rock, forest under its real tree line, dwarf pine, snow in the gullies, flat tones by moonlight and a thin pen where one ridge passes behind another.
Writes <id>.jpg and <id>-ridge.json in data/raw/backdrop-photos/bran-dem-paint, tools/panoramas/bran-<id>-ridge.json, and the figures on stdout."""
import argparse, json, math, os
import numpy as np, cv2

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = os.path.join(ROOT, 'data/raw/backdrop-photos/bran-dem-paint')
A = argparse.ArgumentParser(); A.add_argument('--only'); A.add_argument('--preview'); o = A.parse_args()
meta = json.load(open(os.path.join(OUT, 'dem.json')))
n0, STEP0, RAD = meta['n'], meta['step'], meta['radius']
DEM0 = np.fromfile(os.path.join(OUT, 'dem.bin'), np.float32).reshape(n0, n0)
EYE = 945.0
LAT, LON = meta['center']
PX = 45  # pixels per degree of azimuth, the composer's working size

def hexs(s): return np.array([int(s[i:i + 2], 16) for i in (5, 3, 1)], np.float32) / 255  # BGR
def ramp(cols, t):
    cols = np.stack([hexs(c) for c in cols]); x = np.clip(t, 0, 1) * (len(cols) - 1)
    return np.stack([np.interp(x, np.arange(len(cols)), cols[:, k]) for k in range(3)], -1)
def noise(shape, sx, sy, seed):
    r = np.random.default_rng(seed); h, w = shape
    a = r.random((max(2, int(h / sy) + 2), max(2, int(w / sx) + 2)), np.float32)
    return cv2.resize(a, (w, h), interpolation=cv2.INTER_CUBIC)
def fbm(shape, s, seed, oct=4):
    v, amp, tot = 0, 1, 0
    for k in range(oct):
        v = v + amp * noise(shape, max(1, s / 2 ** k), max(1, s / 2 ** k), seed + k); tot += amp; amp *= 0.55
    return v / tot
def bearing_dist(lat, lon):
    dx = (lon - LON) * 111320 * math.cos(math.radians(LAT)); dy = (lat - LAT) * 111132
    return math.degrees(math.atan2(dx, dy)) % 360, math.hypot(dx, dy)
def G(a, s): return cv2.GaussianBlur(a, (0, 0), s)

CFG = {
  'bucegi': {
    'summit': (45.4456, 25.4563, 2505), 'az0': 76, 'width': 106, 'target': 15.5, 'd0': 5200, 'dmax': 34000,
    # the massif's own axis, for the gullies that fall off the wall
    'axis': 8, 'flute': [(420, 16), (170, 9), (80, 4)], 'flute_from': 1500, 'flute_to': 1950, 'crest_soft': (2130, 0.42), 'stretch': 1.28,
    'light': (205, 30), 'tree': 1760, 'tree_rough': 150, 'pine': (2030, 0.5), 'snow': (1900, 0.0), 'cliff': 48, 'shade': 1.7, 'ribs': (0.3, 0.16),
    'sky': '#5f9fb0',
  },
  'piatra': {
    'summit': (45.527, 25.2117, 2238), 'az0': 236, 'width': 106, 'target': 14.5, 'd0': 6000, 'dmax': 24000,
    # the crest runs north east to south west; its flutes fall off it across that line
    'axis': 40, 'flute': [(340, 34), (150, 26), (70, 11)], 'flute_from': 1250, 'flute_to': 1780, 'crest_soft': None, 'stretch': 1.18,
    'light': (172, 26), 'tree': 1330, 'tree_rough': 130, 'pine': (1900, 0.42), 'snow': None, 'cliff': 46, 'shade': 2.6, 'ribs': (0.42, 0.34),
    'sky': '#5f9fb0',
  },
}
ROCK = ['#2e3b52', '#44546a', '#5e6e84', '#78879a', '#95a1ae', '#afb8c0', '#c9cfd0']
FOREST = ['#0b2638', '#113246', '#183e52', '#214c5e']
PINE = ['#112f3e', '#1a404c', '#25505a']
SNOW = ['#7e9cc4', '#a9c2da', '#d8e6f0', '#f0f5f8']
AIR = hexs('#6fa2b4')

def paint(name, C):
    br, dist = bearing_dist(C['summit'][0], C['summit'][1])
    # double the grid: the flutes want finer steps than 30 m
    dem = cv2.resize(DEM0, (n0 * 2 - 1, n0 * 2 - 1), interpolation=cv2.INTER_CUBIC); step = STEP0 / 2; n = dem.shape[0]
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32); X = xx * step - RAD; Z = yy * step - RAD
    ax = math.radians(C['axis']); s = X * math.sin(ax) - Z * math.cos(ax)  # along the crest
    wob = (fbm((n // 4, n // 4), 90, 5) - 0.5) * 900; wob = cv2.resize(wob, (n, n), interpolation=cv2.INTER_LINEAR)
    teeth = np.zeros_like(dem)
    for k, (period, amp) in enumerate(C['flute']):
        # 1-D noise along the crest, sharpened into ribs: each rib runs straight down the fall of the wall
        nn = 4096; r = np.random.default_rng(11 + k).random(nn, np.float32)
        q = ((s + wob * (0.4 + 0.3 * k)) / period) % nn; i = q.astype(np.int32); f = q - i; f = f * f * (3 - 2 * f)
        v = r[i % nn] * (1 - f) + r[(i + 1) % nn] * f
        teeth += amp * (1 - np.abs(2 * v - 1) * 2)
    grow = np.clip((dem - C['flute_from']) / (C['flute_to'] - C['flute_from']), 0, 1)
    work = dem + teeth * grow * grow
    if C['crest_soft']:
        c, f = C['crest_soft']; work = np.where(work > c, c + (work - c) * f, work)
    # height of the named summit as worked, and the one factor on all of it
    i = (dist * math.sin(math.radians(br)) + RAD) / step; j = (-dist * math.cos(math.radians(br)) + RAD) / step
    i = int(round(i)); j = int(round(j)); h_s = float(work[j - 12:j + 13, i - 12:i + 13].max())
    k = math.tan(math.radians(C['target'])) / ((h_s - EYE - dist * dist / (2 * 6371000) * 0.87) / dist)
    # maps on the ground
    hs = G(work, 0.8); gx = cv2.Sobel(hs, cv2.CV_32F, 1, 0, ksize=3) / (8 * step); gz = cv2.Sobel(hs, cv2.CV_32F, 0, 1, ksize=3) / (8 * step)
    e = C['shade']; lb, le = math.radians(C['light'][0]), math.radians(C['light'][1])
    L = np.array([math.cos(le) * math.sin(lb), math.sin(le), -math.cos(le) * math.cos(lb)])
    nl = np.sqrt(1 + (e * gx) ** 2 + (e * gz) ** 2)
    lam = np.clip((-e * gx * L[0] + L[1] - e * gz * L[2]) / nl, 0, 1)
    slope = np.degrees(np.arctan(np.hypot(gx, gz)))
    cs = G(work, 1.6) - G(work, 5); cl = G(work, 6) - G(work, 20)
    # the picture: a cylinder, tan(elevation) straight up the rows
    W = int(C['width'] * PX); top = math.tan(math.radians(C['target'])) + 0.05; bot = -0.015
    H = int(round((top - bot) / math.radians(C['width']) * W)); pxt = (top - bot) / H
    N = 1100; ds = C['d0'] * (C['dmax'] / C['d0']) ** (np.arange(N) / (N - 1))
    # stretch: the picture is wider than the ground it shows, about the summit, which keeps its true bearing. A long lens on a long wall, with the height left alone
    su_true = (br - C['az0']) / C['width']
    az = np.radians(br + ((np.arange(W) + 0.5) / W - su_true) * C['width'] / C.get('stretch', 1))
    mx = ((ds[None, :] * np.sin(az)[:, None] + RAD) / step).astype(np.float32); mz = ((-ds[None, :] * np.cos(az)[:, None] + RAD) / step).astype(np.float32)
    rays = cv2.remap(work, mx, mz, cv2.INTER_LINEAR)
    ty = k * (rays - EYE - ds * ds / (2 * 6371000) * 0.87) / ds
    rows = (top - ty) / pxt
    rc = np.minimum.accumulate(rows, axis=1)
    idx = np.full((H, W), -1, np.float32)
    grid = np.arange(H, dtype=np.float32)
    for c in range(W):
        idx[:, c] = np.interp(-grid, -rc[c], np.arange(N, dtype=np.float32), left=0, right=-1)
    sky = idx < 0
    i_f = np.where(sky, 0, idx)
    d = C['d0'] * (C['dmax'] / C['d0']) ** (i_f / (N - 1))
    azz = np.repeat(az[None, :], H, 0).astype(np.float32)
    px = ((d * np.sin(azz) + RAD) / step).astype(np.float32); pz = ((-d * np.cos(azz) + RAD) / step).astype(np.float32)
    sample = lambda m: cv2.remap(m, px, pz, cv2.INTER_LINEAR)
    al, la, sl, c1, c2, base = sample(work), sample(lam), sample(slope), sample(cs), sample(cl), sample(dem)
    shape = (H, W)
    fine = fbm(shape, 90, 21); blot = fbm(shape, 34, 31, 3); stip = fbm(shape, 7, 41, 2)
    # cover. Forest climbs the gullies and stops on cliffs
    tree = C['tree'] + (fine - 0.5) * 2 * C['tree_rough'] - c2 * 3.2 - c1 * 2.5
    forest = (base < tree) & ((sl < C['cliff'] + 18 * (fine - 0.5)) | (base < tree - 260))
    pine = np.zeros(shape, bool)
    if C['pine']:
        ph, pt = C['pine']; pine = (base >= tree) & (base < ph + (fine - 0.5) * 260) & (stip * 0.25 + blot * 0.75 + 0.004 * (ph - base) / 3 > 0.42 + pt * 0.2) & (sl < C['cliff'] + 8)
    snow = np.zeros(shape, bool)
    if C['snow']:
        sa, _ = C['snow']
        gully = -c1 * 0.26 - c2 * 0.18 + (blot - 0.5) * 2.0
        # snow lies in the gullies and on what is gentle; the ribs between stand bare
        snow = (base > sa + (fine - 0.5) * 240) & ((gully + (base - sa) / 900 > 0.8) | (sl < 15 + 8 * (fine - 0.5)))
    # light, cut into flat tones
    # ribs: the strata of the rock, thin and parallel, leaning with the beds
    rib = noise(shape, 5, 150, 51) * 0.6 + noise(shape, 13, 240, 52) * 0.4
    M = np.float32([[1, C['ribs'][1], 0], [0, 1, 0]]); rib = cv2.warpAffine(rib, M, (W, H), borderMode=cv2.BORDER_REFLECT)
    light = -0.1 + 1.25 * la + 0.02 * c1 + 0.01 * c2 + (blot - 0.5) * 0.16 + (rib - 0.5) * C['ribs'][0] * 1.6
    q = lambda v, steps: (np.floor(np.clip(G(v, 0.9), 0, 0.999) * steps) + 0.5) / steps
    # the rock's tones by rank, not by value: the same few greys on any face, in the share of a painted limestone, mostly middle tones and little that is quite white
    bare = (~sky) & (base > C['tree'] - 300)
    pc = np.percentile(light[bare], np.linspace(0, 100, 33)); light = np.interp(light, pc, np.linspace(0, 1, 33)).astype(np.float32) ** 1.1
    img = ramp(ROCK, q(light, len(ROCK) + 2))
    pv = np.clip(0.34 + 0.8 * la + (stip - 0.5) * 1.2 + (blot - 0.5) * 0.5, 0, 1)
    for mask, cols, ss in [(pine, PINE, 3), (forest, FOREST, 4)]:
        c = ramp(cols, q(pv, ss)); img[mask] = c[mask]
    if C['snow']:
        sv = np.clip(0.34 + 0.9 * la + (blot - 0.5) * 0.25, 0, 1); c = ramp(SNOW, q(sv, 5)); img[snow] = c[snow]
    # a thin pen: one ridge going behind another, and the deepest gullies
    jump = np.abs(np.diff(i_f, axis=0, prepend=i_f[:1])) > 7
    jump[sky] = False
    gl = (c1 < -5.5) & ~forest & ~snow
    gl = cv2.GaussianBlur((gl & (cv2.Laplacian(c1, cv2.CV_32F) > 0.2)).astype(np.float32), (0, 0), 0.6) > 0.5
    pen = cv2.GaussianBlur((jump.astype(np.float32)), (0, 0), 0.7)
    img = img * (1 - np.clip(pen * 1.6, 0, 0.8)[..., None] * 0.86) + hexs('#101c34') * np.clip(pen * 1.6, 0, 0.8)[..., None] * 0.86
    img[gl] = img[gl] * 0.72
    # air
    air = np.clip((d - 5000) / 30000, 0, 0.42)[..., None]
    img = img * (1 - air) + AIR * air
    # below the nearest ray: forest, the belts lie over it. Above the crest: the colour of the sky at that height
    foot = (idx <= 0) & ~sky & (grid[:, None] > rc[:, 0].min())
    fv = np.clip(0.32 + (stip - 0.5) * 1.3 + (blot - 0.5) * 0.7, 0, 1); c = ramp(FOREST, q(fv, 4)); img[foot] = c[foot]
    img[sky] = hexs(C['sky'])
    img = np.clip(img, 0, 1)
    out = os.path.join(OUT, f'{name}.jpg')
    cv2.imwrite(out, (img * 255 + 0.5).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 92])
    ridge = np.argmax(~sky, axis=0).astype(np.float32)
    ru = [[round((c + 0.5) / W, 5), round(float(ridge[c]) / H, 5)] for c in range(0, W, 2)]
    json.dump(ru, open(os.path.join(ROOT, f'tools/panoramas/bran-{name}-ridge.json'), 'w'))
    su = (br - C['az0']) / C['width']
    print(json.dumps({'name': name, 'size': [W, H], 'factor': round(k, 3), 'bearing': round(br, 2), 'summit_u': round(su, 5), 'width': C['width'], 'az0': C['az0'], 'crest_row_at_summit': float(ridge[int(su * W)]) / H}))
    return img

done = []
for name, C in CFG.items():
    if o.only and o.only != name: continue
    done.append(paint(name, C))
if o.preview:
    w = 1800; ims = [cv2.resize(i, (w, int(i.shape[0] * w / i.shape[1])), interpolation=cv2.INTER_AREA) for i in done]
    cv2.imwrite(o.preview, (np.vstack(ims) * 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 85])
