#!/usr/bin/env node
// A real photo of a real place, from Wikimedia Commons, with its credit written down. Only free licences get through.
//   node tools/fetch-photo.mjs --search "Monte Pelmo" [--limit 30]       lists files: title, size, licence, author
//   node tools/fetch-photo.mjs --category "Monte Pelmo" [--limit 60]     the same from a category
//   node tools/fetch-photo.mjs <id> "File:Monte Pelmo 1.jpg" [--width 4000]
// The last form writes data/raw/backdrop-photos/<id>/<filename> and <id>.json (file, author, licence, licence URL, page URL),
// and prints the row for assets/backdrops/CREDITS.md. Originals stay in data/raw (gitignored): only paintings get bundled.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'RacingKarts/0.1 (personal open game; backdrop photo fetch) node';

export const FREE = [/^cc0/i, /^public domain/i, /^pd\b/i, /^cc[- ]by(-sa)?[- ]?\d/i, /^cc by(-sa)? /i, /^attribution$/i, /^fal$/i, /^gfdl/i];
export const isFree = (licence) => !!licence && FREE.some((re) => re.test(licence.trim()));
const strip = (html) => String(html ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params })}`;
  for (let tries = 0; ; tries++) {
    const res = await fetch(url, { headers: { 'user-agent': UA } });
    if (res.ok) return res.json();
    if (tries >= 3 || (res.status !== 429 && res.status < 500)) throw new Error(`Commons API ${res.status}`);
    await new Promise((r) => setTimeout(r, 2500 * (tries + 1)));
  }
}

function describe(page) {
  const ii = page.imageinfo?.[0];
  if (!ii) return null;
  const m = ii.extmetadata || {};
  return {
    file: page.title, width: ii.width, height: ii.height, url: ii.url, thumb: ii.thumburl, page: ii.descriptionurl,
    author: strip(m.Artist?.value), licence: strip(m.LicenseShortName?.value), licenceUrl: m.LicenseUrl?.value || '',
    date: strip(m.DateTimeOriginal?.value), description: strip(m.ImageDescription?.value).slice(0, 200),
  };
}
const INFO = { prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl|DateTimeOriginal|ImageDescription' };

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const positional = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
const limit = +opt('limit', 30);

async function list(params) {
  const r = await api({ ...params, ...INFO, iiurlwidth: 800 });
  const rows = (r.query?.pages || []).sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map(describe).filter(Boolean);
  for (const f of rows) console.log(`${f.width}x${f.height}\t${f.licence || '?'}${isFree(f.licence) ? '' : ' (NOT FREE)'}\t${f.author.slice(0, 30)}\t${f.file}\t${f.description.slice(0, 90)}`);
  return rows;
}

if (opt('search')) {
  await list({ action: 'query', generator: 'search', gsrsearch: `${opt('search')} filetype:bitmap`, gsrnamespace: '6', gsrlimit: String(limit) });
} else if (opt('category')) {
  await list({ action: 'query', generator: 'categorymembers', gcmtitle: `Category:${opt('category')}`, gcmtype: 'file', gcmlimit: String(limit) });
} else if (positional.length >= 2) {
  const [id, raw] = positional, title = raw.startsWith('File:') ? raw : `File:${raw}`;
  const r = await api({ action: 'query', titles: title, ...INFO, iiurlwidth: opt('width', '4000') });
  const f = r.query?.pages?.[0] && describe(r.query.pages[0]);
  if (!f) { console.error(`${title}: not found on Commons`); process.exit(1); }
  if (!isFree(f.licence)) { console.error(`${title}: licence "${f.licence}" is not on the free list, refused`); process.exit(2); }
  const dir = join(ROOT, 'data/raw/backdrop-photos', id);
  mkdirSync(dir, { recursive: true });
  // the Commons thumbnail at --width: the original can be 50 MP, the painting never needs it
  const useThumb = f.thumb && f.width > +opt('width', '4000');
  let res;
  for (let tries = 0; tries < 5; tries++) {
    res = await fetch(useThumb ? f.thumb : f.url, { headers: { 'user-agent': UA } });
    if (res.status !== 429) break;
    await new Promise((r) => setTimeout(r, 5000 * (tries + 1)));
  }
  if (!res.ok) { console.error(`download failed: ${res.status}`); process.exit(1); }
  const name = decodeURIComponent(f.url.split('?')[0].split('/').pop());
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(join(dir, name), buf);
  const row = `| ${id} | ${f.file} | ${f.author} | ${f.licence} | ${f.page} |`;
  writeFileSync(join(dir, `${id}.json`), `${JSON.stringify({ id, file: f.file, saved: name, author: f.author, licence: f.licence, licenceUrl: f.licenceUrl, url: f.page, source: f.url, date: f.date, description: f.description, credit: row }, null, 2)}\n`);
  console.log(`${join(dir, name)} (${(buf.length / 1048576).toFixed(1)} MB, ${f.width}x${f.height} original)`);
  console.log(row);
} else {
  console.error('usage: fetch-photo.mjs --search <words> | --category <name> | <id> "File:Name.jpg" [--width 4000]');
  process.exit(1);
}
