// The phone's end of server/link.js: looks like a WebSocket to pad.js, for an https page whose wss:// is refused.
// Words in on server-sent events, words out in POSTs, one at a time: what piles up during one goes in the next, and a newer
// stick position takes the place of an older one not sent yet, unless a button changed between them.
const IN_RE = /^\{"t":"in".*"b":(\d),"d":(\d)/;
export function mergeable(a, b) {
  const p = IN_RE.exec(a), q = IN_RE.exec(b);
  return !!p && !!q && p[1] === q[1] && p[2] === q[2];
}

export function openLink(id) {
  const es = new EventSource(`/link/down?id=${encodeURIComponent(id)}`);
  let sid = null, queue = [], busy = false, over = false;
  const sock = {
    readyState: 0, onopen: null, onmessage: null, onerror: null, onclose: null,
    send(text) {
      if (over) return;
      if (queue.length && mergeable(queue[queue.length - 1], text)) queue[queue.length - 1] = text;
      else queue.push(text);
      flush();
    },
    close() { end(1000); },
  };
  function end(code) {
    if (over) return;
    over = true;
    sock.readyState = 3;
    es.close();
    sock.onclose?.({ code });
  }
  function flush() {
    if (busy || over || !sid || !queue.length) return;
    const batch = queue;
    queue = [];
    busy = true;
    fetch(`/link/up?sid=${sid}`, { method: 'POST', body: JSON.stringify(batch), headers: { 'Content-Type': 'text/plain' } })
      .then((r) => { if (!r.ok) end(1006); }, () => end(1006))
      .finally(() => { busy = false; flush(); });
  }
  es.addEventListener('link', (e) => {
    sid = e.data;
    sock.readyState = 1;
    sock.onopen?.({});
    flush();
  });
  es.addEventListener('bye', (e) => end(Number(e.data) || 1000));
  es.onmessage = (e) => sock.onmessage?.({ data: e.data });
  es.onerror = () => end(1006); // the browser would try again by itself: pad.js has its own backoff, and its own screen for it
  return sock;
}
