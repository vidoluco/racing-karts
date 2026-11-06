// The renderer in a real headless Metal browser: every track that exists loads, every kart id builds (the rounded
// placeholder standing in for one that has no file yet), each view stays inside the budget, the frame has pixels, and the
// real mountains stand on their true bearings in the baked horizon.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from '../tools/harness.mjs';
import { serveDev, ROOT } from '../tools/render-dev.mjs';
import { pickColumns, skyline, ringRadius, MESH_COLS, MESH_ROWS } from '../src/render/horizon.js';
import { KART_IDS } from '../src/data/karts.js';
import { sweep } from '../tools/budget-sweep.mjs';
import { lapCheck } from '../tools/long-check.mjs';

const TRACKS = readdirSync(join(ROOT, 'src/world/tracks')).filter((f) => f.endsWith('.js') && !f.startsWith('_')).map((f) => f.replace('.js', '')).filter((id) => {
  try { readFileSync(join(ROOT, `data/horizon/${id}.bin`)); return true; } catch { return false; }
});
const BUDGET = { calls: 150, tris: 500000, horizon: 40000 };
const SETTLE = 16; // frames at each spot: 6 leave the camera short of it and read up to 15k low
let srv, browser, page;
const errors = [];

before(async () => {
  srv = await serveDev({});
  browser = await launch('metal');
  page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
});
after(async () => {
  await Promise.race([browser?.close(), new Promise((r) => setTimeout(r, 3000))]);
  srv?.close();
});
const open = async (query) => {
  await page.goto(`${srv.base}/?${query}&quality=capture&countdown=1`);
  await page.waitForFunction(() => window.__dev?.ready || window.__dev?.error, null, { timeout: 180000 });
  const err = await page.evaluate(() => window.__dev.error);
  assert.equal(err, null, err || '');
};
const horizon = (id) => {
  const meta = JSON.parse(readFileSync(join(ROOT, `data/horizon/${id}.json`), 'utf8')), buf = readFileSync(join(ROOT, `data/horizon/${id}.bin`));
  return { meta, heights: new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2) };
};

test('the column picker is pure, keeps the count, and lands on a peak', () => {
  const top = new Float32Array(1440).map((_, a) => 5 + 3 * Math.sin(a / 40));
  top[200] = 30;
  const a = pickColumns(top, MESH_COLS), b = pickColumns(top, MESH_COLS);
  assert.deepEqual(a, b);
  assert.ok(a.length > MESH_COLS * 0.8 && a.length <= MESH_COLS);
  assert.ok(a.includes(200), 'the peak column is kept');
  for (let i = 1; i < a.length; i++) assert.ok(a[i] > a[i - 1]);
  assert.ok(MESH_COLS * (MESH_ROWS - 1) * 2 <= BUDGET.horizon);
});

test('Antelao and Pelmo stand on their true bearings in the baked horizon', () => {
  const { meta, heights } = horizon('antelao');
  const top = (from, to) => {
    let best = -1e9, at = 0;
    for (let a = Math.round((from / 360) * meta.naz); a < (to / 360) * meta.naz; a++) for (let j = 0; j < meta.nr; j++) {
      // near rings only: the Marmolada stands higher on the same bearing as the Pelmo, 38 km out
      if (ringRadius(meta, j) > 12000) break;
      const h = heights[a * meta.nr + j] * meta.unit;
      if (h > best) { best = h; at = (a / meta.naz) * 360; }
    }
    return { alt: best + meta.altitude, at };
  };
  const ant = top(50, 80), pel = top(240, 280);
  // GLO-30 reads Dolomite summits 30 to 130 m low: docs/references/cadore.md
  assert.ok(ant.alt > 3100 && ant.alt < 3280, `Antelao ${ant.alt}`);
  assert.ok(ant.at > 58 && ant.at < 70, `Antelao bearing ${ant.at}`);
  assert.ok(pel.alt > 3020 && pel.alt < 3190, `Pelmo ${pel.alt}`);
  assert.ok(pel.at > 250 && pel.at < 268, `Pelmo bearing ${pel.at}`);
  const sk = skyline(meta, heights);
  assert.ok(sk.top[Math.round((64 / 360) * meta.naz)] > sk.top[Math.round((140 / 360) * meta.naz)]);
  assert.ok(ringRadius(meta, 0) === meta.r0);
});

for (const id of TRACKS) {
  test(`${id}: builds, draws pixels, keeps the budget at 1 and 4 views`, async (t) => {
    // every half percent of the lap, with the camera arrived: a dozen fixed places let three tracks through at 530k
    const worst = await sweep(page, srv, id, { views: 1, settle: SETTLE });
    t.diagnostic(`${id} 1 view: ${(worst.tris / 1000).toFixed(0)}k at u ${worst.trisAt.toFixed(3)}, ${worst.calls} calls at u ${worst.callsAt.toFixed(3)}`);
    assert.equal(worst.spots, 200);
    assert.ok(worst.calls <= BUDGET.calls, `calls ${worst.calls} at u ${worst.callsAt}`);
    assert.ok(worst.tris <= BUDGET.tris, `triangles ${worst.tris} at u ${worst.trisAt}`);
    const horizonTris = await page.evaluate(() => window.__dev.renderer.world.horizon?.triangles ?? 0);
    assert.ok(horizonTris > 1000 && horizonTris <= BUDGET.horizon, `horizon ${horizonTris}`);
    // a frame with real colour in it, sky above and ground below, not a cleared buffer. The budget loop's 6 frames leave the camera still on its way from the last spot, possibly inside a wall: let it arrive
    await page.evaluate(() => { window.__dev.at(0.98, { others: true }); window.__dev.draw(); });
    const png = await page.screenshot();
    const stats = await page.evaluate(async (b64) => {
      const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const seen = new Set(), d = g.getImageData(0, 0, img.width, img.height).data;
      for (let i = 0; i < d.length; i += 400) seen.add((d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4));
      return seen.size;
    }, png.toString('base64'));
    assert.ok(stats > 60, `only ${stats} colours on screen`);
    // every road chunk stands where the lap says it does: a broken ribbon costs nothing in calls or colours
    const lost = await page.evaluate(() => {
      const R = window.__dev.renderer, T = window.__dev.track, S = T.samples; let bad = 0, n = 0;
      R.scene.traverse((o) => {
        if (!o.isMesh || !o.geometry.attributes.aRoad || o.geometry.attributes.aRoad.getX(0) >= 100000) return;
        n++; const g = o.geometry.attributes, i = Math.round(g.aRoad.getX(0) / T.step) % T.n, c = 6;
        // a long track restarts its distance every 918 m inside a chunk's own copy, so the chunk's place is that distance plus some whole restarts, and its far ribbon has fewer columns across
        let off = Infinity;
        for (let w = 0; w * 918 < T.length + 918; w += T.long ? 1 : 1e9) { const j = Math.round((g.aRoad.getX(0) + w * 918) / T.step) % T.n; for (let q = T.long ? 0 : c; q <= c; q++) off = Math.min(off, Math.hypot(g.position.getX(q) - S.x[j], g.position.getZ(q) - S.z[j])); }
        // that restart also takes the 100000 mark off a long track's shortcuts, so those chunks are looked for along their own samples
        if (off > 0.5 && T.long) for (const sc of T.shortcuts || []) for (let j = 0; j < sc.n; j++) for (let q = 0; q <= c; q++) off = Math.min(off, Math.hypot(g.position.getX(q) - sc.samples.x[j], g.position.getZ(q) - sc.samples.z[j]));
        if (off > 0.5) bad++;
      });
      return { bad, n };
    });
    assert.ok(lost.n > 3 && lost.bad === 0, JSON.stringify(lost));
    const four = await sweep(page, srv, id, { views: 4, settle: SETTLE });
    t.diagnostic(`${id} 4 views: ${(four.tris / 1000).toFixed(0)}k at u ${four.trisAt.toFixed(3)}, ${four.calls} calls at u ${four.callsAt.toFixed(3)}`);
    assert.ok(four.calls <= BUDGET.calls && four.tris <= BUDGET.tris, JSON.stringify(four));
  });
}

test('the budget sweep sees a spike between the places the old test looked at', async () => {
  // 530k empty triangles, drawn only within 40 m of u 0.663: nowhere near the old list's 0.6 and 0.7
  const spike = () => {
    const D = window.__dev, p = D.track.pointAt(0.663);
    let src = null;
    D.renderer.scene.traverse((o) => { if (!src && o.isMesh && o.geometry.index) src = o; });
    const m = src.clone(), g = src.geometry.clone();
    g.setIndex(new Array(1590000).fill(0));
    m.geometry = g; m.frustumCulled = false; m.material = src.material;
    m.onBeforeRender = (r, sc, cam) => { g.setDrawRange(0, Math.hypot(cam.position.x - p.x, cam.position.z - p.z) < 40 ? Infinity : 0); };
    D.renderer.scene.add(m);
  };
  const seen = await sweep(page, srv, 'antelao', { views: 1, settle: SETTLE, before: spike });
  assert.ok(seen.tris > BUDGET.tris, `the sweep missed it: ${seen.tris}`);
  assert.ok(Math.abs(seen.trisAt - 0.663) < 0.03, `seen at u ${seen.trisAt}`);
  const clean = await sweep(page, srv, 'antelao', { views: 1, settle: SETTLE });
  assert.ok(clean.tris <= BUDGET.tris, `without it ${clean.tris}`);
});

// the sweep stages its karts; these two are driven, whole laps of the real long tracks in an uncapped browser
for (const id of ['jakarta', 'batur', 'cortina', 'bucarest']) {
  test(`${id}: a whole real lap keeps the budget`, async (t) => {
    const fast = await launch('metal', { uncapped: true, extra: ['--enable-precise-memory-info'] });
    try {
      const lap = await (await fast.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage();
      const r = await lapCheck(lap, srv, { track: id, views: 1, speed: 8 });
      t.diagnostic(`${id} lap: ${(r.maxTris / 1000).toFixed(0)}k, ${r.maxCalls} calls, home ${r.home.finished}/${r.home.total}`);
      assert.ok(r.maxTris <= BUDGET.tris, `triangles ${r.maxTris}`);
      assert.ok(r.maxCalls <= BUDGET.calls, `calls ${r.maxCalls}`);
      assert.ok(r.iv.length > 500, `only ${r.iv.length} frames: no lap was driven`);
    } finally {
      await Promise.race([fast.close(), new Promise((res) => setTimeout(res, 3000))]);
    }
  });
}

test('a toast never sits on the banner, at 1, 2 and 4 views, on a TV and a laptop', async () => {
  const overlapOf = () => {
    const out = [];
    for (const hv of document.querySelectorAll('.hv')) {
      const ban = document.createElement('div'); ban.className = 'banner'; ban.textContent = 'ULTIMO GIRO';
      // the longest kind of line, and the banner at the top of its pop: one short toast on a banner at rest always missed by 5 px
      const toast = document.createElement('div'); toast.className = 'toast warn'; toast.textContent = 'Il camion della frana occupa la corsia di sinistra, passa a destra';
      hv.querySelector('.bannerz').append(ban); hv.querySelector('.toastz').append(toast);
      ban.style.animation = toast.style.animation = 'none';
      ban.style.transform = 'translate(-50%, 0) scale(1.15)';
      const a = ban.getBoundingClientRect(), b = toast.getBoundingClientRect(), v = hv.getBoundingClientRect();
      out.push({ both: Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top), toastInView: b.bottom <= v.bottom, banner: a.height, toast: b.height });
      ban.remove();
      // and the disaster's road sign, the one that is really in the toast's way: the toast steps down under it
      const dis = document.createElement('div'); dis.className = 'dis'; dis.textContent = 'Frana sul passo: attenti alla curva'; dis.style.animation = 'none';
      hv.querySelector('.bannerz').append(dis);
      const c = dis.getBoundingClientRect(), e = toast.getBoundingClientRect();
      out.push({ both: Math.min(c.bottom, e.bottom) - Math.max(c.top, e.top), toastInView: e.bottom <= v.bottom, banner: c.height, toast: e.height });
      dis.remove(); toast.remove();
    }
    return out;
  };
  for (const [width, height] of [[1280, 720], [1920, 1080]]) for (const views of [1, 2, 4]) {
    await page.setViewportSize({ width, height });
    await open(`track=antelao&views=${views}&hud=1`);
    const rows = await page.evaluate(overlapOf);
    assert.equal(rows.length, views * 2);
    for (const r of rows) {
      assert.ok(r.banner > 10 && r.toast > 10, `${width} ${views} views: nothing measured ${JSON.stringify(r)}`);
      assert.ok(r.both <= 0, `${width} ${views} views: toast and banner share ${r.both} px`);
      assert.ok(r.toastInView, `${width} ${views} views: the toast fell out of its view`);
    }
  }
  await page.setViewportSize({ width: 1280, height: 720 });
});

test('every kart id builds through the loader, falling back to the placeholder', async () => {
  await open('track=antelao&views=1');
  const out = await page.evaluate(async (ids) => {
    const R = window.__dev.renderer, res = {};
    for (const id of ids) {
      const s = await R.showcase(id, { size: 96 });
      const k = s.model;
      res[id] = { group: !!k.group, meshes: (() => { let n = 0; k.group.traverse((o) => { if (o.isMesh) n++; }); return n; })() };
      s.dispose();
    }
    const unknown = await R.showcase('no-such-kart', { size: 96 });
    let m = 0; unknown.model.group.traverse((o) => { if (o.isMesh) m++; });
    res.unknown = { group: !!unknown.model.group, meshes: m };
    unknown.dispose();
    const item = await R.loadItem('no-such-item');
    res.item = { hasGroup: !!item?.group };
    return res;
  }, KART_IDS);
  for (const [id, r] of Object.entries(out)) if (id !== 'item') { assert.ok(r.group, id); assert.ok(r.meshes > 0, id); }
  assert.ok(out.item.hasGroup, 'item fallback');
});

test('shapes and mat: the helpers other builders rely on', async () => {
  await open('track=antelao&views=1');
  const r = await page.evaluate(() => {
    const { shapes, mat, THREE } = window.__dev.renderer;
    const g = [shapes.roundedBox(1, 1, 1, 0.1, 2), shapes.capsule(0.3, 1, 3, 8), shapes.lathe([[0, 0], [1, 0.5], [0, 1]], 8), shapes.tube([[0, 0, 0], [1, 1, 1], [2, 0, 0]], 0.1, 6), shapes.box(1, 2, 3)];
    const merged = shapes.merge(g);
    const a = mat('#c9513d'), b = mat('#c9513d'), c = mat('#c9513d', { gloss: [30, 0.2] });
    return { verts: merged.attributes.position.count, indexed: !!merged.index, cached: a === b, distinct: a !== c, isMat: a instanceof THREE.Material };
  });
  assert.ok(r.verts > 50 && r.indexed && r.cached && r.distinct && r.isMat, JSON.stringify(r));
});

test('views: flyover resolves, the winner orbit runs, one to four views lay out', async () => {
  await open('track=antelao&views=1');
  const r = await page.evaluate(async () => {
    const D = window.__dev, R = D.renderer;
    const done = R.flyover({ duration: 0.05 });
    for (let i = 0; i < 8; i++) D.frames(1);
    await Promise.race([done, new Promise((_, rej) => setTimeout(() => rej(new Error('flyover did not end')), 3000))]);
    D.race.state.karts[0].finished = true;
    const s = D.frames(3);
    return { calls: s.drawCalls };
  });
  assert.ok(r.calls > 10);
  for (const n of [2, 3, 4]) {
    await open(`track=antelao&views=${n}`);
    const s = await page.evaluate(() => { window.__dev.at(0.3, { settle: 3 }); return window.__dev.draw(); });
    assert.ok(s.drawCalls > 10 * Math.min(n, 3), `views ${n}: ${s.drawCalls}`);
  }
  assert.deepEqual(errors, []);
});
