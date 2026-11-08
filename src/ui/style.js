// TV screen styles. Everything is sized on a 1920x1080 stage through --u (one design pixel), so the screens fit any window
// and read from the sofa. A warm chunky sticker world: Fredoka, white type with a dark outline, cream cards, fat borders, soft
// shadows, things that bounce. No text below 18 design px on the menus (13.5 px at 1440x900), none below 13 px in a 4-way HUD.
import { FREDOKA_WOFF2 } from './font-data.js';
import { TEAM_CSS } from './screens/teamstyle.js';
import { WEATHER_CSS } from './screens/weatherstyle.js';
import { FORMA_CSS } from './screens/forma.js';

const u = (n) => `calc(var(--u) * ${n})`;

// A round outline drawn with text shadows, for the biggest numerals: a text stroke leaves notches where the variable font's
// contours overlap.
function outline(r, drop = 12) {
  const ring = (rad, n) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return `${u((Math.cos(a) * rad).toFixed(2))} ${u((Math.sin(a) * rad).toFixed(2))} 0 var(--ink)`;
  });
  return [...ring(r, 28), ...ring(r * 0.6, 14), `0 ${u(drop)} ${u(drop * 1.6)} rgba(30, 20, 40, 0.32)`].join(', ');
}

export const SEAT_COLORS = [
  { main: '#4aa6f2', light: '#c4e5ff', dark: '#1d5a9c', glow: '74, 166, 242' },
  { main: '#f28bbd', light: '#ffd9ea', dark: '#a83c74', glow: '242, 139, 189' },
  { main: '#f6c23e', light: '#ffeeb8', dark: '#a87a10', glow: '246, 194, 62' },
  { main: '#62c56e', light: '#cdf2cf', dark: '#2a7f38', glow: '98, 197, 110' },
];
const seatVars = SEAT_COLORS.map((c, i) => `.rk [data-seat="${i}"] { --c: ${c.main}; --cl: ${c.light}; --cd: ${c.dark}; --cg: ${c.glow}; }`).join('\n');

export const CSS = `
@font-face { font-family: "RK Fredoka"; font-weight: 300 700; font-display: block; src: url(data:font/woff2;base64,${FREDOKA_WOFF2}) format("woff2"); }
.rk { --u0: min(calc(100vw / 1920), calc(100vh / 1080)); --u: var(--u0); --ink: #1d1f2b; --cream: #fff6e6; --paper: #fffdf7; --wood: #c98d4f; --woodd: #a8703a;
  --shadow: 0 ${u(10)} 0 rgba(58, 34, 56, 0.2), 0 ${u(18)} ${u(38)} rgba(58, 34, 56, 0.26);
  position: fixed; inset: 0; overflow: hidden; pointer-events: none; z-index: 10;
  font-family: "RK Fredoka", "Fredoka", ui-rounded, "SF Pro Rounded", system-ui, sans-serif; font-weight: 600;
  color: var(--ink); -webkit-font-smoothing: antialiased; user-select: none; -webkit-user-select: none; line-height: 1.15; }
.rk *, .rk *::before, .rk *::after { box-sizing: border-box; }
.rk svg { display: block; overflow: visible; }
.rk button { font: inherit; color: inherit; cursor: pointer; pointer-events: auto; border: 0; background: none; padding: 0; }
.rk .hide { display: none !important; }
${seatVars}

/* outlined white type */
.rk .ink { color: #fff; -webkit-text-stroke: ${u(9)} var(--ink); paint-order: stroke fill; font-weight: 700; letter-spacing: ${u(0.6)};
  text-shadow: 0 ${u(5)} 0 rgba(29, 31, 43, 0.25); }
.rk .card { background: var(--paper); border: ${u(5)} solid var(--ink); border-radius: ${u(38)}; box-shadow: var(--shadow); }
.rk .pill { display: inline-flex; align-items: center; gap: ${u(10)}; padding: ${u(8)} ${u(22)}; border-radius: ${u(999)}; background: var(--paper);
  border: ${u(4)} solid var(--ink); box-shadow: 0 ${u(5)} 0 rgba(58, 34, 56, 0.2); font-size: ${u(24)}; }

.rk .scr { position: absolute; inset: 0; overflow: hidden; }
.rk .bg { position: absolute; inset: 0; background: #f4c0d2; }
.rk .bg .scene { position: absolute; inset: 0; width: 100%; height: 100%; }
.rk .clouds { position: absolute; inset: 0; overflow: hidden; }
.rk .cloud { position: absolute; left: 0; animation: rk-drift 120s linear infinite; will-change: transform; }
.rk .cloud svg { width: 100%; height: auto; }
/* the 1920x1080 stage every menu is laid out on, centred on any window */
.rk .stage { position: absolute; left: 50%; top: 50%; width: ${u(1920)}; height: ${u(1080)}; transform: translate(-50%, -50%); }
.rk .stage > * { position: absolute; }
.rk .scr.enter .pop { animation: rk-pop-in 0.55s cubic-bezier(0.3, 1.55, 0.5, 1) both; }
.rk .scr.enter .slide { animation: rk-slide-in 0.5s cubic-bezier(0.25, 1.3, 0.5, 1) both; }

.rk .bigbtn { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: ${u(2)};
  border-radius: ${u(36)}; border: ${u(5)} solid var(--ink); background: var(--paper); box-shadow: var(--shadow), inset 0 ${u(-10)} 0 rgba(58, 34, 56, 0.1);
  transition: transform 0.12s cubic-bezier(0.3, 1.6, 0.5, 1), filter 0.2s; overflow: hidden; }
.rk .bigbtn:hover { transform: translateY(${u(-4)}) scale(1.015); }
.rk .bigbtn:active { transform: translateY(${u(4)}); }
.rk .bigbtn b { font-size: ${u(42)}; font-weight: 700; }
.rk .bigbtn span { font-size: ${u(22)}; font-weight: 500; opacity: 0.74; }
.rk .bigbtn.green { background: linear-gradient(180deg, #9be882 0%, #55c460 100%); box-shadow: var(--shadow), inset 0 ${u(-12)} 0 rgba(0, 60, 20, 0.18), inset 0 ${u(8)} 0 rgba(255, 255, 255, 0.35); }
.rk .bigbtn.green span { color: #123a1c; opacity: 0.9; font-weight: 600; }
.rk .bigbtn.gold { background: linear-gradient(180deg, #ffe88f 0%, #ffc33f 100%); box-shadow: var(--shadow), inset 0 ${u(-12)} 0 rgba(120, 70, 0, 0.18), inset 0 ${u(8)} 0 rgba(255, 255, 255, 0.4); }
.rk .bigbtn .fill { position: absolute; left: 0; bottom: 0; height: ${u(12)}; width: 0; background: var(--ink); opacity: 0.55; }
.rk .bigbtn .ink { -webkit-text-stroke-width: ${u(9)}; }

.rk .langs { display: flex; padding: ${u(6)}; gap: ${u(4)}; border-radius: ${u(999)}; background: var(--paper); border: ${u(4)} solid var(--ink); box-shadow: 0 ${u(5)} 0 rgba(58, 34, 56, 0.2); }
.rk .langs button { font-size: ${u(26)}; font-weight: 700; padding: ${u(6)} ${u(20)}; border-radius: ${u(999)}; opacity: 0.55; transition: background 0.2s, opacity 0.2s; }
.rk .langs button.on { background: var(--ink); color: #fff; opacity: 1; }

/* ---------- lobby ---------- */
.rk .lobby .logo { left: ${u(540)}; top: ${u(4)}; width: ${u(840)}; filter: drop-shadow(0 ${u(6)} ${u(6)} rgba(58, 34, 56, 0.2)); animation: rk-sway 5s ease-in-out infinite; transform-origin: 50% 60%; }
.rk .lobby .langs { right: ${u(44)}; top: ${u(34)}; }
.rk .lobby .tag { left: ${u(44)}; top: ${u(44)}; max-width: ${u(440)}; font-size: ${u(23)}; font-weight: 600; line-height: 1.2; border-radius: ${u(26)}; padding: ${u(12)} ${u(24)}; transform: rotate(-1.5deg); }
.rk .join { left: ${u(44)}; top: ${u(190)}; width: ${u(540)}; height: ${u(676)}; padding: ${u(18)} ${u(26)} ${u(14)}; display: flex; flex-direction: column; align-items: center; gap: ${u(10)}; background: linear-gradient(180deg, #fffdf7 0%, #fff4df 100%); }
.rk .join h2 { margin: 0; font-size: ${u(42)}; line-height: 1.05; font-weight: 700; display: flex; align-items: center; gap: ${u(12)}; white-space: nowrap; }
.rk .join h2 .phone { width: ${u(30)}; flex: none; transform: rotate(-8deg); }
.rk .join .qr { position: relative; width: ${u(412)}; height: ${u(412)}; flex: none; padding: ${u(14)}; background: #fff; border-radius: ${u(30)}; border: ${u(5)} solid var(--ink); }
.rk .join .qr img { display: block; width: 100%; height: 100%; image-rendering: pixelated; }
.rk .join .qr::before, .rk .join .qr::after { content: ""; position: absolute; width: ${u(52)}; height: ${u(22)}; background: rgba(255, 210, 63, 0.88); border: ${u(3)} solid rgba(29, 31, 43, 0.5); border-radius: ${u(4)}; }
.rk .join .qr::before { left: ${u(-22)}; top: ${u(-6)}; transform: rotate(-38deg); }
.rk .join .qr::after { right: ${u(-22)}; top: ${u(-6)}; transform: rotate(38deg); }
.rk .join .url { font-size: ${u(26)}; font-weight: 700; padding: ${u(4)} ${u(16)}; border-radius: ${u(14)}; background: #eaf4ff; border: ${u(3)} solid rgba(29, 31, 43, 0.2); white-space: nowrap; letter-spacing: ${u(0.2)}; }
.rk .join .small { display: flex; align-items: center; justify-content: center; gap: ${u(10)}; font-size: ${u(20)}; font-weight: 500; opacity: 0.86; text-align: center; line-height: 1.12; }
.rk .join .small .wifi { width: ${u(30)}; flex: none; }

.rk .seats { left: ${u(612)}; top: ${u(196)}; width: ${u(1264)}; height: ${u(226)}; display: grid; grid-template-columns: repeat(4, 1fr); gap: ${u(20)}; }
.rk .seat { position: relative; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: ${u(6)}; padding: ${u(8)};
  border-radius: ${u(36)}; border: ${u(5)} dashed rgba(29, 31, 43, 0.5); background: rgba(255, 250, 240, 0.8); transition: background 0.3s, border-color 0.3s; }
.rk .seat .helmet { width: ${u(96)}; }
.rk .seat .sn { font-size: ${u(30)}; -webkit-text-stroke-width: ${u(7)}; white-space: nowrap; }
.rk .seat .st { display: inline-flex; align-items: center; gap: ${u(8)}; font-size: ${u(22)}; padding: ${u(6)} ${u(16)}; border-radius: ${u(999)}; background: rgba(255, 253, 247, 0.92); border: ${u(3)} solid var(--ink); white-space: nowrap; }
.rk .seat .st .check { width: ${u(26)}; display: none; }
.rk .seat .st .phone { width: ${u(14)}; display: none; }
.rk .seat .st .keycap { width: ${u(30)}; display: none; }
.rk .seat .num { position: absolute; left: ${u(16)}; top: ${u(12)}; width: ${u(48)}; height: ${u(48)}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: ${u(28)}; font-weight: 700; background: rgba(255, 253, 247, 0.85); border: ${u(3)} solid var(--ink); }
.rk .seat.on { border: ${u(5)} solid var(--ink); background: radial-gradient(120% 90% at 50% 26%, var(--cl) 0%, var(--c) 70%, var(--cd) 140%);
  box-shadow: var(--shadow), 0 0 ${u(50)} rgba(var(--cg), 0.6), inset 0 ${u(-12)} 0 rgba(0, 0, 0, 0.1), inset 0 ${u(7)} 0 rgba(255, 255, 255, 0.35); }
.rk .seat.on .helmet { filter: none; animation: rk-bob 2.2s ease-in-out infinite; }
.rk .seat.on .num { background: var(--paper); }
.rk .seat.on .st .check { display: block; }
.rk .seat.pad .st .phone { display: block; }
.rk .seat.kb .st .keycap { display: block; }
.rk .seat.kb .st .check { display: none; }
.rk .seat.away { border-style: solid; border-color: var(--ink); background: rgba(255, 253, 247, 0.62); }
.rk .seat.away .helmet { filter: grayscale(0.5); }
.rk .seat.just { animation: rk-pop-in 0.6s cubic-bezier(0.3, 1.6, 0.5, 1) both; }

.rk .opts { left: ${u(612)}; top: ${u(438)}; width: ${u(858)}; height: ${u(326)}; padding: ${u(14)} ${u(28)}; display: flex; flex-direction: column; justify-content: space-between; }
.rk .optrow { display: grid; grid-template-columns: ${u(180)} 1fr; align-items: center; gap: ${u(12)}; }
.rk .optrow > label { font-size: ${u(30)}; font-weight: 700; }
.rk .chips { display: flex; gap: ${u(10)}; align-items: stretch; }
.rk .chip { flex: 1; min-width: 0; height: ${u(62)}; padding: 0 ${u(8)}; font-size: ${u(28)}; font-weight: 700; border-radius: ${u(22)}; border: ${u(4)} solid var(--ink); background: #f7ecd9;
  box-shadow: inset 0 ${u(-6)} 0 rgba(58, 34, 56, 0.12); white-space: nowrap; transition: transform 0.14s cubic-bezier(0.3, 1.8, 0.5, 1), background 0.16s; display: flex; align-items: center; justify-content: center; gap: ${u(8)}; }
.rk .chip:hover { transform: translateY(${u(-2)}); }
.rk .chip.on { background: var(--on, #ffd23f); transform: translateY(${u(-3)}) scale(1.03); box-shadow: 0 ${u(5)} 0 var(--ink), inset 0 ${u(5)} 0 rgba(255, 255, 255, 0.45); }
.rk .chip[data-v="easy"] { --on: #9be882; } .rk .chip[data-v="medium"] { --on: #ffd23f; } .rk .chip[data-v="hard"] { --on: #ff8a6a; }
.rk .chip.narrow { flex: 0 0 ${u(110)}; }
/* five languages of commentary: each chip as wide as its name, at the size of the mode and weather rows, so "Indonesia" is never cut */
.rk .lobby .chips[data-key="voice"] { gap: ${u(6)}; }
.rk .lobby .chips[data-key="voice"] .chip { flex: 1 1 auto; min-width: max-content; padding: 0 ${u(7)}; font-size: ${u(22)}; }
.rk .stepper { display: flex; align-items: center; gap: ${u(12)}; }
.rk .stepper button { width: ${u(62)}; height: ${u(62)}; flex: none; font-size: ${u(44)}; font-weight: 700; line-height: 1; border-radius: 50%; border: ${u(4)} solid var(--ink); background: #f7ecd9; box-shadow: inset 0 ${u(-6)} 0 rgba(58, 34, 56, 0.12); transition: transform 0.14s; }
.rk .stepper button:active { transform: scale(0.92); }
.rk .stepper b { width: ${u(68)}; text-align: center; font-size: ${u(50)}; font-weight: 700; font-variant-numeric: tabular-nums; }
.rk .stepper .botrow { display: flex; gap: ${u(4)}; margin-left: ${u(4)}; }
.rk .stepper .botrow .helmet { width: ${u(30)}; }
.rk .stepper .botrow .helmet.off { opacity: 0.2; filter: grayscale(1); }

.rk .lobby .gobtn { left: ${u(1490)}; top: ${u(438)}; width: ${u(386)}; height: ${u(326)}; }
.rk .lobby .gobtn b { font-size: ${u(112)}; line-height: 1.05; }
.rk .lobby .gobtn span { font-size: ${u(28)}; font-weight: 700; color: #0f2e16; opacity: 1; text-align: center; padding: 0 ${u(18)}; line-height: 1.15; }
.rk .lobby .gobtn.ready { animation: rk-breathe 1.8s ease-in-out infinite; }
.rk .lobby .wait { left: 50%; bottom: ${u(12)}; translate: -50% 0; z-index: 3; }
/* the parked karts on the road across the bottom */
.rk .parked { position: absolute; inset: 0; pointer-events: none; }
.rk .parked .pk { position: absolute; width: calc(var(--u) * var(--w, 300)); height: calc(var(--u) * var(--w, 300)); transform: translate(-50%, -100%); }
.rk .parked .pk canvas { width: 100%; height: 100%; display: block; animation: rk-idle 1.3s ease-in-out infinite; animation-delay: var(--d, 0s); transform-origin: 50% 80%; }
.rk .parked .pk::before { content: ""; position: absolute; left: 14%; right: 14%; bottom: 13%; height: 13%; border-radius: 50%; background: rgba(40, 24, 50, 0.3); }
.rk .parked .pk.hop canvas { animation: rk-hop 0.7s cubic-bezier(0.3, 1.4, 0.5, 1) both; }

/* ---------- kart pick ---------- */
.rk .tbar { left: 0; right: 0; top: ${u(12)}; display: flex; flex-direction: column; align-items: center; gap: ${u(2)}; }
.rk .tbar h1 { margin: 0; font-size: ${u(72)}; line-height: 1.05; -webkit-text-stroke-width: ${u(12)}; }
.rk .tbar .sub { font-size: ${u(23)}; padding: ${u(5)} ${u(20)}; font-weight: 600; margin-top: ${u(4)}; }
.rk .pick .grid { left: ${u(46)}; right: ${u(46)}; top: ${u(146)}; display: flex; flex-wrap: wrap; justify-content: center; gap: ${u(14)} ${u(20)}; }
.rk .pick .grid.many .kc { width: ${u(284)}; }
.rk .pick .secret { position: absolute; right: ${u(46)}; top: ${u(26)}; max-width: ${u(420)}; font-size: ${u(21)}; line-height: 1.15; font-weight: 600; padding: ${u(8)} ${u(18)}; text-align: center; }
.rk .kc.family .awn { filter: hue-rotate(290deg) saturate(1.2); }
.rk .podscr .unlockc { position: absolute; left: ${u(36)}; top: ${u(150)}; width: ${u(330)}; padding: ${u(14)}; display: flex; flex-direction: column; align-items: center; text-align: center; background: var(--paper); border: ${u(5)} solid var(--ink); border-radius: ${u(28)}; transform: rotate(-3deg); z-index: 3; box-shadow: 0 ${u(8)} 0 var(--ink); animation: rk-pop-in 0.55s cubic-bezier(0.3, 1.55, 0.5, 1) both; }
.rk .podscr .unlockc img { width: ${u(250)}; height: ${u(250)}; object-fit: contain; }
.rk .podscr .unlockc b { font-size: ${u(30)}; line-height: 1.05; font-weight: 700; color: #c23a2c; }
.rk .podscr .unlockc strong { font-size: ${u(30)}; font-weight: 700; margin-top: ${u(4)}; }
.rk .podscr .unlockc span { font-size: ${u(20)}; font-weight: 500; line-height: 1.15; opacity: 0.85; }
.rk .kc { --ring: 0 0 0 0 transparent; --stripe: #e0483d; position: relative; width: ${u(348)}; height: ${u(302)}; display: flex; flex-direction: column; background: var(--paper); border: ${u(5)} solid var(--ink); border-radius: ${u(30)};
  box-shadow: var(--ring), var(--shadow); transition: transform 0.22s cubic-bezier(0.3, 1.6, 0.5, 1), box-shadow 0.18s; text-align: left; overflow: visible; }
.rk .kc:hover { transform: translateY(${u(-5)}); }
.rk .kc[data-region="cadore"] { --stripe: #d9663a; } .rk .kc[data-region="romania"] { --stripe: #3e6fc4; } .rk .kc[data-region="indonesia"] { --stripe: #1f9c8a; }
.rk .kc .awn { position: absolute; left: ${u(-2)}; right: ${u(-2)}; top: ${u(-2)}; height: ${u(30)}; border-radius: ${u(26)} ${u(26)} 0 0; border-bottom: ${u(4)} solid var(--ink);
  background: repeating-linear-gradient(90deg, var(--stripe) 0 ${u(30)}, #fff6e6 ${u(30)} ${u(60)}); }
.rk .kc .turn { position: absolute; left: 0; right: 0; top: ${u(24)}; height: ${u(202)}; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.rk .kc .turn::before { content: ""; position: absolute; left: 50%; bottom: ${u(8)}; width: ${u(248)}; height: ${u(66)}; transform: translateX(-50%); border-radius: 50%; background: radial-gradient(closest-side, #e7c28e 0%, #c98d4f 78%, #a8703a 100%); border: ${u(4)} solid var(--ink); box-shadow: 0 ${u(7)} 0 #7a4b2c; }
.rk .kc .turn canvas { position: relative; width: ${u(250)}; height: ${u(250)}; margin-top: ${u(-6)}; display: block; }
.rk .kc .cap { position: absolute; left: ${u(14)}; right: ${u(14)}; bottom: ${u(8)}; display: flex; flex-direction: column; }
.rk .kc .kn { font-size: ${u(30)}; font-weight: 700; line-height: 1.05; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rk .kc .kd { font-size: ${u(20)}; font-weight: 500; opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rk .kc .pins { position: absolute; right: ${u(-8)}; top: ${u(-14)}; display: flex; flex-direction: row-reverse; pointer-events: none; }
.rk .kc .pin { width: ${u(64)}; margin-left: ${u(-22)}; position: relative; opacity: 0; transform: translateY(${u(-20)}) scale(0.5); transition: opacity 0.18s, transform 0.3s cubic-bezier(0.3, 1.7, 0.5, 1); display: none; }
.rk .kc .pin .helmet { width: 100%; filter: drop-shadow(0 ${u(3)} ${u(3)} rgba(29, 31, 43, 0.4)); }
.rk .kc .pin .check { position: absolute; right: ${u(-6)}; bottom: ${u(-2)}; width: ${u(30)}; display: none; }
.rk .kc .pin.on { display: block; opacity: 1; transform: none; }
.rk .kc .pin.done .check { display: block; }
.rk .kc.f0 { --ring: 0 0 0 ${u(7)} ${SEAT_COLORS[0].main}; } .rk .kc.f1 { --ring: 0 0 0 ${u(7)} ${SEAT_COLORS[1].main}; }
.rk .kc.f2 { --ring: 0 0 0 ${u(7)} ${SEAT_COLORS[2].main}; } .rk .kc.f3 { --ring: 0 0 0 ${u(7)} ${SEAT_COLORS[3].main}; }
.rk .kc.fx { transform: translateY(${u(-6)}) scale(1.02); z-index: 2; }
.rk .pbar { left: ${u(46)}; right: ${u(46)}; bottom: ${u(16)}; height: ${u(290)}; display: flex; justify-content: center; gap: ${u(18)}; }
.rk .pbar.tall { height: ${u(294)}; }
.rk .sp { position: relative; flex: 1 1 0; min-width: 0; max-width: ${u(700)}; display: grid; grid-template-columns: ${u(92)} 1fr; grid-template-rows: auto auto 1fr; column-gap: ${u(12)}; padding: ${u(12)} ${u(18)}; border-radius: ${u(30)}; border: ${u(5)} solid var(--ink);
  background: radial-gradient(120% 120% at 20% 0%, var(--cl) 0%, var(--paper) 62%); box-shadow: var(--shadow); }
.rk .sp .helmet { width: ${u(88)}; grid-row: 1 / 3; align-self: start; }
.rk .sp .pn { font-size: ${u(22)}; font-weight: 600; color: var(--cd); line-height: 1.05; }
.rk .sp .kname { font-size: ${u(32)}; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.1; }
.rk .sp .line { grid-column: 1 / 3; font-size: ${u(19)}; font-weight: 500; line-height: 1.13; margin-top: ${u(2)}; min-height: ${u(44)}; opacity: 0.86; }
.rk .sp .stats { grid-column: 1 / 3; display: flex; flex-direction: column; justify-content: flex-end; gap: ${u(3)}; }
.rk .stat { display: grid; grid-template-columns: ${u(104)} 1fr; align-items: center; gap: ${u(6)}; font-size: ${u(19)}; font-weight: 600; }
.rk .stat .bars { display: grid; grid-template-columns: repeat(5, 1fr); gap: ${u(3)}; }
.rk .stat .bars i { height: ${u(17)}; border-radius: ${u(6)}; border: ${u(3)} solid var(--ink); background: #f1e6d3; transition: background 0.2s; }
.rk .stat .bars i.on { background: var(--c); box-shadow: inset 0 ${u(3)} 0 rgba(255, 255, 255, 0.45); }
.rk .sp .stamp { position: absolute; right: ${u(-6)}; top: ${u(-10)}; padding: ${u(4)} ${u(14)}; display: flex; align-items: center; gap: ${u(6)}; font-size: ${u(24)}; font-weight: 700; background: #9be882; border: ${u(4)} solid var(--ink); border-radius: ${u(999)}; transform: rotate(4deg); opacity: 0; }
.rk .sp .stamp .check { display: none; }
.rk .sp.ready .stamp { opacity: 1; animation: rk-stamp 0.4s cubic-bezier(0.3, 1.8, 0.5, 1) both; }
.rk .sp.ready { box-shadow: 0 0 0 ${u(6)} var(--c), var(--shadow); }
.rk .sp.away { filter: grayscale(0.7); }
/* with one or two players the panel is wide: stats beside the words */
.rk .pbar.wide .sp { grid-template-columns: ${u(100)} 1fr 1.1fr; grid-template-rows: auto auto 1fr; }
.rk .pbar.wide .sp .helmet { width: ${u(96)}; }
.rk .pbar.wide .sp .stats { grid-column: 3; grid-row: 1 / 4; justify-content: center; }
.rk .pbar.wide .sp .line { grid-column: 1 / 3; }

/* ---------- track vote ---------- */
.rk .vote .grid { left: ${u(46)}; right: ${u(46)}; top: ${u(136)}; bottom: ${u(190)}; display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(2, 1fr); gap: ${u(20)}; }
.rk .vote.gp .grid { right: ${u(574)}; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(3, 1fr); gap: ${u(14)}; bottom: ${u(26)}; }
.rk .tc { --ring: 0 0 0 0 transparent; position: relative; min-width: 0; min-height: 0; display: flex; flex-direction: column; padding: 0; background: var(--paper); border: ${u(5)} solid var(--ink); border-radius: ${u(30)}; box-shadow: var(--ring), var(--shadow); text-align: left;
  transition: transform 0.24s cubic-bezier(0.3, 1.6, 0.5, 1), box-shadow 0.18s, filter 0.3s; }
.rk .tc:hover { transform: translateY(${u(-5)}); }
.rk .tc .pic { position: relative; flex: 1; min-height: 0; border-radius: ${u(24)} ${u(24)} 0 0; overflow: hidden; border-bottom: ${u(4)} solid var(--ink); }
.rk .tc .pic .tart { position: absolute; inset: 0; width: 100%; height: 100%; }
.rk .tc .region { position: absolute; left: ${u(10)}; top: ${u(10)}; padding: ${u(3)} ${u(14)}; font-size: ${u(20)}; font-weight: 700; background: var(--paper); border: ${u(3)} solid var(--ink); border-radius: ${u(999)}; }
.rk .tc .tn { flex: none; padding: ${u(6)} ${u(14)} 0; font-size: ${u(31)}; font-weight: 700; line-height: 1.05; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rk .tc .tb { flex: none; margin: ${u(2)} ${u(14)} ${u(8)}; font-size: ${u(19)}; font-weight: 500; line-height: 1.14; height: calc(${u(19)} * 1.14 * 2); overflow: hidden; opacity: 0.84; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.rk .vote.gp .tc .tb { display: none; }
.rk .vote.gp .tc .tn { font-size: ${u(26)}; padding-bottom: ${u(5)}; }
.rk .tc .pins { position: absolute; right: ${u(-8)}; top: ${u(-14)}; display: flex; flex-direction: row-reverse; pointer-events: none; }
.rk .tc .pin { width: ${u(66)}; margin-left: ${u(-22)}; position: relative; display: none; }
.rk .tc .pin .helmet { width: 100%; filter: drop-shadow(0 ${u(3)} ${u(3)} rgba(29, 31, 43, 0.4)); }
.rk .tc .pin .check { position: absolute; right: ${u(-6)}; bottom: ${u(-2)}; width: ${u(30)}; display: none; }
.rk .tc .pin.on { display: block; animation: rk-pin 0.3s cubic-bezier(0.3, 1.7, 0.5, 1) both; }
.rk .tc .pin.done .check { display: block; }
.rk .tc.f0 { --ring: 0 0 0 ${u(7)} ${SEAT_COLORS[0].main}; } .rk .tc.f1 { --ring: 0 0 0 ${u(7)} ${SEAT_COLORS[1].main}; }
.rk .tc.f2 { --ring: 0 0 0 ${u(7)} ${SEAT_COLORS[2].main}; } .rk .tc.f3 { --ring: 0 0 0 ${u(7)} ${SEAT_COLORS[3].main}; }
.rk .tc.dim { filter: grayscale(0.75) brightness(0.86); transform: scale(0.97); }
.rk .tc.spin { --ring: 0 0 0 ${u(10)} #ffd23f, 0 0 ${u(60)} rgba(255, 210, 63, 0.95); transform: translateY(${u(-8)}) scale(1.03); filter: none; transition-duration: 0.08s; z-index: 2; }
.rk .tc.picked { --ring: 0 0 0 ${u(12)} #ffd23f, 0 0 ${u(90)} rgba(255, 210, 63, 1); transform: scale(1.06); filter: none; z-index: 3; animation: rk-pop-in 0.6s cubic-bezier(0.3, 1.6, 0.5, 1); }
.rk .tc.random .pic .die { position: absolute; left: 50%; top: 50%; width: ${u(112)}; transform: translate(-50%, -50%); filter: drop-shadow(0 ${u(6)} ${u(6)} rgba(29, 31, 43, 0.35)); animation: rk-sway 3s ease-in-out infinite; }
.rk .tc.inlist .region { margin-left: ${u(44)}; }
.rk .tc .badge { position: absolute; left: ${u(-14)}; top: ${u(-14)}; width: ${u(62)}; height: ${u(62)}; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: ${u(36)}; font-weight: 700; background: #ffd23f; border: ${u(5)} solid var(--ink); z-index: 2; animation: rk-pin 0.3s cubic-bezier(0.3, 1.7, 0.5, 1) both; }
.rk .tc.inlist { --ring: 0 0 0 ${u(7)} #ffd23f; }
.rk .vinfo { min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: ${u(12)}; padding: ${u(16)}; border-radius: ${u(30)}; border: ${u(5)} dashed rgba(29, 31, 43, 0.5); background: rgba(255, 250, 240, 0.86); text-align: center; font-size: ${u(26)}; font-weight: 600; line-height: 1.15; }
.rk .vinfo .coin { width: ${u(84)}; animation: rk-coin 2.6s ease-in-out infinite; }
.rk .vinfo .pill { font-size: ${u(26)}; box-shadow: none; }
.rk .vinfo .ttl { font-size: ${u(23)}; font-weight: 500; opacity: 0.84; }
.rk .tc .mosaic { position: absolute; inset: 0; display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; }
.rk .tc .mosaic > div { position: relative; overflow: hidden; border-left: ${u(3)} solid var(--ink); }
.rk .tc .mosaic > div:first-child { border-left: 0; }
.rk .vbar { left: ${u(46)}; right: ${u(46)}; bottom: ${u(18)}; height: ${u(156)}; display: flex; justify-content: center; gap: ${u(18)}; }
.rk .vp { position: relative; flex: 1 1 0; max-width: ${u(620)}; min-width: 0; display: flex; align-items: center; gap: ${u(14)}; padding: ${u(10)} ${u(20)} ${u(10)} ${u(14)}; border-radius: ${u(28)}; border: ${u(5)} solid var(--ink); background: radial-gradient(120% 120% at 20% 0%, var(--cl) 0%, var(--paper) 62%); box-shadow: var(--shadow); }
.rk .vp .helmet { width: ${u(92)}; flex: none; }
.rk .vp .vtx { min-width: 0; display: flex; flex-direction: column; gap: ${u(2)}; }
.rk .vp .pn { font-size: ${u(22)}; font-weight: 600; color: var(--cd); }
.rk .vp .vn { font-size: ${u(30)}; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.1; }
.rk .vp .vs { font-size: ${u(20)}; font-weight: 500; opacity: 0.8; }
.rk .vp.ready { box-shadow: 0 0 0 ${u(6)} var(--c), var(--shadow); }
.rk .vp.ready .helmet { animation: rk-bob 2s ease-in-out infinite; }
.rk .verdict { left: 50%; top: ${u(10)}; transform: translateX(-50%); width: max-content; max-width: ${u(1700)}; display: flex; align-items: center; gap: ${u(18)}; padding: ${u(10)} ${u(44)} ${u(10)} ${u(20)}; border-radius: ${u(999)}; animation: rk-drop-in 0.5s cubic-bezier(0.3, 1.5, 0.5, 1) both; z-index: 5; }
.rk .verdict .coin { width: ${u(74)}; animation: rk-coin 0.5s linear infinite; }
.rk .verdict.landed .coin { animation: none; }
.rk .verdict b { font-size: ${u(52)}; line-height: 1.08; }
/* the Gran Premio list */
.rk .gpp { right: ${u(46)}; top: ${u(136)}; bottom: ${u(26)}; width: ${u(510)}; padding: ${u(18)} ${u(22)}; display: flex; flex-direction: column; gap: ${u(10)}; }
.rk .gpp h3 { margin: 0; font-size: ${u(34)}; font-weight: 700; }
.rk .gpp .help { font-size: ${u(20)}; font-weight: 500; line-height: 1.15; opacity: 0.84; }
.rk .gpp .list { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: ${u(6)}; overflow: hidden; }
.rk .gpp .li { display: flex; align-items: center; gap: ${u(10)}; font-size: ${u(25)}; font-weight: 600; padding: ${u(4)} ${u(10)} ${u(4)} ${u(4)}; border-radius: ${u(16)}; background: #f7ecd9; border: ${u(3)} solid var(--ink); white-space: nowrap; overflow: hidden; animation: rk-slide-in 0.3s cubic-bezier(0.3, 1.4, 0.5, 1) both; }
.rk .gpp .li i { flex: none; width: ${u(40)}; height: ${u(40)}; display: flex; align-items: center; justify-content: center; font-style: normal; font-weight: 700; border-radius: 50%; background: #ffd23f; border: ${u(3)} solid var(--ink); }
.rk .gpp .li span { overflow: hidden; text-overflow: ellipsis; }
.rk .gpp .empty { font-size: ${u(23)}; font-weight: 500; opacity: 0.75; text-align: center; padding: ${u(26)} ${u(10)}; border: ${u(4)} dashed rgba(29, 31, 43, 0.3); border-radius: ${u(20)}; }
.rk .gpp .presets { display: flex; flex-wrap: wrap; gap: ${u(6)}; }
.rk .gpp .presets button { flex: 1 1 30%; min-width: 0; height: ${u(46)}; font-size: ${u(20)}; font-weight: 700; padding: 0 ${u(6)}; border-radius: ${u(14)}; border: ${u(3)} solid var(--ink); background: #fff3d6; white-space: nowrap; box-shadow: inset 0 ${u(-4)} 0 rgba(58, 34, 56, 0.1); }
.rk .gpp .presets button:active { transform: translateY(${u(2)}); }
.rk .gpp .gpgo { height: ${u(92)}; flex: none; }
.rk .gpp .gpgo b { font-size: ${u(36)}; }
.rk .gpp .seatsmini { display: flex; gap: ${u(8)}; justify-content: center; }
.rk .gpp .seatsmini .helmet { width: ${u(46)}; }

/* ---------- loading ---------- */
.rk .loadscr .bg .tart { position: absolute; inset: 0; width: 100%; height: 100%; }
.rk .loadscr .lc { left: 50%; top: 50%; width: ${u(1120)}; translate: -50% -50%; padding: ${u(36)} ${u(56)} ${u(40)}; display: flex; flex-direction: column; align-items: center; gap: ${u(14)}; text-align: center; }
.rk .loadscr .lc .rg { font-size: ${u(26)}; }
.rk .loadscr .lc h1 { margin: 0; font-size: ${u(96)}; line-height: 1.05; -webkit-text-stroke-width: ${u(13)}; }
.rk .loadscr .lc p { margin: 0; font-size: ${u(30)}; font-weight: 500; line-height: 1.25; }
.rk .loadscr .road { position: relative; width: 100%; height: ${u(64)}; margin-top: ${u(12)}; border-radius: ${u(999)}; background: #6a5e70; border: ${u(5)} solid var(--ink); overflow: visible; }
.rk .loadscr .road::after { content: ""; position: absolute; left: ${u(20)}; right: ${u(20)}; top: 50%; height: ${u(6)}; transform: translateY(-50%); background: repeating-linear-gradient(90deg, #fff4d8 0 ${u(38)}, transparent ${u(38)} ${u(70)}); border-radius: ${u(3)}; }
.rk .loadscr .fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0; border-radius: ${u(999)}; background: linear-gradient(180deg, #9be882, #55c460); transition: width 0.25s; z-index: 1; opacity: 0.85; }
.rk .loadscr .wheel { position: absolute; top: 50%; left: 0; width: ${u(76)}; transform: translate(-50%, -50%); transition: left 0.25s; animation: rk-roll 0.7s linear infinite; z-index: 2; }
.rk .loadscr .tip { font-size: ${u(28)}; font-weight: 500; line-height: 1.2; padding: ${u(10)} ${u(26)}; border-radius: ${u(22)}; background: #fff3d6; border: ${u(4)} solid var(--ink); min-height: ${u(92)}; display: flex; align-items: center; justify-content: center; width: 100%; }

/* ---------- race HUD ---------- */
.rk .hudscr { }
.rk .hv { --u: calc(var(--u0) * var(--k, 1)); position: absolute; overflow: hidden; }
.rk .hv .plc { position: absolute; right: ${u(30)}; bottom: ${u(14)}; display: flex; align-items: flex-start; line-height: 1; transform-origin: 80% 80%; }
.rk .hv .plc .n { font-size: ${u(190)}; letter-spacing: ${u(-3)}; color: #fff; font-weight: 700; text-shadow: ${outline(9, 7)}; }
.rk .hv .plc .sfx { font-size: ${u(74)}; margin-top: ${u(14)}; margin-left: ${u(4)}; color: #fff; font-weight: 700; -webkit-text-stroke: ${u(11)} var(--ink); paint-order: stroke fill; }
.rk .hv .plc .sfx.deg { font-size: ${u(96)}; margin-top: ${u(2)}; margin-left: ${u(2)}; }
.rk .hv .plc[data-p="1"] .n, .rk .hv .plc[data-p="1"] .sfx { color: #ffe066; }
.rk .hv .plc[data-p="2"] .n, .rk .hv .plc[data-p="2"] .sfx { color: #e6edf5; }
.rk .hv .plc[data-p="3"] .n, .rk .hv .plc[data-p="3"] .sfx { color: #f5be8b; }
.rk .hv .plc.bump { animation: rk-bump 0.5s cubic-bezier(0.3, 1.7, 0.5, 1); }
.rk .hv .tagrow { position: absolute; left: ${u(26)}; top: ${u(20)}; display: flex; align-items: center; gap: ${u(10)}; }
.rk .hv .ptag { display: flex; align-items: center; justify-content: center; min-width: ${u(68)}; height: ${u(62)}; padding: 0 ${u(12)}; font-size: ${u(36)}; font-weight: 700; color: #fff; -webkit-text-stroke: ${u(7)} var(--ink); paint-order: stroke fill; background: var(--c); border: ${u(5)} solid var(--ink); border-radius: ${u(20)}; box-shadow: 0 ${u(5)} 0 rgba(29, 31, 43, 0.3); }
.rk .hv .lap { display: flex; align-items: baseline; gap: ${u(10)}; height: ${u(62)}; padding: 0 ${u(22)}; background: var(--paper); border: ${u(5)} solid var(--ink); border-radius: ${u(20)}; box-shadow: 0 ${u(5)} 0 rgba(29, 31, 43, 0.3); align-items: center; }
.rk .hv .lap small { font-size: ${u(26)}; font-weight: 600; }
.rk .hv .lap b { font-size: ${u(42)}; font-weight: 700; font-variant-numeric: tabular-nums; }
.rk .hv .lap.pulse { animation: rk-bump 0.6s cubic-bezier(0.3, 1.7, 0.5, 1); }
.rk .hv .lap.last { background: #ffd23f; }
.rk .hv .map { position: absolute; right: ${u(22)}; top: ${u(18)}; width: ${u(250)}; height: ${u(250)}; border-radius: ${u(44)}; background: rgba(255, 246, 230, 0.86); border: ${u(5)} solid var(--ink); box-shadow: 0 ${u(6)} 0 rgba(29, 31, 43, 0.28); overflow: hidden; }
.rk .hv .map canvas { display: block; width: 100%; height: 100%; }
.rk .hv .crate { position: absolute; left: ${u(26)}; bottom: ${u(20)}; width: ${u(192)}; height: ${u(192)}; transform-origin: 30% 80%; }
.rk .hv .crate .crate-art { position: absolute; inset: 0; width: 100%; height: 100%; filter: drop-shadow(0 ${u(6)} 0 rgba(29, 31, 43, 0.3)); }
.rk .hv .crate .icn { position: absolute; left: 19%; right: 19%; top: 30%; bottom: 16%; display: flex; align-items: center; justify-content: center; }
.rk .hv .crate .icn svg { width: 100%; height: 100%; }
.rk .hv .crate .icn .tx { font-size: ${u(24)}; font-weight: 700; text-align: center; line-height: 1; }
.rk .hv .crate .pips { position: absolute; left: 0; right: 0; bottom: ${u(-3)}; display: flex; gap: ${u(5)}; justify-content: center; }
.rk .hv .crate .pips i { width: ${u(24)}; height: ${u(24)}; border-radius: 50%; background: #ffd23f; border: ${u(4)} solid var(--ink); }
.rk .hv .crate.spin .icn { animation: rk-shake 0.14s linear infinite; }
.rk .hv .crate.landed { animation: rk-bump 0.5s cubic-bezier(0.3, 1.8, 0.5, 1); }
.rk .hv .crate.holding .crate-art { filter: drop-shadow(0 0 ${u(16)} rgba(255, 210, 63, 0.95)) drop-shadow(0 ${u(6)} 0 rgba(29, 31, 43, 0.3)); }
.rk .hv .inm { position: absolute; left: ${u(26)}; bottom: ${u(214)}; width: max-content; max-width: 70%; padding: ${u(3)} ${u(14)}; font-size: ${u(25)}; font-weight: 700; background: var(--paper); border: ${u(4)} solid var(--ink); border-radius: ${u(14)}; white-space: nowrap; animation: rk-pin 0.3s cubic-bezier(0.3, 1.7, 0.5, 1) both; }
.rk .hv .wrong { position: absolute; left: 50%; top: 24%; transform: translateX(-50%); display: flex; align-items: center; gap: ${u(14)}; font-size: ${u(84)}; line-height: 1; white-space: nowrap; color: #ff8a6a; -webkit-text-stroke: ${u(12)} var(--ink); paint-order: stroke fill; font-weight: 700; animation: rk-wob 0.5s ease-in-out infinite alternate; }
.rk .hv .banner { position: absolute; left: 50%; top: 20%; transform: translateX(-50%); white-space: nowrap; font-size: ${u(96)}; line-height: 1; color: #ffe066; -webkit-text-stroke: ${u(13)} var(--ink); paint-order: stroke fill; font-weight: 700; animation: rk-banner 2.6s cubic-bezier(0.2, 1.2, 0.4, 1) both; }
.rk .hv .dis { position: absolute; left: 50%; top: ${u(112)}; transform: translateX(-50%); display: flex; align-items: center; gap: ${u(20)}; max-width: 92%; padding: ${u(12)} ${u(30)} ${u(14)} ${u(16)}; background: var(--dis, #f6c23e); border: ${u(8)} solid var(--ink); border-radius: ${u(30)}; box-shadow: 0 ${u(8)} 0 rgba(29, 31, 43, 0.35); animation: rk-dis var(--dis-t, 5s) cubic-bezier(0.25, 1.4, 0.5, 1) both; }
.rk .hv .bannerz:has(.dis) + .toastz .toast { top: ${u(310)}; }
.rk .hv .dis .pic { flex: none; width: ${u(104)}; height: ${u(104)}; }
.rk .hv .dis .pic svg { width: 100%; height: 100%; display: block; }
.rk .hv .dis .tx { display: flex; flex-direction: column; min-width: 0; }
.rk .hv .dis b { font-size: ${u(66)}; line-height: 1.02; font-weight: 700; color: var(--ink); white-space: nowrap; }
.rk .hv .dis span { font-size: max(13px, ${u(29)}); line-height: 1.12; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rk .hv .dis .arrow { flex: none; width: ${u(84)}; height: ${u(84)}; animation: rk-dis-arrow 0.5s ease-in-out infinite alternate; }
.rk .hv .dis .arrow svg { width: 100%; height: 100%; display: block; }
.rk .hv .toast { position: absolute; left: 50%; top: ${u(100)}; transform: translateX(-50%); max-width: 66%; padding: ${u(8)} ${u(24)}; font-size: ${u(32)}; font-weight: 700; background: var(--paper); border: ${u(4)} solid var(--ink); border-radius: ${u(999)}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-shadow: 0 ${u(5)} 0 rgba(29, 31, 43, 0.28); animation: rk-toast 2.2s cubic-bezier(0.25, 1.4, 0.5, 1) both; }
.rk .hv .toast.warn { background: #ffd23f; }
.rk .hv .toast.hit { background: #ffb39c; }
.rk .hv .cdn { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
.rk .hv .cdn .n { font-size: ${u(380)}; line-height: 1; color: #fff; font-weight: 700; text-shadow: ${outline(14, 12)}; }
.rk .hv .cdn .n.go { color: #ffe066; font-size: ${u(280)}; }
.rk .hv .cdn .n.tick { animation: rk-tick 0.95s cubic-bezier(0.2, 1.4, 0.4, 1) both; }
.rk .hv .cdn .n.go.tick { animation: rk-go 1.1s cubic-bezier(0.2, 1.4, 0.4, 1) both; }
.rk .hv .iaim { position: absolute; left: ${u(226)}; bottom: ${u(34)}; display: flex; align-items: center; gap: ${u(6)}; width: max-content; padding: ${u(5)} ${u(16)} ${u(5)} ${u(10)}; font-size: ${u(27)}; font-weight: 700; background: #ffd23f; color: var(--ink); border: ${u(4)} solid var(--ink); border-radius: ${u(20)}; }
.rk .hv .iaim svg { width: ${u(26)}; flex: none; }
.rk .hv.tt .plc, .rk .hv.tt .crate, .rk .hv.tt .inm, .rk .hv.tt .fin .pl { display: none; }
.rk .hv .ttref { position: absolute; left: ${u(26)}; top: ${u(96)}; display: flex; align-items: center; gap: ${u(10)}; height: ${u(56)}; padding: 0 ${u(18)} 0 ${u(10)}; background: var(--paper); border: ${u(4)} solid var(--ink); border-radius: ${u(18)}; font-size: ${u(30)}; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; box-shadow: 0 ${u(4)} 0 rgba(29, 31, 43, 0.28); }
.rk .hv .ttref .ghosti { width: ${u(38)}; height: ${u(42)}; flex: none; animation: rk-bob 1.6s ease-in-out infinite; }
.rk .hv .ttclock { position: absolute; right: ${u(30)}; bottom: ${u(22)}; display: flex; flex-direction: column; align-items: flex-end; line-height: 1; color: #fff; font-weight: 700; }
.rk .hv .ttclock b { font-size: ${u(112)}; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: ${u(-1)}; text-shadow: ${outline(8, 6)}; }
.rk .hv .ttlaps { position: absolute; left: ${u(26)}; bottom: ${u(22)}; display: flex; flex-direction: column; gap: ${u(6)}; font-variant-numeric: tabular-nums; }
.rk .hv .ttlaps div { display: grid; grid-template-columns: ${u(46)} ${u(146)} ${u(112)}; align-items: center; height: ${u(50)}; padding: 0 ${u(14)}; background: rgba(255, 246, 230, 0.92); border: ${u(4)} solid var(--ink); border-radius: ${u(16)}; font-size: ${u(30)}; font-weight: 700; animation: rk-slide-in 0.4s cubic-bezier(0.3, 1.3, 0.5, 1) both; }
.rk .hv .ttlaps div.rec { background: #ffe066; }
.rk .hv .ttlaps span { text-align: right; }
.rk .ttdelta.ahead { color: #128a3c; } .rk .ttdelta.behind { color: #c8331f; }
.rk .hv .ttsplit { position: absolute; left: 50%; top: 9%; transform: translateX(-50%); display: flex; align-items: baseline; gap: ${u(18)}; padding: ${u(10)} ${u(28)}; background: var(--paper); border: ${u(5)} solid var(--ink); border-radius: ${u(26)}; box-shadow: 0 ${u(6)} 0 rgba(29, 31, 43, 0.3); white-space: nowrap; font-variant-numeric: tabular-nums; }
.rk .hv .ttsplit.pop { animation: rk-drop-in 0.35s cubic-bezier(0.3, 1.5, 0.5, 1) both; }
.rk .hv .ttsplit small { font-size: ${u(28)}; font-weight: 600; opacity: 0.8; }
.rk .hv .ttsplit b { font-size: ${u(50)}; font-weight: 700; }
.rk .hv .ttsplit i { font-style: normal; font-size: ${u(62)}; font-weight: 700; }
.rk .hv .ttsplit i:empty { display: none; }
.rk .results.withgp.tt .tcard .rt .gaph, .rk .results.withgp.tt .tcard .rt .gapv { display: block; }
.rk .results.withgp.tt .tcard .rt .ptsh, .rk .results.withgp.tt .tcard .rt .ptsv, .rk .results.tt .tcard .rt .pos { display: none; }
.rk .results.withgp.tt .tcard .rt { grid-template-columns: ${u(92)} 1fr ${u(180)} ${u(170)} ${u(140)}; }
.rk .results.tt .tcard .rt .h0 { display: none; }
.rk .results.tt .gcard .rt { grid-template-columns: ${u(60)} ${u(74)} 1fr ${u(170)}; }
.rk .results.tt .gcard .rrow { flex: 0 0 ${u(70)}; }
.rk .results.tt .rrow.head2 { flex: 0 0 ${u(92)}; }
.rk .results.tt .ttrun { display: flex; flex-wrap: wrap; gap: ${u(8)}; margin: ${u(8)} 0 ${u(10)}; }
.rk .results.tt .ttrun div { flex: 1 1 ${u(190)}; max-width: ${u(330)}; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: ${u(92)}; padding: ${u(6)} ${u(8)}; background: #f9efdd; border: ${u(3)} solid rgba(29, 31, 43, 0.16); border-radius: ${u(18)}; font-variant-numeric: tabular-nums; animation: rk-slide-in 0.45s cubic-bezier(0.3, 1.3, 0.5, 1) both; animation-delay: var(--dl, 0s); }
.rk .results.tt .ttrun div.rec { background: #ffe066; border: ${u(4)} solid var(--ink); }
.rk .results.tt .ttrun small { font-size: ${u(22)}; font-weight: 600; opacity: 0.78; }
.rk .results.tt .ttrun b { font-size: ${u(36)}; font-weight: 700; line-height: 1.1; }
.rk .results.tt .ttrun i { font-style: normal; font-size: ${u(26)}; font-weight: 700; }
.rk .results.tt.solo .rrow.head2 { flex: 0 0 ${u(116)}; font-size: ${u(38)}; }
.rk .results.tt.solo .ttrun { margin-top: ${u(14)}; }
.rk .results.tt.solo .ttrun div { min-height: ${u(166)}; flex-basis: ${u(190)}; }
.rk .results.tt.solo .ttrun small { font-size: ${u(28)}; }
.rk .results.tt.solo .ttrun b { font-size: ${u(52)}; }
.rk .results.tt.solo .ttrun i { font-size: ${u(36)}; }
.rk .results.tt .tthint { margin: auto ${u(10)} ${u(10)}; display: flex; align-items: center; gap: ${u(18)}; padding: ${u(14)} ${u(24)}; background: #e9f4ff; border: ${u(4)} solid var(--ink); border-radius: ${u(24)}; font-size: ${u(32)}; font-weight: 600; line-height: 1.2; }
.rk .results.tt .tthint .ghosti { width: ${u(70)}; height: ${u(76)}; flex: none; animation: rk-bob 1.6s ease-in-out infinite; }
.rk .results .ttnew { position: absolute; right: ${u(60)}; top: ${u(34)}; transform: rotate(3deg); padding: ${u(6)} ${u(30)}; font-size: ${u(48)}; font-weight: 700; color: var(--ink); background: #ffd23f; border: ${u(5)} solid var(--ink); border-radius: ${u(26)}; box-shadow: 0 ${u(6)} 0 rgba(29, 31, 43, 0.35); white-space: nowrap; display: none; animation: rk-bump 0.7s cubic-bezier(0.3, 1.7, 0.5, 1) both; }
.rk .results.tt .ttnew.on { display: block; }
.rk .tc .tb.ttvote { font-weight: 700; font-variant-numeric: tabular-nums; }
.rk .optrow.off { opacity: 0.38; pointer-events: none; }
.rk .hv .fin { position: absolute; left: 50%; top: 13%; transform: translateX(-50%); display: flex; align-items: center; gap: ${u(24)}; padding: ${u(14)} ${u(36)} ${u(14)} ${u(24)}; animation: rk-drop-in 0.5s cubic-bezier(0.3, 1.5, 0.5, 1) both; white-space: nowrap; }
.rk .hv .fin .flagc { width: ${u(92)}; flex: none; animation: rk-sway 1.2s ease-in-out infinite; }
.rk .hv .fin .pl { display: flex; align-items: flex-start; line-height: 1; }
.rk .hv .fin .pl .n { font-size: ${u(120)}; color: #ffe066; font-weight: 700; text-shadow: ${outline(7, 4)}; }
.rk .hv .fin .pl .sfx { font-size: ${u(50)}; margin-top: ${u(8)}; color: #ffe066; -webkit-text-stroke: ${u(8)} var(--ink); paint-order: stroke fill; font-weight: 700; }
.rk .hv .fin .pl .sfx.deg { font-size: ${u(80)}; margin-top: 0; }
.rk .hv .fin b { display: block; font-size: ${u(56)}; font-weight: 700; line-height: 1.05; }
.rk .hv .fin span { display: block; font-size: ${u(36)}; font-weight: 600; opacity: 0.84; font-variant-numeric: tabular-nums; }
.rk .hv .miss { position: absolute; left: 50%; top: 42%; transform: translateX(-50%); display: flex; align-items: center; gap: ${u(18)}; padding: ${u(16)} ${u(32)} ${u(16)} ${u(22)}; max-width: 88%; animation: rk-drop-in 0.5s cubic-bezier(0.3, 1.5, 0.5, 1) both; }
.rk .hv .miss .phone { width: ${u(50)}; flex: none; animation: rk-wob 0.7s ease-in-out infinite alternate; }
.rk .hv .miss b { display: block; font-size: ${u(40)}; font-weight: 700; }
.rk .hv .miss span { display: block; font-size: ${u(25)}; font-weight: 500; opacity: 0.84; margin-top: ${u(2)}; white-space: normal; }
.rk .hv .boostv { position: absolute; inset: 0; opacity: 0; transition: opacity 0.18s; background: radial-gradient(ellipse at 50% 58%, rgba(255, 196, 80, 0) 48%, rgba(255, 170, 60, 0.26) 78%, rgba(255, 120, 40, 0.48) 100%); }
.rk .hv.boost .boostv { opacity: 1; }
.rk .hudscr .divs { position: absolute; inset: 0; }
.rk .ovlab { position: absolute; left: 50%; bottom: 3%; transform: translateX(-50%); font-size: ${u(24)}; }
.rk .fly { position: absolute; left: 0; right: 0; top: 7%; display: flex; flex-direction: column; align-items: center; gap: ${u(10)}; animation: rk-drop-in-c 0.6s cubic-bezier(0.3, 1.5, 0.5, 1) both; }
.rk .fly h1 { margin: 0; font-size: ${u(116)}; line-height: 1.04; -webkit-text-stroke-width: ${u(14)}; text-align: center; }
.rk .fly .row { display: flex; gap: ${u(12)}; flex-wrap: wrap; justify-content: center; }
.rk .fly .row .pill { font-size: ${u(28)}; }
.rk .fly .bl { max-width: ${u(1100)}; text-align: center; font-size: ${u(28)}; font-weight: 500; line-height: 1.2; padding: ${u(10)} ${u(28)}; border-radius: ${u(24)}; }
.rk .skip { position: absolute; left: 50%; bottom: 5%; transform: translateX(-50%); font-size: ${u(25)}; animation: rk-breathe2 1.6s ease-in-out infinite; }
.rk .pausebtn { position: absolute; left: 50%; top: ${u(14)}; transform: translateX(-50%); width: ${u(64)}; height: ${u(64)}; padding: ${u(11)}; border-radius: 50%; background: var(--paper); border: ${u(4)} solid var(--ink); opacity: 0; transition: opacity 0.25s; box-shadow: 0 ${u(5)} 0 rgba(29, 31, 43, 0.3); }
.rk.mouse .pausebtn { opacity: 1; }

/* ---------- pause ---------- */
.rk .pausescr { background: rgba(70, 44, 80, 0.42); pointer-events: auto; }
.rk .pausescr .pc { left: 50%; top: 50%; width: ${u(680)}; translate: -50% -50%; padding: ${u(30)} ${u(44)} ${u(36)}; display: flex; flex-direction: column; align-items: center; gap: ${u(16)}; }
.rk .pausescr h1 { margin: 0 0 ${u(4)}; font-size: ${u(92)}; line-height: 1.05; -webkit-text-stroke-width: ${u(12)}; }
.rk .pausescr .bigbtn { width: 100%; height: ${u(106)}; }
.rk .pausescr .hint { font-size: ${u(22)}; font-weight: 500; opacity: 0.74; }

/* ---------- results ---------- */
.rk .results { background: linear-gradient(180deg, rgba(255, 226, 180, 0.32) 0%, rgba(120, 72, 110, 0.36) 100%); }
.rk .results .tbar h1 { font-size: ${u(84)}; }
.rk .results .tcard { left: ${u(180)}; right: ${u(180)}; top: ${u(148)}; height: ${u(696)}; padding: ${u(18)} ${u(30)} ${u(14)}; display: flex; flex-direction: column; }
.rk .results.withgp .tcard { left: ${u(46)}; right: ${u(740)}; }
.rk .results .gcard { right: ${u(46)}; top: ${u(148)}; width: ${u(674)}; height: ${u(696)}; padding: ${u(18)} ${u(26)} ${u(14)}; display: none; flex-direction: column; background: linear-gradient(180deg, #fff6d6 0%, #fffdf7 40%); }
.rk .results.withgp .gcard { display: flex; }
.rk .gcard h3 { margin: 0 0 ${u(6)}; font-size: ${u(34)}; font-weight: 700; }
.rk .rt { display: grid; align-items: center; column-gap: ${u(12)}; }
.rk .tcard .rt { grid-template-columns: ${u(70)} ${u(82)} 1fr ${u(170)} ${u(150)} ${u(150)} ${u(84)}; }
.rk .results:not(.withgp) .tcard .rt { grid-template-columns: ${u(84)} ${u(96)} 1fr ${u(200)} ${u(180)} ${u(180)}; }
.rk .results.withgp .tcard .rt .gaph, .rk .results.withgp .tcard .rt .gapv { display: none; }
.rk .results:not(.withgp) .tcard .rt .ptsh, .rk .results:not(.withgp) .tcard .rt .ptsv { display: none; }
.rk .results.withgp .tcard .rt { grid-template-columns: ${u(68)} ${u(80)} 1fr ${u(170)} ${u(160)} ${u(70)}; }
.rk .gcard .rt { grid-template-columns: ${u(60)} ${u(74)} 1fr ${u(84)}; }
.rk .rhead { font-size: ${u(20)}; font-weight: 600; opacity: 0.72; padding: 0 ${u(10)} ${u(4)}; text-align: right; }
.rk .rhead span:nth-child(1), .rk .rhead span:nth-child(3) { text-align: left; }
.rk .rrow { position: relative; flex: 1; min-height: 0; padding: 0 ${u(10)}; margin-top: ${u(5)}; border-radius: ${u(18)}; background: #f9efdd; border: ${u(3)} solid rgba(29, 31, 43, 0.14); font-size: ${u(30)}; text-align: right; animation: rk-slide-in 0.45s cubic-bezier(0.3, 1.3, 0.5, 1) both; animation-delay: var(--dl, 0s); }
.rk .rrow.me { background: radial-gradient(90% 200% at 0% 50%, var(--c) 0%, var(--cl) 60%, var(--paper) 100%); border: ${u(4)} solid var(--ink); }
.rk .rrow .pos { display: flex; align-items: flex-start; justify-content: flex-start; font-weight: 700; font-size: ${u(42)}; line-height: 1; }
.rk .rrow .pos small { font-size: ${u(22)}; margin-top: ${u(2)}; font-weight: 700; }
.rk .rrow[data-p="1"] .pos { color: #c98d17; } .rk .rrow[data-p="2"] .pos { color: #7f8b9c; } .rk .rrow[data-p="3"] .pos { color: #b0693a; }
.rk .rrow.me .pos { color: var(--ink); }
.rk .rrow .th { width: 100%; height: ${u(66)}; object-fit: contain; display: block; }
.rk .rrow .who { text-align: left; min-width: 0; display: flex; align-items: center; gap: ${u(10)}; white-space: nowrap; overflow: hidden; }
.rk .rrow .who b { font-size: ${u(30)}; font-weight: 700; overflow: hidden; text-overflow: ellipsis; }
.rk .rrow .who small { font-size: ${u(21)}; font-weight: 500; opacity: 0.74; overflow: hidden; text-overflow: ellipsis; }
.rk .rrow .who i { flex: none; font-style: normal; font-size: ${u(22)}; font-weight: 700; padding: ${u(2)} ${u(10)}; color: #fff; -webkit-text-stroke: ${u(5)} var(--ink); paint-order: stroke fill; background: var(--c); border: ${u(3)} solid var(--ink); border-radius: ${u(10)}; }
.rk .rrow .tm { font-weight: 700; font-variant-numeric: tabular-nums; }
.rk .rrow .bl, .rk .rrow .gapv { font-size: ${u(25)}; font-weight: 500; opacity: 0.82; font-variant-numeric: tabular-nums; }
.rk .rrow .ptsv { font-weight: 700; color: #a8701a; }
.rk .gcard .rrow .pts { font-size: ${u(38)}; font-weight: 700; font-variant-numeric: tabular-nums; }
.rk .gcard .rrow { font-size: ${u(26)}; }
.rk .rfoot { left: ${u(180)}; right: ${u(180)}; bottom: ${u(44)}; height: ${u(150)}; display: flex; gap: ${u(24)}; justify-content: center; }
.rk .rfoot .bigbtn { flex: 1; max-width: ${u(620)}; }
.rk .rfoot .bigbtn b { font-size: ${u(40)}; white-space: nowrap; }
.rk .rfoot .bigbtn.green { flex: 1.3; }
.rk .rfoot .bigbtn.green b { font-size: ${u(54)}; }
.rk .rfoot .bigbtn span { white-space: nowrap; }

/* ---------- podium ---------- */
.rk .podscr .tbar h1 { font-size: ${u(84)}; }
.rk .podscr .steps { left: ${u(280)}; right: ${u(280)}; bottom: ${u(144)}; height: ${u(640)}; display: grid; grid-template-columns: 1fr 1.14fr 1fr; align-items: end; gap: 0; }
.rk .podscr .stp { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; min-width: 0; }
.rk .podscr .stp .kartc { position: relative; width: ${u(390)}; height: ${u(390)}; margin-bottom: ${u(-66)}; z-index: 2; }
.rk .podscr .stp .kartc canvas { width: 100%; height: 100%; display: block; animation: rk-cheer 0.92s cubic-bezier(0.3, 0, 0.5, 1) infinite; animation-delay: var(--d, 0s); transform-origin: 50% 82%; }
.rk .podscr .stp[data-p="1"] .kartc { width: ${u(450)}; height: ${u(450)}; margin-bottom: ${u(-80)}; }
.rk .podscr .block { position: relative; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 0 ${u(10)}; border: ${u(6)} solid var(--ink); border-bottom: 0; border-radius: ${u(26)} ${u(26)} 0 0; background: linear-gradient(180deg, #fff6e6 0, #fff6e6 ${u(22)}, var(--bk, #d9b27a) ${u(22)}, var(--bkd, #b8894f) 100%); box-shadow: 0 ${u(10)} 0 rgba(58, 34, 56, 0.2); }
.rk .podscr .stp[data-p="1"] .block { --bk: #ffd76a; --bkd: #e8a924; height: ${u(262)}; }
.rk .podscr .stp[data-p="2"] .block { --bk: #dde4ee; --bkd: #a9b4c3; height: ${u(202)}; }
.rk .podscr .stp[data-p="3"] .block { --bk: #f3bd93; --bkd: #c98655; height: ${u(160)}; }
.rk .podscr .block .num { font-size: ${u(96)}; line-height: 1; margin-top: ${u(6)}; font-weight: 700; color: #fff; -webkit-text-stroke: ${u(11)} var(--ink); paint-order: stroke fill; }
.rk .podscr .stp[data-p="2"] .block .num { font-size: ${u(78)}; }
.rk .podscr .stp[data-p="3"] .block .num { font-size: ${u(62)}; margin-top: ${u(2)}; }
.rk .podscr .nameplate { position: relative; margin-top: ${u(-30)}; z-index: 3; max-width: 100%; padding: ${u(5)} ${u(20)}; display: flex; flex-direction: column; align-items: center; border-radius: ${u(22)}; box-shadow: 0 ${u(5)} 0 rgba(58, 34, 56, 0.25); }
.rk .podscr .nameplate b { display: flex; align-items: center; gap: ${u(8)}; font-size: ${u(30)}; font-weight: 700; white-space: nowrap; line-height: 1.1; }
.rk .podscr .nameplate b i { font-style: normal; font-size: ${u(23)}; padding: ${u(1)} ${u(9)}; color: #fff; -webkit-text-stroke: ${u(5)} var(--ink); paint-order: stroke fill; background: var(--c); border: ${u(3)} solid var(--ink); border-radius: ${u(10)}; }
.rk .podscr .nameplate span { font-size: ${u(22)}; font-weight: 500; white-space: nowrap; opacity: 0.84; }
.rk .podscr .confetti { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.rk .podscr .rfoot { bottom: ${u(12)}; height: ${u(118)}; left: ${u(280)}; right: ${u(280)}; z-index: 5; }
.rk .podscr .rfoot .bigbtn b { font-size: ${u(36)}; }
.rk .podscr .rfoot .bigbtn.green b { font-size: ${u(44)}; }
.rk .podscr .rfoot .bigbtn span { font-size: ${u(20)}; }

/* ---------- on top of everything ---------- */
.rk .sticker { position: absolute; left: 50%; bottom: ${u(22)}; translate: -50% 0; display: flex; align-items: center; gap: ${u(14)}; padding: ${u(12)} ${u(26)} ${u(12)} ${u(18)}; font-size: ${u(28)}; font-weight: 700; background: #ffd23f; border: ${u(5)} solid var(--ink); border-radius: ${u(26)}; box-shadow: var(--shadow); transform: rotate(-2.5deg); z-index: 20; animation: rk-wiggle 2.2s ease-in-out infinite; pointer-events: auto; cursor: pointer; }
.rk .sticker svg { width: ${u(44)}; flex: none; }
.rk:has(.hudscr:not(.hide) .hv ~ .hv) .sticker { bottom: auto; top: 22%; padding: ${u(12)}; }
.rk:has(.hudscr:not(.hide) .hv ~ .hv) .sticker span { display: none; }
.rk:has(.scr.pick:not(.hide), .scr.vote:not(.hide), .scr.results:not(.hide), .podscr:not(.hide)) .sticker { left: ${u(26)}; bottom: auto; top: ${u(22)}; translate: none; padding: ${u(12)}; }
.rk:has(.scr.pick:not(.hide), .scr.vote:not(.hide), .scr.results:not(.hide), .podscr:not(.hide)) .sticker span { display: none; }
.rk .toasts { position: absolute; left: 50%; top: ${u(18)}; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: ${u(8)}; z-index: 20; }
.rk .toasts .pill { font-size: ${u(28)}; animation: rk-toast 4s cubic-bezier(0.25, 1.4, 0.5, 1) both; white-space: nowrap; }
.rk .offline { display: flex; flex-wrap: wrap; justify-content: center; gap: ${u(8)}; width: max-content; max-width: 92vw; }
.rk .offline .off { padding: ${u(6)} ${u(18)}; border-radius: ${u(999)}; border: ${u(4)} solid var(--seat); background: var(--paper); color: var(--ink); font-size: ${u(26)}; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
.rk .offline .off.waits { font-weight: 500; }
/* Every menu has its title at the top centre, so there the toasts and who is offline go to the top left corner of the 1920x1080
   stage, letterboxed or not, clear of the sound sticker; in the lobby they take the tagline's place while they are up. */
.rk:has(.scr.lobby:not(.hide), .scr.pick:not(.hide), .scr.vote:not(.hide), .scr.results:not(.hide), .podscr:not(.hide)) .toasts { left: calc(50% - ${u(934)}); top: calc(50% - ${u(518)}); transform: none; align-items: flex-start; }
.rk:has(.scr.lobby:not(.hide), .scr.pick:not(.hide), .scr.vote:not(.hide), .scr.results:not(.hide), .podscr:not(.hide)) .offline { flex-direction: column; align-items: flex-start; max-width: ${u(270)}; }
.rk:has(.scr.lobby:not(.hide), .scr.pick:not(.hide), .scr.vote:not(.hide), .scr.results:not(.hide), .podscr:not(.hide)) .offline .off { white-space: normal; font-size: ${u(22)}; line-height: 1.12; padding: ${u(4)} ${u(14)}; border-radius: ${u(24)}; } /* the longest titles leave 270 design px of the corner */
.rk:has(.sticker:not(.hide)):has(.scr.pick:not(.hide), .scr.vote:not(.hide), .scr.results:not(.hide), .podscr:not(.hide)) .toasts { left: calc(50% - ${u(840)}); }
.rk:has(.scr.lobby:not(.hide)) .toasts { left: calc(50% - ${u(916)}); top: calc(50% - ${u(496)}); }
.rk:has(.toasts > :not(.hide)) .lobby .tag { visibility: hidden; }
.rk .errcard { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: ${u(900)}; padding: ${u(36)} ${u(50)}; text-align: center; z-index: 30; }
.rk .errcard h2 { margin: 0 0 ${u(10)}; font-size: ${u(58)}; font-weight: 700; }
.rk .errcard p { margin: 0; font-size: ${u(32)}; font-weight: 500; }
.rk .readybar { position: absolute; left: 50%; bottom: calc(50% - ${u(342)}); transform: translateX(-50%); z-index: 6; display: flex; align-items: center; gap: ${u(10)}; height: ${u(38)}; padding: 0 ${u(16)}; border-radius: ${u(999)}; border: ${u(3)} solid var(--ink); background: var(--paper); color: var(--ink); font-size: ${u(22)}; font-weight: 500; white-space: nowrap; }
.rk .readybar i { font-style: normal; font-weight: 700; padding: 0 ${u(10)}; border-radius: ${u(999)}; border: ${u(3)} solid var(--seat); opacity: 0.72; font-variant-numeric: tabular-nums; }
.rk .readybar i.on { background: var(--seat); opacity: 1; }
.rk .readybar b { font-weight: 700; font-variant-numeric: tabular-nums; }
/* Against the 1920x1080 stage, not the window: on the results 198 up, between the tables and the buttons; on the podium the steps
   fill all the room above the buttons, so it sits under the title, 162 down, above the winner's kart. */
.rk:has(.podscr:not(.hide)) .readybar { top: calc(50% - ${u(378)}); bottom: auto; }
.rk .rejoin { position: absolute; display: flex; flex-direction: column; align-items: center; gap: ${u(6)}; width: ${u(360)}; padding: ${u(16)}; text-align: center; z-index: 20; }
.rk .rejoin.corner { right: ${u(24)}; bottom: ${u(24)}; }
.rk:has(.vote.gp:not(.hide)) .rejoin.corner { bottom: ${u(136)}; }
.rk:has(.vote.gp:not(.hide)) .rejoin.corner img { width: ${u(200)}; height: ${u(200)}; }
.rk:has(.hudscr:not(.hide)) .rejoin.corner { bottom: ${u(218)}; width: ${u(300)}; }
.rk:has(.hudscr:not(.hide)) .rejoin.corner img { width: ${u(200)}; height: ${u(200)}; }
.rk:has(.hudscr:not(.hide) .hv:nth-child(3)) .rejoin.corner { bottom: ${u(24)}; }
.rk .rejoin img { display: block; width: ${u(300)}; height: ${u(300)}; padding: ${u(10)}; background: #fff; border-radius: ${u(18)}; image-rendering: pixelated; }
.rk .rejoin b { font-size: ${u(26)}; font-weight: 700; line-height: 1.15; }
.rk .rejoin span { font-size: ${u(22)}; font-weight: 500; }
/* On the results and the podium the card lies down, the QR beside its words. On the results it sits in the bottom corner and the
   buttons make room for it, so the tables stay whole; on the podium it sits at the top right, under the title and above the steps. */
.rk:has(.results:not(.hide), .podscr:not(.hide)) .rejoin.corner { display: grid; grid-template-columns: ${u(190)} ${u(240)}; grid-template-rows: 1fr auto; column-gap: ${u(14)}; row-gap: ${u(6)}; width: auto; padding: ${u(12)} ${u(16)} ${u(12)} ${u(12)}; text-align: left; align-items: center; }
.rk:has(.results:not(.hide), .podscr:not(.hide)) .rejoin.corner img { grid-row: 1 / 3; width: ${u(190)}; height: ${u(190)}; }
.rk:has(.results:not(.hide), .podscr:not(.hide)) .rejoin.corner b { align-self: end; }
.rk:has(.results:not(.hide), .podscr:not(.hide)) .rejoin.corner span { align-self: start; font-size: ${u(20)}; overflow-wrap: anywhere; }
.rk:has(.results:not(.hide)) .rejoin.corner { bottom: ${u(12)}; }
.rk:has(.rejoin.corner:not(.hide)) .results .rfoot { left: ${u(46)}; right: ${u(520)}; }
.rk:has(.podscr:not(.hide)) .rejoin.corner { top: calc(50% - ${u(428)}); bottom: auto; } /* 112 down the 1920x1080 stage, letterboxed or not */

@keyframes rk-drift { from { transform: translateX(-30vw); } to { transform: translateX(110vw); } }
@keyframes rk-pop-in { 0% { transform: scale(0.78); opacity: 0; } 55% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1); } }
@keyframes rk-slide-in { from { transform: translateY(calc(var(--u) * 26)); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes rk-drop-in { from { transform: translate(-50%, calc(var(--u) * -40)); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
@keyframes rk-drop-in-c { from { transform: translateY(calc(var(--u) * -50)); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes rk-bob { 0%, 100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(calc(var(--u) * -8)) rotate(3deg); } }
@keyframes rk-sway { 0%, 100% { transform: rotate(-1.2deg); } 50% { transform: rotate(1.2deg) translateY(calc(var(--u) * -3)); } }
@keyframes rk-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.025); } }
@keyframes rk-breathe2 { 0%, 100% { opacity: 1; } 50% { opacity: 0.72; } }
@keyframes rk-idle { 0%, 100% { transform: translateY(0) scale(1, 1); } 50% { transform: translateY(calc(var(--u) * 1.5)) scale(1.012, 0.985); } }
@keyframes rk-hop { 0% { transform: translateY(0); } 40% { transform: translateY(calc(var(--u) * -38)) rotate(-4deg); } 70% { transform: translateY(0) scale(1.06, 0.9); } 100% { transform: none; } }
@keyframes rk-cheer { 0%, 100% { transform: translateY(0) scale(1.03, 0.97); } 45% { transform: translateY(calc(var(--u) * -30)) scale(0.98, 1.03) rotate(-1.6deg); } 60% { transform: translateY(calc(var(--u) * -30)) rotate(1.6deg); } }
@keyframes rk-stamp { 0% { transform: rotate(14deg) scale(1.8); opacity: 0; } 100% { transform: rotate(4deg) scale(1); opacity: 1; } }
@keyframes rk-pin { 0% { transform: translateY(calc(var(--u) * -16)) scale(0.5); opacity: 0; } 100% { transform: none; opacity: 1; } }
@keyframes rk-coin { 0%, 100% { transform: rotateY(0deg); } 50% { transform: rotateY(180deg); } }
@keyframes rk-roll { from { transform: translate(-50%, -50%) rotate(0deg); } to { transform: translate(-50%, -50%) rotate(360deg); } }
@keyframes rk-bump { 0% { transform: scale(0.7); } 55% { transform: scale(1.22); } 100% { transform: scale(1); } }
@keyframes rk-shake { 0%, 100% { transform: translateY(calc(var(--u) * -2)); } 50% { transform: translateY(calc(var(--u) * 2)); } }
@keyframes rk-wob { from { transform: translateX(-50%) rotate(-3deg) scale(1); } to { transform: translateX(-50%) rotate(3deg) scale(1.06); } }
@keyframes rk-banner { 0% { transform: translate(-50%, 0) scale(0.3) rotate(-6deg); opacity: 0; } 14% { transform: translate(-50%, 0) scale(1.12) rotate(2deg); opacity: 1; } 22%, 82% { transform: translate(-50%, 0) scale(1); opacity: 1; } 100% { transform: translate(-50%, calc(var(--u) * -30)) scale(0.9); opacity: 0; } }
@keyframes rk-dis { 0% { transform: translate(-50%, calc(var(--u) * -30)) scale(0.4) rotate(-5deg); opacity: 0; } 7% { transform: translate(-50%, 0) scale(1.08) rotate(1.5deg); opacity: 1; } 13%, 90% { transform: translate(-50%, 0) scale(1); opacity: 1; } 100% { transform: translate(-50%, calc(var(--u) * -24)) scale(0.92); opacity: 0; } }
@keyframes rk-dis-arrow { from { transform: translateX(calc(var(--dx, 0) * var(--u) * -6)) translateY(calc(var(--dy, 0) * var(--u) * -6)); } to { transform: translateX(calc(var(--dx, 0) * var(--u) * 8)) translateY(calc(var(--dy, 0) * var(--u) * 8)); } }
@keyframes rk-toast { 0% { transform: translate(-50%, calc(var(--u) * -18)) scale(0.7); opacity: 0; } 10% { transform: translate(-50%, 0) scale(1); opacity: 1; } 84% { transform: translate(-50%, 0) scale(1); opacity: 1; } 100% { transform: translate(-50%, calc(var(--u) * -12)); opacity: 0; } }
@keyframes rk-tick { 0% { transform: scale(1.9); opacity: 0; } 25% { opacity: 1; } 55% { transform: scale(0.94); } 75%, 100% { transform: scale(1); opacity: 1; } }
@keyframes rk-go { 0% { transform: scale(0.4) rotate(-8deg); opacity: 0; } 30% { transform: scale(1.15) rotate(3deg); opacity: 1; } 60% { transform: scale(1); opacity: 1; } 100% { transform: scale(1.25); opacity: 0; } }
@keyframes rk-wiggle { 0%, 88%, 100% { transform: rotate(-2.5deg); } 92% { transform: rotate(-5deg) scale(1.03); } 96% { transform: rotate(0deg) scale(1.03); } }
.rk .toasts .pill { transform-origin: 50% 0; }
@keyframes rk-toast-top { 0% { opacity: 0; } 8%, 88% { opacity: 1; } 100% { opacity: 0; } }
.rk .toasts .pill { animation-name: rk-toast-top; }
${TEAM_CSS}
${WEATHER_CSS}
${FORMA_CSS}
@media (prefers-reduced-motion: reduce) { .rk *, .rk *::before { animation-duration: 0.01s !important; animation-iteration-count: 1 !important; } }
`;
