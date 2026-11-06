// The weather's chips in the lobby and on the vote.
const u = (n) => `calc(var(--u) * ${n})`;
export const WEATHER_CSS = `
.rk .opts { height: ${u(388)}; padding: ${u(12)} ${u(26)}; }
.rk .lobby .gobtn { height: ${u(388)}; }
.rk .opts .chip { height: ${u(52)}; }
.rk .opts .stepper button { height: ${u(52)}; width: ${u(52)}; }
.rk .wxchips { display: flex; gap: ${u(10)}; align-items: stretch; min-width: 0; }
.rk .wxchips .chips[data-key="weather"] { flex: 1; min-width: 0; }
.rk .wxrow .chips[data-key="weather"] .chip { flex: 1 1 auto; font-size: ${u(22)}; padding: 0 ${u(5)}; }
.rk .wxrow .chip.moon { font-size: ${u(22)}; }
.rk .chip.moon { flex: 0 0 auto; padding: 0 ${u(10)}; gap: ${u(6)}; --on: #5a6cd6; }
.rk .chip.moon svg { width: ${u(26)}; height: ${u(26)}; }
.rk .chip.moon.on { color: #fff; }
.rk .chip[data-v="clear"] { --on: #9fdcff; } .rk .chip[data-v="rain"] { --on: #8ab4dc; } .rk .chip[data-v="snow"] { --on: #e8f2fb; } .rk .chip[data-v="fog"] { --on: #cfd5d9; } .rk .chip[data-v="surprise"] { --on: #f2b6e0; }
.rk .wxvote { position: absolute; right: ${u(36)}; top: ${u(26)}; display: flex; gap: ${u(10)}; z-index: 3; }
.rk .wxvote.hide { display: none; }
.rk .wxvote .chip { flex: 0 0 auto; padding: 0 ${u(20)}; height: ${u(58)}; font-size: ${u(25)}; }
`;
