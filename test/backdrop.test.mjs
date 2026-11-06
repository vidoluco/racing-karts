// Real backdrops, per track that exists: the panels stand where the real mountains stand. See "Real backdrops" in the spec.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { TRACK_IDS, loadTrackDef } from '../src/data/tracks.js';
import { buildTrack } from '../src/world/track.js';
import { placePanel, panelPoint, summitTruth, mistStrip, bearingTo, skyStops } from '../src/render/backdrop.js';
import { launch } from '../tools/harness.mjs';
import { serveDev, ROOT } from '../tools/render-dev.mjs';

const DIR = join(ROOT, 'assets/backdrops');
// the top of the chase frame at its slowest (fov 54, camera pitched 2.6 deg down, LOOK_UP in camera.js): a summit over it is out of the picture
const FRAME_TOP = 24.45;
const angle = (a, b) => { const d = Math.abs(((a - b) % 360 + 360) % 360); return d > 180 ? 360 - d : d; };

// [width, height] from a JPEG's frame header, no decoder needed.
function jpegSize(file) {
  const b = readFileSync(file);
  assert.equal(b.readUInt16BE(0), 0xffd8, `${file} is not a JPEG`);
  for (let i = 2; i < b.length;) {
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  throw new Error(`no frame header in ${file}`);
}

// The ridge row (0..1) of the image over column u: the real step in a few columns round it that lies nearest the row declared (a painted cloud has steps of its own, higher up).
function ridgeRow(file, u, near) {
  const py = `
import sys, numpy as np
from PIL import Image
im = np.asarray(Image.open(sys.argv[1]).convert('L'), dtype=np.float32)
H, W = im.shape
x = int(float(sys.argv[2]) * W); span = max(2, W // 300)
near = float(sys.argv[3]) * H
best = 1e9
for c in range(max(0, x - span), min(W, x + span + 1)):
    col = im[:, c]
    d = np.convolve(col, [1, 1, 1, -1, -1, -1], mode='valid') / 3
    rows = np.nonzero(np.abs(d) > 14)[0] + 3
    if rows.size:
        r = rows[np.argmin(np.abs(rows - near))]
        if abs(r - near) < abs(best - near): best = r
print(best / H)
`;
  return +execFileSync('python3', ['-I', '-c', py, file, String(u), String(near)], { encoding: 'utf8' }).trim();
}

const defs = [];
for (const id of TRACK_IDS) {
  // a track not written yet has no def to test
  const def = await loadTrackDef(id).catch(() => null);
  if (def) defs.push(def);
}

test('bearing and distance on the sphere', () => {
  const { bearing, distance } = bearingTo([46.437, 12.218], [46.4519, 12.2618]);
  assert.ok(angle(bearing, 63.6) < 1, `Antelao from Borca at ${bearing}`);
  assert.ok(Math.abs(distance - 3750) < 150, `${distance} m`);
});

test('the mist strip blends the panels and says where one stands whole', () => {
  const strip = mistStrip([{ az: 0, width: 1, edge: 0.1, rgb: [100, 150, 200] }], [10, 10, 10], 64);
  const at = (a) => Math.floor(((a + Math.PI) / (2 * Math.PI)) * 64) * 4;
  assert.ok(Math.abs(strip[at(0)] - 100) < 6);
  assert.equal(strip[at(0) + 3], 255);
  assert.equal(strip[at(Math.PI - 0.2) + 3], 0);
  assert.ok(strip[at(Math.PI - 0.2)] < 20);
});

test('the dome takes its stops from the panels', () => {
  const rows = Array.from({ length: 40 }, (_, i) => (i < 20 ? [200 + i, 150, 220] : null));
  const place = { row: 0.2, yb: Math.tan(0.3), hy: 0.8 };
  const out = skyStops([[0, '#000000'], [17, '#000000'], [80, '#ffffff']], [{ place, weight: 1, read: { rows, H: 40 } }]);
  assert.notEqual(out[1][1], '#000000', 'a stop that a panel shows sky at takes its colour');
  assert.notEqual(out[0][1], '#000000', 'under the panels the lowest sky holds');
  assert.equal(out.length, 3);
});

for (const def of defs) {
  test(`${def.id}: panels`, () => {
    const P = def.backdrops;
    assert.ok(Array.isArray(P) && P.length >= 3, `${def.id} needs at least 3 panels (spec, Real backdrops)`);
    assert.ok(P.length <= 8, 'at most 8 panels');
    const credits = existsSync(join(DIR, 'CREDITS.md')) ? readFileSync(join(DIR, 'CREDITS.md'), 'utf8') : '';
    let total = 0;
    for (const p of P) {
      const file = join(DIR, p.file);
      assert.ok(existsSync(file), `${p.file} missing`);
      assert.ok(/\.jpe?g$/i.test(p.file), `${p.file}: JPEG only`);
      const [w, h] = jpegSize(file);
      assert.ok(w <= 4096, `${p.file} ${w} px wide, budget 4096`);
      total += statSync(file).size;
      const row = credits.split('\n').find((l) => l.startsWith(`| ${p.file} `));
      assert.ok(row, `${p.file} has no row in assets/backdrops/CREDITS.md`);
      assert.match(row, /CC BY|CC0|Public domain|CC-BY/i, `${p.file}: no free licence in its credit`);
      assert.ok(Array.isArray(p.baseHaze) && p.baseHaze.length === 3, `${p.file}: baseHaze`);
      assert.ok(/^#[0-9a-f]{6}$/i.test(p.mist || ''), `${p.file}: mist`);
      const place = placePanel(p, def, w / h);
      // bearings are true in the world: -z is at northDeg
      assert.ok(angle(place.azimuth * 180 / Math.PI + (def.horizon.northDeg ?? 0), place.bearing) < 1e-6);
      if (!p.summit) { assert.ok(Number.isFinite(p.bearing) && Number.isFinite(p.elevation) && Number.isFinite(p.row), `${p.file}: bearing, elevation and row`); continue; }
      const truth = summitTruth(def.horizon, p.summit), top = panelPoint(place, p.summit.u, p.summit.row), declared = p.elevation ?? truth.elevation;
      assert.ok(angle(top.bearing, truth.bearing) < 2, `${p.summit.name} at ${top.bearing.toFixed(1)}, true bearing ${truth.bearing.toFixed(1)}`);
      assert.ok(Math.abs(top.elevation - declared) < 0.05, `${p.summit.name}: top at ${top.elevation.toFixed(2)}, declared ${declared.toFixed(2)}`);
      if (Math.abs(declared - truth.elevation) > 1) assert.ok(typeof p.compressed === 'string' && p.compressed.length > 8, `${p.summit.name} declares ${declared} against a true ${truth.elevation.toFixed(1)} deg: say why in compressed`);
      assert.ok(declared <= FRAME_TOP, `${p.summit.name} at ${declared} deg is out of the chase frame (${FRAME_TOP})`);
      // the picture agrees: the ridge of the image really peaks where the panel says it does
      const row2 = ridgeRow(file, p.summit.u, p.summit.row);
      assert.ok(Math.abs(row2 - p.summit.row) < 0.03, `${p.file}: ridge at row ${row2.toFixed(3)} over u ${p.summit.u}, declared row ${p.summit.row}`);
    }
    assert.ok(total < 3 * 1024 * 1024, `${def.id}: ${(total / 1048576).toFixed(2)} MB of backdrops, budget 3`);
    // edge 0 is a tile of one continuous panorama: tiles must close the circle with no gap and no fade anywhere
    if (P.some((p) => p.edge === 0)) {
      assert.ok(P.every((p) => p.edge === 0), 'all tiles or none');
      const spans = P.map((p) => { const [w, h] = jpegSize(join(DIR, p.file)), q = placePanel(p, def, w / h); return [q.bearing, p.width]; });
      for (let b = 0; b < 360; b += 0.5) assert.ok(spans.some(([c, w]) => angle(b, c) < w / 2), `no tile at bearing ${b}`);
    }
  });

  test(`${def.id}: the road faces its great mountain`, () => {
    const P = def.backdrops.filter((p) => p.summit);
    assert.ok(P.length, 'a track has a named summit');
    const hero = P.reduce((a, b) => ((a.elevation ?? summitTruth(def.horizon, a.summit).elevation) >= (b.elevation ?? summitTruth(def.horizon, b.summit).elevation) ? a : b));
    const az = summitTruth(def.horizon, hero.summit).bearing - (def.horizon.northDeg ?? 0), track = buildTrack(def), S = track.samples;
    const heading = (i) => Math.atan2(S.tx[i], -S.tz[i]) * 180 / Math.PI;
    let facing = 0;
    for (let i = 0; i < track.n; i++) if (angle(heading(i), az) < 30) facing++;
    const share = facing / track.n;
    assert.ok(share >= 0.18, `${hero.summit.name} is within 30 deg of the road's heading on ${(share * 100).toFixed(0)}% of the lap`);
    if (def.id === 'antelao') {
      // the first seconds of the race
      for (let i = 0; i < 40; i++) assert.ok(angle(heading(i), az) < 30, `sample ${i}: heading ${heading(i).toFixed(0)}, Antelao at ${az.toFixed(0)}`);
    }
  });
}

test('antelao in a real page: panels drawn, one call, the dome takes their sky, a missing file is only a warning', async () => {
  const srv = await serveDev({ dist: null });
  const browser = await launch('metal');
  try {
    const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
    const warnings = [];
    page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });
    await page.route('**/assets/backdrops/antelao-pano-120.jpg', (r) => r.fulfill({ status: 404, body: '' }));
    await page.goto(`${srv.base}/?track=antelao&views=1&quality=capture&countdown=0&shade=512`);
    await page.waitForFunction(() => window.__dev?.ready || window.__dev?.error, null, { timeout: 180000 });
    assert.equal(await page.evaluate(() => window.__dev.error), null);
    const r = await page.evaluate(() => {
      const D = window.__dev; D.frames(4);
      const W = D.renderer.world, b = W.backdrop;
      const dome = W.sky.material.uniforms.cols.value.map((c) => c.getHexString());
      return { visible: b.mesh.visible, panels: b.panels.map((p) => p.file), hero: b.hero?.elevation, sky: b.mesh.userData.sky, dome, mist: D.renderer.shared.mist.uMist.value.z, covers: b.covers, ring: W.horizon?.mesh.visible };
    });
    assert.equal(r.visible, true);
    assert.equal(r.panels.length, 5, 'five of six: one was refused');
    assert.ok(!r.panels.includes('antelao-pano-120.jpg'));
    assert.equal(r.hero, 24);
    assert.ok(Math.abs(r.mist - 0.62) < 1e-6, `mist amount ${r.mist}`);
    assert.equal(r.covers, false, 'a refused tile leaves a gap');
    assert.equal(r.ring, true, 'so the DEM ring stays to fill it');
    assert.ok(r.sky.length >= 5);
    assert.ok(warnings.some((w) => w.includes('antelao-pano-120.jpg')), 'a warning names the missing file');
  } finally {
    await Promise.race([browser.close(), new Promise((res) => setTimeout(res, 3000))]);
    srv.close();
  }
});
