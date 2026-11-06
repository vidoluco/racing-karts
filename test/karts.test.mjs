// The karts and items: each builds, stays inside its budget and draws in one call; poses really move the bones; the icons parse; the
// loader and the real toon pipeline agree with what the builders promise. Geometry runs in Node, the picture in headless Metal.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { createMat, createShared, resolveLook } from '../src/render/toon.js';
import * as shapes from '../src/render/shapes.js';
import { KART_IDS, SECRET_IDS } from '../src/data/karts.js';
import { ITEM_IDS } from '../src/data/items.js';
import { itemIcon, flag, uiIcon, UI_ICON_NAMES } from '../src/ui/icons.js';
import { launch } from '../tools/harness.mjs';
import { serveDev, ROOT } from '../tools/render-dev.mjs';

// the spec's roster and the data file's: whichever a build ships with, every id has a real model
const KARTS = [...new Set([...KART_IDS, ...SECRET_IDS, 'tabia', 'gatto', 'seggiovia', 'mocanita', 'caruta', 'logan', 'jeep', 'becak', 'jukung'])];
const ITEMS = [...new Set([...ITEM_IDS, 'razzo', 'grappa', 'zuica', 'mici', 'uova', 'polenta', 'formaggio', 'durian', 'sambal', 'rendang', 'frana'])];
const MAX_TRIS = 3500, MAX_ITEM_TRIS = 3500;
const mat = createMat(createShared(resolveLook({})));
const ctx = { THREE, mat, shapes };
const buildKart = async (id) => (await import(`../src/render/karts/${id}.js`)).build(ctx);
const buildItem = async (id) => (await import(`../src/render/items/${id}.js`)).build(ctx);
const still = (over = {}) => ({ speed: 0, steer: 0, throttle: 0, grounded: true, vy: 0, yaw: 0, drift: 0, boostT: 0, boostKind: null, hitT: 0, hitKind: null, tipsyT: 0, stinkT: 0, bigT: 0, finished: false, place: 1, orbit: 0, ...over });
const run = (m, st, n = 40) => { for (let i = 0; i < n; i++) m.update(st, 1 / 60); };
const transforms = (m) => m.body.skeleton.bones.map((b) => [...b.position.toArray(), ...b.quaternion.toArray(), ...b.scale.toArray()].map((v) => +v.toFixed(3)).join());
const moved = (a, b) => a.filter((v, i) => v !== b[i]).length;

for (const id of KARTS) {
  test(`kart ${id}: builds in budget, one skinned mesh, wheels on the ground`, async () => {
    const m = await buildKart(id);
    const box = new THREE.Box3();
    let meshes = 0;
    m.group.traverse((o) => { if (o.isMesh) meshes++; });
    assert.equal(meshes, 1, 'one mesh, one draw call');
    assert.ok(m.tris > 800 && m.tris <= MAX_TRIS, `${m.tris} triangles`);
    assert.equal(m.body.geometry.index.count / 3, m.tris);
    assert.ok(m.wheels.length >= 3, 'wheels');
    assert.ok(m.wheels.some((w) => w.userData.front) || id === 'gatto', 'something steers');
    for (const w of m.wheels) assert.equal(w.rotation.order, 'YXZ', 'spin first, then steer');
    assert.ok(m.driver?.head, 'a driver');
    // nothing bad in the geometry, no NaN from a degenerate helper
    const P = m.body.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) { assert.ok(Number.isFinite(P.getX(i) + P.getY(i) + P.getZ(i)), `vertex ${i} is not finite`); }
    box.setFromBufferAttribute(P);
    assert.ok(box.min.y > -0.05 && box.min.y < 0.2, `sits on the ground: ${box.min.y}`);
    assert.ok(box.max.z - box.min.z < 4.4 && box.max.y < 4, `size ${JSON.stringify(box)}`);
    // every front wheel is on the +z half, as the contract says the model faces +z
    for (const w of m.wheels) if (w.userData.front) assert.ok(w.position.z > 0 || w.userData.at[2] > 0, 'front wheels in front');
    assert.equal(m.body.material, mat('#ffffff', m.body.material.userData.opts ?? { vertexColors: true, gloss: [26, 0.05], rim: [0.05, 3] }), 'the shared material');
    m.dispose();
  });

  test(`kart ${id}: reacts: lean, hit, cheer, sad, orbit and a zero dt`, async () => {
    const m = await buildKart(id);
    run(m, still());
    const idle = transforms(m);
    const lean = await buildKart(id); run(lean, still({ speed: 25, steer: 1 }));
    const hit = await buildKart(id); run(hit, still({ speed: 10, hitT: 0.5, hitKind: 'spin' }));
    const cheer = await buildKart(id); run(cheer, still({ finished: true, place: 1 }));
    const sad = await buildKart(id); run(sad, still({ finished: true, place: 8 }));
    for (const [name, o] of [['lean', lean], ['hit', hit], ['cheer', cheer], ['sad', sad]]) assert.ok(moved(idle, transforms(o)) > 5, `${name} moves the bones`);
    // lean: the head looks into a right turn, which is towards -x, a negative turn about y
    assert.ok(lean.driver.head.rotation.y < -0.1, `head yaw ${lean.driver.head.rotation.y}`);
    const arm = cheer.bones.get('armL'), restArm = m.bones.get('armL');
    assert.ok(arm.quaternion.angleTo(restArm.quaternion) > 0.3, 'arms go up to cheer');
    // the sausages appear with the charges
    const orb = await buildKart(id); run(orb, still({ orbit: 2 }), 30);
    assert.ok(orb.bones.get('orbit0').scale.x > 0.5 && orb.bones.get('orbit1').scale.x > 0.5 && orb.bones.get('orbit2').scale.x < 0.05, 'mici in orbit');
    // what the renderer sends when it only redraws: no time passes, nothing explodes
    const fix = await buildKart(id);
    fix.update(still(), 0); fix.update(still({ speed: 30 }), 0);
    for (const b of fix.body.skeleton.bones) for (const v of [...b.position.toArray(), ...b.quaternion.toArray(), ...b.scale.toArray()]) assert.ok(Number.isFinite(v), `${b.name} not finite at dt 0`);
    // a named pose, for the podium and the pick screen, with only what the showcase passes
    const pose = await buildKart(id); run(pose, { pose: 'cheer', speed: 0, steer: 0, boostT: 0, drift: 0, grounded: true });
    assert.ok(moved(idle, transforms(pose)) > 5);
  });
}

// ---- what the items do to a driver, on every kart ----
for (const id of KARTS) {
  test(`kart ${id}: soot, licked lips, a sip and the pan show on the driver and go away`, async () => {
    const bone = (m, name) => m.bones.get(name), on = (b) => b.scale.x > 0.5, off = (b) => b.scale.x < 0.05;
    const clean = await buildKart(id); run(clean, still());
    for (const name of ['soot', 'lick', 'bottle', 'pan']) assert.ok(off(bone(clean, name)), `${name} hidden on a clean run`);
    assert.ok(on(bone(clean, 'skin')), 'the head is there');
    const burnt = await buildKart(id); run(burnt, still({ sootT: 2 }));
    assert.ok(on(bone(burnt, 'soot')) && off(bone(burnt, 'skin')), 'the mask replaces the skin');
    run(burnt, still({ sootT: 0 }), 90);
    assert.ok(off(bone(burnt, 'soot')) && on(bone(burnt, 'skin')), 'and washes off');
    const smell = await buildKart(id); run(smell, still({ rendangT: 2 }), 40);
    assert.ok(on(bone(smell, 'lick')), 'the pot makes it lick its lips');
    const a = bone(smell, 'lick').position.x; run(smell, still({ rendangT: 2 }), 13);
    assert.notEqual(+a.toFixed(4), +bone(smell, 'lick').position.x.toFixed(4), 'the tongue goes round');
    const robbed = await buildKart(id); robbed.sense.lickT = 1; run(robbed, still(), 30);
    assert.ok(on(bone(robbed, 'lick')), 'so does being robbed by one');
    for (const kind of ['grappa', 'zuica']) {
      const sip = await buildKart(id); run(sip, still()); run(sip, still({ boostT: 2, boostKind: kind }), 20);
      assert.ok(on(bone(sip, 'bottle')), `${kind}: bottle up at the start of the boost`);
      assert.ok(sip.bones.get('armR').quaternion.angleTo(clean.bones.get('armR').quaternion) > 0.1, `${kind}: the hand goes with it`);
      run(sip, still({ boostT: 1, boostKind: kind }), 60);
      assert.ok(off(bone(sip, 'bottle')), `${kind}: and down again`);
    }
    const sambal = await buildKart(id); run(sambal, still()); run(sambal, still({ boostT: 2, boostKind: 'sambal' }), 20);
    assert.ok(off(bone(sambal, 'bottle')), 'no bottle for a sambal');
    const big = await buildKart(id); run(big, still({ bigT: 3 }), 40);
    assert.ok(on(bone(big, 'pan')), 'the pan on the big kart');
    for (const pose of ['soot', 'lick', 'sip', 'big']) {
      const still2 = await buildKart(id); still2.update({ pose, speed: 0, steer: 0, boostT: 0, drift: 0, grounded: true }, 0);
      const name = { soot: 'soot', lick: 'lick', sip: 'bottle', big: 'pan' }[pose];
      assert.ok(on(bone(still2, name)), `the named pose ${pose} with no time passing`);
    }
  });
}

test('logan: three boxes, a bonnet and a boot lower than the roof, the boot over the belt line', async () => {
  const m = await buildKart('logan'), P = m.body.geometry.attributes.position, S = m.body.geometry.attributes.skinIndex, bones = m.body.skeleton.bones;
  const top = (z0, z1) => { let y = 0; for (let i = 0; i < P.count; i++) { const z = P.getZ(i), b = bones[S.getX(i)].name; if (z > z0 && z < z1 && (b === 'body' || b === 'lid' || b === 'bonnet') && Math.abs(P.getX(i)) > 0.3) y = Math.max(y, P.getY(i)); } return y; };
  const bonnet = top(0.75, 1.3), roof = top(-0.4, 0.1), boot = top(-1.45, -1.1);
  assert.ok(roof > 1.65 && roof < 1.95, `roof with its rack ${roof}`);
  assert.ok(bonnet < roof - 0.5, `bonnet ${bonnet} under roof ${roof}`);
  assert.ok(boot < roof - 0.4 && boot > bonnet, `boot ${boot}, flat and higher than the bonnet ${bonnet}`);
  const box = new THREE.Box3().setFromBufferAttribute(P);
  assert.ok(box.max.z - box.min.z > 3, 'long enough to be a saloon');
  // the blue door stands open a little to the outside, the boot lid jumps on a landing
  run(m, still({ speed: 20 }));
  assert.ok(m.bones.get('door').rotation.y > 0.1, 'door ajar');
  const air = await buildKart('logan'); run(air, still({ speed: 20, grounded: false }), 40);
  assert.ok(air.bones.get('lid').rotation.x > 0.2, 'the lid lifts in the air');
});

test('caruta: Murgu stands at rest, gallops at speed with four jointed legs, and answers the kart', async () => {
  const m = await buildKart('caruta');
  const legs = (o) => [0, 1, 2, 3].map((i) => o.bones.get(`leg${i}`).rotation.x), shins = (o) => [0, 1, 2, 3].map((i) => o.bones.get(`shin${i}`).rotation.x);
  run(m, still(), 60);
  for (const v of legs(m)) assert.ok(Math.abs(v) < 0.02, `a standing leg: ${v}`);
  // at speed: over a stride every leg swings both ways and bends, each at its own moment
  const g = await buildKart('caruta'), seen = [[], [], [], []], bend = [0, 0, 0, 0], ys = [], rocks = [];
  run(g, still({ speed: 27, throttle: 1 }), 30);
  for (let f = 0; f < 60; f++) {
    run(g, still({ speed: 27, throttle: 1 }), 1);
    legs(g).forEach((v, i) => seen[i].push(v)); shins(g).forEach((v, i) => { bend[i] = Math.max(bend[i], v); });
    ys.push(g.bones.get('trunk').position.y); rocks.push(g.bones.get('trunk').rotation.x);
  }
  seen.forEach((s, i) => {
    assert.ok(Math.max(...s) > 0.4 && Math.min(...s) < -0.4, `leg ${i} reaches and drives`);
    assert.ok(bend[i] > 0.8, `leg ${i} bends`);
  });
  const peak = (s) => s.indexOf(Math.max(...s));
  assert.ok(new Set(seen.map(peak)).size >= 3, 'the feet do not land together');
  assert.ok(Math.max(...ys) - Math.min(...ys) > 0.12, 'the body rises and falls');
  assert.ok(Math.max(...rocks) - Math.min(...rocks) > 0.15, 'the body rocks');
  // cadence follows the speed: more strides per second when faster
  const count = async (speed) => { const o = await buildKart('caruta'); let n = 0, last = 0; for (let f = 0; f < 240; f++) { run(o, still({ speed, throttle: 1 }), 1); const v = o.bones.get('leg0').rotation.x; if (last < 0 && v >= 0) n++; last = v; } return n; };
  const slow = await count(6), fast = await count(29);
  assert.ok(slow >= 2 && fast >= slow + 3 && fast <= 18, `${slow} strides slow, ${fast} fast in 4 s`);
  // he leads the turn: a right steer swings him to the right, which is a negative turn about y; the shafts go with him
  const turn = await buildKart('caruta'); run(turn, still({ speed: 25, steer: 1, throttle: 1 }), 60);
  assert.ok(turn.bones.get('horse').rotation.y < -0.1, `yaw ${turn.bones.get('horse').rotation.y}`);
  // he rears on a hit and to cheer, and hangs his head to sulk
  const hit = await buildKart('caruta'); run(hit, still({ speed: 5, hitT: 0.5, hitKind: 'spin' }), 40);
  assert.ok(hit.bones.get('trunk').rotation.x < -0.35, 'rears');
  const sad = await buildKart('caruta'); run(sad, still({ finished: true, place: 8 }), 60);
  assert.ok(sad.bones.get('neck').rotation.x > 0.3, 'head down');
  // a jump: legs out, front and back
  const air = await buildKart('caruta'); run(air, still({ speed: 25, grounded: false, throttle: 1 }), 40);
  assert.ok(air.bones.get('leg0').rotation.x < -0.4 && air.bones.get('leg2').rotation.x > 0.4, 'stretched in the air');
});

test('the pool: bottles and the pan fly with no sim object behind them, the rendang victim licks, a jukung sail drops for a close camera', async () => {
  const { createKartPool } = await import('../src/render/models.js');
  const scene = new THREE.Scene(), pool = createKartPool(scene, ctx, { time: { value: 0 } });
  await pool.set([{ kart: 'jukung', color: '#fff' }, { kart: 'jeep', color: '#fff' }, { kart: 'tabia', color: '#fff' }]);
  const K = [0, 1, 2].map((i) => ({ ...still({ speed: 25 }), i, kart: 'x', x: 0, y: 5, z: i * -5, vx: 0, vz: 25, u: 0.1, d: 0, pitch: 0, roll: 0, itemCharges: 0, shortcut: -1 }));
  const track = { n: 100, samples: { w: new Float32Array(100).fill(14) }, heightAt: () => 5 }, terrain = { heightAt: () => 0 }, blobs = { set() {}, commit() {} };
  const liveCount = () => scene.children.reduce((n, c) => n + (c.isGroup ? c.children.length : 0), 0);
  const step = (n = 1) => { for (let i = 0; i < n; i++) pool.update(K, { shots: [], spills: [] }, 1 / 60, track, terrain, blobs, null, i / 60); };
  step();
  const base = liveCount();
  pool.onEvent({ type: 'itemUse', kart: 1, item: 'grappa' });
  step(10);
  assert.equal(liveCount(), base, 'nothing flies until the sip is done');
  step(50);
  assert.equal(liveCount(), base + 1, 'the empty bottle in the air');
  step(120);
  assert.equal(liveCount(), base, 'and gone');
  pool.onEvent({ type: 'itemUse', kart: 1, item: 'uova' });
  step(3);
  assert.equal(liveCount(), base + 1, 'the pan comes down');
  step(30);
  assert.equal(liveCount(), base, 'and the model has it now');
  pool.onEvent({ type: 'hit', kart: 2, by: 1, kind: 'spin', cause: 'rendang' });
  assert.ok(pool.karts[2].model.sense.lickT > 2, 'the victim licks its lips');
  // the view of kart 1, five metres behind the jukung: the sail goes down; its own driver's view keeps it; far behind it is up again
  const sail = pool.karts[0].model.bones.get('sail');
  pool.viewPrepare(1);
  assert.ok(sail.scale.y < 0.2, `furled for a close camera: ${sail.scale.y}`);
  pool.viewPrepare(0);
  assert.equal(sail.scale.y, 1, 'up for its own driver');
  K[1].z = -40; pool.viewPrepare(1);
  assert.equal(sail.scale.y, 1, 'up for a far camera');
});

for (const id of ITEMS) {
  test(`item ${id}: builds small and shared, its clone updates`, async () => {
    const it = await buildItem(id), tris = (g) => { let n = 0; g.traverse((o) => { if (o.isMesh) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); return n; };
    assert.ok(it.group.children.length > 0 && it.group.children.length <= 3, 'a few meshes at most');
    assert.ok(tris(it.group) > 20 && tris(it.group) <= MAX_ITEM_TRIS, `${tris(it.group)} triangles`);
    // the pool clones the group: an update must work on any clone, shot or spill
    const c = it.group.clone();
    it.update?.(c, { id: 1, kind: id, x: 0, y: 0, z: 0, yaw: 0, t: 0.4, r: 3, ttl: 5 }, 1 / 60);
    it.update?.(c, { id: 1, kind: id, x: 0, y: 0, z: 0, yaw: 0, t: 0.4 }, 0);
    c.traverse((o) => { for (const v of [...o.position.toArray(), ...o.scale.toArray()]) assert.ok(Number.isFinite(v), `${o.name} not finite`); });
  });
  test(`icon ${id}: a sticker svg that parses`, () => {
    const s = itemIcon(id);
    assert.match(s, /^<svg [^>]*viewBox="0 0 64 64"[\s\S]*<\/svg>$/);
    assert.ok((s.match(/<path|<circle|<rect|<ellipse/g) || []).length >= 3, 'has a drawing');
    assert.ok(!/NaN|undefined|null/.test(s), 'clean numbers');
  });
}
test('flags and small icons', () => {
  for (const r of ['cadore', 'romania', 'indonesia']) assert.match(flag(r), /^<svg [\s\S]*<\/svg>$/);
  assert.equal(flag('nowhere'), '');
  assert.ok(UI_ICON_NAMES.length >= 10);
  for (const n of UI_ICON_NAMES) assert.match(uiIcon(n), /^<svg [\s\S]*<\/svg>$/);
  assert.equal(uiIcon('nothing'), '');
  assert.equal(itemIcon('nothing'), '');
});
test('no em dash in anything this part of the game wrote', () => {
  const files = [join(ROOT, 'src/render/chibi.js'), join(ROOT, 'src/ui/icons.js'), join(ROOT, 'tools/shoot-karts.mjs'), join(ROOT, 'dev/karts-dev.js')];
  for (const d of ['src/render/karts', 'src/render/items']) for (const f of readdirSync(join(ROOT, d))) files.push(join(ROOT, d, f));
  for (const f of files) assert.ok(!readFileSync(f, 'utf8').includes('\u2014'), f);
});

// ---- in the real pipeline ----
let srv, browser, page;
const errors = [];
before(async () => {
  srv = await serveDev({ entry: 'dev/karts-dev.js' });
  browser = await launch('metal');
  page = await (await browser.newContext({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/GPU stall/i.test(m.text())) errors.push(m.text()); });
  await page.goto(`${srv.base}/`);
  await page.waitForFunction(() => window.__karts?.ready || window.__karts?.error, null, { timeout: 60000 });
});
after(async () => {
  await Promise.race([browser?.close(), new Promise((r) => setTimeout(r, 3000))]);
  srv?.close();
});
test('every model comes through the loader and draws through the real composite', async () => {
  const cells = [...KARTS.map((id) => ({ id, cam: 'hero' })), ...ITEMS.map((id) => ({ id, kind: 'item' }))];
  const out = await page.evaluate(async (list) => {
    const K = window.__karts, res = [];
    for (const c of list) {
      const r = await K.shot({ ...c, w: 256, h: 256 });
      const d = r.canvas.getContext('2d').getImageData(0, 0, 256, 256).data, seen = new Set();
      for (let i = 0; i < d.length; i += 24) seen.add((d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4));
      res.push({ id: c.id, kind: c.kind || 'kart', colours: seen.size, calls: r.stats.calls, tris: r.tris, placeholder: r.placeholder });
    }
    return res;
  }, cells);
  for (const r of out) {
    assert.ok(!r.placeholder, `${r.id} fell back to a placeholder`);
    assert.ok(r.colours > 12, `${r.id}: only ${r.colours} colours`);
    if (r.kind === 'kart') assert.ok(r.calls <= 3, `${r.id}: ${r.calls} draw calls with the ground and the shadow`);
  }
  assert.deepEqual(errors, []);
});
test('the turntable has the race ink lines and a clear background', async () => {
  for (const id of ['logan', 'caruta']) {
    const r = await page.evaluate((k) => window.__karts.ink(k), id);
    assert.equal(r.corner, 0, `${id}: corners see-through`);
    assert.ok(r.solid > 0.08 && r.solid < 0.8, `${id}: ${r.solid} solid`);
    assert.ok(r.ink > 0.004, `${id}: ${r.ink} of the picture is ink`);
  }
  assert.deepEqual(errors, []);
});
test('the UI picture of each kart in the roster: 512 px, transparent corners, a solid kart', { skip: !KART_IDS.every((id) => existsSync(join(ROOT, `assets/ui/karts/${id}.png`))) && 'run tools/shoot-karts.mjs --png first' }, async () => {
  for (const id of KARTS) {
    const file = join(ROOT, `assets/ui/karts/${id}.png`);
    if (!existsSync(file)) continue;
    const r = await page.evaluate(async (b64) => {
      const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, img.width, img.height).data;
      let solid = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 240) solid++;
      return { w: img.width, h: img.height, corner: d[3], solid: solid / (img.width * img.height) };
    }, readFileSync(file).toString('base64'));
    assert.equal(r.w, 512); assert.equal(r.h, 512);
    assert.equal(r.corner, 0, `${id}: the corner should be see-through`);
    assert.ok(r.solid > 0.12 && r.solid < 0.75, `${id}: ${r.solid} of it solid`);
  }
});
