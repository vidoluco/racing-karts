// What a family has won, kept on the TV's browser. The first Gran Premio won opens Baileys, the second Fifi. Storage can be missing or
// refuse (a private window, a browser with site data off): then the wins last until the page closes.
import { SECRET_IDS } from '../data/karts.js';

export const UNLOCK_KEY = 'racing-karts.gpWins';

const readWins = (store) => {
  try {
    const n = Number(store?.getItem(UNLOCK_KEY));
    return Number.isInteger(n) && n > 0 ? n : 0;
  } catch { return 0; }
};

export function createUnlocks(store = null) {
  let wins = readWins(store);
  const open = () => SECRET_IDS.slice(0, Math.min(wins, SECRET_IDS.length));
  return {
    get wins() { return wins; },
    get open() { return open(); },
    get locked() { return SECRET_IDS.length - open().length; },
    // A Gran Premio won by a player. Returns the kart this win opened, or null when all are already open.
    winGp() {
      const had = open().length;
      wins++;
      try { store?.setItem(UNLOCK_KEY, String(wins)); } catch { /* it still counts for this evening */ }
      return open()[had] ?? null;
    },
  };
}
