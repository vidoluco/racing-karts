// The render dev page: a real race from src/sim on a track, in the real renderer, with hooks for tools/shoot.mjs and
// tools/perf.mjs. ?track=antelao&views=1&quality=capture
import { buildTrack } from '../src/world/track.js';
import { buildTerrain } from '../src/world/terrain.js';
import { createRace, DT } from '../src/sim/index.js';
import { KART_IDS, kartInfo } from '../src/data/karts.js';
import { loadTrackDef } from '../src/data/tracks.js';
import { createRenderer } from '../src/render/index.js';
import { raceWeather } from '../src/data/weather.js';

const SLOT_COLORS = ['#4aa6f2', '#f28bbd', '#f6c23e', '#62c56e'];
const q = new URLSearchParams(location.search), id = q.get('track') || 'antelao', viewsN = +(q.get('views') || 1), seed = +(q.get('seed') || 7);
const auto = q.get('auto') !== '0';
const canvas = document.getElementById('c');

const dev = window.__dev = { ready: false, error: null };
window.addEventListener('error', (e) => { dev.error = e.message; });
window.addEventListener('unhandledrejection', (e) => { dev.error = String(e.reason?.stack || e.reason); });

async function main() {
  // the long track engine's synthetic 10 km lap, tools/long-check.mjs: not a track of the game
  const def = id === 'long-test'
    ? { ...(await import('../test/helpers/long-track.mjs')).longTestDef({ km: +(q.get('km') || 10) }), ...(q.get('land') === '0' ? {} : { landmarkModule: (await import('../test/helpers/long-landmarks.mjs')).default }) }
    : await loadTrackDef(id);
  if (q.has('disasters')) def.disasters = JSON.parse(q.get('disasters'));
  if (q.has('hazards')) def.hazards = JSON.parse(q.get('hazards'));
  const t0 = performance.now(), track = buildTrack(def), terrain = buildTerrain(track);
  const R = createRenderer(canvas, { quality: q.get('quality') || 'auto', shadeSize: +(q.get('shade') || 4096) });
  // ?weather=rain|snow|fog&night=1: the race under that sky
  const weather = raceWeather(q.get('weather'), q.get('night') === '1');
  await R.loadTrack(track, terrain, { weather });
  const players = [];
  for (let i = 0; i < 8; i++) {
    const human = i < viewsN, kart = q.get(`kart${i}`) || KART_IDS[(i * 2 + (+q.get('kartseed') || 0)) % KART_IDS.length];
    players.push({ slot: human ? i : -1, kart, human, name: `P${i + 1}`, difficulty: human ? 'ace' : undefined });
  }
  const race = createRace({ track, terrain, seed, laps: +(q.get('laps') || (def.long ? 1 : 3)), players, difficulty: q.get('difficulty') || 'hard', countdown: +(q.get('countdown') ?? 3), ...(weather ? { weather } : {}) });
  R.setPatches(race.patches);
  await R.setKarts(players.map((p, i) => ({ kart: p.kart, color: i < 4 && p.human ? SLOT_COLORS[i] : kartInfo(p.kart)?.color || '#c9513d' })));
  R.setViews(Array.from({ length: viewsN }, (_, i) => i));

  let prev = structuredClone(race.state);
  function stepSim(n = 1) {
    let events = [];
    for (let s = 0; s < n; s++) {
      prev = structuredClone(race.state);
      const inputs = [];
      for (let i = 0; i < viewsN; i++) inputs[i] = auto ? race.autopilot(i) : { steer: 0, throttle: 1, item: false, drift: false };
      race.step(inputs);
      events = events.concat(race.drainEvents());
    }
    return events;
  }
  // Puts view 0's kart at a fraction of the lap and lets it drive a moment, so the camera settles on the road.
  function at(u, { d = 0, speed = 24, kart = 0, settle = 60, others = true, spread = null } = {}) {
    if (race.state.phase === 'countdown') {
      race.state.phase = 'race';
      race.state.countdown = 0;
    }
    race.teleport(kart, u - (settle * DT * speed) / track.length, d, { speed });
    if (others) {
      // two or three rivals around it, for a lively shot
      // spread: [[metres ahead, metres to the left], ...], where each one is when the shot is taken; none, the tidy line
      [1, 2, 3].forEach((j, n) => race.teleport(j, u - ((settle * DT * speed) - (spread?.[n]?.[0] ?? 10 + n * 9)) / track.length, spread?.[n]?.[1] ?? (n % 2 ? -1 : 1) * 3.5, { speed }));
    }
    dev.frames(settle);
  }
  dev.frames = (n = 60, render = true) => {
    for (let f = 0; f < n; f++) {
      const ev = stepSim(1);
      if (render && (f > n - 45 || f % 4 === 0)) R.frame(prev, race.state, 1, DT, ev);
    }
    return R.stats();
  };
  dev.advanceTo = (t) => {
    while (race.state.t < t) { const ev = stepSim(1); if (race.state.t > t - 2) R.frame(prev, race.state, 1, DT, ev); }
    return R.stats();
  };
  dev.at = at;
  dev.pose = (px, py, pz, lx, ly, lz, fov) => {
    R.views.forEach((v) => { v.poseOn = true; v.cam.pose(px, py, pz, lx, ly, lz, fov); v.gx = 1e9; });
    R.frame(prev, race.state, 1, DT, []);
    R.frame(prev, race.state, 1, DT, []);
    return R.stats();
  };
  dev.unpose = () => { R.views.forEach((v) => { v.poseOn = false; }); };
  dev.draw = () => { R.frame(prev, race.state, 1, 0, []); return R.stats(); };
  dev.flyover = (t) => { R.views.forEach((v, i) => { v.poseOn = true; v.cam.flyover(t, i * 0.02); v.gx = 1e9; }); R.frame(prev, race.state, 1, DT, []); R.frame(prev, race.state, 1, DT, []); return R.stats(); };
  // n sim steps, then one drawn frame covering them: fast forward with the camera still following (tools/long-check.mjs)
  dev.stepDraw = (n = 1) => { const ev = stepSim(n); R.frame(prev, race.state, 1, n * DT, ev); dev.hudDraw?.(n * DT, ev); return R.stats(); };
  // ?hud=1: the real race HUD over the dev page, for looking at a long track's map and its kilometres without the whole game
  if (q.get('hud')) {
    const [{ createUI }, { ITEM_IDS }] = await Promise.all([import('../src/ui/index.js'), import('../src/data/items.js')]);
    const ui = createUI(document.body, { lang: q.get('lang') || 'it', karts: [], tracks: [], itemIds: ITEM_IDS, stage: canvas, thumb: () => '', has: () => true, icon: () => '' });
    const colors = players.map((p, i) => (i < 4 && p.human ? SLOT_COLORS[i] : kartInfo(p.kart)?.color || '#c9513d'));
    const hud = ui.screens.hud;
    hud.setup({ track, views: Array.from({ length: viewsN }, (_, i) => ({ kart: i, slot: i, kartId: players[i].kart })), colors, laps: race.state.laps, region: def.region, trackName: 'Long', regionName: 'Test', blurb: '', gp: null, goT: 0 });
    ui.show('hud');
    dev.hudDraw = (dt, ev) => { hud.events(ev, race.state); hud.frame(race.state, dt); };
  }
  dev.give = (i, item) => race.give(i, item);
  dev.stats = () => R.stats();
  dev.renderer = R; dev.race = race; dev.track = track; dev.terrain = terrain;
  // Free run: for tools/perf.mjs. The sim steps by real time, the renderer draws every frame, auto drivers.
  let running = false, acc = 0, last = 0;
  const loop = (now) => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 1 / 60); last = now; acc += dt;
    let ev = [];
    while (acc >= DT) { ev = ev.concat(stepSim(1)); acc -= DT; }
    R.frame(prev, race.state, 1 - acc / DT, dt, ev);
    dev.frameCount++;
    requestAnimationFrame(loop);
  };
  dev.frameCount = 0;
  dev.run = () => { if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); } };
  dev.stop = () => { running = false; };
  dev.loadMs = performance.now() - t0;
  dev.ready = true;
}
main().catch((e) => { dev.error = String(e?.stack || e); console.error(e); });
