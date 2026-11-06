// Shared by the tests and tools: the game exactly as `npm run play` serves it (node build.mjs into a folder, then
// `node server/index.js` as its own process on a free port), Chromium from the playwright cache with a chosen graphics
// backend, and real phone pad pages (controller/pad.html with touch emulation).
import { spawn, execFile } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(homedir(), 'Library/Caches/ms-playwright');

// ---------- build and server ----------
export async function buildDist(dist) {
  await promisify(execFile)(process.execPath, ['build.mjs'], { cwd: ROOT, env: { ...process.env, ...(dist ? { DIST: dist } : {}) } });
}

export function freePort() {
  return new Promise((ok, fail) => {
    const s = createServer();
    s.once('error', fail);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); });
  });
}

// `node server/index.js` on a free port; resolves once it prints its URLs. log gets every line it prints.
export async function startServerProcess({ port, dist, log = () => {} } = {}) {
  port ||= await freePort();
  const proc = spawn(process.execPath, ['server/index.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), ...(dist ? { DIST: dist } : {}) }, stdio: ['ignore', 'pipe', 'pipe'] });
  const out = [];
  const onLine = (b) => { for (const l of b.toString().split('\n')) if (l.trim()) { out.push(l); log(l); } };
  proc.stdout.on('data', onLine);
  proc.stderr.on('data', onLine);
  await new Promise((ok, fail) => {
    const timer = setTimeout(() => fail(new Error(`server did not start: ${out.join(' | ')}`)), 15000);
    const check = () => { if (out.some((l) => /phone pad:/.test(l))) { clearTimeout(timer); ok(); } };
    proc.stdout.on('data', check);
    proc.once('exit', (code) => { clearTimeout(timer); fail(new Error(`server exited ${code}: ${out.join(' | ')}`)); });
  });
  return {
    port, proc, out, base: `http://127.0.0.1:${port}`,
    async close() {
      if (proc.exitCode !== null) return;
      proc.kill('SIGTERM');
      await Promise.race([new Promise((r) => proc.once('exit', r)), new Promise((r) => setTimeout(r, 3000))]);
      if (proc.exitCode === null) proc.kill('SIGKILL');
    },
  };
}

// ---------- browser ----------
// metal: headless shell on the Mac's GPU through ANGLE Metal. gl: ANGLE OpenGL. swiftshader: the CPU rasteriser,
// not representative of a real Mac. headed: Chrome for Testing in a real window (Metal, a real compositor).
export const BACKENDS = {
  metal: { headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] },
  gl: { headless: true, args: ['--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] },
  swiftshader: { headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] },
  headed: { headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-webgl'] },
};
export const UNCAPPED = ['--disable-gpu-vsync', '--disable-frame-rate-limit'];

function newest(prefix, rel) {
  if (!existsSync(CACHE)) return null;
  for (const d of readdirSync(CACHE).filter((x) => x.startsWith(prefix)).sort().reverse()) {
    const exe = join(CACHE, d, rel);
    if (existsSync(exe)) return exe;
  }
  return null;
}
// The playwright cache may be empty on this Mac: fall back to the Chromium builds puppeteer keeps, newest first.
const PUPPETEER = join(homedir(), '.cache/puppeteer');
function newestPuppeteer(kind, rel) {
  const dir = join(PUPPETEER, kind);
  if (!existsSync(dir)) return null;
  const byVersion = (a, b) => b.localeCompare(a, undefined, { numeric: true });
  for (const d of readdirSync(dir).filter((x) => x.startsWith('mac_arm-')).sort(byVersion)) {
    const exe = join(dir, d, rel);
    if (existsSync(exe)) return exe;
  }
  return null;
}
export const headlessShell = () => newest('chromium_headless_shell-', 'chrome-headless-shell-mac-arm64/chrome-headless-shell')
  || newestPuppeteer('chrome-headless-shell', 'chrome-headless-shell-mac-arm64/chrome-headless-shell');
export const chromeForTesting = () => newest('chromium-', 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')
  || newestPuppeteer('chrome', 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');

export async function launch(backend = 'metal', { uncapped = false, extra = [] } = {}) {
  const b = BACKENDS[backend];
  if (!b) throw new Error(`unknown backend ${backend}: ${Object.keys(BACKENDS).join(', ')}`);
  const executablePath = b.headless ? headlessShell() : chromeForTesting();
  if (!executablePath) throw new Error(`no ${b.headless ? 'chromium headless shell' : 'Chrome for Testing'} in ${CACHE}`);
  const { chromium } = await import('playwright-core');
  return chromium.launch({ executablePath, headless: b.headless, args: [...b.args, ...(uncapped ? UNCAPPED : []), ...extra] });
}

// The WebGL renderer string the page really got: "ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, ...)" or SwiftShader.
export async function gpuInfo(page) {
  return page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return { renderer: 'no webgl2', vendor: '' };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { renderer: gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER), vendor: gl.getParameter(ext ? ext.UNMASKED_VENDOR_WEBGL : gl.VENDOR) };
  });
}

// errors: page errors and console errors; warnings are kept apart.
function watch(page, label, log) {
  const errors = [], warnings = [];
  page.on('pageerror', (e) => { errors.push(`${label}: ${e.message}`); log(`[${label} pageerror] ${e.message}`); });
  page.on('console', (m) => {
    if (m.type() === 'error') { errors.push(`${label}: ${m.text()}`); log(`[${label} error] ${m.text()}`); }
    else if (m.type() === 'warning') warnings.push(`${label}: ${m.text()}`);
  });
  return { errors, warnings };
}

// A phone: the real controller page, landscape, touch, its own context (own localStorage, so its own pad id).
export async function openPad(browser, base, { locale = 'en-US', label = 'pad', log = () => {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, locale });
  const page = await ctx.newPage();
  const w = watch(page, label, log);
  await page.goto(`${base}/pad`);
  await page.waitForFunction(() => window.__pad?.joined && window.__pad.slot >= 0, null, { timeout: 15000 });
  const cdp = await ctx.newCDPSession(page);
  const geo = await page.evaluate(() => window.__pad.geometry());
  return { ctx, page, cdp, geo, label, ...w, slot: await page.evaluate(() => window.__pad.slot) };
}

const DEAD = 0.12; // controller/pad.js dead zone
// The thumb position on the stick that makes the pad send (x, y), inside the rim so the base never slides.
export function thumbFor(geo, x, y) {
  const m = Math.min(1, Math.hypot(x, y));
  if (m < 1e-3) return { x: geo.sx, y: geo.sy };
  const d = geo.R * Math.min(0.9999, DEAD + m * (1 - DEAD)); // on the rim at most, never past it
  return { x: geo.sx + (x / Math.hypot(x, y)) * d, y: geo.sy - (y / Math.hypot(x, y)) * d };
}

// ---------- checks ----------
// Paths of every number in window.__game that is NaN or infinite (JSON copies would hide them as null).
export function nonFinite(page) {
  return page.evaluate(() => {
    const bad = [];
    const seen = new Set();
    const walk = (v, path) => {
      if (typeof v === 'number') { if (!Number.isFinite(v)) bad.push(`${path}=${v}`); return; }
      if (!v || typeof v !== 'object' || seen.has(v)) return;
      seen.add(v);
      for (const k of Object.keys(v)) walk(v[k], `${path}.${k}`);
    };
    walk(window.__game, '__game');
    return bad;
  });
}
