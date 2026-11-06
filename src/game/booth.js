// The commentary box on the TV page: joins the head (commentary.js), the voices (audio) and the caption. Off, it holds nothing and
// asks for nothing, not a byte of the packs.
import { createCommentary } from './commentary.js';
import { VOICE_LANGS } from '../data/commentary.js';

const LOG_MAX = 400;

export function createBooth({ audio, caption, seed = () => Math.floor(Math.random() * 1e9) }) {
  let lang = 'off', C = null, clips = null, closed = true, race = false, want = 0, packReady = false;
  const log = [];
  const durationOf = (id) => clips?.[id]?.[2] ?? null;

  function play(cue, show) {
    log.push({ pool: cue.pool, pri: cue.pri, cut: cue.cut, text: cue.parts.map((p) => p.text).join(' '), ids: cue.parts.map((p) => p.id) });
    if (log.length > LOG_MAX) log.shift();
    audio.say(cue);
    if (show) caption.say(cue.parts);
  }

  return {
    get lang() { return lang; },
    // The option's value: off or a language. The pack comes down now, so the race never waits for it.
    set(next) {
      const v = VOICE_LANGS.includes(next) ? next : 'off';
      if (v === lang) return;
      lang = v;
      const mine = ++want;
      clips = null; packReady = false;
      audio.hush();
      caption.hide();
      if (v === 'off') { C = null; audio.voice(null); return; }
      C = createCommentary({ lang: v, seed: seed(), duration: durationOf });
      audio.voice(v).then((pack) => {
        if (mine !== want || !pack) return;
        clips = pack.clips; packReady = true;
        // what you hear on choosing it, in the lobby: the box is switched on
        if (!race && C) play(C.preview(), false);
      });
    },
    begin({ track, views, karts, mode }) {
      if (!C) return;
      C.begin({ track, views, karts, mode });
      caption.views(views?.length ?? 1);
      closed = false; race = true;
    },
    intro() { if (C && !closed) { const cue = C.intro(); if (cue) play(cue, true); } },
    frame(events, state) {
      if (!C || closed) return;
      C.events(events, state);
      const cue = C.next(state.t, audio.voiceBusy());
      if (cue) play(cue, true);
    },
    closing() {
      if (!C || closed) return;
      closed = true;
      caption.hide();
      const cue = C.closing();
      if (cue) play(cue, false);
    },
    hush() { audio.hush(); caption.hide(); },
    end() { closed = true; race = false; audio.hush(); caption.hide(); },
    get debug() { return { lang, packReady, closed, log: log.slice(), stats: C?.stats ?? null, audio: audio.voiceStats() }; },
  };
}
