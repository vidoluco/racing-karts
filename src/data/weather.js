// Weather and hour of a race, pure data shared by the flow, the room, the sim and the renderer. Clear and day are the old race: no key anywhere.
export const WEATHER_IDS = ['clear', 'rain', 'snow', 'fog'];
export const WEATHER_CHOICES = [...WEATHER_IDS, 'surprise']; // what the lobby offers; a surprise is drawn again for every race
export const HOURS = ['day', 'night'];

// What the sim and the renderer take: null for a plain race, or { kind: clear|rain|snow|fog, night: bool }.
export function raceWeather(kind, night) {
  const k = WEATHER_IDS.includes(kind) ? kind : 'clear', n = night === true || night === 'night' || night === 1 || night === '1';
  return k === 'clear' && !n ? null : { kind: k, night: n };
}

// A surprise: a coin for the sky and one for the hour, from whatever random stream the caller keeps.
export function drawWeather(rng) {
  const a = rng(), b = rng();
  return raceWeather(WEATHER_IDS[Math.min(WEATHER_IDS.length - 1, Math.floor(a * WEATHER_IDS.length))], b < 0.3);
}
export const weatherKey = (w) => (w ? `${w.kind}${w.night ? '+night' : ''}` : 'clear');
