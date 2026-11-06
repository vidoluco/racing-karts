// The road: a smooth painted ribbon, chunked along the lap so that a view only draws what it sees, with the wear, lines,
// kerbs, cobbles and dirt painted per pixel from lateral and along-road coordinates, and soft edges through alpha to
// coverage. Structures: stone arched decks for bridges and viaducts, a vault with portals for galleries.
import * as THREE from 'three';
import { clamp, lerp, smooth, linear, hash3, vnoise } from './math.js';
import { toon } from './toon.js';
import { paint, merge, roundedBox, place, tube, cylinder } from './shapes.js';
import { concreteDeck } from './concrete-deck.js';

const COLS = [-1.32, -1.16, -1.03, -1.0, -0.82, -0.45, 0, 0.45, 0.82, 1.0, 1.03, 1.16, 1.32]; // of half width past 1 the ribbon is shoulder
const CHUNK_SAMPLES = 64;
const FAR_GROUP = 4;   // chunks in a long track's stretch of road, drawn as one coarse mesh from afar: about 512 m
const FAR_ROW = 4;     // rows of the fine ribbon per row of the coarse one
const S_WRAP = 918;    // m: whole dashes (9 m) and whole kerb blocks (1.7 m), so a restart shows no jump in them

function roadMaterial(look, shared) {
  const R = look.road, c = (h) => new THREE.Color(h);
  const m = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  m.alphaToCoverage = true;
  // look.road.edgeSink (m, 0): the shoulder's outer rows go under the ground, so where the ribbon ends there is no step for the pen to ink as a broken line
  m.userData.edgeSink = R.edgeSink ?? 0;
  const uniforms = {
    uCorduroy: { value: R.corduroy ?? 0 }, cAsphalt: { value: c(R.asphalt) }, cDirt: { value: c(R.dirt) }, cCobble: { value: c(R.cobble) }, cWood: { value: c(R.wood) }, cSand: { value: c(R.sand) }, cSnow: { value: c(R.snow) }, cIce: { value: c(R.ice) },
    cLine: { value: c(R.line) }, cKerbA: { value: c(R.kerb[0]) }, cKerbB: { value: c(R.kerb[1]) }, cShoulder: { value: c(R.shoulder) }, cVerge: { value: c(R.verge ?? R.shoulder) },
    uGridS: { value: new THREE.Vector2(0, 0) }, uKerbW: { value: R.kerbW ?? 1.15 },
    // look.road.wobble, wear, crown, pebble: how far the edge wanders (1), tyre polish, patches, cracks and a gutter on asphalt (0), a grass crown and grassy edges on a dirt track (0), how much finer the pebbles (1); crownColor
    // look.road.track: { ruts, grain, edge }: a track in loose sand, no surface of its own, only tyre ruts and a packed band that melt into the plain
    uTrack: { value: new THREE.Vector4(R.track ? 1 : 0, R.track?.ruts ?? 0, R.track?.grain ?? 0, R.track?.edge ?? 0.5) }, uTrackG: { value: R.track?.grit ?? 0 },
    uRoadX: { value: new THREE.Vector4(R.wobble ?? 1, R.wear ?? 0, R.crown ?? 0, R.pebble ?? 1) }, cCrown: { value: c(R.crownColor ?? R.dirt) },
    // look.road.gravel: stones in the shoulder, 0..1, default none; look.road.lineWear: how much the lines are worn away, default 1
    uRoadG: { value: new THREE.Vector2(R.gravel ?? 0, R.lineWear ?? 1) },
    // look.road.winter { grain, ruts, scratches, dust }: packed snow with grain and wheel tracks, skate scratches on ice, snow blown over asphalt and into the joints of setts; look.road.repair: how much the tar patches show (1); none of it by default
    uWinter: { value: new THREE.Vector4(R.winter?.grain ?? 0, R.winter?.ruts ?? 0, R.winter?.scratches ?? 0, R.winter?.dust ?? 0) }, uRepair: { value: R.repair ?? 1 },
    // look.road.joint: a colour: asphalt meets setts at a laid stone band across the road, not through a long blend; none by default
    cJoint: { value: c(R.joint ?? '#000000') }, uJoint: { value: R.joint ? 1 : 0 },
    // look.road.sett: how many times smaller than a metre scale the setts are, default 2.1 (a hand wide); under 1 they are big flat slabs of a village path
    uSett: { value: R.sett ?? 2.1 }, uSettRough: { value: R.settRough ?? 0 }, // look.road.settRough 0..1: laid by hand, bent courses, no two alike, snow in the joints; 0 the old even setts
    // look.road.cracks: how much the thin cracks of look.road.wear show, default 1: with heavy wear they close into loops that read as a doodle
    uCrack: { value: R.cracks ?? 1 },
    // look.road.glare: [colour, amount]: an asphalt worn to a shine, picking up the low sky at a grazing angle and most toward the sun; none by default
    uGlare: { value: new THREE.Color(R.glare?.[0] ?? '#000000') }, uGlareA: { value: R.glare?.[1] ?? 0 },
    // look.road.grit: the stone in old tarmac: pale and dark aggregate in world size, tar bleeding in patches a hand wide, default 0
    uGrit: { value: R.grit ?? 0 },
    // look.road.sideLine: how much the painted edge lines show, default 1 (a village or pass road has hardly any); look.road.centreLine: half width of the dashes in m, default 0.15
    uLineK: { value: new THREE.Vector2(R.sideLine ?? 1, R.centreLine ?? 0.15) },
  };
  toon(m, shared, {
    shade: true,
    code: {
      key: 'road',
      uniforms,
      vpars: 'attribute vec4 aRoad, aSA, aSB; attribute float aDark; varying vec4 vRoad, vSA, vSB; varying float vDark;',
      vmain: 'vRoad = aRoad; vSA = aSA; vSB = aSB; vDark = aDark;',
      pars: /* glsl */`
        varying vec4 vRoad, vSA, vSB; varying float vDark;
        uniform vec2 uLineK; uniform float uSett; uniform float uSettRough; uniform float uCrack; uniform float uGrit; uniform vec3 uGlare; uniform float uGlareA; uniform vec3 cJoint; uniform float uJoint; uniform float uCorduroy; uniform vec3 cAsphalt, cDirt, cCobble, cWood, cSand, cSnow, cIce, cLine, cKerbA, cKerbB, cShoulder, cVerge; uniform vec2 uGridS; uniform float uKerbW; uniform vec2 uRoadG; uniform vec4 uRoadX; uniform vec4 uTrack; uniform float uTrackG; uniform vec3 cCrown; uniform vec4 uWinter; uniform float uRepair;
        float aaBand(float x, float c, float hw, float w){ return smoothstep(c - hw - w, c - hw + w, x) * (1.0 - smoothstep(c + hw - w, c + hw + w, x)); }
        vec3 cobble(vec2 P, float wd){
          vec2 P0 = P;
          if (uSettRough > 0.0) P += uSettRough * (vec2(cVn(P * 0.31), cVn(P * 0.31 + 5.3)) - 0.5) * 1.1;
          float h = 0.62, row = floor(P.x / h), cw = 0.72, c = P.y / cw + 0.5 * mod(row, 2.0) + uSettRough * cH12(vec2(row, 3.0)), col = floor(c);
          vec2 f = vec2(fract(c) - 0.5, fract(P.x / h) - 0.5) * vec2(cw, h);
          float j = cH12(vec2(row, col));
          float e = length(max(abs(f) - vec2(cw, h) * 0.5 + 0.13, 0.0)) - 0.11;
          vec3 st = cCobble * (0.78 + 0.46 * j);
          st *= 1.0 + 0.16 * smoothstep(0.0, -0.13, e);
          if (uSettRough > 0.0) {
            // each stone its own hand and tilt, broad tones over many so no tile ever shows; snow fills the joints, wider where it drifted, and lies over the stones in patches
            st *= 0.8 + 0.4 * cVn(P0 * 0.13 + 2.0) + 0.34 * (cH12(vec2(col, row + 7.0)) - 0.5);
            st *= 1.0 + 0.5 * uSettRough * dot(f / vec2(cw, h), vec2(cH12(vec2(col, row)) - 0.5, 0.5)) ;
            float drift = cVn(P0 * 0.17 + 8.0), jw = smoothstep(-0.05 - 0.09 * drift - wd, 0.0 + wd, e);
            vec3 sj = mix(st, cSnow * 1.02, jw * (1.0 - smoothstep(0.25, 0.7, wd)));
            return mix(sj, cSnow * (0.96 + 0.08 * cVn(P0 * 1.9)), smoothstep(0.73, 0.79, drift + 0.14 * (cVn(P0 * 1.1) - 0.5)));
          }
          return mix(st, mix(cCobble * 0.42, cSnow * 0.9, uWinter.w), smoothstep(-0.012 - wd, 0.012 + wd, e) * (1.0 - smoothstep(0.1, 0.3, wd)));
        }`,
      color: /* glsl */`
      {
        float s = vRoad.x, d = vRoad.y, hw = vRoad.z, ad = abs(d), edge = ad - hw;
        vec2 P = vec2(s, d);
        float wd = length(vec2(fwidth(s), fwidth(d)));
        float n1 = cVn(P * vec2(0.08, 0.2)), n2 = cVn(P * vec2(0.33, 0.8) + 4.1), n3 = cVn(P * vec2(1.3, 2.7) + 9.7);
        // the shape of the edge wanders: painted, never ruled
        float wob = ((n1 - 0.5) * 1.1 + (n3 - 0.5) * 0.5) * uRoadX.x;
        // asphalt: broad blotches, dark tyre lanes, worn lines
        vec3 A = cAsphalt * (0.86 + 0.14 * n1 + 0.14 * n2);
        float lane = aaBand(ad, hw * 0.42, hw * 0.16, hw * 0.1) * (0.55 + 0.45 * cVn(P * vec2(0.04, 1.2) + 3.0));
        A *= 1.0 - 0.13 * lane;
        if (uGlareA > 0.0) { vec3 gv = normalize(cameraPosition - vCWorld); vec2 gh = normalize(-gv.xz + 1e-4), gs = normalize(uSunDir.xz + 1e-4); float gf = pow(1.0 - clamp(gv.y, 0.0, 1.0), 4.0), gt = 0.35 + 0.65 * pow(max(dot(gh, gs), 0.0), 3.0); A += uGlare * uGlareA * gf * gt * (0.45 + 0.9 * n2) * (0.5 + 0.8 * lane); }
        // an old road: tar repairs across a lane, a seam down it, dust blown in from the edges
        float rc = floor(s / 23.0), rj = cH12(vec2(rc, 3.0)), rs = (fract(s / 23.0) - 0.3 - 0.3 * rj) * 23.0, rl = 3.0 + 7.0 * cH12(vec2(rc, 5.0)), rd = (rj - 0.5) * hw * 1.2;
        float repair = step(0.45, rj) * (1.0 - smoothstep(rl - wd, rl + wd, abs(rs))) * (1.0 - smoothstep(1.2 + 1.4 * cH12(vec2(rc, 8.0)) - wd, 1.2 + 1.4 * cH12(vec2(rc, 8.0)) + wd, abs(d - rd)));
        A *= 1.0 - 0.14 * repair * uRepair;
        float seamW = aaBand(d + (n1 - 0.5) * 1.4, hw * 0.3, 0.03, wd + 0.01) * smoothstep(0.42, 0.55, n2);
        A *= 1.0 - 0.14 * uRepair * seamW * (1.0 - smoothstep(0.12, 0.3, wd));
        A = mix(A, cShoulder, 0.26 * smoothstep(hw - 2.0, hw - 0.2, ad) * (0.5 + 0.8 * n3));
        // grain up close, smooth so it never reads as pixels, gone before it can shimmer
        A *= 1.0 + 0.1 * (cVn(P * 5.3) - 0.5) * (1.0 - smoothstep(0.08, 0.22, wd));
        if (uGrit > 0.0) {
          float gN = (1.0 - smoothstep(0.03, 0.12, wd)) * uGrit, gM = (1.0 - smoothstep(0.1, 0.4, wd)) * uGrit;
          A *= 1.0 + gN * (0.34 * (cVn(P * vec2(31.0, 29.0)) - 0.5) + 0.26 * (cVn(P * vec2(13.0, 15.0) + 4.0) - 0.5));
          A = mix(A, A * 1.3, gN * 0.7 * smoothstep(0.7, 0.8, cVn(P * vec2(23.0, 27.0) + 9.0)));
          A *= 1.0 - gM * 0.2 * smoothstep(0.5, 0.72, cVn(P * vec2(1.7, 2.3) + 2.0) * 0.65 + cVn(P * vec2(6.1, 7.3)) * 0.35);
        }
        if (uRoadX.y > 0.0) {
          // what the bottom of the frame shows at night: two polished wheel lines per lane, square patches with their tar seam, thin cracks, grit in the gutter
          float tyres = aaBand(ad, hw * 0.24, 0.5, 0.3) + aaBand(ad, hw * 0.66, 0.5, 0.3);
          A *= 1.0 - 0.17 * uRoadX.y * tyres * (0.35 + 0.65 * cVn(P * vec2(0.035, 7.0) + 1.7));
          float pc = floor(s / 37.0), pj = cH12(vec2(pc, 21.0)), ps = (fract(s / 37.0) - 0.5) * 37.0, pl = 3.5 + 5.0 * cH12(vec2(pc, 22.0)), pw = 1.3 + 1.2 * cH12(vec2(pc, 23.0)), pd = (pj - 0.5) * hw * 1.3;
          float pE = max(abs(ps) - pl, abs(d - pd) - pw), pon = step(0.22, pj);
          A *= 1.0 - 0.15 * uRoadX.y * pon * (1.0 - smoothstep(-wd, wd, pE));
          A = mix(A, cAsphalt * 0.46, uRoadX.y * pon * aaBand(pE, 0.0, 0.05, wd + 0.012) * (1.0 - smoothstep(0.12, 0.34, wd)) * 0.5);
          float cr = abs(cVn(P * vec2(0.42, 1.1) + 2.2) - 0.5);
          A *= 1.0 - 0.2 * uCrack * uRoadX.y * (1.0 - smoothstep(0.0, 0.012 + wd * 0.3, cr)) * (1.0 - smoothstep(0.06, 0.18, wd)) * smoothstep(0.5, 0.62, n1);
          A = mix(A, cShoulder * 0.6, uRoadX.y * aaBand(ad, hw - 0.2, 0.16, wd + 0.02) * 0.7);
        }
        if (uWinter.w > 0.0) {
          // snow blown across in long tongues, thin on the wheel lines
          float blown = smoothstep(0.46, 0.7, cVn(P * vec2(0.07, 0.42) + 2.0) * 0.55 + cVn(P * vec2(0.33, 1.9) + 6.0) * 0.45);
          A = mix(A, cSnow * 0.9, uWinter.w * blown * (1.0 - 0.7 * aaBand(ad, hw * 0.42, hw * 0.16, hw * 0.1)));
        }
        float wear = mix(1.0, smoothstep(0.26, 0.5, cVn(P * vec2(0.5, 2.0) + 7.0) + 0.14), uRoadG.y);
        float centre = aaBand(d, 0.0, uLineK.y, wd) * step(fract(s / 9.0), 0.48) * wear;
        float side = aaBand(ad, hw - 0.62, 0.11, wd) * wear * uLineK.x;
        // a kerb replaces the side line where it runs
        side *= 1.0 - smoothstep(0.26, 0.34, abs(vRoad.w) * step(0.0, d * vRoad.w));
        A = mix(A, cLine, max(centre * 0.92, side * 0.85) * vSB.w);
        // dirt: ruts, a grassy crown, pebbles
        vec3 D = cDirt * (0.84 + 0.2 * n1 + 0.12 * n2);
        float ruts = aaBand(ad, hw * 0.4, hw * 0.15, hw * 0.12);
        D *= 1.0 - 0.16 * ruts * (0.7 + 0.3 * n3);
        // pebbles, small and few: bigger than this they read as stains
        float pfade = 1.0 - smoothstep(0.03, 0.09, wd * uRoadX.w);
        D = mix(D, cDirt * 0.8, smoothstep(0.74, 0.86, cVn(P * vec2(19.3, 21.1) * uRoadX.w)) * pfade);
        D = mix(D, cDirt * 1.1, smoothstep(0.74, 0.86, cVn(P * vec2(17.1, 20.7) * uRoadX.w + 11.0)) * pfade);
        if (uRoadX.z > 0.0) {
          // a farm track: grass down the crown between the wheel ruts, and the meadow coming in from both edges
          float tuft = cVn(P * vec2(2.3, 4.7) + 5.0), gr = 1.0 - smoothstep(0.05, 0.24, wd);
          D *= 1.0 - 0.3 * ruts * (0.6 + 0.4 * n3);
          D *= 1.0 + 0.26 * (cVn(P * vec2(6.1, 8.3)) - 0.5) * gr + 0.22 * (cVn(P * vec2(1.3, 2.1) + 3.0) - 0.5);
          float cg = smoothstep(0.46, 0.56, aaBand(d + (n1 - 0.5) * 0.9, 0.0, hw * 0.1 + 0.5 * (n2 - 0.5), 0.5) * 0.65 + tuft * 0.45) * smoothstep(0.2, 0.42, cVn(P * vec2(0.5, 2.2) + 5.0) + 0.1);
          D = mix(D, cCrown * (0.78 + 0.5 * tuft), cg * uRoadX.z);
          float eg = smoothstep(0.42, 0.56, smoothstep(hw * 0.68, hw * 1.02, ad + (n1 - 0.5) * 2.6) * 0.7 + tuft * 0.35);
          D = mix(D, cCrown * (0.78 + 0.5 * tuft), eg * uRoadX.z);
        }
        // setts a hand wide: wheel sized blocks made the road look like a toy's
        vec3 C = cobble(P * uSett, wd * uSett);
        vec3 W = cWood * (0.82 + 0.3 * cH12(vec2(floor(s / 0.62), 2.0)));
        W *= 1.0 - 0.45 * smoothstep(0.26 - wd, 0.3, abs(fract(s / 0.62) - 0.5) * 0.62);
        vec3 Sd = cSand * (0.9 + 0.12 * n1 + 0.08 * n3);
        if (uTrack.x > 0.5) {
          // several jeeps' worth of ruts that wander across the band, cut into one sand, and the sand of the plain coming in from both edges
          float dw = d + (cVn(vec2(s * 0.016, 2.0)) - 0.5) * hw * 0.34 + (cVn(vec2(s * 0.07, 5.0)) - 0.5) * hw * 0.1;
          float rr = 0.0;
          for (int q = 0; q < 6; q++) {
            float fq = float(q), c0 = (fq - 2.5) * hw * 0.3 + (cVn(vec2(s * 0.022 + fq * 7.3, fq)) - 0.5) * hw * 0.28;
            rr = max(rr, aaBand(dw, c0, 0.09 + 0.07 * cVn(vec2(s * 0.05, fq + 9.0)), 0.08 + wd) * smoothstep(0.26, 0.5, cVn(vec2(s * 0.03 + fq * 3.1, fq * 2.0 + 1.0))));
          }
          float gr = (cVn(P * vec2(5.1, 7.7)) - 0.5) * 0.6 + (cVn(P * vec2(13.0, 17.0) + 3.0) - 0.5) * 0.4;
          vec3 Tk = cSand * (0.9 + 0.11 * n1 + 0.1 * n2);
          Tk *= 1.0 + uTrack.z * gr * (1.0 - smoothstep(0.05, 0.28, wd));
          Tk *= 1.0 - uTrack.y * rr;
          // look.road.track.grit: the lapilli of a volcanic plain, dark and pale specks up close and gone before they can shimmer; off by default
          if (uTrackG > 0.0) {
            float pf = uTrackG * (1.0 - smoothstep(0.015, 0.06, wd));
            Tk = mix(Tk, cSand * 0.66, smoothstep(0.66, 0.78, cVn(P * vec2(31.0, 37.0) + 2.0)) * pf * 0.8);
            Tk = mix(Tk, cSand * 1.24, smoothstep(0.72, 0.82, cVn(P * vec2(43.0, 47.0) + 9.0)) * pf * 0.55);
          }
          Tk = mix(Tk, cVerge * (0.94 + 0.12 * n2), smoothstep(hw * uTrack.w, hw * 1.0, ad + (n1 - 0.5) * hw * 0.4 + (n3 - 0.5) * 1.2));
          D = Tk; Sd = Tk;
        }
        vec3 Sn = cSnow * (0.94 + 0.08 * n1);
        // look.road.corduroy: the groomer's ribs running down a piste, none by default
        if (uCorduroy > 0.0) Sn *= 1.0 - uCorduroy * smoothstep(0.35, 0.75, abs(fract(d / 0.9) - 0.5) * 2.0) * (1.0 - smoothstep(0.06, 0.2, wd)) - uCorduroy * 0.7 * step(0.5, fract(floor(d / 3.2) * 0.5)) * (1.0 - smoothstep(0.3, 1.0, wd));
        if (uWinter.x > 0.0) Sn *= 1.0 + uWinter.x * ((cVn(P * vec2(1.7, 3.1) + 1.5) - 0.5) + 0.7 * (cVn(P * 5.7) - 0.5)) * (1.0 - smoothstep(0.1, 0.35, wd));
        if (uWinter.y > 0.0) {
          float tracks = aaBand(ad, hw * 0.22, 0.42, 0.3) + aaBand(ad, hw * 0.62, 0.42, 0.3);
          Sn = mix(Sn, Sn * vec3(0.84, 0.87, 0.96), uWinter.y * tracks * (0.35 + 0.65 * cVn(P * vec2(0.03, 5.0) + 1.7)));
        }
        vec3 Ic = mix(cIce, cIce * 1.1, smoothstep(0.5, 0.56, n2));
        if (uWinter.z > 0.0) {
          // long pale skate lines and a little snow in the hollows
          // distance to the line in metres, by the noise's own slope, or the line swells where the noise is flat
          float ska = cVn(P * vec2(0.09, 0.5) + 1.0) - 0.5, skb = cVn(P * vec2(0.17, 0.36) + 7.0) - 0.5;
          float sk = max(1.0 - smoothstep(0.02, 0.05 + wd, abs(ska) / max(fwidth(ska) / max(wd, 1e-4), 1e-3)), 1.0 - smoothstep(0.015, 0.04 + wd, abs(skb) / max(fwidth(skb) / max(wd, 1e-4), 1e-3)));
          Ic = mix(Ic * (0.86 + 0.24 * n1), vec3(0.94, 0.97, 1.0), max(uWinter.z * sk * (1.0 - smoothstep(0.12, 0.4, wd)), 0.55 * smoothstep(0.58, 0.72, cVn(P * vec2(0.06, 0.22) + 3.0))));
        }
        vec3 col = A * vSA.x + D * vSA.y + C * vSA.z + W * vSA.w + Sd * vSB.x + Sn * vSB.y + Ic * vSB.z;
        if (uJoint > 0.0 && vSA.z > 0.001 && vSA.x > 0.001) { float jw = vSA.z / (vSA.z + vSA.x); col = mix(mix(A, C, smoothstep(0.44, 0.56, jw)), cJoint * (0.82 + 0.3 * n3), 1.0 - smoothstep(0.04, 0.09, abs(jw - 0.5))); }
        // start line: a band of checks
        float sg = s;
        float chk = step(sg, 3.2) * step(0.0, sg);
        if (chk > 0.5) { float q = mod(floor(sg / 0.8) + floor((d + 40.0) / 0.8), 2.0); col = mix(col, q > 0.5 ? cKerbB * 1.1 : vec3(0.05), 0.95); }
        // kerbs: painted red and cream on the bends that have them
        float kerb = vRoad.w;
        if (abs(kerb) > 0.01) {
          float kb = smoothstep(0.0, 0.1, edge + uKerbW) * (1.0 - smoothstep(-0.04, 0.02, edge));
          float kk = mod(floor(s / 1.7), 2.0);
          float sideK = kerb > 0.0 ? step(0.0, d) : step(d, 0.0);
          vec3 kc = kk > 0.5 ? cKerbA : cKerbB;
          col = mix(col, kc * (0.92 + 0.14 * n2), kb * sideK * smoothstep(0.28, 0.32, abs(kerb)));
        }
        // past the edge: the gravel shoulder, ending in a ragged soft line in the grass
        float shw = (hw * 0.32 - 0.6);
        float sEdge = (edge - wob * 0.8) / max(shw, 0.5);
        // a narrow gravel edge, going into the dry grass at the foot of the meadow: a brown strip with an edge of its own looks like a skirt round a slab
        vec3 sh = mix(cShoulder * (0.82 + 0.28 * n2), cDirt, smoothstep(-0.1, 0.2, vSA.y - 0.5));
        sh = mix(sh, cVerge * (0.88 + 0.26 * n2), smoothstep(0.02, 0.3 + 0.2 * n3, sEdge));
        if (uRoadG.x > 0.0) {
          // gravel: broken stones in two sizes with dark gaps, thinning into the grass, gone before they can shimmer
          float gn = (1.0 - smoothstep(0.06, 0.22, wd)) * uRoadG.x;
          float g1 = cVn(P * vec2(4.1, 4.7)), g2 = cVn(P * vec2(11.0, 9.3) + 3.0), g3 = cVn(P * vec2(1.4, 1.7) + 8.0);
          sh *= 1.0 + gn * ((g1 - 0.5) * 0.7 + (g2 - 0.5) * 0.5);
          sh = mix(sh, cShoulder * 0.55, gn * smoothstep(0.66, 0.72, g1) * 0.7);
          sh = mix(sh, cShoulder * 1.28, gn * smoothstep(0.72, 0.78, g2) * smoothstep(0.35, 0.6, g3));
        }
        // on a deck the edge meets a wall: ruled, or it shows as a ragged line at the foot of the wall
        col = mix(col, vDark > 0.02 ? col * 0.8 : sh, smoothstep(-0.06, 0.06, edge - (vDark > 0.02 ? 0.0 : wob * 0.25)));
        float aw = max(fwidth(sEdge) * 1.2, 0.02);
        float a = 1.0 - smoothstep(0.62 - aw, 0.62 + aw, sEdge);
        // a deck ends in its wall: no soft shoulder hanging in the air, its coverage dither would break the silhouette's ink
        if (vDark > 0.02) { if (edge > mix(hw * 0.4, 0.08, smoothstep(0.02, 0.45, vDark))) discard; if (vDark > 0.45) a = 1.0; }
        if (vDark > 0.75) col *= 0.38; // the gallery
        gDeck = step(0.25, vDark);
        if (uWxOn > 0.5) {
          // the road under a chosen sky. Snow: blown in from the edges, into a white crown between two dark wheel tracks; wet: darker, a mirror, more so on what is smooth
          float rs = 1.0 - smoothstep(-1.5, 0.3, edge);
          if (uWxCover.x > 0.0) {
            // packed snow a shade greyer than the white of the verge, so the road still reads; two wheel tracks down it with the road showing through in places; the edges drifted white
            vec3 packed = vec3(0.62, 0.66, 0.74) * (0.96 + 0.08 * n2), white = vec3(0.9, 0.93, 0.98);
            float tw = abs(ad - hw * 0.44) - hw * 0.085 + (n1 - 0.5) * 0.5;
            float track = 1.0 - smoothstep(-0.05 - wd, 0.05 + wd, tw);
            float bare = smoothstep(0.5, 0.56, cVn(P * vec2(0.09, 1.1) + 2.0) * 0.8 + n3 * 0.2);
            float cover = mix(1.0, 0.45, track * bare);
            vec3 sn = mix(packed, packed * 0.74, track);
            sn = mix(sn, white, smoothstep(-0.05 - wd, 0.05 + wd, ad - hw * 0.76 + (n1 - 0.5) * 1.8 + (n3 - 0.5) * 0.5));
            col = mix(col, sn, uWxCover.x * cover * 0.97);
          }
          if (uWxCover.y > 0.0) {
            col *= 1.0 - 0.32 * uWxCover.y * rs;
            gWet = uWxCover.y * rs * (0.5 + 0.5 * smoothstep(0.3, 0.7, n2 * 0.6 + n1 * 0.4));
            gRipple = rs;
          }
        }
        diffuseColor.rgb = col;
        diffuseColor.a = a;
      }`,
      normal: '',
    },
  });
  return m;
}

// Surface weights across the lap, softened so a change of surface reads as a painted blend.
function surfaceWeights(S, n, closed) {
  const IDS = ['asphalt', 'dirt', 'cobble', 'wood', 'sand', 'snow', 'ice'];
  return IDS.map((_, k) => {
    const raw = new Float32Array(n), out = new Float32Array(n), R = 3;
    for (let i = 0; i < n; i++) raw[i] = S.surface[i] === mapIndex(k) ? 1 : 0;
    for (let i = 0; i < n; i++) {
      let s = 0, c = 0;
      for (let o = -R; o <= R; o++) { const j = closed ? (i + o + n) % n : i + o; if (j < 0 || j >= n) continue; s += raw[j]; c++; }
      out[i] = s / c;
    }
    return out;
  });
}
const SURF = ['asphalt', 'dirt', 'sand', 'snow', 'ice', 'wood', 'cobble']; // src/world/track.js SURFACES
const mapIndex = (k) => SURF.indexOf(['asphalt', 'dirt', 'cobble', 'wood', 'sand', 'snow', 'ice'][k]);

// A long track's stretch of road as drawn from afar: every fourth row, five columns, a little proud of the coarse ground.
function farRibbon(attrs, nc, r0, r1, material) {
  const FAR_COLS = [0, 3, 6, 9, 12], rowsAt = [], g = new THREE.BufferGeometry();
  for (let r = r0; r < r1; r += FAR_ROW) rowsAt.push(r);
  rowsAt.push(r1);
  for (const [name, A, sz] of attrs) {
    const out = new Float32Array(rowsAt.length * FAR_COLS.length * sz);
    let o = 0;
    for (const r of rowsAt) for (const c of FAR_COLS) { const k = (r * nc + c) * sz; for (let e = 0; e < sz; e++) out[o++] = A[k + e] + (name === 'position' && e === 1 ? 0.5 : 0); }
    g.setAttribute(name, new THREE.BufferAttribute(out, sz));
  }
  const idx = [], fc = FAR_COLS.length;
  for (let r = 0; r < rowsAt.length - 1; r++) for (let c = 0; c < fc - 1; c++) { const a = r * fc + c, b = a + 1, d = a + fc, e = d + 1; idx.push(a, d, b, b, d, e); }
  g.setIndex(idx);
  g.computeBoundingSphere();
  return new THREE.Mesh(g, material);
}

function buildRibbon(part, material, group, closed, start = 0, main = null, groups = null) {
  const { samples: S, n, curvature } = part, W = surfaceWeights(S, n, closed);
  const nc = COLS.length, rows = closed ? n + 1 : n;
  const P = new Float32Array(rows * nc * 3), NN = new Float32Array(rows * nc * 3), R = new Float32Array(rows * nc * 4), SA = new Float32Array(rows * nc * 4), SB = new Float32Array(rows * nc * 4), DK = new Float32Array(rows * nc);
  const hw0 = (i) => S.w[i] / 2;
  // kerbs on the inside and outside of every real bend, faded in along the road
  const kerb = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (let o = -6; o <= 6; o++) { const j = closed ? (i + o + n) % n : clamp(i + o, 0, n - 1); if (Math.abs(curvature[j]) > Math.abs(m)) m = curvature[j]; }
    kerb[i] = clamp(m * 34, -1, 1);
  }
  const heightAt = (i, d) => part.heightAt(i, d);
  const sunk = closed ? 0 : 0.07; // a side track passes just under the road it joins, so the join is the road's own edge
  for (let r = 0; r < rows; r++) {
    const i = r % n, hw = hw0(i), tx = S.tx[i], tz = S.tz[i], bank = S.bank ? S.bank[i] : 0, struct = S.struct ? S.struct[i] : 0;
    const lean = Math.tan(bank * Math.PI / 180);
    let nl = Math.hypot(lean, 1);
    for (let c = 0; c < nc; c++) {
      const f = COLS[c], d = f * hw, k = r * nc + c;
      P[k * 3] = S.x[i] + S.nx[i] * d; P[k * 3 + 1] = heightAt(i, d) + (Math.abs(f) > 1 ? 0.02 : 0) - sunk - (Math.abs(f) > 1.1 && !struct ? material.userData.edgeSink || 0 : 0); P[k * 3 + 2] = S.z[i] + S.nz[i] * d;
      if (main) {
        // a side track goes down under the road it joins: on a banked road a flat join would lie on top of the asphalt
        const q = main.nearest(P[k * 3], P[k * 3 + 2]), over = main.samples.w[q.i] / 2 + 0.6 - Math.abs(q.d);
        if (over > 0) P[k * 3 + 1] = Math.min(P[k * 3 + 1], main.heightAt(q.f, q.d) - 0.3 - Math.min(0.8, over * 0.3));
      }
      // up, leaning with the bank: the left edge is lower when bank is positive
      NN[k * 3] = S.nx[i] * lean / nl; NN[k * 3 + 1] = 1 / nl; NN[k * 3 + 2] = S.nz[i] * lean / nl;
      R[k * 4] = start + r * part.step; R[k * 4 + 1] = d; R[k * 4 + 2] = hw;
      R[k * 4 + 3] = (S.surface[i] === SURF.indexOf('dirt') || struct || (material.userData.noKerbOn && S.surface[i] === SURF.indexOf(material.userData.noKerbOn))) ? 0 : (f * kerb[i] >= 0 ? kerb[i] : 0);
      SA[k * 4] = W[0][i]; SA[k * 4 + 1] = W[1][i]; SA[k * 4 + 2] = W[2][i]; SA[k * 4 + 3] = W[3][i];
      SB[k * 4] = W[4][i]; SB[k * 4 + 1] = W[5][i]; SB[k * 4 + 2] = W[6][i]; SB[k * 4 + 3] = W[0][i]; // w: where the lines are painted
      DK[k] = struct === 3 ? 1 : struct ? 0.5 : 0;
    }
  }
  for (let start0 = 0; start0 < rows - 1; start0 += CHUNK_SAMPLES) {
    const end = Math.min(rows - 1, start0 + CHUNK_SAMPLES), count = end - start0 + 1;
    const pick = (A, sz) => A.slice(start0 * nc * sz, (end + 1) * nc * sz);
    const idx = [];
    for (let r = 0; r < count - 1; r++) for (let c = 0; c < nc - 1; c++) {
      const a = r * nc + c, b = a + 1, d = a + nc, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
    const g = new THREE.BufferGeometry();
    // the attributes of a chunk are its own copies, so a long lap's distance can restart inside the float's good range
    g.setAttribute('position', new THREE.BufferAttribute(pick(P, 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(pick(NN, 3), 3));
    const rA = pick(R, 4);
    if (groups) {
      // distance along the road restarts every S_WRAP m (never under S_WRAP, where the start line is painted): noise at 10 km is past the float's good range
      const wraps = Math.floor(rA[0] / S_WRAP) - 1;
      if (wraps > 0) for (let q = 0; q < rA.length; q += 4) rA[q] -= wraps * S_WRAP;
    }
    g.setAttribute('aRoad', new THREE.BufferAttribute(rA, 4));
    g.setAttribute('aSA', new THREE.BufferAttribute(pick(SA, 4), 4));
    g.setAttribute('aSB', new THREE.BufferAttribute(pick(SB, 4), 4));
    g.setAttribute('aDark', new THREE.BufferAttribute(pick(DK, 1), 1));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, material);
    group.add(m);
    if (groups) {
      if (!(start0 % (CHUNK_SAMPLES * FAR_GROUP))) groups.push({ near: [], far: null, r0: start0 });
      const G = groups[groups.length - 1];
      G.near.push(m);
      G.r1 = end;
    }
  }
  if (groups) {
    const attrs = [['position', P, 3], ['normal', NN, 3], ['aRoad', R, 4], ['aSA', SA, 4], ['aSB', SB, 4], ['aDark', DK, 1]];
    for (const G of groups) if (!G.far) { G.far = farRibbon(attrs, nc, G.r0, G.r1, material); group.add(G.far); }
  }
}

export function buildRoad(track, look, shared) {
  const group = new THREE.Group(), material = roadMaterial(look, shared), groups = track.long ? [] : null;
  material.userData.noKerbOn = look.road.noKerbOn;   // look.road.noKerbOn: a surface that takes no painted kerb, default none
  buildRibbon(track, material, group, true, 0, null, groups);
  // a shortcut's samples have no structure and no bank: heightAt holds for them too
  (track.shortcuts || []).forEach((sc) => buildRibbon(sc, material, group, false, 100000 + sc.index * 1000, track, groups));
  return { group, material, groups };
}

// True where a lower road runs under a point (x, z), so no pier ever lands on it.
function onLowerRoad(track, x, z, deckY) {
  const S = track.samples, n = track.n;
  for (let i = 0; i < n; i++) {
    if (S.struct[i] === 1 || S.struct[i] === 2) continue;
    if (Math.abs(S.y[i] - deckY) < 4) continue;
    const e = (x - S.x[i]) ** 2 + (z - S.z[i]) ** 2, r = S.w[i] / 2 + 5;
    if (e < r * r) return true;
  }
  return false;
}

// Arched stone deck over samples i0..i1: two side walls with semi-elliptic openings, the barrel under them, piers to the
// ground, a string course and parapets. Painted stone blocks; batch.add puts it into the static merges.
function archedDeck(track, st, world, batch, look) {
  const S = track.samples, n = track.n, stone = linear(look.stone.color);
  const count = ((st.i1 - st.i0 + n) % n) + 1, tall = st.kind === 'viaduct';
  const at = (q) => (st.i0 + q + n) % n;
  const groundAt = world.terrain.heightAt;
  const span0 = tall ? (look.deck?.span ?? 21) : 17, pierW = tall ? (look.deck?.pier ?? 3.4) : 3;
  // piers: spaced evenly, nudged along the deck off any road below, spans stretch rather than touch it
  const len = (count - 1) * track.step, piers = [];
  const nSpans = Math.max(2, Math.round(len / span0));
  for (let k = 0; k <= nSpans; k++) {
    let s = (k / nSpans) * len;
    if (k > 0 && k < nSpans) {
      for (const o of [0, 3, -3, 6, -6, 9, -9, 12, -12, 15, -15]) {
        const f = (s + o) / track.step, q = at(Math.round(f));
        const P = [S.x[q], S.z[q]];
        if (!onLowerRoad(track, P[0], P[1], S.y[q])) { s += o; break; }
      }
    }
    piers.push(s);
  }
  const Hw = (q) => S.w[at(q)] / 2 + 0.55;
  const pos = [], nor = [], col = [], knd = [], idx = [];
  const push = (x, y, z, nx, ny, nz, tone, kind = 1, cool = 0) => { pos.push(x, y, z); nor.push(nx, ny, nz); col.push(stone[0] * tone * (1 - cool * 0.12), stone[1] * tone * (1 - cool * 0.06), stone[2] * tone); knd.push(kind); return pos.length / 3 - 1; };
  const sAt = (s) => {
    const f = clamp(s / track.step, 0, count - 1), a = Math.floor(f), b = Math.min(count - 1, a + 1), t = f - a, A = at(a), B = at(b);
    const x = lerp(S.x[A], S.x[B], t), y = lerp(S.y[A], S.y[B], t), z = lerp(S.z[A], S.z[B], t), nx = lerp(S.nx[A], S.nx[B], t), nz = lerp(S.nz[A], S.nz[B], t), hw = lerp(Hw(a), Hw(b), t);
    return { x, y, z, nx, nz, hw };
  };
  for (let k = 0; k < piers.length - 1; k++) {
    const s0 = piers[k] + pierW / 2, s1 = piers[k + 1] - pierW / 2, a = (s1 - s0) / 2, c = (s0 + s1) / 2, D = sAt(c);
    const rise = Math.min(a * (tall ? 1.05 : 0.8), D.y - groundAt(D.x, D.z) - 0.7), under = 1.15;
    const spring = D.y - under - Math.max(rise, 1.5);
    const rowsAlong = 24, foot = (s) => { const p = sAt(s); return Math.min(groundAt(p.x + p.nx * p.hw, p.z + p.nz * p.hw), groundAt(p.x - p.nx * p.hw, p.z - p.nz * p.hw), groundAt(p.x, p.z)) - 3; };
    // one span, from pier centre to the next pier centre, faces first
    const list = [];
    for (let i = 0; i <= 4; i++) list.push(piers[k] + (pierW / 2) * (i / 4));
    for (let i = 1; i <= rowsAlong; i++) list.push(s0 + (s1 - s0) * (i / rowsAlong));
    for (let i = 1; i <= 4; i++) list.push(s1 + (pierW / 2) * (i / 4));
    const under0 = (s) => {
      if (s <= s0 || s >= s1) return foot(s);
      const t = (s - c) / a, h = Math.sqrt(Math.max(0, 1 - t * t));
      return spring + Math.max(rise, 1.5) * h;
    };
    // look.deck.weather (default none): rows down each face, toned by height: damp under the coping, rain streaks, moss at the foot; a face of one tone reads as a flat plate from any distance past its stone joints
    const faceRows = tall && look.deck?.weather ? 6 : 1;
    for (const side of [-1, 1]) {
      const base = pos.length / 3;
      list.forEach((s) => {
        const p = sAt(s), top = p.y - 0.12, b = under0(s);
        // a slight batter: the piers widen toward the foot
        const flare = 0.02 * Math.max(0, top - b), ox = p.nx * side, oz = p.nz * side, hw = p.hw;
        const tone = 0.96 + 0.1 * hash3(Math.round(s), side, 2);
        if (faceRows === 1) {
          push(p.x + ox * hw, top, p.z + oz * hw, ox, 0, oz, tone);
          push(p.x + ox * (hw + flare), b, p.z + oz * (hw + flare), ox, 0, oz, tone * lerp(0.8, 1, smooth(0, 6, b - groundAt(p.x, p.z))));
          return;
        }
        const W = look.deck.weather, gr = groundAt(p.x, p.z);
        for (let q = 0; q <= faceRows; q++) {
          const t = q / faceRows, y = lerp(top, b, t);
          const streak = vnoise(s * 0.62 + side * 9, y * 0.09, 37) * 0.6 + vnoise(s * 1.9 + side * 3, y * 0.2, 38) * 0.4;
          const damp = 1 - W * 0.34 * Math.exp(-(top - y) / 1.5), low = lerp(0.62, 1, smooth(0, 7, y - gr));
          push(p.x + ox * (hw + flare * t), y, p.z + oz * (hw + flare * t), ox, 0, oz, tone * damp * low * (1 + W * 0.42 * (streak - 0.5)), 1, (1 - smooth(0, 5, y - gr)) * W);
        }
      });
      const R1 = faceRows + 1;
      for (let r = 0; r < list.length - 1; r++) for (let q = 0; q < faceRows; q++) {
        const A = base + r * R1 + q, B = A + 1, D2 = A + R1, E = D2 + 1;
        if (side > 0) idx.push(A, B, D2, B, E, D2); else idx.push(A, D2, B, B, D2, E);
      }
    }
    // the ring of dressed stones round the arch, pale and a little proud: what makes a face read as masonry from far, and hides the meeting of face and barrel
    if (tall) for (const side of [-1, 1]) {
      const R0 = Math.max(rise, 1.5), M = 17, band = 0.95;
      for (let m = 0; m < M; m++) {
        const t0 = (m / M) * Math.PI, t1 = ((m + 0.94) / M) * Math.PI, base = pos.length / 3, tone = m % 2 ? 1.24 : 1.1;
        const pt = (th, r) => { const p = sAt(c + Math.cos(th) * (a + r)), y = spring + Math.sin(th) * (R0 + r), h = p.hw + 0.1; return [p.x + p.nx * h * side, y, p.z + p.nz * h * side, p.nx * side, p.nz * side]; };
        for (const q of [pt(t0, -0.03), pt(t0, band), pt(t1, -0.03), pt(t1, band)]) push(q[0], q[1], q[2], q[3], 0, q[4], tone, 0);
        if (side > 0) idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2); else idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      }
    }
    // the barrel under the arch
    {
      const base = pos.length / 3, q = [];
      for (let i = 0; i <= rowsAlong; i++) q.push(s0 + (s1 - s0) * (i / rowsAlong));
      q.forEach((s) => {
        const p = sAt(s), b = under0(s), t = (s - c) / a, ny = -Math.sqrt(Math.max(0, 1 - t * t));
        for (const side of [-1, 1]) {
          const h = p.hw + 0.02 * Math.max(0, p.y - b);
          // the same stone in shade, its courses still showing, and cool: the warm light from the ground would turn it another colour
          push(p.x + p.nx * h * side, b, p.z + p.nz * h * side, t * 0.8, ny, 0, 0.3, 1, 1);
        }
      });
      for (let r = 0; r < q.length - 1; r++) {
        const A = base + r * 2, B = A + 1, D2 = A + 2, E = A + 3;
        idx.push(A, B, D2, B, E, D2);
      }
      // the pier's inner faces, where the arch springs from
      for (const [s, sgn] of [[s0, 1], [s1, -1]]) {
        const p = sAt(s), bi = pos.length / 3, h = p.hw + 0.02 * Math.max(0, p.y - spring), ft = foot(s), tx = -p.nz * sgn, tz = p.nx * sgn;
        // in blocks too, and in the shade of the arch: a plain lit plane here was the biggest thing on the viaduct
        push(p.x + p.nx * h, spring, p.z + p.nz * h, tx, 0, tz, 0.42, 1, 1);
        push(p.x - p.nx * h, spring, p.z - p.nz * h, tx, 0, tz, 0.42, 1, 1);
        push(p.x + p.nx * (h + 0.3), ft, p.z + p.nz * (h + 0.3), tx, 0, tz, 0.34, 1, 1);
        push(p.x - p.nx * (h + 0.3), ft, p.z - p.nz * (h + 0.3), tx, 0, tz, 0.34, 1, 1);
        idx.push(bi, bi + 1, bi + 2, bi + 1, bi + 3, bi + 2);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aPaint', new THREE.Float32BufferAttribute(knd, 1));
  g.setIndex(idx);
  batch.add(g, true);
  // look.deck.weather also stands a buttress on each pier, proud of the face with a stepped cap: real relief, so the pen and the shade draw it (default none)
  if (tall && look.deck?.weather) {
    const but = [], bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    for (let k = 1; k < piers.length - 1; k++) for (const side of [-1, 1]) {
      const p = sAt(piers[k]), yaw = Math.atan2(p.nx, p.nz), g0 = Math.min(groundAt(p.x + p.nx * p.hw * side, p.z + p.nz * p.hw * side), groundAt(p.x, p.z)) - 2, top = p.y - 1.5, out = p.hw + 0.28, h = top - g0;
      if (h < 2) continue;
      const at = (d, y) => ({ p: [p.x + p.nx * side * d, y, p.z + p.nz * side * d], r: [0, yaw, 0] });
      but.push(place(paint(bx(pierW * 0.66, h, 0.62), look.stone.color, 1), at(out, g0 + h / 2)));
      but.push(place(paint(bx(pierW * 0.8, 0.26, 0.86), look.stone.dark, 1), at(out + 0.04, top - 0.02)));
    }
    if (but.length) batch.add(merge(but), true);
  }
  // look.deck.rail: pale pilasters and a thin green iron rail, the parapet of the bridges of the old Dolomites railway
  const railed = tall && look.deck?.rail;
  if (railed) {
    const R = look.deck.rail, pil = [], gap = 6.8, n = Math.max(2, Math.round(len / gap));
    for (const side of [-1, 1]) {
      let last = null;
      for (let r = 0; r <= n; r++) {
        const s0 = (r / n) * len, p = sAt(s0), x = p.x + p.nx * side * (p.hw - 0.05), z = p.z + p.nz * side * (p.hw - 0.05), yaw = Math.atan2(p.nx, p.nz);
        pil.push(place(paint(roundedBox(0.46, 1.24, 0.46, 0.05, 1), look.stone.color, 0), { p: [x, p.y + 0.6, z], r: [0, yaw, 0] }));
        pil.push(place(paint(roundedBox(0.6, 0.13, 0.6, 0.03, 1), look.stone.dark, 0), { p: [x, p.y + 1.26, z], r: [0, yaw, 0] }));
        if (last) {
          for (const h of [0.34, 1.0]) pil.push(paint(tube([[last[0], last[1] + h, last[2]], [x, p.y + h, z]], 0.045, 3), R));
          for (let q = 1; q < 6; q++) { const f = q / 6; pil.push(paint(tube([[lerp(last[0], x, f), lerp(last[1], p.y, f) + 0.34, lerp(last[2], z, f)], [lerp(last[0], x, f), lerp(last[1], p.y, f) + 1.0, lerp(last[2], z, f)]], 0.022, 3), R)); }
        }
        last = [x, p.y, z];
      }
    }
    batch.add(merge(pil), true);
  }
  // parapets: a low stone wall along each edge with a darker coping, tapering down at both ends; a string course below. With a rail only a kerb of it stays.
  const stepS = 2.5, runs = Math.ceil(len / stepS);
  for (const side of [-1, 1]) {
    const pts = [], pos2 = [], nor2 = [], col2 = [], kin2 = [], idx2 = [], string = [];
    const quadW = (a, b, c, d, nx, ny, nz, tone, kind) => {
      const v = pos2.length / 3;
      // the normals here are authored, so the winding has to agree or the double sided material flips them away from the sun
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
      if ((uy * wz - uz * wy) * nx + (uz * wx - ux * wz) * ny + (ux * wy - uy * wx) * nz < 0) { const t = b; b = d; d = t; }
      for (const q of [a, b, c, d]) { pos2.push(q[0], q[1], q[2]); nor2.push(nx, ny, nz); col2.push(stone[0] * tone, stone[1] * tone, stone[2] * tone); kin2.push(kind); }
      idx2.push(v, v + 1, v + 2, v, v + 2, v + 3);
    };
    for (let r = 0; r <= runs; r++) {
      const s0 = (r / runs) * len, p = sAt(s0), end = Math.min(s0, len - s0), PP = look.deck?.parapet, H = railed ? 0.22 : PP ? PP.h * smooth(0, 6, end) * (hash3(r, side, 77) < (PP.broken ?? 0) ? 0.22 : 1) + 0.1 : 0.95 * smooth(0, 6, end) + 0.2; // look.deck.parapet { h, kind, broken }: a low parapet of paint kind `kind`, gaps where it has fallen; none by default
      const lx = p.nx * side, lz = p.nz * side, inner = p.hw - 0.42, outer = p.hw + 0.06;
      pts.push({ ix: p.x + lx * inner, iz: p.z + lz * inner, ox: p.x + lx * outer, oz: p.z + lz * outer, y: p.y, H, lx, lz });
      string.push([p.x + lx * (p.hw + 0.14), p.y - 0.5, p.z + lz * (p.hw + 0.14)]);
    }
    for (let r = 0; r < runs; r++) {
      const A = pts[r], B = pts[r + 1], t = 0.96 + 0.08 * hash3(r, side, 4);
      quadW([A.ix, A.y, A.iz], [B.ix, B.y, B.iz], [B.ix, B.y + B.H, B.iz], [A.ix, A.y + A.H, A.iz], -A.lx, 0, -A.lz, t * 0.92, look.deck?.parapet?.kind ?? 1);
      quadW([B.ox, B.y - 0.3, B.oz], [A.ox, A.y - 0.3, A.oz], [A.ox, A.y + A.H, A.oz], [B.ox, B.y + B.H, B.oz], A.lx, 0, A.lz, t, look.deck?.parapet?.kind ?? 1);
      quadW([A.ix - A.lx * 0.08, A.y + A.H + 0.02, A.iz - A.lz * 0.08], [B.ix - B.lx * 0.08, B.y + B.H + 0.02, B.iz - B.lz * 0.08], [B.ox + B.lx * 0.08, B.y + B.H + 0.02, B.oz + B.lz * 0.08], [A.ox + A.lx * 0.08, A.y + A.H + 0.02, A.oz + A.lz * 0.08], 0, 1, 0, 0.74, 0);
    }
    const w = new THREE.BufferGeometry();
    w.setAttribute('position', new THREE.Float32BufferAttribute(pos2, 3));
    w.setAttribute('normal', new THREE.Float32BufferAttribute(nor2, 3));
    w.setAttribute('color', new THREE.Float32BufferAttribute(col2, 3));
    w.setAttribute('aPaint', new THREE.Float32BufferAttribute(kin2, 1));
    w.setIndex(idx2);
    batch.add(w, true);
    batch.add(paint(tube(string, 0.2, 5), look.stone.dark, 0), true);
  }
  // the ends of a tall deck stand on low stone abutments, plain dressed stone in the verge, where the deck runs back into the hill
  if (tall) {
    const ab = [];
    for (const s0 of [0, len]) {
      const p = sAt(s0), yaw = Math.atan2(p.nx, p.nz);
      for (const side of [-1, 1]) {
        const x = p.x + p.nx * side * (p.hw + 0.5), z = p.z + p.nz * side * (p.hw + 0.5);
        ab.push(place(paint(roundedBox(1.0, 3.4, 9, 0.08, 1), look.stone.dark, 0), { p: [x, p.y - 1.6, z], r: [0, yaw + Math.PI / 2, 0] }));
      }
    }
    batch.add(merge(ab), true);
  }
  // contact shade under the piers
  for (const s of piers) { const p = sAt(s); batch.blob(p.x, p.z, p.hw + 3.5, 0.45); }
}

// The gallery: a vault over the road inside a mound of earth, stone portals at each end, warm lamps down the middle.
function gallery(track, st, world, batch, look, mat) {
  const S = track.samples, n = track.n, count = ((st.i1 - st.i0 + n) % n) + 1, at = (q) => (st.i0 + q + n) % n;
  const ARC = 12, H = 8.2, stone = linear(look.stone.color), inner = stone.map((v) => v * 0.3), lawn = linear(look.terrain.meadow), grass = linear(look.road.moundColor ?? look.terrain.meadowD); // look.road.moundColor: the hill over a gallery, default the dark meadow
  // the hill's own colour by height over the ground: its foot is the field it stands in, no line where they meet
  const earth = (over, tone = 1) => { const f = smooth(0.5, 7, over); return [0, 1, 2].map((k) => lerp(lawn[k], grass[k], f) * tone); };
  // look.road.moundRock: a colour, bare rock in patches over the hill, where the hill stands for a buttress of a treeless wall; default none
  const moundRock = look.road.moundRock ? linear(look.road.moundRock) : null, rockOf = (x, z) => (moundRock ? smooth(0.38, 0.5, vnoise(x / 8, z / 8, 31) + 0.2 * (vnoise(x / 2.6, z / 2.6, 32) - 0.5)) : 0);
  const pos = [], nor = [], col = [], knd = [], idx = [];
  const groundAt = world.ground.groundAt;
  // inside: a half ellipse a little wider than the road; outside: a mound that runs down into the cut's sides
  const stride = 2;
  const rowsInner = [], rowsOuter = [], hillExtra = [];
  for (let q = 0; q <= count - 1; q = q === count - 1 ? count : Math.min(q + stride, count - 1)) {
    const i = at(q), hw = S.w[i] / 2 + 1.1, cy = S.y[i] - 0.2, row = [];
    for (let a = 0; a <= ARC; a++) {
      const th = (a / ARC) * Math.PI, c = Math.cos(th), s = Math.sin(th), xl = c * hw;
      const x = S.x[i] + S.nx[i] * xl, y = cy + Math.pow(s, 0.8) * H, z = S.z[i] + S.nz[i] * xl;
      // rings of paler dressed stone every few metres and a darker foot, so the vault reads as a railway gallery and no flat wall
      const ring = rowsInner.length % 4 === 0 ? 1.5 : 1, foot = 0.72 + 0.28 * smooth(0, 0.35, s);
      pos.push(x, y, z); nor.push(-S.nx[i] * c, -s, -S.nz[i] * c); col.push(...inner.map((v) => v * ring * foot)); knd.push(0);
      row.push(pos.length / 3 - 1);
    }
    rowsInner.push(row);
    // the hill over the vault: broad, and well past the portal's sides, so the portal is set into a forested slope and is no slab against a lawn
    const mound = [], M = MOUND, reach = hw + (look.road.moundReach ?? 30); // look.road.moundReach: m the hill over a gallery runs past the road's edge, default 30; smaller where the terrain itself is the hill
    for (let a = 0; a <= M; a++) {
      const f = (a / M) * 2 - 1, d = f * reach, x = S.x[i] + S.nx[i] * d, z = S.z[i] + S.nz[i] * d, t = Math.abs(f);
      const top = cy + H + 3.2 + 3.5 * (1 - t * t), g0 = groundAt(x, z);
      const y = lerp(top, g0 - 0.3, smooth(0.55, 1, t));
      pos.push(x, y, z); nor.push(0, 1, 0);
      { const base = earth(y - g0, 0.9 + 0.2 * hash3(q, a, 5)), rk = rockOf(x, z, y - g0); col.push(...(rk > 0 ? base.map((v, c) => lerp(v, moundRock[c] * (0.85 + 0.3 * hash3(q, a, 6)), rk)) : base)); } knd.push(0);
      mound.push(pos.length / 3 - 1);
      // spruces on it: a gallery runs under a wood
      if (a % 4 === 0 && t > 0.12 && hash3(q, a, 7) > 0.35) (world.plant ||= []).push({ x: x + 3 * (hash3(q, a, 8) - 0.5), z: z + 3 * (hash3(q, a, 9) - 0.5), kind: 'spruce', y, h: 12 + 9 * hash3(q, a, 10) });
    }
    rowsOuter.push(mound);
    // nothing else grows through the hill: only the spruces set on it
    if (q % 6 === 0) world.keepOut.push({ x: S.x[i], z: S.z[i], r: reach + 3 });
  }
  for (let r = 0; r < rowsInner.length - 1; r++) for (let a = 0; a < ARC; a++) {
    const A = rowsInner[r][a], B = rowsInner[r][a + 1], D = rowsInner[r + 1][a], E = rowsInner[r + 1][a + 1];
    idx.push(A, B, D, B, E, D);
  }
  for (let r = 0; r < rowsOuter.length - 1; r++) for (let a = 0; a < MOUND; a++) {
    const A = rowsOuter[r][a], B = rowsOuter[r][a + 1], D = rowsOuter[r + 1][a], E = rowsOuter[r + 1][a + 1];
    idx.push(A, D, B, B, D, E);
  }
  // the end of the hill: each side of the portal it comes forward and down to the ground; over the portal it stays, behind the wall
  for (const [rows, q, dir] of [[rowsOuter[0], 0, -1], [rowsOuter[rowsOuter.length - 1], count - 1, 1]]) {
    const i = at(q), hw = S.w[i] / 2 + 1.1, tx = S.tx[i] * dir, tz = S.tz[i] * dir, front = [], skirt = [];
    rows.forEach((v, a) => {
      const mR = look.road.moundReach ?? 30, d = (a / MOUND * 2 - 1) * (hw + mR), k = smooth(hw + 1.0, hw + mR * 2 / 3, Math.abs(d)), mF = 24 * mR / 30, x0 = pos[v * 3] + tx * mF * k, z0 = pos[v * 3 + 2] + tz * mF * k, g00 = groundAt(x0, z0), y0 = lerp(pos[v * 3 + 1], g00 - 0.4, k);
      // over the arch the slope comes down onto the top of the wall, so the wall is set into the hill: no gap behind it, no slab standing free
      const crown = 1 - k, x = x0 + tx * 1.4 * crown, z = z0 + tz * 1.4 * crown, g0 = groundAt(x, z), y = lerp(y0, S.y[i] - 0.2 + H + 2.4, crown);
      pos.push(x, y, z); nor.push(0, 1, 0); { const base = earth(y - g0), rk = rockOf(x, z, y - g0); col.push(...(rk > 0 ? base.map((v, c) => lerp(v, moundRock[c] * (0.85 + 0.3 * hash3(q, a, 6)), rk)) : base)); } knd.push(0);
      // and the wood comes down it, so its edge never stands bare against the sky or the field
      if (Math.abs(d) > hw + 9 && a % 4 === 0 && world.terrain.roadDistAt(x, z) > 9) world.plant.push({ x, z, kind: 'spruce', y: y - 0.3, h: 11 + 7 * hash3(q, a, 11) }, { x: lerp(pos[v * 3], x, 0.5) + 2 * (hash3(q, a, 12) - 0.5), z: lerp(pos[v * 3 + 2], z, 0.5) + 2 * (hash3(q, a, 13) - 0.5), kind: 'spruce', y: lerp(pos[v * 3 + 1], y, 0.5) - 0.3, h: 12 + 8 * hash3(q, a, 14) });
      front.push(pos.length / 3 - 1); hillExtra.push(pos.length / 3 - 1);
      // and the skirt: from that sheet down to the field, so no one ever looks up under the hill; none in front of the arch
      const hg = Math.max(y - g0, 0), sx = x + tx * (hg * 1.1 + 1), sz = z + tz * (hg * 1.1 + 1), sg = groundAt(sx, sz);
      pos.push(sx, Math.abs(d) < hw + 2.6 ? y : sg - 0.5, sz); nor.push(0, 1, 0); col.push(...earth(0.4)); knd.push(0);
      skirt.push(pos.length / 3 - 1); hillExtra.push(pos.length / 3 - 1);
      world.keepOut.push({ x: sx, z: sz, r: 4 });
      // the wood comes down the skirt too: a bare green wedge beside a portal reads as a model
      if (Math.abs(d) > hw + 5 && a % 3 === 0 && world.terrain.roadDistAt(lerp(x, sx, 0.45), lerp(z, sz, 0.45)) > 9) world.plant.push({ x: lerp(x, sx, 0.45), z: lerp(z, sz, 0.45), kind: hash3(q, a, 15) < 0.3 ? 'larch' : 'spruce', y: lerp(y, sg, 0.45) - 0.2, h: 9 + 8 * hash3(q, a, 16) });
    });
    for (let a = 0; a < MOUND; a++) {
      const A = rows[a], B = rows[a + 1], D = front[a], E = front[a + 1];
      if (dir > 0) idx.push(A, D, B, B, D, E); else idx.push(A, B, D, B, E, D);
      const dm = ((a + 0.5) / MOUND * 2 - 1) * (hw + (look.road.moundReach ?? 30));
      if (Math.abs(dm) > hw + 2.2) { const S0 = skirt[a], S1 = skirt[a + 1]; if (dir > 0) idx.push(D, S0, E, E, S0, S1); else idx.push(D, E, S0, E, S1, S0); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aPaint', new THREE.Float32BufferAttribute(knd, 1));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // a hill with bare rock on it is lit as the wall it stands for: a sheet wound the other way goes black, so all of it faces up
  if (moundRock) { const N = g.attributes.normal, seen = new Set([...rowsOuter.flat(), ...hillExtra]); for (const v of seen) if (N.getY(v) < 0.25) { const l = Math.hypot(N.getX(v), Math.max(0.25, Math.abs(N.getY(v))), N.getZ(v)) || 1; N.setXYZ(v, N.getX(v) * Math.sign(N.getY(v) || 1) / l, Math.max(0.25, Math.abs(N.getY(v))) / l, N.getZ(v) * Math.sign(N.getY(v) || 1) / l); } }
  // the hill's sheets fold on the inside of the bend: both faces drawn, so no line of sight goes through it to the far portal
  g.setIndex([...idx, ...idx.map((_, k) => idx[k - (k % 3) + 2 - (k % 3)])]);
  batch.add(g, true);

  // a stone footway on each side, over the ground that would otherwise show inside
  for (const side of [-1, 1]) {
    const strip = [];
    for (let q = 0; q <= count - 1; q = q === count - 1 ? count : Math.min(q + stride, count - 1)) {
      const i = at(q), hw = S.w[i] / 2;
      strip.push({ i, a: hw - 0.15, b: hw + 1.3 });
    }
    const p2 = [], c2 = [], x2 = [];
    strip.forEach(({ i, a, b }) => {
      for (const d of [a, b]) { p2.push(S.x[i] + S.nx[i] * d * side, S.y[i] + 0.1, S.z[i] + S.nz[i] * d * side); c2.push(...inner); }
    });
    for (let r = 0; r < strip.length - 1; r++) { const v = r * 2; x2.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); }
    const f = new THREE.BufferGeometry();
    f.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3));
    f.setAttribute('color', new THREE.Float32BufferAttribute(c2, 3));
    f.setAttribute('aPaint', new THREE.Float32BufferAttribute(p2.map((_, k) => 1).slice(0, p2.length / 3), 1));
    f.setIndex(x2);
    f.computeVertexNormals();
    batch.add(f, true);
  }

  // portals
  for (const [q, dir] of [[0, -1], [count - 1, 1]]) {
    const i = at(q), hw = S.w[i] / 2 + 1.1, cy = S.y[i] - 0.2, tx = S.tx[i] * dir, tz = S.tz[i] * dir, nx = S.nx[i], nz = S.nz[i];
    const yaw = Math.atan2(tx, tz), pieces = [];
    const local = (lat, up, out) => [S.x[i] + nx * lat + tx * out, cy + up, S.z[i] + nz * lat + tz * out];
    // the ring of dressed voussoirs, one wedge per stone along the vault's own curve, proud of the wall: square blocks set on a curve read as teeth
    const arches = 15, ringP = [], ringC = [], ringI = [], R0 = hw + 0.05, R1 = hw + 1.35, out0 = 0.74;
    const curve = (th, r) => local(Math.cos(th) * r, Math.pow(Math.sin(th), 0.8) * (H * r / hw), out0);
    for (let a = 0; a < arches; a++) {
      const t0 = ((a + 0.04) / arches) * Math.PI, t1 = ((a + 0.96) / arches) * Math.PI, base = ringP.length / 3;
      const c = linear(a === Math.floor(arches / 2) ? look.stone.dark : look.stone.color).map((v) => v * (0.94 + 0.14 * hash3(a, q, 3)));
      const back = (p) => [p[0] - tx * 1.2, p[1], p[2] - tz * 1.2];
      const A = curve(t0, R0), B = curve(t0, R1), D = curve(t1, R1), E = curve(t1, R0);
      // the face, and the soffit going back into the wall
      for (const p of [A, B, D, E, A, E, back(E), back(A)]) { ringP.push(...p); ringC.push(...c.map((v, k) => (ringP.length / 3 - base > 4 ? v * 0.6 : v))); }
      ringI.push(base, base + 1, base + 2, base, base + 2, base + 3, base + 4, base + 5, base + 6, base + 4, base + 6, base + 7);
    }
    const ring = new THREE.BufferGeometry();
    ring.setAttribute('position', new THREE.Float32BufferAttribute(ringP, 3));
    ring.setAttribute('color', new THREE.Float32BufferAttribute(ringC, 3));
    ring.setAttribute('aPaint', new THREE.Float32BufferAttribute(new Float32Array(ringP.length / 3), 1));
    ring.setIndex(ringI);
    // lit as the wall it stands in; both winding orders work, the batch's material is double sided
    ring.computeVertexNormals();
    pieces.push(ring.toNonIndexed());
    // the wall the arch is set in, dark rustic stone as on the real line: no wider than it must be, the hill takes over at its sides
    const wall = [];
    for (const sd of [-1, 1]) {
      const pier = roundedBox(2.6, H + 3.4, 1.4, 0.14, 1), [px, py, pz] = local(sd * (hw + 1.5), (H + 3.4) / 2 - 0.6, -0.05);
      place(pier, { p: [px, py, pz], r: [0, yaw, 0] });
      wall.push(paint(pier, look.stone.wall ?? look.stone.color, look.deck?.parapet?.kind ?? 1));
    }
    const over = roundedBox(hw * 2 + 5.6, 3.0, 1.4, 0.14, 1), [fx, fy, fz] = local(0, H + 1.2, -0.05);
    place(over, { p: [fx, fy, fz], r: [0, yaw, 0] });
    wall.push(paint(over, look.stone.wall ?? look.stone.color, look.deck?.parapet?.kind ?? 1));
    // the spandrels, filling the corners between the arch and the wall
    for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) {
      const th = (k + 0.5) / 8 * Math.PI, c = Math.cos(th), hgt = H + 0.2 - Math.pow(Math.sin(th), 0.8) * (H + 0.55);
      const b = roundedBox(hw * (k === 0 ? 0.26 : 0.2), hgt + 0.6, 1.3, 0.08, 1), [bx, by, bz] = local(sd * c * (hw + 1.0), H + 0.2 - hgt / 2 + 0.2, -0.05);
      place(b, { p: [bx, by, bz], r: [0, yaw, 0] });
      wall.push(paint(b, look.stone.wall ?? look.stone.color, look.deck?.parapet?.kind ?? 1));
    }
    pieces.push(...wall);
    batch.add(merge(pieces), true);
    batch.blob(S.x[i], S.z[i], hw + 6, 0.35);
  }
  // lamps inside: warm pills on the crown
  const lamps = [], lampMat = mat('#ffd9a0', { emissive: '#ffb860', emissiveIntensity: 2.4 });
  for (let q = 4; q < count - 2; q += 7) {
    const i = at(q), L = place(capsule2(), { p: [S.x[i], S.y[i] + H - 0.5, S.z[i]], r: [Math.PI / 2, Math.atan2(S.tx[i], S.tz[i]), 0] });
    lamps.push(L);
  }
  if (lamps.length) { const m = new THREE.Mesh(merge(lamps), lampMat); m.frustumCulled = true; world.staticGroup.add(m); }
}
const MOUND = 28;
const capsule2 = () => cylinder(0.18, 0.18, 1.6, 8);

export function buildStructures(track, world, batch, look, mat) {
  for (const st of track.structures) {
    if (st.kind === 'tunnel') gallery(track, st, world, batch, look, mat);
    else if (look.deck?.style === 'concrete') concreteDeck(track, st, world, batch, look, onLowerRoad);
    else archedDeck(track, st, world, batch, look);
  }
}
