// Steering by turning the phone like a wheel. Pure numbers, so the node tests can hold it: pad.js feeds it the sensor.
// What counts is one angle: how far the screen's left-to-right line is from level. Tipping the phone towards you or away,
// or holding it flat or upright, turns it around that very line and leaves the angle alone.
const RAD = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const FULL_LOCK = 40; // degrees for the whole wheel
export const DEAD_ZONE = 1.5; // degrees that do nothing: a hand is never quite still
const CENTRE_MAX = 30; // a "centre" further off than this was not meant as one
const CENTRE_AUTO_MAX = 20; // and by itself, at the start of a race, it is more careful still
const TAU_SLOW = 40, TAU_FAST = 8, RATE_HALF = 40; // ms of smoothing at rest and at speed, and the speed in degrees/s halfway between

// The way up in the phone's own axes (x to the right of the glass held upright, y to its top, z out of the glass), from
// DeviceOrientation's beta and gamma. As a vector it has no jumps where the two angles wrap around.
export function upVector(beta, gamma) {
  const b = beta * RAD, g = gamma * RAD;
  return [-Math.cos(b) * Math.sin(g), Math.sin(b), Math.cos(b) * Math.cos(g)];
}

// Which way up the page is, in degrees: 90 with the phone's top to the left, 270 to the right. window.orientation first,
// for the iPhones that have nothing else.
export function screenAngle({ orientation, screen } = globalThis) {
  if (Number.isFinite(orientation)) return ((orientation % 360) + 360) % 360;
  const a = screen?.orientation?.angle;
  return Number.isFinite(a) ? a : 0;
}

// The frame the steering is measured in. On its side, gravity knows better than the page which side is down: the page
// lags behind a flip and may be held back by a rotation lock. Too flat for gravity to say, the page's word or the last one
// stands. A page stuck upright with a phone on its side (rotation lock) goes by gravity alone, and a phone really held
// upright turns like a wheel too, with room between the two so that it does not hop between them.
export function pickFrame(u, angle, portrait, prev) {
  const sideways = u[0] > 0 ? 90 : 270;
  const upright = u[1] >= 0 ? 0 : 180;
  if (portrait) {
    if (prev === 90 || prev === 270) return Math.abs(u[1]) > 0.75 ? upright : Math.abs(u[0]) > 0.5 ? sideways : prev;
    if (prev === null) return Math.abs(u[0]) > Math.abs(u[1]) ? sideways : upright;
    return Math.abs(u[0]) > 0.9 ? sideways : Math.abs(u[1]) > 0.3 ? upright : prev;
  }
  if (angle === 90 || angle === 270) return Math.abs(u[0]) > 0.5 ? sideways : prev === 90 || prev === 270 ? prev : angle;
  return angle; // a tablet whose natural way is already on its side
}

// Degrees to the right, positive when the right end of the screen goes down.
export function rollDegrees(u, frame) {
  const a = frame * RAD;
  return Math.asin(clamp(u[1] * Math.sin(a) - u[0] * Math.cos(a), -1, 1)) / RAD;
}

// Soft around the middle, for small corrections on a straight; the whole wheel at FULL_LOCK.
export function steerCurve(deg, dead = DEAD_ZONE, full = FULL_LOCK) {
  const m = Math.abs(deg);
  if (m <= dead) return 0;
  const n = Math.min(1, (m - dead) / (full - dead));
  return Math.sign(deg) * (0.45 * n + 0.55 * n * n);
}

export function createTilt() {
  let frame = null, lastAngle = null, value = null, lastT = 0, centre = 0, followTo = 0, wantCentre = null;

  function setCentre(limit) {
    if (value === null) return false;
    if (Math.abs(value) <= limit) centre = value;
    return true;
  }
  return {
    // One sensor reading; returns the steering, -1 to 1. t in ms.
    feed(beta, gamma, { angle = 90, portrait = false, t = 0 } = {}) {
      const u = upVector(beta, gamma);
      if (angle !== lastAngle) { if (!portrait && (angle === 90 || angle === 270)) frame = angle; lastAngle = angle; }
      frame = pickFrame(u, angle, portrait, frame);
      const raw = rollDegrees(u, frame);
      const dt = t - lastT;
      lastT = t;
      if (value === null || dt <= 0 || dt > 150) value = raw;
      else {
        const rate = Math.abs(raw - value) / (dt / 1000);
        const tau = TAU_FAST + (TAU_SLOW - TAU_FAST) / (1 + rate / RATE_HALF);
        value += (raw - value) * (1 - Math.exp(-dt / tau));
      }
      if (wantCentre !== null) { setCentre(wantCentre); wantCentre = null; }
      if (t < followTo) { setCentre(CENTRE_AUTO_MAX); return 0; }
      return steerCurve(value - centre);
    },
    // "This is straight ahead": right now, or for the next ms as the player settles (a race's countdown).
    recenter() { if (!setCentre(CENTRE_MAX)) wantCentre = CENTRE_MAX; },
    follow(ms, t) { followTo = t + ms; centre = 0; if (!setCentre(CENTRE_AUTO_MAX)) wantCentre = CENTRE_AUTO_MAX; },
    get following() { return lastT < followTo; },
    get frame() { return frame; },
    get degrees() { return value === null ? null : value - centre; },
    get centre() { return centre; },
  };
}
