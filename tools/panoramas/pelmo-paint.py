#!/usr/bin/env python3
"""What stands round the Pelmo's circle, by the hand of its hero. Local, no network.
python3 -I tools/panoramas/pelmo-paint.py [--only bosconero|north|antelao] [--preview out.jpg]   after node tools/panoramas/pelmo-dem.mjs

bosconero, north: every column looks along its true bearing through Copernicus GLO-30 from the floor of the valley, so the outline is the real skyline, its height scaled by one factor.
On that ground: dolomite beds as long ledges that hold snow, rose where the low sun rakes, lilac in the shade, a pen on every crest and along the planes.
antelao: the repaint of the San Vito photo (antelao-gemini2, a hand repaint of a real photo) taken to the winter hour of the Pelmo's: its shapes, gullies and pen stay; snow on its ledges, autumn gone.
Writes <id>.jpg in data/raw/backdrop-photos/pelmo-dem-paint, tools/panoramas/pelmo-<id>-ridge.json, and the figures on stdout."""
import argparse, json, math, os
import numpy as np, cv2

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = os.path.join(ROOT, 'data/raw/backdrop-photos/pelmo-dem-paint')
A = argparse.ArgumentParser(); A.add_argument('--only'); A.add_argument('--preview'); o = A.parse_args()
PX = 45  # pixels per degree of azimuth, the composer's working size

def hexs(s): return np.array([int(s[i:i + 2], 16) for i in (5, 3, 1)], np.float32) / 255  # BGR
def ramp(cols, t):
    cols = np.stack([hexs(c) for c in cols]); x = np.clip(t, 0, 1) * (len(cols) - 1)
    return np.stack([np.interp(x, np.arange(len(cols)), cols[:, k]) for k in range(3)], -1).astype(np.float32)
def noise(shape, sx, sy, seed):
    r = np.random.default_rng(seed); h, w = shape
    a = r.random((max(2, int(h / sy) + 2), max(2, int(w / sx) + 2)), np.float32)
    return cv2.resize(a, (w, h), interpolation=cv2.INTER_CUBIC)
def fbm(shape, s, seed, oct=4):
    v, amp, tot = 0, 1, 0
    for k in range(oct):
        v = v + amp * noise(shape, max(1, s / 2 ** k), max(1, s / 2 ** k), seed + k); tot += amp; amp *= 0.55
    return v / tot
def G(a, s): return cv2.GaussianBlur(a, (0, 0), s)

# read off the hero (pelmo-winter): the rose of the lit beds, the lilac of the shade, the rosy white of the ledges
ROCK = ['#3f3d78', '#5d5a96', '#8473ad', '#b08db4', '#dca3ad', '#f4bbae', '#fdd8c8']
SNOW = ['#a9a4d8', '#cdc4ea', '#f3e3ec', '#fff3ee']
FOREST = ['#3a4c6e', '#4a5e86', '#5c7098']  # as far off as the back belt, so the belts lie over it without a step
FIR = ['#1e2c40', '#2c3d56', '#3a4c6c']
INK = hexs('#2a2a58')

CFG = {
  # the Bosconero group and Monte Rite, from the floor of the Boite: south and south east are a wall of pale rock
  'bosconero': {'summit': (46.3366, 12.2682, 2469), 'az0': 140, 'width': 120, 'target': 15.5, 'eye': 880, 'd0': 7000, 'dmax': 26000, 'seed': 3},
  # the Sorapiss and the Cernera side, north west to north
  'north': {'summit': (46.5069, 12.2117, 3205), 'az0': 340, 'width': 96, 'target': 15, 'eye': 880, 'd0': 6000, 'dmax': 28000, 'seed': 9},
}
FLUTE = [(420, 58), (170, 34), (70, 15)]

def paint(name, C):
    meta = json.load(open(os.path.join(OUT, 'dem.json')))
    n0, STEP0, RAD = meta['n'], meta['step'], meta['radius']; LAT, LON = meta['center']
    DEM0 = np.fromfile(os.path.join(OUT, 'dem.bin'), np.float32).reshape(n0, n0)
    dx = (C['summit'][1] - LON) * 111320 * math.cos(math.radians(LAT)); dy = (C['summit'][0] - LAT) * 111132
    br, dist = math.degrees(math.atan2(dx, dy)) % 360, math.hypot(dx, dy)
    dem = cv2.resize(DEM0, (n0 * 2 - 1, n0 * 2 - 1), interpolation=cv2.INTER_CUBIC); step = STEP0 / 2; n = dem.shape[0]
    EYE = C['eye']
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32); X = xx * step - RAD; Z = yy * step - RAD
    ax = math.radians(C['az0'] + 90); s = X * math.sin(ax) - Z * math.cos(ax)
    wob = cv2.resize((fbm((n // 4, n // 4), 90, 5) - 0.5) * 900, (n, n), interpolation=cv2.INTER_LINEAR)
    teeth = np.zeros_like(dem)
    for k, (period, amp) in enumerate(FLUTE):
        nn = 4096; r = np.random.default_rng(C['seed'] + k).random(nn, np.float32)
        q = ((s + wob * (0.4 + 0.3 * k)) / period) % nn; i = q.astype(np.int32); f = q - i; f = f * f * (3 - 2 * f)
        v = r[i % nn] * (1 - f) + r[(i + 1) % nn] * f
        teeth += amp * (1 - np.abs(2 * v - 1) * 2)
    grow = np.clip((dem - 1700) / 450, 0, 1)
    work = dem + teeth * grow * grow
    i = int(round((dist * math.sin(math.radians(br)) + RAD) / step)); j = int(round((-dist * math.cos(math.radians(br)) + RAD) / step))
    h_s = float(work[j - 12:j + 13, i - 12:i + 13].max())
    k = math.tan(math.radians(C['target'])) / ((h_s - EYE - dist * dist / (2 * 6371000) * 0.87) / dist)
    # maps on the ground, the low sun of the hour
    hs = G(work, 0.8); gx = cv2.Sobel(hs, cv2.CV_32F, 1, 0, ksize=3) / (8 * step); gz = cv2.Sobel(hs, cv2.CV_32F, 0, 1, ksize=3) / (8 * step)
    e = 2.6; lb, le = math.radians(220), math.radians(14)
    L = np.array([math.cos(le) * math.sin(lb), math.sin(le), -math.cos(le) * math.cos(lb)])
    nl = np.sqrt(1 + (e * gx) ** 2 + (e * gz) ** 2)
    lam = np.clip((-e * gx * L[0] + L[1] - e * gz * L[2]) / nl, 0, 1)
    slope = np.degrees(np.arctan(np.hypot(gx, gz)))
    cs = G(work, 1.6) - G(work, 5); cl = G(work, 6) - G(work, 20)
    # a cylinder, tan(elevation) straight up the rows
    W = int(C['width'] * PX); top = math.tan(math.radians(C['target'])) + 0.05; bot = -0.015
    H = int(round((top - bot) / math.radians(C['width']) * W)); pxt = (top - bot) / H
    N = 1100; ds = C['d0'] * (C['dmax'] / C['d0']) ** (np.arange(N) / (N - 1))
    az = np.radians(C['az0'] - C['width'] / 2 + (np.arange(W) + 0.5) / W * C['width'])
    mx = ((ds[None, :] * np.sin(az)[:, None] + RAD) / step).astype(np.float32); mz = ((-ds[None, :] * np.cos(az)[:, None] + RAD) / step).astype(np.float32)
    rays = cv2.remap(work, mx, mz, cv2.INTER_LINEAR)
    ty = k * (rays - EYE - ds * ds / (2 * 6371000) * 0.87) / ds
    # what stands near (the Pelmo's own flank, Rite's shoulder) would tower over the group behind: a soft ceiling just over the named summit
    cap = math.tan(math.radians(C['target'] + 1.5)); knee = cap * 0.72
    ty = np.where(ty > knee, knee + (cap - knee) * np.tanh((ty - knee) / (cap - knee)), ty)
    rows = (top - ty) / pxt
    rc = np.minimum.accumulate(rows, axis=1)
    idx = np.full((H, W), -1, np.float32); grid = np.arange(H, dtype=np.float32)
    for c in range(W):
        idx[:, c] = np.interp(-grid, -rc[c], np.arange(N, dtype=np.float32), left=0, right=-1)
    sky = idx < 0
    i_f = np.where(sky, 0, idx)
    d = C['d0'] * (C['dmax'] / C['d0']) ** (i_f / (N - 1))
    azz = np.repeat(az[None, :], H, 0).astype(np.float32)
    px = ((d * np.sin(azz) + RAD) / step).astype(np.float32); pz = ((-d * np.cos(azz) + RAD) / step).astype(np.float32)
    sample = lambda m: cv2.remap(m, px, pz, cv2.INTER_LINEAR)
    al, la, sl, c1, c2 = sample(work), sample(lam), sample(slope), sample(cs), sample(cl)
    shape = (H, W); seed = C['seed'] * 100
    fine = fbm(shape, 90, seed + 21); blot = fbm(shape, 34, seed + 31, 3); stip = fbm(shape, 7, seed + 41, 2)
    forest = (al < 1340 + (fine - 0.5) * 240 - c2 * 3 - c1 * 2) & (sl < 58)
    # the beds: dead level ledges, read off the height of the ground so they wrap round the faces as the real ones do; thick and thin in turn
    wob2 = (fbm(shape, 60, seed + 51, 3) - 0.5) * 34
    bb = (al + wob2 + 0.2 * (np.arange(W)[None, :] / PX)) / 62; bb = bb + 0.35 * np.sin(bb * 1.3)
    fb = bb - np.floor(bb)
    light = -0.08 + 1.3 * la + 0.022 * c1 + 0.008 * c2 + (blot - 0.5) * 0.2
    bare = (~sky) & ~forest
    pc = np.percentile(light[bare], np.linspace(0, 100, 33)); light = np.interp(light, pc, np.linspace(0, 1, 33)).astype(np.float32)
    light = light + 0.1 * np.sin(np.floor(bb) * 12.9898) # each bed its own tone
    q = lambda v, steps: (np.floor(np.clip(G(v, 1.0), 0, 0.999) * steps) + 0.5) / steps
    # cut planes: each tone's edge goes through straight strokes, as a hand cuts a mountain into facets; a blur's round blobs read as cream, not rock
    lv = (np.clip(G(light, 1.0), 0, 0.999) * 7).astype(np.int32)
    img = np.empty((H, W, 3), np.float32); img[:] = hexs(ROCK[0])
    plane = np.zeros(shape, np.uint8)
    for t in range(1, 7):
        cont, _ = cv2.findContours((lv >= t).astype(np.uint8), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        cont = [cv2.approxPolyDP(c, 3.2, True) for c in cont if cv2.contourArea(c) > 40]
        # holes come back as their own contours, biggest first so the small lie on top: filled by the even-odd rule at once
        cv2.fillPoly(img, cont, tuple(float(v) for v in hexs(ROCK[t])))
        cv2.polylines(plane, cont, True, 1, 1, cv2.LINE_AA)
    # the ledges hold snow, the shallow faces and the gullies more
    gully = -c1 * 0.12 - c2 * 0.08
    ledge = (fb < 0.16 + 0.1 * blot) & (blot + stip * 0.5 > 0.62)
    snow = (ledge & (al > 1500)) | ((sl + (fine - 0.5) * 18 - gully * 7) < 30)
    snow = cv2.morphologyEx(snow.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 3), np.uint8)) > 0
    sv = np.clip(0.28 + 0.95 * la + (blot - 0.5) * 0.3, 0, 1); c = ramp(SNOW, q(sv, 4)); img[snow] = c[snow]
    fv = np.clip(0.34 + (stip - 0.5) * 1.3 + (blot - 0.5) * 0.7, 0, 1); c = ramp(FOREST, q(fv, 3)); img[forest] = c[forest]
    # the pen: one ridge going behind another, the deepest gullies, broken lines along the planes, thick on the crest
    jump = (np.abs(np.diff(i_f, axis=0, prepend=i_f[:1])) > 6) & ~sky
    gl = (c1 < -4.5) & ~forest & (cv2.Laplacian(c1, cv2.CV_32F) > 0.2)
    plane = (plane > 0) & (noise(shape, 26, 14, seed + 61) > 0.46) & ~forest & ~snow
    crest = np.argmax(~sky, axis=0)
    cres = np.zeros(shape, np.float32); cres[np.minimum(crest, H - 1), np.arange(W)] = 1
    pen = np.clip(cv2.GaussianBlur(jump.astype(np.float32), (0, 0), 0.8) * 1.7 + cv2.GaussianBlur(cres, (0, 0), 1.0) * 2.8 + G(gl.astype(np.float32), 0.6) * 0.9 + G(plane.astype(np.float32), 0.6) * 0.8, 0, 0.95)[..., None]
    img = img * (1 - pen) + INK * pen
    # air, so the far stands behind the near, but far less than the DEM's: this hand keeps its colour
    air = np.clip((d - 6000) / 30000, 0, 0.3)[..., None]
    img = img * (1 - air) + hexs('#c3b3d6') * air
    foot = (idx <= 0) & ~sky & (grid[:, None] > rc[:, 0].min())
    c = ramp(FOREST, q(fv, 3)); img[foot] = c[foot]
    img[sky] = hexs('#e6b6bd')
    img = np.clip(img, 0, 1)
    cv2.imwrite(os.path.join(OUT, f'{name}.jpg'), (img * 255 + 0.5).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 93])
    ridge = np.argmax(~sky, axis=0).astype(np.float32)
    json.dump([[round((c + 0.5) / W, 5), round(float(ridge[c]) / H, 5)] for c in range(0, W, 2)], open(os.path.join(ROOT, f'tools/panoramas/pelmo-{name}-ridge.json'), 'w'))
    su = ((br - (C['az0'] - C['width'] / 2)) % 360) / C['width']
    print(json.dumps({'name': name, 'size': [W, H], 'factor': round(k, 3), 'bearing': round(br, 2), 'true_elevation': round(math.degrees(math.atan2(C['summit'][2] - 1467, dist)), 2), 'summit_u': round(su, 5), 'width': C['width'], 'az0': C['az0'], 'highest_row': float(ridge.min()) / H, 'crest_row_at_summit': float(ridge[int(su * W)]) / H}))
    return img

def antelao():
    src = os.path.join(ROOT, 'data/raw/backdrop-photos/antelao-gemini2/antelao-repaint.jpg')
    im = cv2.imread(src).astype(np.float32) / 255; H, W = im.shape[:2]
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV); hue, sat, val = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    lum = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    # the gold of the autumn larches and the grass: what the belts do not cover goes to the winter's dark firs
    gold = (hue > 18) & (hue < 95) & (sat > 0.34) & (np.arange(H)[:, None] > H * 0.6)
    gold = G(gold.astype(np.float32), 2.0)[..., None]
    # a gradient map to the hero's ramp, half kept so the repaint's own warm and cold stay in it
    grade = ramp(ROCK, np.clip((lum - 0.1) / 0.72, 0, 1))
    out = im * 0.28 + grade * 0.72
    # snow: on what the repaint lit brightest, on the ledges and the upper gullies, and a light rime elsewhere. Its dark pen is left alone
    shape = (H, W)
    det = lum - G(lum, 9)
    blot = fbm(shape, 60, 5, 3); rows = np.arange(H, dtype=np.float32)[:, None] / H
    high = np.clip((0.62 - rows) / 0.3, 0, 1)
    snow = np.clip(((lum - 0.54) * 5 + det * 7 + (blot - 0.5) * 1.1) * (0.45 + 0.55 * high), 0, 1)
    snow = (G(snow, 0.8) > 0.5).astype(np.float32); snow = G(snow, 0.8)[..., None]
    sv = np.clip((lum - 0.25) / 0.6, 0, 1)
    out = out * (1 - snow) + ramp(SNOW, sv) * snow
    dark = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY) < 0.16
    out[dark] = (out[dark] * 0.25 + INK * 0.75)
    fir = ramp(FIR, np.clip(lum * 1.3, 0, 1))
    out = out * (1 - gold) + fir * gold
    # the last sun, rose on what stands high and faces it, as on the Pelmo's lit beds
    glow = np.clip(lum * 1.2, 0, 1)[..., None] * np.clip((0.75 - rows) / 0.5, 0, 1)[..., None]
    out = out * (1 - 0.42 * glow) + out * hexs('#ffc4b4') * 0.42 * glow
    cv2.imwrite(os.path.join(OUT, 'antelao.jpg'), (np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 93])
    print('antelao', W, H)
    return out

done = []
for name, C in CFG.items():
    if o.only and o.only != name: continue
    done.append(paint(name, C))
if not o.only or o.only == 'antelao': done.append(antelao())
if o.preview:
    w = 1000; ims = [cv2.resize(i, (w, int(i.shape[0] * w / i.shape[1])), interpolation=cv2.INTER_AREA) for i in done]
    cv2.imwrite(o.preview, (np.clip(np.vstack(ims), 0, 1) * 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 85])
