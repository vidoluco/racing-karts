// A pad's socket for a phone that may not open one. Safari on iPhone has a record of refusing wss:// to a self-signed
// certificate even after the person accepted that certificate for the page, while ordinary requests to the same address go
// through. So an https pad tries the WebSocket first and falls back on this: words to the phone on one long response
// (server-sent events), words from the phone in POSTs. To the room it is one more socket, with the same few methods.
import { randomUUID } from 'node:crypto';

const MAX_BODY = 16384;

export function createLink({ room, validId, newId = randomUUID, log = () => {} }) {
  const clients = new Map(); // sid -> socket

  function open(req, res, id) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    req.socket.setNoDelay?.(true);
    const sid = randomUUID();
    const s = {
      readyState: 1,
      _alive: true,
      _rx: Date.now(),
      _socket: req.socket,
      send(text) { if (s.readyState === 1) res.write(`data: ${text}\n\n`); },
      // nothing answers a comment line: a phone that went away shows up as the response closing, and its silence as _rx
      ping() { s._alive = true; if (s.readyState === 1) res.write(': alive\n\n'); },
      close(code = 1000) {
        if (s.readyState !== 1) return;
        res.write(`event: bye\ndata: ${code}\n\n`);
        finish(code);
      },
      terminate() { finish(1006); res.destroy(); },
    };
    function finish(code) {
      if (s.readyState !== 1) return;
      s.readyState = 3;
      clients.delete(sid);
      res.end();
      room.removePad(s, s._silent ? `silent ${s._silent} ms` : `closed ${code}`);
    }
    res.on('close', () => finish(1006));
    clients.set(sid, s);
    log(`pad ${id.slice(0, 8)} on the https link: this phone refused wss`); // what docs/gyro-phone-test.md asks to look for
    res.write(`event: link\ndata: ${sid}\n\n`); // before the room's welcome
    room.addPad(s, id);
  }

  function up(req, res, sid) {
    const s = clients.get(sid);
    if (!s) { res.writeHead(410); return res.end(); }
    const parts = [];
    let size = 0;
    req.on('data', (b) => {
      size += b.length;
      if (size > MAX_BODY) { res.writeHead(413, { Connection: 'close' }); res.end(); req.destroy(); return; }
      parts.push(b);
    });
    req.on('end', () => {
      if (size > MAX_BODY) return;
      let list;
      try { list = JSON.parse(Buffer.concat(parts).toString()); } catch { list = null; }
      if (!Array.isArray(list)) { res.writeHead(400); return res.end(); }
      s._rx = Date.now();
      for (const text of list) if (typeof text === 'string') room.message(s, text);
      res.writeHead(204, { 'Cache-Control': 'no-store' });
      res.end();
    });
  }

  return {
    clients,
    // true when this request was the link's
    handle(req, res, url) {
      if (url.pathname === '/link/down' && req.method === 'GET') {
        const given = url.searchParams.get('id');
        open(req, res, validId(given) ? given : newId());
        return true;
      }
      if (url.pathname === '/link/up' && req.method === 'POST') {
        up(req, res, url.searchParams.get('sid'));
        return true;
      }
      return false;
    },
  };
}
