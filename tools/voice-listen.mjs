#!/usr/bin/env node
// Nobody here can hear, so a machine does: it records what really leaves the TV page during a race (music, engines, effects and the
// commentators, all through the limiter), measures how far the voice stands over the rest and asks whisper what it understands in that mix.
//
//   node tools/voice-listen.mjs [--lang it,ro,id] [--track antelao] [--seconds 60] [--dir docs/audio] [--model path] [--no-whisper] [--shot dir]
//
// Writes <dir>/voice-mix-<lang>.wav and prints, per line said: the words, what whisper heard, and the share of the words it got.
import { writeFileSync, mkdtempSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { launch, buildDist, startServerProcess, ROOT } from './harness.mjs';

const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : def; };
const LANGS = arg('lang', 'it,ro,id').split(',');
const TRACK = arg('track', 'antelao');
const SECONDS = Number(arg('seconds', 60));
const DIR = arg('dir', join(ROOT, 'docs/audio'));
const SHOTS = arg('shot', null);
const MODEL = arg('model', join(homedir(), '.cache/hyperframes/whisper/models/ggml-small.bin'));
const NO_WHISPER = process.argv.includes('--no-whisper');
mkdirSync(DIR, { recursive: true });
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

// Runs before the page: taps whatever reaches the speakers, and the voice's own bus by itself.
function tap() {
  const rec = { rate: 0, mix: [], voice: [], on: false, frames: 0 };
  window.__rec = rec;
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    if (dest instanceof AudioDestinationNode && !rec.node) {
      const ctx = dest.context;
      rec.rate = ctx.sampleRate;
      rec.node = ctx.createScriptProcessor(4096, 2, 1);
      rec.sink = ctx.createGain();
      rec.sink.gain.value = 0;
      rec.node.onaudioprocess = (e) => {
        if (!rec.on) return;
        const l = e.inputBuffer.getChannelData(0), r = e.inputBuffer.getChannelData(1);
        const m = new Float32Array(l.length);
        for (let i = 0; i < l.length; i++) m[i] = (l[i] + r[i]) / 2;
        rec.mix.push(m);
      };
      connect.call(rec.node, rec.sink);
      connect.call(rec.sink, ctx.destination);
      connect.call(this, rec.node);
    }
    return connect.call(this, dest, ...rest);
  };
}

function wav(samples, rate) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  return b;
}

const db = (x) => (x > 0 ? 20 * Math.log10(x) : -120);
const rms = (s, a, b) => { let t = 0, n = 0; for (let i = Math.max(0, Math.floor(a)); i < Math.min(s.length, b); i++) { t += s[i] * s[i]; n++; } return n ? Math.sqrt(t / n) : 0; };
const words = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter((w) => w.length > 1);

const dist = mkdtempSync(join(tmpdir(), 'rk-listen-'));
await buildDist(dist);
const srv = await startServerProcess({ dist });
const browser = await launch('metal', { extra: ['--autoplay-policy=no-user-gesture-required'] });
const summary = [];
try {
  for (const lang of LANGS) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'it-IT' });
    const page = await ctx.newPage();
    await page.addInitScript(tap);
    await page.goto(`${srv.base}/?lang=it&quality=low&track=${TRACK}&kart=jeep&bots=7&difficulty=medium&auto=1&flyover=0&laps=3&voice=${lang}`);
    await page.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 120000 });
    await page.mouse.click(640, 420); // the sound's gesture: the top of the race screen holds the pause button
    await page.waitForFunction(() => window.__game.voice.packReady, null, { timeout: 20000 });
    const started = Date.now();
    await page.evaluate(() => { window.__rec.on = true; window.__recT0 = window.__rec.node.context.currentTime; });
    // when each line starts on the audio clock, so that the recording can be cut at the lines
    await page.evaluate(() => {
      const seen = { n: 0 };
      window.__said = [];
      const poll = () => {
        const v = window.__game.voice, ctx = window.__rec.node.context;
        while (seen.n < v.log.length) { window.__said.push({ at: ctx.currentTime - window.__recT0, ...v.log[seen.n] }); seen.n++; }
      };
      window.__saidTimer = setInterval(poll, 40);
    });
    let shot = 0;
    while (Date.now() - started < SECONDS * 1000) {
      await new Promise((r) => setTimeout(r, 1000));
      if (SHOTS && shot < 2) {
        const up = await page.evaluate(() => document.querySelector('.vcap.on span')?.textContent ?? null);
        if (up && up.length > 30) { await page.screenshot({ path: join(SHOTS, `voice-caption-${lang}-${shot}.png`) }); shot++; }
      }
    }
    const { rate, said, chunks, duck } = await page.evaluate(() => {
      window.__rec.on = false;
      clearInterval(window.__saidTimer);
      return { rate: window.__rec.rate, said: window.__said, duck: window.__game.voice.audio.duck, chunks: window.__rec.mix.map((c) => Array.from(c, (x) => Math.round(x * 32767))) };
    });
    const len = chunks.reduce((a, c) => a + c.length, 0);
    const mix = new Float32Array(len);
    { let o = 0; for (const c of chunks) { for (let i = 0; i < c.length; i++) mix[o + i] = c[i] / 32767; o += c.length; } }
    const file = join(DIR, `voice-mix-${lang}.wav`);
    writeFileSync(file, wav(mix, rate));
    // How loud the whole is while they talk against just before, to see the music make room
    const during = [], between = [];
    let last = 0;
    for (const s of said) {
      const start = (s.at + 0.2) * rate, end = start + 1.2 * rate;
      during.push(rms(mix, start, end));
      if (s.at - last > 3) between.push(rms(mix, (s.at - 1.2) * rate, (s.at - 0.2) * rate));
      last = s.at + 2;
    }
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    let peak = 0;
    for (let i = 0; i < mix.length; i++) peak = Math.max(peak, Math.abs(mix[i]));
    console.log(`\n${lang}: ${(len / rate).toFixed(0)} s, ${said.length} lines, whole mix ${db(avg(during)).toFixed(1)} dB with a voice, ${db(avg(between)).toFixed(1)} dB without, peak ${db(peak).toFixed(1)} dB, duck now ${duck?.toFixed(2)}`);
    let got = 0, total = 0;
    if (!NO_WHISPER && existsSync(MODEL)) {
      const conv = join(dist, `mix-${lang}.wav`);
      spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', file, '-ar', '16000', '-ac', '1', conv]);
      const out = join(dist, `mix-${lang}`);
      const run = spawnSync('whisper-cli', ['-m', MODEL, '-f', conv, '-l', lang, '-t', '4', '-oj', '-of', out, '-np'], { encoding: 'utf8', timeout: 400000 });
      if (run.status !== 0) console.log('whisper failed', (run.stderr || '').slice(-300));
      const J = JSON.parse((await import('node:fs')).readFileSync(`${out}.json`, 'utf8'));
      const segs = J.transcription.map((x) => ({ a: x.offsets.from / 1000, b: x.offsets.to / 1000, text: x.text }));
      for (const s of said) {
        if (s.at < 0.5) continue; // said before the gesture, nobody heard it
        const end = s.at + 7;
        const heard = segs.filter((x) => x.b > s.at && x.a < end).map((x) => x.text).join(' ');
        const want = words(s.text), have = new Set(words(heard));
        const hit = want.filter((w) => have.has(w)).length;
        got += hit; total += want.length;
        console.log(`  ${s.at.toFixed(1).padStart(5)} s ${String(s.pool).padEnd(14)} ${hit}/${want.length}  ${s.text}\n          heard: ${heard.trim().slice(0, 150)}`);
      }
      console.log(`  ${lang}: whisper got ${got} of ${total} words through the whole mix (${total ? (100 * got / total).toFixed(0) : 0}%)`);
    } else {
      for (const s of said) console.log(`  ${s.at.toFixed(1).padStart(5)} s ${s.pool}: ${s.text}`);
    }
    summary.push({ lang, lines: said.length, got, total });
    await ctx.close();
  }
} finally {
  await browser.close();
  srv.close();
  rmSync(dist, { recursive: true, force: true });
}
console.log('\n', JSON.stringify(summary));
