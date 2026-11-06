#!/usr/bin/env python3
"""Bucharest on a warm evening, one closed panorama: python3 -I tools/panoramas/bucarest-paint.py [--preview p.jpg] [--out dir] [--quality q]

A flat city under a very big sky: the sky is the hero everywhere but on one bearing. Flat clean colours, few big masses: three bands of hazy roofs and crowns on the plain, the sun's glow low in the west,
big soft clouds. At their true bearings from the middle of the lap: the Parliament (the Gemini repaint, data/raw/backdrop-photos/bucarest-parliament-gemini, made whole below), standing as a long lens sees it from
the southbound half of the lap, the Casa Presei Libere at the end of Kiseleff, the Sky Tower beyond the lake.

Also writes the two paintings the 3D world wears: bucarest-parliament.jpg, the facade made whole from the right half of the repaint (the palace is symmetric about its portico, and the left of the painting is behind
a tree), the fountains left out, and bucarest-ateneu.jpg, the Ateneu's front. Prints the panels for def.backdrops on stdout."""
import argparse, json, math, os, sys
import numpy as np, cv2
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
PPD, TOP_TAN, BOT_TAN = 30, 0.6, -0.052
SKY = [(-8, '#f7dcab'), (0, '#f8dfb0'), (5, '#f8e2ba'), (9, '#f3e6c8'), (14, '#dfe6d8'), (20, '#bfdbe2'), (30, '#9fcbe2'), (45, '#82b9dd'), (65, '#6fa9d6')]
MIST = '#ecd4ac'
SUN = 258
CENTER = (44.447, 26.0925)
PAINT = 'data/raw/backdrop-photos/bucarest-parliament-gemini/bucarest-parliament.jpg'
ATENEU = 'data/raw/backdrop-photos/bucarest-skyline-gemini/bucarest-skyline.jpg'

def hexrgb(h): return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255
def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
def bearing_to(lat, lon):
    return (math.degrees(math.atan2((lon - CENTER[1]) * 79467, (lat - CENTER[0]) * 110950)) + 360) % 360

def facade():
    """The Parliament whole. Axis of the portico at column 757 of the repaint; the right half, up to where the trees begin, top rows clean, the arcade of the ground floor repeated over where the fountains stand."""
    src = np.asarray(Image.open(os.path.join(ROOT, PAINT)).convert('RGB'))
    AX, RIGHT, TOP, BASE, BOT = 757, 1185, 588, 858, 950
    half = src[TOP:BASE, AX:RIGHT].copy()
    # the ground floor: as it is by the portico, then the arcade again and again
    low = np.zeros((BOT - BASE, RIGHT - AX, 3), np.uint8)
    n = 845 - AX
    low[:, :n] = src[BASE:BOT, AX:845]
    tile = src[BASE:BOT, 845:935]
    for x in range(n, RIGHT - AX, 90):
        w = min(90, RIGHT - AX - x); low[:, x:x + w] = tile[:, :w]
    half = np.vstack([half, low])
    full = np.hstack([half[:, ::-1], half])
    full = cv2.resize(full, (1900, int(full.shape[0] * 1900 / full.shape[1])), interpolation=cv2.INTER_LANCZOS4)
    return full.astype(np.float32) / 255

# the silhouette of the facade as steps, from the axis out: to u (share of the half width), the top at v (share of the height down from the top)
STEPS = [(0.626, 0.0), (0.85, 0.385), (1.0, 0.355)]

def ateneu():
    src = np.asarray(Image.open(os.path.join(ROOT, ATENEU)).convert('RGB'))
    k = src.shape[1] / 1000
    crop = src[int(30 * k):int(535 * k), int(290 * k):int(720 * k)]
    crop = cv2.resize(crop, (820, int(crop.shape[0] * 820 / crop.shape[1])), interpolation=cv2.INTER_AREA)
    return crop.astype(np.float32) / 255

def stops(el, table):
    xs = np.array([t[0] for t in table], np.float32); cols = np.stack([hexrgb(t[1]) for t in table])
    return np.stack([np.interp(el, xs, cols[:, i]) for i in range(3)], -1)

def noise(W, H, scale, seed):
    rs = np.random.RandomState(seed); w = max(4, int(W / scale)); h = max(4, int(H / scale))
    a = rs.rand(h, w).astype(np.float32); a[:, -1] = a[:, 0]
    return cv2.resize(a, (W, H), interpolation=cv2.INTER_CUBIC)

def main():
    A = argparse.ArgumentParser(); A.add_argument('--preview'); A.add_argument('--out', default=os.path.join(ROOT, 'assets/backdrops')); A.add_argument('--quality', type=int, default=86)
    o = A.parse_args()
    ptan = PPD * 180 / math.pi
    W, H = 360 * PPD, int(round((TOP_TAN - BOT_TAN) * ptan))
    row0 = TOP_TAN * ptan
    rows = np.arange(H, dtype=np.float32)
    tan = TOP_TAN - rows / ptan
    el = np.degrees(np.arctan(tan))
    img = np.tile(stops(el, SKY)[:, None, :], (1, W, 1))
    az = np.arange(W, dtype=np.float32) / PPD
    # the glow where the sun goes down: a wide warm lens low in the west
    da = np.abs(((az - SUN + 180) % 360) - 180)
    glow = np.exp(-(da / 52) ** 2)[None, :] * np.exp(-(np.clip(el, 0, 90) / 15) ** 2)[:, None]
    img = img * (1 - 0.65 * glow[..., None]) + hexrgb('#ffdf9e') * 0.65 * glow[..., None]
    # big soft clouds, lit gold from below, in few flat masses
    n = noise(W, H, 170, 11) * 0.65 + noise(W, H, 62, 12) * 0.35
    band = sstep(6, 11, el) * (1 - sstep(30, 46, el))
    k = sstep(0.6, 0.74, n)[:, :] * band[:, None]
    img = img * (1 - 0.6 * k[..., None]) + hexrgb('#fff2d6') * 0.6 * k[..., None]
    def paint(mask, col, a=1.0):
        nonlocal img
        m = mask[..., None] * a; img = img * (1 - m) + hexrgb(col) * m if isinstance(col, str) else img * (1 - m) + col * m
    rs = np.random.RandomState(5)
    # the three bands of the plain, far to near: a wandering top of roofs, block slabs and crowns, flat colours going warm and pale with distance
    for base, amp, block, slabs, col, top_col in [(1.3, 0.25, 0.8, 70, '#dbc7bc', '#e3cdb8'), (1.05, 0.35, 1.3, 90, '#c5b4b4', '#d2bfb0'), (0.7, 0.38, 1.1, 120, '#a8a58f', '#b9b093')]:
        top = np.full(W, base, np.float32)
        for _ in range(slabs):
            c, w, h = rs.randint(W), rs.randint(PPD // 3, PPD * 2), base + rs.rand() * block
            xs = (c + np.arange(w)) % W; top[xs] = np.maximum(top[xs], h)
        top += (noise(W, 1, 24, rs.randint(9999))[0] - 0.5) * amp
        rtop = row0 - np.tan(np.radians(top)) * ptan
        grid = np.arange(H, dtype=np.float32)[:, None]
        mask = np.clip(grid - rtop[None, :] + 0.5, 0, 1)
        colm = stops(np.clip(el, -1, 5), [(-1, top_col), (5, col)])
        img = img * (1 - mask[..., None]) + np.tile(colm[:, None, :], (1, W, 1)) * mask[..., None]
    # the ground under it all is mist: where the 3D world's mist turns into the picture
    gm = sstep(0.5, -0.1, el)[:, None]
    img = img * (1 - gm[..., None]) + hexrgb(MIST) * gm[..., None]

    def stamp(rgb, alpha, bearing, width_deg, foot_el, haze):
        """rgb: h x w x 3, alpha: h x w, at the bearing, width in degrees, its foot at foot_el degrees; towards the air by haze"""
        nonlocal img
        w = int(width_deg * PPD); h = int(rgb.shape[0] * w / rgb.shape[1])
        r = cv2.resize(rgb, (w, h), interpolation=cv2.INTER_AREA); a = cv2.resize(alpha, (w, h), interpolation=cv2.INTER_AREA)
        r = r * (1 - haze) + hexrgb(MIST) * haze
        x0 = int((bearing - width_deg / 2) * PPD); y1 = int(row0 - math.tan(math.radians(foot_el)) * ptan); y0 = y1 - h
        cols = (x0 + np.arange(w)) % W
        ys = np.arange(max(0, y0), min(H, y1))
        sub = img[ys[:, None], cols]; aa = a[ys - y0][..., None]
        img[ys[:, None], cols] = sub * (1 - aa) + r[ys - y0] * aa

    # the Parliament: the facade with its steps, as a long lens sees it down a street
    F = facade(); fh, fw = F.shape[:2]
    Image.fromarray((F * 255 + 0.5).astype(np.uint8)).save(os.path.join(o.out, 'bucarest-parliament.jpg'), quality=84, subsampling=1, optimize=True, progressive=True)
    Image.fromarray((ateneu() * 255 + 0.5).astype(np.uint8)).save(os.path.join(o.out, 'bucarest-ateneu.jpg'), quality=84, subsampling=1, optimize=True, progressive=True)
    al = np.zeros((fh, fw), np.float32)
    u = np.abs(np.arange(fw) - fw / 2) / (fw / 2)
    top = np.zeros(fw)
    start = 0
    for lim, v in STEPS:
        top[(u >= start) & (u <= lim)] = v * fh; start = lim
    al = (np.arange(fh)[:, None] >= top[None, :]).astype(np.float32)
    al = cv2.GaussianBlur(al, (0, 0), 0.8)
    P_BEAR = bearing_to(44.4275, 26.0843)
    stamp(F, al, P_BEAR, 21, 0.3, 0.2)
    # the Casa Presei Libere, Stalin's wedding cake at the end of the Kiseleff axis, and the slim glass of the Sky Tower beyond the lake: in their own flat colours
    def tower(bearing, parts, col, haze=0.42):
        wd = max(p[0] for p in parts) + 0.2; hd = sum(p[1] for p in parts) + 0.2
        w = int(wd * PPD); h = int(hd * ptan * math.pi / 180) + 2
        rgb = np.zeros((h, w, 3), np.float32); a = np.zeros((h, w), np.float32); y = h
        for pw, ph, tone in parts:
            ph_px = int(ph * PPD); x0 = int((wd - pw) / 2 * PPD); x1 = w - x0
            a[y - ph_px:y, x0:x1] = 1; rgb[y - ph_px:y, x0:x1] = hexrgb(col) * tone
            # the lit side and the side in shade, one flat colour each: the sun is in the west
            rgb[y - ph_px:y, (x0 + x1) // 2:x1] *= 0.86; y -= ph_px
        stamp(rgb, a, bearing, wd, 0.5, haze)
    tower(bearing_to(44.4783, 26.0720), [(4.2, 1.4, 1), (3.2, 1.2, 1), (2.1, 1.3, 1.02), (1.1, 0.9, 1.04), (0.22, 0.55, 1)], '#e6c9a0')
    tower(bearing_to(44.4780, 26.1047), [(1.0, 3.7, 0.95), (0.3, 0.5, 1)], '#a9bfd0', 0.36)
    img = np.clip(img, 0, 1)
    if o.preview:
        Image.fromarray((img[::3, ::3] * 255 + 0.5).astype(np.uint8)).save(o.preview, quality=88)
    half, total, panels = 31, 0, []
    for c in (0, 60, 120, 180, 240, 300):
        x = int(round((c - half) * PPD)); cols = (x + np.arange(2 * half * PPD)) % W
        name = f'bucarest-pano-{c:03d}.jpg'; path = os.path.join(o.out, name)
        Image.fromarray((img[:, cols] * 255 + 0.5).astype(np.uint8)).save(path, quality=o.quality, subsampling=1, optimize=True, progressive=True)
        total += os.path.getsize(path)
        q = {'file': name, 'width': 2 * half, 'edge': 0, 'rise': 0, 'baseHaze': [1, 1.01, 0], 'mist': MIST}
        if c == 180:
            # the Parliament stands in for a summit: its top, as this long lens has it
            foot = row0 - math.tan(math.radians(0.3)) * ptan; top = foot - 21 * PPD * fh / fw
            q['summit'] = {'name': 'Palatul Parlamentului', 'lat': 44.4275, 'lon': 26.0843, 'altitude': 170, 'u': round(0.5 + (P_BEAR - c) / (2 * half), 5), 'row': round(top / H, 5)}
            q['elevation'] = round(math.degrees(math.atan((row0 - top) / ptan)), 2)
            q['compressed'] = 'true 2.3 deg from the middle of the lap: a long lens over the roofs from the southbound half, the size it fills down a straight street'
        else:
            q['bearing'] = c; q['elevation'] = 0; q['row'] = round(row0 / H, 5)
        panels.append(q)
    print(f'{total / 1048576:.2f} MB, parliament at {P_BEAR:.1f}', file=sys.stderr)
    print(',\n'.join('    ' + json.dumps(q, ensure_ascii=False) for q in panels))

if __name__ == '__main__':
    main()
