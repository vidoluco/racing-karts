#!/usr/bin/env python3
"""The whole panorama of Bâlea painted from its real ground, 360 degrees. Local, no network.
node tools/panoramas/transfagarasan-dem.mjs, then python3 -I tools/panoramas/transfagarasan-dem-paint.py [--preview out.jpg] [--write]

Every column looks along its true bearing through Copernicus GLO-30, so each skyline is the real one. Over the lake the eye stands on the water; toward the valley it moves out over the lip and up,
so the real DN7C (OpenStreetMap, tools/panoramas/transfagarasan-road.json) shows as a stack of hairpins in a trough with the plain in the haze.
Cover as the summer photos have it: lush green grass from the water up, grey schist only in bands and on the crests, late snow low in the gullies, spruce under the real tree line.
--write puts the tiles in assets/backdrops and the panels on stdout."""
import argparse, json, math, os
import numpy as np, cv2

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
DEMDIR = os.path.join(ROOT, 'data/raw/backdrop-photos/tf-dem')
A = argparse.ArgumentParser(); A.add_argument('--preview'); A.add_argument('--write', action='store_true'); A.add_argument('--quality', type=int, default=80); A.add_argument('--crop'); o = A.parse_args()
meta = json.load(open(os.path.join(DEMDIR, 'dem.json')))
n0, STEP0, RAD = meta['n'], meta['step'], meta['radius']
DEM0 = np.fromfile(os.path.join(DEMDIR, 'dem.bin'), np.float32).reshape(n0, n0)
LAKE = 2034.0
PX = 45; PPD = 30  # worked at 45 px per degree, delivered at 30
TOP, BOT = 0.6, -0.42
SUN_B, SUN_E = 135.0, 48.0
COMP_FROM, COMP_K = 14.0, 0.714  # above 14 deg, so that Văiuga, true 28, stands at the 24 the chase frame allows

def hexs(s): return np.array([int(s[i:i + 2], 16) for i in (5, 3, 1)], np.float32) / 255  # BGR
def ramp(cols, t):
    cols = np.stack([hexs(c) for c in cols]); x = np.clip(t, 0, 1) * (len(cols) - 1)
    return np.stack([np.interp(x, np.arange(len(cols)), cols[:, k]) for k in range(3)], -1).astype(np.float32)
def noise(shape, s, seed):
    r = np.random.default_rng(seed); h, w = shape
    a = r.random((max(2, int(h / s) + 2), max(2, int(w / s) + 2)), np.float32)
    return cv2.resize(a, (w, h), interpolation=cv2.INTER_CUBIC)
def fbm(shape, s, seed, oct=4):
    v, amp, tot = 0, 1, 0
    for k in range(oct):
        v = v + amp * noise(shape, max(1.5, s / 2 ** k), seed + k); tot += amp; amp *= 0.55
    return v / tot
def G(a, s): return cv2.GaussianBlur(a, (0, 0), s)
def sm(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
def mix(a, b, t): t = t[..., None] if np.ndim(t) == 2 else t; return a * (1 - t) + b * t
def comp(el): return np.where(el > COMP_FROM, COMP_FROM + (el - COMP_FROM) * COMP_K, el)

ROAD = [[p for p in w if p[1] > 170] for w in json.load(open(os.path.join(ROOT, 'tools/panoramas/transfagarasan-road.json')))]

def ground(x0, x1, y0, y1, step, detail):
    """A grid: heights with the fine ground the 30 m DEM cannot hold, and its colour. Rows run north to south, y is metres north."""
    w, h = int((x1 - x0) / step) + 1, int((y1 - y0) / step) + 1
    mx, my = np.meshgrid((x0 + np.arange(w) * step + RAD) / STEP0, (RAD - (y1 - np.arange(h) * step)) / STEP0)
    H = cv2.remap(DEM0, mx.astype(np.float32), my.astype(np.float32), cv2.INTER_CUBIC)
    sh = (h, w); px = lambda m: m / step
    if detail > 0:
        H0 = G(H, px(12))
        gx0, gy0 = cv2.Sobel(H0, cv2.CV_32F, 1, 0, ksize=3) / (8 * step), cv2.Sobel(H0, cv2.CV_32F, 0, 1, ksize=3) / (8 * step)
        sl0 = np.hypot(gx0, gy0)
        # ribs down the fall line: noise stretched along the slope by warping the coordinates with height
        ribs = np.abs(fbm(sh, px(70), 11, 3) - 0.5) * 2; ribs2 = np.abs(fbm(sh, px(26), 15, 3) - 0.5) * 2
        grow = sm(0.25, 0.8, sl0) * detail
        H = H + grow * (11 * (ribs - 0.35) + 4.5 * (ribs2 - 0.35)) + (fbm(sh, px(14), 21, 3) - 0.5) * 2.4 * sm(0.1, 0.6, sl0) * detail
        # the crest is broken schist, however gentle the DEM's 30 m make it: steps and teeth along the skyline
        crestz = sm(0.5, 6, -(G(H0, px(30)) - H0)) * sm(60, 160, H0 - LAKE)
        H = H + crestz * detail * (9 * (np.abs(fbm(sh, px(34), 25, 2) - 0.5) * 2 - 0.3) + 5 * (np.abs(fbm(sh, px(13), 27, 2) - 0.5) * 2 - 0.3))
    gx, gy = cv2.Sobel(H, cv2.CV_32F, 1, 0, ksize=3) / (8 * step), cv2.Sobel(H, cv2.CV_32F, 0, 1, ksize=3) / (8 * step)  # gy: toward the south
    sl = np.degrees(np.arctan(np.hypot(gx, gy)))
    sb, se = math.radians(SUN_B), math.radians(SUN_E)
    L = np.array([math.cos(se) * math.sin(sb), math.sin(se), -math.cos(se) * math.cos(sb)])  # east, up, south
    lam = np.clip((-gx * L[0] + L[1] - gy * L[2]) / np.sqrt(1 + gx ** 2 + gy ** 2), 0, 1)
    light = 0.8 + 0.42 * sm(0.1, 0.95, lam)  # high summer haze: the wall in shade stays green, as in the photos
    sc = lambda m, seed, oc=4: fbm(sh, px(m), seed, oc)
    c_small = G(H, px(6)) - H; c_big = G(H, px(38)) - H; c_mid = G(H, px(16)) - H
    ao = np.clip(1 - np.maximum(c_small, 0) * 0.05 * (1 if detail else 0.4) - np.maximum(c_big, 0) * 0.012, 0.6, 1)
    rel = H - LAKE
    patch, patch2, blot, fine = sc(160, 31), sc(52, 35), sc(20, 41, 3), sc(7, 47, 2)
    # grass: never one green. Lusher in the hollows, yellower on the convex shoulders and up high
    t = 0.56 + 0.7 * (patch - 0.5) + 0.5 * (patch2 - 0.5) + 0.8 * (blot - 0.5) + 0.8 * (fine - 0.5) - 0.012 * c_big + 0.06 * sm(150, 400, rel)
    img = ramp(['#355a28', '#47762e', '#5d8c36', '#76a03f', '#93ad50'], t)
    # sheep paths and turf terraces across the slope, tussocks over them
    if detail:
        terr = np.sin(H / 2.6 + 3.4 * patch2) * sm(14, 26, sl)
        img *= (1 + 0.05 * terr + 0.26 * (fine - 0.5))[..., None]
        tuss = sm(0.57, 0.68, sc(9, 51, 2)) * sm(90, 10, np.abs(rel - 120) - 60)
        img = mix(img, img * np.array([0.72, 0.8, 0.72], np.float32), tuss * 0.65)  # jneapăn low down
    # below the alpine meadow: spruce under the tree line, then the fields of the Olt in the haze
    tree = 1760 + 90 * (patch - 0.5) * 2 - 1.8 * c_big
    forest = sm(tree + 8, tree - 8, H) * sm(780, 880, H) * (1 - sm(46, 54, sl))
    wood = ramp(['#16382a', '#21492e', '#2f5a32'], fine * 0.5 + blot * 0.5)
    img = mix(img, wood, forest)
    low = sm(860, 760, H)
    fields = ramp(['#6b8f4a', '#8aa65a', '#a8b870', '#7d9a55'], fbm(sh, px(320), 61, 2))
    img = mix(img, fields, low)
    # rock: bands that follow the beds at mid height and the crests, never the whole wall. Broken by grass on every ledge
    warp = 30 * (sc(240, 71, 3) - 0.5) + 10 * (sc(60, 73, 2) - 0.5)
    bed = 0.5 + 0.5 * np.sin((H + warp + 0.11 * (mx * STEP0)) * 2 * math.pi / 58)
    band = sm(0.66, 0.88, bed) * sm(0.5, 0.62, sc(130, 77, 3) + 0.12 * (blot - 0.5)) * sm(24, 34, sl)
    mid_gate = sm(30, 110, rel) * sm(860, 1100, H)
    cliff = sm(46, 58, sl + 16 * (patch2 - 0.5))
    crest = sm(2.0, 9.0, -c_big) * sm(28, 40, sl) * sm(180, 300, rel)
    rock = np.clip(np.maximum(np.maximum(band * mid_gate, cliff), crest * sm(0.3, 0.55, blot)), 0, 1)
    rock = rock * sm(0.3, 0.4, sc(11, 79, 3) + 0.5 * rock)  # turf on the ledges breaks every band
    rocks = ramp(['#5a5854', '#74726b', '#908d83', '#aaa699'], 0.25 + 1.2 * (blot - 0.25) + 0.5 * (fine - 0.5))
    if detail:
        cracks = sm(0.03, 0.0, np.abs(sc(11, 83, 2) - 0.5)) * 0.5 + sm(0.02, 0.0, np.abs(sc(28, 87, 2) - 0.5)) * 0.6
        rocks = rocks * (1 - np.clip(cracks, 0, 0.75))[..., None]
    img = mix(img, rocks, rock)
    # boulders at the foot of the walls, a grey field low on the slopes
    if detail:
        foot = sm(120, 20, rel) * sm(6, 16, sl) * sm(0.48, 0.6, patch2 + 0.2 * (patch - 0.5))
        stones = sm(0.6, 0.66, sc(5, 91, 2)) * foot
        img = mix(img, ramp(['#8d8a80', '#b1ad9f'], fine), stones)
        img *= (1 - 0.28 * np.roll(stones, 2, axis=0) * (1 - stones))[..., None]
    # the DN7C: asphalt in its pale cutting
    rm = np.zeros(sh, np.uint8); ra = np.zeros(sh, np.uint8)
    for wy in ROAD:
        if len(wy) < 2: continue
        pts = np.array([[(p[0] - x0) / step, (y1 - p[1]) / step] for p in wy], np.float32).round().astype(np.int32)
        cv2.polylines(rm, [pts], False, 255, max(1, int(round(34 / step))), cv2.LINE_AA)
        cv2.polylines(ra, [pts], False, 255, max(1, int(round(16 / step))), cv2.LINE_AA)
    rm_ = rm.astype(np.float32) / 255; ra_ = ra.astype(np.float32) / 255
    img = mix(img, ramp(['#a29d8f', '#c0bbab'], blot), rm_ * 0.9 * (1 - low))
    img = mix(img, np.array(hexs('#3f4044'), np.float32), ra_ * (1 - low))
    # late snow: only low, only in the hollows that keep it, crisp edged
    snowy = sm(190, 130, rel) * sm(14, 34, rel) * sm(14, 24, sl) * sm(46, 36, sl)
    # c_mid: how deep the hollow; so the patches run down the gullies, long and thin
    snow = sm(0.45, 0.55, np.clip(c_mid - 1.0, -2, 0.4) * 0.5 + 3.4 * (sc(30, 93, 3) - 0.6) + 0.5) * snowy
    img = mix(img, ramp(['#d3e0e8', '#fbfcfb'], sm(-0.2, 0.3, lam - 0.55) * 0.6 + fine * 0.5), snow)
    img = img * (light * ao * (1 - snow) + 1.08 * snow)[..., None]
    print(f'grid {w}x{h} step {step}: rock on the walls {float(rock[(rel > 40) & (rel < 400)].mean()):.2f}, snow {float(snow[(rel > 0) & (rel < 200)].mean()):.3f}', flush=True)
    return dict(H=H, img=np.clip(img, 0, 1).astype(np.float32), x0=x0, y1=y1, step=step, w=w, h=h)

GRIDS = [
    ground(-2100, 2100, -1600, 1800, 1.6, 1.0),
    ground(-5000, 5000, -5000, 8000, 5, 0.6),
    ground(-RAD, RAD, -RAD, RAD, 30, 0),
]

def on(g, X, Y):
    return ((X - g['x0']) / g['step']).astype(np.float32), ((g['y1'] - Y) / g['step']).astype(np.float32)
def inside(g, X, Y, m=30):
    return (X > g['x0'] + m) & (X < g['x0'] + g['step'] * (g['w'] - 1) - m) & (Y < g['y1'] - m) & (Y > g['y1'] - g['step'] * (g['h'] - 1) + m)
def heights(X, Y):
    out = np.zeros_like(X)
    for g in GRIDS[::-1]:
        ms = inside(g, X, Y)
        if ms.any():
            mx, my = on(g, X, Y); r = cv2.remap(g['H'], mx, my, cv2.INTER_LINEAR); out[ms] = r[ms]
    return out
def colours(X, Y):
    out = np.zeros(X.shape + (3,), np.float32)
    for g in GRIDS[::-1]:
        ms = inside(g, X, Y)
        if ms.any():
            mx, my = on(g, X, Y); r = cv2.remap(g['img'], mx, my, cv2.INTER_LINEAR); out[ms] = r[ms]
    return out

# the eye: on the lake, and out over the lip toward the valley
EYE_N = (-90.0, 150.0, 2360.0)
def eye(az):
    d = np.abs(((az - 8 + 180) % 360) - 180)
    w = sm(62, 26, d)
    return w * EYE_N[0], 0 + w * EYE_N[1], LAKE + 10 + w * (EYE_N[2] - LAKE - 10), w

W, H = int(360 * PX), int(round((TOP - BOT) / math.radians(1) * PX))
pxt = (TOP - BOT) / H
print('image', W, H, flush=True)
NR = 1500; ds = 90 * (RAD / 90) ** (np.arange(NR) / (NR - 1))
rowsOf = np.arange(H, dtype=np.float32)
tanAtRow = TOP - (rowsOf + 0.5) * pxt
elAtRow = np.degrees(np.arctan(tanAtRow))

# sky first: blue overhead, pale down to the haze, built by elevation
SKY = [(-25, '#d6e4e8'), (-2, '#d6e4e8'), (3, '#cfe2ea'), (8, '#b9d8ea'), (14, '#9ccaea'), (20, '#80bae8'), (26, '#6aaae4'), (33, '#5a9de0')]
skyc = np.stack([np.interp(elAtRow, [e for e, _ in SKY], [hexs(c)[k] for _, c in SKY]) for k in range(3)], -1).astype(np.float32)
img = np.repeat(skyc[:, None, :], W, 1)
# clouds that wrap round: cumulus piled up from a flat base, lit from the sun's side, a thin high veil over them
wrap = np.concatenate
def wnoise(s, seed, oct=5):
    n = fbm((H, W + int(s) * 4), s, seed, oct)
    k = int(s) * 4; out = n[:, :W].copy(); t = np.linspace(0, 1, k, dtype=np.float32)[None, :]
    out[:, :k] = n[:, W:W + k] * (1 - t) + out[:, :k] * t
    return out
c1 = wnoise(230, 101); c2 = wnoise(70, 111, 4); wisps = cv2.GaussianBlur(wnoise(260, 121, 3), (0, 0), sigmaX=40, sigmaY=6)
yy = np.arange(H, dtype=np.float32)[:, None]
base = (TOP - math.tan(math.radians(6.5))) / pxt
above = np.clip((base - yy) / 420, 0, 1)
# only a bank of cumulus low in the sky, thinning upward: none of them float loose higher up
dens = c1 * 0.72 + c2 * 0.28 + 0.12 * sm(0.0, 0.18, above) - 0.34 * sm(0.3, 0.8, above)
dens = dens * (above > 0)
m = sm(0.53, 0.575, dens) * sm(0.62, 0.42, above)
shift = np.roll(dens, -26, 1); shift = np.roll(shift, 14, 0)
lit = sm(-0.05, 0.06, dens - shift)
cloudc = mix(np.array(hexs('#c7d3e0'), np.float32) * np.ones((H, W, 3), np.float32), np.array(hexs('#ffffff'), np.float32) * np.ones((H, W, 3), np.float32), lit * 0.8 + 0.2 * sm(0.0, 0.5, above))
img = mix(img, cloudc, m * 0.95)
veil = sm(0.52, 0.72, cv2.resize(wisps, (W, H))) * sm(12, 18, np.repeat(elAtRow[:, None], W, 1)) * 0.06
img = mix(img, np.array(hexs('#f4f8fb'), np.float32) * np.ones((H, W, 3), np.float32), veil)
del c1, c2, wisps, dens, shift, lit, cloudc, veil, m

ridge = np.zeros(W, np.float32)
CH = 1800
valley_cloud = wnoise(140, 131, 4)
for c0 in range(0, W, CH):
    c1 = min(W, c0 + CH); az = (np.arange(c0, c1, dtype=np.float32) + 0.5) / PX
    ex, ey, ez, ew = eye(az)
    sa, ca = np.sin(np.radians(az))[:, None], np.cos(np.radians(az))[:, None]
    X = (ex[:, None] + ds[None, :] * sa).astype(np.float32); Y = (ey[:, None] + ds[None, :] * ca).astype(np.float32)
    rays = heights(X, Y)
    ty = (rays - ez[:, None] - ds * ds / (2 * 6371000) * 0.87) / ds
    el = comp(np.degrees(np.arctan(ty)))
    # a long lens on the valley: what lies under the horizon is drawn up toward it, so that over the lip of the 3D slope the real stack, the trough and the plain all stand in view
    el = np.where(el < 0, el * (1 - 0.58 * ew[:, None]), el)
    rows = (TOP - np.tan(np.radians(el))) / pxt
    rc = np.minimum.accumulate(rows, axis=1)
    idx = np.full((H, c1 - c0), -1, np.float32); grid = rowsOf
    ind = np.arange(NR, dtype=np.float32)
    for c in range(c1 - c0):
        idx[:, c] = np.interp(-grid, -rc[c], ind, left=0, right=-1)
        ridge[c0 + c] = rc[c].min()
    sky = idx < 0
    i_f = np.where(sky, 0, idx)
    d = 90 * (RAD / 90) ** (i_f / (NR - 1))
    a2 = np.repeat(np.radians(az)[None, :], H, 0)
    PXX = (ex[None, :] + d * np.sin(a2)).astype(np.float32); PYY = (ey[None, :] + d * np.cos(a2)).astype(np.float32)
    col = colours(PXX, PYY)
    alt = heights(PXX, PYY)
    # the air: layers paling with distance, into a warm white over the plain
    hz = 1 - np.exp(-np.maximum(d - 300, 0) / 15000)
    hz = np.clip(hz * (1 + 0.5 * sm(1400, 500, alt)), 0, 0.8)
    air = mix(np.array(hexs('#9fbfd8'), np.float32), np.array(hexs('#c9dae6'), np.float32), sm(0.2, 0.75, hz))
    col = mix(col, air, hz)
    # cloud lying in the valleys far below, as the road's photos have it
    vc = valley_cloud[:, c0:c1]
    cl = sm(0.56, 0.62, vc + 0.12 * sm(1500, 900, alt)) * sm(1150, 850, alt) * sm(2500, 6000, d) * sm(26000, 12000, d)
    col = mix(col, np.array(hexs('#f8fafb'), np.float32) * (0.93 + 0.07 * vc[..., None]), cl * 0.92)
    # a thin broken pen where one ridge passes behind another
    ld = np.log(np.where(sky, ds[-1], d))
    jump = (np.abs(np.diff(ld, axis=0, prepend=ld[:1])) > 0.05) & (d < 9000)
    jump[sky] = False
    col = mix(col, col * 0.55, cv2.GaussianBlur(jump.astype(np.float32), (0, 0), 0.8) * 0.8)
    part = img[:, c0:c1]
    part[~sky] = col[~sky]
    print('col', c0, flush=True)
del GRIDS

small = cv2.resize(img, (360 * PPD, int(round((TOP - BOT) / math.radians(1) * PPD))), interpolation=cv2.INTER_AREA)
del img
small = np.clip(small * 255 + 0.5, 0, 255).astype(np.uint8)
SH, SW = small.shape[:2]

def rowOf(e): return (TOP - math.tan(math.radians(e))) / (TOP - BOT)
SUMMITS = [
    ('Văiuga', 45.6037178, 24.6258732, 2443, 60),
    ('Paltinu', 45.5983307, 24.6070724, 2399, 240),
    ('Piscul Bâlii', 45.6065247, 24.6074867, 2180, 300),
]
LA, LO = meta['center']
ridge_small = cv2.resize(ridge[None, :], (SW, 1), interpolation=cv2.INTER_AREA)[0] * (SH / H)
panels = []
MIST = '#7f9a5e'
for ctr in (0, 60, 120, 180, 240, 300):
    p = {'file': f'transfagarasan-pano-{ctr:03d}.jpg', 'width': 62, 'edge': 0, 'rise': 0, 'baseHaze': [1, 1.01, 0], 'mist': MIST}
    s = next((q for q in SUMMITS if q[4] == ctr), None)
    if s:
        dx, dy = (s[2] - LO) * 111320 * math.cos(math.radians(LA)), (s[1] - LA) * 111132
        br = math.degrees(math.atan2(dx, dy)) % 360; dist = math.hypot(dx, dy)
        # the painted top over the summit's true bearing: within a degree, the highest of the DEM's own
        c = int(br * PPD); win = PPD
        rng = (np.arange(c - win, c + win) % SW); k = rng[np.argmin(ridge_small[rng])]
        row = float(ridge_small[k]) / SH; e = math.degrees(math.atan(TOP - row * (TOP - BOT)))
        truth = math.degrees(math.atan((s[3] - LAKE) / dist))
        p['summit'] = {'name': s[0], 'lat': s[1], 'lon': s[2], 'altitude': s[3], 'u': round((k / PPD - (ctr - 31)) / 62 % 1 if ctr else 0, 5), 'row': round(row, 5)}
        p['elevation'] = round(e, 2); p['compressed'] = f'true {truth:.1f} deg, painted from the DEM under the chase frame top'
    else:
        p['bearing'] = ctr; p['elevation'] = 0; p['row'] = round(rowOf(0), 5)
    panels.append(p)

if o.preview:
    cv2.imwrite(o.preview, cv2.resize(small, (SW // 2, SH // 2), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 85])
    if o.crop:
        for spec in o.crop.split(','):
            b0, b1 = map(float, spec.split(':'))
            xs = (np.arange(int(b0 * PPD), int(b1 * PPD)) % SW)
            cv2.imwrite(o.preview.replace('.jpg', f'-{int(b0)}.jpg'), small[:, xs], [cv2.IMWRITE_JPEG_QUALITY, 85])
np.save(os.path.join(DEMDIR, 'pano.npy'), small)
if o.write:
    tot = 0
    for ctr, p in zip((0, 60, 120, 180, 240, 300), panels):
        xs = (np.arange(int((ctr - 31) * PPD), int((ctr + 31) * PPD)) % SW)
        out = os.path.join(ROOT, 'assets/backdrops', p['file'])
        cv2.imwrite(out, small[:, xs], [cv2.IMWRITE_JPEG_QUALITY, o.quality, cv2.IMWRITE_JPEG_OPTIMIZE, 1])
        tot += os.path.getsize(out)
    print('tiles MB', round(tot / 1e6, 2), flush=True)
    print('PANELS ' + json.dumps(panels, ensure_ascii=True), flush=True)
