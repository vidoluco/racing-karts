#!/usr/bin/env python3
"""The Tengger caldera at dawn, one closed panorama for tiles: python3 -I tools/panoramas/bromo-paint.py [--preview p.jpg] [--out dir] [--quality q]

The whole hand repaint of Jakub Halun's photo is the hero (tools/panoramas/bromo.json, painted: true): Bromo with its plume, Semeru on its true bearing, fluted Batok
and the wall behind them, big, with its floor cleaned to one sand glowing at dawn. Round the rest of the circle the wall goes on in the repaint's own colours under
the sky read off its two ends. Where the 3D wall stands the painted one stays under it, so the two never make tiers. Prints the panels for def.backdrops on stdout."""
import argparse, json, math, os, sys
import numpy as np, cv2
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
PPD, SS, TOP_TAN, BOT_TAN = 30, 1.5, 0.6, -0.052
# Painted at 45 px per degree and kept at that, so the far things are as crisp as the near ones on a 1080p frame.
OUT_PPD = 45
CENTER, ALT = (-7.916, 112.953), 2124
RECIPE = json.load(open(os.path.join(ROOT, 'tools/panoramas/bromo.json'), encoding='utf8'))
HERO = RECIPE['photos'][-1]
MIST = RECIPE['mist']
# The sand of the floor, from where it leaves the cones' feet to the horizon: the repaint's rose lifted into the first light.
SAND_RAMP = ['#e6a48e', '#eeb196', MIST]
H0_FALL = HERO['fall']
SEMERU = {k: HERO['summit'][k] for k in ('name', 'lat', 'lon', 'altitude')}

def hexrgb(h): return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255
def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
def blur(a, s): return cv2.GaussianBlur(a, (0, 0), float(s))
def ramp(t, names):
    c = np.stack([hexrgb(n) for n in names]); x = np.linspace(0, 1, len(names))
    return np.stack([np.interp(t, x, c[:, k]) for k in range(3)], -1).astype(np.float32)
def bearing_to(a, b):
    la, lo, lb, lob = map(math.radians, (a[0], a[1], b[0], b[1]))
    y, x = math.sin(lob - lo) * math.cos(lb), math.cos(la) * math.sin(lb) - math.sin(la) * math.cos(lb) * math.cos(lob - lo)
    d = 2 * 6371000 * math.asin(math.sqrt(math.sin((lb - la) / 2) ** 2 + math.cos(la) * math.cos(lb) * math.sin((lob - lo) / 2) ** 2))
    return (math.degrees(math.atan2(y, x)) + 360) % 360, d
def fbm1(n, cells, seed, oct=4, wrap=True):
    """Periodic 1D noise, n samples, in about 0..1."""
    rng = np.random.default_rng(seed); out = np.zeros(n, np.float32); amp = 1.0; tot = 0.0; c = cells
    for _ in range(oct):
        v = rng.random(int(c)); xs = np.arange(n, dtype=np.float32) / n * c; i = np.floor(xs).astype(int); f = xs - i; f = f * f * (3 - 2 * f)
        out += amp * (v[i % int(c)] * (1 - f) + v[(i + 1) % int(c)] * f); tot += amp; amp *= 0.5; c *= 2
    return out / tot
def fbm2(h, w, sx, sy, seed, oct=4):
    """2D value noise wrapping in x: sx, sy are the cell sizes in px of the first octave."""
    rng = np.random.default_rng(seed); out = np.zeros((h, w), np.float32); amp = 1.0; tot = 0.0
    for _ in range(oct):
        cw, ch = max(2, int(round(w / sx))), max(2, int(round(h / sy)))
        g = rng.random((ch + 2, cw)).astype(np.float32); g = np.hstack([g, g[:, :1]])
        out += amp * cv2.resize(g, (w + int(w / cw), h + int(h / ch)), interpolation=cv2.INTER_CUBIC)[:h, :w]; tot += amp; amp *= 0.5; sx = max(2, sx / 2); sy = max(2, sy / 2)
    return np.clip(out / tot, 0, 1)

class Canvas:
    def __init__(s):
        s.ppd = PPD * SS; s.ptan = s.ppd * 180 / math.pi; s.W = int(round(360 * s.ppd)); s.H = int(round((TOP_TAN - BOT_TAN) * s.ptan))
        s.row_tan = TOP_TAN - (np.arange(s.H, dtype=np.float32) + 0.5) / s.ptan; s.row_el = np.degrees(np.arctan(s.row_tan))
    def row_of(s, el): return (TOP_TAN - math.tan(math.radians(el))) * s.ptan

# The sky read off the repaint, by the fraction v of its height: its left end, on the sunrise side, and its right end. Everything round the circle is a mix of the two, so the painting's own sky goes on with no seam.
SKY_L = [(-0.2, '#8e94ce'), (0, '#9d9fd1'), (0.05, '#a6a3d1'), (0.1, '#b6a7cf'), (0.15, '#c4aac9'), (0.2, '#d1aec3'), (0.25, '#e1b2bd'), (0.3, '#efb6b5'), (0.35, '#f9b9ad'), (0.4, '#fec1a6'), (0.5, '#ffc8a2'), (1.0, '#ffcda4')]
SKY_R = [(-0.2, '#8a92ce'), (0, '#9097d1'), (0.1, '#9399d2'), (0.15, '#9b9cd3'), (0.2, '#a3a0d2'), (0.25, '#ada3ce'), (0.3, '#bda9cd'), (0.35, '#cbacc8'), (0.4, '#dcb3c0'), (0.5, '#eebfb8'), (0.62, '#f4c6b2'), (1.0, '#f6caae')]
SUN_B = 100.0
def table(rows, stops):
    xs, cs = [v for v, _ in stops], np.stack([hexrgb(h) for _, h in stops])
    return np.stack([np.interp(rows, xs, cs[:, k]) for k in range(3)], 1).astype(np.float32)
def paint_sky(C, H):
    v = (np.arange(C.H, dtype=np.float32) - H['y0']) / H['H']
    L, R = table(v, SKY_L)[:, None, :], table(v, SKY_R)[:, None, :]
    bb = np.arange(C.W, dtype=np.float32) / C.ppd
    ub = np.where(bb < H['b0'], bb + 360, bb)
    # L at the painting's left end and on round the sunrise, R at its right end; across the painting they cross, under its own sky
    f = np.where(ub <= H['b1'], sstep(H['b1'], H['b0'], ub), sstep(H['b1'] + 70, H['b0'] + 360 - 90, ub))[None, :, None].astype(np.float32)
    sky = R * (1 - f) + L * f
    # the sun about to come up behind the low part of the wall
    da = np.abs(((bb - SUN_B + 180) % 360) - 180)
    glow = (np.exp(-(da / 34) ** 2)[None, :] * np.exp(-np.clip(C.row_el[:, None], 0, None) / 7))[..., None].astype(np.float32)
    return sky * (1 - 0.45 * glow) + hexrgb('#ffdca8') * 0.45 * glow

def paint_hero(C):
    """The repaint at its size on the cylinder, with its alpha: its own sky and its land fade at the two ends, where the painted wall takes over at the same height."""
    H0 = HERO
    im = np.asarray(Image.open(os.path.join(ROOT, 'data/raw/backdrop-photos', H0['id'], H0['file'])).convert('RGB'), dtype=np.float32) / 255
    h0, w0 = im.shape[:2]; k = C.ppd * H0['width'] / w0
    W, H = int(round(w0 * k)), int(round(h0 * k))
    rgb = cv2.resize(im, (W, H), interpolation=cv2.INTER_CUBIC)
    rd = json.load(open(os.path.join(ROOT, H0['ridge_file'])))
    # The skyline at the two ends, where the wall takes over from it. Rows on the repaint at 1000 px wide.
    FAR = [(0, 180), (0.06, 182), (0.12, 178), (0.5, 150), (0.88, 165), (0.93, 146), (0.96, 133), (1, 158)]
    uu = [p[0] for p in FAR]; vv = [p[1] / 424 for p in FAR]
    ridge = np.interp((np.arange(W) + 0.5) / W, uu, [v * H for v in vv]).astype(np.float32)
    xx = np.arange(W, dtype=np.float32); yy = np.arange(H, dtype=np.float32)[:, None]
    # The floor: below the feet of the cones one clean sand, glowing, with the tiny huts and jeep rows gone. The feet are traced by eye, at 1000 px wide.
    FEET = [(0, 338), (0.1, 336), (0.2, 344), (0.28, 350), (0.36, 358), (0.42, 372), (0.5, 386), (0.62, 388), (0.75, 392), (0.88, 386), (1, 374)]
    foot = np.interp(xx / W, [p[0] for p in FEET], [p[1] * W / 1000 for p in FEET]).astype(np.float32)[None, :]
    sand = sstep(0, 0.012 * H, yy - foot)[..., None].astype(np.float32)
    v = yy / H
    glow = ramp(np.clip((v - 0.78) / 0.12, 0, 1)[:, 0], SAND_RAMP)[:, None, :]
    rgb = rgb * (1 - sand) + glow * sand
    fl, fr = H0['fall'][0] * C.ppd, H0['fall'][1] * C.ppd
    a = np.repeat(sstep(0, 1, np.minimum(xx / fl, xx[::-1] / fr))[None, :], H, 0)
    y0 = int(round(C.row_of(0) - H0['horizon_v'] * H))
    bearing, dist = bearing_to(CENTER, (SEMERU['lat'], SEMERU['lon']))
    x0 = int(round(bearing * C.ppd - H0['summit']['u'] * W))
    el = lambda v: math.degrees(math.atan(TOP_TAN - (y0 + v * H) / C.ptan))
    return {'rgb': rgb, 'a': a.astype(np.float32), 'W': W, 'H': H, 'x0': x0, 'y0': y0, 'k': k, 'el': el, 'bearing': bearing, 'dist': dist, 'b0': x0 / C.ppd, 'b1': (x0 + W) / C.ppd,
            'ridge_u': (np.arange(W) + 0.5) / W, 'ridge_el': np.degrees(np.arctan(TOP_TAN - (y0 + ridge) / C.ptan)),
            'el_left': el(ridge[int(0.004 * W)] / H), 'el_right': el(ridge[int(0.996 * W)] / H), 'top_row': y0 + H0['summit']['v'] * H}

def lay(out, rgb, a, X, Y0):
    """rgb with alpha a onto a canvas wrapping in x, at left column X and top row Y0."""
    Wc, Hc = out.shape[1], out.shape[0]
    h, w = a.shape
    r0, r1 = max(0, Y0), min(Hc, Y0 + h)
    cols = (X + np.arange(w)) % Wc
    d = out[r0:r1][:, cols]; A = a[r0 - Y0:r1 - Y0][..., None]; S = rgb[r0 - Y0:r1 - Y0]
    out[r0:r1][:, cols] = d * (1 - A) + S * A

# The wall's rim on the rest of the circle: true bearing, elevation. On the west it is what you see of the wall; from 320 round to 126 the 3D wall stands in front, at 8 degrees or more from anywhere on the road, and the painting stays under it.
RIM = [(240, 15.5), (252, 12.5), (266, 10.6), (280, 10.4), (296, 9), (312, 6.5), (330, 4), (360, 3.5), (400, 3.5), (440, 3.5), (470, 3.5), (482, 6), (492, 12)]
# Every tone off the repaint: rose ribs and mauve gullies where the light comes across, slate violet in the air, olive scrub that goes to violet in its shade.
R_wall2 = ['#7a5a78', '#94687c', '#ae7a80', '#c68c84', '#d89c88', '#e6ae94', '#f0c0a4']
R_cold = ['#6c5a80', '#7e6688', '#927490', '#a68296', '#b89298', '#c8a29c', '#d6b2a4']
R_warm = ['#805e78', '#9a6c7c', '#b47c80', '#ca8e84', '#dca08a', '#ecb498', '#f6c8ac']
R_veg = ['#5c5a58', '#6c6a54', '#7c7a52', '#8e8a54', '#a09a58', '#b2aa60', '#c2b86c']
R_slate = ['#6a5a84', '#766490', '#846e96', '#92789c', '#a084a0', '#ae90a4', '#bc9ca8']

def gullies(C, depth, seed):
    """The wall's drainage, the way the 3D wall in front of it paints its own: noise in long cells down the fall line, three sizes of them, leaning as the wall fans out, so a gully is soft, wanders and ends. Strokes read as twigs, and an even row as a comb."""
    W, Hc, ppd = C.W, C.H, C.ppd
    n = (0.42 * fbm2(Hc, W, 1.05 * ppd, 12 * ppd, seed, 1) + 0.34 * fbm2(Hc, W, 0.46 * ppd, 8 * ppd, seed + 1, 1) + 0.24 * fbm2(Hc, W, 0.2 * ppd, 3.4 * ppd, seed + 2, 1)).astype(np.float32)
    fan = (fbm1(W, 22, seed + 3, 2) - 0.5) * 2.0
    wander = (fbm2(Hc, W, 500, 260, seed + 4, 2) - 0.5) * 1.0 * ppd
    mx = (np.arange(W, dtype=np.float32)[None, :] + fan[None, :] * np.clip(depth, 0, 24).astype(np.float32) * ppd * 0.45 + wander).astype(np.float32)
    my = np.repeat(np.arange(Hc, dtype=np.float32)[:, None], W, 1)
    return cv2.remap(n, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_WRAP)

def paint_wall(C, out, H, seed, lift, haze, foot_el, tone_gain=1.0, wander=0.0):
    """A wall as a painter lays one in: a nearly level rim, gullies running down from it that deepen and fan, lit by the low sun from the side it comes from. Everything but the photo's bearings."""
    W, Hc = C.W, C.H
    bb = np.arange(W, dtype=np.float32) / C.ppd
    b0, b1 = H['b0'], H['b1']
    ub = np.where(bb < b0, bb + 360, bb)
    # each end of the painting's ridge goes on at its own height
    rr = [(b1, H['el_right'])] + RIM + [(b0 + 360, H['el_left'])]
    rim = np.interp(ub, *zip(*rr)) + lift
    if wander: rim = rim - wander * fbm1(W, 7, seed + 20, 3) * 1.6 * sstep(4, 16, np.abs(bb - 188.9))
    # under the painting's fading ends the wall runs along the painting's own ridge, so nothing ghosts
    inh = (bb >= b0) & (bb < b1)
    rim = np.where(inh, np.interp((bb - b0) / (b1 - b0), H['ridge_u'], H['ridge_el']) + lift, rim)
    # rough everywhere but under Semeru, whose foot has to stay in it
    rough = sstep(5, 15, np.abs(bb - 188.9))
    rim = rim + rough * ((fbm1(W, 26, seed + 9, 3) - 0.5) * 3.4 + (fbm1(W, 90, seed, 5) - 0.5) * 1.8) + (fbm1(W, 700, seed + 1, 3) - 0.5) * 0.5
    rim_row = (TOP_TAN - np.tan(np.radians(rim))) * C.ptan
    yy = np.arange(Hc, dtype=np.float32)[:, None]
    depth = (yy - rim_row[None, :]) / C.ppd                  # degrees under the rim
    land = np.clip(depth * C.ppd + 0.5, 0, 1).astype(np.float32) * (C.row_el[:, None] > foot_el)
    # the broad forms: great spurs in soft light, leaning down their fall lines, never a column of bars
    d = np.clip(depth, 0, 24).astype(np.float32)
    fan = (fbm1(W, 22, seed + 2, 2) - 0.5) * 2.0
    x = (np.arange(W, dtype=np.float32)[None, :] + fan[None, :] * d * C.ppd * 0.5 + (fbm2(Hc, W, 700, 240, seed + 3, 2) - 0.5) * 60 * SS)
    n = 65536
    spur = fbm1(n, 18, seed + 4, 2)[(x % W * (n / W)).astype(int) % n]
    spur = blur(spur, 2 * SS)
    dgx = cv2.Sobel(spur, cv2.CV_32F, 1, 0, ksize=3) / 8
    # which side the sun is on, seen from here, and how much of its face this wall turns to it
    side = np.sin(np.radians(SUN_B - bb)).astype(np.float32)[None, :]
    face = np.cos(np.radians((bb + 180) - SUN_B)).astype(np.float32)[None, :]
    # near the painting's left end the wall goes into the slate of its far wall, so one becomes the other
    swap = sstep(165, 215, bb).astype(np.float32)[None, :]
    join = sstep(b0 - 34, b0 - 2, bb).astype(np.float32)[None, :] * (1 - swap)
    light = np.clip(dgx * 900, -1, 1) * (0.25 + 0.75 * np.abs(side)) * np.sign(side + 1e-3)
    broad = fbm2(Hc, W, 800, 300, seed + 7, 2) - 0.5
    g = gullies(C, depth, seed + 30)
    # one wall of each gully takes the low sun, the other lies in its shade; right under the rim they have not started yet
    start = sstep(0.1, 1.6, depth).astype(np.float32)
    gs = cv2.Sobel(blur(g, 0.45 * SS), cv2.CV_32F, 1, 0, ksize=3) / 8
    gl = np.clip(gs * 52, -1, 1) * (0.3 + 0.7 * np.abs(side)) * np.sign(side + 1e-3) * start
    dark = sstep(0.54, 0.38, g) * start
    t = 0.5 + light * 0.14 + broad * 0.13 + 0.1 * face - 0.004 * d
    t = np.clip(t + (g - 0.5) * 0.24 * start * tone_gain - dark * 0.06 * tone_gain + gl * 0.1 * tone_gain, 0, 1)
    q = t * 7; t = blur(((np.floor(q) + sstep(0.38, 0.62, q - np.floor(q))) / 7).astype(np.float32), 0.25 * SS)
    warm = sstep(-0.6, 0.5, face)[..., None]
    col = ramp(t, R_cold) * (1 - warm) + ramp(t, R_warm) * warm
    # dry grass above, olive scrub in soft drifts on the lower slopes and in the great gullies
    veg = sstep(0.34, 0.6, fbm2(Hc, W, 420, 170, seed + 8, 3) * 0.7 + (1 - spur) * 0.1 + 0.022 * d)
    veg = veg * 0.45 + 0.55 * np.maximum(veg, blur(dark, 2 * SS) * sstep(0.8, 5, d) * 0.9)
    col = col * (1 - veg[..., None] * 0.8) + ramp(np.clip(t * 0.9, 0, 1), R_veg) * veg[..., None] * 0.8
    col = col * (1 - join[..., None] * 0.8) + ramp(t, R_slate) * join[..., None] * 0.8
    # a thin warm light on the crest where the sun can reach it
    crest = np.exp(-np.maximum(depth, 0) / 0.5).astype(np.float32) * np.clip(face + 0.2, 0, 1)
    col = col * (1 - 0.16 * crest[..., None]) + hexrgb('#f0c99a') * 0.16 * crest[..., None]
 
    # beside the photo's right end it is the photo's own wall, in its colours and at its distance
    join2 = (sstep(b1 + 32, b1 + 2, bb).astype(np.float32)[None, :] * swap)[..., None]
    col = col * (1 - join2) + ramp(np.clip(t - 0.1, 0, 1), R_wall2) * join2
    if haze:
        haze = haze * (1 - 0.8 * join2)
        air = np.stack([np.interp(C.row_el, [0, 4, 9, 16], [hexrgb(h)[k] for h in ('#ecbca6', '#dcaeac', '#c8a4b8', '#b09cc4')]) for k in range(3)], 1)[:, None, :]
        col = col * (1 - haze) + air * haze
    # beside its two ends it comes down to the painting's own depth of tone, measured off the painting, and lifts into the air further round
    col = col * (1 - join2 * (1 - np.array([0.76, 0.74, 0.86], np.float32))) * (1 - join[..., None] * (1 - np.array([0.82, 0.82, 0.88], np.float32)))
    # the pen, as thin as the painting's: on the crest, and down the shaded side of the deep gullies
    gd = np.clip(-gs * np.sign(side + 1e-3) * 60, 0, 1) * sstep(0.46, 0.34, g) * start
    pen = np.clip(np.exp(-((depth * C.ppd - 1.0) / 1.6) ** 2) * 0.62 + gd * 0.18, 0, 1).astype(np.float32)[..., None]
    col = col * (1 - pen) + hexrgb('#35284a') * pen
    a = land[..., None]
    out[:] = out * (1 - a) + col * a

def paint_mist(C, out, x_hero):
    """The first light lying on the floor: at the very foot the air is the far floor's own colour, with one low warm bank on it, soft and clean, nothing ruled about where it starts."""
    W, Hc = C.W, C.H
    n = fbm2(Hc, W, 1500, 40, 22, 2)
    banks = sstep(0.3, 0.62, fbm1(W, 12, 72, 2))[None, :]
    env = sstep(2.6, 0.5, C.row_el[:, None] + (n - 0.5) * 2.0)
    a = blur((env * banks * 0.5).astype(np.float32), 2 * SS)[..., None] * (C.row_el[:, None, None] > -1)
    out[:] = out * (1 - a) + hexrgb('#f8d4b4') * a
    n = fbm2(Hc, W, 1500, 30, 29, 2)
    foot = sstep(0.5 + 1.1 * n, 0.05, C.row_el[:, None])[..., None].astype(np.float32)
    out[:] = out * (1 - foot) + hexrgb(MIST) * foot

def main():
    A = argparse.ArgumentParser()
    A.add_argument('--preview'); A.add_argument('--out', default=os.path.join(ROOT, 'assets/backdrops')); A.add_argument('--quality', type=int, default=RECIPE['tiles']['quality']); A.add_argument('--no-tiles', action='store_true')
    o = A.parse_args()
    C = Canvas()
    H = paint_hero(C)
    bearing, dist = H['bearing'], H['dist']
    out = paint_sky(C, H)
    # the wall round the circle, far then a lower nearer one, the floor under it all
    paint_wall(C, out, H, 41, 0.0, 0.2, 0.2, 0.55)
    paint_wall(C, out, H, 61, -1.6, 0.08, 0.2, 0.6, wander=4.0)
    # the floor stands highest under the painting's left end, where its own sand comes up to Bromo's foot: it comes up to meet it, so the painting's floor does not stop in a step
    bb = np.arange(C.W, dtype=np.float32) / C.ppd
    top = 0.5 + 3.3 * sstep(H['b0'] - 24, H['b0'] + 3, bb) * sstep(H['b0'] + 40, H['b0'] + 10, bb)
    floor = (C.row_el[:, None] < top[None, :]).astype(np.float32); floor = blur(floor, 2)[..., None]
    fc = np.stack([np.interp(C.row_el, [-4, 0.5], [hexrgb('#e0a48c')[k], hexrgb(MIST)[k]]) for k in range(3)], 1)[:, None, :]
    out[:] = out * (1 - floor) + fc * floor
    # the hero: Semeru's top on its true bearing
    x0 = H['x0']
    lay(out, H['rgb'], H['a'], x0, H['y0'])
    print(f"painting from {H['b0']:.1f} to {H['b1']:.1f}; ends {H['el_left']:.1f}, {H['el_right']:.1f}", file=sys.stderr)
    paint_mist(C, out, x0)
    # down to its final size
    W, Hf = int(round(360 * OUT_PPD)), int(round((TOP_TAN - BOT_TAN) * OUT_PPD * 180 / math.pi))
    pad, shrink = 8, C.ppd / OUT_PPD
    wrapped = np.hstack([out[:, -pad:], out, out[:, :pad]])
    small = cv2.resize(wrapped, (W + int(round(2 * pad / shrink)), Hf), interpolation=cv2.INTER_AREA)
    small = small[:, int(round(pad / shrink)):int(round(pad / shrink)) + W]
    if o.preview:
        pv = cv2.resize(small, (W // 3, Hf // 3), interpolation=cv2.INTER_AREA)
        Image.fromarray((np.clip(pv, 0, 1) * 255 + 0.5).astype(np.uint8)).save(o.preview, quality=90)
    if o.no_tiles:
        return
    ptan = OUT_PPD * 180 / math.pi
    top_row = H['top_row'] / shrink      # on the final image
    el = math.degrees(math.atan(TOP_TAN - top_row / ptan))
    true_el = math.degrees(math.atan2(SEMERU['altitude'] - ALT, dist))
    print(f'Semeru: bearing {bearing:.1f}, true {true_el:.1f} deg, painted {el:.1f} deg', file=sys.stderr)
    panels, total = [], 0
    half = 31
    for c in (0, 60, 120, 180, 240, 300):
        x = int(round((c - half) * OUT_PPD)); cols = (x + np.arange(2 * half * OUT_PPD)) % W
        name = f'bromo-pano-{c:03d}.jpg'; path = os.path.join(o.out, name)
        Image.fromarray((np.clip(small[:, cols], 0, 1) * 255 + 0.5).astype(np.uint8)).save(path, quality=o.quality, subsampling=1, optimize=True, progressive=True)
        total += os.path.getsize(path)
        q = {'file': name, 'width': 2 * half, 'edge': 0, 'rise': 0, 'baseHaze': [1, 1.01, 0], 'mist': MIST}
        if c == 180:
            q['summit'] = {**SEMERU, 'u': round(0.5 + (bearing - c) / (2 * half), 5), 'row': round(top_row / Hf, 5)}
            q['elevation'] = round(el, 2)
            q['compressed'] = f'true {true_el:.1f} deg: Semeru stands as the classic views of the caldera show it, filling the skyline behind Bromo and Batok, which is what names the place'
        else:
            q['bearing'] = c; q['elevation'] = 0; q['row'] = round(TOP_TAN * ptan / Hf, 5)
        panels.append(q)
    print(f'{total / 1048576:.2f} MB', file=sys.stderr)
    print(',\n'.join('    ' + json.dumps(q, ensure_ascii=False) for q in panels))

if __name__ == '__main__':
    main()
