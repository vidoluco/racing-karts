// What the phones and the results hear of Caccia alla Forma, from the sim's state.forma. Pure: tested in node.

// One phone's HUD, on top of hudOf: its rank in the table instead of a place on the road, no laps, and the clock in their place.
export function formaHud(h, F, k) {
  h.place = F.rank[k.i];
  h.lap = 0; h.laps = 0;
  h.forma = { left: Math.ceil(F.left), held: Math.floor(F.held[k.i]), mine: F.holder === k.i, loose: F.holder < 0, gap: Math.round(F.gaps[k.i]), over: F.over };
  return h;
}

// The rows of the results: the seconds held take the place of the time, so that the podium and the phones say it without knowing the mode.
export function formaRows(rows, F) {
  for (const r of rows) {
    r.forma = { held: F.held[r.i], best: F.best[r.i], grabs: F.grabs[r.i], drops: F.drops[r.i] };
    r.time = F.held[r.i];
    r.bestLap = null;
  }
  return rows;
}
