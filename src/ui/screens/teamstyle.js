// The team championship's styles, on the same 1920x1080 stage and in the same chunky stickers as src/ui/style.js. Kept apart so
// that no other screen carries a line of it; style.js takes the string whole.
import { TEAMS } from '../../data/teams.js';

const u = (n) => `calc(var(--u) * ${n})`;
const sides = TEAMS.map((T) => `.rk [data-team="${T.id}"] { --tc: ${T.color}; --tl: ${T.light}; --td: ${T.dark}; }`).join('\n');

export const TEAM_CSS = `
${sides}
.rk .teamic { flex: none; display: block; }
.rk .teamb { display: inline-flex; align-items: center; gap: ${u(6)}; padding: ${u(3)} ${u(14)} ${u(3)} ${u(4)}; font-size: ${u(24)}; font-weight: 700; color: #fff; -webkit-text-stroke: ${u(5)} var(--ink); paint-order: stroke fill; white-space: nowrap;
  background: var(--tc); border: ${u(4)} solid var(--ink); border-radius: ${u(999)}; box-shadow: 0 ${u(4)} 0 var(--ink); }
.rk .teamb.hide { display: none; }
.rk .teamb .teamic { width: ${u(38)}; height: ${u(38)}; }
/* in this mode the side takes the place of the small status line: it is what a seat has to say */
.rk .lobby.teams .seat.on .st, .rk .lobby.teams .seat.away .st { display: none; }
.rk .seat .teamb { transition: transform 0.14s cubic-bezier(0.3, 1.8, 0.5, 1); }
.rk .seat .teamb .swap { width: ${u(26)}; height: ${u(26)}; flex: none; margin-left: ${u(2)}; }
.rk .seat .teamb:hover { transform: scale(1.07); }
.rk .seat .teamb:active { transform: translateY(${u(3)}); box-shadow: 0 ${u(1)} 0 var(--ink); }
.rk .pick .sp { position: relative; }
.rk .pick .sp .teamb { position: absolute; right: ${u(136)}; top: ${u(-28)}; z-index: 2; font-size: ${u(22)}; padding-right: ${u(12)}; }
.rk .pick .sp .teamb .teamic { width: ${u(30)}; height: ${u(30)}; }
.rk .lobby .chips[data-key="mode"] { gap: ${u(6)}; }
.rk .lobby .chips[data-key="mode"] .chip { flex: 1 1 auto; min-width: max-content; padding: 0 ${u(7)}; font-size: ${u(22)}; }

.rk .hv .tscore { position: absolute; left: ${u(26)}; top: ${u(96)}; display: flex; gap: ${u(-6)}; align-items: center; }
.rk .hv .ts { display: flex; align-items: center; gap: ${u(6)}; height: ${u(56)}; padding: 0 ${u(8)}; color: #fff; background: var(--tc); border: ${u(5)} solid var(--ink); box-shadow: 0 ${u(5)} 0 rgba(29, 31, 43, 0.5); transform-origin: 50% 50%; }
.rk .hv .ts:first-child { border-radius: ${u(30)} ${u(8)} ${u(8)} ${u(30)}; }
.rk .hv .ts:last-child { border-radius: ${u(8)} ${u(30)} ${u(30)} ${u(8)}; margin-left: ${u(-5)}; }
.rk .hv .ts .teamic { width: ${u(40)}; height: ${u(40)}; }
.rk .hv .ts b { min-width: ${u(44)}; text-align: center; font-size: max(13px, ${u(38)}); font-weight: 700; font-variant-numeric: tabular-nums; -webkit-text-stroke: ${u(6)} var(--ink); paint-order: stroke fill; line-height: 1; }
.rk .hv .ts.mine { height: ${u(66)}; z-index: 1; outline: ${u(4)} solid #ffe066; outline-offset: ${u(-1)}; }
.rk .hv .ts.bump { animation: rk-bump 0.5s cubic-bezier(0.3, 1.7, 0.5, 1); }
.rk .hv.tt .tscore { display: none; }

.rk .results .rrow[data-team] { box-shadow: inset ${u(10)} 0 0 var(--tc); }
.rk .results.teams .gcard .tblock { flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; gap: ${u(6)}; padding: ${u(8)} ${u(10)} ${u(10)}; margin-top: ${u(8)}; background: linear-gradient(180deg, var(--tl) 0%, #fff8e6 72%); border: ${u(5)} solid var(--ink); border-radius: ${u(26)}; animation: rk-pop-in 0.42s cubic-bezier(0.3, 1.2, 0.5, 1) both; animation-delay: var(--dl, 0s); }
.rk .results.teams .gcard .thd { display: flex; align-items: center; gap: ${u(10)}; height: ${u(76)}; padding: 0 ${u(18)} 0 ${u(8)}; color: #fff; background: var(--tc); border: ${u(4)} solid var(--ink); border-radius: ${u(999)}; }
.rk .results.teams .gcard .thd .teamic { width: ${u(58)}; height: ${u(58)}; }
.rk .results.teams .gcard .thd b { flex: 1; min-width: 0; font-size: ${u(42)}; font-weight: 700; -webkit-text-stroke: ${u(7)} var(--ink); paint-order: stroke fill; white-space: nowrap; }
.rk .results.teams .gcard .thd i { font-style: normal; font-size: ${u(30)}; font-weight: 700; padding: 0 ${u(12)}; color: var(--ink); background: #ffe066; border: ${u(3)} solid var(--ink); border-radius: ${u(999)}; font-variant-numeric: tabular-nums; }
.rk .results.teams .gcard .thd strong { font-size: ${u(58)}; font-weight: 700; line-height: 1; -webkit-text-stroke: ${u(8)} var(--ink); paint-order: stroke fill; font-variant-numeric: tabular-nums; }
.rk .results.teams .gcard .tblock .rrow { flex: 1 1 0; min-height: 0; animation: none; }
.rk .results.teams .gcard .rt { grid-template-columns: ${u(12)} ${u(74)} 1fr ${u(70)}; }

.rk .podscr .steps.teams { left: ${u(170)}; right: ${u(170)}; grid-template-columns: 1.14fr 1fr; gap: ${u(26)}; }
.rk .podscr .steps.teams .duo { position: relative; display: flex; justify-content: center; z-index: 2; }
.rk .podscr .tbar .sub:empty { display: none; }
.rk .podscr.hasunlock .steps.teams { left: ${u(384)}; right: ${u(40)}; }
.rk .podscr .steps.teams .kartc { width: ${u(330)}; height: ${u(330)}; margin: 0 ${u(-16)} ${u(-50)}; }
.rk .podscr .steps.teams .stp[data-p="1"] .kartc { width: ${u(390)}; height: ${u(390)}; margin-bottom: ${u(-58)}; }
.rk .podscr .steps.teams .stp[data-p="2"] .kartc canvas { animation: none; }
.rk .podscr .steps.teams .block { --bk: var(--tl); --bkd: var(--tc); }
.rk .podscr .steps.teams .stp[data-p="1"] .block { height: ${u(250)}; }
.rk .podscr .steps.teams .stp[data-p="2"] .block { height: ${u(198)}; }
.rk .podscr .steps.teams .nameplate { flex-direction: row; gap: ${u(12)}; padding: ${u(6)} ${u(24)} ${u(6)} ${u(8)}; margin-top: ${u(-18)}; }
.rk .podscr .steps.teams .nameplate .teamic { width: ${u(64)}; height: ${u(64)}; }
.rk .podscr .steps.teams .nameplate b { font-size: ${u(44)}; }
.rk .podscr .steps.teams .nameplate span { font-size: ${u(30)}; font-weight: 600; }
.rk .podscr .steps.teams .tnames { margin-top: ${u(8)}; display: flex; flex-wrap: wrap; justify-content: center; gap: ${u(4)} ${u(30)}; font-size: ${u(30)}; font-weight: 700; color: var(--ink); text-align: center; line-height: 1.1; padding: 0 ${u(8)}; }
.rk .podscr .steps.teams .tnames span { display: inline-flex; align-items: center; white-space: nowrap; }
.rk .podscr .steps.teams .block .num { margin-top: ${u(2)}; }
.rk .podscr .steps.teams .tnames i { font-style: normal; font-size: ${u(23)}; margin-right: ${u(8)}; padding: ${u(1)} ${u(9)}; color: #fff; -webkit-text-stroke: ${u(5)} var(--ink); paint-order: stroke fill; background: var(--c); border: ${u(3)} solid var(--ink); border-radius: ${u(10)}; }
`;
