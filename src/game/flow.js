// The game's state machine: lobby -> pick -> vote -> loading -> race -> results -> podium. Pure: no DOM, no three, no
// clock of its own, so the rules are tested in node. src/main.js feeds it what phones and the TV do and step(dt), then reads
// drain() for what changed and menuFor(slot) for what each phone has to hear.
//
//   const flow = createFlow({ karts: KART_IDS, tracks: ['antelao', ...], regions: { antelao: 'cadore', ... } });
//   flow.join(0); flow.setOpts({ bots: 3 }); flow.go(); flow.pick(0, 'jeep', true); flow.step(dt); ...
import { TEAM_IDS, TEAM_SIZE } from '../data/teams.js';
import { WEATHER_CHOICES, drawWeather, raceWeather } from '../data/weather.js';

export const SLOTS = 4;
export const FIELD = 8;
export const RANDOM = 'random';
export const DIFFICULTIES = ['easy', 'medium', 'hard'];
export const LAPS = [2, 3, 5];
export const MODES = ['race', 'gp', 'time', 'teams', 'forma'];
export const FORMA_MIN_BOTS = 3;
export const VOICES = ['off', 'it', 'ro', 'id', 'en']; // the commentary's language; off is no key at all in the options
// Gran Premio points by place, the spec's table.
export const POINTS = [10, 8, 6, 5, 4, 3, 2, 1];

export const FLOW = {
  allReady: 0.9, // s between the last "ready" and the next screen, so everyone sees the line-up complete
  agree: 2.0,    // s the agreed track stays on show
  solo: 1.1,     // s a single ballot stays on show
  roll: 3.0,     // s the coin spins between differing votes
  land: 1.7,     // s it rests on the winner
  turns: 14,     // highlight steps of the spin, at least
  results: 9,    // s the results table stays before the podium takes the TV
  gpRandom: 3,   // tracks a Gran Premio draws when nobody chose
};

const freshTeams = () => Object.fromEntries(TEAM_IDS.map((team) => [team, { team, points: 0, wins: 0, best: 99, race: 0 }]));
const ease = (u) => 1 - (1 - u) ** 3;
const shuffled = (list, rng) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
// away: its phone is gone right now. expired: gone longer than the grace; during a game the seat still stands, see free().
const freshSeat = () => ({ present: false, away: false, expired: false, source: null, kart: null, ready: false, track: null, lock: false, team: null, go: false });

export function createFlow({ karts, tracks, regions = {}, rng = Math.random, rules = FLOW, opts = {}, secret = [] } = {}) {
  let trackIds = [...tracks];
  // secret: the unlocked family karts. A player may pick them; the bots' pool below is `karts` alone, so a race without them is the race it always was.
  let extra = [...secret];
  const pickable = () => [...karts, ...extra];
  const S = {
    phase: 'lobby',
    seats: Array.from({ length: SLOTS }, freshSeat),
    opts: { difficulty: 'medium', bots: FIELD - 1, laps: 3, mode: 'race', ...opts },
    vote: { phase: 'open', t: 0, pick: null, spin: null, landed: false, winner: -1, candidates: [], steps: 0, from: 0, length: 0 },
    gp: null,       // { tracks: [ids], index, table: { key: {...} }, finished }
    list: [],       // the Gran Premio being composed on the vote screen, in the order picked
    track: null,
    field: null,    // the entrants of the race being run, in grid order
    results: null,
    raceNo: 0,
    readyT: null,
    resultsT: 0,
    turn: 0,        // counts the screens: a press from a screen that has gone by does not count on the next one
  };
  const out = [];
  const emit = (e) => { out.push(e); };

  const present = () => S.seats.map((s, i) => (s.present ? i : -1)).filter((i) => i >= 0);
  const active = () => S.seats.map((s, i) => (s.present && !s.away ? i : -1)).filter((i) => i >= 0);
  const setPhase = (phase) => { if (S.phase !== phase) { S.phase = phase; S.turn++; for (const s of S.seats) s.go = false; emit({ type: 'phase', phase }); } };
  // The phones that are here. A screen waits for these: a keyboard seat is waited for only with no phone at the table, or
  // a key pressed once on the Mac would have everyone get up from the sofa.
  const phones = () => S.seats.map((s, i) => (s.present && !s.away && s.source === 'pad' ? i : -1)).filter((i) => i >= 0);
  const waited = () => (phones().length ? phones() : active());
  const atTheEnd = () => S.phase === 'results' || S.phase === 'podium';
  const moveOn = () => (api.advanceKind === 'podium' ? api.toPodium() : api.next(api.advanceKind));
  // Everyone here has pressed Continue. Nobody here: nobody is pressing either, and the screen stays.
  function checkAdvance() {
    const who = phones();
    return atTheEnd() && who.length > 0 && who.every((i) => S.seats[i].go) && moveOn();
  }
  const clearVote = () => { Object.assign(S.vote, { phase: 'open', t: 0, pick: null, spin: null, landed: false, winner: -1, candidates: [], steps: 0, from: 0, length: 0 }); };
  const clearBallots = () => { for (const s of S.seats) { s.track = null; s.lock = false; } };
  const clearPicks = () => { for (const s of S.seats) { s.kart = null; s.ready = false; } };
  // A team championship is a Gran Premio with two sides: everything about the list of tracks and the table is the same.
  const teamMode = () => S.opts.mode === 'teams';
  const gpMode = () => S.opts.mode === 'gp' || teamMode();
  const onTeam = (team) => S.seats.map((s, i) => (s.present && s.team === team ? i : -1)).filter((i) => i >= 0);
  // Whoever has no side yet takes the smaller one, so two phones in a row end up facing each other.
  function balanceTeams() {
    if (!teamMode()) return;
    for (const s of S.seats) {
      if (!s.present || s.team) continue;
      s.team = onTeam(TEAM_IDS[1]).length < onTeam(TEAM_IDS[0]).length ? TEAM_IDS[1] : TEAM_IDS[0];
    }
  }
  const newGp = (tracks) => ({ tracks: [...tracks], index: 0, table: {}, finished: false, ...(teamMode() ? { teams: freshTeams() } : {}) });

  function enterPick() {
    for (const s of S.seats) s.ready = false;
    S.readyT = null;
    setPhase('pick');
  }
  function enterVote() {
    clearBallots();
    clearVote();
    S.list = [];
    setPhase('vote');
  }
  function skyOfRace() {
    const wx = S.opts.weather ?? 'clear';
    if (S.opts.mode === 'time') return null;
    if (wx !== 'surprise') return raceWeather(wx, S.opts.night);
    const d = drawWeather(rng);
    return d && S.opts.night ? { ...d, night: true } : d || raceWeather('clear', S.opts.night);
  }
  function enterLoading(track) {
    S.track = track;
    // the sky of this race: a surprise is drawn again each time; against the clock it is always clear, or two times would not compare
    S.raceWeather = skyOfRace();
    S.results = null;
    setPhase('loading');
  }

  // ---------- the vote ----------
  function spinAt(t) {
    const v = S.vote;
    if (!v.candidates.length) return v.pick;
    return v.candidates[(v.from + Math.floor(v.steps * ease(Math.min(1, t / rules.roll)) + 1e-9)) % v.candidates.length];
  }
  function startRoll(cands) {
    const v = S.vote;
    v.candidates = cands;
    v.from = rng() < 0.5 ? 0 : cands.length - 1;
    const target = cands.indexOf(v.pick);
    v.steps = rules.turns + (((target - v.from - rules.turns) % cands.length) + cands.length) % cands.length;
    v.phase = 'roll';
    v.length = rules.roll + rules.land;
    v.spin = spinAt(0);
    emit({ type: 'vote' });
  }
  const randomTrack = () => trackIds[Math.min(trackIds.length - 1, Math.floor(rng() * trackIds.length))];
  // Everyone at the TV has locked: the same card goes straight through, differing cards spin a coin between them; a
  // random ballot stands for any track.
  function closeVote() {
    const v = S.vote;
    if (v.phase !== 'open') return;
    const votes = [];
    for (const i of active()) if (S.seats[i].lock && S.seats[i].track) votes.push({ slot: i, id: S.seats[i].track });
    v.t = 0; v.winner = -1;
    if (!votes.length) return;
    const same = votes.every((b) => b.id === votes[0].id);
    if (same && votes[0].id !== RANDOM) {
      v.pick = votes[0].id; v.spin = null; v.candidates = [];
      v.phase = 'agree'; v.landed = true;
      v.length = votes.length > 1 ? rules.agree : rules.solo;
      emit({ type: 'vote' });
      return;
    }
    const w = same ? votes[0] : votes[Math.floor(rng() * votes.length) % votes.length];
    v.winner = same ? -1 : w.slot;
    v.pick = w.id === RANDOM ? randomTrack() : w.id;
    const any = votes.some((b) => b.id === RANDOM);
    const cands = any ? [...trackIds] : trackIds.filter((id) => votes.some((b) => b.id === id));
    if (cands.length <= 1) {
      v.spin = null; v.candidates = []; v.phase = 'agree'; v.landed = true; v.length = rules.solo;
      emit({ type: 'vote' });
      return;
    }
    startRoll(cands);
  }
  function voteReady() {
    const a = waited();
    return a.length > 0 && a.every((i) => S.seats[i].lock);
  }

  // ---------- Gran Premio ----------
  const gpMin = () => Math.min(2, trackIds.length);
  function gpToggle(id) {
    if (!gpMode() || S.phase !== 'vote' || !trackIds.includes(id)) return false;
    const at = S.list.indexOf(id);
    if (at >= 0) S.list.splice(at, 1); else S.list.push(id);
    emit({ type: 'gpList' });
    return true;
  }
  function gpPreset(preset) {
    if (!gpMode() || S.phase !== 'vote') return false;
    if (preset === 'all') S.list = [...trackIds];
    else if (preset === 'clear') S.list = [];
    else if (/^random\d+$/.test(preset)) S.list = shuffled(trackIds, rng).slice(0, Math.min(trackIds.length, Number(preset.slice(6))));
    else S.list = trackIds.filter((id) => regions[id] === preset);
    emit({ type: 'gpList' });
    return true;
  }
  function gpStart() {
    if (!gpMode() || S.phase !== 'vote') return false;
    if (S.list.length < gpMin()) {
      // nobody chose enough: the draw fills it up
      const rest = shuffled(trackIds.filter((id) => !S.list.includes(id)), rng);
      const want = Math.min(trackIds.length, Math.max(gpMin(), rules.gpRandom));
      while (S.list.length < want && rest.length) S.list.push(rest.shift());
    }
    if (!S.list.length) return false;
    S.gp = newGp(S.list);
    S.field = null;
    enterLoading(S.gp.tracks[0]);
    return true;
  }

  // ---------- the field ----------
  // Bots take the karts nobody chose first, in a shuffled order. Humans start in the back half, not dead last: a good
  // driver from last on the grid against the hardest bots rarely gets back through the pack.
  function buildField() {
    // A phone gone a moment ago races: the autopilot has its kart and it takes it back on return. One past its grace sits this
    // one out, with its seat still there for the next; with every phone gone, the seats still make a field.
    const inGrace = present().filter((i) => !S.seats[i].expired);
    const seated = inGrace.length ? inGrace : present();
    balanceTeams();
    const teams = teamMode();
    const humans = seated.map((slot) => ({ slot, human: true, kart: S.seats[slot].kart || karts[slot % karts.length], ...(teams ? { team: S.seats[slot].team } : {}) }));
    const taken = new Set(humans.map((h) => h.kart));
    const wanted = Math.max(0, Math.min(S.opts.bots, FIELD - humans.length));
    // two a side whatever the lobby says about bots: those who fill a side race for it, the rest for nobody
    // alone there is nobody to chase, or to be chased by: a hunt with one person gets bots whatever the lobby says
    const hunt = S.opts.mode === 'forma' && humans.length === 1 ? Math.max(wanted, FORMA_MIN_BOTS) : wanted;
    const nBots = S.opts.mode === 'time' ? 0 : teams ? Math.max(wanted, TEAM_SIZE * TEAM_IDS.length - humans.length) : hunt; // against the clock you are alone
    const pool = [...shuffled(karts.filter((k) => !taken.has(k)), rng), ...shuffled(karts, rng), ...shuffled(karts, rng)];
    let bots = pool.slice(0, nBots).map((kart) => ({ slot: -1, human: false, kart }));
    if (teams) {
      const open = TEAM_IDS.flatMap((team) => Array(Math.max(0, TEAM_SIZE - humans.filter((h) => h.team === team).length)).fill(team));
      bots = shuffled(bots.map((b, n) => ({ ...b, team: open[n] ?? null })), rng);
    }
    const at = Math.max(0, bots.length - 2);
    return [...bots.slice(0, at), ...humans, ...bots.slice(at)];
  }
  // A Gran Premio keeps its field, but someone who sat the first race out and is here now takes a bot's place, on their side.
  function admitLate(field) {
    for (const slot of active()) {
      if (field.some((p) => p.human && p.slot === slot)) continue;
      const seat = S.seats[slot], teams = teamMode();
      let at = field.findLastIndex((p) => !p.human && (!teams || p.team === seat.team));
      if (at < 0) at = field.findLastIndex((p) => !p.human);
      if (at < 0 && field.length >= FIELD) continue;
      const entry = { slot, human: true, kart: seat.kart || karts[slot % karts.length], ...(teams ? { team: seat.team } : {}) };
      if (at < 0) field.push(entry); else field[at] = entry;
    }
  }
  const keyOf = (p) => (p.human ? `p${p.slot}` : `b${p.kart}`);
  // Between Gran Premio races the grid follows the table upside down: the last of the table starts in front.
  function gpGrid(field) {
    const table = S.gp?.table;
    if (!table || !Object.keys(table).length) return field;
    return [...field].sort((a, b) => (table[keyOf(a)]?.points ?? 0) - (table[keyOf(b)]?.points ?? 0));
  }

  const api = {
    get state() { return S; },
    get phase() { return S.phase; },
    get tracks() { return trackIds; },
    set tracks(list) {
      trackIds = [...list];
      emit({ type: 'tracks' });
    },
    get seats() { return S.seats; },
    get opts() { return S.opts; },
    get weather() { return S.raceWeather ?? null; }, // { kind, night } of the race being run, null for a plain one
    present,
    active,
    // Who is here right now: a screen waiting for people waits for these and nobody else.
    online: active,
    phones,
    isOnline: (slot) => !!S.seats[slot]?.present && !S.seats[slot].away,
    get humans() { return present().length; },
    // tools: straight to the loading screen of a track, with the seats as they are
    quick(track) { S.track = track; S.raceWeather = skyOfRace(); S.results = null; S.phase = 'loading'; if (teamMode()) S.gp = newGp([track]); },
    // A track that would not load: it leaves the list and the vote opens again.
    failed(track) {
      trackIds = trackIds.filter((id) => id !== track);
      if (!trackIds.length) return false;
      S.phase = 'race';
      S.gp = null;
      enterVote();
      return true;
    },
    get gpMin() { return gpMin(); },
    get gpMode() { return gpMode(); },
    get teamMode() { return teamMode(); },

    drain() { return out.splice(0); },

    // ---------- seats ----------
    join(slot, source = 'pad') {
      const s = S.seats[slot];
      if (!s) return false;
      const back = s.present;
      s.present = true; s.away = false; s.expired = false; s.source = source;
      balanceTeams();
      emit({ type: back ? 'back' : 'join', slot });
      return true;
    },
    // The phone went quiet: the seat stays, it stops holding up the menus. A ballot in play is undone only if the
    // verdict is not on yet.
    leave(slot) {
      const s = S.seats[slot];
      if (!s || !s.present) return false;
      s.away = true;
      s.go = false; // only a phone that is here counts, and one that left is not waited for
      emit({ type: 'leave', slot });
      checkAdvance();
      if (S.phase === 'pick' && S.readyT === null) api.checkPicks();
      if (S.phase === 'vote' && !gpMode() && voteReady()) closeVote();
      return true;
    },
    // The grace ran out. Nothing changes for the game: the kart, the side and the points wait for that phone or a new one.
    expire(slot) {
      const s = S.seats[slot];
      if (!s?.present || !s.away) return false;
      s.expired = true;
      emit({ type: 'expired', slot });
      return true;
    },
    // Only the lobby really empties a seat. Everywhere else a kart, a results row or a line of the table has its name on it,
    // and a Gran Premio's next race would hand the kart to nobody, so the seat stands until the game comes back here.
    free(slot) {
      const s = S.seats[slot];
      if (!s || !s.present) return false;
      if (S.phase !== 'lobby') return false;
      S.seats[slot] = freshSeat();
      emit({ type: 'free', slot });
      return true;
    },

    // ---------- lobby ----------
    setOpts(fields = {}) {
      // the sky can still change on the vote, once you know the road; everything else stays as the lobby left it
      let sky = false;
      if (S.phase === 'lobby' || S.phase === 'vote') {
        if (WEATHER_CHOICES.includes(fields.weather) && (S.opts.weather ?? 'clear') !== fields.weather) { if (fields.weather === 'clear') delete S.opts.weather; else S.opts.weather = fields.weather; sky = true; }
        if (typeof fields.night === 'boolean' && !!S.opts.night !== fields.night) { if (fields.night) S.opts.night = true; else delete S.opts.night; sky = true; }
      }
      if (S.phase !== 'lobby') { if (sky) emit({ type: 'opts' }); return sky; }
      let changed = sky;
      if (DIFFICULTIES.includes(fields.difficulty) && S.opts.difficulty !== fields.difficulty) { S.opts.difficulty = fields.difficulty; changed = true; }
      if (Number.isInteger(fields.bots)) {
        const b = Math.max(0, Math.min(FIELD - 1, fields.bots));
        if (S.opts.bots !== b) { S.opts.bots = b; changed = true; }
      }
      if (LAPS.includes(fields.laps) && S.opts.laps !== fields.laps) { S.opts.laps = fields.laps; changed = true; }
      if (MODES.includes(fields.mode) && S.opts.mode !== fields.mode) { S.opts.mode = fields.mode; changed = true; balanceTeams(); }
      if (VOICES.includes(fields.voice) && (S.opts.voice ?? 'off') !== fields.voice) { if (fields.voice === 'off') delete S.opts.voice; else S.opts.voice = fields.voice; changed = true; }
      if (changed) emit({ type: 'opts' });
      return changed;
    },
    // Each seat says for itself which side it is on. A full side takes you in and hands its last seat over to yours: four
    // people on a sofa must be able to change sides without anybody stepping out first.
    setTeam(slot, team) {
      const s = S.seats[slot];
      if (S.phase !== 'lobby' || !teamMode() || !s?.present || !TEAM_IDS.includes(team) || s.team === team) return false;
      const there = onTeam(team);
      if (there.length >= TEAM_SIZE) S.seats[there.at(-1)].team = s.team;
      s.team = team;
      emit({ type: 'team', slot });
      return true;
    },
    // The start button. With nobody seated the keyboard takes the first seat: one person at a Mac can always play.
    go() {
      if (S.phase !== 'lobby') return false;
      if (!present().length) api.join(0, 'keyboard');
      S.gp = null;
      enterPick();
      return true;
    },

    // ---------- kart pick ----------
    pick(slot, kart, ready = false) {
      const s = S.seats[slot];
      if (S.phase !== 'pick' || !s?.present || !pickable().includes(kart)) return false;
      s.kart = kart; s.ready = !!ready;
      emit({ type: 'pick', slot });
      api.checkPicks();
      return true;
    },
    // A click on the TV: the first seat not ready takes that kart.
    pickFromTV(kart) {
      const slot = present().find((i) => !S.seats[i].ready);
      if (slot === undefined) return false;
      return api.pick(slot, kart, true);
    },
    checkPicks() {
      // with every phone gone the seats count, or a click on the TV could never move this screen on
      const a = waited().length ? waited() : present();
      const all = a.length > 0 && a.every((i) => S.seats[i].ready && S.seats[i].kart);
      S.readyT = all ? (S.readyT ?? 0) : null;
      return all;
    },

    // ---------- track vote ----------
    vote(slot, track, lock = false) {
      const s = S.seats[slot];
      if (S.phase !== 'vote' || !s?.present || S.vote.phase !== 'open') return false;
      if (track !== RANDOM && !trackIds.includes(track)) return false;
      s.track = track;
      if (gpMode()) {
        // a phone composes the list by confirming cards; the random card says "enough, off we go"
        if (lock) {
          if (track === RANDOM) gpStart(); else gpToggle(track);
          if (S.phase === 'vote') emit({ type: 'unlock', slot });
        }
        s.lock = false;
        emit({ type: 'ballot', slot });
        return true;
      }
      s.lock = !!lock;
      emit({ type: 'ballot', slot });
      if (voteReady()) closeVote();
      return true;
    },
    // A click on the TV decides at once, for a table with no phones or tired of waiting.
    forceTrack(track) {
      if (S.phase !== 'vote' || S.vote.phase !== 'open') return false;
      if (track !== RANDOM && !trackIds.includes(track)) return false;
      const v = S.vote;
      v.t = 0; v.winner = -1;
      if (track === RANDOM && trackIds.length > 1) {
        v.pick = randomTrack();
        startRoll([...trackIds]);
        return true;
      }
      v.pick = track === RANDOM ? trackIds[0] : track;
      v.spin = null; v.candidates = []; v.phase = 'agree'; v.landed = true; v.length = rules.solo;
      emit({ type: 'vote' });
      return true;
    },
    gpToggle,
    gpPreset,
    gpStart,

    // ---------- time ----------
    step(dt) {
      if (S.phase === 'pick' && S.readyT !== null) {
        S.readyT += dt;
        if (S.readyT >= rules.allReady) { S.readyT = null; enterVote(); }
      }
      if (S.phase === 'vote' && S.vote.phase !== 'open') {
        const v = S.vote;
        v.t += dt;
        if (v.phase === 'roll') {
          const spin = v.t >= rules.roll ? v.pick : spinAt(v.t);
          if (spin !== v.spin) { v.spin = spin; emit({ type: 'spin', track: spin }); }
          if (!v.landed && v.t >= rules.roll) { v.landed = true; emit({ type: 'landed', track: v.pick }); }
        }
        if (v.t >= v.length) { v.phase = 'done'; enterLoading(v.pick); }
      }
      if (S.phase === 'results' && S.resultsT > 0) {
        S.resultsT -= dt;
        if (S.resultsT <= 0) { S.resultsT = 0; if (!api.gpMore) api.toPodium(); }
      }
    },

    // ---------- the race ----------
    // The players for createRace, in grid order, built once per race. A Gran Premio keeps its field across the races.
    field() {
      if (S.gp?.field) { admitLate(S.gp.field); return (S.field = gpGrid(S.gp.field)); }
      const field = buildField();
      if (S.gp) S.gp.field = field;
      S.field = field;
      return S.field;
    },
    loaded() { if (S.phase === 'loading') { S.raceNo++; setPhase('race'); } },
    // rows: the race's karts, { i, slot, kart, human, place, time (null: did not finish), bestLap }. Points and the table
    // are worked out here so that a Gran Premio survives the race object.
    raceDone(rows) {
      if (S.phase !== 'race') return null;
      const sorted = [...rows].sort((a, b) => a.place - b.place).map((r) => ({ ...r, points: S.gp ? (POINTS[r.place - 1] ?? 0) : 0 }));
      S.results = { track: S.track, rows: sorted, gp: null };
      if (S.gp) {
        for (const r of sorted) {
          const key = keyOf(r);
          const e = S.gp.table[key] ||= { key, slot: r.slot, kart: r.kart, human: r.human, points: 0, wins: 0, best: 99, last: 0, ...(r.team ? { team: r.team } : {}) };
          e.points += r.points; e.last = r.place;
          if (r.place === 1) e.wins++;
          e.best = Math.min(e.best, r.place);
        }
        if (S.gp.teams) {
          // a bot racing for nobody takes its place, and its points go to no side
          for (const T of Object.values(S.gp.teams)) { T.race = 0; T.best = 99; }
          for (const r of sorted) {
            const T = S.gp.teams[r.team];
            if (!T) continue;
            T.points += r.points; T.race += r.points; T.best = Math.min(T.best, r.place);
            if (r.place === 1) T.wins++;
          }
        }
        S.gp.index++;
        S.gp.finished = S.gp.index >= S.gp.tracks.length;
        S.results.gp = api.gpTable();
        // first of the final table and a person: main.js counts it towards the family karts. Among teams, a person on the side that won
        const champ = S.gp.teams ? api.teamTable()[0].members.find((m) => m.human) : S.results.gp[0]?.human ? S.results.gp[0] : null;
        if (S.gp.finished && champ) emit({ type: 'gpWon', slot: champ.slot });
      }
      S.resultsT = (S.gp && !S.gp.finished) || S.opts.mode === 'time' ? 0 : rules.results; // a time trial has no podium: its times stay on show
      setPhase('results');
      return S.results;
    },
    // The karts a player can pick now; announce: the kart just won, for the podium and the phones, until the evening moves on.
    get pickable() { return pickable(); },
    set extra(list) { extra = [...list]; },
    announce(id) { S.unlocked = id; },
    // The two sides, leader first, each with its two karts. Level on points: more wins, then who came first in the last race,
    // which two karts cannot share, so there is always a winner.
    teamTable() {
      if (!S.gp?.teams) return [];
      const all = api.gpTable();
      return Object.values(S.gp.teams).map((T) => ({ ...T, members: all.filter((e) => e.team === T.team) }))
        .sort((a, b) => b.points - a.points || b.wins - a.wins || a.best - b.best).map((T, n) => ({ ...T, rank: n + 1 }));
    },
    gpTable() {
      if (!S.gp) return [];
      return Object.values(S.gp.table).sort((a, b) => b.points - a.points || b.wins - a.wins || a.best - b.best || a.last - b.last).map((e, n) => ({ ...e, rank: n + 1 }));
    },
    get gpMore() { return !!S.gp && !S.gp.finished; },
    get nextTrack() { return S.gp && !S.gp.finished ? S.gp.tracks[S.gp.index] : null; },
    // The three on the steps: from the table of a finished Gran Premio, otherwise from the race.
    top3() {
      if (S.gp?.finished) return api.gpTable().slice(0, 3).map((e, n) => ({ ...e, place: n + 1 }));
      return (S.results?.rows || []).slice(0, 3);
    },
    toPodium() {
      if (S.phase !== 'results' || api.gpMore || S.opts.mode === 'time') return false;
      S.resultsT = 0;
      setPhase('podium');
      return true;
    },
    // rematch | track | lobby, from the results and the podium, by phone or TV. In a Gran Premio under way, rematch and
    // track both mean the next race: the order was agreed before it started.
    // turn: the screen a phone saw, when it says; a choice from a screen gone by does not count on the next one.
    next(kind, turn) {
      if (S.phase !== 'results' && S.phase !== 'podium') return false;
      if (turn !== undefined && turn !== S.turn) return false;
      if (S.unlocked) S.unlocked = null;
      if (kind === 'lobby') {
        S.gp = null; S.list = []; S.track = null; S.results = null; S.field = null; S.resultsT = 0;
        clearPicks(); clearBallots(); clearVote();
        // a phone past its grace gives its seat up here; one that only blinked keeps it until its grace ends
        S.seats.forEach((s, i) => { if (s.present && s.expired) S.seats[i] = freshSeat(); });
        setPhase('lobby');
        return true;
      }
      if (api.gpMore) {
        enterLoading(api.nextTrack);
        return true;
      }
      // a rematch of a finished championship, sides or not, is the whole list again and not its last track on its own
      if (kind === 'rematch' && S.gp) { S.gp = newGp(S.gp.tracks); enterLoading(S.gp.tracks[0]); return true; }
      S.gp = null;
      if (kind === 'rematch') { enterLoading(S.track); return true; }
      if (kind === 'track') { enterVote(); return true; }
      return false;
    },
    // What the green way forward is right now: the next race of a championship, the podium that comes by itself anyway, and
    // from there, or from a time trial's table, the same again. The keyboard, the phones and "skip the wait" all take this one.
    get advanceKind() { return S.phase === 'results' && !api.gpMore && S.opts.mode !== 'time' ? 'podium' : 'rematch'; },
    // A phone says it is done with this screen (on) or takes it back. turn: the screen it saw.
    advance(slot, on = true, turn = S.turn) {
      const s = S.seats[slot];
      if (!atTheEnd() || turn !== S.turn || !s?.present || s.away || s.source !== 'pad' || s.go === !!on) return false;
      s.go = !!on;
      emit({ type: 'advance', slot });
      checkAdvance();
      return true;
    },
    // Any phone at the table need not wait for the rest: after a race every phone has the same ways out.
    skipWait(slot, turn = S.turn) {
      const s = S.seats[slot];
      if (!atTheEnd() || turn !== S.turn || !s?.present || s.away || s.source !== 'pad') return false;
      return moveOn();
    },
    // Who has pressed, of whom: for the TV.
    advanceState() { const of = phones(); return { ready: of.filter((i) => S.seats[i].go), of }; },
    // Back out of a race in progress (the pause menu).
    quit() {
      if (S.phase !== 'race' && S.phase !== 'loading') return false;
      S.phase = 'results';
      return api.next('lobby');
    },
    restart() {
      if (S.phase !== 'race') return false;
      S.phase = 'loading';
      emit({ type: 'phase', phase: 'loading' });
      return true;
    },

    // The start of the evening over: the server came back with an empty room, and no seat here means anything now.
    reset() {
      S.phase = 'results';
      api.next('lobby');
      S.seats.forEach((s, i) => { if (s.present) { S.seats[i] = freshSeat(); emit({ type: 'free', slot: i }); } });
    },

    // ---------- what a phone hears ----------
    // The lowest phone connected decides for the room, as in server/room.js: slot 0 with a dead battery locks nobody out.
    authority() { return S.seats.findIndex((s) => s.present && !s.away && s.source === 'pad'); },
    // A phone stays on 'results' under the TV's podium of a single race: there its buttons (rematch, change track) are
    // still the ones that make sense; the phone's podium screen only offers the way back to the lobby.
    phoneFor() {
      if (S.phase === 'podium' && !S.gp) return 'results';
      return S.phase;
    },
    menuFor(slot, { rows = null } = {}) {
      const seat = S.seats[slot] || freshSeat();
      const others = (key, flag) => S.seats.map((s, i) => (i !== slot && s.present ? { slot: i, [key]: s[key], [flag]: s[flag] } : null)).filter(Boolean);
      const side = teamMode() ? { team: seat.team } : {};
      switch (S.phase) {
        case 'lobby': return { opts: { ...S.opts }, edit: true, ...(teamMode() ? { team: seat.team, lineup: S.seats.map((s, i) => (s.present ? { slot: i, team: s.team } : null)).filter(Boolean) } : {}) };
        case 'pick': return { karts: pickable(), kart: seat.kart, ready: seat.ready, others: others('kart', 'ready'), ...side };
        case 'vote': {
          const v = S.vote;
          return { tracks: [...trackIds], track: seat.track, lock: seat.lock, others: others('track', 'lock'), spin: v.phase === 'roll' && !v.landed ? v.spin : null, pick: v.phase !== 'open' ? v.pick : null, landed: !!v.landed, ...side, ...(gpMode() ? { gp: { list: [...S.list], races: S.list.length >= gpMin() && S.list.length ? S.list.length : Math.min(trackIds.length, Math.max(gpMin(), rules.gpRandom)) } } : {}), ...(S.opts.mode === 'time' ? {} : { weather: S.opts.weather ?? 'clear', night: !!S.opts.night }) };
        }
        case 'results':
        case 'podium': {
          const row = (rows || S.results?.rows || []).find((r) => r.slot === slot);
          const table = api.teamTable();
          const score = table.length ? { team: row?.team ?? seat.team, score: Object.fromEntries(table.map((T) => [T.team, T.points])), won: S.gp.finished ? table[0].team : null } : {};
          const here = phones();
          const advance = { turn: S.turn, mine: !!seat.go, ready: here.filter((i) => S.seats[i].go).length, of: here.length, kind: api.advanceKind, more: !api.gpMore, ...(api.nextTrack ? { next: api.nextTrack } : {}) };
          return { place: row?.place ?? 0, time: row?.time ?? null, edit: slot === api.authority(), advance, ...(row?.tt ? { tt: row.tt } : {}), ...(row?.forma ? { forma: row.forma } : {}),...(S.unlocked !== undefined ? { unlocked: S.unlocked } : {}), ...score };
        }
        default: return {};
      }
    },
  };
  return api;
}

// What the phones feel for a batch of sim events: [{ slot, kind, ... }]. The karts of the race: state.karts.
export function padFx(events, karts) {
  const out = [];
  const to = (i, msg) => { const s = karts[i]?.slot; if (s >= 0 && karts[i].human) out.push({ slot: s, ...msg }); };
  for (const e of events) {
    switch (e.type) {
      case 'boxTake':
        if (e.item) to(e.kart, { kind: 'roulette', item: e.item, ms: 1200 }); else to(e.kart, { kind: 'box' });
        break;
      case 'hit': if (e.kind === 'spin' || e.kind === 'tumble' || e.kind === 'steal') to(e.kart, { kind: 'hit' }); else to(e.kart, { kind: 'bump' }); break;
      case 'bump': to(e.a, { kind: 'bump' }); to(e.b, { kind: 'bump' }); break;
      case 'splash': to(e.kart, { kind: 'bump' }); break;
      case 'thunder': for (let i = 0; i < karts.length; i++) to(i, { kind: 'buzz' }); break;
      case 'wall': to(e.kart, { kind: 'bump' }); break;
      case 'traffic': if (e.kind === 'scrape' || e.kind === 'scatter') to(e.kart, { kind: 'bump' }); break;
      case 'boost': to(e.kart, { kind: 'boost', tier: e.tier || 1 }); break;
      // charging a drift is felt in the hand, and so is coming down from a jump
      case 'driftStart': to(e.kart, { kind: 'drift' }); break;
      case 'driftTier': if (e.tier > 0) to(e.kart, { kind: 'charge', tier: e.tier }); break;
      case 'land': to(e.kart, { kind: 'land', big: (e.force || 0) > 10 }); break;
      case 'itemUse': to(e.kart, { kind: 'use' }); break;
      case 'shield': to(e.kart, { kind: 'shield' }); break;
      case 'lap': to(e.kart, { kind: 'lap' }); break;
      case 'lastLap': to(e.kart, { kind: 'lastLap' }); break;
      case 'finish': to(e.kart, { kind: 'finish', place: e.place }); break;
      case 'rescue': to(e.kart, { kind: 'buzz' }); break;
      case 'steal': to(e.kart, { kind: 'box' }); break;
      case 'hazardNear': if (e.kind === 'frana') to(e.kart, { kind: 'rumble' }); break;
      case 'bite': to(e.kart, { kind: 'bump' }); break;
      case 'ttSplit': if (e.delta < 0) to(e.kart, { kind: 'box' }); break;
      case 'ttLap': if (e.record) to(e.kart, { kind: 'shield' }); break;
      case 'formaGrab': to(e.kart, { kind: 'formaGrab' }); break;
      case 'formaDrop': to(e.kart, { kind: 'formaDrop' }); break;
      case 'formaFetch': to(e.kart, { kind: 'buzz' }); break;
      case 'formaTick': if (e.n <= 5) for (let i = 0; i < karts.length; i++) to(i, { kind: 'bump' }); break;
      case 'formaLast': for (let i = 0; i < karts.length; i++) to(i, { kind: 'lastLap', forma: true }); break;
      // the whole road feels it, every phone in the race
      case 'disaster': if (e.phase !== 'end') for (let i = 0; i < karts.length; i++) to(i, { kind: 'rumble' }); break;
      default: break;
    }
  }
  return out;
}

// One { place, lap, laps, item, charges, boost } per human kart, with no opinion on when to send it.
export function hudOf(k, laps) {
  return {
    place: k.place,
    lap: Math.min(laps, k.lap + 1),
    laps,
    item: k.rouletteT > 0 ? null : k.item,
    charges: k.itemCharges || 0,
    boost: k.boostT > 0,
    ...(k.autoHome ? { auto: true } : {}),
  };
}

// Sends a phone its HUD about 5 times a second, and at once when something on it changed.
export function createHudFeed({ every = 0.2 } = {}) {
  const last = new Map();
  return {
    reset() { last.clear(); },
    forget(slot) { last.delete(slot); },
    due(slot, hud, now) {
      const key = `${hud.place}|${hud.lap}|${hud.item}|${hud.charges}|${hud.boost}|${hud.forma?.mine}|${hud.forma?.loose}`;
      const e = last.get(slot);
      if (e && e.key === key && now - e.at < every) return false;
      last.set(slot, { key, at: now });
      return true;
    },
  };
}

// A phone steering by tilt takes its straight ahead from the hand until just before GO: a player settles during the countdown,
// not during the flyover, and a wheel already turned at GO counts as turned. The TV keeps saying so, and a phone that misses
// the last of it, or comes back in the middle, is not left waiting: it goes by the next one, or lets go by itself (pad.js).
export const HOLD_LEAD = 0.4; // seconds before GO
export const holdsWheel = (flying, st) => flying || (st.phase === 'countdown' && st.countdown > HOLD_LEAD);
export function createHoldFeed({ every = 0.3 } = {}) {
  let on = false, at = 0;
  return {
    reset() { on = false; },
    // Whether to tell the phones now: every so often while it holds, and once when it ends.
    due(hold, now) {
      if (!hold && !on) return false;
      if (hold && on && now - at < every) return false;
      on = hold;
      at = now;
      return true;
    },
  };
}

// What the autopilot does with the kart of a player whose phone is away: the bot's brain keeps it on the road and moving, a
// little under race pace, with no turbo and no item: those stay for the player, and it is not there to win their race for them.
export const AWAY_CRUISE = 0.86; // of the kart's top speed
export const awayDrive = (a) => ({ steer: a.steer, throttle: a.throttle, item: false, drift: false });

// The seats the TV has to say are offline: [{ slot, left }], left in whole seconds, null once past the grace.
// since[slot]: when it left, on the same clock as now.
export function offlineList(seats, since, now, graceMs) {
  const out = [];
  seats.forEach((s, slot) => {
    if (!s.present || !s.away || s.source !== 'pad') return;
    const left = s.expired ? 0 : Math.ceil((graceMs - (now - (since[slot] ?? now))) / 1000);
    out.push({ slot, left: left > 0 ? left : null });
  });
  return out;
}

// The sim's karts as results rows; a kart still out on the road gets no time.
export function resultRows(karts) {
  return karts.map((k) => ({
    i: k.i, slot: k.slot, kart: k.kart, human: k.human, place: k.place,
    time: k.finished ? k.finishT : null, bestLap: k.bestLapT ?? null, ...(k.team ? { team: k.team } : {}),
  })).sort((a, b) => a.place - b.place);
}

// What the two sides would have if the race ended now, on top of the table so far: the number the HUD and the phones show.
export function teamScore(karts, base = null) {
  const out = Object.fromEntries(TEAM_IDS.map((id) => [id, base?.[id]?.points ?? 0]));
  for (const k of karts) if (k.team) out[k.team] += POINTS[k.place - 1] ?? 0;
  return out;
}
