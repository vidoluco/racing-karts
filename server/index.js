// Racing Karts LAN server: serves dist/, the phone pad, a QR code and the WebSocket room.
// Usage: node server/index.js [--open]   (PORT env overrides 5191, 0 picks a free one, LAN_IP the address the QR points to,
// DIST the folder it serves instead of dist/, TLS=0 turns off the https address on the next port, for tilt steering only,
// TLS_PORT moves it, TLS_DIR moves its certificate)
import http from 'node:http';
import https from 'node:https';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import QRCode from 'qrcode';
import { createRoom, validId, GRACE_MS } from './room.js';
import { createTelemetry } from './telemetry.js';
import { createLink } from './link.js';
import { ensureCert } from './tls.js';

export const DEFAULT_PORT = 5191;
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.map': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.ktx2': 'image/ktx2', '.hdr': 'application/octet-stream', '.exr': 'application/octet-stream',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

// The address a phone on the same Wi-Fi can reach: the first non-internal IPv4, Wi-Fi/Ethernet (en*, eth*, wlan*,
// Windows "Wi-Fi"/"Ethernet") before anything else, and VPN tunnels last: NordVPN (NordLynx is a utun on macOS,
// `nordlynx` on Linux, a "NordLynx"/"TAP-NordVPN" adapter on Windows), WireGuard, Tailscale, ZeroTier, OpenVPN
// tun/tap, plus bridges and VM networks. Among equals a private LAN range (192.168/16, 10/8, 172.16/12) beats a
// carrier-grade one (100.64/10: Tailscale, NordVPN Meshnet); a self-assigned 169.254 address never wins.
// LAN_IP env forces a specific address.
const VPN_RE = /^(utun|tun|tap|ipsec|ppp|gif|stf|wg|nord|tailscale|zt|bridge|vmnet|vboxnet|vnic|docker|veth|virbr|awdl|llw|anpi)|vpn|wireguard|nordlynx|tap-|virtual|vethernet|hyper-v|loopback/i;
const LAN_RE = /^(en|eth|wlan|wl|wifi|wi-fi|ethernet)/i;
function rankAddress({ name, address }) {
  const iface = LAN_RE.test(name) && !VPN_RE.test(name) ? 0 : VPN_RE.test(name) ? 20 : 10;
  const [a, b, c] = address.split('.').map(Number);
  // 172.20.10.x is an iPhone's Personal Hotspot, 192.168.43.x the usual Android one: when it is there, that is where
  // the players are. Newer Androids pick a random private range, which only needs to be a private range to be found.
  const hotspot = (a === 172 && b === 20 && c === 10) || (a === 192 && b === 168 && c === 43);
  const range = hotspot ? -1 : a === 192 && b === 168 ? 0 : a === 10 ? 1 : a === 172 && b >= 16 && b <= 31 ? 1
    : a === 100 && b >= 64 && b <= 127 ? 4 : a === 169 && b === 254 ? 100 : 2;
  return iface + range;
}
// Every candidate, best first: [{ name, address }].
export function lanAddresses(ifaces = networkInterfaces()) {
  const found = [];
  for (const [name, list] of Object.entries(ifaces)) {
    for (const a of list || []) {
      if ((a.family === 'IPv4' || a.family === 4) && !a.internal) found.push({ name, address: a.address });
    }
  }
  return found.sort((a, b) => rankAddress(a) - rankAddress(b));
}
export function lanAddress(ifaces = networkInterfaces(), env = process.env) {
  if (env.LAN_IP) return env.LAN_IP;
  return lanAddresses(ifaces)[0]?.address || null;
}
// Is this address (from lanAddresses) on a VPN tunnel rather than the Wi-Fi? The console warns about it.
export const viaVpn = (ifaces, address) => lanAddresses(ifaces).some((f) => f.address === address && VPN_RE.test(f.name));

export function createServer({
  port = DEFAULT_PORT, host = '0.0.0.0', distDir = join(ROOT, 'dist'),
  reserveMs = GRACE_MS, pingMs = 5000, padSilentMs = 4000, netPollMs = 1000, ifaces = networkInterfaces, log = () => {}, telemetryDir = null,
  tls = null, // { dir, port, bins }: also listen with TLS, for the phones that steer by tilting. Without openssl it stays http only.
} = {}) {
  const dist = resolve(distDir);
  const telemetry = createTelemetry({ dir: telemetryDir, log });
  const room = createRoom({ reserveMs, log, telemetry: telemetry.write });
  const link = createLink({ room, validId, log });
  let boundPort = port;
  let tlsServer = null, tlsPort = null, certBusy = false;

  const urls = () => {
    const ip = lanAddress(ifaces()) || '127.0.0.1';
    const lanUrl = `http://${ip}:${boundPort}/`;
    return { lanUrl, padUrl: `${lanUrl}pad`, localUrl: `http://localhost:${boundPort}/` };
  };

  // The Mac changing network (Wi-Fi to the phone's hotspot). A phone reaches the new address only by scanning the QR,
  // and that is a new origin, so a new id: the old seats would hold the room for reserveMs while four phones wait.
  // A Wi-Fi blip (no address, then the same one) is not a change: there the phones do come back and keep their seats.
  const addressesOf = (list) => lanAddresses(list).map((f) => f.address);
  let netAddr = null, netSeen = new Set();
  try { netAddr = lanAddress(ifaces()); netSeen = new Set(addressesOf(ifaces())); } catch {}
  function checkNetwork() {
    let list;
    try { list = ifaces(); } catch { return false; }
    const addr = lanAddress(list);
    const now = addressesOf(list);
    for (const a of now) netSeen.add(a);
    if (!addr || addr === netAddr) return false;
    const live = new Set(now);
    // A socket that came in on an address the Mac no longer has is dead, even if nothing has said so yet.
    for (const ws of pads()) {
      const on = ws._socket?.localAddress?.replace(/^::ffff:/, '');
      if (ws._role !== 'pad' || !netSeen.has(on) || live.has(on)) continue;
      room.removePad(ws, 'network');
      ws.terminate();
    }
    const freed = room.releaseAway();
    log(`network changed: ${netAddr} -> ${addr}, ${freed} seats freed`);
    netAddr = addr;
    netSeen = live;
    refreshCert();
    return true;
  }

  // The https address: the certificate must carry the address phones reach now.
  const certFor = () => {
    let list = {};
    try { list = ifaces(); } catch {}
    return ensureCert({ dir: tls.dir, must: lanAddress(list), want: addressesOf(list), ...(tls.bins ? { bins: tls.bins } : {}) });
  };
  function refreshCert() {
    if (!tlsServer || certBusy) return;
    certBusy = true;
    certFor().then((pem) => {
      if (pem && tlsServer) tlsServer.setSecureContext({ key: pem.key, cert: pem.cert });
    }).catch((e) => log(`certificate not renewed: ${e.message}`)).finally(() => { certBusy = false; });
  }
  async function startTls() {
    let pem = null;
    try { pem = await certFor(); } catch (e) { log(`no certificate: ${e.message}`); return; }
    if (!pem) { log('no openssl to make a certificate: http only, tilt steering is off'); return; }
    const srv = https.createServer({ key: pem.key, cert: pem.cert }, onHttp);
    srv.on('upgrade', onUpgrade);
    const wanted = tls.port ?? (boundPort ? boundPort + 1 : 0);
    await new Promise((ok) => {
      srv.once('error', (e) => { log(`no https on port ${wanted} (${e.code || e.message}): http only, tilt steering is off`); ok(); });
      srv.listen(wanted, host, () => {
        srv.removeAllListeners('error');
        srv.on('error', (e) => log(`https: ${e.message}`));
        tlsServer = srv;
        tlsPort = srv.address().port;
        ok();
      });
    });
  }

  async function sendFile(res, file, head) {
    try {
      const st = await stat(file);
      if (st.isDirectory()) return sendFile(res, join(file, 'index.html'), head);
      const body = head ? null : await readFile(file);
      res.writeHead(200, {
        'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Length': st.size,
        'Cache-Control': 'no-cache',
      });
      res.end(body);
    } catch {
      notFound(res, file);
    }
  }

  function notFound(res, file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    const hint = file && /(index|pad)\.html$/.test(file) && !existsSync(dist) ? ' (dist/ is missing: run npm run build)' : '';
    res.end(`not found${hint}`);
  }

  const json = (res, code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(obj));
  };

  async function onRequest(req, res) {
    let url;
    try { url = new URL(req.url, 'http://x'); } catch { res.writeHead(400); return res.end(); }
    if (link.handle(req, res, url)) return;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      return res.end();
    }
    const path = url.pathname;
    const head = req.method === 'HEAD';

    if (path === '/api/info') {
      checkNetwork();
      const { lanUrl, padUrl } = urls();
      return json(res, 200, { lanUrl, padUrl, httpPort: boundPort, tlsPort, ...room.status() });
    }
    if (path === '/qr.svg') {
      const u = url.searchParams.get('u') || urls().padUrl;
      if (u.length > 1024) return json(res, 400, { error: 'url too long' });
      try {
        const svg = await QRCode.toString(u, {
          type: 'svg', margin: 1, errorCorrectionLevel: 'M',
          color: { dark: url.searchParams.get('dark') === 'light' ? '#ffffffff' : '#0a1420ff', light: '#00000000' },
        });
        res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' });
        return res.end(head ? null : svg);
      } catch {
        return json(res, 400, { error: 'cannot encode' });
      }
    }
    if (path === '/' || path === '/index.html') return sendFile(res, join(dist, 'index.html'), head);
    // The pages declare an inline icon; a browser that still asks for /favicon.ico gets "no icon", not a 404.
    if (path === '/favicon.ico' && !existsSync(join(dist, 'favicon.ico'))) { res.writeHead(204); return res.end(); }
    if (path === '/pad') return sendFile(res, join(dist, 'pad.html'), head);
    // pad.html loads pad.js relatively: under /pad/ it would resolve to /pad/pad.js.
    if (path === '/pad/') { res.writeHead(302, { Location: '/pad' + url.search }); return res.end(); }

    let rel;
    try { rel = decodeURIComponent(path); } catch { return notFound(res); }
    if (rel.includes('\0')) return notFound(res);
    const clean = normalize('/' + rel);
    const file = resolve(dist, '.' + clean);
    if (file !== dist && !file.startsWith(dist + sep)) return notFound(res);
    // A kart picture nobody rendered yet: the phone draws a placeholder. A 204 and not a 404, or every card would
    // log an error in the page's console, which the browser tests read.
    if (clean.startsWith('/assets/ui/') && extname(clean) === '.png' && !existsSync(file)) {
      const source = resolve(ROOT, '.' + clean);
      if (source.startsWith(join(ROOT, 'assets') + sep) && existsSync(source)) return sendFile(res, source, head);
      res.writeHead(204);
      return res.end();
    }
    return sendFile(res, file, head);
  }

  function onHttp(req, res) {
    onRequest(req, res).catch((e) => {
      log(`request error: ${e.message}`);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  }
  const server = http.createServer(onHttp);

  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
  // a pad on the https address joins the same room through this, or through the link
  const pads = () => [...wss.clients, ...link.clients.values()];
  function onUpgrade(req, socket, headBuf) {
    let url;
    try { url = new URL(req.url, 'http://x'); } catch { return socket.destroy(); }
    const role = url.searchParams.get('role');
    if (url.pathname !== '/ws' || (role !== 'host' && role !== 'pad')) {
      socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
      return socket.destroy();
    }
    checkNetwork(); // a phone that scanned the new QR gets its seat now, not at the next poll
    wss.handleUpgrade(req, socket, headBuf, (ws) => {
      ws._alive = true;
      ws._rx = Date.now();
      ws.on('pong', () => { ws._alive = true; });
      ws.on('error', () => {});
      ws.on('message', (raw) => { ws._rx = Date.now(); room.message(ws, raw); });
      if (role === 'host') {
        room.addHost(ws);
        ws.on('close', () => room.removeHost(ws));
      } else {
        const given = url.searchParams.get('id');
        room.addPad(ws, validId(given) ? given : randomUUID());
        ws.on('close', (code) => room.removePad(ws, ws._silent ? `silent ${ws._silent} ms` : `closed ${code}`));
      }
    });
  }
  server.on('upgrade', onUpgrade);

  // Phones that sleep do not close their socket: ping and drop the silent ones.
  const heartbeat = setInterval(() => {
    for (const ws of pads()) {
      if (!ws._alive) { ws._silent ||= pingMs; ws.terminate(); continue; }
      ws._alive = false;
      try { ws.ping(); } catch {}
    }
  }, pingMs);
  heartbeat.unref();
  // The pad page talks all the time (inputs at 30 Hz, a ping every second): one silent for padSilentMs walked out of
  // the Wi-Fi or was locked. Dropping it now, not after two missed pings, lets the TV say "waiting for" in seconds;
  // its slot stays reserved for the same phone. Only pads that sent a ping are held to it: a client that never
  // speaks that keep-alive (a scripted test pad, an older page) is left to the heartbeat above.
  const liveness = setInterval(() => {
    const now = Date.now();
    for (const ws of pads()) if (ws._role === 'pad' && ws._pings && now - ws._rx > padSilentMs) { ws._silent = now - ws._rx; ws.terminate(); }
  }, Math.max(100, Math.min(1000, padSilentMs / 4)));
  liveness.unref();
  const netPoll = setInterval(checkNetwork, netPollMs);
  netPoll.unref();

  return {
    room,
    get port() { return boundPort; },
    get tlsPort() { return tlsPort; },
    urls,
    listen() {
      return new Promise((ok, fail) => {
        const onErr = (e) => { server.off('listening', onOk); fail(e); };
        const onOk = () => {
          server.off('error', onErr);
          boundPort = server.address().port;
          (tls ? startTls() : Promise.resolve()).catch((e) => log(`https: ${e.message}`)).then(() => ok(urls()));
        };
        server.once('error', onErr);
        server.once('listening', onOk);
        server.listen(port, host);
      });
    },
    close() {
      clearInterval(heartbeat);
      clearInterval(liveness);
      clearInterval(netPoll);
      room.close();
      for (const ws of pads()) ws.terminate();
      const secure = tlsServer;
      tlsServer = null;
      return new Promise((ok) => {
        wss.close();
        let waits = secure ? 2 : 1;
        const one = () => { if (--waits === 0) ok(); };
        server.close(one);
        server.closeAllConnections?.();
        if (secure) { secure.close(one); secure.closeAllConnections?.(); }
      });
    },
  };
}

async function main() {
  const port = process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT;
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error(`Invalid PORT: ${process.env.PORT}`);
    process.exit(1);
  }
  const distDir = process.env.DIST ? resolve(process.env.DIST) : join(ROOT, 'dist');
  if (!existsSync(join(distDir, 'index.html'))) console.warn('Warning: dist/index.html not found, run "npm run build" first.');
  if (!existsSync(join(distDir, 'pad.html'))) console.warn('Warning: dist/pad.html not found, run "npm run build" first.');

  // the evening's numbers, local and gitignored: TELEMETRY=0 turns them off, TELEMETRY_DIR moves them
  const telemetryDir = process.env.TELEMETRY === '0' ? null : process.env.TELEMETRY_DIR ? resolve(process.env.TELEMETRY_DIR) : join(ROOT, 'telemetry');
  const tlsPort = process.env.TLS_PORT ? Number(process.env.TLS_PORT) : undefined;
  const tls = process.env.TLS === '0' ? null : { dir: process.env.TLS_DIR ? resolve(process.env.TLS_DIR) : join(ROOT, 'certs'), port: tlsPort };
  const srv = createServer({ port, distDir, telemetryDir, tls, log: (m) => console.log(`  ${m}`) });
  let u;
  try {
    u = await srv.listen();
  } catch (e) {
    if (e.code === 'EADDRINUSE') console.error(`Port ${port} is already in use. Is Racing Karts already running? Try PORT=${port + 1} npm start`);
    else if (e.code === 'EACCES') console.error(`No permission to listen on port ${port}.`);
    else console.error(`Cannot start the server: ${e.message}`);
    process.exit(1);
  }
  const ip = lanAddress();
  console.log('\nRacing Karts');
  console.log(`  game (this Mac): ${u.localUrl}`);
  console.log(`  game (LAN):      ${u.lanUrl}`);
  console.log(`  phone pad:       ${u.padUrl}`);
  if (srv.tlsPort) console.log(`  tilt steering:   https://${ip || '127.0.0.1'}:${srv.tlsPort}/pad  (the pad goes there by itself when a player asks for it)`);
  if (!ip) console.log('  No LAN address found: phones need the Mac and the phone on the same Wi-Fi.');
  else if (!process.env.LAN_IP && viaVpn(networkInterfaces(), ip)) {
    console.log('  That address is a VPN tunnel: a phone on the Wi-Fi may not reach it. Turn the VPN off, allow LAN');
    console.log('  access in it (NordVPN: "Allow LAN discovery"), or set LAN_IP to the Wi-Fi address.');
  }
  const others = lanAddresses().filter((f) => f.address !== ip);
  if (others.length && !process.env.LAN_IP) console.log(`  other addresses:  ${others.map((f) => `${f.address} (${f.name})`).join(', ')}  (LAN_IP=<address> picks one)`);
  try {
    console.log(await QRCode.toString(u.padUrl, { type: 'terminal', small: true }));
  } catch {}
  if (process.argv.includes('--open')) {
    execFile('open', [u.localUrl], (err) => { if (err) console.log(`  open ${u.localUrl} in a browser`); });
  }
  const stop = () => { console.log('\nbye'); srv.close().then(() => process.exit(0)); setTimeout(() => process.exit(0), 1500).unref(); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
