#!/usr/bin/env python3
"""One continuous painted panorama round a track, from real photos and the real DEM, cut into tiles for def.backdrops. Local, no network.

  python3 -I tools/compose-panorama.py tools/panoramas/<track>.json [--preview out.jpg] [--out dir] [--quality q]

Why one picture: panels with their own edges fade into nothing mid ridge, and their feet hang in the air. Here everything is painted once, on one cylinder, by one painter, back to front:
  1. The sky of the hour, with clouds, the same all round.
  2. The real DEM seen from the track's place, in the same cel paint: rock in hard tones, forest tree by tree, far ranges into the haze. It fills every gap, so no ridge ever ends in air.
  3. The great mountains, each at its true bearing and elevation, cut out along its ridge, every one through paint-photo.py's planes(), so they are all by one hand; a finished repaint can stay as it is (`painted`). A photo that stops mid ridge goes on with another photo of the same mountain (`flank`). Near its sides a ridge falls to the DEM's skyline and melts land into land.
  4. One forest, in mass (paint_forest): on what the photos show as forest, on the DEM, on the ridges in front of everything. The rock always comes down behind a slope, and that slope stands behind the near 3D trees.
Prints the panels to paste into the track file and the kilobytes. Originals stay in data/raw/backdrop-photos; photos per tile on stderr, credits by hand in assets/backdrops/CREDITS.md.
"""
import argparse
import importlib.util
import json
import math
import os
import sys

import cv2
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
spec = importlib.util.spec_from_file_location('paint_photo', os.path.join(HERE, 'paint-photo.py'))
pp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pp)
smoothstep, hexrgb, ramp, apply_ramp, posterise, stamp_forest = pp.smoothstep, pp.hexrgb, pp.ramp, pp.apply_ramp, pp.posterise, pp.stamp_forest

SS = 1.5  # everything is painted bigger and scaled down: the pen and the tree edges come out clean


def wrap_noise(H, W, sx, sy, seed, octaves=4):
    """Value noise 0..1 that closes round the panorama. sx, sy: size of the big features, px."""
    rng = np.random.default_rng(seed)
    out, amp, tot = np.zeros((H, W), np.float32), 1.0, 0.0
    for o in range(octaves):
        gw, gh = max(3, int(W / (sx / 2 ** o))), max(3, int(H / (sy / 2 ** o)) + 2)
        g = rng.random((gh, gw), dtype=np.float32)
        big = cv2.resize(np.hstack([g, g, g]), (W * 3, H), interpolation=cv2.INTER_CUBIC)
        out += big[:, W:2 * W] * amp
        tot += amp
        amp *= 0.5
    return np.clip(out / tot, 0, 1)


def bearing_to(a, b):
    f1, f2, dl = math.radians(a[0]), math.radians(b[0]), math.radians(b[1] - a[1])
    y, x = math.sin(dl) * math.cos(f2), math.cos(f1) * math.sin(f2) - math.sin(f1) * math.cos(f2) * math.cos(dl)
    h = math.sin((f2 - f1) / 2) ** 2 + math.cos(f1) * math.cos(f2) * math.sin(dl / 2) ** 2
    return (math.degrees(math.atan2(y, x)) + 360) % 360, 2 * 6371000 * math.asin(math.sqrt(h))


def pen_ridge(rgb):
    """The ridge of a hand repaint, row per column: the first dark pen step with land under it. A cloud's line has bright cloud under it and is passed over."""
    H, W = rgb.shape[:2]
    L = cv2.GaussianBlur(cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)[..., 0], (0, 0), W / 3168)
    env = np.maximum.accumulate(np.percentile(L, 92, axis=1))[:, None]
    win = max(8, int(40 * W / 3168))
    cum = np.cumsum(L, axis=0)
    under = (cum[np.minimum(np.arange(H) + win, H - 1)] - cum) / win
    ok = (L - env < -14) & (under - env < -6)
    first = np.where(ok.any(axis=0), ok.argmax(axis=0), H - 1).astype(np.float32)
    # a pale stretch of crest misses the pen for a few columns: those spikes down come back up
    k = np.ones((1, max(5, W // 300) | 1), np.uint8)
    r = cv2.dilate(cv2.erode(first.reshape(1, -1), k), k)[0]
    r = np.maximum(np.minimum(r, first), r)
    return cv2.GaussianBlur(r.reshape(1, -1), (0, 0), 1.0)[0]


class Canvas:
    def __init__(self, R):
        self.ppd = R['ppd'] * SS
        self.W = int(round(360 * self.ppd))
        self.ptan = self.ppd * 180 / math.pi  # px per unit of tan(elevation)
        self.top, self.bottom = R['topTan'], R['bottomTan']
        self.H = int(round((self.top - self.bottom) * self.ptan))
        rows = np.arange(self.H, dtype=np.float32)
        self.row_tan = self.top - rows / self.ptan
        self.row_el = np.degrees(np.arctan(self.row_tan))

    def row_of(self, elevation):
        return (self.top - math.tan(math.radians(elevation))) * self.ptan


def paint_sky(C, P, R):
    xs = np.array([e for e, _ in P['sky_el']], dtype=np.float32)
    cs = np.stack([hexrgb(c) for _, c in P['sky_el']])
    sky = np.stack([np.interp(C.row_el, xs, cs[:, k]) for k in range(3)], axis=1)[:, None, :].repeat(C.W, axis=1).astype(np.float32)
    # the glow of the low sun
    bearings = np.arange(C.W, dtype=np.float32) / C.ppd
    da = np.abs(((bearings - R.get('glow_bearing', R['sun']['bearing']) + 180) % 360) - 180)
    glow = np.exp(-(da / 55) ** 2)[None, :] * np.exp(-np.clip(C.row_el[:, None], 0, None) / 13)
    sky = sky * (1 - 0.55 * glow[..., None]) + hexrgb(P['glow']) * 0.55 * glow[..., None]
    # clouds: long soft banks, lit from under by the low sun. No hard edge, they stay behind everything and read as air.
    H, W = C.H, C.W
    low = wrap_noise(H, W, 340 * SS, 120 * SS, 41, 5)
    high = wrap_noise(H, W, 620 * SS, 110 * SS, 43, 4)
    el = C.row_el[:, None]
    band = np.exp(-((el - 14) / 7.0) ** 2)
    band2 = np.exp(-((el - 27) / 5) ** 2)
    # cloud_bank: over the preset's `cloud`, 0 leaves only the cumulus, one kind of cloud in one sky
    m = smoothstep(0.56, 0.72, low * 0.9 + 0.14 * band) * band * R.get('cloud_bank', P.get('cloud', 0.75))
    m2 = smoothstep(0.58, 0.76, high) * band2 * R.get('cloud_bank', P.get('cloud', 0.75)) * 0.28
    # toward the light, which is under the cloud of a low sun, and over it at midday (cloud_up)
    shade = low - cv2.GaussianBlur(np.roll(low, (1 if P.get('cloud_up') else -1) * int(14 * SS), axis=0), (0, 0), 6 * SS)
    lit = smoothstep(-0.03, 0.05, -shade)[..., None]
    col = hexrgb(P['cloud_shade']) * (1 - lit) + hexrgb(P['cloud_lit']) * lit
    sky = sky * (1 - m2[..., None]) + hexrgb(P['cloud_high']) * m2[..., None]
    sky = sky * (1 - m[..., None]) + col * m[..., None]
    if R.get('cumulus'):
        paint_cumulus(C, P, R['cumulus'], sky)
    return sky.astype(np.float32)


def paint_cumulus(C, P, K, sky):
    """`cumulus`: { seed, count, el: [lo, hi], size: [lo, hi] (deg), at: [[bearing, el, size], ...] by hand }: the piled white clouds of a tropical midday. Each a flat base and a heap of rounded lobes, lit from above, a soft blue shade at the belly. Streaks and banks read as cold air here."""
    rng = np.random.default_rng(K.get('seed', 5))
    clouds = [tuple(c) for c in K.get('at', [])]
    for _ in range(K.get('count', 0)):
        clouds.append((rng.random() * 360, rng.uniform(*K['el']), rng.uniform(*K['size'])))
    lit, shade = hexrgb(P['cloud_lit']), hexrgb(P['cloud_shade'])
    # all of them into one sheet before any is shaded: two that overlap are one cloud, with no outline of the one inside the other
    M = np.zeros((C.H, C.W), np.uint8)
    Bel = np.zeros((C.H, C.W), np.float32)
    for bearing, el, size in clouds:
        hang = int(size * C.ppd * 0.25) if K.get('puffy') else 0
        ww, hh = int(size * C.ppd * 1.5) + 8, int(size * C.ppd * 0.9) + 8 + hang
        base = hh - 4 - hang
        m = np.zeros((hh, 2 * ww), np.uint8)
        # lobes along the base, tallest near the middle, smaller lobes heaped on them
        n = int(5 + size * 0.8)
        for i in range(n):
            t = 0.08 + 0.84 * (i + rng.random()) / n
            x = ww + (t - 0.5) * 2 * ww * 0.8
            env = (1 - abs(2 * t - 1) ** 1.6)
            r = (0.2 + 0.26 * env * (0.6 + 0.6 * rng.random())) * size * C.ppd * 0.72
            cv2.circle(m, (int(x), int(base - r * 0.8)), int(r), 255, -1, cv2.LINE_AA)
            if env > 0.3:
                for j in range(3):
                    a = rng.uniform(-2.7, -0.4)
                    cv2.circle(m, (int(x + math.cos(a) * r * 0.9), int(base - r * 0.8 + math.sin(a) * r * 0.9)), int(r * rng.uniform(0.4, 0.7)), 255, -1, cv2.LINE_AA)
        # puffy: no ruled base, small lobes hang along it; default the flat one
        if K.get('puffy'):
            for i in range(n):
                t = 0.14 + 0.72 * (i + rng.random()) / n
                r = (0.1 + 0.1 * rng.random()) * size * C.ppd * 0.72
                cv2.circle(m, (int(ww + (t - 0.5) * 2 * ww * 0.8), int(base + r * 0.1)), int(r), 255, -1, cv2.LINE_AA)
        else:
            m[base:] = 0
        belly = np.clip((np.arange(hh, dtype=np.float32)[:, None] - (base - size * C.ppd * 0.22)) / (size * C.ppd * 0.22), 0, 1)
        belly = np.broadcast_to(belly, m.shape)
        x0, y0 = int(bearing * C.ppd) - ww, int(C.row_of(el)) - base
        y1, y2 = max(0, y0), min(C.H, y0 + hh)
        if y2 <= y1:
            continue
        cols = (x0 + np.arange(2 * ww)) % C.W
        M[y1:y2, cols] = np.maximum(M[y1:y2, cols], m[y1 - y0:y2 - y0])
        # the belly of the nearest base wins over the belly of a cloud above it
        Bel[y1:y2, cols] = np.where(m[y1 - y0:y2 - y0] > 0, np.maximum(Bel[y1:y2, cols], belly[y1 - y0:y2 - y0]), Bel[y1:y2, cols])
    wrapblur = lambda A, s: cv2.GaussianBlur(np.hstack([A[:, -200:], A, A[:, :200]]), (0, 0), s)[:, 200:-200]
    a = wrapblur(M.astype(np.float32) / 255, K.get('edge', 1.5) * SS)
    # light from above: a shadow that follows each lobe's lower edge, and a blue belly; belly_soft melts the belly upward, so it is no band ruled across the cloud
    up = wrapblur(np.roll(M, int(K.get('drop', 0.55) * C.ppd), axis=0).astype(np.float32) / 255, K.get('drop_soft', 0.3) * C.ppd)
    k = np.clip(0.55 * (1 - up) + wrapblur(Bel, K.get('belly_soft', 1.5) * SS) * K.get('belly', 0.8), 0, 1)[..., None] * 0.8
    # volume (default off): each cloud a lit heap: a pillow over its own outline with lumps pressed in, lit from `volume_sun` [x, y, z], so no two are the same flat cutout
    if K.get('volume'):
        d = cv2.distanceTransform((M > 127).astype(np.uint8), cv2.DIST_L2, 5)
        nrng = np.random.default_rng(K.get('seed', 5) + 1)
        lumps = sum(amp * cv2.resize(nrng.random((C.H // s + 2, C.W // s + 2), dtype=np.float32), (C.W, C.H), interpolation=cv2.INTER_CUBIC) for s, amp in ((int(1.6 * C.ppd), 7.0), (int(0.7 * C.ppd), 3.0)))
        h = wrapblur(np.sqrt(d) * 1.6 + lumps * np.clip(d / (0.5 * C.ppd), 0, 1), 0.08 * C.ppd)
        gy, gx = np.gradient(h)
        L = np.array(K.get('volume_sun', [-0.4, -0.72, 0.56]), np.float32)
        lam = np.clip((-gx * L[0] - gy * L[1] + L[2]) / np.sqrt(gx * gx + gy * gy + 1), 0, 1)
        k = np.clip(k[..., 0] * 0.55 + K['volume'] * (1 - lam) ** 1.3, 0, 1)[..., None]
    col = lit * (1 - k) + shade * k
    A = a[..., None]
    sky[:] = sky * (1 - A) + col * A


def paint_stars(C, R, sky):
    """Night only (`stars`: { count, seed, from }): small dots that get denser and brighter with height, with a few four pointed ones."""
    S = R['stars']
    rng = np.random.default_rng(S.get('seed', 3))
    for _ in range(S['count']):
        x, el = rng.random() * C.W, S.get('from', 9) + rng.random() ** 0.8 * 34
        y = C.row_of(el)
        if y < 0 or y >= C.H:
            continue
        k = smoothstep(S.get('from', 9), S.get('from', 9) + 10, el) * (0.35 + 0.65 * rng.random())
        r = (0.7 + 1.3 * rng.random() ** 3) * SS
        col = np.array([1.0, 0.98, 0.88 + 0.12 * rng.random()], np.float32)
        x0, y0, n = int(x), int(y), int(r * 6) + 2
        y1, y2 = max(0, y0 - n), min(C.H, y0 + n + 1)
        xs = np.arange(x0 - n, x0 + n + 1)
        ys = np.arange(y1, y2)
        dx, dy = (xs - x)[None, :], (ys - y)[:, None]
        a = np.exp(-(dx * dx + dy * dy) / (r * r)) * k
        if r > 1.6 * SS:
            a = np.maximum(a, (np.exp(-(dx / (0.45 * SS)) ** 2 - (dy / (r * 3)) ** 2) + np.exp(-(dy / (0.45 * SS)) ** 2 - (dx / (r * 3)) ** 2)) * k * 0.6)
        c = xs % C.W
        sky[y1:y2, c] = sky[y1:y2, c] * (1 - a[..., None]) + col * a[..., None]


def paint_moon(C, R, sky):
    """The huge friendly moon (`moon`: { bearing, elevation, radius, color, shade, halo }), a disc with soft seas, a thin pen line and a wide halo. Local to the sky: land lies over it, and no cloud is ever in front."""
    M = R['moon']
    H, W = C.H, C.W
    bearings = np.arange(W, dtype=np.float32) / C.ppd
    dx = (((bearings - M['bearing'] + 180) % 360) - 180)[None, :] * math.cos(math.radians(M['elevation']))
    dy = C.row_el[:, None] - M['elevation']
    d = np.sqrt(dx * dx + dy * dy).astype(np.float32)
    r = M['radius']
    halo = hexrgb(M.get('halo', '#bcd8e8'))
    # with no disc painted the glow has no hole in it where the disc would be
    if M.get('disc') is False:
        d = np.maximum(d, r + 1e-3)
    h = (M.get('glow', 1) * (0.62 * np.exp(-((d - r) / (r * 0.55)) ** 2 * (d > r)) * (d > r) + 0.34 * np.exp(-np.clip(d - r, 0, None) / (r * 2.4))))[..., None]
    sky[:] = sky * (1 - h) + halo * h
    # disc: false paints only the glow; the disc is a sprite of the renderer, round at any place in the frame (landmarks/bran.js)
    if M.get('disc') is False:
        return
    # the seas: two scales of noise, held inside the disc, a little darker toward the lower left as a sphere
    u, v = dx / r, dy / r
    n = np.zeros((H, W), np.float32)
    i0, i1 = max(0, int(C.row_of(M['elevation'] + r * 1.1))), min(H, int(C.row_of(M['elevation'] - r * 1.1)))
    rng = np.random.default_rng(M.get('seed', 11))
    sz = i1 - i0
    big = cv2.resize(rng.random((7, 7), dtype=np.float32), (sz, sz), interpolation=cv2.INTER_CUBIC)
    fine = cv2.resize(rng.random((19, 19), dtype=np.float32), (sz, sz), interpolation=cv2.INTER_CUBIC)
    cx = int(M['bearing'] * C.ppd)
    seas = smoothstep(0.5, 0.64, big * 0.75 + fine * 0.25)
    cols = (cx - sz // 2 + np.arange(sz)) % W
    n[np.ix_(np.arange(i0, i1), cols)] = seas
    ball = np.clip(0.5 + 0.5 * (u * -0.45 + v * 0.55), 0, 1)
    tone = 1 - 0.1 * (1 - ball) - 0.2 * n
    disc = (hexrgb(M.get('color', '#fff6d8')) * tone[..., None] + hexrgb(M.get('shade', '#b9c4d8')) * (1 - tone[..., None]) * 0.9)
    e = C.ppd * 0.06
    a = np.clip((r - d) * C.ppd / 1.5 + 0.5, 0, 1)[..., None]
    sky[:] = sky * (1 - a) + disc * a
    # a few craters with a bright lip
    for _ in range(M.get('craters', 16)):
        ca, cr, s = rng.random() * 6.283, r * math.sqrt(rng.random()) * 0.86, r * (0.05 + 0.09 * rng.random())
        cu, cv = math.cos(ca) * cr, math.sin(ca) * cr
        q = np.sqrt((dx - cu) ** 2 + (dy - cv) ** 2)
        lip = np.exp(-((q - s) / (s * 0.34)) ** 2)[..., None] * 0.22
        pit = np.clip((s - q) / (s * 0.25), 0, 1)[..., None] * 0.16
        sky[:] = sky * (1 - pit) + hexrgb(M.get('shade', '#b9c4d8')) * pit
        sky[:] = sky * (1 - lip) + np.array([1, 1, 0.96], np.float32) * lip
    line = np.exp(-((d - r) * C.ppd / 1.3) ** 2)[..., None] * 0.22
    sky[:] = sky * (1 - line) + hexrgb(M.get('line', '#8e9ccc')) * line


def load_dem(R):
    meta = json.load(open(os.path.join(ROOT, R['dem'] + '.json')))
    h = np.fromfile(os.path.join(ROOT, R['dem'] + '.bin'), dtype=np.int16).reshape(meta['naz'], meta['nr']).astype(np.float32) * meta['unit']
    naz, nr = meta['naz'], meta['nr']
    ratio = (meta['r1'] / meta['r0']) ** (1 / (nr - 1))
    radii = meta['r0'] * ratio ** np.arange(nr, dtype=np.float32)
    # 30 m data is smooth as a dune at this distance: ridged noise on the high ground only, some tens of metres, so that crests break
    rng = np.random.default_rng(7)
    def ridged(gw, gh):
        g = rng.random((gh, gw), dtype=np.float32)
        b = cv2.resize(np.vstack([g, g, g]), (nr, naz * 3), interpolation=cv2.INTER_CUBIC)[naz:2 * naz]
        return 1 - np.abs(2 * b - 1)
    high = smoothstep(1000, 1700, h)
    n1, n2 = ridged(nr // 3, naz // 3), ridged(nr, naz)
    h = h + high * (n1 * n1 * 70 + n2 * n2 * 22 - 45)
    return meta, h, radii


def paint_jungle_tree(out, rng, x, y, s, c, P):
    """`forest_style: jungle`: a round crown lit from above, and among them a coconut palm whose fan stands clear of the canopy: the woods of Bali are not spruce."""
    r = s * 0.46
    if s > 5 and rng.random() < 0.075:
        h, tip = s * 1.5, c * 1.28
        top = (x + int(rng.integers(-1, 2)), int(y - h))
        cv2.line(out, (x, y), top, (c * 0.7).tolist(), max(1, int(s * 0.07)), cv2.LINE_AA)
        for a in (-2.7, -2.1, -1.57, -1.04, -0.44, 0.1, 3.04):
            e = (int(top[0] + math.cos(a) * s * 0.62), int(top[1] + math.sin(a) * s * 0.34 + s * 0.12))
            cv2.line(out, top, e, tip.tolist(), max(1, int(s * 0.11)), cv2.LINE_AA)
        return
    cv2.ellipse(out, (x, int(y - r)), (int(max(1, r * 1.12)), int(max(1, r * 0.88))), 0, 0, 360, c.tolist(), -1, cv2.LINE_AA)
    cv2.ellipse(out, (x - int(r * 0.16), int(y - r * 1.28)), (int(max(1, r * 0.62)), int(max(1, r * 0.42))), 0, 0, 360, (c * 1.2).tolist(), -1, cv2.LINE_AA)


def paint_forest(C, R, P, out, mask, tree, air, seed, larch=0.8, tone=None, keys=('spruce_m', 'larch_m'), drift_shape=None, tree_gold=0.0):
    """One forest for the whole panorama, in mass: the spruce near black and the larch in long drifts along the slope, never as single flecks; each tree a small low contrast shape of the colour of the slope it stands on, so it is texture and not salt.
    mask: canvas 0/1. tree: px high (float or image), 0 for no trees. air: 0..1 toward the blue of distance (float or image)."""
    H, W = C.H, C.W
    bearings = np.arange(W, dtype=np.float32) / C.ppd
    sunward = np.cos(np.radians(bearings - R['sun']['bearing']))[None, :]
    # the light runs down the fall line, spur and gully, never across the slope in terraces
    t = 0.12 + 0.62 * wrap_noise(H, W, 90 * SS, 260 * SS, seed + 3, 4) + 0.12 * sunward if tone is None else tone
    t = np.clip(t, 0, 1).astype(np.float32)
    sp, la = np.stack([hexrgb(c) for c in P[keys[0]]]), np.stack([hexrgb(c) for c in P[keys[1]]])
    rmp = lambda c: np.stack([np.interp(t, [0, 0.5, 1], c[:, k]) for k in range(3)], axis=2).astype(np.float32)
    # larch in irregular drifts on the sunny spurs, a few of them: a slope that is half gold reads as a field
    # soft edged: a hard edged drift is camouflage
    # drift_shape: [lo, hi, sx, sy], the threshold and the size of the larch patches, narrow for the crisp flat patches of a hand repaint; default the soft drifts
    dlo, dhi, dsx, dsy = drift_shape or (0.56, 0.74, 200, 80)
    drift = smoothstep(dlo, dhi, wrap_noise(H, W, dsx * SS, dsy * SS, seed + 5, 4) + 0.12 * (t - 0.4)) * larch
    base = rmp(sp)
    base = base * (1 - drift[..., None]) + rmp(la) * drift[..., None]
    A = air[..., None] if isinstance(air, np.ndarray) else air
    base = base * (1 - A) + hexrgb(P['forest_air']) * A
    m = mask > 0.5
    out[m] = base[m]
    if isinstance(tree, (int, float)) and tree <= 0:
        return base
    rng = np.random.default_rng(seed)
    sz = tree if isinstance(tree, np.ndarray) else np.full((H, W), float(tree), np.float32)
    # tree_gold: this share of the trees is larch, one by one, gathered in loose groves over the dark wood, as on a hand repaint; default none, each tree takes the colour of its slope
    if tree_gold:
        grove, gold = smoothstep(0.42, 0.7, wrap_noise(H, W, 150 * SS, 90 * SS, seed + 7, 3)), rmp(la)
    y = 0.0
    while y < H:
        iy, row = int(y), mask[int(y)] > 0.5
        idx = np.nonzero(row & (sz[iy] > 2.2))[0]
        med = float(np.median(sz[iy][idx])) if idx.size else 6.0
        if idx.size:
            for x in rng.choice(idx, size=int(idx.size / max(2.0, med * 0.8)) + 1, replace=True):
                s = float(sz[iy, x]) * (0.72 + 0.56 * rng.random())
                xx, yy, w = int(x), int(y + s * 0.3), s * 0.66
                c = base[iy, x] * (0.9 + 0.2 * rng.random())
                if tree_gold and rng.random() < tree_gold * grove[iy, x]:
                    ga = float(air[iy, x]) if isinstance(air, np.ndarray) else float(air)
                    c = (gold[iy, x] * (1 - ga) + hexrgb(P['forest_air']) * ga) * (0.85 + 0.35 * rng.random())
                if R.get('forest_style') == 'jungle':
                    paint_jungle_tree(out, rng, xx, yy, s, c, P)
                    continue
                p = pp.conifer_poly(xx, yy, s, w, s * 0.1)
                cv2.fillPoly(out, [p], c.tolist(), lineType=cv2.LINE_AA)
                half = p.copy()
                sd = 1.0 if math.sin(math.radians(R['sun']['bearing'] - x / C.ppd)) >= 0 else -1.0
                half[:, 0] = np.where((half[:, 0] - xx) * sd >= 0, half[:, 0], xx)
                cv2.fillPoly(out, [half], (c * 1.14).tolist(), lineType=cv2.LINE_AA)
                # recipe `frost`: 0..1 of the trees carry snow on their boughs, the lit side whiter (preset `frost`, shade to lit)
                if R.get('frost') and rng.random() < R['frost']:
                    af = float(air[iy, x]) if isinstance(air, np.ndarray) else float(air)
                    fc = [hexrgb(q) * (1 - af) + hexrgb(P['forest_air']) * af for q in P['frost']]
                    p2 = pp.conifer_poly(xx, int(yy - s * 0.32), s * 0.68, w * 0.72, s * 0.08)
                    cv2.fillPoly(out, [p2], fc[0].tolist(), lineType=cv2.LINE_AA)
                    h2 = p2.copy()
                    h2[:, 0] = np.where((h2[:, 0] - xx) * sd >= 0, h2[:, 0], xx)
                    cv2.fillPoly(out, [h2], fc[1].tolist(), lineType=cv2.LINE_AA)
        y += max(1.6, med * 0.42)
    return base


def paint_dem(C, R, P, out):
    """The land by ray: for each column the first ring that reaches each row's elevation. Returns land mask, ring index image, skyline row per column."""
    meta, h, radii = load_dem(R)
    naz, nr = h.shape
    F, K = R['compress']['from'], R['compress']['factor']
    ring = np.full((C.H, C.W), -1, np.float32)
    sky_row = np.zeros(C.W, np.float32)
    rel = np.arange(C.H)
    for c in range(C.W):
        a = c / C.W * naz
        a0 = int(a) % naz
        a1 = (a0 + 1) % naz
        f = a - int(a)
        hh = h[a0] * (1 - f) + h[a1] * f
        # dem_eye: m over `altitude` the land is seen from, default none (a road on a rim, with y = 0 at the level of the lake below it)
        e = np.degrees(np.arctan2(hh - 2 - R.get('dem_eye', 0), radii))
        # dem_lift: [[bearing from, to, fade (deg), lift (deg), stretch, from (m)], ...]: a far low skyline that 3D ground would hide (a sea line and an island under the horizon) stands this much higher and taller than it really does, on its true bearing; default none
        for lo, hi, fd, lift, st, dm in R.get('dem_lift', []):
            b = c / C.W * 360
            d0 = min(abs((b - lo + 180) % 360 - 180), abs((b - hi + 180) % 360 - 180))
            kb = 1.0 if ((b - lo) % 360) <= ((hi - lo) % 360) else float(smoothstep(fd, 0, d0))
            if kb > 0:
                base = np.degrees(np.arctan2(-float(R['altitude']), radii))
                e = e + kb * smoothstep(dm * 0.6, dm, radii) * (lift + (st - 1) * (e - base))
        e = np.where(e > F, F + (e - F) * K, e)
        cm = np.maximum.accumulate(e)
        # row elevations run from high to low: searchsorted needs them low to high
        q = np.searchsorted(cm, C.row_el[::-1])[::-1]
        vis = q < nr
        ring[vis, c] = q[vis]
        sky_row[c] = float(np.argmax(vis)) if vis.any() else C.H - 1
    land = ring >= 0
    # attributes in polar: altitude, normal toward the sun, slope
    az = np.arange(naz, dtype=np.float32)
    rr = np.maximum(radii, 1)
    dr = np.gradient(radii)
    gr = np.gradient(h, axis=1) / dr[None, :]
    gt = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) / (2 * rr[None, :] * (2 * math.pi / naz))
    bb = (az / naz * 2 * math.pi)[:, None]
    gE, gN = gr * np.sin(bb) + gt * np.cos(bb), gr * np.cos(bb) - gt * np.sin(bb)
    sb, el = math.radians(R['sun']['bearing']), math.radians(R['sun']['elevation'])
    S = (math.sin(sb) * math.cos(el), math.cos(sb) * math.cos(el), math.sin(el))
    lN = np.sqrt(gE * gE + gN * gN + 1)
    nl = (-gE * S[0] - gN * S[1] + S[2]) / lN
    slope = np.degrees(np.arctan(np.sqrt(gE * gE + gN * gN)))
    alt = h + meta['altitude']
    mapx = np.where(land, ring, 0).astype(np.float32)
    mapy = np.broadcast_to((np.arange(C.W, dtype=np.float32) / C.W * naz)[None, :], (C.H, C.W)).astype(np.float32)
    def look(A):
        # wrap by padding in azimuth; ring along x
        pad = np.vstack([A, A[:2]]).astype(np.float32)
        return cv2.remap(pad, mapx, mapy, cv2.INTER_LINEAR)
    NL, SL, AL = look(nl), look(slope), look(alt)
    dist = radii[np.clip(mapx.astype(np.int32), 0, nr - 1)]
    # rock tones from the light, with the broad noise of a big face, hard steps
    noise = wrap_noise(C.H, C.W, 90 * SS, 60 * SS, 9, 4) - 0.5
    tone = np.clip(0.5 + NL * 0.55 + noise * 0.28, 0, 1)
    rock_c = apply_ramp(posterise(tone, 6, soft=0.3), ramp(P['rock_i']))
    grass_c = apply_ramp(posterise(tone, 4, soft=0.3), ramp(P['alpine']))
    scree_c = apply_ramp(posterise(np.clip(tone + 0.25, 0, 1), 3, soft=0.3), ramp(P['rock_i']))
    # dem_cover: heights of another climate, for ground that is not Alpine ({ treeline, slope, rock_above, scree_above }, slope: steepest forest, m and degrees)
    Dc = R.get('dem_cover', {})
    treeline = Dc.get('treeline', 1950) + noise * 320
    forest = (AL < treeline) & (SL < Dc.get('slope', 52)) & land
    # sea: { color, far, level }: land at sea level is water, flat to the true horizon, and no forest; default none
    Sea = R.get('sea')
    sea = (AL < Sea.get('level', 3)) & land if Sea else None
    if Sea:
        forest = forest & ~sea
    rock = land & ~forest & ((SL + noise * 18 > Dc.get('rock_slope', 30)) | (AL > Dc.get('rock_above', 2350) + noise * 200))
    scree = land & ~forest & ~rock & (AL > Dc.get('scree_above', 2050) + noise * 160)
    col = grass_c.copy()
    col[rock] = rock_c[rock]
    col[scree] = (rock_c[scree] * 0.5 + scree_c[scree] * 0.5)
    if Sea:
        t = smoothstep(4000, 42000, dist)[..., None]
        col[sea] = (hexrgb(Sea['color']) * (1 - t) + hexrgb(Sea.get('far', Sea['color'])) * t)[sea]
    out[land] = col[land]
    # the forest: the one forest, its trees where they would be big enough to see
    size = np.clip(24 / np.maximum(dist, 1) * C.ptan, 0, 16).astype(np.float32)
    # dem_forest_air: 0..1 of the air between the road and these woods, for a cold hour when a dark wood at full colour would stand out from everything nearer; default none
    paint_forest(C, R, P, out, (forest).astype(np.float32), size, float(R.get('dem_forest_air', 0.0)), 23, tone=np.clip(0.5 + NL * 0.9, 0, 1).astype(np.float32) * 0.75, larch=0.7 * smoothstep(1100, 1400, AL))
    # ink where one ridge stands in front of another, strong near and gone far, and on the skyline
    lr = np.log(np.maximum(dist, 1500)).astype(np.float32)
    lr[~land] = 12.0
    dy = np.abs(np.diff(lr, axis=0, prepend=lr[:1]))
    edge = (dy > 0.1).astype(np.float32)
    edge = cv2.GaussianBlur(edge, (0, 0), 0.8 * SS) * 2.0
    ink = np.clip(edge, 0, 1) * smoothstep(16000, 3000, dist) * 0.4
    out[:] = out * (1 - ink[..., None]) + hexrgb(P['ink']) * ink[..., None]
    # the far ranges go into the air of the hour, in steps: flat layers, as a painter lays them
    hz = 0.2 + 0.68 * (1 - np.exp(-np.maximum(dist - 2500, 0) / 11000))
    hz = posterise(hz, 12, soft=0.2)
    # a far range is blue at the foot and takes the sky's rose at its crest, as on the repaint
    far = np.stack([np.interp(C.row_el, [0, 7, 13, 22], [hexrgb(P['foot_air'])[k], hexrgb(P['far_air'])[k], hexrgb(P['air'])[k], hexrgb(P['air_high'])[k]]) for k in range(3)], axis=1)[:, None, :]
    out[land] = (out * (1 - hz[..., None]) + far * hz[..., None])[land]
    return land, sky_row, {'rgb': out.copy(), 'dist': dist, 'forest': forest}


def prepare_photo(C, R, P, ph, dem_top):
    """A photo painted at the size it will stand at, placed on the canvas: every mountain through planes() by default, so they all come out of one hand."""
    a = pp.make_parser().parse_args(['x', 'y'])
    a.preset, a.place, a.air = R['preset'], None, 0.0
    a.plane_px, a.lo, a.hi, a.mid, a.veg_any, a.veg_from, a.veg_min, a.grain_s, a.grain_len = C.ppd / 45.0, 2, 99.0, 0, 0.2, 0.25, 2600, 8.0, 14.0
    a.veg_hint = ph.get('veg_hint')
    # the older painters still take the pen and tones they were tuned with
    if ph.get('style') == 'illustrate':
        a.mid, a.hi, a.lo, a.strata, a.strata_t, a.crease_t, a.crease_len, a.crease_s, a.pen, a.cel_soft, a.cel_tone, a.local, a.v_max, a.foot_air, a.step, a.tones, a.soft, a.shock, a.strokes, a.ridge_ink = 0.56, 99.0, 1, 0.0, 0.02, 0.02, 60, 2.2, 1.2, 2, 0.06, 0.25, 0.86, 0.35, 0.75, 6, 0.2, 2, 1, 1.0
        a.crease, a.grain_s, a.grain_len, a.veg_any, a.veg_from, a.veg_min = 0.7, 4.0, 9.0, 0.0, 0.42, 500
    for k, v in ph.get('args', {}).items():
        setattr(a, k, v)
    file = os.path.join(ROOT, 'data/raw/backdrop-photos', ph['id'], ph['file'])
    im = Image.open(file).convert('RGB')
    x0, y0, x1, y1 = ph.get('crop', [0, 0, 1, 1])
    im = im.crop((int(x0 * im.width), int(y0 * im.height), int(x1 * im.width), int(y1 * im.height)))
    # flip: a mountain photographed from the far side, its fall line the way it runs from here; crop and hints are in the crop's own frame after the flip
    if ph.get('flip'):
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    w0 = int(round(ph['width'] * C.ppd))
    # vstretch: a long lens's squeezed wall made taller than the photo's own proportion, default 1
    h = int(round(im.height * w0 / im.width * ph.get('vstretch', 1)))
    rgb = np.asarray(im.resize((w0, h), Image.LANCZOS), dtype=np.float32) / 255.0
    # shear: a long ridge seen along its length from where the photo was taken, turned square to the viewer as it stands from the track: the right side goes down by this fraction of the height (hints are in the sheared frame), default none
    if ph.get('shear'):
        M = np.float32([[1, 0, 0], [ph['shear'] * h / w0, 1, -ph['shear'] * h / 2]])
        rgb = cv2.warpAffine(rgb, M, (w0, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    # `erase`: boxes [x0, y0, x1, y1] in fractions of the crop, what stands in front of the mountain in the photo (poles, cypresses, a roof): filled from the slope around them
    if ph.get('erase'):
        hole = np.zeros((h, w0), np.uint8)
        for ex0, ey0, ex1, ey1 in ph['erase']:
            hole[int(ey0 * h):int(ey1 * h), int(ex0 * w0):int(ex1 * w0)] = 255
        rgb = cv2.inpaint((rgb * 255).astype(np.uint8), hole, 5, cv2.INPAINT_TELEA).astype(np.float32) / 255.0
    ridge = pp.ridge_from_hint(rgb, ph['ridge_hint'], ph.get('ridge_win', 0.012)) if ph.get('ridge_hint') else None
    # ridge_file: the ridge of a repaint as tools/trace-ridge.py found it, [[u, v], ...] in fractions of the whole image: taken as it is, nothing searched; default none
    if ph.get('ridge_file'):
        tu, tv = zip(*json.load(open(os.path.join(ROOT, ph['ridge_file']))))
        ridge = (np.interp((np.arange(w0, dtype=np.float32) + 0.5) / w0 * (x1 - x0) + x0, tu, tv) - y0) / (y1 - y0) * h
        ridge = cv2.GaussianBlur(ridge.astype(np.float32).reshape(1, -1), (0, 0), 0.8)[0]
    if ridge is None and not ph.get('painted') and ph.get('style') != 'illustrate':
        ridge, _ = pp.find_sky(rgb, a.sky_top, a.land_from, a.cloud)
    # ridge_smooth: deg over which the ridge of a photo is evened out, where trees or haze comb it into spikes the sky finder takes for rock; default off
    if ridge is not None and ph.get('ridge_smooth'):
        n_rs = int(ph['ridge_smooth'] * C.ppd) | 1
        padded = np.pad(ridge.astype(np.float32), n_rs, mode='edge')
        med = np.median(np.lib.stride_tricks.sliding_window_view(padded, n_rs), axis=1).astype(np.float32)
        ridge = cv2.GaussianBlur(med.reshape(1, -1), (0, 0), n_rs / 3)[0][n_rs // 2 + 1:][:ridge.size]
    # squash: { foot, at: [[u, k], ...] }: a repaint's lesser mountains brought down to k of their height over the row `foot` (fractions of the crop), when off to a side the cylinder's perspective would lift them over the hero; default none
    if ph.get('squash') and ridge is not None:
        foot, ku = ph['squash']['foot'] * h, np.interp((np.arange(w0, dtype=np.float32) + 0.5) / w0, *zip(*ph['squash']['at'])).astype(np.float32)
        ky = np.arange(h, dtype=np.float32)[:, None]
        rgb = cv2.remap(rgb, np.tile(np.arange(w0, dtype=np.float32), (h, 1)), np.where(ky < foot, foot + (ky - foot) / ku[None, :], ky).astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        ridge = np.where(ridge < foot, foot + (ridge - foot) * ku, ridge).astype(np.float32)
    top = None
    if ridge is not None:
        sm = cv2.GaussianBlur(ridge.reshape(1, -1), (0, 0), 3 * SS)[0]
        margin = int(w0 * 0.1)
        top = margin + int(np.argmin(sm[margin:w0 - margin]))
    # a photo that stops mid ridge goes on with another photo of the same mountain: `flank` { id, file, x: [from, to] of its width, width (deg), ridge_hint, veg_force: both traced on that photo in fractions of it }. The real ridge goes on behind the frame, and a ridge that ends in mid air is what gives a panel away
    exL, exR = 0, 0
    if a.veg_hint:
        us, rows = zip(*a.veg_hint)
        a.veg_top = np.interp((np.arange(w0, dtype=np.float32) + 0.5) / w0, us, rows) * h
        a.veg_hint = None
    # a foreground slope in the photo, traced by eye: under this line it is all forest
    if ph.get('veg_force_hint'):
        us, rows = zip(*ph['veg_force_hint'])
        a.veg_force = (np.interp((np.arange(w0, dtype=np.float32) + 0.5) / w0, us, rows) * h).astype(np.float32)
    if ph.get('flank') and ridge is not None:
        F = ph['flank']
        fim = Image.open(os.path.join(ROOT, 'data/raw/backdrop-photos', F['id'], F['file'])).convert('RGB')
        fx0, fx1 = F['x']
        scale = F['width'] * C.ppd / ((fx1 - fx0) * fim.width)
        fh = int(round(fim.height * scale))
        fim = fim.crop((int(fx0 * fim.width), 0, int(fx1 * fim.width), fim.height)).resize((int(round(F['width'] * C.ppd)), fh), Image.LANCZOS)
        piece = np.asarray(fim, dtype=np.float32) / 255.0
        rf = pp.ridge_from_hint(piece, [[(u - fx0) / (fx1 - fx0), r] for u, r in F['ridge_hint']])
        exR = piece.shape[1]
        # the two ridges meet: the flank slides up or down to where the photo's ends
        shift = int(round(float(np.median(ridge[-20:])) - float(np.median(rf[:20]))))
        idx = np.clip(np.arange(h) - shift, 0, fh - 1)
        piece = piece[idx]
        rf = rf + shift
        force = np.interp((np.arange(exR, dtype=np.float32) + 0.5) / exR, *zip(*[((u - fx0) / (fx1 - fx0), r * fh + shift) for u, r in F['veg_force']])).astype(np.float32)
        over = int(2 * C.ppd)
        ramp_x = smoothstep(0, over, np.arange(over, dtype=np.float32))[None, :, None]
        piece[:, :over] = rgb[:, -over:][:, ::-1] * (1 - ramp_x) + piece[:, :over] * ramp_x
        rgb = np.hstack([rgb, piece])
        ridge = np.concatenate([ridge, rf])
        a.veg_force = np.concatenate([np.full(w0, h + 9.0, np.float32), force])
        a.veg_top = np.concatenate([a.veg_top if a.veg_top is not None else ridge[:w0] + (h - ridge[:w0]) * a.veg_from, force])
    w = w0 + exL + exR
    if ph.get('painted'):
        # a repaint is finished work: only its sky goes
        land, ridge, veg = rgb, (pen_ridge(rgb) if ridge is None else ridge), np.zeros(rgb.shape[:2], np.float32)
    elif ph.get('style') == 'illustrate':
        if ph.get('hint_wins'):
            a.ridge_given = ridge
        land, _, ridge, veg = pp.illustrate(rgb, {**P, 'rock_i': ph.get('rock_i', P.get('rock_i'))}, a)
    else:
        land, _, ridge, veg = pp.planes(rgb, {**P, 'rock_i': ph.get('rock_i', P.get('rock_i'))}, a, ridge)
    if top is None:
        sm = cv2.GaussianBlur(ridge.reshape(1, -1), (0, 0), 3 * SS)[0]
        margin = int(w * 0.1)
        top = margin + int(np.argmin(sm[margin:w - margin]))
    # summit_u: the column of the photo the named summit stands at, when a higher wall is in frame (fractions of the crop)
    if ph.get('summit_u') is not None:
        sm = cv2.GaussianBlur(ridge.reshape(1, -1), (0, 0), 3 * SS)[0]
        c, r = int(ph['summit_u'] * w0), int(0.015 * w0)
        top = c - r + int(np.argmin(sm[max(0, c - r):c + r]))
    S = ph['summit']
    bearing, distance = bearing_to(R['center'], [S['lat'], S['lon']])
    # at_bearing: a city's skyline, one view round the ring of towers, with no one summit at a true bearing; it stands where it is put and names no summit on its tile
    if ph.get('at_bearing') is not None:
        bearing = ph['at_bearing']
    true_el = math.degrees(math.atan2(S['altitude'] - R['altitude'], distance))
    el = S.get('elevation', true_el)
    if ph.get('haze'):
        # the distance this mountain stands at: paler and bluer than one nearer, and it takes the sky's colour
        land = land * (1 - ph['haze']) + hexrgb(P['far_air']) * ph['haze']
    # the summit's column on its true bearing, its row at its elevation
    x_at = int(round(bearing * C.ppd - top))
    y_at = int(round(C.row_of(el) - ridge[top]))
    cols = (x_at + np.arange(w)) % C.W
    h = rgb.shape[0]
    fallL, fallR = ph.get('fall', [0, 0])
    dist_l, dist_r = np.arange(w, dtype=np.float32) / C.ppd, (w - 1 - np.arange(w, dtype=np.float32)) / C.ppd
    t = np.zeros(w, np.float32)
    if fallL:
        t = np.maximum(t, smoothstep(fallL, 2.5, dist_l))
    if fallR:
        t = np.maximum(t, smoothstep(fallR, 2.5, dist_r))
    # the ridge per column, in canvas rows: the photo's own, falling to the DEM's skyline near a side
    rid = ridge + y_at
    # teeth, not a ruled line, where the ridge is cut
    r1, r2 = wrap_noise(4, w, 60 * SS, 4, 77, 3)[1] - 0.5, 1 - np.abs(2 * wrap_noise(4, w, 26 * SS, 4, 78, 2)[1] - 1)
    sky_line = dem_top[cols]
    # fall_to: elevation a side falls to when the DEM's skyline stands higher than the ridge there (a nearer mountain in front of a far wall)
    target = np.maximum(rid, C.row_of(ph['fall_to']) if ph.get('fall_to') is not None else sky_line + 30 * SS)
    new_r = rid * (1 - t) + target * t
    # fall_teeth: 0 on bare ground, where the teeth read as a row of spruce on a crest that has none; default 1
    new_r = new_r + ph.get('fall_teeth', 1) * (r1 * 34 + (r2 - 0.5) * 26) * SS * np.minimum(t * 4, 1) * np.minimum((1 - t) * 8, 1)
    new_r = np.maximum(new_r, rid)
    Y = np.arange(C.H, dtype=np.float32)[:, None]
    alpha = np.clip(Y - new_r[None, :] + 0.5, 0, 1)
    bot = y_at + h
    alpha = alpha * np.clip((bot - 6 * SS - Y) / (6 * SS), 0, 1)
    # land melts into land at a side; by then the ridge has come down to the DEM's own skyline, so no slab ends in air
    melt = ph.get('edge', 2.5)  # deg over which it melts at its sides
    alpha = alpha * np.minimum(smoothstep(0, melt, dist_l), smoothstep(0, melt, dist_r))[None, :]
    r0, r1b = max(0, y_at), min(C.H, y_at + h)
    canvas = np.zeros((C.H, w, 3), np.float32)
    canvas[r0:r1b] = land[r0 - y_at:r1b - y_at]
    veg_c = np.zeros((C.H, w), np.float32)
    veg_c[r0:r1b] = veg[r0 - y_at:r1b - y_at]
    # cooler toward its foot: the air of the valley
    if ph.get('foot'):
        e0, e1, amt = ph['foot']
        f = smoothstep(e0, e1, C.row_el)[:, None, None] * amt
        canvas = canvas * (1 - f) + hexrgb(P['foot_air']) * f
    # alpenglow: [from, to (deg), amount, colour]: the last sun on the high rock of a mountain painted from a daylight photo, screened over it; default none
    if ph.get('alpenglow'):
        e0, e1, amt, gc = ph['alpenglow']
        f = smoothstep(e0, e1, C.row_el)[:, None, None] * amt
        canvas = 1 - (1 - canvas) * (1 - hexrgb(gc) * f)
    # the pen along whatever is now the top edge
    d = Y - new_r[None, :]
    line = np.exp(-(d / (0.9 * SS)) ** 2)
    # ridge_pen: how hard the pen goes along the crest, a cut out look when it is too hard on a pale rock against a pale sky
    pen_a = ph.get('ridge_pen', 0.9)
    # fall_pen: the pen only where a side has fallen, for a repaint whose own crest is inked already; default none
    if ph.get('fall_pen') is not None:
        pen_a = (ph['fall_pen'] * smoothstep(0.0, 0.08, t))[None, :]
    canvas = canvas * (1 - (line * pen_a)[..., None]) + hexrgb(P['ink']) * (line * pen_a)[..., None]
    return {'canvas': canvas, 'veg': veg_c, 'alpha': alpha, 'cols': cols, 'new_r': new_r, 't': t, 'sky_line': sky_line, 'ph': ph,
            'info': {'view': ph.get('at_bearing') is not None, 'name': S['name'], 'bearing': bearing, 'distance': distance, 'true_el': true_el, 'el': el, 'lat': S['lat'], 'lon': S['lon'], 'altitude': S['altitude'], 'compressed': S.get('compressed'), 'photo': ph['file'] + (' + ' + ph['flank']['file'] if ph.get('flank') else ''), 'span': [x_at / C.ppd, (x_at + w) / C.ppd]}}


def clear_behind(C, out, sky, q, dem):
    """Behind a mountain the DEM's own version of it goes, so that it does not stand up behind the painting; far ranges stay. Done for all before any is laid: clearing as a photo is laid also bit into the photos already there, and tore the skyline."""
    rows = np.arange(C.H, dtype=np.float32)[:, None]
    clip = q['new_r'] * (1 - q['t']) + np.minimum(q['sky_line'], q['new_r']) * q['t']
    near = dem['dist'][:, q['cols']] < q['ph'].get('clear_dist', 12000)
    # clear_keep: bearings [from, to] where the ground stays: out on a long low flank the painting has nothing to show above it, and what is cleared there is a strip of sky under the next mountain
    keep = np.ones(len(q['cols']), dtype=np.float32)
    for a, b in q['ph'].get('clear_keep', []):
        keep *= 1 - (((np.asarray(q['cols']) / C.ppd - a) % 360) <= ((b - a) % 360)).astype(np.float32)
    m = (np.clip(clip[None, :] - rows, 0, 1) * (q['t'][None, :] < 0.995) * near * keep[None, :])[..., None]
    out[:, q['cols']] = out[:, q['cols']] * (1 - m) + sky[:, q['cols']] * m


def lay_photo(out, veg, air, q):
    c, a = q['cols'], q['alpha'][..., None]
    out[:, c] = out[:, c] * (1 - a) + q['canvas'] * a
    m = q['alpha'] > 0.5
    # later over earlier, the forest too
    v = veg[:, c]
    v[m] = q['veg'][m]
    veg[:, c] = v
    r = air[:, c]
    r[m] = q['ph'].get('forest_air', 0.2)
    air[:, c] = r


def paint_belts(C, R, P, out):
    bearings = np.arange(C.W, dtype=np.float32) / C.ppd
    rows = np.arange(C.H, dtype=np.float32)[:, None]
    for B in R['belts']:
        # long spurs running down into the valley, not bumps: ridged noise, broad first
        n1 = wrap_noise(4, C.W, 1500 * SS, 4, B['seed'], 2)[1]
        n2 = wrap_noise(4, C.W, 520 * SS, 4, B['seed'] + 1, 3)[1]
        n3 = wrap_noise(4, C.W, 70 * SS, 4, B['seed'] + 2, 3)[1]
        prof = float(B['base']) + B['amp'] * ((n1 - 0.5) * 3.0 + (1 - np.abs(2 * n2 - 1) - 0.5) * 1.6 + (n3 - 0.5) * 0.7)
        prof = prof.astype(np.float32)
        for at, w, by in B.get('dips', []):
            da = np.abs(((bearings - at + 180) % 360) - 180)
            prof += by * np.exp(-(da / w) ** 2)
        # walls: [bearing, reach toward lower bearings, reach toward higher, height]: the side of a narrow valley seen along it, a long straight slope falling toward each end, with spurs on it. A dome would read as a low round hill
        wall = np.zeros_like(prof)
        for at, w0, w1, by in B.get('walls', []):
            da = ((bearings - at + 180) % 360) - 180
            wall = np.maximum(wall, by * np.clip(1 - np.where(da < 0, -da / w0, da / w1), 0, 1) ** B.get('wall_power', 0.85))
        # wall_rough: how broken the crest of a wall is, over the default
        wr = B.get('wall_rough', 1)
        prof = prof + wall * (1 + wr * 0.16 * (1 - np.abs(2 * n2 - 1) - 0.5) + wr * 0.07 * (n3 - 0.5))
        top = np.array([C.row_of(max(e, B.get('floor', -2.5))) for e in prof[::4]], np.float32)
        top = np.interp(np.arange(C.W), np.arange(0, C.W, 4), top).astype(np.float32)
        mask = (rows > top[None, :]).astype(np.float32)
        # flat: open ground or lying mist instead of forest: { top, bottom (colours), depth (px under its top edge), soft (px of top edge), alpha, streak (0..1, long flat bands) }
        if B.get('flat'):
            F = B['flat']
            down = rows - top[None, :]
            al = np.clip(down / max(F.get('soft', 1) * SS, 1), 0, 1) * F.get('alpha', 1)
            t = np.clip(down / (F.get('depth', 60) * SS), 0, 1)
            streak = wrap_noise(C.H, C.W, 900 * SS, 14 * SS, B['seed'] + 3, 3) - 0.5
            col = hexrgb(F['top'])[None, None, :] * (1 - t[..., None]) + hexrgb(F['bottom'])[None, None, :] * t[..., None]
            col = col * (1 + F.get('streak', 0.2) * streak[..., None])
            out[:] = out * (1 - al[..., None]) + col * al[..., None]
            continue
        # each ridge paler at its foot, where the air of the next valley lies against it
        air = float(B['air']) + B.get('foot_air', 0.0) * smoothstep(40 * SS, 150 * SS, rows - top[None, :]) * smoothstep(10.0, 1.0, C.row_el)[:, None]
        # ink: { tones, sx, sy, slant, lift, drift, pen, seam }: this belt in the hand of a hand repaint: flat planes running down from its own crest, crisp larch patches, the pen along the crest and on some planes; default none
        K, ink_tone = B.get('ink'), None
        if K:
            ink_tone = ink_planes(C, top, rows, K, B['seed'])
        paint_forest(C, R, P, out, mask, float(B['tree']) * SS, air.astype(np.float32), B['seed'], larch=B.get('larch', 0.8), tone=ink_tone, keys=tuple(B.get('ramps', ('spruce_m', 'larch_m'))), drift_shape=K.get('drift') if K else None, tree_gold=K.get('tree_gold', 0.0) if K else 0.0)
        if K:
            ink_lines(C, P, out, mask, top, rows, ink_tone, K)
        # stones: { n, size (px), color } a belt of open grass above the trees is scattered with pale boulders, each with a pen line under it, bigger toward the foot
        if B.get('stones'):
            paint_stones(C, P, out, mask, B['stones'], B['seed'] + 7)
        for V in B.get('villages', []):
            paint_village(C, P, out, V)
        # clearings: [bearing, elevation, half width, half height] (deg), open snow in the wood, seamed by the fall line, with thin trees over it; default none
        for at, el, hw, hh in B.get('clearings', []):
            da = ((bearings - at + 180) % 360) - 180
            e = (da / hw)[None, :] ** 2 + ((C.row_el[:, None] - el) / hh) ** 2
            edge = wrap_noise(C.H, C.W, 60 * SS, 110 * SS, B['seed'] + int(at), 4) - 0.5
            cm = smoothstep(1.0, 0.82, e + edge * 1.1) * mask
            lit = np.clip(0.52 + 2.2 * (wrap_noise(C.H, C.W, 70 * SS, 240 * SS, B['seed'] + 9, 3) - 0.5), 0, 1)
            col = apply_ramp(lit.astype(np.float32), ramp(P['snow']))
            a0 = float(B['air']) * 0.6
            col = col * (1 - a0) + hexrgb(P['forest_air']) * a0
            out[:] = out * (1 - cm[..., None]) + col * cm[..., None]


def ink_planes(C, top, rows, K, seed):
    """The tone of a belt as flat planes that start at its crest and run down the fall line, the way the slope falls under its own crest."""
    n = wrap_noise(C.H, C.W, K.get('sx', 80) * SS, K.get('sy', 300) * SS, seed + 3, K.get('octaves', 3))
    fall = np.clip(cv2.GaussianBlur(np.gradient(top).reshape(1, -1).astype(np.float32), (0, 0), 30 * SS)[0] * 3, -1, 1)
    X = np.arange(C.W, dtype=np.float32)[None, :]
    down = rows - top[None, :]
    mx = (X - fall[None, :] * K.get('slant', 0.8) * down) % C.W
    my = np.clip(down * 0.6 + 8, 0, C.H - 1)
    t = cv2.remap(n, mx.astype(np.float32), my.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_WRAP)
    t = np.clip((t - 0.5) * K.get('contrast', 2.0) + 0.5 + K.get('lift', 0.0), 0, 1)
    return posterise(t.astype(np.float32), K.get('tones', 4), soft=K.get('soft', 0.12)).astype(np.float32)


def ink_lines(C, P, out, mask, top, rows, tone, K):
    ink = hexrgb(P['ink'])
    d = rows - top[None, :]
    line = np.exp(-(d / (K.get('pen_w', 0.9) * SS)) ** 2) * K.get('pen', 0.7)
    # the pen on the edges between planes, thin and broken
    if K.get('seam'):
        g = np.abs(cv2.Sobel(tone, cv2.CV_32F, 1, 0, ksize=3)) + np.abs(cv2.Sobel(tone, cv2.CV_32F, 0, 1, ksize=3))
        seam = np.clip(cv2.GaussianBlur((g > 0.25).astype(np.float32), (0, 0), 0.5 * SS) * 1.6, 0, 1) * K['seam'] * mask
        line = np.maximum(line, seam)
    out[:] = out * (1 - line[..., None]) + ink * line[..., None]


def paint_stones(C, P, out, mask, St, seed):
    rng, base = np.random.default_rng(seed), hexrgb(St.get('color', '#b9b0ae'))
    ink = hexrgb(P['ink'])
    for _ in range(int(St['n'])):
        x, y = int(rng.integers(0, C.W)), int(rng.integers(0, C.H))
        if mask[y, x] < 0.5 or C.row_el[y] > St.get('above', 12) or C.row_el[y] < St.get('under', -6):
            continue
        s = St.get('size', 6) * SS * (0.5 + rng.random()) * (1 + 0.5 * np.clip(2 - C.row_el[y], 0, 6) / 3)
        pts = np.array([[x - s, y], [x - s * 0.6, y - s * 0.5], [x + s * 0.1, y - s * 0.62], [x + s * 0.8, y - s * 0.26], [x + s, y + s * 0.1], [x - s * 0.1, y + s * 0.22]], np.int32)
        cv2.fillPoly(out, [pts], (base * (0.82 + 0.3 * rng.random())).tolist(), lineType=cv2.LINE_AA)
        cv2.polylines(out, [pts[[0, 5, 4]]], False, ink.tolist(), 1, cv2.LINE_AA)


def paint_village(C, P, out, V):
    """Small white houses at the foot of a mountain, to scale: it is what says how big the mountain is. V: { bearing, el, spread (deg), houses, size (px), seed, tower: bearing or null }"""
    rng = np.random.default_rng(V.get('seed', 5))
    s = V.get('size', 9) * SS / 1.5
    wall, shade, roof = hexrgb('#f3dfc8'), hexrgb('#b9a2a8'), hexrgb('#4a3f4a')
    base = C.row_of(V['el'])
    items = sorted([(rng.normal(0, V['spread'] * 0.42) * C.ppd, rng.normal(0, 0.28) * C.ppd * 0.5) for _ in range(V['houses'])], key=lambda p: p[1])
    x0 = V['bearing'] * C.ppd
    for dx, dy in items:
        x, y, w, h = int(x0 + dx) % C.W, base + dy, s * (0.9 + 0.8 * rng.random()), s * (0.6 + 0.3 * rng.random())
        cv2.fillPoly(out, [np.array([[x, y], [x + w, y], [x + w, y - h], [x, y - h]], np.int32)], wall.tolist(), lineType=cv2.LINE_AA)
        cv2.fillPoly(out, [np.array([[x + w * 0.6, y], [x + w, y], [x + w, y - h], [x + w * 0.6, y - h]], np.int32)], shade.tolist(), lineType=cv2.LINE_AA)
        cv2.fillPoly(out, [np.array([[x - 1, y - h], [x + w + 1, y - h], [x + w * 0.5, y - h - s * 0.5]], np.int32)], roof.tolist(), lineType=cv2.LINE_AA)
    if V.get('tower') is not None:
        x, y = int(V['tower'] * C.ppd) % C.W, base + 2
        cv2.fillPoly(out, [np.array([[x, y], [x + s * 0.6, y], [x + s * 0.6, y - s * 2.6], [x, y - s * 2.6]], np.int32)], wall.tolist(), lineType=cv2.LINE_AA)
        cv2.fillPoly(out, [np.array([[x, y - s * 2.6], [x + s * 0.6, y - s * 2.6], [x + s * 0.3, y - s * 3.5]], np.int32)], roof.tolist(), lineType=cv2.LINE_AA)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('recipe')
    ap.add_argument('--preview', default=None)
    ap.add_argument('--out', default=os.path.join(ROOT, 'assets/backdrops'))
    ap.add_argument('--quality', type=int, default=None)
    a = ap.parse_args()
    R = json.load(open(a.recipe))
    P = dict(pp.PRESETS[R['preset']])
    # preset_over: colours of the preset this panorama takes from its own hero repaint, sky_el, rock_i, the forest and the air; default none
    P.update(R.get('preset_over', {}))
    C = Canvas(R)
    sky = paint_sky(C, P, R)
    if R.get('stars'):
        paint_stars(C, R, sky)
    if R.get('moon'):
        paint_moon(C, R, sky)
    out = sky.copy()
    _, dem_top, dem = paint_dem(C, R, P, out)
    # dem_clear: [[from, to, fade]] bearings where the real land goes back to sky, default none: the island folded onto a lap has the open sea on a side where the true view has an inland wall
    for lo, hi, fd in R.get('dem_clear', []):
        bb = np.arange(C.W, dtype=np.float32) / C.ppd
        d0 = np.minimum(np.abs(((bb - lo + 180) % 360) - 180), np.abs(((bb - hi + 180) % 360) - 180))
        inside = ((bb - lo) % 360) <= ((hi - lo) % 360)
        k = np.where(inside, 1.0, smoothstep(fd, 0, d0))[None, :, None].astype(np.float32)
        out[:] = out * (1 - k) + sky * k
        dem_top[:] = np.where(k[0, :, 0] > 0.5, C.H - 1, dem_top)
    prepared = [prepare_photo(C, R, P, ph, dem_top) for ph in R['photos']]
    for q in prepared:
        clear_behind(C, out, sky, q, dem)
    veg, air = np.zeros((C.H, C.W), np.float32), np.zeros((C.H, C.W), np.float32)
    for q in prepared:
        lay_photo(out, veg, air, q)
    # all the forest a photo showed, painted once, by the one forest
    paint_forest(C, R, P, out, veg, R.get('photo_tree', 6) * SS, air, 61, larch=0.9)
    placed = [q['info'] for q in prepared]
    # real forested ground nearer than `dist` stands in front of the mountains, however low a mountain's foot is painted: a far slope must never lie over a nearer ridge. `except`: bearings where the great mountain's foot stays whole
    if R.get('front_dem'):
        # the reach shrinks toward an excepted bearing, so the near ground comes down to it as a slope and not a cliff
        ex = R['front_dem'].get('except', [])
        bearings = np.arange(C.W, dtype=np.float32) / C.ppd
        reach = np.ones(C.W, np.float32)
        for lo, hi in ex:
            d0 = np.minimum(np.abs(((bearings - lo + 180) % 360) - 180), np.abs(((bearings - hi + 180) % 360) - 180))
            inside = ((bearings - lo) % 360) <= ((hi - lo) % 360)
            reach = np.minimum(reach, np.where(inside, 0.0, smoothstep(0, R['front_dem'].get('fade', 22), d0)))
        near = dem['forest'] & (dem['dist'] < R['front_dem']['dist'] * reach[None, :])
        out[near] = dem['rgb'][near]
    paint_belts(C, R, P, out)
    # down to its final size: this is where the pen and the tree edges get clean
    ppd = R['ppd']
    W, H = int(round(360 * ppd)), int(round((R['topTan'] - R['bottomTan']) * ppd * 180 / math.pi))
    # with the wrap kept: a few columns from the other side
    pad = 8
    wrapped = np.hstack([out[:, -pad:], out, out[:, :pad]])
    small = cv2.resize(wrapped, (W + int(round(2 * pad / SS)), H), interpolation=cv2.INTER_AREA)
    small = small[:, int(round(pad / SS)):int(round(pad / SS)) + W]
    if a.preview:
        pv = cv2.resize(small, (W // 3, H // 3), interpolation=cv2.INTER_AREA)
        Image.fromarray((np.clip(pv, 0, 1) * 255 + 0.5).astype(np.uint8)).save(a.preview, quality=88)
    T = R['tiles']
    half, edge = T['half'], T['edge']
    ptan = ppd * 180 / math.pi
    q = a.quality or T.get('quality', 84)
    os.makedirs(a.out, exist_ok=True)
    panels, total = [], 0
    for i, c in enumerate(T['centers']):
        x0 = int(round((c - half) * ppd))
        cols = (x0 + np.arange(int(round(2 * half * ppd)))) % W
        tile = small[:, cols]
        name = f"{T['file']}-{c:03d}.jpg"
        path = os.path.join(a.out, name)
        Image.fromarray((np.clip(tile, 0, 1) * 255 + 0.5).astype(np.uint8)).save(path, quality=q, subsampling=1, optimize=True, progressive=True)
        total += os.path.getsize(path)
        w_deg = 2 * half
        p = {'file': name, 'width': w_deg, 'edge': edge, 'rise': 0, 'baseHaze': [1, 1.01, 0], 'mist': R.get('mist', '#6f7f86')}
        # for CREDITS.md: every photo that reaches this tile
        reach = [s['photo'] for s in placed if any(s['span'][0] + k < c + half and s['span'][1] + k > c - half for k in (-360, 0, 360))]
        print(f"{name}: {', '.join(reach)}", file=sys.stderr)
        inside = [s for s in placed if abs(((s['bearing'] - c + 180) % 360) - 180) < half - edge and not s.get('view')]
        if inside:
            s = inside[0]
            u = 0.5 + (((s['bearing'] - c + 180) % 360) - 180) / w_deg
            row = (R['topTan'] - math.tan(math.radians(s['el']))) * ptan / H
            p['summit'] = {'name': s['name'], 'lat': s['lat'], 'lon': s['lon'], 'altitude': s['altitude'], 'u': round(u, 5), 'row': round(row, 5)}
            if s['compressed']:
                p['elevation'] = s['el']
                p['compressed'] = s['compressed']
        else:
            p['bearing'] = c
            p['elevation'] = 0
            p['row'] = round(R['topTan'] * ptan / H, 5)
        panels.append(p)
    print(json.dumps(panels))
    print(f'{total / 1048576:.2f} MB in {len(panels)} tiles of {int(round(2 * half * ppd))}x{H}; ' + '; '.join(f"{s['name']} at {s['bearing']:.1f}, {s['el']:.1f} deg (true {s['true_el']:.1f})" for s in placed), file=sys.stderr)


if __name__ == '__main__':
    main()
