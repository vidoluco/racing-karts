// The real skyline: a far mesh built from data/horizon/<id>.bin (tools/bake-horizon.mjs). It is drawn before the world,
// at 1/scale, following the camera so that it moves as slowly as the real thing would; then the depth is reset, so the
// near terrain always stands in front of it. Up to 40k triangles: columns crowd where the skyline is high and rough, and
// each column keeps its own skyline ring, so summits stay on their true bearings with their true silhouettes. The detail
// between the vertices is painted per pixel from a normal texture of the whole grid: rock, strata, snow, forest bands.
import * as THREE from 'three';
import { D2R, clamp, sunVector, smooth, vnoise } from './math.js';
import { MIST_GLSL, NOISE_GLSL } from './toon.js';

export const MESH_COLS = 268, MESH_ROWS = 74; // (cols) x (rows - 1) x 2 = 39128 triangles

export async function fetchHorizon(id, base = 'data/horizon/') {
  const metaRes = await fetch(`${base}${id}.json`);
  if (!metaRes.ok) return null;
  const meta = await metaRes.json();
  const res = await fetch(`${base}${id}.bin`);
  if (!res.ok) return null;
  return { meta, heights: new Int16Array(await res.arrayBuffer()) };
}

export const ringRadius = (m, j) => m.r0 * (m.r1 / m.r0) ** (j / (m.nr - 1));

// Per column of the grid: the elevation (deg) of the skyline and the ring that makes it. vz: the eye's height.
export function skyline(meta, heights, exaggerate = 1, eye = 0, disp = null) {
  const { naz, nr, unit } = meta, top = new Float32Array(naz), ring = new Int32Array(naz);
  const R = new Float32Array(nr);
  for (let j = 0; j < nr; j++) R[j] = ringRadius(meta, j);
  for (let a = 0; a < naz; a++) {
    let best = -1e9, at = 0;
    for (let j = 0; j < nr; j++) {
      const h = heights[a * nr + j] * unit, e = ((disp ? disp(h) : h * exaggerate) - eye) / R[j];
      if (e > best) { best = e; at = j; }
    }
    top[a] = Math.atan(best) / D2R; ring[a] = at;
  }
  return { top, ring };
}

// Which grid columns become mesh columns: many where the skyline is high or rough, each snapped to the local turning point
// of the skyline, so that peaks and notches land on a vertex. Pure, and tested.
export function pickColumns(top, count = MESH_COLS) {
  const n = top.length, w = new Float32Array(n);
  let sum = 0;
  for (let a = 0; a < n; a++) {
    const rough = Math.abs(top[(a + 1) % n] - top[a]) + Math.abs(top[(a + 4) % n] - top[a]) * 0.5;
    w[a] = 0.35 + Math.max(top[a], 0) * 0.08 + rough * 1.2;
    sum += w[a];
  }
  const out = [];
  let acc = 0, next = 0, step = sum / count;
  for (let a = 0; a < n && out.length < count; a++) {
    acc += w[a];
    if (acc >= next) { out.push(a); next += step; }
  }
  // snap each column to the sharpest turn of the skyline between its neighbours
  const m = out.length, snapped = [];
  for (let k = 0; k < m; k++) {
    const a = out[k], lo = k ? Math.ceil((out[k - 1] + a) / 2) : a, hi = k + 1 < m ? Math.floor((a + out[k + 1]) / 2) : a;
    let best = a, bv = -1;
    for (let q = lo; q <= hi; q++) {
      const v = Math.abs(2 * top[(q + n) % n] - top[(q - 2 + n) % n] - top[(q + 2) % n]);
      if (v > bv) { bv = v; best = q; }
    }
    if (!snapped.length || best > snapped[snapped.length - 1]) snapped.push(best);
  }
  return snapped;
}

function buildGeometry(meta, heights, E, northDeg, disp) {
  const { naz, nr, unit } = meta, sk = skyline(meta, heights, E, 0, disp), cols = pickColumns(sk.top), nc = cols.length;
  // rings: dense over the near massifs, sparser out to the last ridges
  const base = [];
  for (let k = 0; k < MESH_ROWS; k++) base.push(Math.round((nr - 1) * Math.pow(k / (MESH_ROWS - 1), 1.12)));
  const P = new Float32Array((nc + 1) * MESH_ROWS * 3), UV = new Float32Array((nc + 1) * MESH_ROWS * 2), H = new Float32Array((nc + 1) * MESH_ROWS);
  for (let c = 0; c <= nc; c++) {
    const a = cols[c % nc], bearing = (a / naz) * 360, th = (bearing - northDeg) * D2R, sa = Math.sin(th), ca = Math.cos(th), rows = base.slice();
    // this column's skyline ring takes the place of its nearest neighbour
    let bq = 0, bd = 1e9;
    for (let k = 0; k < MESH_ROWS; k++) { const d = Math.abs(rows[k] - sk.ring[a]); if (d < bd) { bd = d; bq = k; } }
    rows[bq] = sk.ring[a];
    for (let k = 0; k < MESH_ROWS; k++) {
      const j = rows[k], r = ringRadius(meta, j), v = c * MESH_ROWS + k, h = heights[a * nr + j] * unit;
      P[v * 3] = sa * r; P[v * 3 + 1] = disp(h); P[v * 3 + 2] = -ca * r;
      UV[v * 2] = c === nc ? 1 + a / naz : a / naz; UV[v * 2 + 1] = (j + 0.5) / nr; H[v] = h;
    }
  }
  const idx = new Uint32Array(nc * (MESH_ROWS - 1) * 6);
  let q = 0;
  for (let c = 0; c < nc; c++) for (let k = 0; k < MESH_ROWS - 1; k++) {
    const a = c * MESH_ROWS + k, b = a + 1, d = (c + 1) * MESH_ROWS + k, e = d + 1;
    idx[q++] = a; idx[q++] = b; idx[q++] = d; idx[q++] = b; idx[q++] = e; idx[q++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
  g.setAttribute('aH', new THREE.BufferAttribute(H, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return { geometry: g, skyline: sk, columns: cols };
}

// RGBA8 over the whole grid: world normal xz (exaggerated as drawn), and the height again for the sharp painted bands.
function buildTexture(meta, heights, E, northDeg) {
  const { naz, nr, unit } = meta, D = new Uint8Array(naz * nr * 4), dAz = 2 * Math.PI / naz;
  const ratio = (meta.r1 / meta.r0) ** (1 / (nr - 1));
  const at = (a, j) => heights[((a + naz) % naz) * nr + clamp(j, 0, nr - 1)] * unit;
  const north = northDeg * D2R;
  for (let j = 0; j < nr; j++) {
    const r = ringRadius(meta, j), dr = r * (ratio - 1), ds = r * dAz;
    for (let a = 0; a < naz; a++) {
      // gradient in polar form, then rotated to world x, z; two scales, so ridges keep their structure
      const gr = (at(a, j + 1) - at(a, j - 1)) / (2 * dr), gt = (at(a + 1, j) - at(a - 1, j)) / (2 * ds);
      const b = (a / naz) * 2 * Math.PI - north, sb = Math.sin(b), cb = Math.cos(b);
      // +r is (sb, -cb) in x, z; +bearing is (cb, sb)
      const gx = gr * sb + gt * cb, gz = -gr * cb + gt * sb, l = Math.hypot(gx * E, 1, gz * E);
      const k = (j * naz + a) * 4;
      D[k] = clamp(((-gx * E / l) * 0.5 + 0.5) * 255, 0, 255);
      D[k + 1] = clamp(((-gz * E / l) * 0.5 + 0.5) * 255, 0, 255);
      // slope in real degrees, for the rock: 0..1 over 0..64 deg
      const slope = Math.atan(Math.hypot(gr, gt)) / D2R;
      D[k + 2] = clamp(slope / 64 * 255, 0, 255);
      // relief: how much this cell stands above its neighbours, for the inked ridges and shaded gullies
      const around = (at(a + 2, j) + at(a - 2, j) + at(a, j + 2) + at(a, j - 2)) / 4, rel = (at(a, j) - around) / Math.max(ds * 2, dr * 2);
      D[k + 3] = clamp((rel * 2.2 + 0.5) * 255, 0, 255);
    }
  }
  const t = new THREE.DataTexture(D, naz, nr, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

// The DEM is 30 m, and at this distance that is smooth as a dune. Ridged noise on the high ground only, up to some tens of
// metres, in the grid: it cuts the crests and feeds the normals the same gullies. The bearings and the heights of the
// summits stay the DEM's, within that amount.
function crags(meta, heights) {
  const { naz, nr, unit } = meta, out = new Int16Array(heights.length);
  for (let a = 0; a < naz; a++) for (let j = 0; j < nr; j++) {
    const k = a * nr + j, h = heights[k] * unit, w = smooth(1000, 1700, h);
    if (w <= 0) { out[k] = heights[k]; continue; }
    const r1 = 1 - Math.abs(2 * vnoise(a * 0.31, j * 0.3, 3) - 1), r2 = 1 - Math.abs(2 * vnoise(a * 0.83, j * 0.7, 5) - 1);
    out[k] = Math.round((h + w * (r1 * r1 * 46 + r2 * r2 * 15 - 30)) / unit);
  }
  return out;
}

export function createHorizon(data, def, look, shared) {
  const { meta, heights } = data, Hz = def.horizon || {}, scale = Hz.scale ?? 18, E = Hz.exaggerate ?? 1, northDeg = Hz.northDeg ?? 0;
  // drawn height: below the top the slopes are flattened by a power, so the walls rise sharp out of their feet: a real
  // massif squeezed under 25 degrees of frame would otherwise read as a smooth hill
  const hMax = Math.max(1, meta.max ?? 2300), peak = Hz.peak ?? 1;
  const disp = (h) => (h <= 0 ? h * E : hMax * E * Math.pow(h / hMax, peak));
  const craggy = crags(meta, heights);
  const { geometry, skyline: sk, columns } = buildGeometry(meta, craggy, E, northDeg, disp);
  const tex = buildTexture(meta, craggy, E, northDeg);
  const L = look.horizon, sun = sunVector(look.sun), c = (h) => new THREE.Color(h);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tN: { value: tex }, uSun: { value: new THREE.Vector3(...sun) }, uSunC: { value: c(look.sun.color).multiplyScalar(look.sun.intensity * 0.44) },
      uShade: { value: c(L.shade) }, uRock: { value: c(L.rock) }, uRockB: { value: c(L.rockB) }, uScree: { value: c(L.scree) }, uGrass: { value: c(L.grass) },
      uForest: { value: c(L.forest) }, uGold: { value: c(L.gold) }, uSnow: { value: c(L.snow) }, uHaze: { value: c(L.haze) },
      uAlt: { value: new THREE.Vector4(Hz.altitude ?? meta.altitude, L.treeline, L.alpine, L.snowAbove) },
      uSlope: { value: new THREE.Vector3(L.rockSlope[0], L.rockSlope[1], L.snowSlope) },
      uStrata: { value: new THREE.Vector4(L.strata, L.strataTone, L.ink, L.gold0) },
      uHazeR: { value: new THREE.Vector3(L.hazeNear, L.hazeFar, L.hazeMax) },
      uScale: { value: scale }, uWrap: { value: new THREE.Vector2(look.sun.wrap[0], look.sun.wrap[1]) },
      ...shared.mist,
    },
    vertexShader: /* glsl */`
      attribute float aH; varying float vH; varying vec2 vUv; varying vec3 vReal;
      void main(){ vH = aH; vUv = uv; vReal = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tN; uniform vec3 uSun, uSunC, uShade, uRock, uRockB, uScree, uGrass, uForest, uGold, uSnow, uHaze, uSlope, uHazeR;
      uniform vec4 uAlt, uStrata; uniform vec2 uWrap; uniform float uScale;
      varying float vH; varying vec2 vUv; varying vec3 vReal;
      ${MIST_GLSL}
      ${NOISE_GLSL}
      float band(float e0, float e1, float x){ float w = max(fwidth(x) * 0.7, 1e-3); return smoothstep(e0 - w, e1 + w, x); }
      void main(){
        vec4 mRing = uMist.z > 0.0 ? texture2D(uMistRing, vec2(atan(vReal.x, -vReal.z) / 6.2831853 + 0.5, 0.5)) : vec4(0.0);
        if (mRing.a > 0.99) discard; // a backdrop stands whole in this direction: what the DEM would add behind it is noise
        vec4 T = texture2D(tN, vUv);
        vec2 nxz = T.rg * 2.0 - 1.0; vec3 n = normalize(vec3(nxz.x, sqrt(max(0.02, 1.0 - dot(nxz, nxz))), nxz.y));
        float slope = T.b * 64.0, rel = (T.a - 0.5) / 2.2;
        float alt = vH + uAlt.x, r = length(vReal.xz);
        vec2 q = vReal.xz / 130.0;
        float n1 = cVn(q) * 0.55 + cVn(q * 2.7 + 3.1) * 0.3 + cVn(q * 6.1 + 7.7) * 0.15, n2 = cVn(q * 0.37 + 11.3) * 0.6 + cVn(q * 1.3 + 2.7) * 0.4;
        // forest below the treeline in dark spruce and gold larch, thinning upward in strips
        // a speckle at tree scale that fades into its own mean where it would shimmer, plus broad golden groves
        vec2 tq = vReal.xz / 34.0; float tn = cVn(tq) * 0.6 + cVn(tq * 2.3 + 1.7) * 0.4, tw = fwidth(tq.x) + fwidth(tq.y);
        float goldAmt = smoothstep(0.44, 0.6, n2 * 0.6 + 0.2 + uStrata.w * 0.3);
        float spk = mix(smoothstep(0.44, 0.56, tn + (goldAmt - 0.5) * 0.5), 0.3 + 0.5 * goldAmt, smoothstep(0.25, 0.8, tw));
        vec3 col = mix(uForest, uGold, spk * 0.8);
        col *= 0.92 + 0.16 * n1;
        // alpine grass above it, tawny
        float tree = 1.0 - band(uAlt.y - 90.0, uAlt.y + 60.0, alt + 170.0 * (n1 - 0.5));
        col = mix(uGrass * (0.9 + 0.2 * n1), col, tree);
        // scree in fans under the walls
        float sc = band(uAlt.z - 160.0, uAlt.z + 40.0, alt + 200.0 * (n1 - 0.5));
        col = mix(col, uScree * (0.92 + 0.16 * n2), sc);
        // bare rock on the steep ground, in two tones with strata across it and darker partings
        float rs = slope + 16.0 * (n1 - 0.5);
        float rock = band(uSlope.x, uSlope.y, rs) * band(1500.0, 1800.0, alt + 120.0 * n1);
        // flutes: tall columns and gullies running up the walls, keyed to the bearing so they stand vertical on screen
        float fa = vUv.x * 1440.0, fl = cVn(vec2(fa * 0.21, alt / 620.0)) * 0.62 + cVn(vec2(fa * 0.57 + 3.0, alt / 300.0)) * 0.38;
        vec3 tang = normalize(vec3(vReal.z, 0.0, -vReal.x));
        n = normalize(n + tang * (fl - 0.5) * 2.6 * rock * smoothstep(26000.0, 7000.0, r));
        vec3 rk = mix(uRock, uRockB, smoothstep(0.42, 0.6, n2));
        float wob = (n1 - 0.5) * 22.0 + (n2 - 0.5) * 40.0, sy = (alt + wob) / uStrata.x, sw = fwidth(sy), sd = abs(fract(sy) - 0.5);
        // bedding planes: a thin dark line per stratum, broken by the noise and gone before they can shimmer
        float line = 1.0 - smoothstep(max(0.02, sw * 0.6), max(0.07, sw * 1.6), 0.5 - sd);
        rk *= 1.0 - uStrata.y * line * smoothstep(0.34, 0.5, n2 + n1 * 0.3) * (1.0 - smoothstep(0.12, 0.34, sw));
        float bed = abs(fract(sy * 0.27 + n2) - 0.5);
        rk *= 0.9 + 0.2 * smoothstep(0.1, 0.28, bed);
        rk *= 1.0 - 0.32 * smoothstep(0.0, -0.22, rel);
        rk *= 0.86 + 0.28 * smoothstep(0.34, 0.62, fl);
        col = mix(col, rk, rock);
        // snow on the gentle high ground and in the gullies, crisp edged
        float sn = band(uAlt.w - 220.0, uAlt.w + 60.0, alt + 340.0 * (n1 - 0.5) - rel * 500.0) * (1.0 - band(uSlope.z - 8.0, uSlope.z + 6.0, slope + 7.0 * (n2 - 0.5) + rel * 40.0));
        col = mix(col, uSnow, sn);
        // the wrapped light of the near world, a warmer sun, the shade toward mauve
        // crisp painted planes: the ramp falls in three soft steps, so faces turn into shapes instead of silk
        float nl = dot(n, uSun) + (n1 - 0.5) * 0.1;
        float dw = max(fwidth(nl) * 1.2, 0.02);
        float d = 0.5 * smoothstep(0.02 - dw, 0.02 + dw, nl) + 0.3 * smoothstep(0.26 - dw, 0.26 + dw, nl) + 0.2 * smoothstep(0.5 - dw, 0.5 + dw, nl);
        vec3 lit = col * (uShade * 1.25 + uSunC * d);
        // ridges inked, gullies under them darker: the line work of a painted wall
        float ink = smoothstep(0.1, 0.3, rel) * (1.0 - smoothstep(0.45, 0.85, r / 22000.0)) * smoothstep(1.0, 0.0, sn);
        lit *= 1.0 - uStrata.z * 0.45 * ink;
        // aerial perspective: the far ranges go pale, in the haze of the hour
        float hz = uHazeR.z * (1.0 - exp(-max(r - uHazeR.x, 0.0) / uHazeR.y * 2.2));
        vec3 outC = mix(lit, uHaze, hz);
        // the feet of the ring, in the backdrops' mist: the near ground comes out of the same air
        if (uMist.z > 0.0) outC = mix(outC, mRing.rgb, uMist.w * (1.0 - smoothstep(-0.005, 0.09, vReal.y / max(r, 1.0))));
        gl_FragColor = vec4(outC, 0.0);
      }`,
  });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.frustumCulled = false; mesh.renderOrder = -20;
  mesh.scale.setScalar(1 / scale);
  const k = 1 - 1 / scale;
  // one call per view, before it is drawn: the camera sees it as from its own real place, at real parallax
  mesh.onBeforeRender = (r, s, cam) => { mesh.position.set(cam.position.x * k, cam.position.y * k, cam.position.z * k); mesh.updateMatrixWorld(); };
  return { mesh, skyline: sk, columns, triangles: geometry.index.count / 3, dispose() { geometry.dispose(); mat.dispose(); tex.dispose(); } };
}
