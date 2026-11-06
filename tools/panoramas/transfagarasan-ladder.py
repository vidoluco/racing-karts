#!/usr/bin/env python3
"""The hairpin ladder of the DN7C on the green wall under Netedu, the thing the road is famous for. Local, no network.
python3 -I tools/panoramas/transfagarasan-ladder.py green <carpazi.jpg> <carpazi-green.jpg>   before compose: the dry ochre of that painting to the summer green of the place
python3 -I tools/panoramas/transfagarasan-ladder.py paint <transfagarasan-pano-060.jpg>      after compose, on the tile in place: run it again each time the panorama is composed
python3 -I tools/panoramas/transfagarasan-ladder.py plain <transfagarasan-pano-000.jpg>       after compose, on the tiles 300, 000 and 060, before paint: the plain in the V

The road runs north east from the lake on that wall (tools/panoramas/transfagarasan-road.json), so the ladder stands at its true side of the compass, bearing 52 to 73, and every part of the lap heading that way sees it."""
import sys
import numpy as np, cv2

def read(p): return cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)
def write(p, im, q=88): cv2.imencode('.jpg', im, [cv2.IMWRITE_JPEG_QUALITY, q])[1].tofile(p); print(p, im.shape[1], im.shape[0])
def hexbgr(h): return tuple(int(h[i:i + 2], 16) for i in (5, 3, 1))

# the tile: bearing 29 at x 0, 30 px a degree; row 1031 is the horizon, linear in the tangent; over 18 deg the elevations are compressed, the ladder stays under
TILE0, PPD, HORIZON, PX_TAN = 29, 30, 1031.3, 1513 / 0.88
def X(b): return (b - TILE0) * PPD
def Y(el): return HORIZON - np.tan(np.radians(el)) * PX_TAN

def green(src, out):
    L = cv2.cvtColor(read(src).astype(np.float32) / 255, cv2.COLOR_BGR2LAB)
    warm = np.clip((L[..., 2] - 6) / 12, 0, 1) * np.clip((L[..., 1] + 6) / 6, 0, 1)
    warm = cv2.GaussianBlur(warm, (0, 0), 1.5)
    L[..., 1] = L[..., 1] * (1 - warm) + (L[..., 1] * 0.25 - 19) * warm
    L[..., 2] = L[..., 2] * (1 - warm) + (L[..., 2] * 1.08 + 3) * warm
    L[..., 0] = L[..., 0] * (1 - warm) + np.minimum(100, L[..., 0] * 1.03 + 2) * warm
    write(out, (np.clip(cv2.cvtColor(L, cv2.COLOR_LAB2BGR), 0, 1) * 255 + 0.5).astype(np.uint8), 94)

def plain(path):
    # the open end of the valley: the plain of Transylvania going off in the haze, soft into the sky, never a grey band that reads as a sea
    im = read(path).astype(np.float32); H, W = im.shape[:2]
    Lb = cv2.cvtColor(im.astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32) - [0, 128, 128]
    rows = np.arange(H, dtype=np.float32)[:, None]
    grey = np.clip((14 - np.hypot(Lb[..., 1], Lb[..., 2])) / 3, 0, 1) * np.clip((Lb[..., 0] - 150) / 8, 0, 1) * np.clip((rows - HORIZON + 26) / 10, 0, 1)
    # only the wide open run: a real grey on the rock is short
    wide = cv2.blur((grey > 0.5).astype(np.float32), (121, 1)) > 0.8
    m = cv2.GaussianBlur(cv2.dilate(wide.astype(np.float32) * grey, np.ones((5, 5))), (0, 0), 3)
    stops = [(-26, '#a9d6e6'), (0, '#a2d2d8'), (34, '#9cc9b8'), (90, '#93bf8c'), (200, '#86b366'), (482, '#79a64a')]
    ys = np.array([HORIZON + a for a, _ in stops]); cs = np.array([hexbgr(c) for _, c in stops], np.float32)
    col = np.stack([np.interp(rows[:, 0], ys, cs[:, k]) for k in range(3)], axis=1)[:, None, :].repeat(W, axis=1)
    # big soft fields of the plain, no grain
    f = cv2.resize(cv2.GaussianBlur(np.random.default_rng(7).random((H // 40, W // 80), np.float32), (0, 0), 1.2), (W, H), interpolation=cv2.INTER_CUBIC)
    f = (f - f.mean()) / (f.std() + 1e-6)
    col = col * (1 + 0.035 * f[..., None] * np.clip((rows[..., None] - HORIZON - 40) / 90, 0, 1))
    im = im * (1 - m[..., None]) + col * m[..., None]
    # the mist the painting left on the tail of the green wall, bearing 18 to 55: it goes to the green of the wall
    x0 = TILE0 if '060' in path else -31 if '000' in path else None
    if x0 is not None:
        U = (np.arange(W, dtype=np.float32) / PPD + x0)[None, :]
        tail = np.clip((U - 18) / 2, 0, 1) * np.clip((55 - U) / 3, 0, 1) * (rows < HORIZON + 26)
        g = np.clip((14 - np.hypot(Lb[..., 1], Lb[..., 2])) / 4, 0, 1) * np.clip((Lb[..., 0] - 110) / 15, 0, 1) * np.clip((198 - Lb[..., 0]) / 8, 0, 1) * tail
        g = cv2.GaussianBlur(g.astype(np.float32), (0, 0), 3)[..., None]
        im = im * (1 - g) + np.array(hexbgr('#86a53e'), np.float32) * g
    write(path, np.clip(im, 0, 255).astype(np.uint8))

def rung_path():
    # rungs as (bearing, elevation) of both ends, top to bottom; they open up toward the foot, as a stack seen from below does
    els = [11.3, 9.7, 7.9, 6.0, 4.0, 1.8]
    left = [60.0, 57.6, 55.0, 53.0, 51.0, 49.0]
    right = [71.0, 71.6, 72.0, 72.0, 71.6, 71.0]
    pts = []
    n = len(els)
    for i in range(n):
        a, b = (left[i], right[i]) if i % 2 == 0 else (right[i], left[i])
        pts.append((a, els[i], b, els[i] - 0.45))
    return pts, els

def stroke(pts_px, w, col, im, off=0):
    p = np.round((pts_px + [0, off]) * 8).astype(np.int32).reshape(-1, 1, 2)
    cv2.polylines(im, [p], False, col, int(round(w)), cv2.LINE_AA, 3)

def paint(path):
    im = read(path).astype(np.float32); H, Wd = im.shape[:2]
    rungs, els = rung_path()
    # the road, one line: each rung a gentle sag, joined to the next by a hairpin that bulges past both ends
    road, width = [], []
    N = len(rungs)
    for i, (b0, e0, b1, e1) in enumerate(rungs):
        k = 1 + i / (N - 1) * 0.9  # thicker toward the foot
        t = np.linspace(0, 1, 60)
        xx = X(b0) + (X(b1) - X(b0)) * t
        yy = Y(e0) + (Y(e1) - Y(e0)) * t + 7 * k * np.sin(t * np.pi) * ((i % 2) * 2 - 1) * 0.6
        road += list(zip(xx, yy)); width += [k] * 60
        if i < N - 1:
            nb, ne = rungs[i + 1][0], rungs[i + 1][1]
            x0, y0, y1 = X(b1), Y(e1), Y(ne)
            r = (y1 - y0) / 2; cy = (y0 + y1) / 2; sd = 1 if b1 > b0 else -1
            x1 = X(nb)
            for a in np.linspace(-np.pi / 2, np.pi / 2, 26):
                f = (a + np.pi / 2) / np.pi
                road.append((x0 * (1 - f) + x1 * f + sd * r * 1.05 * np.cos(a), cy + r * np.sin(a)))
                width.append(k + 0.9 / (N - 1) * f)
    road = np.array(road, np.float32); width = np.array(width, np.float32)
    # the top of the road goes on up the wall toward the ridge and the tunnel; its foot runs out under the frame
    top = np.array([[X(63.5), Y(13.0)], [X(62.6), Y(12.4)], [X(61.2), Y(11.8)]], np.float32)
    bx0, by0 = road[-1]; d = np.sign(road[-1, 0] - road[-30, 0])
    foot = np.array([[bx0 + d * 40, by0 + 14], [bx0 + d * 110, by0 + 60], [bx0 + d * 180, by0 + 130]], np.float32)
    road = np.vstack([top, road, foot]); width = np.concatenate([[1, 1, 1], width, [width[-1]] * 3])

    # the wall: flat clean green under the stack, its streaks and pen lines melted away, edges soft
    x0, x1, y0, y1 = int(X(45)), int(X(75.5)), int(Y(14)), int(Y(-2.5))
    y0 = max(y0, 0); y1 = min(y1, H)
    d = np.full((H, Wd), 255, np.uint8)
    cv2.polylines(d, [np.round(road).astype(np.int32).reshape(-1, 1, 2)], False, 0, 3)
    dist = cv2.distanceTransform(d, cv2.DIST_L2, 3)
    calm = np.clip((95 - dist) / 60, 0, 1)
    # never over the sky or the hero's rock: only what is already land and warm or green
    Lb = cv2.cvtColor(im.astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
    blue = Lb[..., 2] < 128 + 6
    land = cv2.GaussianBlur((~blue).astype(np.float32), (0, 0), 4)
    land = np.clip((land - 0.75) / 0.2, 0, 1)
    calm = cv2.GaussianBlur(calm, (0, 0), 14) * land
    med = cv2.medianBlur(im.astype(np.uint8), 41).astype(np.float32)
    med = cv2.GaussianBlur(med, (0, 0), 16)
    grn = np.array(hexbgr('#86a53e'), np.float32)
    flat = med * 0.55 + grn * 0.45
    im = im * (1 - calm[..., None]) + flat * calm[..., None]

    # the stack, in layers: soft shadow on the slope, the pale retaining wall, the road, a thin pen as in the painting
    def layer(col, wf, off, blur=0, alpha=1.0):
        m = np.zeros((H, Wd), np.uint8)
        for i in range(0, len(road) - 1, 6):
            k = float(width[i]); stroke(road[i:i + 7], wf(k), 255, m, off * k)
        f = m.astype(np.float32) / 255
        if blur: f = cv2.GaussianBlur(f, (0, 0), blur)
        return im * (1 - f[..., None] * alpha) + np.array(col, np.float32) * f[..., None] * alpha
    im = layer(hexbgr('#3e5a22'), lambda k: 15 * k, 7, blur=5, alpha=0.5)
    im = layer(hexbgr('#8d8772'), lambda k: 12 * k, 4.5)
    im = layer(hexbgr('#2c2f2a'), lambda k: 12.5 * k, 0, alpha=0.65)
    im = layer(hexbgr('#f1ecdb'), lambda k: 10 * k, 0)
    write(path, np.clip(im, 0, 255).astype(np.uint8))

if sys.argv[1] == 'green': green(sys.argv[2], sys.argv[3])
elif sys.argv[1] == 'plain': plain(sys.argv[2])
else: paint(sys.argv[2])
