// The difficulty ladder, measured: scripted people on a phone (test/helpers/drivers.mjs) against 7 bots, stepped, no browser.
// node tools/ladder.mjs [--levels easy,medium,hard] [--drivers casual,beginner,good] [--tracks all|a,b] [--races 8] [--laps 2] [--seed 7000] [--two] [--teams] [--over '{"easy":{"cap":0.8}}']
// bSprM: m from the first bot to the last when the first gets home. --two: two people on the grid, the second a beginner; --at n: n bots ahead of the people at the start (7 is the Gran Premio's leader); --over: try numbers without editing tuning.js.
import { buildTrack } from '../src/world/track.js';
import { buildTerrain } from '../src/world/terrain.js';
import { loadTrackDef, TRACK_IDS } from '../src/data/tracks.js';
import { DIFFICULTY } from '../src/sim/tuning.js';
import { ladderRace, mean } from '../test/helpers/drivers.mjs';

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? dflt : process.argv[i + 1]; };
const flag = (name) => process.argv.includes(`--${name}`);
const LEVELS = arg('levels', 'easy,medium,hard').split(','), DRIVERS = arg('drivers', 'casual,beginner,good').split(',');
const RACES = +arg('races', 8), LAPS = +arg('laps', 2), SEED = +arg('seed', 7000), TEAMS = flag('teams'), TWO = flag('two'), AT = arg('at', null);
const tr = arg('tracks', 'all'), TRACKS = tr === 'all' ? TRACK_IDS : tr.split(',');
for (const [d, o] of Object.entries(JSON.parse(arg('over', '{}')))) Object.assign(DIFFICULTY[d] ||= {}, o);

const worlds = {};
async function world(id) {
  if (worlds[id]) return worlds[id];
  const track = buildTrack(await loadTrackDef(id));
  return (worlds[id] = { id, track, terrain: buildTerrain(track) });
}
const pc = (a, fn) => `${Math.round(a.filter(fn).length / a.length * 100)}%`.padStart(5);
const n1 = (x, w = 6) => (Number.isFinite(x) ? x.toFixed(1) : '-').padStart(w);
const row = (name, a) => `${name.padEnd(16)}${pc(a, (m) => m.won)}${pc(a, (m) => m.place <= 3)}${n1(mean(a.map((m) => m.place)))}${n1(mean(a.map((m) => m.worst)))}${pc(a, (m) => m.last)}${n1(mean(a.map((m) => m.gap).filter(Number.isFinite)))}${n1(mean(a.map((m) => m.lap).filter(Number.isFinite)), 7)}${n1(mean(a.map((m) => m.botLap).filter(Number.isFinite)), 7)}${pc(a, (m) => m.botLap < m.lap)}${n1(mean(a.map((m) => m.walls)))}${n1(mean(a.map((m) => m.hits)))}${n1(mean(a.map((m) => m.botRescues)), 5)}${String(a.filter((m) => m.auto).length).padStart(4)}${n1(mean(a.map((m) => m.margin).filter(Number.isFinite)))}${n1(mean(a.map((m) => m.botOff)) * 100, 5)}${n1(Math.min(...a.map((m) => m.slowestBot)))}${n1(mean(a.map((m) => m.botSpread).filter(Number.isFinite)), 7)}`;
for (const level of LEVELS) for (const driver of DRIVERS) {
  console.log(`\n${level} / ${driver}${TWO ? ' + beginner' : ''}${TEAMS ? ' teams' : ''}  (races each track ${RACES}, laps ${LAPS})`);
  console.log(`${'track'.padEnd(16)}  win  pod place worst last  gapS   lapS botLap b<h% walls hits bRsc auto  winBy off% slowB  bSprM`);
  const all = [];
  const t0 = Date.now();
  for (const id of TRACKS) {
    const W = await world(id), M = W.track.long ? Math.max(2, Math.ceil(RACES / 2)) : RACES, a = [];
    for (let s = 0; s < M; s++) a.push(ladderRace(W, level, TWO ? [driver, 'beginner'] : [driver], SEED + s, { laps: LAPS, teams: TEAMS, at: AT === null ? null : +AT }));
    all.push(...a);
    console.log(row(id, a));
  }
  console.log(row('ALL', all), `  [${((Date.now() - t0) / 1000).toFixed(0)} s]`);
}
