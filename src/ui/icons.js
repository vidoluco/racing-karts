// The item stickers and small UI icons, the same on the TV and the phone: rounded shapes, flat fills with one soft shade, a chunky dark
// outline and a white sticker edge. No filters, no external files, ids that cannot clash: safe to inline many times on a page.
export const INK = '#241c26';
const VB = 64;

// A sticker: the drawing with a fat white edge behind it, then the drawing with its ink. `art` uses `currentColor`-free plain paint.
function sticker(shape, art, { box = VB } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box} ${box}" aria-hidden="true"><g fill="#fff" stroke="#fff" stroke-width="9" stroke-linejoin="round" stroke-linecap="round">${shape}</g>${art}</svg>`;
}
const ink = (w = 3.4) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const glint = (d, w = 3.2) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" opacity=".85"/>`;

const ITEMS = {
  // a chubby tin rocket pointing up and to the right, flame behind
  razzo: () => {
    const body = 'M46 8 C 56 8 57 18 55 25 C 52 34 45 41 36 46 L 19 30 C 24 21 31 13 39 10 C 41 9 44 8 46 8 Z';
    const fins = 'M21 32 L 8 34 C 7 39 11 42 15 42 L 24 37 Z M34 45 L 31 56 C 26 57 22 53 22 49 L 27 40 Z';
    const fire = 'M21 44 C 15 46 9 53 6 59 C 13 57 20 51 24 47 Z';
    return sticker(`<path d="${body}"/><path d="${fins}"/><path d="${fire}"/>`,
      `<path d="${fire}" fill="#ffb13a" ${ink(3)}/><path d="${fins}" fill="#f4e9cf" ${ink()}/><path d="${body}" fill="#d9483b" ${ink()}/>
<path d="M46 8 C 56 8 57 18 55 25 L 46 15 Z" fill="#f4e9cf" ${ink(2.4)}/><circle cx="37" cy="26" r="6.2" fill="#8fd3ea" ${ink(3)}/>${glint('M34 24 q1.5 -2 3.5 -2', 2.2)}<path d="M26 28 L 37 39" ${ink(2.4)} fill="none"/>`);
  },
  // a slim clear bottle with a little left in it
  grappa: () => {
    const b = 'M27 6 h10 v13 c 0 6 7 8 7 16 v 19 a 4 4 0 0 1 -4 4 h -16 a 4 4 0 0 1 -4 -4 v -19 c 0 -8 7 -10 7 -16 Z';
    return sticker(`<path d="${b}"/>`, `<path d="${b}" fill="#d7f0f6"/><path d="M20 42 h24 v12 a4 4 0 0 1 -4 4 h-16 a4 4 0 0 1 -4 -4 Z" fill="#f4fbe6"/>
<rect x="25" y="3" width="14" height="9" rx="2.6" fill="#c9a06a" ${ink(3)}/><rect x="23" y="33" width="18" height="15" rx="2.5" fill="#f7efdc" ${ink(2.4)}/><path d="M27 38 h10 M28 43 h8" stroke="#a8362e" stroke-width="2.4" stroke-linecap="round"/>
<path d="${b}" fill="none" ${ink()}/>${glint('M24 26 c -2 2 -2 4 -2 6', 2.6)}`);
  },
  // a stout amber bottle with a cloth stopper and a plum
  zuica: () => {
    const b = 'M20 8 h10 v9 c 0 4 8 7 8 15 v 22 a 4 4 0 0 1 -4 4 h -18 a 4 4 0 0 1 -4 -4 v -22 c 0 -8 8 -11 8 -15 Z';
    return sticker(`<path d="${b}"/><circle cx="46" cy="46" r="13"/>`, `<path d="${b}" fill="#d0913e"/><path d="M25 6 c -6 0 -7 7 0 7 s 6 -7 0 -7 Z" fill="#d9463d" ${ink(3)}/>
<rect x="15" y="35" width="20" height="14" rx="2.5" fill="#fbf4e0" ${ink(2.4)}/><circle cx="25" cy="42" r="3.6" fill="#5c3a7e"/><path d="${b}" fill="none" ${ink()}/>
<path d="M46 34 c 8 0 12 6 12 12 s -5 13 -12 13 s -12 -7 -12 -13 s 4 -12 12 -12 Z" fill="#6b4490" ${ink()}/><path d="M46 34 c 1 -4 3 -6 6 -7" fill="none" ${ink(3)}/><path d="M50 29 c 4 -3 8 -2 9 0 c -3 3 -6 3 -9 0 Z" fill="#62c56e" ${ink(2.2)}/>${glint('M40 41 q2 -3 5 -3')}`);
  },
  // three plump sausages with grill stripes
  mici: () => {
    const s = (x, y, r, tone) => `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-22" y="-7.5" width="44" height="15" rx="7.5" fill="${tone}" ${ink()}/><path d="M-12 -7 l 5 14 M0 -7 l 5 14 M12 -7 l 5 14" stroke="#3f2115" stroke-width="2.8" stroke-linecap="round"/><path d="M-16 -3.4 h 8" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".55"/></g>`;
    const shape = (x, y, r) => `<rect transform="translate(${x} ${y}) rotate(${r})" x="-22" y="-7.5" width="44" height="15" rx="7.5"/>`;
    return sticker(shape(32, 18, -8) + shape(29, 34, 6) + shape(34, 50, -5), s(32, 18, -8, '#b4623a') + s(29, 34, 6, '#a0522d') + s(34, 50, -5, '#b4623a'));
  },
  // the iron pan from above, eggs, speck, potatoes, handle to the upper right
  uova: () => {
    const pan = 'M28 10 a 21 21 0 1 0 0.01 0 Z';
    const handle = 'M43 18 L 58 6 a 3 3 0 0 1 4 4 L 48 24 Z';
    return sticker(`<path d="${pan}" transform="translate(0 2)"/><path d="${handle}"/>`, `<path d="${handle}" fill="#4a4650" ${ink(3)}/><circle cx="28" cy="33" r="21" fill="#37343c" ${ink()}/><circle cx="28" cy="33" r="16.5" fill="#55515c"/>
<path d="M20 22 c 7 -3 12 2 10 8 c -1 5 -8 8 -13 5 c -5 -3 -3 -11 3 -13 Z" fill="#fbf7ec" ${ink(2)}/><circle cx="22" cy="29" r="4.4" fill="#f6b21c" ${ink(1.8)}/>
<path d="M34 34 c 6 -2 11 2 9 8 c -2 5 -8 6 -12 4 c -4 -3 -2 -10 3 -12 Z" fill="#fbf7ec" ${ink(2)}/><circle cx="37" cy="40" r="4" fill="#f6b21c" ${ink(1.8)}/>
<path d="M33 21 l 10 5 l -2 4 l -10 -5 Z" fill="#c8504c" ${ink(1.8)}/><circle cx="17" cy="42" r="3.6" fill="#e8b84a" ${ink(1.8)}/><circle cx="25" cy="46" r="3" fill="#e8b84a" ${ink(1.8)}/>`);
  },
  // a yellow puddle out of a copper pot
  polenta: () => {
    const pud = 'M8 44 c -3 -8 8 -12 16 -11 c 8 -5 26 -3 31 4 c 5 6 1 16 -8 17 c -7 5 -18 4 -24 1 c -8 1 -13 -4 -15 -11 Z';
    const pot = 'M12 14 l 26 -6 l 7 22 c -6 7 -20 11 -29 7 Z';
    return sticker(`<path d="${pud}"/><path d="${pot}"/>`, `<path d="${pud}" fill="#f2c544" ${ink()}/><circle cx="22" cy="46" r="3.5" fill="#f8d96e"/><circle cx="44" cy="44" r="4.4" fill="#f8d96e"/><circle cx="35" cy="50" r="2.4" fill="#f8d96e"/>
<path d="${pot}" fill="#c8713c" ${ink()}/><path d="M16 37 c 9 4 23 0 29 -7 c 3 4 -4 12 -14 13 c -8 1 -14 -2 -15 -6 Z" fill="#f2c544" ${ink(2.6)}/><path d="M14 18 l -7 -1 l 2 8 l 6 -1" fill="none" ${ink(3)}/>${glint('M19 17 l 9 -2 M21 23 l 5 -1')}`);
  },
  // a wheel of cheese with a wedge cut out
  formaggio: () => {
    const rim = 'M32 7 c 15 0 27 8 27 19 v 13 c 0 11 -12 19 -27 19 s -27 -8 -27 -19 v -13 c 0 -11 12 -19 27 -19 Z';
    return sticker(`<path d="${rim}"/>`, `<path d="${rim}" fill="#d9a441" ${ink()}/><ellipse cx="32" cy="26" rx="27" ry="19" fill="#f8e08c" ${ink()}/>
<path d="M32 26 L 56 17 C 59 21 60 27 56 32 Z" fill="#fff3c0" ${ink(2.6)}/><circle cx="20" cy="22" r="3.4" fill="#e2bd5c"/><circle cx="31" cy="35" r="3" fill="#e2bd5c"/><circle cx="17" cy="33" r="2.2" fill="#e2bd5c"/><path d="M11 42 v 7 M21 46 v 7 M43 46 v 7 M53 42 v 7" stroke="#b6822c" stroke-width="2.6" stroke-linecap="round"/>`);
  },
  // the fruit in soft spikes, with a green wisp
  durian: () => {
    const s = [];
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, r1 = 19, r2 = 25, x = 30, y = 39; s.push(`${(x + Math.cos(a - 0.26) * r1).toFixed(1)} ${(y + Math.sin(a - 0.26) * r1).toFixed(1)} Q ${(x + Math.cos(a) * r2 * 1.04).toFixed(1)} ${(y + Math.sin(a) * r2 * 1.04).toFixed(1)} ${(x + Math.cos(a + 0.26) * r1).toFixed(1)} ${(y + Math.sin(a + 0.26) * r1).toFixed(1)}`); }
    const d = `M${s.join(' L ')} Z`, w = 'M44 22 c 7 -3 3 -8 7 -11 c 3 -2 7 0 6 4';
    return sticker(`<path d="${d}"/><path d="${w}" fill="none" stroke-width="13"/>`, `<path d="${d}" fill="#94b03f" ${ink()}/><path d="M19 32 l 6 5 l -6 6 M30 26 l 5 6 l -5 6 M40 36 l -6 5 l 6 6 M26 49 l 6 -4" fill="none" stroke="#6d8a2a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
<path d="${w}" fill="none" stroke="${INK}" stroke-width="7.5" stroke-linecap="round"/><path d="${w}" fill="none" stroke="#b7d35a" stroke-width="3.6" stroke-linecap="round"/>${glint('M17 26 q3 -3 7 -4', 2.6)}`);
  },
  // a chilli over the stone bowl
  sambal: () => {
    const bowl = 'M8 36 h 48 c 0 12 -10 20 -24 20 s -24 -8 -24 -20 Z';
    const chili = 'M51 6 c -8 -1 -13 3 -15 9 c -3 7 -11 12 -22 12 c 8 5 21 4 29 -3 c 6 -5 9 -11 8 -18 Z';
    return sticker(`<path d="${bowl}"/><path d="${chili}"/>`, `<path d="${bowl}" fill="#8c8791" ${ink()}/><path d="M9 36 c 6 -5 40 -5 46 0 c -8 4 -38 4 -46 0 Z" fill="#d7321c" ${ink(2.4)}/><path d="M14 45 q5 6 13 7" fill="none" stroke="#bdb8c2" stroke-width="2.6" stroke-linecap="round"/>
<path d="${chili}" fill="#e4331e" ${ink()}/><path d="M51 6 c 3 -3 6 -3 7 -3 M45 9 c 2 -3 6 -4 10 -2 c -1 4 -5 7 -8 5 Z" fill="#62c56e" ${ink(2.4)}/>${glint('M34 19 q-3 4 -8 6', 2.6)}`);
  },
  // a clay pot of dark rendang with a smell rising
  rendang: () => {
    const pot = 'M10 28 h 44 c 3 12 -2 28 -14 28 h -16 c -12 0 -17 -16 -14 -28 Z';
    const w = 'M22 22 c -5 -5 5 -7 0 -14 M42 22 c -5 -5 5 -7 0 -14';
    return sticker(`<path d="${pot}"/><path d="${w}" fill="none" stroke-width="13"/>`, `<path d="${w}" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="${w}" fill="none" stroke="#f4dcb8" stroke-width="3.4" stroke-linecap="round"/>
<path d="${pot}" fill="#b4653a" ${ink()}/><path d="M7 27 c 12 -5 38 -5 50 0 c -2 5 -48 5 -50 0 Z" fill="#5c2a18" ${ink(2.8)}/><circle cx="24" cy="26" r="3.4" fill="#7a3a20"/><circle cx="36" cy="27" r="4" fill="#7a3a20"/><path d="M10 37 h -6 c -2 0 -2 7 3 7 h 4 M54 37 h 6 c 2 0 2 7 -3 7 h -4" fill="none" ${ink(2.8)}/>${glint('M17 37 q0 6 3 11', 2.8)}`);
  },
  // boulders tumbling past a warning triangle
  frana: () => {
    const a = 'M22 32 c 9 -3 18 3 17 13 c -1 10 -13 15 -22 10 c -8 -5 -5 -20 5 -23 Z';
    const b = 'M42 39 c 6 -2 13 1 13 8 c 0 7 -8 10 -14 7 c -5 -3 -4 -13 1 -15 Z';
    const tri = 'M36 5 L 54 32 H 18 Z';
    return sticker(`<path d="${tri}"/><path d="${a}"/><path d="${b}"/>`, `<path d="${tri}" fill="#f6c23e" ${ink()}/><path d="M36 15 v 9" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><circle cx="36" cy="28.5" r="2.2" fill="${INK}"/>
<path d="${a}" fill="#b3abb0" ${ink()}/><path d="${b}" fill="#9c9498" ${ink()}/>${glint('M17 40 q2 -4 6 -5', 2.8)}`);
  },
};

export function itemIcon(id) {
  const f = ITEMS[id];
  return f ? f() : '';
}
export const ITEM_ICON_IDS = Object.keys(ITEMS);

// The two sides of a team championship, the same badge on TV and phone: a chilli, a gentian.
const CHILLI = '<path d="M41 19 C 28 19 18 30 13 50 C 30 49 45 39 48 27 C 49 23 46 19 41 19 Z" fill="#e5412a" stroke="#241c26" stroke-width="3.6" stroke-linejoin="round"/><path d="M41 19 C 42 15 45 12 50 11" fill="none" stroke="#241c26" stroke-width="8" stroke-linecap="round"/><path d="M41 19 C 42 15 45 12 50 11" fill="none" stroke="#4fae4a" stroke-width="3.6" stroke-linecap="round"/><path d="M36 27 C 30 29 26 33 23 38" fill="none" stroke="#ffb6a0" stroke-width="3.2" stroke-linecap="round"/>';
const GENTIAN = `${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="32" cy="19" rx="8.6" ry="12.5" transform="rotate(${a} 32 32)" fill="#2f6fe8" stroke="#241c26" stroke-width="3.2"/>`).join('')}<circle cx="32" cy="32" r="7.4" fill="#ffe27a" stroke="#241c26" stroke-width="3.2"/>`;
export function teamIcon(id) {
  const a = id === 'a';
  return `<svg class="teamic" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" fill="${a ? '#fff3e8' : '#eef4ff'}" stroke="#241c26" stroke-width="4"/>${a ? CHILLI : GENTIAN}</svg>`;
}

// Flags are rounded little pennons on a pole: the three regions of the game.
const FLAGS = {
  cadore: ['#2f9e4f', '#fbf8ef', '#d8362e'],      // Italy
  italy: ['#2f9e4f', '#fbf8ef', '#d8362e'],
  romania: ['#2a54a8', '#f6c23e', '#d13a2d'],
};
export function flag(region) {
  const edge = 'M6 12 q 13 -6 26 0 t 26 0 v 34 q -13 6 -26 0 t -26 0 Z';
  const body = (art) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 58" aria-hidden="true"><defs><clipPath id="fc-${region}"><path d="${edge}"/></clipPath></defs><path d="${edge}" fill="#fff" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><g clip-path="url(#fc-${region})">${art}</g><path d="${edge}" fill="none" ${ink()}/></svg>`;
  if (region === 'indonesia') return body('<rect x="0" y="0" width="64" height="29" fill="#d8362e"/><rect x="0" y="29" width="64" height="30" fill="#fbf8ef"/>');
  const c = FLAGS[region];
  if (!c) return '';
  return body(`<rect x="0" y="0" width="22" height="58" fill="${c[0]}"/><rect x="22" y="0" width="20" height="58" fill="${c[1]}"/><rect x="42" y="0" width="22" height="58" fill="${c[2]}"/>`);
}

// Small interface icons in the same hand: one word each, used on menus and the HUD.
const UI = {
  play: () => ['M18 10 L 52 30 a 3 3 0 0 1 0 5 L 18 54 a 3 3 0 0 1 -5 -3 V 13 a 3 3 0 0 1 5 -3 Z', '#62c56e'],
  back: () => ['M38 10 L 14 32 L 38 54 V 42 H 54 V 22 H 38 Z', '#f6c23e'],
  next: () => ['M26 10 L 50 32 L 26 54 V 42 H 10 V 22 H 26 Z', '#f6c23e'],
  check: () => ['M10 34 L 24 50 L 54 16 L 47 10 L 24 36 L 16 27 Z', '#62c56e'],
  close: () => ['M14 8 L 32 25 L 50 8 L 57 15 L 39 32 L 57 49 L 50 56 L 32 39 L 14 56 L 7 49 L 25 32 L 7 15 Z', '#d8362e'],
  lock: () => ['M16 28 V 20 c 0 -20 32 -20 32 0 V 28 h 4 a 3 3 0 0 1 3 3 V 54 a 3 3 0 0 1 -3 3 H 12 a 3 3 0 0 1 -3 -3 V 31 a 3 3 0 0 1 3 -3 Z M 24 28 h 16 V 20 c 0 -10 -16 -10 -16 0 Z', '#f6c23e'],
  star: () => ['M32 6 L 40 23 L 58 25 L 45 38 L 48 56 L 32 47 L 16 56 L 19 38 L 6 25 L 24 23 Z', '#f6c23e'],
  trophy: () => ['M18 6 H 46 V 12 H 58 C 58 26 52 32 44 33 C 42 38 38 41 36 42 V 48 H 44 V 57 H 20 V 48 H 28 V 42 C 26 41 22 38 20 33 C 12 32 6 26 6 12 H 18 Z M 46 19 V 26 C 49 25 51 23 51 19 Z M 18 19 H 13 C 13 23 15 25 18 26 Z', '#f6c23e'],
  flagCheck: () => ['M12 6 V 58 M12 8 C 28 2 38 16 56 8 V 36 C 38 44 28 30 12 36', '#fbf8ef', '<path d="M12 8 C 17 6 21 6 26 8 V 21 C 21 19 17 19 12 21 Z M40 11 C 45 12 50 11 56 8 V 21 C 50 24 45 25 40 24 Z M26 21 C 31 23 35 24 40 24 V 37 C 35 37 31 35 26 33 Z" fill="#241c26"/>'],
  dice: () => ['M12 6 H 52 a 6 6 0 0 1 6 6 V 52 a 6 6 0 0 1 -6 6 H 12 a 6 6 0 0 1 -6 -6 V 12 a 6 6 0 0 1 6 -6 Z', '#fbf8ef', '<circle cx="21" cy="21" r="4.5" fill="#241c26"/><circle cx="43" cy="21" r="4.5" fill="#241c26"/><circle cx="32" cy="32" r="4.5" fill="#241c26"/><circle cx="21" cy="43" r="4.5" fill="#241c26"/><circle cx="43" cy="43" r="4.5" fill="#241c26"/>'],
  phone: () => ['M20 4 H 44 a 5 5 0 0 1 5 5 V 55 a 5 5 0 0 1 -5 5 H 20 a 5 5 0 0 1 -5 -5 V 9 a 5 5 0 0 1 5 -5 Z', '#4aa6f2', '<rect x="20" y="12" width="24" height="36" rx="2" fill="#dff1fa"/><circle cx="32" cy="54" r="2.6" fill="#241c26"/>'],
  mountain: () => ['M4 54 L 24 16 L 33 30 L 42 20 L 60 54 Z', '#b3abb0', '<path d="M18 28 L 24 16 L 30 26 L 26 24 L 23 28 L 20 25 Z" fill="#fff"/>'],
  clock: () => ['M32 6 a 26 26 0 1 0 0.01 0 Z', '#fbf8ef', '<path d="M32 16 V 33 L 42 40" fill="none" stroke="#241c26" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/>'],
  bot: () => ['M16 22 H 48 a 6 6 0 0 1 6 6 V 50 a 6 6 0 0 1 -6 6 H 16 a 6 6 0 0 1 -6 -6 V 28 a 6 6 0 0 1 6 -6 Z', '#8fd3ea', '<circle cx="24" cy="38" r="5" fill="#241c26"/><circle cx="40" cy="38" r="5" fill="#241c26"/><path d="M32 22 V 10" stroke="#241c26" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="9" r="4" fill="#f6c23e" stroke="#241c26" stroke-width="3"/>'],
  sound: () => ['M8 24 H 20 L 34 10 V 54 L 20 40 H 8 Z', '#f6c23e', '<path d="M42 22 c 5 5 5 15 0 20 M49 15 c 9 9 9 25 0 34" fill="none" stroke="#241c26" stroke-width="4.4" stroke-linecap="round"/>'],
};
export function uiIcon(name) {
  const f = UI[name];
  if (!f) return '';
  const [d, fill, extra = ''] = f();
  const open = name === 'flagCheck';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true"><path d="${d}" fill="#fff" stroke="#fff" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/><path d="${d}" fill="${fill}" ${ink(open ? 4 : 3.4)}/>${extra}</svg>`;
}
export const UI_ICON_NAMES = Object.keys(UI);
