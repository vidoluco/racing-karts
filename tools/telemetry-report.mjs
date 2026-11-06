// One line per race from the telemetry the server writes (see server/telemetry.js): people against bots on the same road.
//   node tools/telemetry-report.mjs [dir or .jsonl file]     default: telemetry/ at the repo root
// A person's lap marked * had the autopilot driving for more than 5 s of that race: it says little about them. w and b: hits on
// walls and on buildings.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const where = process.argv[2] || join(ROOT, 'telemetry');
const clock = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}` : '-');
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

if (!existsSync(where)) {
  console.log(`no telemetry at ${where}`);
  process.exit(0);
}
const files = statSync(where).isDirectory() ? readdirSync(where).filter((f) => f.endsWith('.jsonl')).sort().map((f) => join(where, f)) : [where];
const lines = files.flatMap((f) => readFileSync(f, 'utf8').split('\n')).filter(Boolean).flatMap((l) => {
  try { return [JSON.parse(l)]; } catch { return []; }
});

let races = 0;
for (const r of lines.filter((m) => m.e === 'race')) {
  races++;
  const karts = r.karts || [];
  const laps = (list) => list.map((k) => k.bestLap).filter(Number.isFinite);
  const people = karts.filter((k) => k.human);
  const bots = laps(karts.filter((k) => !k.human));
  const who = people.map((k) => `P${k.slot + 1} ${clock(k.bestLap)}${k.botS > 5 ? '*' : ''} place ${k.place}, ${k.wall}w${k.building ? ` ${k.building}b` : ''}${k.input ? ` ${k.input}` : ''}`).join(', ') || 'nobody';
  const mine = laps(people.filter((k) => !(k.botS > 5)));
  const gap = mine.length && bots.length ? `, gap ${(Math.min(...mine) - Math.min(...bots)).toFixed(1)} s` : '';
  const sky = `${r.weather}${r.night ? '+night' : ''}`;
  console.log(`${new Date(r.at).toLocaleString('sv').slice(0, 16)} ${r.track} ${r.mode} ${r.difficulty} ${sky}: ${who} | bots ${bots.length ? `best ${clock(Math.min(...bots))} mean ${clock(mean(bots))}` : 'none'}${gap}`);
}
const backs = lines.filter((m) => m.e === 'back').map((m) => m.ms / 1000);
console.log(`${races} races, ${lines.filter((m) => m.e === 'drop').length} phone drops, ${backs.length} returns${backs.length ? `, mean away ${mean(backs).toFixed(1)} s` : ''}`);
