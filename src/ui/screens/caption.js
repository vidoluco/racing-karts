// What the commentators are saying, in small over the race: for a noisy room, and for whoever does not speak the language by ear.
// It lives on the UI's root, under the pause, and only exists on the page once someone has said something.
const u = (n) => `calc(var(--u) * ${n})`;
const CSS = `
.rk .vcap { position: absolute; left: 50%; bottom: ${u(14)}; translate: -50% 0; width: max-content; max-width: ${u(1160)}; display: flex; align-items: center; gap: ${u(12)};
  padding: ${u(7)} ${u(22)} ${u(7)} ${u(10)}; font-size: max(15px, ${u(26)}); line-height: 1.15; font-weight: 600; color: #fff; background: rgba(29, 31, 43, 0.86);
  border-radius: ${u(999)}; pointer-events: none; z-index: 12; opacity: 0; transform: translateY(${u(10)}); transition: opacity 0.14s, transform 0.2s cubic-bezier(0.3, 1.6, 0.5, 1); }
.rk .vcap.on { opacity: 1; transform: none; }
/* split screen: every view keeps its place and its item in the bottom corners, so the words sit on the seam between the views */
.rk .vcap.split { bottom: auto; top: 50%; translate: -50% -50%; width: max-content; max-width: ${u(1160)}; }
.rk .vcap i { flex: none; width: ${u(34)}; height: ${u(34)}; display: grid; place-items: center; border-radius: 50%; background: var(--vc, #f6c23e); }
.rk .vcap[data-v="b"] { --vc: #62c5c0; }
.rk .vcap svg { width: 62%; height: 62%; display: block; }
`;
const MIC = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill="#1d1f2b"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4" fill="none" stroke="#1d1f2b" stroke-width="2.6" stroke-linecap="round"/></svg>';

export function createCaption(root) {
  const doc = root.ownerDocument;
  let box = null, timers = [];
  const clear = () => { for (const t of timers) clearTimeout(t); timers = []; };
  function make() {
    if (box) return;
    if (!doc.getElementById('rk-vcap-style')) {
      const style = doc.createElement('style');
      style.id = 'rk-vcap-style';
      style.textContent = CSS;
      doc.head.append(style);
    }
    box = doc.createElement('div');
    box.className = 'vcap';
    box.innerHTML = `<i>${MIC}</i><span></span>`;
    root.append(box);
  }
  return {
    // parts: [{ text, voice, dur, gap }], one after the other. A name said on its own goes with the line it opens.
    say(parts) {
      make();
      clear();
      let at = 0.12;
      const lines = [];
      for (const p of parts) {
        const last = lines[lines.length - 1];
        if (last?.open) { last.text += ` ${p.text}`; last.dur += p.dur + p.gap; last.open = /^\S+!$/.test(p.text); } else lines.push({ text: p.text, voice: p.voice, dur: p.dur, gap: p.gap, open: /^\S+!$/.test(p.text) });
      }
      for (const l of lines) {
        at += l.gap ?? 0;
        timers.push(setTimeout(() => {
          box.querySelector('span').textContent = l.text;
          box.dataset.v = l.voice;
          box.classList.add('on');
        }, at * 1000));
        at += l.dur;
      }
      timers.push(setTimeout(() => box.classList.remove('on'), (at + 0.25) * 1000));
    },
    hide() { clear(); box?.classList.remove('on'); },
    views(n) { make(); box.classList.toggle('split', n > 1); },
    get el() { return box; },
  };
}
