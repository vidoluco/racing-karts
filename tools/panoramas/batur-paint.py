#!/usr/bin/env python3
"""The Batur caldera and Agung, painted from their real ground: python3 -I tools/panoramas/batur-paint.py [--preview out.jpg]   after node tools/panoramas/batur-dem.mjs

Every column looks along its true bearing from the caldera's floor through Copernicus GLO-30, so the outlines are the real ones: the broad low cone of Batur with its notched top,
the rim round it, Abang's wall over the lake, Agung's cone behind. The ratio of Batur's width to its height is the real one, about 4.5 to 1, and is why this replaced the older repaint.
Black lava in fans down the cone, sparse scrub on the older ground, dark forest on the walls, no warm rim light.
Writes caldera.jpg, agung.jpg in data/raw/backdrop-photos/batur-dem-paint, tools/panoramas/batur-<id>-ridge.json, and the figures on stdout."""
import argparse, json, math, os
import numpy as np, cv2

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = os.path.join(ROOT, 'data/raw/backdrop-photos/batur-dem-paint')
A = argparse.ArgumentParser(); A.add_argument('--preview'); o = A.parse_args()
meta = json.load(open(os.path.join(OUT, 'dem.json')))
n, STEP, RAD = meta['n'], meta['step'], meta['radius']
DEM = np.fromfile(os.path.join(OUT, 'dem.bin'), np.float32).reshape(n, n)
LAT, LON = meta['center']
PX = 45
# the track's own viewpoint, whose bearings the game checks
VIEW = (-8.255, 115.351)
LAKE_LEVEL = 1036

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
def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
def locate(lat, lon, frm=(LAT, LON)):
    dx = (lon - frm[1]) * 111320 * math.cos(math.radians(LAT)); dy = (lat - frm[0]) * 111132
    return math.degrees(math.atan2(dx, dy)) % 360, math.hypot(dx, dy), dx, dy

CFG = {
  'caldera': {'summit': (-8.2369, 115.3773), 'target': 12.5, 'az0': -62, 'width': 240, 'd0': 420, 'dmax': 16000, 'far_k': 1.5},
  'agung': {'summit': (-8.3415, 115.5033), 'target': 10.4, 'az0': 66, 'width': 108, 'd0': 11500, 'dmax': 33000, 'shift': True},
}
# from the floor of the caldera. A driver is lower than a summit's first flank, and the near ground stands in the way of the far: nearer than 1.5 km the eye stands over the floor, past 3.2 km on it
EYE_NEAR, EYE_FAR = 1250.0, 1100.0
def eye_at(d): return EYE_FAR + (EYE_NEAR - EYE_FAR) * (1 - sstep(1500, 3200, d))

LAVA = ['#100f12', '#18171b', '#222126', '#2d2b31', '#3a373d', '#4b474c', '#5e595d']
ASH = ['#1d1b1e', '#28262a', '#343135', '#423e41', '#524d4f', '#66605f']
SCRUB = ['#232c20', '#2f3a29', '#3c4832', '#4d5a3c']
FOREST = ['#141f1b', '#1b2a22', '#243429', '#2f4031', '#3d4e38']
CLIFF = ['#25222a', '#332e33', '#433c3e', '#564e4c', '#6c6359']
AG_ROCK = ['#37334e', '#433e5a', '#504a66', '#5f5974', '#716a84', '#857d94', '#9a90a4']
AG_WOOD = ['#2f3a4c', '#3a4656', '#465260', '#546068']
AIR = hexs('#a08f9e')

# Batur's summit, on the grid: every fan and gully falls from here
_, _, SX, SY = locate(-8.2369, 115.3773)

def paint(name, C):
    br, dist, dx, dy = locate(*C['summit'])
    true_br = locate(*C['summit'], VIEW)[0]
    i = int((dx + RAD) / STEP); j = int((-dy + RAD) / STEP)
    h_s = float(DEM[j - 14:j + 15, i - 14:i + 15].max())
    k0 = math.tan(math.radians(C['target'])) * dist / (h_s - float(eye_at(np.float32(dist))) - dist * dist / (2 * 6371000) * 0.87)
    # the ground's own maps
    hs = G(DEM, 0.7); gx = cv2.Sobel(hs, cv2.CV_32F, 1, 0, ksize=3) / (8 * STEP); gz = cv2.Sobel(hs, cv2.CV_32F, 0, 1, ksize=3) / (8 * STEP)
    e, lb, le = 2.2, math.radians(248), math.radians(24)
    L = np.array([math.cos(le) * math.sin(lb), math.sin(le), -math.cos(le) * math.cos(lb)])
    lam = np.clip((-e * gx * L[0] + L[1] - e * gz * L[2]) / np.sqrt(1 + (e * gx) ** 2 + (e * gz) ** 2), 0, 1)
    slope = np.degrees(np.arctan(np.hypot(gx, gz)))
    cs = G(DEM, 1.1) - G(DEM, 4); cl = G(DEM, 5) - G(DEM, 16)
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32); X = xx * STEP - RAD; Z = yy * STEP - RAD
    rB = np.hypot(X - SX, Z + SY); thB = np.arctan2(X - SX, -(Z + SY))
    # the picture: a cylinder, tan(elevation) straight up the rows
    W = int(C['width'] * PX); top = math.tan(math.radians(C['target'])) + 0.05; bot = -0.016
    H = int(round((top - bot) / math.radians(C['width']) * W)); pxt = (top - bot) / H
    N = 1500; ds = C['d0'] * (C['dmax'] / C['d0']) ** (np.arange(N) / (N - 1)); ds = ds.astype(np.float32)
    # the far things a long lens brings closer, Batur itself by the factor that sets its true height
    kd = (k0 + (C.get('far_k', k0) - k0) * sstep(2800, 6000, ds)).astype(np.float32)
    # Agung seen from the floor stands a few degrees right of where it stands from the track's own viewpoint: the picture is laid at that one
    off = (br - true_br) if C.get('shift') else 0.0
    az_d = C['az0'] + (np.arange(W) + 0.5) / W * C['width']
    az = np.radians(az_d + off)
    mx = ((ds[None, :] * np.sin(az)[:, None] + RAD) / STEP).astype(np.float32); mz = ((-ds[None, :] * np.cos(az)[:, None] + RAD) / STEP).astype(np.float32)
    rays = cv2.remap(DEM, mx, mz, cv2.INTER_LINEAR)
    ty = kd * (rays - eye_at(ds) - ds * ds / (2 * 6371000) * 0.87) / ds
    rows = (top - ty) / pxt
    # off the cone the near hummocks of the floor are not what stands there: the walls are
    if name == 'caldera':
        dc = 400 + 2000 * (1 - sstep(8, 26, np.minimum((az_d - 20) % 360, (20 - az_d) % 360)) * 0 - (sstep(6, 22, (az_d - 0) % 360) * (1 - sstep(96, 112, (az_d - 0) % 360))))
        rows = np.where(ds[None, :] < dc[:, None], float(H + 40), rows).astype(np.float32)
    rc = np.minimum.accumulate(rows, axis=1)
    idx = np.full((H, W), -1, np.float32); grid = np.arange(H, dtype=np.float32)
    for c in range(W):
        idx[:, c] = np.interp(-grid, -rc[c], np.arange(N, dtype=np.float32), left=0, right=-1)
    sky = idx < 0
    i_f = np.where(sky, 0, idx)
    d = C['d0'] * (C['dmax'] / C['d0']) ** (i_f / (N - 1))
    azz = np.repeat(az[None, :], H, 0).astype(np.float32)
    px = ((d * np.sin(azz) + RAD) / STEP).astype(np.float32); pz = ((-d * np.cos(azz) + RAD) / STEP).astype(np.float32)
    sample = lambda m: cv2.remap(m, px, pz, cv2.INTER_LINEAR)
    base, la, sl, c1, c2, r, th = sample(DEM), sample(lam), sample(slope), sample(cs), sample(cl), sample(rB), sample(thB)
    shape = (H, W)
    fine, blot, stip = fbm(shape, 80, 21), fbm(shape, 28, 31, 3), fbm(shape, 5, 41, 2)
    q = lambda v, steps: (np.floor(np.clip(G(v, 0.8), 0, 0.999) * steps) + 0.5) / steps
    tone = np.clip(0.02 + 1.1 * la + 0.025 * c1 + 0.008 * c2 + (blot - 0.5) * 0.14, 0, 1)
    if name == 'agung':
        # the cone's flutes are the real ones: read them harder
        tone = np.clip(-0.04 + 0.78 * la + 0.05 * c1 + 0.012 * c2 + (blot - 0.5) * 0.1, 0, 1)
        img = ramp(AG_ROCK, q(tone, 8))
        wood = (base < 1750 + (fine - 0.5) * 500 - c2 * 1.6)
        c = ramp(AG_WOOD, q(np.clip(0.2 + 0.9 * la + (stip - 0.5) * 0.7, 0, 1), 4)); img[wood] = c[wood]
    else:
        # the walls: forest, its cliffs bare
        img = ramp(FOREST, q(np.clip(0.02 + 0.8 * la + (stip - 0.5) * 0.8 + (blot - 0.5) * 0.25, 0, 1), 5))
        cliff = (sl > 47 + 12 * (fine - 0.5))
        c = ramp(CLIFF, q(np.clip(0.0 + 0.7 * la + 0.03 * c1, 0, 1), 5)); img[cliff] = c[cliff]
        # the cone: its fans of black lava fall from the summit and spread, older ash and thin scrub between them. 3.9 km is the cone and the flows at its foot, not the far rim behind
        cone = (r < 3700 + 500 * (fine - 0.5)) & (d < 4400) & (base > LAKE_LEVEL) & (((azz * 180 / math.pi + 12) % 360) < 140)
        ang = (th / (2 * math.pi) + 0.5) % 1.0
        nn = 720; R = np.random.default_rng(5); v1 = np.cumsum(R.normal(0, 1, nn)); v1 = (v1 - v1.min()) / (v1.max() - v1.min())
        fan = np.interp(ang * 9 % 1, np.linspace(0, 1, nn), v1).astype(np.float32) * 0.55 + np.interp(ang * 23 % 1, np.linspace(0, 1, nn), R.random(nn)).astype(np.float32) * 0.45
        tongues = fan + (fine - 0.5) * 0.34 + 0.16 * sstep(600, 3000, r)
        black = tongues > 0.5
        ash = ramp(ASH, q(tone * 0.62, 6)); lv = ramp(LAVA, q(np.clip(tone * 0.5 + 0.012 * c1, 0, 1), 7))
        cn = np.where(black[..., None], lv, ash)
        # thin scrub: a scatter that thickens low on the old ground, never over the fresh lava
        scr = (~black) & (stip * 0.55 + blot * 0.45 + 0.13 * sstep(500, 2800, r) - 0.14 * sstep(1500, 1250, base) > 0.6)
        cs_ = ramp(SCRUB, q(np.clip(0.1 + 1.0 * la + (stip - 0.5) * 1.2, 0, 1), 4)); cn = np.where(scr[..., None], cs_, cn)
        # the gullies down the cone, a line each
        gully = (c1 < -3.2) & (r < 2600)
        cn = np.where(gully[..., None], cn * 0.72, cn)
        img = np.where(cone[..., None], cn, img)
        # the lake: the far wall stands straight out of it
        lake = (base <= LAKE_LEVEL) & (d > 2500) & ~sky
        wc = np.array(hexs('#3f6670')) * (0.86 + 0.28 * noise(shape, 260, 3, 77))[..., None]
        img = np.where(lake[..., None], wc, img)
    # a thin pen where one ridge passes behind another
    jump = np.abs(np.diff(i_f, axis=0, prepend=i_f[:1])) > 9
    jump[sky] = False
    pen = np.clip(G(jump.astype(np.float32), 0.7) * 1.5, 0, 0.75)[..., None]
    img = img * (1 - pen) + hexs('#0e0d14') * pen
    # air: little over the cone close by, more each ridge further
    air = np.clip((d - 2600) / 40000, 0, 0.4)[..., None] if name != 'agung' else np.clip(0.1 + (d - 12000) / 80000, 0, 0.3)[..., None]
    img = img * (1 - air) + AIR * air
    foot = (idx <= 0) & ~sky
    img[foot] = hexs(LAVA[1] if name == 'caldera' else AG_WOOD[1])
    img[sky] = hexs('#f8c8bc')
    img = np.clip(img, 0, 1)
    cv2.imwrite(os.path.join(OUT, f'{name}.jpg'), (img * 255 + 0.5).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 93])
    ridge = np.argmax(~sky, axis=0).astype(np.float32)
    ru = [[round((c + 0.5) / W, 5), round(float(ridge[c]) / H, 5)] for c in range(0, W, 2)]
    json.dump(ru, open(os.path.join(ROOT, f'tools/panoramas/batur-{name}-ridge.json'), 'w'))
    su = (true_br - C['az0']) / C['width'] if C['az0'] >= 0 else ((true_br - C['az0'] + 180) % 360 - 180) / C['width']
    print(json.dumps({'name': name, 'size': [W, H], 'factor': round(k0, 3), 'bearing_true': round(true_br, 2), 'summit_u': round(su, 5), 'crest_row_at_summit': float(ridge[int(su * W)]) / H, 'd': round(dist)}))
    return img

done = [paint(k, C) for k, C in CFG.items()]
if o.preview:
    w = 1000; ims = [cv2.resize(i, (w, int(i.shape[0] * w / i.shape[1])), interpolation=cv2.INTER_AREA) for i in done]
    cv2.imwrite(o.preview, (np.vstack(ims) * 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 85])
