// The painted side of the menus: inline SVG in the game's cartoon language, flat fills with one soft shade and a dark ink
// line, everything rounded. No files: a backdrop for every screen, a picture for every track card, the logo, the helmets of
// the four seats and the chunky little props.
export const INK = '#1d1f2b';

// A small seeded generator: the same forest on every visit.
const rnd = (seed) => {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
const f1 = (n) => n.toFixed(1);
// Ids are unique per picture: a gradient defined inside a hidden screen paints nothing for a visible one that points at it.
let uid = 0;

// Layered rounded cones with an ink line, like the ones in the game. h: height, c: [main, shade].
export function pine(x, y, h, c = ['#3f8a52', '#2f6f46'], line = 2.4) {
  const w = h * 0.34, tiers = 3;
  let s = `<rect x="${f1(x - h * 0.03)}" y="${f1(y - h * 0.14)}" width="${f1(h * 0.06)}" height="${f1(h * 0.16)}" rx="${f1(h * 0.02)}" fill="#7a4b2c" stroke="${INK}" stroke-width="${line}"/>`;
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers, top = y - h + t * h * 0.5, base = y - h * 0.12 - (tiers - 1 - i) * h * 0.24, half = w * (0.5 + 0.5 * ((i + 1) / tiers));
    const d = `M${f1(x)} ${f1(top)} Q${f1(x + half * 0.34)} ${f1((top + base) / 2 - 2)} ${f1(x + half)} ${f1(base - 2)} Q${f1(x + half * 1.06)} ${f1(base + 5)} ${f1(x + half * 0.6)} ${f1(base + 4)} L${f1(x - half * 0.6)} ${f1(base + 4)} Q${f1(x - half * 1.06)} ${f1(base + 5)} ${f1(x - half)} ${f1(base - 2)} Q${f1(x - half * 0.34)} ${f1((top + base) / 2 - 2)} ${f1(x)} ${f1(top)}Z`;
    s += `<path d="${d}" fill="${c[0]}" stroke="${INK}" stroke-width="${line}" stroke-linejoin="round"/>`;
    s += `<path d="M${f1(x)} ${f1(top + 3)} Q${f1(x + half * 0.34)} ${f1((top + base) / 2)} ${f1(x + half * 0.92)} ${f1(base)} Q${f1(x + half * 0.9)} ${f1(base + 3)} ${f1(x + half * 0.5)} ${f1(base + 3)} L${f1(x + half * 0.1)} ${f1(base + 3)}Z" fill="${c[1]}"/>`;
  }
  return s;
}
const GOLD = ['#f2b63c', '#d98e27'];
const GREEN = ['#4b9a58', '#347a49'];
const DEEP = ['#2f7a55', '#235f46'];

function forest(seed, n, x0, x1, yOf, hMin, hMax, palette, line = 2.2) {
  const r = rnd(seed), list = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0), h = hMin + r() * (hMax - hMin);
    list.push({ x, y: yOf(x) + r() * 8, h, c: palette[Math.floor(r() * palette.length)] });
  }
  list.sort((a, b) => a.y - b.y);
  return list.map((t) => pine(t.x, t.y, t.h, t.c, line)).join('');
}

export function cloud(w = 300, tint = '#ffffff', under = '#f6dfe8') {
  return `<svg class="cloud-art" viewBox="0 0 300 120" width="${w}" aria-hidden="true"><path d="M44 102 C8 102 2 66 34 58 C30 26 78 16 96 42 C108 6 172 4 184 44 C208 26 250 36 248 62 C288 62 292 102 256 102Z" fill="${tint}"/><path d="M44 102 C22 102 12 88 16 76 C40 94 86 88 110 92 C150 98 214 96 276 78 C282 92 272 102 256 102Z" fill="${under}"/></svg>`;
}

// A little Cadore barn: larch boards over stone, a shingle roof, geraniums.
function barn(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})" stroke="${INK}" stroke-width="3" stroke-linejoin="round">
    <rect x="-52" y="-18" width="104" height="26" rx="4" fill="#cdbfa7"/>
    <rect x="-52" y="-66" width="104" height="50" rx="4" fill="#a8703a"/>
    <path d="M-34 -66v50M-17 -66v50M0 -66v50M17 -66v50M34 -66v50" stroke-width="2" opacity=".55"/>
    <rect x="-13" y="-56" width="26" height="24" rx="3" fill="#ffe7a8"/>
    <rect x="-20" y="-32" width="40" height="8" rx="3" fill="#7a4b2c"/>
    <circle cx="-12" cy="-35" r="5" fill="#e0483d"/><circle cx="0" cy="-36" r="5" fill="#f26a78"/><circle cx="12" cy="-35" r="5" fill="#e0483d"/>
    <path d="M-68 -60 L0 -110 L68 -60 L60 -52 L0 -94 L-60 -52Z" fill="#6f5a4b"/>
    <path d="M-60 -52 L0 -94 L60 -52 L52 -66 L0 -100 L-52 -66Z" fill="#5d4a3d" stroke="none"/>
  </g>`;
}

// The start gantry of the lobby, a checkered flag over the road.
function checker(x, y, w, h, n = 12) {
  const cw = w / n, ch = h / 2;
  let s = '';
  for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) s += `<rect x="${f1(x + i * cw)}" y="${f1(y + j * ch)}" width="${f1(cw)}" height="${f1(ch)}" fill="${(i + j) % 2 ? '#fff' : INK}"/>`;
  return s;
}

function bunting(x0, y0, x1, y1, sag, n = 13, line = 3) {
  const cols = ['#e0483d', '#f6c23e', '#4aa6f2', '#62c56e', '#f28bbd', '#fff4d8'];
  let s = `<path d="M${x0} ${y0} Q${(x0 + x1) / 2} ${(y0 + y1) / 2 + sag * 2} ${x1} ${y1}" fill="none" stroke="${INK}" stroke-width="${line}"/>`;
  for (let i = 0; i <= n; i++) {
    const t = (i + 0.5) / (n + 1), mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + sag * 2;
    const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * mx + t ** 2 * x1, y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * my + t ** 2 * y1;
    s += `<path d="M${f1(x - 15)} ${f1(y)} L${f1(x + 15)} ${f1(y)} L${f1(x)} ${f1(y + 32)}Z" fill="${cols[i % cols.length]}" stroke="${INK}" stroke-width="${line}" stroke-linejoin="round"/>`;
  }
  return s;
}

// The two palettes of the menus: golden afternoon for the lobby, a cooler dusk for the screens over it.
const MENU = {
  sky: ['#c6b4ea', '#f4c0d2', '#ffe2b4'],
  rock: ['#efd3d8', '#c9a3c4', '#a884b3'],
  snow: '#fff8f2',
  hillFar: ['#a7bd67', '#8ba657'],
  hillMid: ['#c7b94f', '#a99f43'],
  hillNear: ['#8db654', '#6f9c49'],
  grass: ['#7fb24e', '#5f9545'],
  road: ['#6a5e70', '#574c5e'],
};

// The whole menu world: sky, the Antelao massif, golden larches, a barn, a road across the front with room for the karts.
export function backdrop({ road = true, pal = MENU, seed = 7, sun = true } = {}) {
  const hillFar = (x) => 660 - 58 * Math.sin(x / 300 + 0.8) - 22 * Math.sin(x / 110);
  const hillMid = (x) => 770 - 62 * Math.sin(x / 360 + 2.4) - 16 * Math.sin(x / 120 + 1);
  const path = (fn, bottom = 1080) => {
    let d = `M-20 ${f1(fn(-20))}`;
    for (let x = 0; x <= 1960; x += 40) d += ` L${x} ${f1(fn(x))}`;
    return `${d} L1960 ${bottom} L-20 ${bottom}Z`;
  };
  const id = ++uid;
  return `<svg class="scene" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs>
    <linearGradient id="bgSky${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.sky[0]}"/><stop offset=".42" stop-color="${pal.sky[1]}"/><stop offset=".66" stop-color="${pal.sky[2]}"/></linearGradient>
    <radialGradient id="bgSun${id}"><stop offset="0" stop-color="#fff7d8"/><stop offset=".35" stop-color="#ffe9b0" stop-opacity=".85"/><stop offset="1" stop-color="#ffe9b0" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#bgSky${id})"/>
  ${sun ? `<circle cx="1490" cy="150" r="320" fill="url(#bgSun${id})"/>` : ''}
  <!-- the far range, then the great massif, raised so that the peaks stand clear over the menus -->
  <g transform="translate(0 -60)">
  <path d="M-30 640 L120 470 L210 530 L330 400 L440 500 L560 430 L690 560 L820 620 L820 760 L-30 760Z" fill="${pal.rock[1]}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M330 400 L372 500 L346 560 L400 640 L560 640 L470 540 L440 500Z M120 470 L150 560 L120 640 L250 640 L210 530Z" fill="${pal.rock[2]}"/>
  <path d="M330 400 L300 432 L324 446 L338 428 L356 450 L366 428Z M120 470 L100 492 L120 504 L134 490Z M560 430 L536 452 L556 470 L576 452Z" fill="${pal.snow}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
  </g><g transform="translate(0 -170)">
  <path d="M1010 1000 L1130 460 L1190 510 L1290 270 L1360 370 L1430 320 L1520 470 L1590 430 L1700 590 L1790 540 L1960 1000Z" fill="${pal.rock[0]}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M1290 270 L1318 400 L1280 470 L1340 590 L1300 1000 L1560 1000 L1480 590 L1430 320 L1360 370Z M1590 430 L1610 540 L1590 620 L1640 1000 L1960 1000 L1790 540 L1700 590Z M1130 460 L1150 560 L1120 640 L1180 1000 L1250 1000 L1190 590 L1190 510Z" fill="${pal.rock[1]}"/>
  <path d="M1360 370 L1390 500 L1370 600 L1420 1000 L1500 1000 L1450 560 L1430 320Z" fill="${pal.rock[2]}"/>
  <path d="M1290 270 L1252 348 L1282 336 L1294 372 L1318 340 L1344 372 L1360 370Z M1430 320 L1398 354 L1424 362 L1440 392 L1462 372Z M1130 460 L1100 526 L1132 510 L1150 540 L1170 506 L1190 510Z M1590 430 L1560 474 L1588 470 L1606 494 L1622 476Z" fill="${pal.snow}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M1250 660 C1290 600 1320 560 1340 500 C1344 560 1370 620 1400 680 C1350 650 1300 650 1250 660Z" fill="${pal.snow}" opacity=".9"/>
  </g>
  <!-- the valley -->
  <path d="${path(hillFar)}" fill="${pal.hillFar[0]}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M-20 720 C200 660 400 700 600 720 C800 740 1100 690 1300 700 C1500 712 1760 680 1960 700 L1960 860 L-20 860Z" fill="${pal.hillFar[1]}" opacity=".6"/>
  ${forest(seed + 1, 60, -20, 1960, hillFar, 46, 80, [GREEN, DEEP, GOLD, GOLD])}
  <path d="${path(hillMid)}" fill="${pal.hillMid[0]}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M-20 830 C260 790 520 860 800 840 C1100 820 1500 780 1960 830 L1960 1000 L-20 1000Z" fill="${pal.hillMid[1]}" opacity=".5"/>
  ${forest(seed + 2, 34, -20, 760, hillMid, 70, 130, [GOLD, GOLD, GREEN, DEEP])}
  ${forest(seed + 3, 30, 1180, 1960, hillMid, 70, 130, [GOLD, GOLD, GREEN, DEEP])}
  ${barn(880, 800, 1.15)}
  ${barn(1050, 776, 0.72)}
  ${!road ? `<path d="M-20 950 C300 900 620 960 960 930 C1300 900 1600 884 1960 930 L1960 1080 L-20 1080Z" fill="${pal.grass[0]}" stroke="${INK}" stroke-width="4"/>
  <path d="M-20 1020 C400 980 800 1030 1200 1010 C1500 996 1760 990 1960 1010 L1960 1080 L-20 1080Z" fill="${pal.grass[1]}" opacity=".55"/>` : ''}
  ${road ? `
  <g stroke="${INK}" stroke-width="4"><path d="M640 900 V772" /><path d="M1892 880 V772" /></g>
  ${bunting(640, 776, 1892, 776, 16, 19)}
  <path d="M-20 870 C300 836 620 900 960 880 C1300 860 1600 824 1960 862 L1960 1080 L-20 1080Z" fill="${pal.grass[0]}" stroke="${INK}" stroke-width="4"/>
  <path d="M-20 930 C320 890 640 950 980 930 C1300 910 1620 880 1960 910 L1960 1062 C1620 1034 1300 1060 980 1078 C640 1098 320 1044 -20 1082Z" fill="${pal.road[0]}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M-20 1010 C320 970 640 1030 980 1010 C1300 990 1620 960 1960 985" fill="none" stroke="#fff4d8" stroke-width="9" stroke-dasharray="70 60" opacity=".85"/>
  <path d="M-20 942 C320 902 640 962 980 942 C1300 922 1620 892 1960 922" fill="none" stroke="#fff" stroke-width="10" stroke-dasharray="44 44" opacity=".95"/>
  <path d="M-20 942 C320 902 640 962 980 942 C1300 922 1620 892 1960 922" fill="none" stroke="#e0483d" stroke-width="10" stroke-dasharray="44 44" stroke-dashoffset="44"/>
  ` : ''}
  </svg>`;
}

// Clouds float in their own layer: moving one never repaints the whole scene.
export function clouds(n = 5, seed = 3) {
  const r = rnd(seed);
  let s = '';
  for (let i = 0; i < n; i++) {
    const top = 2 + r() * 34, w = 200 + r() * 260, dur = 90 + r() * 90, delay = -r() * dur, op = 0.75 + r() * 0.25;
    s += `<div class="cloud" style="top:${top.toFixed(1)}%;width:calc(var(--u) * ${w.toFixed(0)});animation-duration:${dur.toFixed(0)}s;animation-delay:${delay.toFixed(0)}s;opacity:${op.toFixed(2)}">${cloud(300)}</div>`;
  }
  return `<div class="clouds" aria-hidden="true">${s}</div>`;
}

// The logo: chunky letters on a tilt, an outline, a drop of colour, a checkered ribbon.
export function logo(text = 'Racing Karts') {
  const [a, ...rest] = text.split(' ');
  const b = rest.join(' ');
  const id = ++uid;
  return `<svg class="logo" viewBox="0 0 1000 214" aria-label="${text}" role="img">
  <defs>
    <linearGradient id="lgA${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf6"/><stop offset="1" stop-color="#ffe9c9"/></linearGradient>
    <linearGradient id="lgB${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe066"/><stop offset="1" stop-color="#ff9d3f"/></linearGradient>
  </defs>
  <g transform="rotate(-2 500 100)">
    <g font-weight="700" font-size="152" text-anchor="middle" style="paint-order:stroke fill" stroke-linejoin="round">
      <text x="500" y="150" fill="${INK}" stroke="${INK}" stroke-width="34" opacity=".28" transform="translate(4 12)">${a} ${b}</text>
      <text x="500" y="150" stroke="${INK}" stroke-width="26"><tspan fill="url(#lgA${id})">${a}</tspan> <tspan fill="url(#lgB${id})">${b}</tspan></text>
    </g>
    <g stroke="${INK}" stroke-width="6" stroke-linejoin="round">
      <rect x="150" y="172" width="700" height="28" rx="14" fill="#fff"/>
    </g>
    <g clip-path="url(#lgC${id})">${checker(150, 172, 700, 28, 50)}</g>
    <clipPath id="lgC${id}"><rect x="150" y="172" width="700" height="28" rx="14"/></clipPath>
    <rect x="150" y="172" width="700" height="28" rx="14" fill="none" stroke="${INK}" stroke-width="6"/>
  </g></svg>`;
}

// A seat's mascot: a round helmet with eyes, in the player's colour; grey and asleep while nobody sits there.
export function helmet(color = '#c9cfd8', { mood = 'happy', visor = '#fff' } = {}) {
  const eyes = mood === 'asleep'
    ? `<path d="M36 66 q8 5 16 0 M64 66 q8 5 16 0" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/>`
    : mood === 'sad'
      ? `<circle cx="44" cy="66" r="6" fill="${INK}"/><circle cx="72" cy="66" r="6" fill="${INK}"/><path d="M34 54 l14 4 M82 54 l-14 4" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`
      : `<ellipse cx="44" cy="65" rx="9" ry="10.5" fill="#fff" stroke="${INK}" stroke-width="3"/><ellipse cx="72" cy="65" rx="9" ry="10.5" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="46" cy="66" r="5.5" fill="${INK}"/><circle cx="74" cy="66" r="5.5" fill="${INK}"/><circle cx="48" cy="63.5" r="2" fill="#fff"/><circle cx="76" cy="63.5" r="2" fill="#fff"/>`;
  const mouth = mood === 'asleep' ? `<circle cx="58" cy="83" r="3" fill="${INK}"/>` : mood === 'sad' ? `<path d="M50 86 q8 -6 16 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>` : `<path d="M47 80 q11 11 22 0" fill="${INK}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
  return `<svg class="helmet" viewBox="0 0 116 120" aria-hidden="true">
  <path d="M10 66 C8 30 34 8 62 8 C92 8 110 34 108 66 C108 98 88 112 58 112 C30 112 10 96 10 66Z" fill="${color}" stroke="${INK}" stroke-width="5"/>
  <path d="M20 62 C20 50 30 46 58 46 C86 46 98 50 98 62 C98 84 84 98 58 98 C32 98 20 84 20 62Z" fill="${visor}" stroke="${INK}" stroke-width="4"/>
  <path d="M26 30 C34 20 46 15 60 15" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".8"/>
  ${eyes}${mouth}
  <path d="M52 8 L66 8 L66 44 L52 44Z" fill="#fff" opacity=".35"/>
  </svg>`;
}

export const check = () => `<svg class="check" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="#62c56e" stroke="${INK}" stroke-width="4"/><path d="M11 21 l6 6 l12 -14" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const phone = () => `<svg class="phone" viewBox="0 0 44 72" aria-hidden="true"><rect x="3" y="3" width="38" height="66" rx="9" fill="#fff" stroke="${INK}" stroke-width="5"/><rect x="9" y="12" width="26" height="42" rx="3" fill="#bfe3ff"/><circle cx="22" cy="61" r="3" fill="${INK}"/></svg>`;
export const wifi = () => `<svg class="wifi" viewBox="0 0 48 38" aria-hidden="true"><g fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"><path d="M4 14 C16 2 32 2 44 14"/><path d="M12 22 C20 15 28 15 36 22"/></g><circle cx="24" cy="31" r="4.5" fill="${INK}"/></svg>`;
export const keycap = () => `<svg class="keycap" viewBox="0 0 64 44" aria-hidden="true"><rect x="3" y="3" width="58" height="38" rx="8" fill="#fff" stroke="${INK}" stroke-width="5"/><path d="M12 14h4M22 14h4M32 14h4M42 14h4M12 24h4M22 24h4M32 24h4M42 24h6M18 33h26" stroke="${INK}" stroke-width="4" stroke-linecap="round"/></svg>`;
export const coin = () => `<svg class="coin" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27" fill="#ffd23f" stroke="${INK}" stroke-width="5"/><circle cx="32" cy="32" r="18" fill="none" stroke="#c98d17" stroke-width="4"/><path d="M20 42 L30 22 L36 32 L40 26 L46 42Z" fill="#c98d17"/></svg>`;
export const flag = () => `<svg class="flagc" viewBox="0 0 64 64" aria-hidden="true"><path d="M12 6 V60" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M12 8 C26 2 36 16 56 8 V36 C36 44 26 30 12 36Z" fill="#fff" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M12 8 C18 6 22 7 26 9 V22 C22 20 18 19 12 21Z M26 22 C30 24 34 26 40 25 V38 C34 39 30 37 26 35Z M40 11 C44 12 50 10 56 8 V22 C50 24 44 25 40 25Z" fill="${INK}"/></svg>`;
export const die = () => `<svg class="die" viewBox="0 0 80 80" aria-hidden="true"><rect x="8" y="8" width="64" height="64" rx="16" fill="#fffdf6" stroke="${INK}" stroke-width="6" transform="rotate(-8 40 40)"/><g fill="${INK}" transform="rotate(-8 40 40)"><circle cx="26" cy="26" r="6"/><circle cx="54" cy="26" r="6"/><circle cx="40" cy="40" r="6"/><circle cx="26" cy="54" r="6"/><circle cx="54" cy="54" r="6"/></g></svg>`;
export const pauseIcon = () => `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="9" y="7" width="8" height="26" rx="3" fill="${INK}"/><rect x="23" y="7" width="8" height="26" rx="3" fill="${INK}"/></svg>`;
export const ghostIcon = () => `<svg class="ghosti" viewBox="0 0 48 52" aria-hidden="true"><path d="M6 46 V22 C6 11 14 4 24 4 S42 11 42 22 V46 C38 42 36 42 33 46 C30 50 27 50 24 46 C21 42 18 42 15 46 C12 50 9 50 6 46Z" fill="#e6f4ff" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/><circle cx="17" cy="22" r="4.4" fill="${INK}"/><circle cx="31" cy="22" r="4.4" fill="${INK}"/><circle cx="18.4" cy="20.6" r="1.4" fill="#fff"/><circle cx="32.4" cy="20.6" r="1.4" fill="#fff"/></svg>`;
export const wheelIcon = () =>`<svg class="wheel" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27" fill="${INK}"/><circle cx="32" cy="32" r="13" fill="#ffd23f" stroke="${INK}" stroke-width="3"/><circle cx="32" cy="32" r="3.5" fill="${INK}"/></svg>`;

// Empty crate: the same market crate as the boxes on the road, ribbon and all.
export const crate = () => `<svg class="crate-art" viewBox="0 0 160 160" aria-hidden="true">
  <rect x="14" y="30" width="132" height="116" rx="16" fill="#c98d4f" stroke="${INK}" stroke-width="7"/>
  <rect x="14" y="30" width="132" height="24" rx="10" fill="#a8703a" stroke="${INK}" stroke-width="5"/>
  <rect x="14" y="122" width="132" height="24" rx="10" fill="#a8703a" stroke="${INK}" stroke-width="5"/>
  <rect x="28" y="56" width="104" height="64" rx="10" fill="#f7e3c4" stroke="${INK}" stroke-width="5"/>
  <path d="M80 30 C60 2 34 4 40 22 C44 34 66 32 80 30 C94 32 116 34 120 22 C126 4 100 2 80 30Z" fill="#e0483d" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
  </svg>`;

// ---------- the track cards: one small painting per place ----------
const TRACK_ART = {
  antelao: {
    sky: ['#cdb3e6', '#f7bfca', '#ffe1ae'],
    body(r) {
      return `
      <path d="M330 220 L430 80 L470 110 L530 40 L590 120 L650 170 L650 240 L330 240Z" fill="#efd6d6" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M530 40 L540 110 L520 160 L560 240 L640 240 L590 120Z M430 80 L440 140 L420 240 L470 240 L470 110Z" fill="#c8a2bf"/>
      <path d="M530 40 L510 72 L530 66 L542 84 L560 70Z M430 80 L414 110 L432 102 L446 114 L460 96Z" fill="#fffaf2" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M-10 240 C100 170 220 180 340 220 C460 250 560 210 650 230 L650 370 L-10 370Z" fill="#c7b94f" stroke="${INK}" stroke-width="3"/>
      ${forestN(r, 26, -10, 650, (x) => 232 - 26 * Math.sin(x / 140), 34, 62, [GOLD, GOLD, GREEN])}
      <path d="M210 370 C250 310 320 290 340 262 C354 246 396 240 420 240 C400 256 400 266 410 280 C430 320 500 340 560 370Z" fill="#6a5e70" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M375 370 C360 330 372 300 396 272" fill="none" stroke="#fff4d8" stroke-width="4" stroke-dasharray="14 12"/>
      <g transform="translate(172 262) scale(.62)" stroke="${INK}" stroke-width="3.4" stroke-linejoin="round"><path d="M0 0 L46 -92 L92 0Z" fill="#5d5a66"/><path d="M26 0 L46 -44 L66 0Z" fill="#f4efe6"/><path d="M46 -92 V-116 M37 -106 H55" stroke-width="4"/></g>
      ${barnAt(70, 300, 0.5)}`;
    },
  },
  pelmo: {
    sky: ['#7fc0ef', '#b7e0f8', '#f0faff'],
    body(r) {
      return `
      <path d="M170 230 L250 90 L300 60 L400 56 L460 84 L540 230Z" fill="#dfeaf3" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M300 60 C320 150 390 150 400 56 L460 84 C450 180 300 180 250 90Z" fill="#b6cde0"/>
      <path d="M250 90 L228 130 L256 122 L270 150 L296 118 L330 128 L366 118 L400 130 L430 120 L470 144 L460 84 L400 56 L300 60Z" fill="#ffffff" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M-10 250 C120 190 280 220 400 236 C500 250 590 210 650 220 L650 370 L-10 370Z" fill="#f6fbff" stroke="${INK}" stroke-width="3"/>
      ${forestN(r, 22, -10, 650, (x) => 244 - 20 * Math.sin(x / 120 + 1), 32, 60, [SNOWY, SNOWY, DEEP])}
      <path d="M170 370 C260 330 330 300 350 262 C370 250 410 250 430 262 C410 292 440 330 520 370Z" fill="#cfe3f2" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M264 370 C310 330 372 306 384 268" fill="none" stroke="#fff" stroke-width="5" stroke-dasharray="4 10"/>
      <g stroke="${INK}" stroke-width="2.6"><path d="M540 300 V130 M100 300 V158" /><path d="M100 170 L540 142" fill="none"/></g>
      <g stroke="${INK}" stroke-width="2.4"><path d="M300 156 v24" /><rect x="284" y="178" width="32" height="18" rx="5" fill="#d8362e"/></g>`;
    },
  },
  transfagarasan: {
    sky: ['#8fd2f2', '#c8eef8', '#f4fbe0'],
    body() {
      return `
      <path d="M-10 190 L90 110 L170 150 L280 50 L390 130 L470 80 L650 190 L650 280 L-10 280Z" fill="#a9b4b5" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M280 50 L300 130 L270 200 L330 280 L450 280 L390 130Z M470 80 L490 160 L470 280 L650 280 L650 190Z" fill="#88979d"/>
      <path d="M280 50 L256 78 L282 72 L296 92 L316 76Z M470 80 L450 96 L470 98 L484 110 L498 96Z" fill="#fff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M-10 250 C90 200 200 190 320 210 C440 230 560 190 650 214 L650 370 L-10 370Z" fill="#7cc25e" stroke="${INK}" stroke-width="3"/>
      <path d="M-10 318 C70 300 300 340 400 322 C520 300 560 286 590 270 C600 262 590 254 570 256 C460 268 240 300 160 288 C130 282 136 268 164 264 C260 252 420 262 500 244 C520 238 516 228 498 228 C400 232 250 244 214 232 C200 226 210 218 232 216 C280 212 340 216 380 206" fill="none" stroke="${INK}" stroke-width="19" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M-10 318 C70 300 300 340 400 322 C520 300 560 286 590 270 C600 262 590 254 570 256 C460 268 240 300 160 288 C130 282 136 268 164 264 C260 252 420 262 500 244 C520 238 516 228 498 228 C400 232 250 244 214 232 C200 226 210 218 232 216 C280 212 340 216 380 206" fill="none" stroke="#6a6d78" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
      <g fill="#fff" stroke="${INK}" stroke-width="2.2"><ellipse cx="70" cy="346" rx="17" ry="12"/><ellipse cx="108" cy="352" rx="15" ry="11"/><ellipse cx="42" cy="358" rx="14" ry="10"/></g>
      <g fill="${INK}"><circle cx="84" cy="340" r="5"/><circle cx="121" cy="347" r="4.5"/><circle cx="54" cy="353" r="4.5"/></g>`;
    },
  },
  bran: {
    sky: ['#1f2466', '#3f3a8c', '#7a5aa8'],
    body(r) {
      return `
      <circle cx="500" cy="92" r="58" fill="#fff4cf" stroke="${INK}" stroke-width="3"/><circle cx="480" cy="78" r="9" fill="#ecdba6"/><circle cx="522" cy="108" r="13" fill="#ecdba6"/><circle cx="506" cy="66" r="6" fill="#ecdba6"/>
      <g fill="#fff"><circle cx="60" cy="50" r="3"/><circle cx="150" cy="30" r="2.4"/><circle cx="240" cy="70" r="2.6"/><circle cx="330" cy="36" r="3"/><circle cx="600" cy="44" r="2.6"/><circle cx="410" cy="26" r="2"/></g>
      <path d="M-10 260 L80 180 L170 220 L260 160 L370 240 L470 190 L650 260 L650 370 L-10 370Z" fill="#2e4a77" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M170 260 C220 214 280 214 330 260Z" fill="#54597e" stroke="${INK}" stroke-width="3"/>
      <g stroke="${INK}" stroke-width="3" stroke-linejoin="round">
        <rect x="205" y="130" width="94" height="110" rx="6" fill="#efe3cf"/>
        <path d="M196 134 L252 76 L308 134Z" fill="#d0523f"/>
        <rect x="280" y="108" width="40" height="132" rx="6" fill="#e7dac3"/>
        <path d="M272 112 L300 62 L328 112Z" fill="#c8392f"/>
        <rect x="222" y="160" width="20" height="30" rx="9" fill="#ffc95e"/><rect x="262" y="160" width="20" height="30" rx="9" fill="#ffc95e"/><rect x="291" y="130" width="17" height="26" rx="8" fill="#ffc95e"/>
      </g>
      <path d="M-10 300 C110 266 240 270 340 290 C460 312 560 276 650 288 L650 370 L-10 370Z" fill="#23625f" stroke="${INK}" stroke-width="3"/>
      ${forestN(r, 16, -10, 650, (x) => 296 - 16 * Math.sin(x / 100), 30, 56, [NIGHT, NIGHT])}
      <path d="M180 370 C260 330 340 318 400 300 C430 306 470 330 560 370Z" fill="#46436e" stroke="${INK}" stroke-width="3"/>
      <g stroke="${INK}" stroke-width="2.4"><path d="M170 370 V300"/><circle cx="170" cy="296" r="9" fill="#ffc95e"/><path d="M566 370 V312"/><circle cx="566" cy="308" r="9" fill="#ffc95e"/></g>`;
    },
  },
  bromo: {
    sky: ['#f58fa8', '#ffb394', '#ffe0a0'],
    body() {
      return `
      <circle cx="120" cy="120" r="46" fill="#fff0c6" opacity=".9"/>
      <path d="M380 150 L470 40 L560 150Z" fill="#a39aa2" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M470 40 C480 70 500 100 560 150 L470 150Z" fill="#8a828c"/>
      <path d="M470 42 C462 20 482 16 474 -6 M478 40 C494 22 480 10 496 -6" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>
      <path d="M40 240 L120 120 L170 120 L250 240Z" fill="#b6a9a8" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M120 120 C105 150 100 190 92 240 M136 120 C130 160 128 200 126 240 M152 120 C160 160 170 200 180 240 M166 120 C185 160 205 200 222 240" fill="none" stroke="${INK}" stroke-width="2.5" opacity=".5"/>
      <path d="M250 240 C290 180 320 148 368 150 C420 150 450 196 500 240Z" fill="#8f8689" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M322 156 C350 142 390 142 416 158 C390 170 350 170 322 156Z" fill="#54474f" stroke="${INK}" stroke-width="2.4"/>
      <path d="M368 148 C352 122 384 108 366 80 C352 60 382 44 372 20" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round" opacity=".85"/>
      <path d="M-10 250 C120 226 300 244 420 232 C520 224 580 236 650 228 L650 370 L-10 370Z" fill="#b3aaa8" stroke="${INK}" stroke-width="3"/>
      <path d="M-10 300 C80 270 200 300 300 290 C440 276 540 300 650 276 L650 370 L-10 370Z" fill="#9d9496"/>
      <path d="M180 370 C230 340 320 300 360 262 C390 276 420 320 480 370Z" fill="#c9c0bc" stroke="${INK}" stroke-width="3"/>
      <g stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"><rect x="540" y="214" width="60" height="30" rx="3" fill="#d9c7a8"/><path d="M532 216 L570 186 L608 216Z" fill="#a0604a"/><path d="M570 186 V170"/></g>`;
    },
  },
  bali: {
    sky: ['#6fd0f0', '#b8ecf8', '#f4fff0'],
    body(r) {
      let terr = '';
      for (let i = 0; i < 6; i++) {
        const y = 186 + i * 30, c = i % 2 ? '#57bd5e' : '#79cf63';
        terr += `<path d="M-10 ${y} C120 ${y - 26} 220 ${y + 20} 340 ${y - 6} C460 ${y - 30} 560 ${y + 14} 650 ${y - 16} L650 ${y + 40} L-10 ${y + 40}Z" fill="${c}" stroke="${INK}" stroke-width="3"/>`;
      }
      return `
      <path d="M320 186 L450 48 L520 96 L650 186Z" fill="#6c9aa5" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M450 48 C470 90 500 140 540 186 L450 186Z" fill="#567f8d"/>
      <g fill="#fff" stroke="none" opacity=".92"><ellipse cx="160" cy="62" rx="60" ry="20"/><ellipse cx="200" cy="50" rx="40" ry="20"/><ellipse cx="560" cy="44" rx="50" ry="15"/></g>
      ${terr}
      <path d="M-10 250 C50 232 120 244 170 262 L170 300 L-10 300Z" fill="#3fc0d0" stroke="${INK}" stroke-width="3"/>
      <g stroke="${INK}" stroke-width="2.4" stroke-linejoin="round">
        ${[0, 1, 2, 3, 4].map((i) => `<path d="M${74 - 30 + i * 5} ${232 - i * 16} L${74 + 30 - i * 5} ${232 - i * 16} L${74 + 18 - i * 5} ${216 - i * 16} L${74 - 18 + i * 5} ${216 - i * 16}Z" fill="#5a3a2b"/>`).join('')}
        <rect x="62" y="232" width="24" height="16" fill="#efe3cf"/>
      </g>
      ${palm(560, 270, 90)}${palm(600, 300, 74)}${palm(250, 210, 62)}
      <path d="M210 370 C290 330 360 300 380 262 C400 266 420 310 480 370Z" fill="#6a5e70" stroke="${INK}" stroke-width="3"/>
      <path d="M346 370 C362 330 376 300 382 272" fill="none" stroke="#fff4d8" stroke-width="4" stroke-dasharray="12 10"/>`;
    },
  },
  cortina: {
    sky: ['#8fd0f2', '#d6f0f6', '#fff0cf'],
    body(r) {
      return `
      <path d="M-10 190 L70 96 L104 128 L150 62 L196 120 L232 92 L300 190Z" fill="#f2d9c8" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M150 62 L160 118 L140 190 L210 190 L196 120Z" fill="#d7ae9e"/>
      <path d="M340 190 L420 70 L450 104 L488 44 L536 112 L590 84 L650 170 L650 200 L340 200Z" fill="#efcfbc" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M488 44 L498 110 L476 190 L560 190 L536 112Z M420 70 L428 130 L410 190 L450 190 L450 104Z" fill="#cda193"/>
      <path d="M488 44 L505 80 L490 72 L478 84 L470 72Z" fill="#fff" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
      <g fill="#fff" stroke="none" opacity=".92"><ellipse cx="300" cy="50" rx="52" ry="15"/><ellipse cx="336" cy="40" rx="32" ry="14"/></g>
      <path d="M-10 182 C120 166 260 186 370 178 C470 170 560 182 650 172 L650 370 L-10 370Z" fill="#7fc765" stroke="${INK}" stroke-width="3"/>
      ${forestN(r, 9, -10, 210, () => 186, 34, 58, ['#3f8a52', '#2f6f46'])}${forestN(r, 7, 470, 650, () => 182, 30, 52, ['#3f8a52', '#2f6f46'])}
      <path d="M300 188 C390 186 470 196 470 214 C470 234 240 232 220 256 C204 276 420 282 420 310 C420 334 300 348 270 370 L370 370 C420 350 500 336 500 306 C500 272 300 268 306 254 C314 240 548 250 548 212 C548 188 410 180 300 184Z" fill="#6c6476" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      ${barnAt(120, 300, 1.05)}${barnAt(566, 300, 0.85)}`;
    },
  },
  bucarest: {
    sky: ['#8fc4e2', '#f6e3bc', '#ffd9a0'],
    body(r) {
      // the Parliament at the end of the boulevard, tier on tier; the fountains up the middle; old saloons on their way home
      let front = '';
      for (const [x, y, w, h, c] of [[126, 150, 388, 86, '#ecd9b4'], [176, 112, 288, 40, '#f2e2c2'], [226, 82, 188, 32, '#f6eacf'], [280, 58, 80, 26, '#f9f0dc']]) {
        front += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" stroke="${INK}" stroke-width="3"/>`;
        for (let wy = y + 8; wy < y + h - 8; wy += 16) for (let wx = x + 10; wx < x + w - 10; wx += 18) front += `<rect x="${wx}" y="${wy}" width="9" height="9" rx="1.5" fill="#a58f88"/>`;
      }
      const block = (x, w, h, c) => `<rect x="${x}" y="${236 - h}" width="${w}" height="${h}" fill="${c}" stroke="${INK}" stroke-width="3"/>`;
      const tree = (x, s) => `<g stroke="${INK}" stroke-width="3"><rect x="${x - 4 * s}" y="${236 - 30 * s}" width="${8 * s}" height="${30 * s}" fill="#7a5a42"/><circle cx="${x}" cy="${236 - 44 * s}" r="${24 * s}" fill="${r() < 0.5 ? '#6fa448' : '#88b04c'}"/></g>`;
      const jet = (x, y, h) => `<path d="M${x - 5} ${y} Q${x} ${y - h} ${x + 5} ${y}Z" fill="#e4f6fb" stroke="${INK}" stroke-width="2"/>`;
      const saloon = (x, y, c) => `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><circle cx="${x + 22}" cy="${y + 40}" r="10" fill="#2d2f3f"/><circle cx="${x + 84}" cy="${y + 40}" r="10" fill="#2d2f3f"/><path d="M${x} ${y + 40} V${y + 20} L${x + 26} ${y + 18} L${x + 38} ${y} H${x + 72} L${x + 84} ${y + 18} L${x + 106} ${y + 22} V${y + 40}Z" fill="${c}"/><rect x="${x + 42}" y="${y + 5}" width="26" height="13" rx="2" fill="#dff4fb"/></g>`;
      return `${block(-10, 96, 104, '#e8c9a0')}${block(556, 96, 110, '#efd2ae')}${front}${tree(70, 1.2)}${tree(116, 0.9)}${tree(530, 0.9)}${tree(580, 1.2)}
      <path d="M-10 236 H650 V370 H-10Z" fill="#6c6476" stroke="${INK}" stroke-width="3"/>
      <path d="M270 236 L370 236 L356 300 L284 300Z" fill="#8ec8d4" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      ${jet(296, 290, 44)}${jet(320, 274, 56)}${jet(344, 290, 44)}
      <path d="M60 370 L200 236 M580 370 L440 236" stroke="#fff4d0" stroke-width="5" stroke-dasharray="26 20" fill="none"/>
      ${saloon(90, 300, '#e8505b')}${saloon(440, 296, '#f2e3c0')}`;
    },
  },
  jakarta: {
    sky: ['#ff9d7a', '#ffc98f', '#ffe9b8'],
    body(r) {
      let city = '';
      for (let i = 0; i < 11; i++) {
        const w = 42 + Math.floor(r() * 22), h = 80 + Math.floor(r() * 125), x = -14 + i * 62, top = 236 - h, c = ['#7d82ad', '#9583ad', '#6889a8'][i % 3];
        city += `<rect x="${x}" y="${top}" width="${w}" height="${h}" rx="3" fill="${c}" stroke="${INK}" stroke-width="3"/>`;
        for (let wy = top + 12; wy < 222; wy += 22) for (let wx = x + 8; wx < x + w - 10; wx += 15) city += `<rect x="${wx}" y="${wy}" width="8" height="11" rx="1.5" fill="${r() < 0.55 ? '#ffe28a' : '#54587e'}"/>`;
      }
      const bike = (x, y, c) => `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><circle cx="${x + 6}" cy="${y + 26}" r="8" fill="#2d2f3f"/><circle cx="${x + 46}" cy="${y + 26}" r="8" fill="#2d2f3f"/><path d="M${x} ${y + 24} Q${x + 2} ${y + 6} ${x + 22} ${y + 6} L${x + 42} ${y + 6} L${x + 52} ${y + 24}Z" fill="${c}"/><circle cx="${x + 26}" cy="${y - 4}" r="9" fill="#ffd23f"/></g>`;
      const car = (x, y, c, w = 96) => `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><circle cx="${x + w * 0.2}" cy="${y + 42}" r="10" fill="#2d2f3f"/><circle cx="${x + w * 0.8}" cy="${y + 42}" r="10" fill="#2d2f3f"/><path d="M${x} ${y + 40} L${x} ${y + 22} Q${x + 8} ${y + 2} ${x + w * 0.3} ${y} L${x + w * 0.74} ${y} Q${x + w * 0.92} ${y + 4} ${x + w} ${y + 24} L${x + w} ${y + 40}Z" fill="${c}"/><rect x="${x + w * 0.3}" y="${y + 6}" width="${w * 0.42}" height="14" rx="3" fill="#dff4fb"/></g>`;
      return `${city}
      <path d="M-10 236 L650 236 L650 370 L-10 370Z" fill="#6c6476" stroke="${INK}" stroke-width="3"/>
      <path d="M-10 300 H650" stroke="#fff4d0" stroke-width="6" stroke-dasharray="34 26" fill="none"/>
      ${car(30, 240, '#f2803a')}${bike(160, 252, '#3fb6c9')}${car(250, 240, '#e8505b', 110)}${bike(400, 252, '#7cc25e')}${car(490, 240, '#4d8fe0')}
      ${bike(60, 318, '#e8505b')}${car(170, 306, '#ffd23f', 120)}${bike(330, 318, '#c86fd0')}${car(430, 306, '#58bd5e', 112)}${bike(578, 318, '#f2803a')}`;
    },
  },
  batur: {
    sky: ['#6fd0f0', '#bfeef6', '#fff4c8'],
    body() {
      return `
      <path d="M300 200 L440 62 Q468 44 496 62 L650 170 L650 240 L300 240Z" fill="#7a7480" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M468 52 C486 100 530 160 590 240 L468 240Z" fill="#5f5a68"/>
      <path d="M440 62 Q468 78 496 62 Q468 44 440 62Z" fill="#3f3c48" stroke="${INK}" stroke-width="3"/>
      <path d="M468 50 C452 34 482 26 468 10 C496 18 500 36 480 50Z" fill="#fff" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" opacity=".92"/>
      <g fill="#fff" stroke="none" opacity=".92"><ellipse cx="130" cy="58" rx="58" ry="18"/><ellipse cx="172" cy="46" rx="38" ry="18"/></g>
      <path d="M-10 176 C120 158 260 170 370 200 C470 190 560 200 650 186 L650 300 L-10 300Z" fill="#79cf63" stroke="${INK}" stroke-width="3"/>
      <path d="M210 214 C320 186 460 200 650 210 L650 240 C460 228 330 216 240 240Z" fill="#57bd5e" stroke="${INK}" stroke-width="3"/>
      <path d="M270 254 C380 226 500 236 650 244 L650 280 C500 268 390 262 300 284Z" fill="#79cf63" stroke="${INK}" stroke-width="3"/>
      <path d="M-10 150 C60 146 130 160 186 186 C270 226 340 300 372 370 L-10 370Z" fill="#4ec2c9" stroke="${INK}" stroke-width="3"/>
      <g fill="none" stroke="#e8fbff" stroke-width="4" stroke-linecap="round"><path d="M18 176 q14 -8 28 0 t28 0"/><path d="M110 214 q14 -8 28 0 t28 0"/><path d="M24 258 q14 -8 28 0 t28 0"/><path d="M130 304 q14 -8 28 0 t28 0"/></g>
      <path d="M150 170 C232 208 300 290 322 370 L372 370 C340 300 270 226 186 186Z" fill="#fff0c4" stroke="${INK}" stroke-width="3"/>
      <path d="M650 262 C540 262 450 280 430 304 C414 326 440 350 480 370 L560 370 C510 346 490 326 508 312 C536 296 590 294 650 296Z" fill="#6c6476" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M636 278 C556 280 486 294 466 314 C452 330 470 350 504 370" fill="none" stroke="#fff4d0" stroke-width="4" stroke-dasharray="16 14"/>
      <g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><path d="M34 222 Q76 248 120 218 L110 236 Q76 252 44 238Z" fill="#f2803a"/><path d="M76 224 L76 176 L108 216Z" fill="#fff4d0"/></g>
      ${palm(226, 226, 62)}${palm(392, 300, 74)}`;
    },
  },
};
const SNOWY = ['#e8f2f6', '#7fa8ae'];
const NIGHT = ['#2c5f66', '#1f4852'];
const forestN = (r, n, x0, x1, yOf, a, b, pal) => forest(Math.floor(r() * 1e6), n, x0, x1, yOf, a, b, pal, 1.8);
const barnAt = (x, y, s) => barn(x, y, s);
function palm(x, y, h) {
  const top = y - h;
  return `<g stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"><path d="M${x} ${y} C${x + 6} ${y - h * 0.5} ${x - 6} ${y - h * 0.7} ${x + 2} ${top}" fill="none" stroke-width="6"/><path d="M${x} ${y} C${x + 6} ${y - h * 0.5} ${x - 6} ${y - h * 0.7} ${x + 2} ${top}" fill="none" stroke="#9a6d43" stroke-width="3"/>
  ${[-1, -0.45, 0.45, 1].map((d) => `<path d="M${x + 2} ${top} C${x + d * h * 0.3} ${top - h * 0.2} ${x + d * h * 0.6} ${top - h * 0.06} ${x + d * h * 0.7} ${top + h * 0.2} C${x + d * h * 0.46} ${top + h * 0.06} ${x + d * h * 0.2} ${top + h * 0.02} ${x + 2} ${top}Z" fill="#3f9e58"/>`).join('')}</g>`;
}

export function trackArt(id) {
  // a track with no picture yet still gets a place, never the surprise card's mosaic
  const a = TRACK_ART[id] || (id === 'random' ? null : TRACK_ART.antelao);
  // the surprise card: a slice of every place
  if (!a) {
    const ids = Object.keys(TRACK_ART);
    return `<div class="mosaic">${ids.map((t) => `<div>${trackArt(t)}</div>`).join('')}</div>`;
  }
  const g = `tsky-${id}-${++uid}`;
  return `<svg class="tart" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a.sky[0]}"/><stop offset=".55" stop-color="${a.sky[1]}"/><stop offset="1" stop-color="${a.sky[2]}"/></linearGradient></defs><rect width="640" height="360" fill="url(#${g})"/>${a.body(rnd(id.length * 7919))}</svg>`;
}

// The sky at the top of a full-bleed track painting (the loading screen).
export const trackSky = (id) => TRACK_ART[id]?.sky || ['#cfaee6', '#f4c0d2', '#ffdcae'];
