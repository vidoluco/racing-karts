// The commentators' heads: what is worth saying, when, and how not to get on anyone's nerves. Pure, no DOM, no audio. It only reads the sim's
// events and state, and draws from its own random stream, so a race with commentary steps byte for byte as one without.
//
//   const C = createCommentary({ lang, seed, duration });   // duration(clipId) -> s, from the pack; an estimate until it is there
//   C.begin({ track, views, karts });                       // one per race; what was said stays said across races
//   C.intro(), C.closing(), C.preview()                     // -> a cue or null
//   C.events(events, state);  C.next(t, busy)               // every frame: t is the sim's clock; -> a cue or null
//
// cue = { pool, pri, cut, parts: [{ id, text, voice, dur, gap }], dur }; parts play one after the other, gap is the s of silence before.
import { POOLS, clipsFor, DRIVERS } from '../data/commentary.js';

// How much it matters. Silence wanted before it (s), and what may interrupt: only something at CUT or above, and only over MINOR or below.
export const PRI = { idle: 0, minor: 1, notable: 2, major: 3, must: 4 };
const CUT = PRI.major, MINOR = PRI.minor;
const GAP = [12, 3.5, 1.6, 0.5, 0.2];
const TTL = [4, 2.2, 2.6, 3.5, 4]; // s a thing stays worth saying; a late joke is worse than none
export const TALK_WINDOW = 60;     // s
export const TALK_MINOR = 24;      // s of speech in the window above which only what matters gets through
const TALK_IDLE = 10;              // s: more than this in the window, and nobody needs small talk
const REPLY_CHANCE = 0.2;
const REPLY_GAP = 0.22;
const WHO_GAP = 0.04;

// The least seconds between two lines of the same family. Hits of all kinds are one family.
const COOL = { lead: 7, pass: 11, passed: 20, hit: 6, use: 14, haz: 18, rescue: 16, air: 70, wall: 45, drift: 50, shield: 30, forma: 7, chaos: 30, tt: 10, dis: 0, finish: 0 };
const familyOf = (pool) => {
  if (pool.startsWith('use.')) return 'use';
  if (pool.startsWith('haz.')) return 'haz';
  if (pool.startsWith('dis.') || pool === 'disEnd') return 'dis';
  if (['razzo', 'mici', 'formaggio', 'polenta', 'durian', 'sambal', 'rendang', 'frana', 'uova', 'bite', 'hit', 'hitLeader', 'disHit'].includes(pool)) return 'hit';
  if (pool.startsWith('forma')) return 'forma';
  if (pool.startsWith('tt')) return 'tt';
  if (pool.startsWith('finish') || pool === 'win' || pool === 'formaWin') return 'finish';
  return pool;
};
const HIT_POOL = { razzo: 'razzo', mici: 'mici', formaggio: 'formaggio', polenta: 'polenta', durian: 'durian', sambal: 'sambal', rendang: 'rendang', frana: 'frana', uova: 'uova', bite: 'bite' };
const DISASTER = new Set(['debris', 'avalanche', 'lahar', 'rockfall', 'quake', 'eruption', 'cloud', 'banjir', 'bomb', 'boulder', 'log', 'bank', 'snow', 'tile']);
const USE_POOL = { grappa: 'use.grappa', zuica: 'use.zuica', uova: 'use.uova', sambal: 'use.sambal', razzo: 'use.razzo', frana: 'use.frana' };
// Never made fun of by name: a generic line, with no sting on her name. Spec, secret karts.
const NO_NAME_ON_MISHAP = new Set(['fifi']);

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// About 13 characters a second, before the pack has said how long a clip really is.
const estimate = (text) => 0.3 + text.length / 13;

export function createCommentary({ lang, seed = 1, duration = null } = {}) {
  const rnd = mulberry(seed);
  const clips = new Map(clipsFor(lang).map((c) => [c.id, c]));
  const bags = new Map();     // pool -> line numbers still to say; a line comes back only when all the others have been said
  const lastLine = new Map();
  const log = [];             // [t, seconds] of speech, for the talk budget
  const places = {};
  let queue = [], t = 0, until = 0, current = null, lastFamily = new Map(), lastPool = new Map(), used = new Map();
  let track = null, views = [], karts = [], leadTimes = [], lastLapSaid = false, lastSpeaker = 'b', idleWait = 18, lastAny = 0, mode = 'race';
  const stats = { said: 0, dropped: 0, seconds: 0, byPool: {} };

  const dur = (id) => (duration?.(id) ?? estimate(clips.get(id)?.text ?? ''));

  function draw(pool) {
    let bag = bags.get(pool);
    if (!bag?.length) {
      const n = POOLS[pool][lang].length;
      bag = Array.from({ length: n }, (_, i) => i);
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
      // the new round never opens with what closed the last one
      if (n > 1 && bag[bag.length - 1] === lastLine.get(pool)) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      bags.set(pool, bag);
    }
    const n = bag.pop();
    lastLine.set(pool, n);
    return n;
  }

  // The clip of a pool's line. For a line in both voices, want says which.
  function clipOf(pool, n, kart, want) {
    const P = POOLS[pool];
    if (P.who) return clips.get(P.voice === 'both' ? `${pool}.${n}.${kart}.${want}` : `${pool}.${n}.${kart}`);
    return clips.get(P.voice === 'both' ? `${pool}.${n}.${want}` : `${pool}.${n}`);
  }
  const part = (c, gap = 0) => ({ id: c.id, text: c.text, voice: c.voice, dur: dur(c.id), gap });

  function build(item) {
    const { pool, kart, sting } = item;
    const P = POOLS[pool];
    const n = draw(pool);
    const first = clipOf(pool, n, karts[kart], P.voice === 'both' ? (lastSpeaker === 'a' ? 'b' : 'a') : undefined);
    if (!first) return null;
    const parts = [];
    if (sting && !P.who && karts[kart] && DRIVERS[karts[kart]] && !NO_NAME_ON_MISHAP.has(karts[kart])) {
      const name = clips.get(`who.0.${karts[kart]}.${first.voice}`);
      if (name) parts.push(part(name));
    }
    parts.push(part(first, parts.length ? WHO_GAP : 0));
    lastSpeaker = first.voice;
    // the other one has something to add, now and then, on what is worth a reaction
    if (item.pri >= PRI.notable && item.pri < PRI.must && !P.who && rnd() < REPLY_CHANCE) {
      const other = first.voice === 'a' ? 'b' : 'a';
      const r = clipOf('reply', draw('reply'), null, other);
      if (r) { parts.push(part(r, REPLY_GAP)); lastSpeaker = other; }
    }
    return parts;
  }

  const spoken = (now) => {
    let s = 0;
    for (const [at, d] of log) if (at > now - TALK_WINDOW) s += d;
    return s;
  };

  function say(item, now, cut) {
    const parts = build(item);
    if (!parts) return null;
    const total = parts.reduce((a, p) => a + p.dur + p.gap, 0);
    const family = familyOf(item.pool);
    until = now + total;
    current = { pri: item.pri, end: until };
    lastFamily.set(family, now);
    lastPool.set(item.pool, now);
    (used.get(family) ?? used.set(family, []).get(family)).push(now);
    log.push([now, total]);
    while (log.length && log[0][0] < now - TALK_WINDOW) log.shift();
    stats.said++; stats.seconds += total; stats.byPool[item.pool] = (stats.byPool[item.pool] ?? 0) + 1;
    lastAny = until;
    idleWait = GAP[0] + rnd() * 8;
    return { pool: item.pool, pri: item.pri, cut: !!cut, parts, dur: total };
  }

  const want = (pool, pri, extra = {}) => {
    if (!POOLS[pool]) return;
    // one candidate per family: the newest thing that happened is the one to talk about
    const family = familyOf(pool);
    const old = queue.findIndex((q) => familyOf(q.pool) === family);
    if (old >= 0) {
      if (queue[old].pri > pri) return;
      queue.splice(old, 1);
    }
    queue.push({ pool, pri, at: t, ttl: TTL[pri], ...extra });
  };

  const isMine = (i) => views.includes(i);

  function hitLine(e, K) {
    const k = K[e.kart];
    if (!k) return;
    const mine = isMine(e.kart), byMine = isMine(e.by), leader = k.place === 1;
    if (!mine && !byMine && !leader) return; // two bots at the back, far from every screen
    const cause = e.cause;
    let pool = 'hit';
    if (HIT_POOL[cause]) pool = HIT_POOL[cause];
    else if (POOLS[`haz.${cause}`]) pool = `haz.${cause}`;
    else if (DISASTER.has(cause)) pool = 'disHit';
    if (e.kind === 'stink' && !mine) return;
    // the leader going down is the news, whatever did it, unless what did it is funnier
    if (leader && pool === 'hit') pool = 'hitLeader';
    else if (leader && rnd() < 0.35) pool = 'hitLeader';
    want(pool, leader || mine ? PRI.notable : PRI.minor, { kart: e.kart, sting: views.length > 1 || leader ? rnd() < 0.7 : rnd() < 0.3 });
  }

  function onEvent(e, st) {
    const K = st?.karts ?? [];
    const k = K[e.kart];
    switch (e.type) {
      case 'go': want(mode === 'time' ? 'ttStart' : mode === 'forma' ? 'formaStart' : 'start', PRI.major); break;
      case 'overtake':
        if (e.place === 1) {
          leadTimes.push(t);
          leadTimes = leadTimes.filter((x) => x > t - 25);
          // the news of the race: it waits out a line in progress, as a notable thing would be stale by then
          if (leadTimes.length >= 3 && !lastLapSaid) want('chaos', PRI.notable);
          else want('lead', PRI.major, { kart: e.kart, ttl: 6 }); // a newer change replaces it in the queue, so it never names an old leader
        } else if (isMine(e.kart) ? e.place <= 3 || rnd() < 0.5 : e.place <= 2 && rnd() < 0.5) want('pass', PRI.minor, { kart: e.kart, sting: views.length > 1 || !isMine(e.kart) });
        break;
      case 'hit': hitLine(e, K); break;
      case 'shield': if (isMine(e.kart)) want('shield', PRI.minor, { kart: e.kart, sting: views.length > 1 }); break;
      case 'bite': if (isMine(e.kart) || isMine(e.victim)) want('bite', PRI.minor); break;
      case 'steal': if (isMine(e.kart) || isMine(e.from)) want('rendang', PRI.notable, { kart: e.from, sting: views.length > 1 }); break;
      case 'itemUse': {
        const pool = USE_POOL[e.item];
        if (!pool) break;
        if (isMine(e.kart) || k?.place <= 2 || rnd() < 0.2) want(pool, e.item === 'frana' ? PRI.notable : PRI.minor, { kart: e.kart, sting: views.length > 1 });
        break;
      }
      case 'hazardNear': if (isMine(e.kart)) want(`haz.${e.kind}`, PRI.minor); break;
      case 'traffic': if (e.kind === 'crash' && isMine(e.kart)) want('haz.traffic', PRI.minor); break;
      case 'disaster':
        if (e.phase === 'warn') want(`dis.${e.kind}`, e.kind === 'cloud' ? PRI.notable : PRI.must);
        else if (e.phase === 'end' && e.kind !== 'cloud') want('disEnd', PRI.minor);
        break;
      case 'rescue': if (isMine(e.kart) || k?.place === 1) want('rescue', PRI.notable, { kart: e.kart, sting: views.length > 1 }); break;
      case 'land': if (isMine(e.kart) && (e.force ?? 0) > 9) want('air', PRI.minor); break;
      case 'wall': if (isMine(e.kart) && (e.force ?? 0) > 7) want('wall', PRI.minor); break;
      case 'driftEnd': if (isMine(e.kart) && e.tier === 3) want('drift', PRI.minor); break;
      case 'lastLap':
        // a long road races one lap, and this event is its last kilometre
        if (!lastLapSaid) { lastLapSaid = true; want(mode === 'time' ? 'ttLast' : st?.laps === 1 ? 'lastKm' : 'lastLap', PRI.major); }
        break;
      case 'finish':
        if (mode !== 'race') break; // alone on the road nobody wins, ttFinish says how it went; the hunt ends with formaEnd, not on a line
        if (e.place === 1) want('win', PRI.must, { kart: e.kart });
        else if (isMine(e.kart)) want(e.place <= 3 ? 'finishGood' : e.place >= 6 ? 'finishBad' : 'finishMid', PRI.major);
        break;
      case 'formaGrab': want('formaGrab', isMine(e.kart) ? PRI.notable : PRI.minor, { kart: e.kart, sting: true }); break;
      case 'formaDrop': want('formaDrop', isMine(e.kart) ? PRI.notable : PRI.minor, { kart: e.kart, sting: isMine(e.kart) && views.length > 1 }); break;
      case 'formaLast': want('formaLast', PRI.major); break;
      case 'formaEnd': if (e.winner >= 0) want('formaWin', PRI.must, { kart: e.winner }); break;
      case 'ttLap':
        if (e.record && !e.first) want('ttRecord', PRI.major);
        else if (e.clean && !e.first && e.delta > 0.5 && rnd() < 0.5) want('ttSlow', PRI.minor);
        break;
      // the first run on a road beats nothing, so it is no record
      case 'ttFinish': want(e.record && e.delta !== null ? 'ttRecord' : 'ttDone', PRI.major); break;
      default: break;
    }
  }

  return {
    // mode: 'race' (a Gran Premio and a team one too), 'time' or 'forma'
    begin({ track: id, views: v, karts: list, mode: m = 'race' }) {
      track = id; views = [...(v ?? [])]; karts = [...(list ?? [])]; mode = m;
      for (const k of Object.keys(places)) delete places[k];
      queue = []; t = 0; until = 0; current = null; leadTimes = []; lastLapSaid = false; lastAny = 0;
      lastFamily = new Map(); lastPool = new Map(); used = new Map(); log.length = 0;
      idleWait = 18;
    },
    intro() {
      const pool = `intro.${track}`;
      if (!POOLS[pool]) return null;
      const a = clipOf(pool, draw(pool));
      const b = clipOf('introReply', draw('introReply'));
      const parts = [part(a), part(b, 0.3)];
      const total = parts.reduce((s, p) => s + p.dur + p.gap, 0);
      stats.said++; stats.seconds += total; stats.byPool[pool] = (stats.byPool[pool] ?? 0) + 1;
      current = { pri: MINOR, end: Infinity }; // the go cuts it off, if a skipped flyover got there first
      return { pool, pri: MINOR, cut: false, parts, dur: total };
    },
    closing() {
      // the verdict comes first: when the last kart home ends the race at once, how it went is still waiting here, and it beats a goodbye
      const verdict = queue.filter((q) => familyOf(q.pool) === 'finish' || q.pool === 'ttDone' || q.pool === 'ttRecord').sort((a, b) => b.pri - a.pri)[0];
      queue = [];
      if (verdict) {
        const said = say({ ...verdict, pri: PRI.major }, t, true);
        if (said) return said;
      }
      const c = clipOf('results', draw('results'));
      if (!c) return null;
      stats.said++; stats.seconds += dur(c.id); stats.byPool.results = (stats.byPool.results ?? 0) + 1;
      return { pool: 'results', pri: PRI.major, cut: true, parts: [part(c)], dur: dur(c.id) };
    },
    preview() {
      const c = clipOf('preview', 0);
      return { pool: 'preview', pri: MINOR, cut: true, parts: [part(c)], dur: dur(c.id) };
    },
    events(list, st) {
      if (Number.isFinite(st?.t)) t = st.t;
      for (const e of list) if (e) onEvent(e, st);
      // the sim only says who overtook: being overtaken has to be read from the place itself
      if (st?.phase === 'race') for (const i of views) {
        const place = st.karts?.[i]?.place;
        if (place > places[i] && !st.forma) want('passed', PRI.minor, { kart: i, sting: views.length > 1 });
        places[i] = place;
      }
    },
    // busy: the player is still talking, whatever this clock believes. A cue it returns has been said as far as the budget goes.
    next(now, busy = false) {
      t = now;
      const talking = busy || now < until;
      if (queue.length) {
        queue = queue.filter((q) => { const ok = now - q.at <= q.ttl; if (!ok) stats.dropped++; return ok; });
        queue.sort((a, b) => b.pri - a.pri || b.at - a.at);
        for (let i = 0; i < queue.length; i++) {
          const q = queue[i];
          const fam = familyOf(q.pool);
          const cool = COOL[fam] ?? 20;
          // two karts swapping the lead at every corner are not news at every corner
          if ((q.pri < PRI.major || q.pool === 'lead') && now - (lastFamily.get(fam) ?? -1e9) < cool) continue;
          if (q.pri >= CUT && talking) {
            if (current && now < current.end && current.pri <= MINOR) { queue.splice(i, 1); return say(q, now, true); }
            continue;
          }
          if (talking || now - until < GAP[q.pri]) continue;
          const talked = spoken(now);
          if (q.pri <= MINOR) {
            if (talked > TALK_MINOR) { queue.splice(i, 1); stats.dropped++; i--; continue; }
            // what has been heard a lot lately gets less and less likely
            const uses = (used.get(fam) ?? []).filter((x) => x > now - 150).length;
            if (uses && rnd() > 1 / (1 + uses * 0.35)) { queue.splice(i, 1); stats.dropped++; i--; continue; }
          }
          queue.splice(i, 1);
          return say(q, now, false);
        }
      }
      // a long silence: a word about where we are, or about nothing
      if (!talking && now > 6 && now - Math.max(until, lastAny) >= idleWait && spoken(now) < TALK_IDLE) {
        const here = `col.${track}`;
        const fresh = POOLS[here] && (!lastPool.has(here) || now - lastPool.get(here) > 60);
        return say({ pool: fresh && rnd() < 0.65 ? here : mode === 'time' ? 'ttIdle' : 'idle', pri: PRI.idle }, now, false);
      }
      return null;
    },
    get stats() { return stats; },
    get lang() { return lang; },
  };
}
