// The cartoon look on top of three.js MeshLambertMaterial (so instancing and vertex and instance colours keep working):
// a soft wrapped light ramp instead of the hard Lambert terminator, a light low-poly hint (world-space triangle facets
// that tilt the normal and the tone a little), an exponential haze that thins with height, painted ground covers with
// crisp edges, a soft sun mask baked on the ground, and painted wood and stone on buildings. Every material reads the
// same uniform objects, so a track's look is set once for the whole scene.
import * as THREE from 'three';
import { sunVector } from './math.js';

// Every key the renderer reads, with defaults; a track's def.look overrides only what differs (shallow per section).
export const DEFAULT_LOOK = {
  sun: { azimuth: 248, elevation: 24, color: '#ffdcb4', intensity: 2.7, wrap: [-0.32, 0.62] },
  hemi: { sky: '#cdd2d6', ground: '#b8be78', intensity: 2.15 },
  sky: {
    stops: [[-8, '#f6d3b9'], [0, '#f8d2b6'], [4, '#f5c6bd'], [9, '#f0bfc8'], [16, '#e3bbd5'], [26, '#d2b7dd'], [50, '#c4b3de']],
    glow: '#fde3c4', glowStrength: 0.5, glowWidth: 0.35,
    clouds: { amount: 0.4, scale: 1, lit: '#fff1dc', shade: '#d8b8cc', speed: 0.004 },
  },
  fog: { color: '#f2d0c6', density: 0.00042, heightFalloff: 0.006, base: 0, max: 0.82 },
  // the ground and far trees turn into the backdrops' base mist from `from` to `to` m (render/backdrop.js); ring: how much of it the feet of the DEM ring take
  mist: { from: 650, to: 1500, amount: 1, ring: 1 },
  terrain: {
    meadowY: '#cdd35a', meadow: '#a3c957', meadowF: '#84b657', meadowD: '#7fa552', forest: '#557a44',
    rock: '#ecd8cf', rockB: '#dfc8c3', snow: '#fff8f2', ice: '#dcecf4', iceD: '#a9c9dc',
    bank: '#eee8de', bankD: '#e0d9ce', bankWet: '#aaa49d', bed: '#7aa4b4', verge: '#b49a68',
    rockSlope: [34, 46], snowSlope: 46, treeline: 1950, alpine: 2200, snowAbove: 2500,
    coverNoise: [14, 0.6], rockStrata: { spacing: 4, tone: 0.25, wobble: 1.5 }, coverEdge: 0.35,
    facetSize: 15, facetTilt: 0.17, facetTone: 0.11, noiseScale: [160, 55],
    patch: { size: 40, tone: 0.1 },
  },
  horizon: {
    rock: '#ecc9b8', rockB: '#cda8a4', scree: '#dcbfa8', grass: '#97a05e', forest: '#3a5235', gold: '#b98a30', snow: '#fff6ee',
    treeline: 1950, alpine: 2150, snowAbove: 2820, snowSlope: 36, rockSlope: [26, 38], strata: 95, strataTone: 0.22,
    haze: '#f3d2c0', hazeNear: 3000, hazeFar: 34000, hazeMax: 0.86, shade: '#a897c4', lit: 1.0, ink: 0.55, gold0: 0.35,
  },
  water: { deep: '#3a9ebf', base: '#5bb8d2', light: '#9ad8e4', far: '#a8dae4', foam: '#fbfdff', flow: 1.6, facetTone: 0.06 },
  trees: {
    kinds: [{ name: 'spruce', shape: 'conifer', share: 1, height: [11, 21], width: 0.95, colors: ['#3d6a47', '#355f41', '#2f573f', '#46744a'] }],
    density: 0.6, spacing: 9, clump: 170, far: 1050, maxSlope: 38,
  },
  rocks: { color: '#b3abb0', count: 90 },
  road: { asphalt: '#6a6570', dirt: '#b98d5c', cobble: '#9a8d84', wood: '#a67c4f', sand: '#cdb88f', snow: '#eef2f6', ice: '#bfe3f2', line: '#f6efd8', kerb: ['#d9483b', '#f6efd8'], shoulder: '#a8926a' },
  stone: { color: '#b9ab9b', dark: '#8a7e78' },
  deck: {},
  dust: {}, // per surface, the colour of the dust a kart raises (fx.js); empty keeps fx.js's own
  outline: { color: '#2e2630', strength: 0.85, width: 1.5, threshold: [0.06, 0.14], minGap: 0.6, fade: [170, 520] },
  divider: { color: '#14121a', width: 6 },
  camera: { fov: 54, fovFast: 68, near: 0.5, far: 6000 },
  bloom: { threshold: 1.05, strength: 0.32 },
  exposure: 1.04,
  staticRim: null,
  softPuff: 0, // fx.js: dust and not soap bubbles
  flowTone: 1, // disasters.js: mud and its cloud darkened, where a place's strong light would turn them to cream
  kartShadow: null, // fx.js: [r, g, b, a] of the blob under a kart; a key missing here never reached the renderer
  vent: null, // { crust, throat, ring, puff, puffB, size }: a fumarole whose steam is the renderer's billows alone (props.js, disasters.js)
};

// def.look merged over the defaults, one level deep; `sky.clouds` and `terrain.patch` one further.
export function resolveLook(def = {}) {
  const L = def.look || {}, out = {};
  for (const k of Object.keys(DEFAULT_LOOK)) {
    const d = DEFAULT_LOOK[k];
    out[k] = d && typeof d === 'object' && !Array.isArray(d) ? { ...d, ...(L[k] || {}) } : L[k] ?? d;
  }
  out.sky.clouds = { ...DEFAULT_LOOK.sky.clouds, ...(L.sky?.clouds || {}) };
  if (!out.fog.base) out.fog.base = 0;
  return out;
}

export const FOG_GLSL = /* glsl */`
  uniform vec3 uFogColor; uniform float uFogDensity, uFogFalloff, uFogBase, uFogMax;
  vec3 applyFog(vec3 c, float dist, float y){
    float f = (1.0 - exp(-uFogDensity * dist)) * exp(-max(y - uFogBase, 0.0) * uFogFalloff);
    return mix(c, uFogColor, min(f, uFogMax));
  }`;

// The backdrops' mist ring (render/backdrop.js): how far along this fragment is, and its colour by azimuth from the camera. Needs w, the world position.
export const MIST_GLSL = /* glsl */`
  uniform sampler2D uMistRing; uniform vec4 uMist;
  uniform vec3 uMistH; // look.mist.high [y0, y1, keep]: mist lies on the floor, ground above y1 takes only keep of it; off unless a track asks
  float mistAmount(vec3 w){ return uMist.z <= 0.0 ? 0.0 : uMist.z * smoothstep(uMist.x, uMist.y, length(w.xz - cameraPosition.xz)) * (uMistH.y > 0.0 ? mix(1.0, uMistH.z, smoothstep(uMistH.x, uMistH.y, w.y)) : 1.0); }
  vec3 mistColor(vec3 w){ vec3 d = w - cameraPosition; return texture2D(uMistRing, vec2(atan(d.x, -d.z) / 6.2831853 + 0.5, 0.5)).rgb; }`;

// The uniform objects every toon material shares. setLook fills them: a new track only copies values.
export function createShared(look = resolveLook()) {
  const c = () => new THREE.Color();
  const blank = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); blank.needsUpdate = true;
  const shared = {
    fog: { uFogColor: { value: c() }, uFogDensity: { value: 0 }, uFogFalloff: { value: 0 }, uFogBase: { value: 0 }, uFogMax: { value: 1 } },
    wrap: { value: new THREE.Vector2() },
    facet: { value: new THREE.Vector3() },
    time: { value: 0 },
    sunDir: { value: new THREE.Vector3(0, 1, 0) },
    sunColor: { value: c() },
    shadeMap: { value: blank }, shadeRect: { value: new THREE.Vector4(0, 0, 0, 0) }, // x0, z0, 1/w, 1/h; 0 size: no mask
    cover: {
      uCoverRock: { value: c() }, uCoverRockB: { value: c() }, uCoverSnow: { value: c() }, uCoverIce: { value: c() }, uCoverIceD: { value: c() },
      uCoverNoise: { value: new THREE.Vector2() }, uCoverStrata: { value: new THREE.Vector3() }, uCoverEdge: { value: 0 },
      uPatch: { value: new THREE.Vector2() },
      uBank: { value: new THREE.Vector4(0, 0, 0, 0) }, uBankC: { value: c() }, uBankD: { value: c() }, uBankW: { value: c() }, // the river bank, painted per pixel by height: level, height, unused, on
      uTerr: { value: new THREE.Vector4() }, uTerrY: { value: c() }, uTerrG: { value: c() }, uTerrD: { value: c() }, uTerrO: { value: c() }, uTerrW: { value: c() }, uTerrR: { value: c() }, uTerrSky: { value: c() }, uTerrYMix: { value: 1 }, uTerrB: { value: new THREE.Vector2(1, 1) }, // uTerrB: look.terrain.terraces.tilt (how much of the small tilt that cuts level ground, default 1), .group (bands one plot's crop runs across, default 1); look.terrain.terraces: step (m of height), wobble (m), row count, on; .sky: what a flooded plot mirrors, default a pale blue; .yMix: how much of the mesh's height cuts the bands, default 1, below 1 the plots' edges do not kink at the cells of the ground
      // look.terrain.rills (fall line gullies painted per pixel round a centre) and world.groundPaint (a canvas laid on the ground): off unless a track asks
      uRill0: { value: new THREE.Vector4() }, uRill1: { value: new THREE.Vector4() }, uRillR: { value: new THREE.Vector4() }, uRillA: { value: c() }, uRillB: { value: c() }, uRillA2: { value: c() }, uRillB2: { value: c() }, uRillH: { value: new THREE.Vector2(0, 1) }, uGroundPaint: { value: blank }, uGroundRect: { value: new THREE.Vector4(0, 0, 0, 0) },
      uSandRip: { value: new THREE.Vector2() }, // look.terrain.ripple [wavelength, tone], off by default
      uSandRipFlat: { value: 0 }, // look.terrain.ripple[2]: 1 keeps the ripples off any slope, where they stretch into bands; default 0
      uSculpt: { value: new THREE.Vector4() }, uSculptSun: { value: new THREE.Vector2() }, // look.terrain.sculpt { tone, lines, ink, scale }, off by default
      uDetail: { value: new THREE.Vector4() }, uScree: { value: new THREE.Vector3() }, // look.terrain.detail { stone, stones, tufts, on } per pixel, look.terrain.scree [size, tone, on]: both off by default
      uGrass: { value: new THREE.Vector2() }, uWoodFar: { value: new THREE.Vector4() }, uWoodD: { value: c() }, uWoodL: { value: c() }, uWoodG: { value: c() }, // look.terrain.grass, look.terrain.wood
    },
    stone: { uStoneA: { value: c() }, uStoneB: { value: c() }, uStoneS: { value: 1 } }, // uStoneS: look.stone.scale, how many times smaller the painted blocks, default 1
    mist: { uMistRing: { value: blank }, uMist: { value: new THREE.Vector4(1e6, 2e6, 0, 0) }, uMistH: { value: new THREE.Vector3(0, 0, 1) } }, // from, to, amount, ring; amount 0 until a backdrop loads
    // render/weather.js fills these for a race with a chosen sky; uWxOn 0 is the old race, one branch per fragment and the same pixels.
    // uWxCover: snow on what faces up, wet, how much the lit map shines, unused. uHeadP: xyz of up to four karts' lamps, w their strength; uHeadD: where they point. uLitRect 0: no map
    wx: {
      uWxOn: { value: 0 }, uWxCover: { value: new THREE.Vector4() }, uWxSky: { value: c() }, uWxLamps: { value: 0 }, uWxNight: { value: 0 },
      uHeadP: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) }, uHeadD: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 1, 0)) },
      uLitMap: { value: blank }, uLitRect: { value: new THREE.Vector4() }, uLitY: { value: new THREE.Vector2() },
    },
    look,
  };
  setLook(shared, look);
  return shared;
}

export function setLook(shared, look) {
  shared.look = look;
  const F = look.fog, T = look.terrain, cv = shared.cover;
  shared.fog.uFogColor.value.set(F.color); shared.fog.uFogDensity.value = F.density; shared.fog.uFogFalloff.value = F.heightFalloff;
  shared.fog.uFogBase.value = F.base ?? 0; shared.fog.uFogMax.value = F.max ?? 0.82;
  shared.wrap.value.set(...look.sun.wrap);
  shared.facet.value.set(T.facetSize ?? 11, T.facetTilt ?? 0.07, T.facetTone ?? 0.055);
  const s = sunVector(look.sun);
  shared.sunDir.value.set(s[0], s[1], s[2]);
  shared.sunColor.value.set(look.sun.color).multiplyScalar(look.sun.intensity);
  cv.uCoverRock.value.set(T.rock); cv.uCoverRockB.value.set(T.rockB); cv.uCoverSnow.value.set(T.snow);
  cv.uCoverIce.value.set(T.ice ?? '#dcecf4'); cv.uCoverIceD.value.set(T.iceD ?? '#a9c9dc');
  cv.uCoverNoise.value.set(...(T.coverNoise || [14, 0.6]));
  const R = T.rockStrata;
  cv.uCoverStrata.value.set(R?.spacing ?? 1, R?.tone ?? 0, R?.wobble ?? 0);
  cv.uCoverEdge.value = T.coverEdge ?? 0;
  cv.uPatch.value.set(T.patch?.size ?? 34, T.patch?.tone ?? 0.07);
  cv.uBankC.value.set(T.bank); cv.uBankD.value.set(T.bankD); cv.uBankW.value.set(T.bankWet);
  cv.uGrass.value.set(...(T.grass || [0, 0]));
  cv.uDetail.value.set(T.detail?.stone ?? 0.6, T.detail?.stones ?? 0, T.detail?.tufts ?? 0, T.detail ? 1 : 0);
  cv.uSandRip.value.set(T.ripple?.[0] ?? 1, T.ripple?.[1] ?? 0);
  cv.uSandRipFlat.value = T.ripple?.[2] ?? 0;
  cv.uSculpt.value.set(T.sculpt?.tone ?? 0, T.sculpt?.lines ?? 0, T.sculpt?.ink ?? 0, T.sculpt?.scale ?? 1);
  { const sa = ((look.sun.azimuth ?? 0) * Math.PI) / 180; cv.uSculptSun.value.set(Math.sin(sa), -Math.cos(sa)); }
  cv.uScree.value.set(T.scree?.[0] ?? 3, T.scree?.[1] ?? 0, T.scree ? (T.scree[2] ? 2 : 1) : 0); // scree[2]: read the shards along the face's own plane, so a steep wall gets no curtains; default off
  const RL = T.rills;
  cv.uRill0.value.set(...(RL?.a?.slice(0, 4) || [0, 0, 1, 0])); cv.uRill1.value.set(...(RL?.b?.slice(0, 4) || [0, 0, 1, 0]));
  cv.uRillR.value.set(RL?.a?.[4] ?? 0, RL?.a?.[5] ?? 1, RL?.b?.[4] ?? 0, RL?.b?.[5] ?? 1);
  if (RL) { cv.uRillA.value.set(RL.rib); cv.uRillB.value.set(RL.gully); cv.uRillH.value.set(...RL.height); cv.uRillA2.value.set(RL.ribB ?? RL.rib); cv.uRillB2.value.set(RL.gullyB ?? RL.gully); }
  cv.uGroundRect.value.set(0, 0, 0, 0);
  const TR = T.terraces;
  cv.uTerr.value.set(TR?.step ?? 1, TR?.wobble ?? 0, TR?.rows ?? 5, TR ? 1 : 0);
  if (TR) { cv.uTerrY.value.set(TR.young); cv.uTerrG.value.set(TR.green); cv.uTerrD.value.set(TR.dark); cv.uTerrO.value.set(TR.gold); cv.uTerrW.value.set(TR.water); cv.uTerrR.value.set(TR.riser); }
  cv.uTerrSky.value.setRGB(0.62, 0.86, 0.95); if (TR?.sky) cv.uTerrSky.value.set(TR.sky); cv.uTerrYMix.value = TR?.yMix ?? 1; cv.uTerrB.value.set(TR?.tilt ?? 1, TR?.group ?? 1);
  const W = T.wood;
  cv.uWoodFar.value.set(W?.from ?? 0, W?.to ?? 1, W ? 1 : 0, W?.amount ?? 1);
  cv.uWoodFar.value.w = W ? W.amount ?? 1 : 0;
  cv.uWoodD.value.set(W?.dark ?? '#000000'); cv.uWoodL.value.set(W?.light ?? '#000000'); cv.uWoodG.value.set(W?.gold ?? '#000000');
  shared.stone.uStoneA.value.set(look.stone.color); shared.stone.uStoneB.value.set(look.stone.dark); shared.stone.uStoneS.value = look.stone.scale ?? 1;
}

const NOISE_GLSL = /* glsl */`
  float cH12(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float cVn(vec2 p){ vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
    return mix(mix(cH12(i), cH12(i + vec2(1.0, 0.0)), u.x), mix(cH12(i + vec2(0.0, 1.0)), cH12(i + vec2(1.0, 1.0)), u.x), u.y); }
  vec2 cTri(vec2 p){ float s = (p.x + p.y) * 0.3660254; vec2 i = floor(p + s); vec2 f = p - i + (i.x + i.y) * 0.2113249;
    return vec2(cH12(i * 1.37 + (f.x > f.y ? 0.0 : 17.1)), cH12(i * 2.11 + (f.x > f.y ? 3.0 : 9.7))); }`;
export { NOISE_GLSL };

// Patches a MeshLambertMaterial. opts:
//   facets: the low-poly hint on the ground; cover: the geometry has a vec3 `cover` attribute (rock, snow, ice weights);
//   ground: painted tone patches; shade: reads the baked sun mask by world xz (only what stands on the terrain);
//   paint: the geometry has a float `aPaint` (0 plain, 1 stone blocks, 2 vertical boards, 3 shingles, 4 horizontal logs, 5 plaster), drawn procedurally;
//   gloss: [power, amount], a soft sun highlight; rim: [amount, power], a light rim; sway: wind on instanced trees (m at the tip);
//   code: { defines, pars, vpars, vmain, color, normal }: a custom piece of GLSL for materials like the road.
export function toon(material, shared, opts = {}) {
  const defines = [];
  for (const k of ['facets', 'cover', 'ground', 'shade', 'paint', 'sway']) if (opts[k]) defines.push(`#define TOON_${k.toUpperCase()}`);
  if (opts.gloss) defines.push('#define TOON_GLOSS');
  if (opts.rim) defines.push('#define TOON_RIM');
  const code = opts.code || {};
  if (code.defines) defines.push(...code.defines);
  const local = {
    uGloss: { value: new THREE.Vector2(...(opts.gloss || [40, 0])) }, uRim: { value: new THREE.Vector2(...(opts.rim || [0, 3])) },
    uSway: { value: opts.sway || 0 }, ...(code.uniforms || {}),
  };
  material.userData.uniforms = local;
  material.customProgramCacheKey = () => `toon:${defines.join(',')}:${code.key || ''}`;
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, shared.fog, shared.cover, shared.stone, shared.mist, shared.wx, local, {
      uWrap: shared.wrap, uFacet: shared.facet, uTime: shared.time, uSunDir: shared.sunDir, uSunCol: shared.sunColor,
      uShadeMap: shared.shadeMap, uShadeRect: shared.shadeRect,
    });
    sh.vertexShader = `${defines.join('\n')}
      varying vec3 vCWorld; uniform float uTime, uSway;
      #ifdef TOON_COVER
        attribute vec3 cover; varying vec3 vCover;
      #endif
      #ifdef TOON_PAINT
        attribute float aPaint; varying float vPaint; varying vec3 vPN;
      #endif
      #ifdef TOON_GROUND
        attribute float aWood; varying float vWood; attribute float aTerr; varying float vTerr;
      #endif
      ${code.vpars || ''}
      ${sh.vertexShader}`.replace('#include <begin_vertex>', /* glsl */`
      #include <begin_vertex>
      #ifdef TOON_SWAY
      #ifdef USE_INSTANCING
      {
        float sw = sin(uTime * 1.3 + instanceMatrix[3].x * 0.13 + instanceMatrix[3].z * 0.17) + 0.5 * sin(uTime * 2.7 + instanceMatrix[3].z * 0.4);
        float wy = max(transformed.y, 0.0);
        transformed.xz += vec2(0.7, 0.45) * sw * uSway * wy * wy;
      }
      #endif
      #endif`).replace('#include <project_vertex>', /* glsl */`
      #include <project_vertex>
      #ifdef TOON_COVER
        vCover = cover;
      #endif
      #ifdef TOON_GROUND
        vWood = aWood; vTerr = aTerr;
      #endif
      #ifdef TOON_PAINT
        vPaint = aPaint; vPN = normalize(mat3(modelMatrix) * objectNormal);
      #endif
      {
        vec4 cw = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          cw = instanceMatrix * cw;
        #endif
        cw = modelMatrix * cw; vCWorld = cw.xyz;
      }
      ${code.vmain || ''}`);
    sh.fragmentShader = `${defines.join('\n')}
      varying vec3 vCWorld; uniform vec2 uWrap, uGloss, uRim; uniform vec3 uFacet, uSunDir, uSunCol; uniform float uTime;
      uniform sampler2D uShadeMap; uniform vec4 uShadeRect;
      uniform vec3 uStoneA, uStoneB; uniform float uStoneS;
      float gSun = 1.0, gDeck = 0.0; // gDeck: this fragment stands above the ground, the mask on the ground is not its shadow
      float gWet = 0.0, gRipple = 0.0; // set by a surface that mirrors the sky under a chosen rain
      uniform float uWxOn, uWxLamps, uWxNight; uniform vec4 uWxCover, uLitRect; uniform vec3 uWxSky; uniform vec4 uHeadP[4], uHeadD[4]; uniform sampler2D uLitMap; uniform vec2 uLitY;
      #ifdef TOON_COVER
        varying vec3 vCover; uniform vec3 uCoverRock, uCoverRockB, uCoverSnow, uCoverIce, uCoverIceD; uniform vec2 uCoverNoise; uniform vec3 uCoverStrata; uniform float uCoverEdge;
      #endif
      uniform vec4 uDetail; uniform vec3 uScree; uniform vec2 uSandRip; uniform float uSandRipFlat;
      uniform vec4 uSculpt; uniform vec2 uSculptSun;
      uniform vec2 uPatch, uGrass; uniform vec4 uBank, uWoodFar; uniform vec3 uBankC, uBankD, uBankW, uWoodD, uWoodL, uWoodG;
      uniform vec4 uTerr; uniform vec3 uTerrY, uTerrG, uTerrD, uTerrO, uTerrW, uTerrR, uTerrSky; uniform float uTerrYMix; uniform vec2 uTerrB;
      #ifdef TOON_GROUND
        uniform vec4 uRill0, uRill1, uRillR, uGroundRect; uniform vec3 uRillA, uRillB, uRillA2, uRillB2; uniform vec2 uRillH; uniform sampler2D uGroundPaint;
      #endif
      #ifdef TOON_GROUND
        varying float vWood; varying float vTerr;
      #endif
      #ifdef TOON_PAINT
        varying float vPaint; varying vec3 vPN;
      #endif
      ${FOG_GLSL}
      ${MIST_GLSL}
      ${NOISE_GLSL}
      #if defined(TOON_COVER) || defined(TOON_GROUND)
      // nearest and second nearest of a jittered lattice, and a number for the nearest cell
      vec3 cCells(vec2 p){ vec2 i = floor(p), f = p - i; float a = 8.0, b = 8.0, id = 0.0; for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)), c = i + g; vec2 o = vec2(cH12(c), cH12(c + 7.3)); float d = length(g + o - f); if (d < a) { b = a; a = d; id = cH12(c + 3.1); } else if (d < b) b = d; } return vec3(a, b, id); }
      #endif
      #ifdef TOON_COVER
      float cPatch(float w, float n){ float v = w + (n - 0.5) * uCoverNoise.y;
        float e = max(fwidth(v) * 0.75, 0.015);
        return w <= 0.001 ? 0.0 : smoothstep(0.5 - e, 0.5 + e, v); }
      #endif
      #ifdef TOON_GROUND
      // Gullies down the fall line of a cone or a caldera wall: noise read on a ring round the centre, so it closes, and hardly moving with the radius, so each gully runs downhill.
      float rillN(vec2 dir, float r, float K, float fw){
        // gullies wander as they fall, and the finer they are the shorter they run
        float wob = (cVn(dir * K * 0.6 + r * 0.021) - 0.5) * 0.9 / K;
        vec2 d2 = vec2(dir.x - dir.y * wob, dir.y + dir.x * wob), q = d2 * (K + r * 0.0065);
        // an octave goes smoothly to its mean before its cells get smaller than a pixel, or it shimmers into a hatch
        float f2 = 1.0 - smoothstep(0.1, 0.45, fw * K * 5.3), f3 = 1.0 - smoothstep(0.1, 0.45, fw * K * 12.1);
        return cVn(q) * 0.42 + cVn(d2 * (K * 2.3 + r * 0.016) + 3.1) * 0.28 + mix(0.5, cVn(d2 * (K * 5.3 + r * 0.05) + 7.7), f2) * 0.18 + mix(0.5, cVn(d2 * (K * 12.1 + r * 0.14) + 1.9), f3) * 0.12; }
      void rillPaint(vec4 R, float r0, float r1, vec3 ribC, vec3 gullyC, inout vec3 col){
        vec2 v = vCWorld.xz - R.xy; float r = length(v);
        if (r < r0 || r > r1 || R.w <= 0.0) return;
        vec2 dir = v / max(r, 0.01), tn = vec2(-dir.y, dir.x);
        float K = R.z / 6.2831853, de = 0.14 / K, fw = fwidth(dir.x) + fwidth(dir.y);
        float af = (1.0 - smoothstep(0.2 / K, 0.75 / K, fw)) * smoothstep(uRillH.x, uRillH.y, vCWorld.y) * smoothstep(0.0, 14.0, r - r0) * smoothstep(0.0, 14.0, r1 - r);
        if (af < 0.004) return;
        float n = rillN(dir, r, K, fw), np = rillN(normalize(dir + tn * de), r, K, fw), nm = rillN(normalize(dir - tn * de), r, K, fw);
        // lit from the side, like the real thing at a low sun: one wall of each gully takes the light
        float lit = clamp(-(np - nm) / (2.0 * de * K) * dot(tn, normalize(uSunDir.xz)), -1.0, 1.0);
        col = mix(col, mix(gullyC, ribC, smoothstep(0.3, 0.66, n)), 0.82 * af);
        col *= 1.0 + af * R.w * lit;
        // scree: without a grain up close a slope is plastic
        vec2 sq = vCWorld.xz + vec2(vCWorld.y * 0.7, -vCWorld.y * 0.4);
        col *= 1.0 + af * (1.0 - smoothstep(0.1, 0.5, fw * r)) * (0.24 * (cVn(sq * 1.3) - 0.5) + 0.2 * (cVn(sq * 3.9 + 2.0) - 0.5));
        // beds of ash across it, thin
        float sf = 1.0 - smoothstep(0.25, 0.9, fwidth(vCWorld.y));
        col *= 1.0 + af * sf * (0.07 * sin(vCWorld.y * 1.3 + n * 7.0) - 0.1 * smoothstep(0.86, 0.98, sin(vCWorld.y * 0.46 + n * 3.0)));
      }
      #endif
      // Lamps of the night: street lamps from the lit map, karts' beams and the small pool round each kart, by true normal so a wall facing away stays dark.
      vec3 wxLocal(vec3 w, vec3 wn){
        vec3 sum = vec3(0.0);
        if (uLitRect.z > 0.0) { vec4 lm = texture2D(uLitMap, (w.xz - uLitRect.xy) * uLitRect.zw); sum += lm.rgb * lm.rgb * uWxCover.z * (0.17 + 0.83 * max(wn.y, 0.0)) * smoothstep(9.0, 4.0, abs(w.y - uLitY.x - lm.a * uLitY.y)); }
        for (int i = 0; i < 4; i++) {
          float s = uHeadP[i].w;
          if (s <= 0.0) continue;
          vec3 L = uHeadP[i].xyz - w; float d2 = dot(L, L);
          if (d2 > 3600.0) continue;
          float d = sqrt(d2); vec3 l = L / d;
          float ca = dot(-l, uHeadD[i].xyz), cone = smoothstep(0.74, 0.96, ca), ndl = mix(clamp(dot(wn, l) * 0.82 + 0.18, 0.0, 1.0), 0.32, smoothstep(0.72, 0.95, wn.y)); // a lamp this low grazes the ground, and a graze would draw every triangle of it
          sum += vec3(1.0, 0.91, 0.76) * s * ndl * (cone * 5.2 / (1.0 + d2 * 0.0065) * smoothstep(60.0, 30.0, d) + 0.42 / (1.0 + d2 * 0.14));
        }
        return sum;
      }
      float wxRing(vec2 p, float t){
        vec2 g = p * 2.1, i = floor(g), f = fract(g) - 0.5; float h = cH12(i), rate = 1.3 + h * 1.1, ph = fract(t * rate + h * 9.0);
        vec2 o = (vec2(cH12(i + 3.1), cH12(i + 7.7)) - 0.5) * 0.4;
        return smoothstep(0.05, 0.0, abs(length(f - o) - ph * 0.44)) * (1.0 - ph) * (1.0 - ph) * step(0.72, cH12(i + floor(t * rate + h * 9.0)));
      }
      ${code.pars || ''}
      ${sh.fragmentShader}`
      .replace('float dotNL = saturate( dot( geometryNormal, directLight.direction ) );',
        'float dotNL = smoothstep( uWrap.x, uWrap.y, dot( geometryNormal, directLight.direction ) ) * gSun;')
      .replace('#include <color_fragment>', /* glsl */`
      #include <color_fragment>
      #ifdef TOON_GROUND
      {
        // painted meadow: broad tone patches with a crisp brushed edge, not a blend
        vec2 pq = vCWorld.xz / uPatch.x;
        float pn = cVn(pq) * 0.6 + cVn(pq * 2.3 + 4.1) * 0.28 + cVn(pq * 5.1 + 9.7) * 0.12;
        float pe = max(fwidth(pn) * 1.2, 0.012);
        diffuseColor.rgb *= 1.0 + uPatch.y * (smoothstep(0.52 - pe, 0.52 + pe, pn) * 1.4 - 0.7 + 0.8 * (smoothstep(0.36 - pe, 0.36 + pe, pn) - 1.0));
        // look.terrain.sculpt: snow the wind has worked. Long drifts lit by the low sun in a cel ramp, thin wind lines, a broken pen along their crests. The height runs into the coordinates, or a steep bank stretches every stroke into a wedge
        if (uSculpt.x > 0.0) {
          #define SNOWH(p) (cVn((p) * vec2(0.035, 0.16)) * 0.62 + cVn((p) * vec2(0.09, 0.42) + 3.1) * 0.28 + cVn((p) * vec2(0.3, 1.1) + 7.3) * 0.1)
          mat2 srot = mat2(0.86, -0.5, 0.5, 0.86);
          vec2 sa = srot * ((vCWorld.xz + vCWorld.y * vec2(0.9, -0.7)) / uSculpt.w);
          float sh0 = SNOWH(sa), sfoot = length(fwidth(sa));
          vec2 sgr = vec2(SNOWH(sa + vec2(0.8, 0.0)) - sh0, SNOWH(sa + vec2(0.0, 0.8)) - sh0) / 0.8;
          float slit = clamp(0.5 - dot(sgr, srot * uSculptSun) * 26.0, 0.0, 1.0);
          float scel = smoothstep(0.34, 0.4, slit) * 0.5 + smoothstep(0.62, 0.68, slit) * 0.5;
          float sfar = 1.0 - smoothstep(0.35, 2.2, sfoot);
          diffuseColor.rgb *= mix(vec3(1.0), mix(vec3(0.72, 0.74, 0.93), vec3(1.05, 1.0, 0.97), scel), uSculpt.x * (0.35 + 0.65 * sfar));
          // wind lines: where a long thin noise crosses its middle, in fields that come and go
          float swl = cVn(sa * vec2(0.05, 1.25) + 11.0) - 0.5;
          float sline = (1.0 - smoothstep(0.5, 1.5, abs(swl) / max(fwidth(swl), 1e-4))) * smoothstep(0.42, 0.56, cVn(sa * 0.07 + 5.0));
          diffuseColor.rgb *= 1.0 - uSculpt.y * sline * sfar * vec3(1.0, 0.96, 0.6);
          float sil = sh0 - 0.5, sink = (1.0 - smoothstep(0.45, 1.3, abs(sil) / max(fwidth(sil), 1e-4))) * smoothstep(0.4, 0.55, cVn(sa * 0.13 + 9.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.17, 0.17, 0.36), uSculpt.z * sink * sfar);
        }
        // uGrass: the brush in the grass, short strokes all one way and tufts, so a meadow is painted and not a lit plane; gone before it can shimmer
        if (uGrass.x > 0.0) {
          vec2 gw = vec2(length(dFdx(vCWorld.xz)), length(dFdy(vCWorld.xz)));
          float gf = 1.0 - smoothstep(0.1, 0.5, max(gw.x, gw.y));
          vec2 gq = mat2(0.82, -0.57, 0.57, 0.82) * vCWorld.xz;
          float st1 = cVn(gq * vec2(0.9, 5.0)), st2 = cVn(gq * vec2(2.1, 11.0) + 7.0), tuft = cVn(vCWorld.xz * 0.5 + 3.0);
          diffuseColor.rgb *= 1.0 + uGrass.x * gf * ((st1 - 0.5) * 0.9 + (st2 - 0.5) * 0.6);
          diffuseColor.rgb *= vec3(1.0 + uGrass.y * (tuft - 0.5), 1.0, 1.0 - uGrass.y * (tuft - 0.5));
        }
        if (uRill1.w > 0.0) rillPaint(uRill1, uRillR.z, uRillR.w, uRillA2, uRillB2, diffuseColor.rgb);
        if (uRill0.w > 0.0) rillPaint(uRill0, uRillR.x, uRillR.y, uRillA, uRillB, diffuseColor.rgb); // the cone stands over the wall's skirt
        // world.groundPaint: what a landmark drew on the ground, tracks and drifts, colour over alpha
        if (uGroundRect.z > 0.0) { vec4 gp = texture2D(uGroundPaint, (vCWorld.xz - uGroundRect.xy) * uGroundRect.zw); diffuseColor.rgb = mix(diffuseColor.rgb, gp.rgb, gp.a * (1.0 - smoothstep(9.0, 16.0, vCWorld.y))); }
        // look.terrain.ripple [wavelength m, tone]: the wind's ripples in dry sand on the flat, a soft rise and a sharp fall, in fields that come and go, with long swells that carry them further off; off by default
        if (uSandRip.y > 0.0) {
          vec2 rq = mat2(0.82, 0.57, -0.57, 0.82) * vCWorld.xz;
          float rwarp = cVn(rq * vec2(0.03, 0.07)) * 7.0 + cVn(rq * vec2(0.11, 0.24) + 3.0) * 1.6, rfield = smoothstep(0.3, 0.62, cVn(rq * 0.016 + 9.0) * 0.7 + cVn(rq * 0.05 + 4.0) * 0.3);
          float rp1 = (rq.x + rwarp) / uSandRip.x, rp2 = (rq.x + rwarp * 2.6) / (uSandRip.x * 6.5);
          float rf1 = 1.0 - smoothstep(0.12, 0.42, fwidth(rp1)), rf2 = 1.0 - smoothstep(0.12, 0.42, fwidth(rp2));
          float rs1 = fract(rp1), rs2 = fract(rp2);
          float rw1 = smoothstep(0.0, 0.72, rs1) - smoothstep(0.72, 1.0, rs1), rw2 = smoothstep(0.0, 0.8, rs2) - smoothstep(0.8, 1.0, rs2);
          float rflat = 1.0 - smoothstep(4.5, 9.0, vCWorld.y);
          if (uSandRipFlat > 0.5) rflat *= 1.0 - smoothstep(0.1, 0.26, length(vec2(dFdx(vCWorld.y), dFdy(vCWorld.y))) / max(length(vec4(dFdx(vCWorld.xz), dFdy(vCWorld.xz))), 0.0001));
          diffuseColor.rgb *= 1.0 + uSandRip.y * rflat * ((rw1 - 0.5) * rf1 * mix(0.35, 1.0, rfield) + (rw2 - 0.5) * rf2 * 0.32);
        }
        // look.terrain.detail: what the bottom of the frame shows on a treeless mountain: on grey ground, broken stones with dark gaps; on green ground, clumps of grass with a shaded foot. Painted in world size, so it never stretches into streaks, and gone to the mean tone before it can shimmer
        if (uDetail.w > 0.5) {
          vec2 dq = vCWorld.xz + vCWorld.y * vec2(0.6, 0.4);
          float dw = length(vec2(length(dFdx(dq)), length(dFdy(dq))));
          vec3 db = diffuseColor.rgb;
          float dmx = max(db.r, max(db.g, db.b)), dsat = (dmx - min(db.r, min(db.g, db.b))) / max(dmx, 0.001), stony = 1.0 - smoothstep(0.18, 0.42, dsat);
          float near1 = 1.0 - smoothstep(0.1, 0.55, dw / uDetail.x), near2 = 1.0 - smoothstep(0.2, 0.9, dw / (uDetail.x * 3.4));
          if (near2 > 0.001) {
            vec3 w1 = cCells(dq / uDetail.x), w2 = cCells(dq / (uDetail.x * 3.4) + 5.0);
            float gap1 = 1.0 - smoothstep(0.015, 0.1, w1.y - w1.x);
            float fine = cVn(dq * 9.0) * 0.6 + cVn(dq * 21.0 + 3.0) * 0.4, nearF = 1.0 - smoothstep(0.02, 0.09, dw);
            // stones: each its own tone, thin dark gaps close to; here and there a bigger one, lit on top, shaded at its foot. No net of lines: that reads as crazy paving
            vec3 st = db * mix(0.92 + 0.16 * w1.z, (0.72 + 0.56 * w1.z) * (1.0 - 0.2 * gap1), near1);
            float bigS = step(0.8, w2.z) * (1.0 - smoothstep(0.4, 0.52, w2.x));
            st = mix(st, db * (0.9 + 0.5 * w2.z) * (1.2 - 0.9 * w2.x), bigS * near2);
            st *= 1.0 + 0.2 * (fine - 0.5) * nearF;
            // grass: a clump lighter at its crown, darker where it meets the next, warmer or cooler by clump; blades in it close to; bare earth and stones here and there
            float crown = smoothstep(0.75, 0.05, w1.x);
            vec3 gr = db * mix(0.8, 1.16, crown) * vec3(0.92 + 0.18 * w1.z, 1.0, 0.94 + 0.08 * w1.z);
            gr = mix(db * (0.94 + 0.12 * w1.z), gr, near1);
            gr *= 1.0 + 0.5 * (fine - 0.5) * nearF;
            float bare = step(0.84, w2.z) * (1.0 - smoothstep(0.3, 0.46, w2.x));
            gr = mix(gr, db * vec3(1.2, 1.02, 0.86) * 1.1, 0.55 * bare * near2);
            float fl = step(0.975, w1.z) * (1.0 - smoothstep(0.05, 0.1, w1.x)) * near1;
            gr = mix(gr, w1.z > 0.982 ? vec3(0.9, 0.86, 0.7) : vec3(0.82, 0.62, 0.16), fl);
            diffuseColor.rgb = mix(mix(db, gr, uDetail.z), mix(db, st, uDetail.y), stony);
          }
        }
        // the wooded far slopes, painted as the panorama paints them: dark spruce in mass and larch in soft drifts, each tree a touch of tone; so that where the 3D trees thin out there is no bald hill
        if (uWoodFar.w > 0.0) {
          float wk = vWood * smoothstep(uWoodFar.x, uWoodFar.y, length(vCWorld.xz - cameraPosition.xz)) * uWoodFar.w;
          if (wk > 0.001) {
            vec2 wq = vCWorld.xz;
            float tr = cVn(wq * 0.11) * 0.55 + cVn(wq * 0.27 + 5.0) * 0.45, big = cVn(wq * 0.009 + 2.0) * 0.6 + cVn(wq * 0.024 + 8.0) * 0.4;
            vec3 wood = mix(uWoodD, uWoodL, smoothstep(0.3, 0.75, tr * 0.6 + big * 0.4));
            wood = mix(wood, uWoodG * (0.75 + 0.5 * tr), smoothstep(0.56, 0.72, cVn(wq * 0.013 + 11.0) * 0.8 + tr * 0.2) * 0.75);
            diffuseColor.rgb = mix(diffuseColor.rgb, wood, wk);
          }
        }
        // look.terrain.terraces: rice terraces painted per pixel, a band per step of height, so the steps follow the real contours of the ground whatever the size of its cells. Each plot along a band is flooded, young, green, dark or ripe; a dark riser and a pale bund at each step; rows of rice along the contour; a flooded plot takes the sky at a low angle. vTerr says where
        if (uTerr.w > 0.5 && vTerr > 0.01) {
          vec2 tq = vCWorld.xz;
          float tw = (cVn(tq * 0.031) - 0.5) * uTerr.y + (cVn(tq * 0.087 + 3.3) - 0.5) * uTerr.y * 0.42;
          // a small tilt, so level ground too is cut into long plots and not one sheet
          float tb = (vCWorld.y * uTerrYMix + tw + dot(tq, vec2(0.074, 0.05)) * uTerrB.x) / uTerr.x, tL = floor(tb), tf = tb - tL, tfw = fwidth(tb);
          // a plot: a stretch of its band, cut across by a slow noise
          float tcut = (tq.x * 0.72 + tq.y * 0.69) / 46.0 + tL * 0.37 + cVn(tq * 0.019 + tL * 0.21) * 2.6, tid = floor(tcut), tcf = tcut - tid;
          float th = cH12(vec2(floor(tL / uTerrB.y) * 1.31 + 2.0, tid * 0.77 + 5.0));
          vec3 tcol = th < 0.2 ? uTerrW : th < 0.5 ? uTerrY : th < 0.82 ? uTerrG : th < 0.97 ? uTerrD : uTerrO;
          tcol *= 0.94 + 0.12 * cH12(vec2(tid * 1.7, tL * 0.9));
          float nearT = 1.0 - smoothstep(0.08, 0.26, tfw), rows = abs(fract(tf * uTerr.z) - 0.5) * 2.0;
          if (th < 0.2) {
            // flooded: the sky at a low angle, a breath of seedlings in rows
            vec3 tv = normalize(cameraPosition - vCWorld);
            tcol = mix(tcol, uTerrSky, 0.6 * pow(1.0 - abs(tv.y), 3.0));
            float seed = step(0.62, cVn(tq * vec2(1.7, 1.7))) * step(rows, 0.3);
            tcol = mix(tcol, uTerrY, 0.42 * seed * nearT);
          } else {
            tcol *= 1.0 + 0.14 * nearT * (smoothstep(0.2, 0.75, rows) - 0.5);
            tcol *= 1.0 + 0.1 * nearT * (cVn(tq * vec2(0.9, 1.3)) - 0.5);
          }
          // the riser, up to the next step, and the bund on its lip; a thin cut across at the plot's end
          float tr = smoothstep(0.74 - tfw * 1.2, 0.74 + tfw * 1.2, tf);
          float tbund = 1.0 - smoothstep(0.05, 0.05 + tfw * 2.4 + 0.02, tf);
          float tcutl = (1.0 - smoothstep(0.0, 0.04 + fwidth(tcut) * 1.5, min(tcf, 1.0 - tcf))) * nearT;
          tcol = mix(tcol, uTerrR, max(tcutl * 0.65, 0.0));
          tcol = mix(tcol, uTerrR * 1.55, tbund * 0.8);
          tcol = mix(tcol, uTerrR * (0.55 + 0.45 * smoothstep(0.74, 1.0, tf)), tr);
          // too fine to see: the mean of it all, no shimmer
          vec3 tmean = (uTerrW * 0.14 + uTerrY * 0.26 + uTerrG * 0.3 + uTerrD * 0.12 + uTerrR * 0.18);
          tcol = mix(tcol, tmean, smoothstep(0.3, 0.7, tfw));
          float tmk = smoothstep(0.42, 0.58, vTerr + (cVn(tq * 0.05) - 0.5) * 0.24);
          diffuseColor.rgb = mix(diffuseColor.rgb, tcol, tmk);
        }
        // the river bank: a soft ragged line by height, per pixel, whatever the size of the cells under it; a vertex blend is a pale smear. Gravel in fine soft tones: thresholded blotches at this scale read as camouflage
        if (uBank.w > 0.5) {
          vec2 bq = vCWorld.xz;
          float ab = vCWorld.y - uBank.x, top = uBank.y * (0.5 + cVn(bq * 0.22) * 0.75 + cVn(bq * 1.1 + 3.0) * 0.3), be = max(fwidth(ab - top), 0.05);
          float bw = length(vec2(fwidth(bq.x), fwidth(bq.y)));
          vec3 g = mix(uBankC, uBankD, smoothstep(0.25, 0.75, cVn(bq * 0.5 + 7.0) * 0.6 + cVn(bq * 1.9 + 2.0) * 0.4));
          g *= 1.0 + 0.16 * (cVn(bq * 7.0 + 1.0) - 0.5) * (1.0 - smoothstep(0.08, 0.3, bw));
          g = mix(g, uBankW, 1.0 - smoothstep(0.1, 0.55, ab));
          diffuseColor.rgb = mix(diffuseColor.rgb, g, 1.0 - smoothstep(-be * 2.0, be * 2.0, ab - top));
        }
      }
      #endif
      #ifdef TOON_COVER
      {
        vec2 gq = vCWorld.xz / uCoverNoise.x;
        float n1 = cVn(gq) * 0.62 + cVn(gq * 2.3 + 5.1) * 0.38, n2 = cVn(gq * 0.31 + 2.7);
        vec3 rk = mix(uCoverRock, uCoverRockB, smoothstep(0.42, 0.62, n2));
        if (uCoverStrata.y > 0.0) {
          float sy = (vCWorld.y + (n1 - 0.5) * uCoverStrata.z * 2.0) / uCoverStrata.x;
          float sw = fwidth(sy), sd = abs(fract(sy) - 0.5);
          rk *= 1.0 - uCoverStrata.y * (1.0 - smoothstep(0.5 * sw, 1.5 * sw, 0.5 - sd)) * (1.0 - smoothstep(0.1, 0.25, sw));
        }
        // look.terrain.scree: bare rock broken into shards, in world size, up steep faces too
        if (uScree.z > 0.5) {
          vec2 rq = (vCWorld.xz + vCWorld.y * vec2(0.7, -0.9)) / uScree.x;
          if (uScree.z > 1.5) { vec3 fn = abs(normalize(cross(dFdx(vCWorld), dFdy(vCWorld)))); rq = (fn.y > 0.72 ? vCWorld.xz : fn.x > fn.z ? vCWorld.zy : vCWorld.xy) / uScree.x; }
          float rw = length(vec2(length(dFdx(rq)), length(dFdy(rq))));
          vec2 ra = cTri(rq + vec2(cVn(rq * 0.31), cVn(rq * 0.37 + 4.0)) * 1.4), rb = cTri(rq * 2.7 + 3.0);
          rk *= 1.0 + uScree.y * ((ra.x - 0.5) * 1.5 + (rb.x - 0.5) * (1.0 - smoothstep(0.2, 0.6, rw)) * 0.8) * (1.0 - smoothstep(0.45, 1.6, rw));
        }
        diffuseColor.rgb = mix(diffuseColor.rgb, rk, cPatch(vCover.x, n1));
        if (uCoverEdge > 0.0) {
          float ev = vCover.x + (n1 - 0.5) * uCoverNoise.y, ew = max(fwidth(ev), 1e-4);
          diffuseColor.rgb *= 1.0 - uCoverEdge * (1.0 - smoothstep(0.6 * ew, 1.8 * ew, abs(ev - 0.5))) * (1.0 - smoothstep(0.08, 0.2, ew)) * step(0.001, vCover.x);
        }
        diffuseColor.rgb = mix(diffuseColor.rgb, uCoverIce, cPatch(vCover.z, 1.0 - n1));
        diffuseColor.rgb = mix(diffuseColor.rgb, uCoverSnow, cPatch(vCover.y, n1 * 0.5 + n2 * 0.5));
      }
      #endif
      #ifdef TOON_PAINT
      {
        // painted by world position: faces that look along x run boards along z and the other way round, up is by height
        float pk = floor(vPaint + 0.5);
        if (pk > 0.5 && pk < 39.5) {
          vec3 an = abs(vPN);
          float along = an.x > an.z ? vCWorld.z : vCWorld.x, up = vCWorld.y;
          if (an.y > 0.75) { along = vCWorld.x; up = vCWorld.z; }
          float wd = length(vec2(fwidth(along), fwidth(up)));
          if (pk < 1.5) { // stone blocks in running bond
            float h = 0.46 / uStoneS, row = floor(up / h), rj = cH12(vec2(row, 13.0)), cw = (0.82 + 0.5 * rj) / uStoneS, c = along / cw + 3.7 * rj, col = floor(c);
            vec2 f = vec2(fract(c) * cw, fract(up / h) * h);
            float e = min(min(f.x, cw - f.x), min(f.y, h - f.y));
            float j = cH12(vec2(row, col)), mfade = 1.0 - smoothstep(0.05, 0.16, wd);
            // tones held close: a wall of strong random blocks reads as a repeated tile
            diffuseColor.rgb *= 0.88 + 0.2 * j;
            diffuseColor.rgb *= vec3(1.0 + 0.05 * (j - 0.5), 1.0, 1.0 - 0.07 * (j - 0.5));
            // each stone a little proud: lighter in the middle, a crisp thin joint at any distance
            diffuseColor.rgb *= 1.0 + 0.1 * smoothstep(0.02, 0.14, e) * mfade;
            // joints in a tone close to the stone, and the far wall dimmed by what its joints would take: near grey and far cream were the same wall
            diffuseColor.rgb = mix(diffuseColor.rgb, uStoneB * 0.8, (1.0 - smoothstep(0.014, 0.022 + wd, e)) * mfade * 0.55);
            diffuseColor.rgb *= mix(0.93, 1.0, mfade);
          } else if (pk < 2.5) { // vertical larch boards, weathered in bands
            float bw = 0.34, c = along / bw, col = floor(c), f = abs(fract(c) - 0.5) * bw;
            float j = cH12(vec2(col, 3.0));
            diffuseColor.rgb *= 0.84 + 0.3 * j - 0.06 * cVn(vec2(col, up * 0.8));
            diffuseColor.rgb *= 1.0 - 0.55 * smoothstep(bw * 0.5 - 0.03 - wd, bw * 0.5, f) * (1.0 - smoothstep(0.1, 0.22, wd));
          } else if (pk < 3.5) { // shingles: rows of small tiles, each its own tone
            float h = 0.42, row = floor(up / h), cw = 0.5, c = along / cw + 0.5 * mod(row, 2.0), col = floor(c);
            float j = cH12(vec2(row * 3.1, col));
            diffuseColor.rgb *= 0.82 + 0.34 * j;
            float fy = fract(up / h);
            diffuseColor.rgb *= 1.0 - 0.45 * (1.0 - smoothstep(0.0, 0.16 + wd * 2.0, fy)) * (1.0 - smoothstep(0.1, 0.25, wd));
          } else if (pk < 4.5) { // horizontal logs
            float h = 0.42, f = fract(up / h), row = floor(up / h);
            diffuseColor.rgb *= 0.86 + 0.24 * cH12(vec2(row, 7.0));
            diffuseColor.rgb *= 0.72 + 0.28 * smoothstep(0.0, 0.3, min(f, 1.0 - f) + wd);
          } else if (pk > 30.5 && pk < 31.5) { // kind 31, dry laid mountain schist: thin wandering courses of uneven stones, rain streaks down them, moss in the damp, a dark crisp joint
            float q31 = up / 0.17 + 0.5 * cVn(vec2(along * 0.31, 3.1)), row = floor(q31), rj = cH12(vec2(row, 29.0)), cw = 0.3 + 0.46 * rj, c = along / cw + 3.7 * rj, col = floor(c);
            float j = cH12(vec2(row, col)), e = min(min(fract(c), 1.0 - fract(c)) * cw, min(fract(q31), 1.0 - fract(q31)) * 0.17), mf = 1.0 - smoothstep(0.03, 0.14, wd);
            diffuseColor.rgb *= mix(vec3(0.97), mix(vec3(0.74, 0.74, 0.73), vec3(1.14, 1.08, 0.97), j), mf);
            diffuseColor.rgb = mix(diffuseColor.rgb, uStoneB * 0.42, (1.0 - smoothstep(0.008, 0.02 + wd, e)) * mf * 0.85);
            diffuseColor.rgb *= 1.0 - 0.36 * smoothstep(0.52, 0.82, cVn(vec2(along * 1.6, up * 0.1 + 5.0)));
            float moss = smoothstep(0.56, 0.72, cVn(vec2(along * 0.55, up * 1.1 + 9.0)) * 0.72 + cVn(vec2(along * 3.1, up * 4.3)) * 0.28);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.22, 0.06) * (0.8 + 0.5 * j), moss * 0.62);
          } else if (pk > 17.5 && pk < 18.5) { // kind 18, rice seen from a road: as kind 10 up close, and from further off the planting lines still show as long soft stripes, the crop thicker and paler in drifts, so a plot is never a flat plate at any distance
            vec2 rq18 = mat2(0.8, -0.6, 0.6, 0.8) * vCWorld.xz;
            float rw18 = length(vec2(fwidth(rq18.x), fwidth(rq18.y))), rn18 = 1.0 - smoothstep(0.05, 0.28, rw18), rm18 = 1.0 - smoothstep(0.5, 2.2, rw18);
            diffuseColor.rgb *= 1.0 + rn18 * (0.3 * (smoothstep(0.2, 0.62, abs(fract(rq18.x / 0.62) - 0.5) * 2.0) - 0.5) + 0.2 * (cVn(rq18 * vec2(2.6, 1.7)) - 0.5));
            diffuseColor.rgb *= 1.0 + rm18 * 0.16 * (smoothstep(0.25, 0.75, abs(fract(rq18.x / 3.1) - 0.5) * 2.0) - 0.5);
            float rd18 = cVn(vCWorld.xz * 0.09);
            diffuseColor.rgb *= 1.0 + 0.3 * (rd18 - 0.5) + 0.14 * (cVn(vCWorld.xz * 0.37 + 3.0) - 0.5);
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.22, 1.14, 0.72), smoothstep(0.55, 0.8, cVn(vCWorld.xz * 0.21 + 7.0)) * 0.5);
          } else if (pk > 16.5 && pk < 17.5) { // kind 17, a flooded paddy that shines: Bali's only (world -z is Agung there). The sky at the mirror angle, cream low and blue high, the rose cone of the volcano mirrored where the bounce goes toward it, a breath of ripple and glints, mud through the water looking down, seedlings in rows up close
            vec3 fv = normalize(cameraPosition - vCWorld);
            float fg = pow(1.0 - abs(fv.y), 2.2), frip = cVn(vCWorld.xz * 0.8 + vec2(uTime * 0.16, uTime * 0.11)) - 0.5, felv = asin(clamp(abs(fv.y) + frip * 0.022, 0.0, 1.0));
            vec3 fsky = mix(vec3(0.17, 0.25, 0.25), vec3(0.05, 0.24, 0.4), smoothstep(0.015, 0.2, felv));
            float foff = abs(atan(-fv.x + frip * 0.03, fv.z)), fcone = 0.33 * pow(max(0.0, 1.0 - foff / 1.0), 1.1);
            fsky = mix(fsky, mix(vec3(0.2, 0.12, 0.15), vec3(0.3, 0.3, 0.27), smoothstep(0.1, 0.0, felv)), 1.0 - smoothstep(fcone - 0.012, fcone + 0.012, felv));
            diffuseColor.rgb = mix(diffuseColor.rgb, fsky, 0.42 + 0.58 * fg);
            float fgl = smoothstep(0.74, 0.82, cVn(vCWorld.xz * 6.0 + vec2(uTime * 0.5, -uTime * 0.37))) * fg * (1.0 - smoothstep(0.02, 0.1, length(fwidth(vCWorld.xz))));
            diffuseColor.rgb += vec3(0.4, 0.38, 0.28) * fgl;
            vec2 fq = mat2(0.8, -0.6, 0.6, 0.8) * vCWorld.xz;
            float fsn = 1.0 - smoothstep(0.04, 0.16, length(vec2(fwidth(fq.x), fwidth(fq.y))));
            float fsd = (1.0 - smoothstep(0.05, 0.11, length(fract(fq / vec2(0.62, 0.48)) - 0.5) * 0.5)) * fsn;
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.34, 0.66, 0.16), fsd * 0.55);
          } else if (pk > 15.5) { // kind 16, Balinese brick: thin courses a hand high, each brick its own red, the mortar fine and pale; stone blocks at this scale read as a giant's wall
            float bh = 0.14, brow = floor(up / bh), bwd = 0.34, bc = along / bwd + 0.5 * mod(brow, 2.0), bcol = floor(bc);
            float bj = cH12(vec2(brow * 1.3, bcol)), bfade = 1.0 - smoothstep(0.015, 0.05, wd);
            diffuseColor.rgb *= mix(1.0, 0.82 + 0.34 * bj, 1.0 - smoothstep(0.03, 0.12, wd));
            diffuseColor.rgb *= 0.86 + 0.26 * cVn(vec2(along, up) * 0.5);
            float bfx = abs(fract(bc) - 0.5) * bwd, bfy = abs(fract(up / bh) - 0.5) * bh;
            diffuseColor.rgb = mix(diffuseColor.rgb, uStoneB * 0.95, bfade * 0.55 * max(smoothstep(bwd * 0.5 - 0.016 - wd, bwd * 0.5, bfx), smoothstep(bh * 0.5 - 0.012 - wd, bh * 0.5, bfy)));
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1, 0.14, 0.07), 0.35 * smoothstep(0.62, 0.8, cVn(vec2(along * 0.7, up * 2.2) + 11.0)));
          } else if (pk > 14.5) { // a crown of leaves on a big tree: clumps over the mesh, so that the facets of a sphere stop reading
            // not wd: along swaps axis with the normal and its derivative spikes there, a stitched cross on any round thing
            float lf = 1.0 - smoothstep(0.06, 0.4, length(fwidth(vCWorld)) * 0.85);
            float ln = cVn(vec2(vCWorld.x + vCWorld.z * 0.6, vCWorld.y * 1.2) * 0.9) * 0.55 + cVn(vec2(vCWorld.z - vCWorld.x * 0.5, vCWorld.y * 1.7) * 2.4 + 3.0) * 0.45;
            diffuseColor.rgb *= 1.0 + lf * 0.5 * (smoothstep(0.36, 0.64, ln) - 0.5);
          } else if (pk > 13.5) { // thin foliage: plain, and no ink on its creases (below)
          } else if (pk > 12.5) { // thatch and ijuk fibre: fine streaks down the roof, in overlapping courses
            float tfade = 1.0 - smoothstep(0.03, 0.14, wd);
            float tc = up / 0.32, trow = floor(tc), tf = fract(tc);
            diffuseColor.rgb *= 0.96 + 0.1 * cH12(vec2(trow, 2.0));
            diffuseColor.rgb *= 1.0 + tfade * 0.42 * (cVn(vec2(along * 9.0, up * 0.5 + trow * 3.1)) - 0.5);
            diffuseColor.rgb *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.22, tf)) * (1.0 - smoothstep(0.08, 0.3, wd));
          } else if (pk > 11.5) { // carved paras: courses of relief, a running leaf in each, moss in the joints
            float cc = up / 0.62, crow = floor(cc), cf = fract(cc);
            float cfade = 1.0 - smoothstep(0.03, 0.16, wd);
            float cal = along / 0.62 + 0.5 * mod(crow, 2.0), cu = fract(cal) - 0.5;
            float leaf = smoothstep(0.42, 0.32, abs(cf - 0.5) * 1.0 + abs(cu) * (0.5 + 0.8 * abs(cf - 0.5)));
            diffuseColor.rgb *= 0.9 + 0.14 * cH12(vec2(crow, floor(cal)));
            diffuseColor.rgb *= 1.0 + cfade * 0.26 * (leaf - 0.5);
            diffuseColor.rgb *= 1.0 - 0.4 * (1.0 - smoothstep(0.0, 0.1 + wd, min(cf, 1.0 - cf))) * (1.0 - smoothstep(0.1, 0.3, wd));
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.3, 0.13), 0.5 * smoothstep(0.6, 0.78, cVn(vec2(along, up) * 0.55 + 4.0)) * smoothstep(0.1, 0.5, 1.0 - up * 0.0 - abs(cf - 0.5) * 1.6));
          } else if (pk > 10.5) { // a flooded paddy: the sky at the angle it is seen, a cloud sliding on it, seedlings in rows up close
            vec3 fv = normalize(cameraPosition - vCWorld);
            float fg = pow(1.0 - abs(fv.y), 2.4);
            vec3 fs = mix(vec3(0.1, 0.28, 0.5), vec3(0.22, 0.44, 0.62), fg);
            fs = mix(fs, vec3(0.72, 0.78, 0.8), smoothstep(0.56, 0.74, cVn(vCWorld.xz * 0.028 + fv.xz * 5.0)) * 0.55);
            diffuseColor.rgb = mix(diffuseColor.rgb, fs, 0.45 + 0.5 * fg);
            vec2 sq = mat2(0.8, -0.6, 0.6, 0.8) * vCWorld.xz;
            float sn = 1.0 - smoothstep(0.04, 0.16, length(vec2(fwidth(sq.x), fwidth(sq.y))));
            float sd = (1.0 - smoothstep(0.05, 0.11, length(fract(sq / vec2(0.62, 0.48)) - 0.5) * 0.5)) * sn;
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.72, 0.22), sd * 0.5);
          } else if (pk > 9.5) { // rice in a paddy: rows, tufts and a slow mottle, the vertex colour is the plot's
            vec2 rq = mat2(0.8, -0.6, 0.6, 0.8) * vCWorld.xz;
            float rn = 1.0 - smoothstep(0.05, 0.28, length(vec2(fwidth(rq.x), fwidth(rq.y))));
            diffuseColor.rgb *= 1.0 + rn * (0.3 * (smoothstep(0.2, 0.62, abs(fract(rq.x / 0.62) - 0.5) * 2.0) - 0.5) + 0.2 * (cVn(rq * vec2(2.6, 1.7)) - 0.5));
            diffuseColor.rgb *= 1.0 + 0.16 * (cVn(vCWorld.xz * 0.11) - 0.5) + 0.08 * (cVn(vCWorld.xz * 0.43 + 3.0) - 0.5);
          } else if (pk > 8.5) { // kind 9, limestone: tilted bent beds of uneven thickness, each its own tone, dark seams, joints and rain streaks down them, moss on what faces up. Read off x, y and z together, so no side of a rock goes blank; a smooth lit rock up close is a sheet of paper
            vec3 lw = vCWorld;
            vec2 lh = vec2(lw.x + lw.z * 0.62, lw.z - lw.x * 0.62);
            float lwarp = cVn(lh * 0.035 + lw.y * 0.02) * 7.0 + cVn(lh * 0.13 + lw.y * 0.05 + 4.0) * 2.0 + cVn(lh * 0.5 + lw.y * 0.2 + 9.0) * 0.45;
            float lb = (lw.y + 0.14 * lw.x - 0.09 * lw.z + lwarp) / 1.55; lb += 0.42 * sin(lb * 1.7);
            float li = floor(lb), lf = lb - li, ls = min(lf, 1.0 - lf), lwb = fwidth(lb), lfine = 1.0 - smoothstep(0.25, 0.7, lwb);
            diffuseColor.rgb *= mix(0.86, 0.6 + 0.62 * cH12(vec2(li, 4.0)), 1.0 - smoothstep(0.5, 1.1, lwb));
            float lblot = cVn(lh * 0.09 + lw.y * 0.07), lgr = cVn(lh * 0.9 + lw.y * 0.6 + 2.0);
            diffuseColor.rgb *= 0.74 + 0.4 * lblot + 0.16 * lgr;
            // a seam here and there along a bed, not at every bed: everywhere and even they are the rings of a beehive
            float lseam = step(0.4, cH12(vec2(li, 9.0))) * smoothstep(0.3, 0.46, cVn(lh * 0.11 + li * 1.3));
            diffuseColor.rgb *= 1.0 - 0.6 * lseam * (1.0 - smoothstep(0.0, 0.07 + lwb, ls)) * lfine;
            // joints and rain streaks, nearly upright: they run down over the beds
            float lj = abs(cVn(vec2(lh.x * 0.34 + lw.y * 0.03, li * 0.31)) - 0.5), lstreak = cVn(vec2(lh.x * 0.8 + lh.y * 0.5, lw.y * 0.05 + 3.0));
            diffuseColor.rgb *= 1.0 - 0.5 * (1.0 - smoothstep(0.0, 0.016 + length(fwidth(vCWorld)) * 0.4, lj)) * lfine;
            diffuseColor.rgb *= 1.0 - 0.3 * smoothstep(0.55, 0.8, lstreak);
            // moss and soil on every ledge, in patches
            float lmoss = smoothstep(0.3, 0.62, vPN.y + (lblot - 0.5) * 0.7 + (lgr - 0.5) * 0.25);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.04, 0.075, 0.035) * (0.7 + 0.7 * lgr), lmoss * 0.85);
          } else if (pk > 6.5) { // painted tin roof: standing seams down the slope, a little light along each sheet
            float tc = along / 0.62, tf = abs(fract(tc) - 0.5) * 0.62;
            diffuseColor.rgb *= 0.95 + 0.1 * cH12(vec2(floor(tc), 5.0));
            diffuseColor.rgb *= 1.0 - 0.32 * (1.0 - smoothstep(0.0, 0.05 + wd * 0.8, 0.31 - tf)) * (1.0 - smoothstep(0.1, 0.3, wd));
          } else if (pk > 5.5) { // old lime plaster: blotches, damp streaks under the eaves, patches flaked off to the stone under it
            vec2 pq = vec2(along, up);
            float pb = cVn(pq * 0.33), pf = cVn(pq * 1.6 + 3.0), ps = cVn(vec2(along * 1.8, up * 0.22) + 8.0);
            diffuseColor.rgb *= 0.84 + 0.2 * pb + 0.1 * pf;
            diffuseColor.rgb *= 1.0 - 0.16 * smoothstep(0.58, 0.8, ps);
            float flake = smoothstep(0.73, 0.76, cVn(pq * 0.55 + 17.0) * 0.7 + pf * 0.3) * (1.0 - smoothstep(0.08, 0.24, wd));
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.7 + uStoneA * 0.18, flake * 0.8);
          } else { // plaster, softly stained
            diffuseColor.rgb *= 0.95 + 0.1 * cVn(vec2(along, up) * 0.9);
            // damp and shade at the foot of the wall, light under the eaves
            diffuseColor.rgb *= mix(vec3(0.9, 0.86, 0.84), vec3(1.0), smoothstep(0.0, 1.0, fract(up / 13.0) * 2.5));
          }
        }
      }
      #endif
      ${code.color || ''}`)
      .replace('#include <normal_fragment_begin>', /* glsl */`
      #include <normal_fragment_begin>
      #ifdef TOON_PAINT
      // painted kind 14, thin leaves: lit from above whichever way the strip faces, or half of them go black
      if (vPaint > 13.5 && vPaint < 14.5) normal = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
      #endif
      #ifdef TOON_FACETS
      {
        float fd = length(vViewPosition);
        vec2 gp = vCWorld.xz;
        // the lattice turned and pushed about by a slow noise: from the air it must not read as graph paper
        vec2 gw = mat2(0.92, -0.39, 0.39, 0.92) * gp;
        gw += (vec2(cVn(gp / (uFacet.x * 3.1)), cVn(gp / (uFacet.x * 3.7) + 9.0)) - 0.5) * uFacet.x * 2.2;
        vec2 fa = cTri(gw / uFacet.x + 3.1), fb = cTri(gw / (uFacet.x * 5.0) + 7.7);
        vec2 hh = mix(fa, fb, smoothstep(110.0, 240.0, fd));
        vec3 wn = normalize(cross(dFdx(vCWorld), dFdy(vCWorld)));
        float level = smoothstep(0.5, 0.78, abs(wn.y)) * (1.0 - smoothstep(900.0, 2400.0, fd));
        vec3 tilt = uFacet.y * 2.0 * vec3(hh.x - 0.5, 0.0, hh.y - 0.5) * level;
        normal = normalize(normal + (viewMatrix * vec4(tilt, 0.0)).xyz);
        // tone and a touch of hue per facet: warmer here, greener there, the way the reference paints its meadows
        float ft = 2.0 * (hh.y - 0.5) * level, fh = 2.0 * (hh.x - 0.5) * level;
        diffuseColor.rgb *= (1.0 + uFacet.z * ft) * vec3(1.0 + uFacet.z * 0.9 * fh, 1.0, 1.0 - uFacet.z * 0.9 * fh);
      }
      #endif
      #ifdef TOON_SHADE
      if (uShadeRect.z > 0.0) {
        vec2 suv = vec2((vCWorld.x - uShadeRect.x) * uShadeRect.z, (vCWorld.z - uShadeRect.y) * uShadeRect.w);
        if (suv.x > 0.0 && suv.x < 1.0 && suv.y > 0.0 && suv.y < 1.0) {
          vec2 sv = texture2D(uShadeMap, suv).rg;
          gSun = mix(sv.r, 1.0, gDeck);
          diffuseColor.rgb *= mix(sv.g, 1.0, gDeck);
        }
      }
      #endif
      ${code.normal || ''}
      #if defined(TOON_COVER) || defined(TOON_PAINT) || defined(TOON_SWAY)
      if (uWxOn > 0.5) {
        // a chosen sky on what stands outside: snow settles on what faces up, the wet darkens all. Karts and items do not have these flags
        #ifdef TOON_PAINT
        if (vPaint < 39.5) {
        #endif
        float up = dot(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz));
        if (uWxCover.x > 0.0) {
          float sn = cVn(vCWorld.xz * 0.21 + vCWorld.y * 0.13) * 0.62 + cVn(vCWorld.xz * 1.3 + 2.0) * 0.38;
          #ifdef TOON_SWAY
          up = up * 1.6 + 0.32; // the tiers of a tree hold snow on faces far steeper than a meadow does
          #endif
          float se = max(fwidth(up) * 0.7, 0.05);
          // what shows through a roof is rimed over, not its full colour: a red tile in a hole in the snow reads as a stain
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15))) * 0.85, 0.62 * uWxCover.x * smoothstep(0.1, 0.34, up));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 0.99), uWxCover.x * smoothstep(0.43 - se, 0.43 + se, up + (sn - 0.5) * 0.3));
        }
        if (uWxCover.y > 0.0) diffuseColor.rgb *= 1.0 - 0.24 * uWxCover.y;
        #ifdef TOON_PAINT
        }
        #endif
      }
      #endif`)
      .replace('#include <envmap_fragment>', /* glsl */`
      #include <envmap_fragment>
      if (uWxOn > 0.5) {
        // a soft shoulder: on white ground a lamp must not burn out what it lights
        vec3 wxAdd = diffuseColor.rgb * wxLocal(vCWorld, inverseTransformDirection(normal, viewMatrix));
        outgoingLight += wxAdd / (1.0 + dot(wxAdd, vec3(0.45)));
        if (gWet > 0.0) {
          // a wet road: a mirror of the air at a low angle, with what is lit in it pulled towards you, and drops ringing near the camera
          vec3 wV = normalize(vViewPosition), refl = uWxSky;
          float fr = pow(1.0 - max(dot(normal, wV), 0.0), 2.6), wk = clamp(gWet * (0.12 + 0.8 * fr), 0.0, 1.0);
          if (uWxLamps > 0.0) {
            if (uLitRect.z > 0.0) { vec3 lr = texture2D(uLitMap, (vCWorld.xz + (vCWorld.xz - cameraPosition.xz) * 0.2 - uLitRect.xy) * uLitRect.zw).rgb; refl += lr * lr * 1.5; }
            for (int i = 0; i < 4; i++) {
              if (uHeadP[i].w <= 0.0) continue;
              vec2 tl = uHeadP[i].xz - cameraPosition.xz; float tn = length(tl); if (tn < 0.5) continue;
              vec2 dd = tl / tn, oo = vCWorld.xz - uHeadP[i].xz; float along = dot(oo, dd), lat = dot(oo, vec2(-dd.y, dd.x));
              float st = exp(-lat * lat * 3.2) * smoothstep(-16.0, -1.0, along) * (1.0 - step(0.0, along));
              refl += (dot(uHeadD[i].xz, dd) > 0.0 ? vec3(1.5, 0.12, 0.08) : vec3(1.3, 1.15, 0.92)) * st * (0.1 + uWxNight * 0.75);
            }
          }
          outgoingLight = mix(outgoingLight, refl, wk);
          if (gRipple > 0.0 && uWxCover.y > 0.5) outgoingLight += (uWxSky * 0.5 + 0.03) * wxRing(vCWorld.xz, uTime) * gRipple * (1.0 - smoothstep(7.0, 30.0, length(vViewPosition)));
        }
      }
      #ifdef TOON_PAINT
      if (vPaint > 39.5) outgoingLight = diffuseColor.rgb; // lit from inside, the vertex colour is the light (render/weather.js)
      #endif
      #ifdef TOON_GLOSS
      {
        vec3 V = normalize(vViewPosition), S = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz), H = normalize(V + S);
        float s = pow(max(dot(normal, H), 0.0), uGloss.x);
        outgoingLight += uSunCol * smoothstep(0.25, 0.75, s) * uGloss.y;
      }
      #endif
      #ifdef TOON_RIM
      {
        vec3 V = normalize(vViewPosition);
        outgoingLight += uSunCol * pow(1.0 - max(dot(normal, V), 0.0), uRim.y) * uRim.x;
      }
      #endif`)
      .replace('#include <fog_fragment>', /* glsl */`gl_FragColor.rgb = applyFog(gl_FragColor.rgb, length(vViewPosition), vCWorld.y);
      #ifdef TOON_GROUND
        gl_FragColor.a = 0.5; // tells the outline pass this is ground: only its real edges get ink, never a soft crease
      #endif
      #ifdef TOON_PAINT
      {
        // painted kinds 10, 11 and 14, plates of rice and thin leaves, and 9, limestone, where ink on every soft crease is crumpled paper: ink as on the ground
        float pa = floor(vPaint + 0.5);
        if (pa > 13.5 || (pa > 8.5 && pa < 11.5)) gl_FragColor.a = 0.5;
      }
      #endif
      {
        // far off it all turns into the backdrop's mist, ink included: a low alpha asks the outline pass for none
        float mk = mistAmount(vCWorld);
        if (mk > 0.0) { gl_FragColor.rgb = mix(gl_FragColor.rgb, mistColor(vCWorld), mk); gl_FragColor.a *= 1.0 - mk; }
      }`);
  };
  return material;
}

// mat(color, opts) -> a toon material sharing the scene's uniforms, cached so that karts and props share programs and
// merge into few draw calls. opts as toon(), plus side, vertexColors, emissive, transparent, opacity.
export function createMat(shared) {
  const cache = new Map();
  return function mat(color = '#ffffff', opts = {}) {
    const key = `${color}|${JSON.stringify(opts, (k, v) => (k === 'code' ? v?.key : v))}`;
    let m = cache.get(key);
    if (m) return m;
    m = new THREE.MeshLambertMaterial({
      color, vertexColors: !!opts.vertexColors, side: opts.side ?? THREE.FrontSide,
      emissive: opts.emissive ?? '#000000', emissiveIntensity: opts.emissiveIntensity ?? 1,
      transparent: !!opts.transparent, opacity: opts.opacity ?? 1, depthWrite: opts.depthWrite ?? true,
    });
    m.userData.map = !!opts.map;
    toon(m, shared, opts);
    cache.set(key, m);
    return m;
  };
}
