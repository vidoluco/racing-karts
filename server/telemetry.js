// What happened in the evening's races, as JSON lines in telemetry/YYYY-MM-DD.jsonl at the repo root: local, gitignored, read
// by tools/telemetry-report.mjs. The TV page sends sessions and races, the room adds phones dropping and returning. Only this
// file writes: it checks the shape, caps the size, and a failure here never reaches the game.
import { appendFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

export const MAX_MESSAGE = 4096;          // bytes of one line
export const MAX_FILE = 8 * 1024 * 1024;  // bytes of one day: enough for hundreds of races, and a bound on a page gone wrong
const KINDS = new Set(['session', 'race', 'drop', 'back']);
const KEY_RE = /^[A-Za-z][A-Za-z0-9]{0,15}$/;
const TEXT_RE = /^[\p{L}\p{N} ._:+-]{0,48}$/u;
const MAX_DEPTH = 4;
const MAX_ITEMS = 16;

// True for what may go in a line: short plain text, numbers, flags, small arrays and objects, nothing else.
function clean(v, depth = 0) {
  if (v === null || typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string') return TEXT_RE.test(v);
  if (depth >= MAX_DEPTH) return false;
  if (Array.isArray(v)) return v.length <= MAX_ITEMS && v.every((x) => clean(x, depth + 1));
  if (typeof v !== 'object') return false;
  const keys = Object.keys(v);
  return keys.length <= MAX_ITEMS * 2 && keys.every((k) => KEY_RE.test(k) && clean(v[k], depth + 1));
}

// The line to write for a message, or null if it is not one.
export function telemetryLine(m, now = new Date()) {
  if (!m || typeof m !== 'object' || Array.isArray(m) || !KINDS.has(m.e) || !clean(m)) return null;
  const line = JSON.stringify({ at: now.toISOString(), ...m });
  return line.length <= MAX_MESSAGE ? `${line}\n` : null;
}

// dir null: off, and every call does nothing. That is the default, so that a test server never writes in the repo.
export function createTelemetry({ dir = null, maxFile = MAX_FILE, log = () => {} } = {}) {
  let chain = Promise.resolve();
  let complained = false;
  const complain = (e) => {
    if (!complained) log(`telemetry not written: ${e?.message || e}`);
    complained = true;
  };
  async function append(line, now) {
    await mkdir(dir, { recursive: true });
    const file = join(dir, `${now.toLocaleDateString('sv')}.jsonl`); // this Mac's date: sv writes it YYYY-MM-DD
    const size = await stat(file).then((s) => s.size, () => 0);
    if (size + line.length > maxFile) return complain(new Error(`${file} is full`));
    await appendFile(file, line);
  }
  return {
    write(m) {
      if (!dir) return;
      try {
        const now = new Date();
        const line = telemetryLine(m, now);
        if (line) chain = chain.then(() => append(line, now)).catch(complain); // one at a time, in order
      } catch (e) { complain(e); }
    },
    flushed: () => chain,
  };
}
