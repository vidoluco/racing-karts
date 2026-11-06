// Weather and night in the renderer. Nothing here runs without a chosen sky: createRenderer only calls it with `opts.weather`.
//   - weatherLook: the track's look under this sky: light, fog, water, bloom. The paint of the world stays; the light changes.
//   - gradeOf + GRADE_GLSL: one function, the same in JS and GLSL, through which the sky dome, the painted backdrops, the mist ring and the DEM ring pass. The sky and the
//     panels met before it and they are the same colours going through the same function, so they still meet.
//   - createWeatherWorld: rain, snow, puddles and drifts, the lights of the karts; plantNightLamps and bakeLitMap for the street lamps; tagWindows for lit windows.
import * as THREE from 'three';
import { paint, cylinder, sphere, box, cone, merge, place } from './shapes.js';
import { hash3 } from './math.js';
import { toon } from './toon.js';

// A track that already lives at night keeps its own moon and its own colours (world/tracks/bran.js): under it a night is no change, only headlights.
const NIGHT_TRACKS = new Set(['bran']);
export const isNightTrack = (def) => NIGHT_TRACKS.has(def?.id);
const linear = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };

// tint: linear multiply; desat: 0..1; gamma: over 1 deepens the darks; veil: colour and amount laid over all, thinning to `keep` of itself between tan(elevation) low and high.
const GRADES = {
  rain: { tint: [0.46, 0.5, 0.58], desat: 0.84, gamma: 1.04, veil: '#7c8796', amount: 0.56, low: 0.02, high: 0.42, keep: 0.82 },
  snow: { tint: [0.8, 0.84, 0.93], desat: 0.9, gamma: 0.96, veil: '#ccd5e1', amount: 0.62, low: 0.02, high: 0.5, keep: 0.8 },
  fog: { tint: [0.86, 0.88, 0.92], desat: 0.9, gamma: 0.94, veil: '#c9cfd3', amount: 0.975, low: 0.04, high: 0.42, keep: 0.8 },
  night: { tint: [0.07, 0.115, 0.27], desat: 0.7, gamma: 1.1, veil: '#0e1a3e', amount: 0.14, low: 0, high: 0.4, keep: 0.5 },
};
const NONE = { tint: [1, 1, 1], desat: 0, gamma: 1, veil: '#000000', amount: 0, low: 0, high: 1, keep: 1 };

// The grade of this sky on this track: weather and night multiply, the veil of the darker one wins at night. Pure, the tests use it.
export function gradeOf(wx, def) {
  const W = GRADES[wx?.kind] || NONE, night = wx?.night && !isNightTrack(def);
  const already = isNightTrack(def) && wx?.kind !== 'clear';
  if (!night) {
    if (!already) return { ...W, veil: linear(W.veil) };
    // a sky that was dark already: only a thin veil of its own weather, in the dark of the place
    return { tint: [0.74, 0.78, 0.84], desat: W.desat * 0.45, gamma: 1, veil: linear(wx.kind === 'fog' ? '#2f4664' : wx.kind === 'snow' ? '#3a5273' : '#1e2f49'), amount: W.amount * 0.75, low: W.low, high: W.high, keep: W.keep };
  }
  const N = GRADES.night;
  if (W === NONE) return { ...N, veil: linear(N.veil) };
  // a wet night: the dark of the night, the thick air of the weather, in the night's colour
  const dark = { rain: 0.8, snow: 1.25, fog: 1.1 }[wx.kind] ?? 1;
  return {
    tint: N.tint.map((t) => t * dark), desat: Math.max(N.desat, W.desat * 0.9), gamma: N.gamma,
    veil: linear({ rain: '#121a2c', snow: '#2a3656', fog: '#222e48' }[wx.kind] ?? N.veil), amount: W.amount * (wx.kind === 'fog' ? 0.9 : 0.8), low: W.low, high: W.high, keep: W.keep,
  };
}

// The same function as wxGrade below. c: linear [r, g, b]; te: tan of the elevation.
export function gradeLinear(G, c, te = 0) {
  const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const s = (t) => { const x = Math.min(1, Math.max(0, (te - G.low) / Math.max(1e-4, G.high - G.low))); return t * (1 + (G.keep - 1) * x * x * (3 - 2 * x)); };
  const v = s(G.amount);
  return [0, 1, 2].map((k) => {
    const g = Math.pow(Math.max(0, c[k] + (l - c[k]) * G.desat), G.gamma) * G.tint[k];
    return g + (G.veil[k] - g) * v;
  });
}
export function gradeHex(G, hex, te = 0) {
  const c = gradeLinear(G, linear(hex), te);
  return `#${new THREE.Color().setRGB(c[0], c[1], c[2]).getHexString()}`;
}
// the mist strip's bytes, sRGB, in place
export function gradeBytes(G, data) {
  const c = new THREE.Color();
  for (let i = 0; i < data.length; i += 4) {
    c.setRGB(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255, THREE.SRGBColorSpace);
    const g = gradeLinear(G, [c.r, c.g, c.b], 0.02);
    c.setRGB(g[0], g[1], g[2]);
    const hex = c.getHex(THREE.SRGBColorSpace);
    data[i] = (hex >> 16) & 255; data[i + 1] = (hex >> 8) & 255; data[i + 2] = hex & 255;
  }
  return data;
}

export const GRADE_GLSL = /* glsl */`
  uniform vec4 uGrA, uGrB, uGrC; uniform float uGrFlash, uGrStars; uniform vec3 uMoon; uniform vec2 uMoonR;
  vec3 wxGrade(vec3 c, float te){
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    vec3 g = pow(max(mix(c, vec3(l), uGrA.a), 0.0), vec3(uGrC.x)) * uGrA.rgb;
    float v = uGrB.a * mix(1.0, uGrC.w, smoothstep(uGrC.y, uGrC.z, te));
    return mix(g, uGrB.rgb, v) + uGrFlash * vec3(0.62, 0.68, 0.86) * (0.22 + l * 0.6);
  }
  float wxH(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  // Stars on a lattice of directions, each a soft dot of its own size, some twinkling, thinner down near the horizon where the air is thick.
  float wxStars(vec3 d, float t){
    if (uGrStars <= 0.0 || d.y < 0.0) return 0.0;
    vec3 q = d * 150.0, i = floor(q), f = q - i - 0.5;
    float h = wxH(i), on = step(0.965, h), big = fract(h * 91.7);
    float r = 0.1 + 0.22 * big * big, tw = 0.7 + 0.3 * sin(t * (1.0 + big * 3.0) + h * 80.0);
    vec3 o = vec3(fract(h * 17.3), fract(h * 31.7), fract(h * 53.1)) * 0.6 - 0.3;
    return on * uGrStars * smoothstep(r, r * 0.3, length(f - o)) * (0.45 + big) * tw * smoothstep(0.02, 0.22, d.y);
  }
  // A friendly round moon: a disc with soft seas, and its glow.
  vec3 wxMoon(vec3 d){
    if (uMoonR.x <= 0.0) return vec3(0.0);
    float c = dot(d, uMoon), a = acos(clamp(c, -1.0, 1.0)), disc = smoothstep(uMoonR.x, uMoonR.x * 0.93, a);
    vec3 e = d - uMoon * c, w = normalize(cross(uMoon, vec3(0.0, 1.0, 0.0))), u = cross(uMoon, w);
    vec2 q = vec2(dot(e, w), dot(e, u)) / uMoonR.x;
    float sea = smoothstep(0.34, 0.24, length(q - vec2(0.3, 0.22))) * 0.22 + smoothstep(0.26, 0.17, length(q + vec2(0.26, 0.1))) * 0.2 + smoothstep(0.2, 0.12, length(q + vec2(-0.08, 0.42))) * 0.14;
    return vec3(1.0, 0.98, 0.9) * disc * (uMoonR.y * (1.0 - sea)) + vec3(0.42, 0.5, 0.78) * uMoonR.y * 0.2 * exp(-a * a * 42.0) * (1.0 - disc);
  }`;

export function createGradeUniforms() {
  return {
    uGrA: { value: new THREE.Vector4(1, 1, 1, 0) }, uGrB: { value: new THREE.Vector4(0, 0, 0, 0) }, uGrC: { value: new THREE.Vector4(1, 0, 1, 1) },
    uGrFlash: { value: 0 }, uGrStars: { value: 0 }, uMoon: { value: new THREE.Vector3(0, 1, 0) }, uMoonR: { value: new THREE.Vector2(0, 0) },
  };
}
export function setGrade(U, G, wx, look, sunDir, def) {
  U.uGrA.value.set(G.tint[0], G.tint[1], G.tint[2], G.desat);
  U.uGrB.value.set(G.veil[0], G.veil[1], G.veil[2], G.amount);
  U.uGrC.value.set(G.gamma, G.low, G.high, G.keep);
  const clearNight = wx.night && !isNightTrack(def) && wx.kind === 'clear';
  U.uGrStars.value = clearNight ? 1.5 : wx.night && wx.kind === 'snow' ? 0 : 0;
  // the moon stands where the sun was and a little higher, in the top of the frame; thick weather hides it
  const az = Math.atan2(sunDir.x, sunDir.z), el = 17 * Math.PI / 180;
  U.uMoon.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  U.uMoonR.value.set(clearNight ? 2.5 * Math.PI / 180 : 0, 1.5);
}

// ---------- the look under this sky ----------
const SKY_PROFILE = {
  rain: { sun: 0.1, sunC: '#c6ced8', hemiK: 0.78, hemiSky: '#b8c2ce', hemiGround: '#626a60', fog: { density: 0.00125, heightFalloff: 0.0035, max: 0.92 }, mistFrom: 0.7, exposure: 1 },
  snow: { sun: 0.2, sunC: '#dfe6f0', hemiK: 0.92, hemiSky: '#e6ecf4', hemiGround: '#b4bcc8', fog: { density: 0.0021, heightFalloff: 0.002, max: 0.95 }, mistFrom: 0.5, exposure: 1 },
  fog: { sun: 0.12, sunC: '#d8dcdf', hemiK: 0.8, hemiSky: '#d6dbde', hemiGround: '#8e938a', fog: { density: 0.0135, heightFalloff: 0.0005, max: 0.996 }, mistFrom: 0.16, exposure: 1 },
};
const NIGHT_PROFILE = {
  sun: 0.5, sunC: '#a8bdf2', hemiK: 0.3, hemiSky: '#6a7cb4', hemiGround: '#242c48',
  fog: { density: 0.0011, heightFalloff: 0.003, max: 0.9 }, bloom: { threshold: 0.86, strength: 0.62 },
};

// A new look: the track's own is never touched, since the next race may want it as it is.
export function weatherLook(look, wx, def) {
  const G = gradeOf(wx, def), P = SKY_PROFILE[wx.kind], night = wx.night && !isNightTrack(def), onNight = isNightTrack(def);
  const out = { ...look, sun: { ...look.sun }, hemi: { ...look.hemi }, fog: { ...look.fog }, mist: { ...look.mist }, sky: { ...look.sky, clouds: { ...look.sky.clouds } }, horizon: { ...look.horizon }, water: { ...look.water }, outline: { ...look.outline }, bloom: { ...look.bloom } };
  const greyed = (hex) => gradeHex(G, hex, 0.02);
  out.fog.color = greyed(look.fog.color);
  if (P && !onNight) {
    out.sun.color = P.sunC; out.sun.intensity = look.sun.intensity * P.sun;
    out.hemi.sky = P.hemiSky; out.hemi.ground = P.hemiGround; out.hemi.intensity = look.hemi.intensity * P.hemiK;
    Object.assign(out.fog, P.fog);
    out.mist.from = look.mist.from * P.mistFrom; out.mist.to = Math.max(out.mist.from + 200, look.mist.to * Math.max(P.mistFrom, 0.3));
  } else if (P && onNight) {
    out.fog.density = Math.max(look.fog.density, P.fog.density * 0.8); out.fog.max = Math.max(look.fog.max ?? 0.8, 0.9); out.fog.heightFalloff = P.fog.heightFalloff;
    out.hemi.intensity = look.hemi.intensity * 0.9; out.sun.intensity = look.sun.intensity * 0.45;
  }
  if (night) {
    const N = NIGHT_PROFILE;
    out.sun.color = N.sunC; out.sun.intensity = look.sun.intensity * N.sun * (P ? 0.35 : 1);
    out.hemi.sky = N.hemiSky; out.hemi.ground = N.hemiGround; out.hemi.intensity = look.hemi.intensity * N.hemiK * (P ? 1.15 : 1);
    if (!P) Object.assign(out.fog, N.fog);
    else out.fog.density *= wx.kind === 'fog' ? 0.8 : 1;
    out.bloom = { ...look.bloom, ...N.bloom };
    out.outline.color = '#0f1220';
    out.kartShadow = [0.008, 0.009, 0.018, 0.62]; // a blob in the day's purple would shine on a dark road
  }
  // a sun that is not there: no disc and no glow in the dome; its colours would only be graded back in
  if (wx.kind !== 'clear' || wx.night) { out.sky.glow = '#000000'; out.sky.glowStrength = 0; }
  if (wx.kind !== 'clear') { out.sky.clouds.amount = Math.min(out.sky.clouds.amount ?? 0, 0.1); }
  // what is drawn unlit: its colours are the light
  for (const k of Object.keys(out.water)) if (typeof out.water[k] === 'string' && out.water[k][0] === '#') out.water[k] = greyed(out.water[k]);
  if (out.water.sky) out.water.sky = { ...out.water.sky, high: greyed(out.water.sky.high ?? '#000000'), low: greyed(out.water.sky.low ?? '#000000') };
  if (out.water.still) out.water.still = { ...out.water.still, deep: greyed(out.water.still.deep), base: greyed(out.water.still.base) };
  for (const k of Object.keys(out.horizon)) if (typeof out.horizon[k] === 'string' && out.horizon[k][0] === '#') out.horizon[k] = greyed(out.horizon[k]);
  // the pen lifts sooner in thick air: an ink line through fog is drawn on nothing
  const pen = { fog: [16, 80], snow: [50, 240], rain: [90, 340] }[wx.kind];
  if (pen) out.outline.fade = pen;
  // what the air hides need not be drawn: the triangles pay for the lamps and the poles
  // and a long road has no triangles to spare: its landmarks already sit near the budget
  const treeFar = ({ fog: 0.36, snow: 0.72, rain: 0.86 }[wx.kind] ?? (night ? 0.8 : 1)) * (def?.long ? 0.62 : 1);
  if (treeFar < 1) out.trees = { ...look.trees, far: look.trees.far * treeFar };
  out.weather = wx;
  return out;
}

// What the shaders of the world read for this sky (toon.js shared.wx). Pure numbers.
export function wxShared(wx, def, look) {
  const G = gradeOf(wx, def), snow = wx.kind === 'snow' ? 1 : 0, wet = wx.kind === 'rain' ? 1 : wx.kind === 'fog' ? 0.28 : snow ? 0.12 : 0;
  // a sky to mirror in a wet road: the colour at the horizon
  const sky = gradeLinear(G, linear(look.fog.color), 0.03);
  // by day the lamps are on, as they would be in that weather, but they are not what lights the road
  const lampsOn = wx.night || isNightTrack(def) ? 1 : wx.kind === 'fog' ? 0.2 : wx.kind === 'rain' ? 0.1 : 0.07;
  return { on: 1, snow, wet, sky, lamps: lampsOn, night: wx.night && !isNightTrack(def) ? 1 : 0 };
}

// ---------- the street lamps of a night ----------
// A lamp every so often on the outside of the bend, none in a tunnel. Each place has its own: a larch post with an iron lantern in Cadore, a pole with a little roof in Romania,
// a bamboo torch in the Indonesian countryside, a steel arm over a street in the city.
export function lampSpots(track, every = 72) {
  const S = track.samples, n = track.n, step = track.step, out = [];
  let side = 1;
  for (let m = 24; m < track.length - 8; m += every) {
    const i = Math.round(m / step) % n;
    if (track.structureAt(i) === 'tunnel') continue;
    const k = track.curvature[i];
    side = Math.abs(k) > 0.004 ? (k > 0 ? -1 : 1) : -side; // k + turns left: the outside is the right, whose d is negative
    const d = side * (S.w[i] / 2 + (track.structureAt(i) ? 0.1 : 1.5)); // on a deck it is fixed to the parapet
    out.push({ i, side, d, x: S.x[i] + S.nx[i] * d, z: S.z[i] + S.nz[i] * d, nx: S.nx[i] * side, nz: S.nz[i] * side, y: track.heightAt(i, Math.sign(d) * (S.w[i] / 2)), deck: !!track.structureAt(i) });
  }
  return out;
}
export const GLOW_KIND = 40; // aPaint: drawn at full light, whatever the night (toon.js)
const STYLE = { cadore: 'lantern', romania: 'pole', indonesia: 'torch', city: 'street' };
const LIGHT = { lantern: '#ffdcae', pole: '#ffe0b4', torch: '#ffc488', street: '#ffd09c' };
const lampStyle = (def) => (def.traffic ? 'street' : STYLE[def.region] || 'lantern');

function lampGeometry(style) {
  const P = [], at = (g, c, k = 0, p) => { P.push(paint(place(g, { p }), c, k)); };
  const gl = [3.4, 2.5, 1.5]; // over 1: a colour that is its own light
  if (style === 'torch') { // a bamboo pole, a flame in a coconut husk
    at(cylinder(0.09, 0.11, 4.6, 6, true), '#a98a55', 0, [0, 2.3, 0]);
    at(cylinder(0.2, 0.13, 0.42, 7, true), '#5a3e28', 0, [0, 4.72, 0]);
    at(sphere(0.3, 6, 5), [3.6, 1.7, 0.5], GLOW_KIND, [0, 5.05, 0]);
    at(cone(0.2, 0.6, 6), [4.2, 2.8, 1], GLOW_KIND, [0, 5.42, 0]);
  } else if (style === 'street') { // steel arm over the road
    at(cylinder(0.11, 0.15, 7.6, 7, true), '#566072', 0, [0, 3.8, 0]);
    at(box(0.14, 0.12, 2.8), '#566072', 0, [0, 7.55, 1.3]);
    at(box(0.36, 0.14, 0.9), [4, 2.6, 1.2], GLOW_KIND, [0, 7.44, 2.5]);
  } else if (style === 'pole') { // a timber pole, a small tin roof, a lantern under it
    at(cylinder(0.12, 0.15, 5, 6, true), '#4f3a2a', 0, [0, 2.5, 0]);
    at(box(0.1, 0.1, 1.5), '#4f3a2a', 0, [0, 4.9, 0.65]);
    at(box(0.62, 0.1, 0.62), '#39424e', 0, [0, 4.72, 1.25]);
    at(sphere(0.25, 7, 5), gl, GLOW_KIND, [0, 4.4, 1.25]);
  } else { // larch post, iron arm, a square lantern
    at(box(0.26, 5, 0.26), '#6a4d32', 0, [0, 2.5, 0]);
    at(box(0.1, 0.1, 1.5), '#2d2a2c', 0, [0, 4.8, 0.65]);
    at(box(0.5, 0.08, 0.5), '#2d2a2c', 0, [0, 4.66, 1.28]);
    at(box(0.38, 0.5, 0.38), gl, GLOW_KIND, [0, 4.36, 1.28]);
    at(box(0.46, 0.06, 0.46), '#2d2a2c', 0, [0, 4.08, 1.28]);
  }
  return merge(P);
}

export function nightLamps(track, terrain, def) {
  const style = lampStyle(def), spots = lampSpots(track, style === 'street' ? 54 : 72);
  for (const q of spots) {
    const ground = terrain?.heightAt ? terrain.heightAt(q.x, q.z) : q.y;
    // on a deck or over a fall the post stands on the road's edge; into a bank it goes up from the road, so the lamp always hangs over the road
    q.base = q.deck ? q.y : Math.max(q.y - 2.2, Math.min(ground, q.y + 0.2));
    q.top = q.base + (style === 'street' ? 7.44 : style === 'torch' ? 5.1 : 4.4);
    const over = style === 'street' ? 2.5 : style === 'torch' ? 0 : 1.28;
    q.lx = q.x - q.nx * over; q.lz = q.z - q.nz * over;
    q.yaw = Math.atan2(-q.nx, -q.nz);
  }
  return { style, spots, color: LIGHT[style] };
}

// Snow poles, the red and white stakes of a mountain road: when the ground goes white, or the air, they say where the road ends. Their tops catch the lights.
export function poleSpots(track, every = 26) {
  const S = track.samples, n = track.n, out = [];
  for (let m = 10; m < track.length - 4; m += every) {
    const i = Math.round(m / track.step) % n;
    if (track.structureAt(i)) continue; // a bridge has its parapet
    for (const side of [-1, 1]) {
      const d = side * (S.w[i] / 2 + 0.9);
      out.push({ x: S.x[i] + S.nx[i] * d, z: S.z[i] + S.nz[i] * d, y: track.heightAt(i, side * (S.w[i] / 2)), yaw: Math.atan2(S.tx[i], S.tz[i]) });
    }
  }
  return out;
}
function poleGeometry(glow) {
  const P = [], at = (g, c, k, p) => P.push(paint(place(g, { p }), c, k));
  // three sided, no caps: hundreds of them, and all you ever see is a stripe
  at(cylinder(0.11, 0.11, 0.82, 3, true), '#f4f1ea', 0, [0, 0.41, 0]);
  at(cylinder(0.11, 0.11, 0.44, 3, true), '#d8402f', 0, [0, 1.04, 0]);
  at(cylinder(0.11, 0.11, 0.42, 3, true), '#f4f1ea', 0, [0, 1.47, 0]);
  at(cylinder(0.13, 0.13, 0.3, 3, false), glow, GLOW_KIND, [0, 1.83, 0]);
  return merge(P);
}

// The light of the lamps laid on the world from above: a warm disc per lamp and a small one per window near the road, one texture, nothing per frame, so a kart that drives under a lamp is lit by it.
export function bakeLitMap(track, lamps, windows = []) {
  const S = track.samples; let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < track.n; i += 4) { x0 = Math.min(x0, S.x[i]); x1 = Math.max(x1, S.x[i]); z0 = Math.min(z0, S.z[i]); z1 = Math.max(z1, S.z[i]); }
  const M = 120; x0 -= M; x1 += M; z0 -= M; z1 += M;
  const size = 2048, sx = size / (x1 - x0), sz = size / (z1 - z0);
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, size, size);
  g.globalCompositeOperation = 'lighter';
  const disc = (x, z, r, hex, a) => {
    const px = (x - x0) * sx, pz = (z - z0) * sz, rx = Math.max(2, r * sx), rz = Math.max(2, r * sz);
    g.save(); g.translate(px, pz); g.scale(rx, rz);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1), c = new THREE.Color(hex), rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
    gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(0.4, `rgba(${rgb},${a * 0.62})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, 6.2832); g.fill(); g.restore();
  };
  for (const q of lamps?.spots || []) disc(q.lx ?? q.x, q.lz ?? q.z, 15, lamps.color, 0.8);
  for (const w of windows) if (w.near) disc(w.x + w.nx * 2.2, w.z + w.nz * 2.2, 5.5, '#ffb765', 0.3);
  // alpha: the height of the ground each pool lies on, so that it stays there. A village 30 m under the road, in plan inside a lamp's disc, is in the dark.
  const img = g.getImageData(0, 0, size, size), px = img.data;
  let y0 = Infinity, y1 = -Infinity;
  const raised = [...(lamps?.spots || []).map((q) => [q.lx ?? q.x, q.lz ?? q.z, q.base ?? q.y, 15]), ...windows.filter((w) => w.near).map((w) => [w.x + w.nx * 2.2, w.z + w.nz * 2.2, w.y, 5.5])];
  for (const q of raised) { y0 = Math.min(y0, q[2]); y1 = Math.max(y1, q[2]); }
  const span = Math.max(1, y1 - y0);
  for (let i = 3; i < px.length; i += 4) px[i] = 0;
  for (const [x, z, y, r] of raised) {
    const a = Math.max(1, Math.round(((y - y0) / span) * 255)), cx = (x - x0) * sx, cz = (z - z0) * sz, rx = r * sx + 1, rz = r * sz + 1;
    for (let v = Math.max(0, Math.floor(cz - rz)); v <= Math.min(size - 1, Math.ceil(cz + rz)); v++) {
      for (let u = Math.max(0, Math.floor(cx - rx)); u <= Math.min(size - 1, Math.ceil(cx + rx)); u++) {
        if (((u - cx) / rx) ** 2 + ((v - cz) / rz) ** 2 <= 1) px[(v * size + u) * 4 + 3] = a;
      }
    }
  }
  const tex = new THREE.DataTexture(new Uint8Array(px.buffer), size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.needsUpdate = true; tex.premultiplyAlpha = false;
  tex.colorSpace = THREE.NoColorSpace; tex.generateMipmaps = false; tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.flipY = false;
  return { tex, rect: [x0, z0, 1 / (x1 - x0), 1 / (z1 - z0)], height: [Number.isFinite(y0) ? y0 : 0, span] };
}

// ---------- lit windows ----------
// The windows are in the landmarks' colours and every track paints its own, so they are found in the merged geometry: small upright faces, unpainted, in the colour of a pane.
// A pane already painted as a warm light is one on any track; PANES has the dark and glassy ones per track, in sRGB. Most light up, each in a warm tone of its own; a few stay dark, as in any street.
const PANES = { bucarest: ['#6e6f9a'], antelao: ['#6d6a71'], transfagarasan: ['#323d42', '#4e5c64'], batur: ['#24272c'], jakarta: ['#4d6f87', '#38556e', '#415f77', '#416a89'], pelmo: ['#565968'], cortina: ['#6d6a71', '#3e4258', '#5a5a72'] };
const AREA = { jakarta: 60 };
const srgb = (v) => (v <= 0 ? 0 : v >= 1 ? 255 : Math.round((v < 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255));
function paneTest(def) {
  const keys = (PANES[def?.id] || []).map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  return (r, g, b) => {
    const R = srgb(r), G = srgb(g), B = srgb(b);
    if (R >= 250 && G >= 190 && B >= 120 && B <= 196) return true;
    return keys.some((k) => Math.abs(k[0] - R) + Math.abs(k[1] - G) + Math.abs(k[2] - B) < 14);
  };
}
export function tagWindows(meshes, { track = null, def = track?.def } = {}) {
  const out = [], WARM = [[3.4, 2.1, 0.86], [3.2, 1.75, 0.62], [3.1, 2.3, 1.2], [2.9, 1.55, 0.5]], test = paneTest(def), maxArea = AREA[def?.id] ?? 3.2;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3();
  for (const m of meshes) {
    const g = m.geometry, P = g.attributes.position, C = g.attributes.color, K = g.attributes.aPaint, I = g.index;
    if (!P || !C || !K) continue;
    const tris = I ? I.count / 3 : P.count / 3, get = (t, v) => (I ? I.getX(t * 3 + v) : t * 3 + v);
    const seen = new Int8Array(P.count); // what one corner of a pane decided holds for the other triangle that shares it: 1 lit, -1 dark
    let lastT = -9, lastOn = 0;
    const todo = [], paneTone = new Int8Array(P.count).fill(-1);
    // the tone of a pane: whichever corner has one already, so its two triangles agree
    const tone = (i, j, k) => { const v = paneTone[i] >= 0 ? paneTone[i] : paneTone[j] >= 0 ? paneTone[j] : paneTone[k] >= 0 ? paneTone[k] : (i * 7 + (i >> 3)) % WARM.length; paneTone[i] = paneTone[j] = paneTone[k] = v; return v; };
    for (let t = 0; t < tris; t++) {
      const i0 = get(t, 0), i1 = get(t, 1), i2 = get(t, 2);
      if (K.getX(i0) > 0.5 || K.getX(i1) > 0.5 || K.getX(i2) > 0.5) continue;
      if (!test(C.getX(i0), C.getY(i0), C.getZ(i0))) continue;
      a.fromBufferAttribute(P, i0); b.fromBufferAttribute(P, i1); c.fromBufferAttribute(P, i2);
      ab.subVectors(b, a); ac.subVectors(c, a); n.crossVectors(ab, ac);
      const area = n.length() * 0.5;
      if (area < 0.1 || area > maxArea) continue;
      // a pane is not a post: the same grey on a tall thin face is a sign's leg (a strip of glazing is long, but it lies flat)
      const tall = Math.max(a.y, b.y, c.y) - Math.min(a.y, b.y, c.y), wide = Math.hypot(Math.max(a.x, b.x, c.x) - Math.min(a.x, b.x, c.x), Math.max(a.z, b.z, c.z) - Math.min(a.z, b.z, c.z));
      if (tall > wide * 5) continue;
      n.normalize();
      if (Math.abs(n.y) > 0.25) continue;
      const x = (a.x + b.x + c.x) / 3, y = (a.y + b.y + c.y) / 3, z = (a.z + b.z + c.z) / 3;
      let on = seen[i0] || seen[i1] || seen[i2];
      // a quad of unshared corners: two triangles in a row
      if (!on && !I && lastT === t - 1) on = lastOn;
      if (!on) on = hash3(Math.round(x * 3.1), Math.round(y * 3.1), Math.round(z * 3.1)) < 0.2 ? -1 : 1;
      seen[i0] = seen[i1] = seen[i2] = on; lastT = t; lastOn = on;
      // written after the walk: the other triangle of the pane must still find its corners in their old colour
      todo.push(i0, i1, i2, on, area > 6 ? 0.42 : 1); // a whole shopfront is not as bright as a lamp behind a small pane
      if (on > 0) out.push({ x, y, z, nx: n.x, nz: n.z, near: !track || nearRoad(track, x, z) });
    }
    for (let q = 0; q < todo.length; q += 5) {
      const on = todo[q + 3], k = todo[q + 4], w = WARM[tone(todo[q], todo[q + 1], todo[q + 2])];
      for (let e = 0; e < 3; e++) {
        const i = todo[q + e];
        if (on < 0) C.setXYZ(i, 0.018, 0.024, 0.04);
        else { C.setXYZ(i, w[0] * k, w[1] * k, w[2] * k); K.setX(i, GLOW_KIND); }
      }
    }
    if (todo.length) { C.needsUpdate = true; K.needsUpdate = true; }
  }
  return out;
}
function nearRoad(track, x, z) {
  try { return Math.abs(track.nearest(x, z).d) - track.samples.w[0] / 2 < 26; } catch { return false; }
}

// ---------- rain, snow, puddles, drifts, the lights of the karts ----------
const BOX = 44, HIGH = 24;
function createRainMesh() {
  const N = 2300, pos = new Float32Array(N * 12), end = new Float32Array(N * 4), side = new Float32Array(N * 4), idx = new Uint32Array(N * 6);
  const rnd = (i, k) => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < N; i++) {
    const x = rnd(i, 1) * BOX, y = rnd(i, 2) * HIGH, z = rnd(i, 3) * BOX;
    for (let v = 0; v < 4; v++) { pos.set([x, y, z], (i * 4 + v) * 3); end[i * 4 + v] = v >> 1; side[i * 4 + v] = v & 1 ? 1 : -1; }
    idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const uniforms = { uT: { value: 0 }, uCam: { value: new THREE.Vector3() }, uV: { value: new THREE.Vector3() }, uAmt: { value: 0 }, uPx: { value: new THREE.Vector2(1, 1) }, uC: { value: new THREE.Color('#d6e2f0') }, uBeam: { value: new THREE.Vector4() }, uBeamD: { value: new THREE.Vector3() } };
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    vertexShader: /* glsl */`attribute float aEnd, aSide; uniform float uT, uAmt; uniform vec3 uCam, uV, uBeamD; uniform vec4 uBeam; uniform vec2 uPx; varying float vA;
      void main(){ vec3 p = position; float h = fract(position.x * 7.13 + position.z * 3.7);
        p.y -= uT * (24.0 + h * 8.0); p.x += uT * 2.6; p.z += uT * 1.1;
        p.x = mod(p.x - uCam.x + ${(BOX / 2).toFixed(1)}, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)} + uCam.x;
        p.z = mod(p.z - uCam.z + ${(BOX / 2).toFixed(1)}, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)} + uCam.z;
        p.y = mod(p.y - uCam.y + 7.0, ${HIGH.toFixed(1)}) - 7.0 + uCam.y;
        // the streak runs along the drop's way through the air as the camera sees it, so that it rushes at you at speed
        vec3 dir = vec3(2.6, -28.0, 1.1) - uV, tail = p + dir * 0.036;
        vec4 a = projectionMatrix * viewMatrix * vec4(p, 1.0), b = projectionMatrix * viewMatrix * vec4(tail, 1.0);
        vec2 sa = a.xy / max(a.w, 0.05), sb = b.xy / max(b.w, 0.05), lin = normalize((sb - sa) / uPx + 1e-5), nrm = vec2(-lin.y, lin.x) * uPx;
        vec4 c = mix(a, b, aEnd);
        float near = smoothstep(1.6, 6.0, length(p - uCam));
        c.xy += nrm * aSide * c.w * (0.8 + 0.8 * h);
        vec3 off = p - uBeam.xyz; float q = dot(off, uBeamD), lit = uBeam.w * smoothstep(0.0, 4.0, q) * smoothstep(34.0, 10.0, q) * smoothstep(1.0 + q * 0.5, 0.0, length(off - uBeamD * q));
        vA = (0.1 + 0.26 * h + lit * 0.5) * uAmt * near * (a.w > 0.05 && b.w > 0.05 ? 1.0 : 0.0) * mix(0.25, 1.0, aEnd);
        gl_Position = c; }`,
    fragmentShader: /* glsl */`uniform vec3 uC; varying float vA; void main(){ gl_FragColor = vec4(uC, vA); }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 880;
  return { mesh, uniforms, geo, mat };
}
function createSnowMesh() {
  const N = 3400, pos = new Float32Array(N * 3), seed = new Float32Array(N), B = 58, H = 30;
  const rnd = (i, k) => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < N; i++) { pos.set([rnd(i, 1) * B, rnd(i, 2) * H, rnd(i, 3) * B], i * 3); seed[i] = rnd(i, 4); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const uniforms = { uT: { value: 0 }, uCam: { value: new THREE.Vector3() }, uAmt: { value: 0 }, uScale: { value: 600 }, uC: { value: new THREE.Color('#ffffff') }, uBeam: { value: new THREE.Vector4() }, uBeamD: { value: new THREE.Vector3() } };
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms,
    blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    vertexShader: /* glsl */`attribute float aSeed; uniform float uT, uAmt, uScale; uniform vec3 uCam, uBeamD; uniform vec4 uBeam; varying float vA;
      void main(){ vec3 p = position; float s = aSeed;
        p.y -= uT * (1.9 + s * 1.5);
        p.x += sin(uT * (0.5 + s) + s * 40.0) * (0.8 + s * 1.2) + uT * 0.9;
        p.z += cos(uT * (0.4 + s * 0.8) + s * 25.0) * (0.8 + s) + uT * 0.35;
        p.x = mod(p.x - uCam.x + ${(B / 2).toFixed(1)}, ${B.toFixed(1)}) - ${(B / 2).toFixed(1)} + uCam.x;
        p.z = mod(p.z - uCam.z + ${(B / 2).toFixed(1)}, ${B.toFixed(1)}) - ${(B / 2).toFixed(1)} + uCam.z;
        p.y = mod(p.y - uCam.y + 9.0, ${H.toFixed(1)}) - 9.0 + uCam.y;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        vec3 off = p - uBeam.xyz; float q = dot(off, uBeamD), lit = uBeam.w * smoothstep(0.0, 4.0, q) * smoothstep(38.0, 10.0, q) * smoothstep(1.2 + q * 0.5, 0.0, length(off - uBeamD * q));
        vA = (0.55 + 0.45 * s + lit * 0.6) * uAmt * smoothstep(1.3, 4.0, -mv.z) * smoothstep(52.0, 26.0, -mv.z);
        gl_PointSize = clamp((0.09 + 0.1 * s) * uScale / max(-mv.z, 0.1), 2.0, 20.0);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`uniform vec3 uC; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; gl_FragColor = vec4(uC, vA * (1.0 - smoothstep(0.45, 1.0, r))); }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false; points.visible = false; points.renderOrder = 880;
  return { mesh: points, uniforms, geo, mat };
}

// The kart's lamps: [x (mirrored unless 0), y, z] in its model's own metres, front and back. By eye against tools/shoot-karts.mjs; a kart with no entry gets the plain pair.
const LAMPS = {
  _: { front: [[0.52, 0.72, 1.12]], back: [[0.52, 0.72, -1.12]] },
  tabia: { front: [[0.62, 0.7, 1.16]], back: [[0.62, 0.74, -1.18]] },
  gatto: { front: [[0.52, 1.32, 1.02]], back: [[0.58, 1.05, -1.3]] },
  seggiovia: { front: [[0.42, 0.56, 1.2]], back: [[0.38, 0.92, -1.32]] },
  mocanita: { front: [[0, 1.34, 1.34]], back: [[0.5, 0.62, -1.38]] },
  caruta: { front: [[0, 1.3, 1.04]], back: [[0.46, 0.82, -1.24]] },
  logan: { front: [[0.62, 0.72, 1.28]], back: [[0.66, 0.92, -1.26]] },
  jeep: { front: [[0.58, 0.92, 1.3]], back: [[0.62, 0.78, -1.26]] },
  becak: { front: [[0, 0.98, 1.2]], back: [[0.3, 0.6, -1.2]] },
  jukung: { front: [[0, 1.05, 1.4]], back: [[0.4, 0.72, -1.3]] },
  baileys: { front: [[0.46, 0.7, 1.05]], back: [[0.46, 0.7, -1.06]] },
  fifi: { front: [[0.5, 0.72, 1.06]], back: [[0.5, 0.74, -1.08]] },
};

export function createWeatherWorld({ scene, shared, mat, track, wx, look, def, lamps, fx }) {
  const rain = wx.kind === 'rain' ? createRainMesh() : null, snow = wx.kind === 'snow' ? createSnowMesh() : null, fall = rain || snow;
  if (fall) scene.add(fall.mesh);
  const night = !!shared.wx.uWxNight.value, Wx = shared.wx, dark = wx.night || isNightTrack(def);
  if (rain) rain.uniforms.uC.value.set(dark ? '#7f92b4' : '#dbe5f0');
  if (snow) snow.uniforms.uC.value.set(dark ? '#a7b8d8' : '#ffffff');

  // ---- lamp posts and snow poles: each one instanced mesh, one draw per view whatever the length of the road
  const glowMat = mat('#ffffff', { vertexColors: true, paint: true });
  // Whole-lap lists, but only what is in reach of the view being drawn goes to the GPU: on a long road the rest would be most of the triangles.
  const culls = [];
  const instanced = (geo, list, reach, y = (q) => q.y) => {
    const im = new THREE.InstancedMesh(geo, glowMat, list.length), M = new THREE.Matrix4(), E = new THREE.Euler(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), O = new THREE.Vector3(1, 1, 1);
    const baked = new Float32Array(list.length * 16), out = im.instanceMatrix.array, r2 = reach * reach;
    list.forEach((q, i) => { M.compose(V.set(q.x, y(q), q.z), Q.setFromEuler(E.set(0, q.yaw ?? 0, 0)), O); M.toArray(baked, i * 16); });
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.frustumCulled = false;
    culls.push((cx, cz) => {
      let n = 0;
      for (let i = 0; i < list.length; i++) {
        const dx = list[i].x - cx, dz = list[i].z - cz;
        if (dx * dx + dz * dz > r2) continue;
        for (let e = 0; e < 16; e++) out[n * 16 + e] = baked[i * 16 + e];
        n++;
      }
      im.count = n; im.visible = n > 0;
      im.instanceMatrix.clearUpdateRanges(); im.instanceMatrix.addUpdateRange(0, n * 16); im.instanceMatrix.needsUpdate = true;
    });
    return im;
  };
  let posts = null, poles = null;
  if (lamps?.spots.length) { posts = instanced(lampGeometry(lamps.style), lamps.spots, 620, (q) => q.base); scene.add(posts); }
  // a long road keeps its budget by spacing them out, and a city has kerbs and lamps instead
  const wantPoles = !def.traffic && (wx.kind === 'snow' || wx.kind === 'fog' || (wx.night && !isNightTrack(def)));
  const poleList = wantPoles ? poleSpots(track, Math.max(26, track.length / 140)) : [];
  if (poleList.length) { poles = instanced(poleGeometry(dark ? [2.4, 1.9, 1.2] : [0.95, 0.8, 0.5]), poleList, 340); scene.add(poles); }

  // ---- halos, one point cloud: the lamps' still ones first, then four per kart
  const lampList = lamps?.spots || [], KART_POINTS = 8 * 4, NP = lampList.length + KART_POINTS, hp = new Float32Array(NP * 3), hc = new Float32Array(NP * 3), hs = new Float32Array(NP);
  const lc = new THREE.Color(lamps?.color || '#ffc27a');
  lampList.forEach((q, i) => { hp.set([q.lx ?? q.x, q.top, q.lz ?? q.z], i * 3); hc.set([lc.r, lc.g, lc.b], i * 3); hs[i] = 3.4; });
  const hg = new THREE.BufferGeometry();
  const hpA = new THREE.BufferAttribute(hp, 3).setUsage(THREE.DynamicDrawUsage), hcA = new THREE.BufferAttribute(hc, 3).setUsage(THREE.DynamicDrawUsage), hsA = new THREE.BufferAttribute(hs, 1).setUsage(THREE.DynamicDrawUsage);
  hg.setAttribute('position', hpA); hg.setAttribute('aC', hcA); hg.setAttribute('aS', hsA);
  const thick = wx.kind === 'fog' ? 1.7 : wx.kind === 'rain' ? 1.25 : wx.kind === 'snow' ? 1.3 : 1;
  const haloU = { uScale: { value: 600 }, uK: { value: dark ? 1.15 : 0.72 }, uFog: { value: Math.min(look.fog.density, 0.0045) } };
  const haloMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: haloU,
    blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    vertexShader: /* glsl */`attribute vec3 aC; attribute float aS; uniform float uScale, uFog; varying vec3 vC; varying float vF;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vC = aC; vF = exp(-uFog * -mv.z); gl_PointSize = aS <= 0.0 ? 0.0 : clamp(aS * uScale / max(-mv.z, 0.5), 2.0, 240.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`uniform float uK; varying vec3 vC; varying float vF; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; float a = pow(1.0 - r, 2.4); gl_FragColor = vec4(vC * (0.5 + 2.6 * a), a * uK * vF); }`,
  });
  const halos = new THREE.Points(hg, haloMat);
  halos.frustumCulled = false; halos.renderOrder = 870;
  scene.add(halos);

  // ---- beams, a cone per kart that shows in the air in front of it
  const beamGeo = new THREE.ConeGeometry(5.4, 22, 16, 1, true);
  beamGeo.translate(0, -11, 0); beamGeo.rotateX(-Math.PI / 2); // apex at the lamp, opening along +z
  const beamK = (dark ? 0.1 : 0.05) * (wx.kind === 'fog' ? 2.1 : wx.kind === 'rain' ? 1.5 : wx.kind === 'snow' ? 1.6 : 1);
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uK: { value: beamK } },
    blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    vertexShader: /* glsl */`varying float vT, vD; varying vec3 vN, vV;
      void main(){ vT = position.z / 22.0; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vec4 mv = viewMatrix * w; vD = length(mv.xyz); vN = normalize(mat3(viewMatrix) * mat3(modelMatrix) * mat3(instanceMatrix) * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`uniform float uK; varying float vT, vD; varying vec3 vN, vV; void main(){ float f = abs(dot(normalize(vN), normalize(vV))); gl_FragColor = vec4(1.0, 0.9, 0.72, uK * f * f * pow(max(1.0 - vT, 0.0), 1.6) * smoothstep(0.0, 0.05, vT) * smoothstep(5.0, 18.0, vD)); }`,
  });
  const beams = new THREE.InstancedMesh(beamGeo, beamMat, 8);
  beams.frustumCulled = false; beams.renderOrder = 860; beams.visible = false;
  scene.add(beams);
  const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), eul = new THREE.Euler(0, 0, 0, 'YXZ'), v3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);

  // ---- puddles and drifts: one instanced mesh, laid on the road's own slope
  let patchMesh = null;
  const road = track;
  function setPatches(list) {
    if (patchMesh) { scene.remove(patchMesh); patchMesh.dispose(); patchMesh = null; }
    if (!list?.length) return;
    let geo, material;
    if (wx.kind === 'rain') {
      geo = new THREE.CircleGeometry(1, 28); geo.rotateX(-Math.PI / 2);
      material = puddleMaterial(shared);
    } else {
      geo = new THREE.SphereGeometry(1, 16, 7, 0, Math.PI * 2, 0, Math.PI / 2);
      material = mat('#f6f9fd', { rim: [0.02, 3] });
    }
    patchMesh = new THREE.InstancedMesh(geo, material, list.length);
    patchMesh.frustumCulled = false;
    const up = new THREE.Vector3(), fw = new THREE.Vector3(), right = new THREE.Vector3(), m = new THREE.Matrix4();
    list.forEach((q, k) => {
      const f = q.i, h0 = road.heightAt(f - 2, q.d), h1 = road.heightAt(f + 2, q.d), hl = road.heightAt(f, q.d + 1.5), hr = road.heightAt(f, q.d - 1.5), S = road.samples, i = q.i;
      // x is the road's left, y up, z along: a right handed frame, or the disc would show its back to the sky
      fw.set(S.tx[i], (h1 - h0) / (4 * road.step), S.tz[i]).normalize();
      right.set(S.nx[i], (hl - hr) / 3, S.nz[i]).normalize();
      up.crossVectors(fw, right).normalize();
      right.crossVectors(up, fw).normalize();
      m.makeBasis(right, up, fw);
      const scale = wx.kind === 'rain' ? [q.rz, 1, q.rx] : [q.rz, 0.5, q.rx];
      m.scale(v3.set(...scale));
      m.setPosition(q.x, q.y + (wx.kind === 'rain' ? 0.05 : -0.04), q.z);
      patchMesh.setMatrixAt(k, m);
    });
    patchMesh.instanceMatrix.needsUpdate = true;
    scene.add(patchMesh);
  }

  // what each kart's lamps are this frame, and which of them this view takes for real light
  const headP = Wx.uHeadP.value, headD = Wx.uHeadD.value;
  const lit = new Array(8).fill(null).map(() => ({ x: 0, y: 0, z: 0, fx: 0, fz: 1, on: 0, k: null }));
  const prevCam = [{}, {}, {}, {}];
  let count = 0, tick = 0;
  const lightK = Wx.uWxLamps.value;
  function update(K, time, dt, state) {
    count = K.length;
    let at = lampList.length * 3, ai = lampList.length;
    for (let i = 0; i < 8; i++) {
      const k = K[i], L = lit[i];
      if (!k) { L.on = 0; beams.setMatrixAt(i, m4.makeScale(0, 0, 0)); continue; }
      L.k = k;
      const cs = Math.cos(k.yaw), sn = Math.sin(k.yaw);
      L.x = k.x + sn * 1.1; L.z = k.z + cs * 1.1; L.y = k.y + 0.95; L.fx = sn; L.fz = cs; L.on = 1;
      const spec = LAMPS[k.kart] || LAMPS._;
      const put = (q, sign, hexR, hexG, hexB, size) => {
        const xx = q[0] * sign, zz = q[2];
        hp[at] = k.x + cs * xx + sn * zz; hp[at + 1] = k.y + q[1]; hp[at + 2] = k.z - sn * xx + cs * zz;
        hc[at] = hexR; hc[at + 1] = hexG; hc[at + 2] = hexB; hs[ai] = size;
        at += 3; ai++;
      };
      for (const q of spec.front) { if (q[0]) { put(q, 1, 1, 0.92, 0.74, 1.15 * thick); put(q, -1, 1, 0.92, 0.74, 1.15 * thick); } else { put(q, 1, 1, 0.92, 0.74, 1.5 * thick); put(q, 1, 0, 0, 0, 0); } }
      const braking = (k.throttle ?? 1) < -0.2;
      for (const q of spec.back) { const s = (braking ? 1.05 : 0.68) * thick; if (q[0]) { put(q, 1, 1, 0.1, 0.07, s); put(q, -1, 1, 0.1, 0.07, s); } else { put(q, 1, 1, 0.1, 0.07, s); put(q, 1, 0, 0, 0, 0); } }
      eul.set(-(k.pitch || 0) + 0.04, k.yaw, 0);
      m4.compose(v3.set(L.x, L.y, L.z), qt.setFromEuler(eul), one);
      beams.setMatrixAt(i, k.finished && k.speed < 1 ? m4.makeScale(0, 0, 0) : m4);
    }
    for (let i = K.length; i < 8; i++) { hs[ai++] = 0; hs[ai++] = 0; hs[ai++] = 0; hs[ai++] = 0; at += 12; }
    hpA.needsUpdate = true; hcA.needsUpdate = true; hsA.needsUpdate = true;
    beams.instanceMatrix.needsUpdate = true;
    beams.visible = !!wx.night || wx.kind === 'fog'; // by day a beam shows in thick air only: one draw less
    shared.grade.uGrFlash.value = (state?.weather?.flash ?? 0) * 0.42;
    // what the wheels throw: a veil of spray on the wet, powder on the snow; every other frame is plenty, at most so many per view
    if (fx && (wx.kind === 'rain' || wx.kind === 'snow') && (tick = (tick + 1) % 2) === 0) {
      for (const k of K) {
        if (!k.grounded || Math.abs(k.speed) < 9 || track.structureAt(k.trackI ?? 0) === 'tunnel' || k.surface === 'sand') continue;
        const sn = Math.sin(k.yaw), cs = Math.cos(k.yaw), side = (time * 60 | 0) % 4 < 2 ? 1 : -1, x = k.x - sn * 1 + cs * side * 0.72, z = k.z - cs * 1 - sn * side * 0.72, sp = Math.min(1.3, Math.abs(k.speed) / 26);
        if (wx.kind === 'rain') fx.emit(0, x, k.y + 0.14, z, k.vx * 0.5 + cs * side * 0.8, 0.9 + 1.3 * sp, k.vz * 0.5 - sn * side * 0.8, 0.13 + 0.09 * sp, dark ? '#5e6d86' : '#b4c0cc', 0.3, 4, 1.8, 0.55);
        else fx.emit(0, x, k.y + 0.1, z, k.vx * 0.4, 0.6 + sp, k.vz * 0.4, 0.12 + 0.08 * sp, dark ? '#8a9abb' : '#f5f8fc', 0.28, 2, 1.6, 0.4);
      }
    }
  }
  // a kart through a puddle or a drift: a wall of water or a burst of powder, either side of it
  function onEvent(e, K) {
    if (e.type !== 'splash' || !fx) return;
    const k = K[e.kart]; if (!k) return;
    const sn = Math.sin(k.yaw), cs = Math.cos(k.yaw), hex = wx.kind === 'snow' ? (dark ? '#9fb0d0' : '#ffffff') : dark ? '#8c9cb8' : '#dbe6ef';
    for (let n = 0; n < 16; n++) {
      const s = n % 2 ? 1 : -1, a = 0.6 + (n / 16) * 0.9, up = 2.6 + (n % 5) * 0.9, out = 1.6 + (n % 3) * 1.2;
      fx.emit(0, k.x + cs * s * 0.8, k.y + 0.2, k.z - sn * s * 0.8, k.vx * 0.55 + cs * s * out * a, up, k.vz * 0.55 - sn * s * out * a, 0.24 + (n % 4) * 0.07, hex, 0.5 + (n % 3) * 0.08, 7.5, 1.7, 0.7);
    }
  }

  // Per view: the nearest four karts' real lights, and the fall of rain or snow round this camera, gone in a tunnel.
  function prepare(q, camera, K, kartIndex, dt, pxH) {
    const c = camera.position;
    for (const f of culls) f(c.x, c.z);
    const order = lit.slice(0, count).map((L, i) => ({ i, d: L.on ? (L.x - c.x) ** 2 + (L.z - c.z) ** 2 - (i === kartIndex ? 1e9 : 0) : 1e12 })).sort((a, b) => a.d - b.d);
    for (let s = 0; s < 4; s++) {
      const o = order[s], L = o && lit[o.i];
      if (!L || !L.on) { headP[s].w = 0; continue; }
      headP[s].set(L.x, L.y, L.z, lightK);
      headD[s].set(L.fx, -0.07, L.fz, 0);
    }
    haloU.uScale.value = pxH * 0.6;
    if (fall) {
      const k = K[kartIndex], inTunnel = k && track.structureAt(k.trackI ?? 0) === 'tunnel';
      const P = prevCam[q]; if (P.x === undefined) { P.x = c.x; P.y = c.y; P.z = c.z; P.a = 1; }
      const U = fall.uniforms, idt = dt > 1e-4 ? 1 / dt : 60;
      P.a += ((inTunnel ? 0 : 1) - P.a) * Math.min(1, dt * 5);
      U.uAmt.value = P.a; fall.mesh.visible = P.a > 0.02;
      U.uT.value = shared.time.value; U.uCam.value.copy(c);
      if (U.uV) U.uV.value.set(((c.x - P.x) * idt) * 0.6, ((c.y - P.y) * idt) * 0.3, ((c.z - P.z) * idt) * 0.6);
      if (U.uPx) U.uPx.value.set(1.0 / (pxH * camera.aspect), 1.0 / pxH);
      if (U.uScale) U.uScale.value = pxH * 0.62;
      if (k) { U.uBeam.value.set(k.x, k.y + 0.9, k.z, wx.night || isNightTrack(def) ? 1 : 0.4); U.uBeamD.value.set(Math.sin(k.yaw), -0.05, Math.cos(k.yaw)); }
      P.x = c.x; P.y = c.y; P.z = c.z;
    }
  }

  return {
    update, prepare, setPatches, onEvent, get patchCount() { return patchMesh ? patchMesh.count : 0; },
    stats: () => ({ kind: wx.kind, night: !!wx.night, lamps: lampList.length, poles: poleList.length, patches: patchMesh ? patchMesh.count : 0, fall: !!fall, beams: beams.visible }),
    dispose() {
      if (fall) { scene.remove(fall.mesh); fall.geo.dispose(); fall.mat.dispose(); }
      for (const m of [posts, poles]) if (m) { scene.remove(m); m.geometry.dispose(); m.dispose(); }
      scene.remove(halos, beams); hg.dispose(); haloMat.dispose(); beamGeo.dispose(); beamMat.dispose(); beams.dispose();
      if (patchMesh) { scene.remove(patchMesh); patchMesh.dispose(); }
    },
  };
}

// A puddle: through the same pipeline as the road, a wet mirror (gWet) with soft ragged edges by coverage. No sorting and no extra pass.
function puddleMaterial(shared) {
  if (shared.wxPuddle) return shared.wxPuddle;
  const m = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  m.alphaToCoverage = true;
  m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2;
  toon(m, shared, {
    code: {
      key: 'puddle',
      vpars: 'varying vec2 vQ;', vmain: 'vQ = position.xz;',
      pars: 'varying vec2 vQ;',
      color: /* glsl */`{
        float ang = atan(vQ.x, vQ.y), rag = 0.86 + 0.08 * sin(ang * 5.0 + vCWorld.x) + 0.05 * sin(ang * 11.0 + vCWorld.z), r = length(vQ) / rag;
        diffuseColor.rgb = vec3(0.034, 0.04, 0.052);
        float aw = max(fwidth(r), 0.01);
        diffuseColor.a = 1.0 - smoothstep(1.0 - aw, 1.0 + aw, r);
        if (diffuseColor.a < 0.02) discard;
        gWet = 1.6; gRipple = 1.0;
      }`,
      normal: '',
    },
  });
  shared.wxPuddle = m;
  return m;
}
