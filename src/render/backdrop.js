// The real backdrops: paintings of the real views around a track (assets/backdrops/, CREDITS.md there), the idea of Summit
// Descent's paint.js turned for a road that goes through 360 degrees. A list of panels on one camera-centred sphere, one draw
// call per view, one texture per panel, drawn over the sky and the DEM ring and under the depth reset.
//   - A panel sits on a cylinder at its true bearing and height: image row r is at tan(elevation) = yb + (row - r) * hy, undistorted at
//     the horizon. Bearings are true: `horizon.northDeg` says where north is in the world.
//   - At its sides it fades over `edge` degrees into what is behind it, the DEM ring, which stays and fills the gaps.
//   - Under `baseHaze[0]` rows it turns into its base mist, all of it under `baseHaze[1]`: no foreground of the photo ever shows.
//   - The mist ring: a strip of colour per azimuth, the panels' base mists blended round the horizon. The near ground and far trees
//     turn into it with distance (toon.js applyFog), and so do the feet of the DEM ring, so no hard seam anywhere.
//   - The sky dome takes its gradient from the sky of the panels (skyStops), so the sky is one sky.
//   - It moves with the camera, with the DEM ring's own slow parallax: the world seen at 1/horizon.scale.
//
//   panel: { file, width (deg of azimuth the image covers), summit: { name, lat, lon, altitude, u, row } | bearing + elevation + row (of the row
//            that elevation is at), elevation (overrides the true figure; say why in `compressed`), baseHaze: [from, to, amount], mist: '#hex', edge: deg, rise: image heights, sky: weight in the dome }
import * as THREE from 'three';

const D2R = Math.PI / 180, R2D = 180 / Math.PI, EARTH = 6371000;
export const MAX_PANELS = 8;

// Great circle bearing (deg, true, clockwise from north) and distance (m) from [lat, lon] to [lat, lon].
export function bearingTo(from, to) {
  const f1 = from[0] * D2R, f2 = to[0] * D2R, dl = (to[1] - from[1]) * D2R;
  const y = Math.sin(dl) * Math.cos(f2), x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  const a = Math.sin((f2 - f1) / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
  return { bearing: (Math.atan2(y, x) * R2D + 360) % 360, distance: 2 * EARTH * Math.asin(Math.sqrt(a)) };
}

// What the real place says about a summit: { bearing, distance, elevation } from horizon.center and horizon.altitude.
export function summitTruth(horizon, summit) {
  const { bearing, distance } = bearingTo(horizon.center, [summit.lat, summit.lon]);
  return { bearing, distance, elevation: Math.atan2(summit.altitude - (horizon.altitude ?? 0), distance) * R2D };
}

// Where a panel sits, given the aspect (width / height) of its image. Pure, the tests use it.
//   { bearing (true, of the image's centre), azimuth (rad, in the world), width (rad), row, yb (tan of the elevation of that row), hy (tan per image height),
//     elevation, truth (of the summit, or null), summitBearing, distance, top, bottom }
export function placePanel(panel, def, aspect) {
  const Hz = def.horizon || {}, north = Hz.northDeg ?? 0, width = panel.width * D2R, hy = width / aspect;
  let bearing = panel.bearing, elevation = panel.elevation, row = panel.row, truth = null, distance = panel.distance ?? 8000;
  if (panel.summit) {
    truth = summitTruth(Hz, panel.summit);
    elevation ??= truth.elevation;
    row = panel.summit.row;
    distance = truth.distance;
    // the summit's column on its true bearing
    bearing = truth.bearing - (panel.summit.u - 0.5) * panel.width;
  }
  const yb = Math.tan(elevation * D2R);
  return {
    bearing, azimuth: (bearing - north) * D2R, width, row, yb, hy, elevation, truth, distance,
    summitAzimuth: ((panel.summit ? truth.bearing : bearing) - north) * D2R,
    summitBearing: panel.summit ? bearing + (panel.summit.u - 0.5) * panel.width : null,
    top: yb + row * hy, bottom: yb - (1 - row) * hy,
  };
}

// The same placement read back: the direction of image point (u, row) as (true bearing, elevation), in degrees.
export function panelPoint(place, u, row) {
  const az = place.bearing + (u - 0.5) * place.width * R2D;
  return { bearing: (az + 360) % 360, elevation: Math.atan(place.yb + (place.row - row) * place.hy) * R2D };
}

const toLinear = (r, g, b) => new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);

// From a small copy of a loaded image: per column the sky's last row, the colour of the sky per row, the mean top row.
function readImage(image, foot) {
  const SW = 128, SH = Math.max(32, Math.round((SW * image.height) / image.width));
  const cv = document.createElement('canvas'); cv.width = SW; cv.height = SH;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(image, 0, 0, SW, SH);
  const px = cx.getImageData(0, 0, SW, SH).data;
  const at = (x, y) => (y * SW + x) * 4;
  const ridge = new Int32Array(SW);
  for (let x = 0; x < SW; x++) {
    let r = 1;
    for (; r < SH; r++) {
      const a = at(x, r - 1), b = at(x, r);
      // sky changes slowly, the first real step down is the land
      if (px[a] + px[a + 1] + px[a + 2] - px[b] - px[b + 1] - px[b + 2] > 30 || Math.min(px[a], px[a + 1], px[a + 2]) - Math.min(px[b], px[b + 1], px[b + 2]) > 14) break;
    }
    ridge[x] = r;
  }
  const rows = [];
  for (let y = 0; y < SH; y++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let x = 0; x < SW; x++) if (y + 2 < ridge[x]) { const o = at(x, y); r += px[o]; g += px[o + 1]; b += px[o + 2]; n++; }
    rows.push(n >= SW * 0.12 ? [r / n, g / n, b / n] : null);
  }
  let mr = 0, mg = 0, mb = 0, mn = 0;
  const y0 = Math.floor(SH * foot), y1 = Math.min(SH, y0 + 3);
  for (let y = y0; y < y1; y++) for (let x = Math.floor(SW * 0.2); x < SW * 0.8; x++) { const o = at(x, y); mr += px[o]; mg += px[o + 1]; mb += px[o + 2]; mn++; }
  return { rows, ridge, H: SH, mist: mn ? [mr / mn, mg / mn, mb / mn] : [200, 200, 200] };
}

// The stops of the sky dome, from the panels' own skies: at each stop's elevation the panels that show sky there, weighted, in sRGB;
// where none does, the nearest elevation that has one; above every panel its top colour is held and the track's zenith takes over.
export function skyStops(stops, panels) {
  const hex = (c) => `#${[0, 1, 2].map((k) => Math.round(Math.min(255, Math.max(0, c[k]))).toString(16).padStart(2, '0')).join('')}`;
  const samples = stops.map(([e]) => {
    const te = Math.tan(e * D2R); let r = 0, g = 0, b = 0, w = 0;
    for (const p of panels) {
      if (p.weight <= 0) continue;
      const row = Math.round((p.place.row - (te - p.place.yb) / p.place.hy) * p.read.H);
      const c = row >= 0 && row < p.read.H ? p.read.rows[row] : null;
      if (c) { r += c[0] * p.weight; g += c[1] * p.weight; b += c[2] * p.weight; w += p.weight; }
    }
    return w ? [r / w, g / w, b / w] : null;
  });
  if (!samples.some(Boolean)) return stops;
  // the first and last elevation with a real sample
  const first = samples.findIndex(Boolean);
  let last = samples.length - 1; while (!samples[last]) last--;
  return stops.map(([e, col], i) => {
    if (samples[i]) return [e, hex(samples[i])];
    if (i < first) return [e, hex(samples[first])];
    // over the panels: the last sample's colour leaning to the track's own zenith
    const c = new THREE.Color(col); const t = i - last >= 2 ? 0.5 : 0.25;
    const own = [c.clone().convertLinearToSRGB().r * 255, c.clone().convertLinearToSRGB().g * 255, c.clone().convertLinearToSRGB().b * 255];
    return [e, hex(samples[last].map((v, k) => v + (own[k] - v) * t))];
  });
}

// One row per panel, 128 wide: the ridge row (0..1) per column of its image. One small texture for the whole backdrop.
function ridgeTexture(panels, n) {
  const W = 128, data = new Uint8Array(W * n);
  for (const p of panels) for (let x = 0; x < W; x++) {
    // the highest of the neighbours: the mist must stay under the crest
    let r = 1e9;
    for (let k = -2; k <= 2; k++) r = Math.min(r, p.read.ridge[Math.max(0, Math.min(W - 1, x + k))]);
    data[p.index * W + x] = Math.min(255, (r / p.read.H) * 255);
  }
  const t = new THREE.DataTexture(data, W, n, THREE.RedFormat, THREE.UnsignedByteType);
  t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

let blankTex = null;
const blank = () => { if (!blankTex) { blankTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); blankTex.needsUpdate = true; } return blankTex; };

// One draw of everything, the code written for the number of panels: GLSL cannot index samplers at run time.
function material(n, grade = null) {
  const samplers = Array.from({ length: n }, (_, i) => `uniform sampler2D tP${i};`).join('\n');
  const body = Array.from({ length: n }, (_, i) => `col = over(col, panel(tP${i}, ${((i + 0.5) / n).toFixed(5)}, uA[${i}], uB[${i}], uC[${i}], uS[${i}], uEdge[${i}], az, te));`).join('\n');
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false,
    // laid over the sky and the ring, premultiplied, with alpha 0 written: no outline on the background (post.js)
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.ZeroFactor,
    uniforms: {
      uA: { value: Array.from({ length: n }, () => new THREE.Vector4()) }, uB: { value: Array.from({ length: n }, () => new THREE.Vector4()) },
      uC: { value: Array.from({ length: n }, () => new THREE.Vector4()) }, uS: { value: Array.from({ length: n }, () => new THREE.Vector4()) },
      uEdge: { value: new Array(n).fill(0.1) }, tRidge: { value: blank() }, uOff: { value: new THREE.Vector3() }, uR: { value: 6000 },
      ...Object.fromEntries(Array.from({ length: n }, (_, i) => [`tP${i}`, { value: blank() }])),
      ...(grade?.uniforms || {}), ...(grade ? { uTime: grade.time } : {}),
    },
    vertexShader: /* glsl */`varying vec3 vD;
      void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w * 0.99999; }`,
    fragmentShader: /* glsl */`${grade?.glsl || ''}
      ${grade ? 'uniform float uTime; float wxLand = 0.0;' : ''}
      varying vec3 vD; ${samplers}
      uniform vec4 uA[${n}], uB[${n}], uC[${n}], uS[${n}]; uniform float uEdge[${n}]; uniform sampler2D tRidge; uniform vec3 uOff; uniform float uR;
      const float PI = 3.14159265, TAU = 6.2831853;
      // A: azimuth, width (rad), row, yb. B: hy, how far up the land dissolves at the sides (image heights), foot from, foot to. C: mist, haze amount. S: sky over the top row, on.
      vec4 panel(sampler2D t, float rowV, vec4 A, vec4 B, vec4 C, vec4 S, float edge, float azimuth, float te){
        float az = mod(azimuth - A.x + PI, TAU) - PI, u = 0.5 + az / A.y;
        float pv = A.z - (te - A.w) / B.x;
        // sampled before the panel's own edge is tested: a pixel that skips the fetch would leave its neighbour with no derivatives, the wrong mip, and a dashed line down the sky at the meeting of two tiles
        vec3 img = texture2D(t, vec2(u, 1.0 - clamp(pv, 0.0, 1.0))).rgb;
        if (S.w < 0.5 || u <= 0.0 || u >= 1.0) return vec4(0.0);
        // edge 0: a tile of one continuous panorama, it meets its neighbour's identical pixels with no fade
        float side = edge > 0.0 ? smoothstep(0.0, edge, u) * smoothstep(0.0, edge, 1.0 - u) : 1.0;
        // toward a side the foot of the land dissolves first and only the high ground reaches the fade: no slab of painted forest ends
        // in mid air, and what shows through it is the ring in its own mist. On the land only: gone sky would show the ring's peaks
        float rise = edge > 0.0 ? 1.0 - smoothstep(edge * 0.5, edge * 1.6, min(u, 1.0 - u)) : 0.0;
        float ridge = texture2D(tRidge, vec2(u, rowV)).r, land = smoothstep(ridge - 0.012, ridge + 0.02, pv);
        float gone = rise * land * smoothstep(B.z, B.w, pv + rise * B.y);
        // past its top row its own sky carries on, thinning into the dome
        img = mix(img, S.rgb, smoothstep(0.0, 0.08, -pv));
        float a = 1.0 - smoothstep(0.08, 0.45, -pv);
        // past its foot, only its mist
        img = mix(img, C.rgb, C.w * smoothstep(B.z, B.w, pv));
        img = mix(img, C.rgb, smoothstep(B.w - 0.005, B.w + 0.02, pv));
        a *= side * (1.0 - gone);
        ${grade ? 'wxLand = mix(wxLand, land, a);' : ''}
        return vec4(img * a, a);
      }
      vec4 over(vec4 d, vec4 s){ return s + d * (1.0 - s.a); }
      void main(){
        // per pixel, so that every panel moves as one: the camera's place at 1/scale, against a cylinder of one radius
        vec3 d = normalize(vD) * uR - uOff;
        float az = atan(d.x, -d.z), te = d.y / max(length(d.xz), 1e-4);
        vec4 col = vec4(0.0);
        ${body}
        // a chosen sky: the same grade as the dome's; what is not land takes the dome's stars and moon, so they stand behind the mountains
        ${grade ? `if (col.a > 0.0) { vec3 gd = normalize(vD); col.rgb = wxGrade(col.rgb / col.a, te) * col.a + (wxStars(gd, uTime) * vec3(0.9, 0.95, 1.0) + wxMoon(gd)) * (1.0 - wxLand) * col.a; }` : ''}
        gl_FragColor = col;
      }`,
  });
}

// The strip of mist colours round the horizon, in sRGB bytes: each panel's mist over its span, blended into its neighbours and into
// `base` where there is no panel at all; alpha says a panel stands whole there. Pure: panels = [{ az (rad), width (rad), edge (rad), rgb: [r, g, b] 0..255 }].
export function mistStrip(panels, base, size = 256) {
  const out = new Uint8Array(size * 4);
  const cover = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const a = ((i + 0.5) / size) * 2 * Math.PI - Math.PI;
    let r = base[0] * 0.04, g = base[1] * 0.04, b = base[2] * 0.04, w = 0.04;
    for (const p of panels) {
      let da = Math.abs(a - p.az) % (2 * Math.PI);
      if (da > Math.PI) da = 2 * Math.PI - da;
      const f = Math.max(0, 1 - da / (p.width * 0.5 + 25 * D2R)), k = f * f * (3 - 2 * f);
      r += p.rgb[0] * k; g += p.rgb[1] * k; b += p.rgb[2] * k; w += k;
      // alpha: the panel is whole here, its fading and dissolving sides excepted; the ring has no business behind it
      if (da < p.width * 0.5 - 1.7 * (p.edge ?? 10 * D2R)) cover[i] = 1;
    }
    out[i * 4] = r / w; out[i * 4 + 1] = g / w; out[i * 4 + 2] = b / w; out[i * 4 + 3] = cover[i] * 255;
  }
  return out;
}

// def.backdrops, drawn. opts: { base (URL of the folder), renderer, sky (the dome mesh), shared (toon.js) }. Returns { mesh, ready, panels, dispose }.
// A file that is missing is a console warning: the track runs with the others, or with the ring alone.
export function createBackdrop(def, look, { base = 'assets/backdrops/', renderer = null, sky = null, shared = null, grade = null } = {}) {
  const list = (def.backdrops || []).slice(0, MAX_PANELS), n = list.length;
  if (!n) return { mesh: null, ready: Promise.resolve(false), panels: [], hero: null, dispose() {} };
  const mat = material(n, grade);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), mat);
  mesh.frustumCulled = false; mesh.renderOrder = -15; mesh.visible = false;
  const Hz = def.horizon || {}, scale = Hz.scale ?? 18, U = mat.uniforms;
  const panels = [], textures = [];
  const within = list.flatMap((P, i) => (P.showWithin ? [{ i, ...P.showWithin, loaded: false }] : []));
  let strip = null, ridges = null;

  // Per view: the world seen at 1/scale, as the ring, against one radius (Hz.panelDistance): panels with parallax of their own would slide over each other.
  U.uR.value = Hz.panelDistance ?? 6000;
  mesh.onBeforeRender = (r, s, cam) => {
    mesh.position.copy(cam.position); mesh.updateMatrixWorld();
    U.uOff.value.set(cam.position.x / scale, cam.position.y / scale, cam.position.z / scale);
    // a panel with showWithin { x, z, r } is there only for a camera that near that point (per view); default: always
    for (const q of within) if (q.loaded) U.uS.value[q.i].w = Math.hypot(cam.position.x - q.x, cam.position.z - q.z) <= q.r ? 1 : 0;
    mat.uniformsNeedUpdate = true;
  };

  const loader = new THREE.TextureLoader();
  const load = (file) => new Promise((res) => loader.load(`${base}${file}`, res, undefined, () => res(null)));
  const ready = (async () => {
    const texs = await Promise.all(list.map((p) => load(p.file)));
    if (typeof document === 'undefined') return false;
    texs.forEach((tex, i) => {
      const P = list[i];
      if (!tex) { console.warn(`backdrop ${P.file} for ${def.id} is missing: the DEM ring shows there`); return; }
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
      tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = true;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      textures.push(tex);
      const place = placePanel(P, def, tex.image.width / tex.image.height), haze = P.baseHaze || [0.72, 0.86, 0.6];
      const read = readImage(tex.image, haze[1]);
      const mist = P.mist ? new THREE.Color(P.mist) : toLinear(...read.mist);
      const mistS = P.mist ? [1, 3, 5].map((o) => parseInt(P.mist.slice(o, o + 2), 16)) : read.mist;
      // the sky over the top row: the mean of the columns that have sky there
      const top = read.rows.find(Boolean) || [200, 180, 210], topC = toLinear(...top);
      U[`tP${i}`].value = tex;
      U.uA.value[i].set(place.azimuth, place.width, place.row, place.yb);
      U.uB.value[i].set(place.hy, P.rise ?? 0.3, haze[0], haze[1]);
      U.uC.value[i].set(mist.r, mist.g, mist.b, haze[2]);
      U.uS.value[i].set(topC.r, topC.g, topC.b, 1);
      for (const q of within) if (q.i === i) q.loaded = true;
      U.uEdge.value[i] = Math.min(0.45, (P.edge ?? 10) / P.width);
      panels.push({ index: i, place, read, weight: P.sky ?? 1, mist: mistS, file: P.file, edge: (P.edge ?? 10) * D2R });
    });
    if (!panels.length) return false;
    ridges = ridgeTexture(panels, n);
    U.tRidge.value = ridges;
    mesh.visible = true;
    if (sky) {
      const stops = skyStops(look.sky.stops, panels), cols = sky.material.uniforms.cols.value;
      stops.forEach(([, c], i) => cols[i].set(c));
      mesh.userData.sky = stops;
    }
    if (shared) {
      // the base colour of the strip, where no panel reaches: the air of the ring
      const hb = new THREE.Color(look.horizon.haze).convertLinearToSRGB();
      const stripData = mistStrip(panels.map((p) => ({ az: Math.atan2(Math.sin(p.place.azimuth), Math.cos(p.place.azimuth)), width: p.place.width, edge: p.edge, rgb: p.mist })), [hb.r * 255, hb.g * 255, hb.b * 255]);
      strip = new THREE.DataTexture(grade ? grade.bytes(stripData) : stripData, 256, 1);
      strip.colorSpace = THREE.SRGBColorSpace; strip.magFilter = strip.minFilter = THREE.LinearFilter;
      strip.wrapS = THREE.RepeatWrapping; strip.wrapT = THREE.ClampToEdgeWrapping; strip.needsUpdate = true;
      shared.mist.uMistRing.value = strip;
      const M = look.mist;
      shared.mist.uMist.value.set(M.from, M.to, M.amount, M.ring);
      if (M.high) shared.mist.uMistH.value.set(...M.high);
    }
    return true;
  })();

  return {
    mesh, ready, panels,
    // the track's great mountain: the panel that stands highest
    // true when the panels close the circle: the DEM ring behind them would be 40k triangles of nothing
    get covers() { let sum = 0; for (const p of panels) sum += p.place.width * R2D; return panels.length === n && sum >= 360; },
    get hero() { return panels.length ? panels.reduce((a, b) => (b.place.elevation > a.place.elevation ? b : a)).place : null; },
    dispose() {
      mesh.geometry.dispose(); mat.dispose();
      for (const t of textures) t.dispose();
      if (strip) strip.dispose();
      if (ridges) ridges.dispose();
      if (shared) shared.mist.uMist.value.set(1e6, 2e6, 0, 0);
    },
  };
}
