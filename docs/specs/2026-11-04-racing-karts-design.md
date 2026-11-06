# Racing Karts: design and module contracts

The owner's request (04/11/2026): a cartoon kart racing game with the phone joystick architecture of Summit Descent. Mountain tracks inspired by Romania, Indonesia and the mountains of Borca di Cadore, full of real references to those places. 1 to 4 human players, or play against AI with selectable difficulty: easy, medium, very hard. Selectable karts inspired by the mountains of these maps. Power-up boxes in 3 or 4 bands along each lap: a rocket that homes on the kart ahead, grappa, țuică, mici (sausages), uova, speck e patate. Friendly style, music, sound effects, same cartoon look as Summit Descent. "Fai un bel lavoro."

This document is the shared contract. Every agent reads it first. If a contract must change, change this file in the same edit and keep it true.

## Hard rules

- ORIGINAL game. A kart racer is a genre; do not recreate any existing game. No names, characters, art, music, sounds, item designs, HUD layouts or track shapes from any existing kart game (no question-mark blocks, no banana, no shell, no blue spiked anything, no rainbow road, no mushroom). Everything here comes from the places in this spec.
- No git commit, no push, no remote, no network writes of any kind. Downloading public data (DEM tiles, docs) is fine. Do not touch `~/Developer/summit-descent`: read only.
- Only work inside `~/Developer/racing-karts`. `ref/` holds read-only copies of Summit Descent code to learn from and port; it is not bundled and gets deleted at the end. Nothing in `src/` imports from `ref/`.
- Plain JS ES modules, Node 24, three.js 0.186, esbuild, `ws`, `qrcode`, `nosleep.js`. No frameworks, no TypeScript, no CDN at runtime: the game must run on a LAN with no internet.
- Text: never use the em dash anywhere (code comments, UI, docs). UI languages Italian and English through `src/i18n`, with correct accents and diacritics (Bâlea, Făgăraș, Transfăgărășan, Țuică, Mămăligă, Căruță, Mocănița). Body text never below 13 px on any screen, big numbers, no overlaps at any width.
- No external art or audio files that need licences, with two exceptions: the paintings of real photos in `assets/backdrops/` (see Real backdrops), with their credits, and the commentators' voice packs (see Telecronaca, not cleared for a public release). All other art is procedural geometry, all music and sound is synthesised live with WebAudio. Real DEM data is Copernicus GLO-30 (credit it in `CREDITS.md`).
- Respectful references: no jokes about deaths, victims, religion or real people. Temples and churches are scenery, treated nicely, never hit by explosions, no driving through their interior. Landslides and the real natural hazards of these places ARE in the game (the owner asked for them on 04/11/2026, see Natural disasters): cartoon physics, no casualties shown, no named death tolls. Food and drink jokes are fine; grappa and țuică are cartoon power-ups.
- Comments: sparse, say why not what. Follow the code style of `ref/`.

## Quality bar

the owner, 04/11/2026: truly excellent work, at the level of the best commercial kart racers. That sets the standard of craft, never the content: the hard rule on originality stands, nothing is copied. What the standard means, and what gets judged:

- Feel: steering answers in the first frames, drifts are easy to start and satisfying to chain, every turbo is felt in speed, camera, sound and vibration, collisions never feel unfair, recovery is quick.
- Juice: every action answers at once with animation, particles, sound and phone vibration. Drivers react to what happens to them.
- Tracks: each has a memorable rhythm, a risk-reward line, a surprise, and something new to notice on the third lap. Nothing looks empty at any point of the road.
- Races: always close, with position changes up to the last corner. Item balance keeps the last place in the game without robbing the leader.
- Readability: at 60 fps, in a 4-way split, you always see where to go, what is coming and what hit you.
- Finish: menus that respond at once, smooth transitions, no glitches, no rough edges, no placeholder left anywhere.

## The look

Same family as Summit Descent: `docs/references/cartoon-b-hero.png` and `docs/references/gemini-reference-cartoon.png`. Soft, rounded, friendly, "cartoon premium"; never stiff, never PS1, never spiky.

Ingredients, all ported from `ref/summit-descent-render/` (`materials.js`, `post.js`, `palette.js`, `trees.js`, `rocks.js`, `sky.js`):
- Lambert with a wrapped smoothstep ramp (no hard terminator), light low-poly facets on the ground, painted patches for rock and snow with crisp edges, strata lines on limestone.
- Screen-space ink outlines from depth (post.js), FXAA, sRGB composite, thin dark divider between the views.
- Exponential height haze, pastel gradient sky with soft clouds. Trees are layered rounded cones with ink lines; larches go gold in autumn.
- Characters and vehicles: fat rounded shapes (spheres, capsules, lathes, rounded boxes via `src/render/shapes.js`), big glossy eyes with highlights, squash and stretch, no sharp edges. Silhouette and colour must read at 200 px wide in a 4-way split.
- The drop in Summit Descent is the target for charm: simple, shiny, alive.

Saturated, warm, sunny palette per track (see Tracks). Each track must be recognisable from one screenshot of it.

## Scale and units

Metres, `y` up. Kart length about 2.2 m, road 12 to 18 m wide (cartoon wide), base top speed 30 m/s, lap about 1400 to 2200 m and 50 to 75 s. Three laps by default. 8 karts by default on the grid. Fixed sim step 1/60 s.

## Project layout

```
server/index.js, room.js          LAN server, QR, WebSocket room (4 slots)
controller/pad.html, pad.js       phone controller
index.template.html               TV page
build.mjs
src/main.js                       boot and wiring
src/net/                          input.js, keyboard.js, ws-transport.js (4 slots)
src/data/karts.js                 kart roster (pure data): KARTS, KART_IDS, kartInfo(id)
src/data/items.js                 item roster (pure data): ITEMS, ITEM_IDS, itemInfo(id), itemName(id, lang, region), rollItem(r) (uniform), BOX_RESPAWN, ROULETTE_T
src/data/tracks.js                track index: TRACKS, TRACK_IDS, trackInfo(id), loadTrackDef(id) (async, lazy; rejects for a track not written yet)
src/world/track.js                buildTrack(def) -> Track (pure, deterministic)
src/world/terrain.js              height grid from a Track (pure, deterministic)
src/world/tracks/<id>.js          one track definition per file (pure data + small pure functions)
src/sim/                          index.js createRace, kart.js, items.js, bot.js, hazards.js, disasters.js, tuning.js, rng.js (pure, no DOM, no three)
src/render/                       index.js createRenderer, toon.js, post.js, sky.js, horizon.js, backdrop.js, terrain.js, road.js, trees.js, rocks.js,
                                  shapes.js, models.js (kart and item loaders, placeholders), showcase.js, overview.js, math.js, chibi.js, karts/<id>.js,
                                  items/<id>.js, landmarks/<trackId>.js, props.js, fx.js, camera.js, disasters.js (natural disasters, steam vents, ice patch)
dev/                              render.html, render-dev.js: a race in the real renderer, the page tools/shoot.mjs and tools/perf.mjs drive (`?track=long-test&km=10`, the synthetic long lap; `?hud=1`, the real race HUD over it)
src/audio/                        index.js createAudio, synth.js, sfx.js, engine.js, music/{cadore,romania,indonesia,menu}.js
src/ui/                           index.js createUI, style.js, icons.js, screens (lobby, kart pick, track pick, HUD, results, podium)
src/i18n/                         index.js, it.js, en.js
src/game/flow.js                  game state machine: lobby -> pick -> loading -> race -> results -> podium
data/horizon/<id>.bin + .json     baked real skyline per track (tools/bake-horizon.mjs)
assets/backdrops/                 tiles of each track's painted panorama, CREDITS.md (tools/fetch-photo.mjs, tools/paint-photo.py, tools/compose-panorama.py, tools/panoramas/, docs/backdrops-howto.md)
tools/                            fetch-photo.mjs, paint-photo.py, compose-panorama.py, panoramas/<id>.json, harness.mjs (browser launch: already patched for this Mac), shoot.mjs, playtest.mjs, perf.mjs, bake-horizon.mjs, dem.mjs, plot-track.mjs
test/*.test.mjs                   node --test
```

Coordinate with other agents through these contracts only. Do not edit files outside your task's list unless it is a one-line fix to make things work; say so in your report.

## Module contracts

### Track definition (`src/world/tracks/<id>.js`)

```js
export default {
  id: 'antelao', region: 'cadore',           // 'cadore' | 'romania' | 'indonesia'
  names: { it: 'Giro dell\'Antelao', en: 'Antelao Loop' }, blurb: { it: '...', en: '...' },
  // closed loop, clockwise or not, control points of a Catmull-Rom spline, first point on the start line, driving direction 0 -> 1 -> ...
  // p: [x, y, z]; w: road width (m); bank: degrees the road leans INTO its turn whichever way it turns, negative is off camber (the builder signs it and fades it by curvature)
  // surface: 'asphalt' | 'dirt' | 'sand' | 'snow' | 'ice' | 'wood' | 'cobble'; the surface of a point holds until the next point; tag: optional landmarks for code ('bridge', 'viaduct', 'tunnel', 'jump', 'hairpin')
  // A run of consecutive points tagged 'bridge', 'viaduct' or 'tunnel' is a structure from the first to the last: bridge and viaduct are decks, the terrain stays open under them.
  points: [ { p: [0, 0, 0], w: 16, bank: 0, surface: 'asphalt', tag: null }, ... ],
  // long: true or { bandEvery, groundNear, roadNear, statics, detail, water, release }: a track of 5 to 10 km, see Long tracks. Absent on the short ones, which behave as if none of it existed.
  // Item box bands: 3 or 4 along the lap, at fraction u in [0,1) of the lap. A long track leaves this out and gets one about every 500 m.
  itemBands: [0.12, 0.38, 0.63, 0.86],
  boostPads: [ { u: 0.5, offset: 0 } ],      // offset in road half widths
  jumps: [ { u: 0.3, strength: 1 } ],        // ramp at u, launches karts
  zones: [ { from: 0.2, to: 0.3, surface: 'ice' } ],
  shortcuts: [ { from: 0.41, to: 0.47, points: [...], surface: 'dirt', w: 7 } ],     // optional side path, a real risk or reward; lap counts stay valid
  hazards: [ { kind: 'cows', u: 0.55, width: 1, period: 9, phase: 0 } ],             // dynamic, deterministic, see hazards.js
  disasters: [ { kind: 'debris', u: 0.742, side: -1, name: 'Colata di Cancia', say: { it: '...', en: '...' } } ],   // see Natural disasters
  sacred: [ { u: 0.97, d: 38, r: 30 } ],      // protected places, nothing is ever thrown at them: { u, d, r } or { x, z, r }
  ground: { base: 0, hills: 26, hillScale: 240, rimHeight: 140, rimFrom: 520, rimTo: 1100, water: null,      // terrain builder inputs; water: a level (y) or null; dry: true keeps the natural ground above water outside the river channel, so ground.shape may dig the valley out, and may leave rim corners lower; displayRise (default 0.115): how fast the drawn rim may climb with distance from the road
    shape: (x, z) => 0,                       // optional: broad relief added to the natural ground (a valley side, a spur, a caldera)
    river: { points: [[x, z], ...], w: 22, depth: 2.5 } },                       // optional: a channel below `water`, only decks may cross it
  grid: { spacing: 4 },                       // m per terrain node
  horizon: { center: [46.437, 12.218], northDeg: -61, exaggerate: 1, scale: 18, altitude: 919 },      // real place of the track origin; true bearing of -z (a free choice: it turns the whole road against the real mountains); real altitude of y = 0
  backdrops: [ { file, width, summit: { name, lat, lon, altitude, u, row }, elevation, compressed, baseHaze, mist, edge, rise, sky } ],  // see Real backdrops; bearing + elevation + row instead of summit for a view with no one summit
  look: { /* palette, sun, fog, sky colours: see render/toon.js and ref/.../themes */ },
  music: 'cadore',
  landmarks: 'antelao',                       // src/render/landmarks/antelao.js
};
```

### `src/world/track.js`

`buildTrack(def) -> Track` is pure and deterministic. It samples the closed spline every 2 m.
```
Track = {
  def, n, length, step,      // step = length / n, 2 m to within a millimetre
  samples: { x, y, z, tx, tz, nx, nz, w, bank, surface, struct } // Float32Arrays length n (surface: Uint8Array index into SURFACES; struct: Uint8Array index into STRUCTS, none bridge viaduct tunnel), (tx,tz) unit tangent, (nx,nz) = (tz,-tx) unit left normal, bank: signed degrees, + is left edge lower
  SURFACES, curvature,                                              // Float32Array 1/m, + turning left
  pointAt(u) -> {x,y,z,tx,tz,nx,nz,w,i},
  nearest(x, z, hint?) -> { i, f, d (signed lateral m, + left), u }, // i nearest sample, f fractional sample (= u * n); hint: previous i, searches 64 m each way so overlapping levels (bridge over road) stay right
  surfaceAt(i), heightAt(i, d),                                     // road surface height at a lateral offset, with bank; d clamps at the edges. Pass the fractional f: integer i steps 0.2 m apiece on a 10% grade
  structureAt(i) -> null | 'bridge' | 'viaduct' | 'tunnel',
  structures: [{ kind, i0, i1, from, to, length }], markers: [{ tag, u, i, point }], pointU,  // pointU[j]: u of control point j, for placing things by hand
  bands: [{ u, i, band, boxes: [{x,y,z}] }],                        // y is the crate's centre, 1.1 m over the road
  pads: [{ u, i, x, y, z, tx, tz, nx, nz, w, yaw, offset, d }], jumps: [{ u, i, x, y, z, tx, tz, nx, nz, w, yaw, strength }],
  shortcuts: [{ index, from, to, surface, w, n, length, step, samples, curvature, pointAt, nearest, surfaceAt, heightAt }], startGrid(8) -> [{x,y,z,yaw,d,i}],  // array order is grid order
  racingLine: { d, x, z, k },                                       // Float32Arrays length n: lateral offset, position, signed curvature of the line
}
```
Yaw, everywhere: `yaw = atan2(tx, tz)`, forward is `(sin yaw, cos yaw)`, so a model built facing +z takes `rotation.y = yaw`. A jump's road carries a small kicker (0.8 m times strength); the launch itself is the sim's. Tools: `tools/plot-track.mjs <id> <out.png>` plots a track from above and in profile and prints the `pointU` of every control point; new tracks should be judged on it.
Overlaps are allowed only when two road parts differ by at least 6 m in height; `nearest` with a hint keeps a kart on its level.

### `src/world/terrain.js`

`buildTerrain(track) -> Terrain` pure and deterministic: fills a Float32Array grid (`def.grid.spacing`, covering the track bounding box plus `rimTo`) from fbm hills, a raised rim far from the road so the world closes into mountains, and the road carved flat with a smooth shoulder. Provides `heightAt(x, z)` bilinear, `normalAt(x, z, out?)`, `w, h, x0, z0, step, data`, `roadDist` / `roadDistAt(x, z)` (m from the nearest road edge, 0 on the road, capped at 112: keep trees and props off the shoulder with it), `water` and `waterLevel` (the same value, from `def.ground.water`, or null), `river` (`{xs, zs, w}` or null). Must take under 300 ms per track. Sim and renderer use the same object, so the ground the kart rolls on is what is drawn.

Rule: the road is never under terrain, and tree-free shoulders are at least 4 m wide.

### Sim (`src/sim/`)

Pure, deterministic: the same seed and inputs give the same result on every run, no `Math.random`, no `Date`. Runs in Node for tests.

```js
const race = createRace({
  track, terrain, seed,
  laps: 3,
  players: [ { slot: 0, kart: 'tabia', human: true, name: 'P1' }, { slot: -1, kart: 'jeep', human: false } ],  // grid order is array order
  difficulty: 'easy' | 'medium' | 'hard',
});
race.step(inputs);   // inputs[playerIndex] = { steer: -1..1, throttle: -1..1, item: bool, drift: bool }; humans only (bots drive themselves); dt fixed 1/60
                     // steer + is right. throttle >= 0 is full auto throttle (over 0.5 at the press of USE ITEM also throws polenta ahead), below 0 it lifts, at -0.35 and below it brakes, then reverses. A missing input (undefined) means the phone is gone: the kart coasts to a stop.
race.state           // plain data, below, mutated in place: clone it (structuredClone) to keep the previous step
race.drainEvents()   // [{ type, kart, ...}] since the last drain; createRace already queues the first countdown event
race.autopilot(i)    // the input the bot brain would give kart i, for tools and tests filling a human slot
race.teleport(i, u, d, { speed, lap, yawOffset }), race.give(i, itemId), race.rescue(i), race.disaster(entry)     // scripted setups, tests and tools only; disaster starts def.disasters[entry] now
```
Options: `countdown` (default 3, 0 starts racing at once; tests use it); `players[i].difficulty` overrides `difficulty` for one kart, `'ace'` is a good driver with no rubber band for a human slot on autopilot. `phase` becomes `done` when all karts finished, or with humans in the race 30 s after the leader once no human is still racing; the sim keeps stepping (finished karts drive on by themselves, slowly, immune and not colliding).

```
state = {
  t, phase: 'countdown' | 'race' | 'done', countdown: 3.0, laps,
  karts: [{
    i, slot, kart (id), human,
    x, y, z, yaw, pitch, roll, vx, vy, vz, speed, grounded, airT,
    steer, throttle,               // the applied inputs, for the wheels and the driver's lean
    trackI, u, d, lap, progress,   // d: signed lateral m on the main road, + left; lap: laps done, so the HUD shows lap + 1 of laps; progress = laps done + u, just under 0 behind the start line; place 1..8
    place, finished, finishT, lastLapT, bestLapT, wrongWay,        // finishT counts from go
    surface, offroad, shortcut,    // surface: a road surface or 'grass' (off the road, unless the road is sand, snow or ice, or def.ground.surface says); shortcut: its index or -1
    drift: -1|0|1, driftT, driftTier: 0|1|2|3,                     // drift has the sign of steer: + is sliding through a right turn
    boostT, boostKind: null|'pad'|'drift'|'grappa'|'zuica'|'uova'|'sambal',
    item: null | itemId, itemCharges, rouletteT,   // what is held; while rouletteT > 0 the box's item is still spinning and item stays null (the item is in the boxTake event)
    orbit: 0..3,                   // mici orbiting
    bigT, tipsyT, stinkT, sootT, rendangT, hitT, hitKind: null|'spin'|'tumble',     // sootT: burnt by the sambal, black smoke; rendangT: the pot's smell is pulling
    safeT,                         // brief immunity after a hit
    rescueT,                       // being carried back to the road
  }],
  boxes: [{ id, x, y, z, up: bool, band, respawn }],
  shots: [{ id, kind, x, y, z, yaw, vy, owner, t, target, ... }],    // razzo (sweep: true from first place), mici, formaggio (dir: 1 forward, -1 back), rendang (rides over its owner), and with lob: true a polenta or durian in the air on its way to its spot; target: kart index or -1; yaw is the way it flies
  spills: [{ id, kind, x, y, z, r, t, ttl, owner, i, d }],           // polenta, durian, sambal fire, frana (warn: s of falling, harmless with a shadow on the road, then a rock that bursts on contact)
  hazards: [{ id, kind, role, x, y, z, yaw, t, phase, active, warn, i, d, vd, r, h }],  // one entry per animal or vent: role null, 'dog' (with the sheep) or 'pony'; phase 0..1 through its cycle; warn: telegraphing; active: it can hurt now (crossers always can, active says they are moving); h: bats' height over the road, steam column or bear standing height, 0 when quiet; cleared: scattered off the road by the leader's razzo for one cycle
  disasters: [{ id, entry, kind, name, say, phase: 'warn'|'strike'|'after', t, warn, strike, after, c, len, side, gapW, gapD, gapAmp, gapWave, free, flow, speed, source, front, stop, open, ash, shake, x, y, z, lane, pieces: [{ role, st, x, y, z, gx, gy, gz, r, t, ... }] }],   // see Natural disasters; side: the side of the road it comes from; disasterGap(D, along) is the free lane, m left of centre; lane: where the free lane is, +1 left, 0 centre, -1 right
  quake: 0..1, ash: 0..1,             // how hard the ground shakes and how thick the air is now
}
```

Angles: `yaw` + turns left; `pitch` + is nose up (`rotation.x = -pitch` on a +z model); `roll` + is left side down (`rotation.z = -roll`). A spin is `yaw` turning through `hitT`, a tumble is `pitch` going round: both come back to where they started.

Hazards from `def.hazards` entries `{ kind, u, width, period, phase }`: `kind` is one of `cows`, `sheep` (flock and dog), `bear` (at the roadside, stands up into the road; `side` +1 left or -1 right), `sledders`, `ice` (a slippery patch of 40 m times width, grip of the `ice` surface), `bats`, `steam` (vents erupting in turn), `ponies`, `macaques` (steal the held item; with nothing held, a slide). An unknown kind throws. `u` is the middle of the group, `width` scales the group (default 1), `period` is seconds per cycle (default 9), `phase` a fraction of a period (default 0). Crossers come back the other way on the next cycle. `hit` events from them have `by: -1` and `cause` = the kind.

`hit {kart, by, kind, cause}`: `kind` is `spin` or `tumble`, or for what does not throw you about, `slide` (polenta, a macaque with nothing to steal), `stink` (durian), `steal` (with `item`). `cause` is the item or hazard. `by` is a kart index or -1.

Events: `countdown {n}`, `go`, `boxTake {kart, item}` (item null: already holding one, only a sound), `itemUse {kart, item}`, `boost {kart, kind}`, `driftTier {kart, tier}`, `driftStart {kart, dir}`, `driftEnd {kart, tier}`, `hit {kart, by, kind, cause}`, `shield {kart}`, `bump {a, b, force}`, `wall {kart, force}`, `jump {kart}`, `land {kart, force}`, `lap {kart, lap}` (laps done), `lastLap {kart}`, `finish {kart, place, time}`, `boom {x, y, z, kind, yaw?}` (kind: razzo, mici, sambal with its yaw, frana, rock, clear, polenta, durian, and from a disaster boulder, log, bank, snow, bomb, tile), `hazardNear {kart, kind}` (also `frana`, for whoever is on that stretch), `rescue {kart}`, `overtake {kart, place}`, `steal {kart, from, item}` (rendang), `disaster {phase: 'warn'|'strike'|'end', id, kind, x, y, z}` (on warn also `entry, name, say, lane, warn`; lane null when no lane matters).

Handling: arcade and generous. Automatic acceleration in a race (`throttle` from the stick's y only lowers it: stick down brakes then reverses). Steering speed depends on the kart. Hold drift to hop and slide: charge tiers at 0.7 s, 1.4 s and 2.2 s give a mini turbo on release (longer per tier). Offroad slows by surface, ice lowers grip, sand drags. Kart to kart bumps push by weight. Walls: invisible soft barrier at the shoulder edge where the terrain gets steep; a glancing touch redirects with little speed loss. Falling in water or off the world: `rescueT`, carried back to the road by a friendly animal (a stork, `src/render/models.js`; never a copy of anything), about 2 s lost.

Bots (`bot.js`): follow the racing line (precomputed by smoothing the centre line across the width, per track), steer with a PID on lateral error plus look-ahead, drift on real corners, use items with intent, avoid spills and hazards, and head for a disaster's free lane once it is within sight (`see` in `DIFFICULTY`: easy 34 m, medium 72 m, hard 120 m; so an easy bot gets caught and a hard one almost never).

| Difficulty | Speed cap vs player's kart | Mistakes | Items | Rubber band |
|---|---|---|---|---|
| `easy` | 0.91 | often wide, brakes in corners, ignores shortcuts | late, wasteful | gentle: waits for you |
| `medium` | 0.94 | sometimes | sensible | light |
| `hard` (Difficilissimo) | 0.965 | almost never, drifts every corner, tier 2+ turbos | held and timed: razzo when close, uova when under pressure, shields with mici | catches up and never waits |

Caps changed on 06/11/2026 from a first guess of 0.84, 0.94, 1.02, measured against scripted drivers: `docs/progress/balance.md`.

Bots must finish three laps on every track at every difficulty with no kart stuck more than 4 s (a test enforces it).

### Karts (`src/data/karts.js`)

Stats 1..5: `speed`, `accel`, `handling`, `weight`, `offroad`. Sum of each kart's stats is 15 so no kart is strictly best. `tuning.js` maps them to physics. A driver with a name, a personality line, colour and a voice pitch for little sounds.

| id | Region | Name | Driver | Concept |
|---|---|---|---|---|
| `tabia` | cadore | Il Tabià | Bepi the marmot | A little Cadore wooden barn on wheels: larch boards, shingle roof, geraniums at the window, hay |
| `gatto` | cadore | Gatto delle Nevi | Toni the chamois | A chubby red piste groomer, rubber tracks, front blade, tiller at the back |
| `seggiovia` | cadore | Seggiovia | Nane the ibex | A two-seat chairlift chair on a go-kart frame, the big bullwheel at the back, a safety bar |
| `mocanita` | romania | Mocănița | Ursu the Carpathian bear | The little black and red steam loco of the Vaser valley in Maramureș (black boiler, domes, cab, tender and funnel; red frame and wheels with white rims; the carriages are the green part), big cone funnel, the winged logo in white on the side and on the back of the tender, puffs of smoke |
| `caruta` | romania | Căruța | Oița the sheep, with Murgu the horse | The typical Romanian horse cart: a long trough of weathered planks leaning out on stakes with a top rail, iron-tyred wooden wheels, smaller in front, a low bed of hay, a painted folk tailboard (the licence, for the chase camera). Pulled by a plump dun horse with the red pompom harness and four jointed legs that walk, trot and gallop with the kart's speed, lead the turn on the shafts, rear on a hit and to cheer, stretch out in a jump. The sheep sits off to one side of the bench so the camera sees him past her, and holds the reins (the horse asked by the owner) |
| `logan` | romania | Logan vecchissima | Vlăduț the bat | A very old, battered Logan saloon of 2004 to 2008, squashed chubby, three real boxes: bonnet, hollow cabin with a square roof and wide rear pillars, flat boot. Recognised from behind, how it is seen all race: tall lamps red over amber over white on the corners, one taped; the wide dark strip across the bumper; the plate low under it. A blue door from another car that will not shut, rust, tape, a boot lid on a rope that bounces, a roof rack piled with sacks, a fat exhaust coughing soft puffs (`fx.js`), hanging on by miracle, no badge (asked by the owner; replaces the Bran tower kart) |
| `jeep` | indonesia | Jeep Bromo | Budi the macaque | A faded, sun-worn tourist 4x4 of the Tengger sand sea, roof rack, spare wheel, generic design, no brand |
| `becak` | indonesia | Becak | Tokek the gecko | The three-wheeled pedal cab of Java: passenger bench in front between two wheels, the driver behind over the single rear wheel, folding hood, vivid painted panels, a bell |
| `jukung` | indonesia | Jukung | Komo the Komodo dragon | A Balinese outrigger fishing boat on wheels: fish-snout prow with painted eyes, bamboo floats on S-curved booms, crab-claw sail in bold colour blocks |

The kart builders live in `src/render/karts/<id>.js` and export `build(ctx) -> KartModel` (or a default export), sync or async. `ctx` is `{ THREE, mat, shapes }`: `mat(color, opts)` returns a toon material sharing the scene's uniforms, cached so karts share programs (opts: `gloss: [power, amount]`, `rim: [amount, power]`, `vertexColors`, `side`, `emissive`, `transparent`, `opacity`); `shapes` has `box, roundedBox, capsule, sphere, cylinder, cone, torus, lathe, tube, gable, quad, place, paint, merge`. `KartModel` is `{ group, wheels?, body?, driver?, update?(kartState, dt) }`, front towards +z, wheels on the ground at y = 0. A built kart (`src/render/karts/_kit.js` `createRig`) is one `SkinnedMesh`, one draw call: wheels, driver and every moving bit are bones, so `wheels` holds bones with rotation order `YXZ`. It also has `tris`, `bones`, `dispose()`; the mici in orbit (`kartState.orbit`) and the dizzy stars and stink wisps belong to the kart's own mesh. `kartState.pose`, for tools, the pick screen and the podium, forces a reaction with no sim behind it: `cheer`, `sad`, `hit`, `drift`, `boost`, `air`, `tipsy`, `stink`, `leanL`, `leanR`, `soot` (burnt by a sambal: a black mask takes the place of the head's skin, fur singed, from `sootT`), `lick` (the tongue goes round the lips, eyes half shut, from `rendangT` and for 2.6 s on a kart the pot robbed, `sense.lickT`), `sip` (a bottle at the mouth for 0.8 s as a grappa or țuică boost starts), `big` (the iron pan of the uova with its fried eggs, tipped towards the chase camera, on the head or on the roof, spec `panTop`, from `bigT`); a finished kart cheers (place 1 to 3) or sulks (6 and over) by itself. Wheels in `wheels` are spun round x by the renderer, those with `userData.front = true` also steered round y; the renderer also does yaw, pitch, roll, squash on landing, flames, the gold glow and the blob shadow. `kartState` is the sim's kart, interpolated. A kart whose tall flat part can fill a chasing camera may set `model.viewClose(dist, own)`: `models.js` asks it per view just before the view draws (bones are read at each render, so views can differ); the jukung's sail drops onto the deck for a camera right behind. A kart with no file yet falls back to a rounded placeholder in its colour (`src/render/models.js`), and so does one whose build throws. `src/render/chibi.js` `chibi(rig, spec)` builds the rounded animal drivers from a spec (head, torso, ears, muzzle, eyes, arms, wings, colours, `extra` for horns or wool) with poses (lean, drift, boost, air, hit, cheer, sad, tipsy, stink), blinking and looking into the turn. Under 3500 triangles each with its driver; share materials and merge geometry. They read well in a 4-way split. They must each look delightful in a close-up on the pick screen.

### Items (`src/data/items.js`)

One item at a time. Taking a box while holding one does nothing visible except a sound. Roulette of about 1.2 s on the HUD and phone.

Assignment is completely random (the owner, 04/11/2026): uniform across all eleven items, for every place, humans and bots alike, from the seeded sim RNG. No odds by place, no rubber banding through items. Each item gives a different power, original and useful in its own way; none may be strictly better or a dud, in any race position. An item that makes little sense for the current position still has a real use there (see the table).

| id | Name | Effect | Use from the front | Use from the back |
|---|---|---|---|---|
| `razzo` | Razzo | Fired forward, flies along the road and homes on the kart immediately ahead of you. Hit: tumble. Readable long flame, whistling | In first place it flies a full road length and clears any hazard, shot or spill it meets | Takes out the kart just ahead |
| `grappa` | Grappa | Big boost for 2.6 s, then 1.5 s of tipsy wobbly steering | Pulls away | Catches up |
| `zuica` | Țuică | Three sips: each press a short boost (1.1 s), timed by you | Saved for exits and jumps | Three chances to take a shortcut |
| `mici` | Mici | Three grilled sausages orbit the kart and block one hit each. Press to throw one straight ahead (from first, straight back at the chasers): it bounces once off walls, hit is a spin, and it never hurts its thrower | Shield | Ammunition |
| `uova` | Uova, speck e patate | One dish: a sizzling iron pan of fried eggs, speck and potatoes. For 5 s the kart grows, goes very fast and barrels through others knocking them away, immune to hits, with no offroad slowdown | Nothing can touch you for 5 s | Bowls through the pack |
| `polenta` | Polenta (Mămăligă in Romania) | Drop a sticky yellow puddle behind you, stick up throws it far ahead. Slows and slides whoever crosses it | Defends the racing line | Thrown ahead at the pack |
| `formaggio` | Forma di Formaggio | A big wheel of mountain cheese rolls BACKWARD down the road along the centre line and bowls over chasers | Bowls over the chasers | Stick up rolls it forward along the road instead |
| `durian` | Durian | A stink cloud behind you for 7 s across most of the road: whoever enters has wobbly steering and slows | Blocks the road behind | Stick up lobs it ahead onto the leaders |
| `sambal` | Sambal | So spicy that the kart lets out a mega fart of fire backward (a huge cartoon flame burst with a rude trumpet sound, then 3 s of boost and a burning trail). Whoever is caught is burnt: spins with a sooty face | Roasts the chaser on your tail | Boost, and roasts whoever you pass |
| `rendang` | Rendang | A clay pot of rendang whose smell nobody can resist: for 4 s a pull drags you toward the kart ahead and slows it a little; on contact you steal its item and it spins, licking its lips | In first place, the pull works on the item boxes in reach and refills your slot | Reels in the kart ahead and steals from it |
| `frana` | Frana | A landslide drops onto the road just ahead of the kart in first place, with a shadow warning and rumble, and leaves rocks to dodge. Temples and churches are never touched | In first place it falls behind you, onto the second | Hits the leader |

Item models live in `src/render/items/<id>.js`, same `build(ctx)`, returning `{ group, update?(group, itemState, dt) }`, where `group` is the live clone for that shot or spill; with no file, a rounded placeholder. Grappa, țuică and uova have no shot or spill in the sim on purpose (bots would dodge one and a razzo would pop it): `models.js` shows their models on `itemUse` as cosmetic objects the sim never sees, the empty bottle thrown over the shoulder after the sip (a plum between sips of țuică, the bottle at the last) and the pan falling on the driver's head. A spill's model has radius 2 m at scale 1 (the pool scales by `r / 2`); `update` keeps fruit and pots their own size inside it and shows flames or a cloud when the state has `ttl`.

`race.step`'s stick up at the press (throttle over 0.5) throws polenta and durian ahead in an arc (`lob`, 0.75 s) and rolls the formaggio forward. The leader's razzo flies `track.length / v` s. Frana: `FRANA.warn` 2.2 s of warning, rocks in all lanes but one, never inside a tunnel. Numbers in `src/sim/tuning.js`.

Boxes: wooden market crates with a coloured ribbon and an embroidered star motif, rotating, soft glow; not a floating block with a symbol. Respawn after 6 s. Band of 5 boxes across the road. Each item gets a 3D model (`src/render/items/<id>.js`, small and charming) and an SVG icon (`src/ui/icons.js`), the same icon on TV and phone.

### Tracks

Six tracks: two per region. Each has a distinctive shape, at least one elevation feature (climb, drop, jump or bridge), a dynamic hazard and strong landmarks. Real horizon: the skyline comes from the real DEM around the real place (see Horizon).

| id | Name | Place, real references to verify in `docs/references/` | Mood | Dynamic hazard |
|---|---|---|---|---|
| `antelao` | Giro dell'Antelao | Borca di Cadore (Belluno), SS51 di Alemagna, Boite valley. Monte Antelao 3264 m and Pelmo 3168 m on the real horizon. Tabià barns, the former railway now the Ciclabile delle Dolomiti (viaduct + short gallery), the Corte di Cadore ex-ENI village by Edoardo Gellner with its A-frame modernist church Nostra Signora del Cadore (Gellner with Carlo Scarpa) among the pines, bridge over the Boite, the bell tower of the parish church Santi Simone e Giuda | Golden autumn, late sun, larches on fire | Cows with big bells cross the road on their way down from the pasture |
| `pelmo` | Pelmo d'Inverno | Passo Staulanza, Forcella Cibiana, Rifugio on the snow, the Pelmetto boulder with real dinosaur footprints (in reality 1.7 km from the pass on foot, 2050 m; bring it to the road as a big cute dinosaur footprint rock), Pelmo's armchair shape, which is what its nickname ‘Caregón del Doge’ means, ski lift pylons, wooden sleds | Crisp blue winter, snow, sun | Ice sections and sledding kids (rounded, cute, animal kids) crossing the piste |
| `transfagarasan` | Transfăgărășan | Făgăraș mountains: Bâlea Lac, the cabana on the lake, the Capra-Bâlea tunnel (887 m) at the top, the famous stack of hairpins and viaducts, Văiuga and the wall of Vânătarea lui Buteanu on the horizon, seen from the lake itself (`horizon.center` 45.6035, 24.6160; Moldoveanu is truly hidden from there and is not in the picture, see `references/transfagarasan.md`), shepherd sheep and Carpathian sheepdogs, roadside covrigi and honey stalls | Summer morning, green and grey rock | Sheep flock crossing with a shepherd dog; a brown bear at the roadside that stands up (never shown being fed: feeding bears is a real, fined problem) |
| `bran` | Bran sotto la Luna | Bran Castle on its rock, Saxon village houses and fortified church forms from the Brașov area (Hărman, Prejmer; a cartoon mix, not Bran itself), Piatra Craiului and Bucegi on the horizon (`horizon.center` 45.505, 25.3175, see `romania.md`), the Sphinx and Babele rock forms of Bucegi as a set piece beside the road (they do not show on the real horizon), wooden gate of Maramureș style, lanterns | Friendly night, huge moon, teal and violet with warm windows, no gore, no horror | Bats swoop down in waves across the road |
| `bromo` | Mare di Sabbia | Tengger caldera, East Java. Sand sea, Gunung Bromo's steaming crater and its stair, the fluted cone of Gunung Batok, Pura Luhur Poten temple, Tenggerese ponies, faded jeeps, Semeru 3676 m puffing on the horizon (hidden from Pura Luhur Poten: `horizon.center` is -7.916, 112.953, under the north wall, where Bromo, Semeru and Batok stand in one frame, see `references/bromo.md`) | Sombre dawn, charcoal sand, mist on the floor | Grey fumaroles erupt in rhythm (the real sulphur is in the crater, never yellow on the sand), ponies with riders cross |
| `bali` | Terrazze di Bali | Tegallalang rice terraces, Pura Ulun Danu Beratan with its 11-tier and 3-tier meru on islets in the lake, split gate candi bentar, penjor bamboo poles, Gunung Batur and Agung 3031 m (3142 m in some sources) on the horizon, seen from the terraces above Muncan on Agung's south flank (-8.41, 115.45: from Tegallalang itself Agung is only 5.4 degrees high, see docs/references/bali.md), coconut palms, offerings | Lush green midday, turquoise water, white clouds | Cheeky long-tailed macaques run across and can steal your item |

Each landmark file (`src/render/landmarks/<trackId>.js`) builds big, unmistakable, cartoon versions of these places placed by hand along the road, with their own props (trees, houses, animals, flags). Facts come from `docs/references/*.md`. Merge static geometry; use instancing for repeats. The file exports `plan(ctx)`, run before the ground exists, which fills `ctx.world.keepOut` `[{x, z, r}]`, `groves` `[{x, z, r, cover, kinds: [[name, share]...]}]` (cover from -1, open meadow, to +1, thick wood) and `plant` `[{x, z, h, kind}]`; `build(ctx)`, run after, with `ctx.batch.add(geometry)`, `ctx.batch.blob(x, z, r, alpha)` for contact shade, and `ctx.world.ground.groundAt(x, z)`; optionally `update(time, dt, karts)`. `ctx` is `{ THREE, track, terrain, look, batch, mat, shapes, world }`. No file means no landmarks, not an error.

### Natural disasters (phase 2)

Asked for by the owner on 04/11/2026: landslides and real disasters. Each track gets, on top of its hazard above, the real natural hazard of that place as a big set piece. Telegraphed (rumble, dust, a warning sign, a sound) at least 2 s before it reaches the road, dodgeable, deterministic in the sim, with a local name on the sign and on the HUD. A hit is a tumble, nothing worse.

| Track | Disaster | What happens |
|---|---|---|
| `antelao` | Colata di Cancia, frana dall'Antelao | A debris flow of mud and boulders comes down a gully and crosses the road, leaving rocks and sticky mud for the rest of the lap |
| `pelmo` | Valanga | An avalanche sweeps across the piste and leaves a snow bank to drive around or burst through |
| `transfagarasan` | Valanga di Bâlea, caduta massi | Rockfall bounces down onto the hairpins; a snow slide at the Bâlea cirque |
| `bran` | Cutremur di Vrancea | An earthquake: the screen shakes, steering wobbles, roof tiles and rocks fall, a crack opens in the road and closes |
| `bromo` | Eruzione del Bromo, nube del Semeru | Ash cloud that cuts visibility, lava bombs landing with a shadow marking the spot |
| `bali` | Lahar del Gunung Agung | A mudflow pours through the terraces across the road; ash in the air |

The `frana` item is in the Items table.

The engine is `src/sim/disasters.js` (what happens) and `src/render/disasters.js` (how it looks); a track only writes data. All kinds work on any road, so a track can have any of them.

| `kind` | warn, strike, after (s) | On the road | Look | Sound (`DISASTER_SOUND`) |
|---|---|---|---|---|
| `debris` | 3, 3.8, 55 | A flow crosses from `side` at 11 m/s and stops short of the free lane; boulders and logs, mud stays: sticky, not a dead end | Brown river, smoke balls, a gully down the hill | `disasterDebris`: wet rumble, stones, mud slaps |
| `avalanche` | 3.2, 3.2, 50 | A flow at 17 m/s; snow banks stay, burst through them at a cost in speed, no tumble | White, cold palette | `disasterAvalanche`: a whumpf and rushing powder |
| `lahar` | 3.4, 9, 45 | A slow, long flow at 7 m/s with a boulder head; mud stays; a little ash | Grey brown river | `disasterLahar`: thick bubbling river |
| `rockfall` | 2.6, 3.6, 40 | Boulders fall outside one free lane, each with a shadow and a closing ring first | Rocks on arcs | `disasterRockfall`: a slowing bounce you can count |
| `quake` | 2.6, 5.5, 8 | Tiles and rocks fall, a crack opens and closes, steering wobbles (`QUAKE_WOBBLE`), the free lane is clear | Camera shake, wobbling lanterns | `disasterQuake`: low shudder and rattling |
| `eruption` | 3, 8, 16 | Lava bombs land with shadows either side of a lane that weaves (`wave`, m); ash cuts the view | Ash fog and flakes, glowing bombs, a far column | `disasterEruption`: a deep bang, a roar, crackle |
| `cloud` | 3, 14, 30 | Nothing on the road: far away, a little ash | A plume on the horizon | `disasterCloud`: far thunder, no attack |

The warning is the same for all, and at least 2 s long, and the marks on the road too: a sign on posts before the site with the local name, a darkening shadow with stripes, a dashed lane edge and chevrons over the free lane, the HUD banner in big type with an arrow, a triangle on the minimap, `disasterAlarm` and `disasterRumble`, and a rumble on every phone. A hit is `hit {kart, by: -1, kind: 'tumble', cause: kind}`; a kart gets up on its own with no rescue, in under 6.5 s, and a flow throws it only once. Mud, the wobble and a burst snow bank are a slide or less. A kart 2.4 m in the air clears a flow.

Timing: the sim plans them from its own seeded stream, so nothing else in the race changes. `disasterCount`: a race of 1 or 2 laps gets 1, 3 or 4 laps get 2, 5 or more get 3, a long track one per 3.5 km up to 3, spread out across windows of the race from 0.3 laps in to just before the flag, with at least 14 s of quiet between them. Each is timed on a kart: the leading human on even slots, the last human on odd ones, the leader with no human, so people see it happen. A track with several entries gets them in a shuffled order.

For the rest of the game: `world.quake` and `world.ash` (0..1) are on the renderer's world for landmarks to use; `planDisasters(world)` keeps trees and props out of the gully; a road 6 m above or below the site is not in it. `?disasters=<json>` and `?hazards=<json>` on the game page and `dev/render.html` replace the def's lists, for trying a kind on any track; `game.disaster(entry)` starts one now.

#### How to add a disaster to a track

Add to the track's def, and nowhere else:

```js
disasters: [{
  kind: 'avalanche',             // from the table above
  u: 0.3,                        // the middle of the place on the lap; on open road, not in a tunnel, and a flow not on a bridge or viaduct either: all of those throw
  side: 1,                       // the side it comes down from, +1 left, -1 right; left out, the sim picks one. It should be the uphill side
  name: 'Valanga del Pelmo',     // required, the local name: it stays local in every language, on the sign and on the HUD
  say: { it: 'Una valanga!', en: 'An avalanche!' },  // the small line; left out, a line for the kind from i18n dis.<kind>
  // for a plume (cloud; eruption's column): summit: { lat, lon } or bearing (true degrees), or at: [x, z]; far, height, baseY
  // optional, rarely needed: len, source, warn, strike, after, gapW, speed, wave, signLead, signScale; gully: { color, lump, rows, cols, rocks, wobble } the look of the dry channel, default the plain pale one
}],
sacred: [{ u: 0.97, d: 38, r: 30 }],   // every church and temple: u, d (m left of the road) and r (m), or x, z, r. An entry too close throws, a flow's start stops short
```

Then, in this order:

1. Pick a stretch at least 100 m long with room on both sides of the road, with nothing you love in the flow's way: `len` of road and `source` m up the slope get flowed over (barns and houses stay standing and it looks wrong). Move `u` rather than a building.
2. `node --test test/disasters.test.mjs`: it runs every track that exists with its real entries, 3 laps with bots, and fails on an invalid entry, a stuck kart, or a bad frequency.
3. Shoot it: a scene in `tools/shoot-disasters.mjs`, or the same `?disasters=` URL, and LOOK at it. Is the sign readable before the bend? Is the gully on the slope? Is the church untouched?

A new kind means a line in `DISASTER_KINDS`, a branch in `fireDisaster` and `stepDisasters` for what is different, a line in `DISASTER_SOUND` with its `SFX`, `PALETTE` and `SIGN_COLOR` in the renderer, `DIS_COLOR` and `dis.<kind>` in the HUD and i18n. `test/disasters.test.mjs` runs over all kinds and asks each for determinism, the telegraph, a free line for every kart, the way back up and a voice of its own.

Rules: cartoon, friendly, big and readable. No casualties, no bilanci, no named death tolls, nothing about real victims in names or lines; the name is the place and the kind. Churches and temples are never hit by anything.

### Long tracks (phase 3)

How to build one: `docs/long-tracks-howto.md`. The engine is switched on by `def.long` and has been proved on a synthetic 10 km lap (`test/helpers/long-track.mjs`, `test/long.test.mjs`, `tools/long-check.mjs [track]`). What it adds to the contracts: `track.long`; `nearest` with no hint or a stale one goes through a spatial index, and a stale hint keeps its level at a crossing; `itemBands` by itself; the sim's leader razzo flies at most `RAZZO.sweepLong` m; a `lastLap` event at the last kilometre of a one lap race; `main.js` races one lap whatever the lobby says, `?laps=` still wins; `batch.add(g, { far, low })`; `src/render/stream.js` `createStream`, which draws ground, road, statics and water by distance from each view with a coarse mesh per 1 km of ground and per 512 m of road, near buffers given back to the GPU past `release` m; rocks, crates and hazards near a view only; crates behind every chase camera are not drawn on a long track; `look.trees.trunk`, a colour for the dark trunk part of a tree, off by default; far trees thinned per view above 450k triangles; `src/ui/screens/longmap.js`, a map that follows the kart, road ahead up, zoom by speed, with a strip of the whole lap; `R.stats().stream`.

Asked for by the owner on 04/11/2026: six more tracks of at least 5 to 10 km each, on top of the first six. A 5 to 10 km lap takes about 3 to 6 minutes at base speed, so they race one lap by default. Anything written now must not assume a short lap: no O(n) per-frame scans over all samples, windowed `nearest` searches, terrain and scenery built in chunks with level of detail and streamed per view, so that memory and frame rate stay in budget at 10 km with 4 views. Item bands scale with length (one band about every 500 m), and the minimap must zoom instead of showing the whole route at once. the owner wants one in Jakarta and one in Bali (a different part of Bali from `bali`). Jakarta must have insane traffic, crazy like the city: the road packed with dense, chaotic moving vehicles to weave through, swarms of scooters, buses, bajaj and angkot, jams to squeeze past, honking everywhere; traffic is the main obstacle of the track and needs its own instanced rendering, deterministic sim and sound. The other four, proposed on 04/11 and accepted with his yes: Cortina and Passo Giau (Cinque Torri, Tofane), Transalpina (Romania's highest paved road), Bucarest (his city: Palace of the Parliament, traffic, sister track of Jakarta), Ijen at night (blue flames, turquoise crater lake).

The Bali one is `batur`, "Dal Mare al Batur": from Tanah Lot on the sea through the rice of Tabanan, Ubud and the Ayung gorge to the rim at Kintamani, down over the lava and round Lake Batur, and back to the sea through Penglipuran, at the last hour of the day. Facts in `docs/references/bali-long.md`. Added for it, each off by default: `world.paintAt(x, z) -> null | [r, g, b, amount]` in a landmark's `plan` (linear colour on the ground, for black lava and sand), recipe keys `dem_eye` (m over `altitude` the DEM is seen from) and `dem_clear` (`[[from, to, fade]]` bearings where the DEM goes back to sky) in `tools/compose-panorama.py`, preset `bali_sunset` in `tools/paint-photo.py`. Also, each off by default so every other track looks as before: `look.water.still { x, z, rx, rz, deep, base }` (an ellipse of the water with no foam and its own colours, a crater lake in the same water as a sea; its mirror capture applies only inside), `look.shadeFine { bias }` (a second, tight sun shadow pass of the objects near the kart, on the ground mask), paint kind 16 (fine brick courses), `kind.maxRoad` in `look.trees.kinds` (m from the road a kind stops growing by itself), `look.trees.roundLods` (crowns of the broadleaf per band, `null` keeps the default), `look.road.sett` (scale of the cobble setts, default 2.1), `look.terrain.terraces.sky` (what a flooded plot mirrors, default pale blue) and `.yMix` (how much of the mesh height cuts the bands, default 1). New tool `tools/paint-regions.py` (recipe `tools/panoramas/batur-paint.json`): repaints one real photo region by region through colour ramps, keeping the photo's own light and its real ridge, for a photo that holds several mountains. `world.groundDrop(x, z)` already in the terrain lets sim-only corner hills stay out of the drawing: batur uses it, so the sea is not walled in.

### Phase 3 additions

Asked for by the owner on 04/11/2026, all tested as thoroughly as the rest:

| Feature | What it is |
|---|---|
| Secret family karts | Baileys the cat in a kennel kart, who bites karts that get too close, and Fifi in a chef's trolley with pans. Unlocked by winning Gran Premi, saved locally |
| Caccia alla Forma | Arena mode, about 3 minutes: everyone chases one wheel of cheese, the longest holder wins. Hits make the holder drop it |
| Telecronaca | A funny commentator on overtakes and disasters in Italian, Romanian or Indonesian. Pre-generated voice files with edge-tts, bundled, so the game still needs no internet; voices are his earlier choice for Romanian, ro-RO-AlinaNeural and ro-RO-EmilNeural. Check the licence before any public release |
| Weather and night | Rain, fog and snowfall on existing tracks, changing grip as well as the look |
| Time trial | Alone against the ghost of your best lap, records saved locally |
| Team championship | A 2 vs 2 Gran Premio with team points |

#### Telecronaca (05/11)

Two commentators, a man and a woman, in Italian, Romanian or Indonesian (`BOOTH` in `src/data/commentary.js`; Romanian as the owner chose, Emil and Alina). Off by default and off means nothing: no key in the options, no byte of a pack fetched, no audio node, no caption element, and the sim steps byte for byte the same with it on, since the director has its own random stream and only reads.

- Option: `flow.opts.voice` `it | ro | id`, absent when off (`flow.setOpts({ voice: 'off' })` deletes it); `opt {voice}` from the phone, sanitised in `room.js`; chips on the TV lobby, a row on the pad; remembered on the TV's browser (`racing-karts.voice`); `?voice=it` for tools, not remembered. Choosing a language fetches its pack and says one line, so the box is heard to be on.
- `src/data/commentary.js`: pure data, `POOLS` of lines in the three languages, the same count in each, `clipsFor(lang)`. `{who}` lines are made once per driver. Rules for the words: nothing about deaths, victims, religion or real people; a disaster's warning stays a warning, the laugh is at the mud afterwards and at nobody; no line counts the field or makes a driver a he; Fifi's name is never said on a mishap.
- `src/game/commentary.js` `createCommentary({ lang, seed, duration })`, `begin({ track, views, karts, mode })` (`race`, `time`, `forma`), `intro()`, `events(list, state)`, `next(t, busy) -> cue`, `closing()`, `preview()`. Pure. Priorities with a shelf life, a cooldown per family of lines, a budget of seconds per minute that only what matters can pass, a shuffled bag per pool kept across the races of an evening, so a line returns only after all the others. Words follow the race: one lap roads get `lastKm`, the time trial and the Forma their own start and end, and in a time trial nobody wins.
- `src/game/booth.js` joins it to `audio.voice(lang)`, `audio.say(cue)`, `audio.hush()`, `audio.voiceBusy()`, `audio.voiceStats()` and `src/ui/screens/caption.js`. `window.__game.voice` shows it to tests. `src/audio/voice.js`: decodes a clip the first time, holds the music down through `mix.duck` to 0.3 and the engines to 0.72 while they talk, comes back up afterwards.
- Files: `assets/voice/<lang>.bin` and `.json`, about 4.6 MB a language, made by `tools/make-voices.py`, cached by text in `data/raw/voice/`. A changed line is a new clip, `--check` tells a stale pack. Git ignored and NOT cleared for a public release: see `CREDITS.md`. Without them the game shows the captions alone.
- `tools/voice-listen.mjs`: records what really leaves the TV page in a race and has whisper transcribe it, since nobody here can hear. `test/commentary.test.mjs`: the real path by phone and TV, and a normal race with none of it.

#### Secret family karts (05/11)

`src/data/karts.js` also exports `SECRET_KARTS`, `SECRET_IDS` and `ROSTER` (the nine plus these two). `KARTS` and `KART_IDS` stay the nine, and are what bots, tools and every "all karts" list use; `kartInfo(id)` finds all eleven. `baileys` (region romania, La Cuccia: his own coat from his photo, sitting up through the roof of a kennel, tail out of the door, 3 4 3 2 3) and `fifi` (region indonesia, Il Carrello: a chef riding the footplate of a steel trolley, a pan each side facing the chase camera, 4 3 2 4 2). A cartoon, no likeness, no employer named, and no jokes about her.

- Unlock: `src/game/unlocks.js` `createUnlocks(store)`, `{ wins, open, locked, winGp() }`, localStorage key `racing-karts.gpWins` on the TV's browser. First Gran Premio won by a person (first of the final table, or a person on the winning side of a team championship) opens Baileys, the second Fifi. A single race never counts, nor one won by a bot. `?unlock=all` opens them for tools, for that page only.
- Flow: `createFlow({ secret: [ids] })`, `flow.pickable`, `flow.extra = ids`, `flow.announce(id)`, the event `gpWon {slot}`. `menu.karts` on the pick screen is `pickable`; the bots' pool ignores it. On results and podium `menu.unlocked` is the id just won (the key is absent until the first ever, null afterwards).
- TV: `ui.show('pick', { karts, locked })`: the line-up shows `karts`, in two rows of six and five when there are eleven, and a pill tells what is still locked. `ui.show('podium', { unlocked })` shows the card. Phone: `#resUnlock` on the results screen. Pictures `assets/ui/karts/<id>.png` as for the others.
- The bite, `src/sim/bite.js`, numbers `BITE` in tuning.js: a kart within 3.3 m of Baileys for 0.32 s (`k.biteWind` 0..1, on his kart only: his ears go flat) gets `bite {kart, victim, side, x, y, z}` (side + is his left) then `hit {kart: victim, by, kind: 'slide', cause: 'bite'}`, a slide of 0.5 s. Sausages in orbit take it. Not in the first 3 s after the go, then every 9 s at most; off in a time trial. A race without him has no state and no cost. `sense.biteT` and `sense.biteSide` drive the head and the fangs (`kartState.pose` `bite` for tools). HUD: `hit.bite` for the victim, `hud.bit` for him. Sounds: `biteChomp`, `panClank` when Fifi is knocked, a purring engine and a rattling one.
- Balance, 60 races per kart per level across five tracks with one kart in a field of the nine, average place: Baileys 3.30 medium and 3.80 hard, Fifi 3.78 and 4.03, for comparison seggiovia 3.12 and 3.82, jukung 3.28 and 3.65, gatto 5.38 and 5.35.

#### Time trial (05/11)

Lobby option `mode: 'time'` (`opt.mode` on the phone, `?mode=time` for tools): pick, vote, a race of the lobby's laps (one on a long track), results. Everything below is off in every other mode, which steps byte for byte as before.

- Sim: `createRace({ timeTrial: true })` sets `state.timeTrial`, leaves `state.boxes` empty, plans no disaster, and karts do not touch or bite each other. Hazards and traffic stay, with the seed `trackSeed(id)` so the road is the same at every try. No bots (`flow.field()`), no items.
- `src/game/timetrial.js`, pure: `createRecords(storage?)` `best(track, kart, len?)`, `ghost`, `saveLap`, `saveTotal`, `table`, `trackBest`; `createTimeTrial({ track, trackId, laps, karts: [{ i, kart }], records })` with `step(state) -> events`, `poses(alpha)`, `view(i)`, `result(i)`, `taint(i)` (a lap a bot drove is no record); `createRecorder`, `decodeGhost`, `ghostPose(g, t)`, `sectorsOf(track)` (quarters; about one a km on a long lap). It only reads the sim's state after each step.
- Its events go through `deliver` with the sim's, and the sim never sees them: `ttSplit {kart, n, of, time, delta}`, `ttLap {kart, n, time, delta, record, first, clean}`, `ttFinish {kart, time, bestLap, record, delta, lapRecord}`. `delta` is seconds against the record, null with nothing to compare.
- A ghost is poses, not inputs: 10 Hz on the lap's own step count, delta coded in 16 bits, Catmull-Rom between samples, so a later change of tuning cannot send it into a wall. It is the best lap of that track and kart, and it restarts when its driver crosses the line. The lap just driven is the ghost of the next if it is the best.
- Records live in the TV browser's localStorage: `racing-karts.tt.v1` holds times per track and kart (`lap`, `splits`, `totals: { [laps]: t }`, `len`, `at`, `ghost`), `racing-karts.tt.ghost.v1.<track>/<kart>` one ghost each. Full storage: the oldest ghost goes, its time stays. No storage: memory for the evening. A road whose length changed by over 1 m forgets its times.
- Renderer: `src/render/ghost.js`, `R.setGhosts([{ kart, owner }])`, `R.setGhostPoses(poses)`, `R.ghostStats()`. The kart's own model, pale and see-through, two draw calls per view (depth, then colour), seen only in its driver's view, thinner when it overlaps your kart. No shadow, smoke or sound. An empty list costs nothing.
- HUD: `hud.setup({ tt })` gives the view class `tt`: the place and crate corners hold the lap clock (`.ttclock`) and the laps (`.ttlaps`), `.ttref` the record, `.ttsplit` each split with its delta for 3.2 s, a pale ghost dot on the map, no crate marks. Results: `data.tt.table`, class `tt` on the screen, each row `r.tt = result(i)`; no podium, `flow.toPodium()` is false and the results wait for a choice, a key there is a rematch.
- Phone: `hud {tt: true, delta}`: no USE ITEM, DRIFT in its place, the last split in the place's spot. `menu.tt {record, first, best, totalRecord, delta, laps}` on results: the time in the place's spot. Difficulty and bots are dimmed in the lobby, the vote cards show what there is to beat (`voteData.records`).

#### Team championship (05/11)

Lobby option `mode: 'teams'` (`opt.mode` on the phone, `?mode=teams` for tools, one track): a Gran Premio in everything about choosing tracks, laps, the grid and the table (`flow.gpMode`), with two sides of two karts. Everything below is off in every other mode: no `team` key on a seat's field entry, a kart, a results row or an event, no extra draw from any random stream, so a normal race steps byte for byte as before.

- Sides, `src/data/teams.js`: `TEAMS` (`a` Sambal, `b` Genziana / Gentian, a chilli and a gentian, red and blue so they read apart at a dot's size and for colour-blind eyes), `TEAM_IDS`, `TEAM_SIZE`, `NEUTRAL_COLOR`, `teamInfo(id)`, `teamName(id, lang)`. `teamIcon(id)` in `src/ui/icons.js`, the same badge on TV and phone.
- Choice: `seat.team`, filled by `flow.join`, by choosing the mode and by the field with the smaller side. `flow.setTeam(slot, team)` in the lobby only. Into a full side you go in and its last seat takes your place, so four people can change sides without anybody stepping out. Phone to host: `team {team}`, `a` or `b`, sanitised by `sanitizeTeam`; each seat chooses for itself, slot 0 holding the options has nothing to do with it. TV: a click on a seat's badge, A and D on a keyboard seat.
- Field: 2 + 2 whatever the lobby says: bots = `max(option, 4 - people)`, capped by the grid of eight. The first bots fill the sides, the others race for nobody (`team: null` in the field, pale on the map, no pennant): bots at 0 is a pure 2 vs 2 of four karts, the default gives eight on the road. Bots are shuffled after, so sides are mixed on the grid.
- Points: the usual table by overall place. A side is the sum of its two karts; a free bot takes its place and its points go to no side. `flow.teamTable()`: `[{ team, points, wins, best, race, members, rank }]`, `race` this race's points, `best` the best place in the last race. Level on points: more wins, then first in the last race, which two karts cannot share. `S.gp.teams` holds the sides. `teamScore(karts, base)` is what the sides would have if the race ended now.
- End: results, then podium as any Gran Premio. `gpWon` goes to the first person on the winning side, so a team win counts towards the family karts, also when a bot on that side did the driving. `next('rematch')` after the last race restarts the whole list on the same sides, with a new draw of bots. `change track` composes a new list.
- Sim: `players[i].team` gives `k.team`, `mates(a, b)` in tuning.js. `hitKart` from a team-mate is `immune`, and takes no sausage. Razzo and rendang go for the first rival ahead, with only a mate ahead the razzo sweeps and the pot pulls crates as a leader's do. The frana falls on the first kart not on your side. A mici shot flies past a mate, spills leave a mate alone, Baileys does not bite his own side, bots do not count a mate as a target. Karts still bump: it is the same road. Hazards and disasters hit everyone.
- Renderer: `R.setKarts([{ kart, color, team }])`; `src/render/teamflags.js`, a pennant on a mast at the back corner, one mesh per kart, not in its own driver's view, `R.teamFlagCount()`. Kart models are untouched. `colors` in main.js become the side's colours, so the map and the overview show two sides and pale bots.
- HUD: `hud.setup({ teams: { base, score } })`: `.tscore` under the player's tag, both sides' live score, your own side ringed and a bump when a number moves. Flyover pill `fly.teams`. Results: `data.gp.teams`, class `teams`, the team-coloured edge on rows and two `.tblock` cards in the place of the table. Podium: `ui.show('podium', { teams })`, two steps of two karts each, winners cheering in their colours of confetti, the others sulking (`pose: 'sad'`). The CSS is `TEAM_CSS` in `src/ui/screens/teamstyle.js`.
- Phone: `menu.team` and in the lobby `menu.lineup [{slot, team}]`: a side row in the options, never read-only; the chip at the top names the side. `hud {team, score: {a, b}}`: `#teamTag`, yours first. On results and podium `menu.team`, `menu.score`, `menu.won` (id or null until the last race): `#resTeam`.
- Tools: `tools/shoot-teams.mjs`, tests `test/teams.test.mjs`.

#### Caccia alla Forma (05/11)

Lobby option `mode: 'forma'` (`opt.mode` on the phone, `?mode=forma` for tools, `?formaT=seconds` shortens the clock on any route): pick, vote, one match of 3 minutes on the voted road, results, podium. It is one track, not a Gran Premio. Everything below is off in every other mode: no `state.forma`, no extra draw, a normal race steps byte for byte as before.

- Why it works on any length: there is no arena. The wheel rolls forward along the road by itself and the pack is the arena, wherever on the road it has got to. Behind it a kart is pulled along (`p.rubber` up to `chase`), past it held back (`leash`), and past 360 m the stork flies it to 80 m behind the wheel (`formaFetch`, the same rescue as any other).
- Sim: `createRace({ forma: true | { duration } })`, `src/sim/forma.js` `createForma(R, opt)`, numbers `FORMA` in tuning.js. `state.laps` is `FORMA_LAPS`, so nobody finishes on laps, and `lap` and `overtake` are swallowed. Disasters are planned as for a race of the same minutes (`formaPlannedLaps`). `state.forma = { duration, left, holder, over, wheel: {x, y, z, px, py, pz, yaw, roll, f, d, v, h, vh, t, lockKart, lockT, lockAll, last, grace}, held[], best[], streak[], grabs[], drops[], rank[], gaps[] }`. The clock starts at the go; `holder` is -1 with the wheel loose; `gaps[i]` is the road metres from a kart to the wheel, ahead positive.
- Rules: drive through the wheel to take it. Any real hit drops it (mici in orbit take the hit first and it stays; the pan's immunity too), so does a stork ride, a shove of 5.5 or more, any bump from a kart on a turbo, and 0.9 s of sitting on the holder's bumper. The first 3 s in hand nothing but a hit takes it. Who lost it cannot take it back for 1.7 s, nobody for 0.22 s. In hand it weighs, more the longer you keep it (`heavy`, `heavyMore`, up to `heavyCap`), a little more for the leader of the table. The razzo goes for the holder from ahead or behind (no sweep), the frana falls in front of the holder, and the crates never give the rolling Forma di Formaggio: one wheel on the road. Hazards and disasters as usual.
- End: at 0 the table is the finish: `formaEnd`, then `R.finishKart` in order of seconds held, then longest single hold, the wheel to the winner. During play karts with no time share the next rank; at the end each has its own.
- Events: `formaGrab {kart, from, x, y, z}`, `formaDrop {kart, by, cause: hit|ram|rescue, x, y, z}`, `formaLead {kart}`, `formaFetch {kart}`, `formaLast {left}` (30 s), `formaTick {n}` (10..1), `formaEnd {winner, held}`.
- Bots: hooks in `bot.js`, `botLane` steers at the loose wheel or the holder, `botThrottle` waits up to 220 m when it has run off ahead, `botItem` keeps what can hit the holder for the holder. Humans get the same pull and leash: it is the road's rule, not a bot's.
- Flow: `MODES` in flow.js and room.js, `FORMA_MIN_BOTS` 3: one person alone gets at least three bots, two people may duel. `menuFor` adds `forma {held, best, grabs, drops}` on results, `menu.time` is the seconds held. `src/game/forma.js`, pure: `formaHud(h, F, k)` (`place` is the rank, `hud.forma {left, held, mine, loose, gap, over}`) and `formaRows(rows, F)` (`r.forma`, `r.time` is held, no best lap).
- Renderer: `src/render/forma.js` `createFormaWorld({THREE, scene, mat, shapes})`, made the first time it is needed and hidden otherwise: the wheel from the Forma di Formaggio's model, tilted on the holder's roof, a soft beam of light, a ring when it is loose, an arrow over it, scaled with the distance. Beam and arrow are off in the holder's own view. The overview map gets a gold dot.
- HUD, `src/ui/screens/forma.js`: `hud.setup({ forma: true })`, class `forma` on the view, `hasit` with the wheel in hand (a gold edge). `.fo-where` at the top says who has it and how far, `.fo-board` the first three and you, `.fo-mine` your seconds, `.lap` the clock, `.fo-count` the last 5 s. Your rank replaces the place, and the wrong-way sign is off when the wheel is behind you. `formaMark` on both maps. Results: `data.forma`, class `forma`, seconds held as a bar, longest hold, grabs, the winner's sticker. Podium: seconds held on the plates. Lobby: chip, laps dimmed. Vote: `forma.minutes` in place of the laps. Flyover pills `forma.title`, `forma.fly`.
- Phone: `#formaTag` beside the clock in `#lap`, a gold edge with the wheel in hand (`body.formaMine`), the same `place`. `padFx` kinds `formaGrab`, `formaDrop`, `buzz` for `formaFetch`, `bump` for the last 5 ticks, `lastLap {forma: true}`, and `finish` says `pad.formaOver`. Results: `pad.formaResult` in `#resTime`.
- Sounds, `sfx.js`: `formaGrab`, `formaDrop`, `formaOther`, `formaLead`, `formaTick`, `formaEnd`; `formaLast` uses the last lap's sting and music.
- Numbers from `node` over 8 seeds of 8 bots at medium: 18 to 41 grabs a match, the winner 28 to 75 s of 180, none far from it on short or long roads. Karts are not equal at it: on Batur the Becak averages 37 s and the Tabià 5.
- Tools: `tools/shoot-forma.mjs`, tests `test/forma.test.mjs`.

#### City traffic (Jakarta, 05/11)

`def.traffic` (jams, lanes, crossings, showTrains, rain), `def.roadRange`, `def.marks` are optional and change nothing on a track without them. `state.traffic = { knocked: [], rain, rainFrom, rainTo }`. New events: `honk`, `traffic`, `crossing`; new hit causes `traffic`, `train`. `traffic` event `kind` also `part`: a plain scooter swerving out of a kart's way, no cost; a vehicle with `load` in `VEHICLES` does not swerve and scatters. New disaster kind `banjir` (3.6, 9, 40: a brown flood with a free lane, flow at 6.5 m/s). `tools/compose-panorama.py` photo option `at_bearing`: a photo that stands where it is put, its summit only marks the view (default off). Details: `docs/long-tracks-howto.md`.

#### Weather and night (05/11)

Chosen per race, on any track but the time trial: rain, snow or fog, each by day or by night. Nothing chosen is a plain race: no key, no state, the same bytes.

- Option: `flow.opts.weather` `rain | snow | fog | surprise` and `flow.opts.night` `true`, both absent when clear and by day. `flow.setOpts` takes them in the lobby and on the vote, and only them on the vote. `opt {weather, night}` from the phone, sanitised in `room.js`. `menu.weather`, `menu.night` on the vote. A surprise is drawn again for each race. `flow.weather` is the race's sky, `{ kind, night }` or null; the time trial is always null, or two times would not compare. `?weather=` and `?night=1` for tools.
- Data: `src/data/weather.js` (`raceWeather`, `drawWeather`, `weatherKey`); `WEATHER` in `src/sim/tuning.js` (grip and speed per surface, patches, thunder, how far a bot sees).
- Sim: `createRace({ weather })`, `src/sim/weather.js`. `state.weather = { kind, night, flash, cover[] }` only when chosen. Own random stream, deterministic at 1/60. `race.patches`: puddles or drifts placed at the start, none in a tunnel, within 34 m of a jump or a pad. Rain and snow lower grip on most surfaces and rain packs the sand, which gets better; fog lowers grip a little and shortens what a bot sees, night too. A patch: one `splash {kart, kind, x, y, z, speed}` on the way in, then less grip and speed for a moment; the pan of the uova goes through. `thunder {delay, flash}` now and then in the rain. A chosen sky switches off the city's own seeded rain.
- Render: `R.loadTrack(track, terrain, { weather })`, `R.setPatches(race.patches)`, `R.weatherStats()`, `src/render/weather.js`. `shared.grade` is one grade in JS and GLSL on the sky, the panels, the mist strip, the ring and the water, so a painting still joins its sky; stars and the moon are in both dome and panels, masked by the ridge. `shared.wx` in `toon.js` holds what a material needs: snow cover by up-facing normal, wet, the four nearest karts' lamps, the lit map. The lit map is a texture of pools under each lamp and lit window; its alpha is the height of the ground a pool lies on, so that a village under the road stays dark. Paint kind 40 (`GLOW_KIND`) is drawn at full light whatever the night: lit windows, lamps, the tops of poles. Windows are found in the merged geometry by colour, shape and place (`PANES`, `tagWindows`). Six draws at most per view: fall, patches, posts, poles, halos, beams. Poles only on snow, fog or a night in the country, spaced on a long road, none in a city. Posts and poles go to the GPU per view, only what is in reach; a long road gives far trees for what the sky adds.
- HUD: pills in the flyover, `fly.wx.*`. Phone: rows `weather` and `night` in the lobby, `#wxCycle` and `#wxNight` on the vote, a bump on a splash, a buzz on thunder. TV: chips in the lobby, chips on the vote. Sounds: rain, wind or night loops (hushed by `state.weather.cover` in a tunnel), `splash`, `thunder` after its delay.
- Bran is a night already: night there changes nothing, its weather only adds a thin veil.
- `test/weather.test.mjs`, `tools/shoot-weather.mjs`, `tools/perf.mjs --query`, `docs/shots/meteo-*`.

### Real backdrops (asked by the owner 04/11 night, binding for every track, old and new)

His words: without the real backgrounds of the places the tracks do not look real, "antelao ora sembra un qualsiasi posto di montagna", do it as in Summit Descent, or download the images from the web and use those. A DEM ring alone is not enough. Every track must be recognisable at first glance by someone who knows the place, from a screenshot, without reading its name.

Each track gets real images of its real place in the background, placed at their true bearing and height:
- Source: real photos of that exact place, from Wikimedia Commons or another free licence, with file, author and licence recorded in `assets/backdrops/CREDITS.md`. Originals kept in `data/raw/backdrop-photos/` (gitignored). If a famous mountain is the subject, a photo of the summit itself as people photograph it, not only the view from there.
- Treatment: the photo through a local painter (`tools/paint-photo.py` `planes()`: the photo cut along the rock's grain into flat shapes at a few tones, the hour's ramp, a thin broken pen), so it matches the toon world. One painter for all the mountains of a track, and one forest. A Gemini repaint from the photo (Brave, profile Personal, photo pasted from the clipboard, method in `src/render/paint.js` and `assets/backdrops/CREDITS.md` of Summit Descent) may stay only if its shape and viewpoint are right and the rest can stand beside it; antelao dropped a first one on 05/11 after a blind critic read it as a postcard and as a second art style, then took a new one the same day because the owner could not recognise the mountain from the valley photo: a repaint of the San Vito view, the rest of the panorama and the 3D world brought to its colours (`docs/backdrops-howto.md`, A hand repaint as the hero). The viewpoint counts, the mountain's signature shape counts more. Never a track left without images because the browser was unavailable. Never a prompt-only invented view: it must start from the photo.
- Reuse, read only, by copying, when the viewpoint fits: Summit Descent `assets/backdrops/` holds `antelao-summit.jpg` (Antelao from San Vito, the view from the SS51 at Borca), `antelao-chiggiato.jpg`, `antelao.jpg`, `carpazi.jpg`, `carpazi-summit.jpg` (Bâlea), with credits to carry over. Port its `src/render/paint.js` idea: camera-centred cylinder, true azimuth and elevation, side edges fading, foot dissolving into base mist, 3D ground turning into that mist at distance, sky colours taken from the painting so the sky matches.
- Several images per track, around the horizon, wherever the driver looks at something famous: a track goes all the way round. They are composed offline into one continuous 360 degree panorama with the real DEM painted between them and opaque forest over their feet (`tools/compose-panorama.py`, recipe in `tools/panoramas/<id>.json`), then cut into tiles that meet with no fade. The DEM ring is hidden once the tiles close the circle, and stays if one fails to load.
- Scale is real: Antelao from Borca stands 32 degrees above the road, the chase frame ends at 24.45 at its slowest, so it stands at 24 with the compression written in the track file, and must dominate the frame when the road faces it, not sit small and pink on the horizon. Compute elevation and bearing from the track's real place and the summit's real coordinates, and test them (a test per track that the named summit is within 2 degrees of true bearing and that its top is at the computed elevation).
- Cities too: Bucharest and Jakarta and the others use real views of those places (Casa Poporului, Monas, the real skylines). A track with real buildings still needs real ones in the distance.
- Weather, night and hour in phase 3 regrade the same images in the shader, or use a night photo.
- Definition of done: a critic, given only race screenshots per track and photos of the real place, can name the place. Budget: backdrops are at most one draw call plus one texture per panel, textures at most 4096 px wide, JPEG, total under 3 MB per track, one sphere per view.
- Before any public release: CC BY-SA paintings keep attribution and licence, recheck.

How it is built, and how to add one, step by step: `docs/backdrops-howto.md`.
- `tools/fetch-photo.mjs`: Commons search, download with a sidecar json, refuses a licence that is not free, prints the credit row. `tools/paint-photo.py <photo> <out.jpg> --style planes --preset golden --place width,elevation`: the painter on one photo, for looking; its `planes()` is what the composer calls unless a recipe entry says `style: illustrate`, and an entry with `painted: true` keeps its land as it is. `python3 -I tools/compose-panorama.py tools/panoramas/<id>.json [--preview out.jpg] [--out dir] [--quality q]`: writes the tiles, prints the panels for `def.backdrops` on stdout, the MB, placements and the photos per tile on stderr.
- `def.ground.relax`: passes of a small blur on the ground away from the road, so the cut cone meets the natural ground with no ruled crease; it leaves river beds alone (default 0).
- `def.ground.flats: [{ from, to, w }]`: on these fractions of the lap (from > to wraps) the ground is level with the road for w m past its edge, the made ground of a street with houses (`buildTerrain`; default none).
- `look.terrain.sculpt: { tone, lines, ink, scale }`: snow the wind has worked, per pixel: drifts in a cel ramp lit by `look.sun`, wind lines, a broken pen on their crests (off by default). `look.road.settRough` 0..1: setts laid by hand with snow in the joints (0 the even ones). `look.road.iceSoft` 0..1: an ice hazard in the track's own shade, its sides blown soft (0 the pale sheet). `look.road.snowSpray: 'all'`: flakes off every surface, not only snow and ice. A `wall` event with `snowSpray` throws snow instead of sparks.
- `def.ground.lake: { x, z, rx, rz, level }`: one water body at its own level inside an ellipse, for a track whose valley falls below it, where `ground.water` would flood everything lower (`buildTerrain` returns it as `lake`; karts in it count as in water). `def.horizon.near`: where the baked ring starts, m, default the old 1500, for mountains that stand closer. `look.trees.noPlant`: kinds no landmark's gallery may plant.
- `def.backdrops` panel: `file`, `width` (deg of azimuth the image covers), `summit: { name, lat, lon, altitude, u, row }` (bearing and elevation computed from `def.horizon`) or `bearing`, `elevation`, `row`; `elevation` over a summit overrides the true figure and then requires `compressed`, a string saying why (the chase camera's frame top is 24.45 degrees at its slowest); `baseHaze: [from, to, amount]` rows where the foot turns into `mist` (all of it past `to`); `edge` deg of side fade (0: a tile of one panorama, meets its neighbour's identical pixels), `rise` image heights the land dissolves upward at its sides, `sky` weight in the dome (0: none). Later panels lie over earlier ones.
- `src/render/backdrop.js` `createBackdrop(def, look, { base, renderer, sky, shared })` -> `{ mesh, ready, panels, hero, covers, dispose }`, `covers` true when all panels loaded and their widths close the circle; pure `placePanel(panel, def, aspect)`, `panelPoint(place, u, row)`, `summitTruth(horizon, summit)`, `skyStops`, `mistStrip`. The renderer option `backdropBase` is the folder, default `assets/backdrops/`, copied next to the page by the build. A missing file is a console warning and the ring shows there. Up to 8 panels; a small shared ridge texture on top of one texture per panel. The parallax is per pixel, against one cylinder of radius `def.horizon.panelDistance` (default 6000), so tiles do not slide.
- `look.mist: { from, to, amount, ring }`: the near ground, far trees and water turn into a strip of colour by azimuth (the panels' mists) between `from` and `to` m, and the feet of the DEM ring take it by `ring` (`MIST_GLSL` in toon.js, amount 0 with no backdrop). The sky dome's stops take their colours from the panels' skies. The DEM ring is not drawn where a panel stands whole, nor at all when `covers`.
- The flyover first looks at `backdrop.hero` (the panel that stands highest), then comes round to the road.
- `test/backdrop.test.mjs`, for every track that exists: at least 3 panels, summits within 2 degrees of true bearing, the image's ridge top at the declared elevation, files present and at most 4096 px, credits present, total under 3 MB, tiles closing the circle, the hero faced by the road on a long stretch.

### Horizon

`tools/bake-horizon.mjs <trackId>` reads Copernicus GLO-30 tiles through `tools/dem.mjs` (downloaded to `data/raw/dem/`, not bundled; symlink or copy tiles from `~/Developer/summit-descent/data/raw/dem/` when present, read only) and writes a polar grid in `data/horizon/<id>.bin` with metadata in `.json`: a ring of real ground from about 1.5 km to 40 km around `def.horizon.center`, heights relative to the track's altitude. The renderer draws it as a far mesh with the toon rock, snow and forest bands, scaled by `1/scale` and following the camera xz (a very slow parallax), so Antelao and Pelmo sit at their true bearings and their true silhouettes. The near terrain's rim is lowered under it in the drawn ground only (the sim's grid does not change). `def.horizon.exaggerate` scales the heights, `def.horizon.peak` (default 1) is a power over height that sharpens walls against their feet: a real massif squeezed under 25 degrees of frame reads as a hill otherwise. Ridged noise up to some tens of metres on the high ground cuts the crests, since 30 m data is smooth at this distance; bearings and summit heights stay the DEM's within that amount. Up to 40k triangles per track. This is what makes the mountains recognisable: real shapes, painted in the game's style.

### Renderer (`src/render/index.js`)

```js
const R = createRenderer(canvas, { quality: 'auto', dataBase: 'data/horizon/', shadeSize: 4096 });
await R.loadTrack(track, terrain);         // builds the whole world
await R.setKarts(players);                 // [{ kart: id, color }] in the race's order; a promise, kart files load lazily
R.setViews(indices);                       // human player indices to give a view; 1, 2, 3 or 4 views
R.frame(prevState, state, alpha, dt, events);   // interpolated draw
await R.flyover({ duration }); R.skipFlyover();   // the drone before the countdown; resolves when it ends or is skipped
await R.showcase(kartId, { canvas?, yaw?, size?, color? })   // -> { canvas, draw(dt, yaw, state?), model, dispose }: kart turntable for the pick screen, the podium and tools, framed to fit the kart, with the race's ink lines on a transparent background (`src/render/showcase.js`); state merges into the kart state the model sees, e.g. { pose: 'cheer' }
R.resize(); R.dispose(); R.stats();        // { fps, drawCalls, triangles, perView, trianglesPerView, scale, live }
R.mat, R.shapes, R.THREE, R.scene, R.loadItem(id), R.setScale(v)   // for tools and the item code
```
View layout: 1 full; 2 side by side; 3 and 4 in a grid (with 3, the fourth cell shows a live overview of the track with kart dots). Dynamic resolution scale keeps the frame rate. Budget on The owner's Mac (M4 Pro, 1080p): 60 fps at 1 and 2 views, at least 45 fps at 4 views. At most 500k triangles visible per view, at most 150 draw calls per view. No shadow maps at any view count: blob shadows under karts always, and one sun and contact mask baked into the ground at load (a depth pass from the sun over everything standing, plus the AO blobs), read by the terrain and the road, which costs nothing per frame. The build copies `data/horizon/` next to the page: the renderer fetches `data/horizon/<id>.bin` relative to it (`dataBase`), and without it the track still runs, with no mountains and a console warning.

Look keys beyond the track definition's: `look.terrain.terraces` (`step`, `wobble`, `rows`, `young`, `green`, `dark`, `gold`, `water`, `riser`: stepped rice fields per pixel on the ground's true height, where the landmarks module's `world.terraceAt(x, z)` says so, default off), tree shape `palm`, `look.horizon`, `look.mist`, `look.stone` (with `wall`, the portal's masonry), `look.deck` (`span`, `pier`, `rail`: arch rhythm of a viaduct, and with `rail` pilasters and an iron rail in place of its parapet), `look.water.bar` with `channel` (a river as a pale gravel bed with thin channels), `look.terrain.forestMix` (how dark the ground goes under far trees), `look.trees.drift` (size of the groves that kinds grow in), `look.camera`, `look.bloom`, `look.outline` (`fade: [from, to]` m: the pen lifts with distance), `look.terrain.{facetSize, facetTilt, facetTone, patch, coverNoise, rockSlope, rockStrata, bank, bankD, bankWet, bankHeight}` (the river bank is painted per pixel by height over `water`), `look.terrain.grass` (`[brush, tuft]`: the meadow painted with short strokes and warm and cool tufts), `look.terrain.wood` (`{ from, to, amount, dark, light, gold }`: far ground painted as forest from the vertex attribute `aWood`, written by `render/terrain.js`), `look.trees.farGold` (golden kinds dimmed beyond 480 m), `look.road.kerbW` (m, default 1.15), `look.road.verge` (the colour the shoulder fades into), `look.road.{wobble, wear, crown, pebble, crownColor}` (a worn country road: edge that wanders, patches and wheel lines, grass crown on dirt, gravel; default off), `look.pad` (`{ mat, stripe, band }`: boost pad colours, default the old pad), `look.kartShadow` (colour and strength of the blob under a kart), paint kinds 6 (old plaster), 7 (tin roof) and 9 (limestone, with no ink on its creases) in `aPaint`, `look.staticRim` (`[amount, power]`: a warm edge on static meshes, default none), `look.trees.kinds[]` (a kind with `share: 0` only grows where a grove or a plant asks for it), `look.trees.{nearScale, roadGap}` (trees by the road this much smaller; m kept clear of the road), `look.trees.mottle` (amount of leaf clumps painted over tree crowns), `look.softPuff` (kart smoke as soft round puffs), `look.road.joint` (asphalt runs into setts over a stone band), `look.road.moundReach` (m the hill over a gallery runs past the road, default 30), `look.road.moundRock` (a colour: bare rock in patches on that hill, its faces all lit from above, default none), `look.terrain.scree[2]` (truthy: shards read along each face's own plane, so a steep wall gets no vertical curtains, default off), `look.road.jumpMarks` (false: no generic bales and boards at a jump, the landmarks module marks it; default the bales), `look.water.{foamAmount, sky, mirror, mirrorColor}` (a still lake: no foam, the sky by viewing angle, the analytic reflection of a tiered silhouette), paint kinds 10 rice, 11 flooded paddy, 12 carved paras, 13 thatch and ijuk, 14 thin foliage, 15 big crowns, `def.wall.max` (m, height the invisible edge wall may reach, default `WALL.max`), `world.groundDrop(x, z)` (a landmarks module lowers the drawn ground, for its own geometry over it; drawn only, the sim does not see it), a snow road: `look.road.winter` (`grain`, `ruts`, `scratches`, `dust`), `look.road.repair` (asphalt repair patches, default 1), `look.road.edgeSink` (m the outer shoulder sinks into the ground, not on structures), `look.road.snowSpray` (wheels throw flakes, not balls; all default off); defaults in `src/render/toon.js` `DEFAULT_LOOK`, deep merged with the track's.

Look keys added for `bromo`, each off by default: `look.mist.high` (`[y0, y1, keep]`: mist lies on the floor, ground above y1 takes only `keep` of it), `look.terrain.rills` (`a`, `b`: `[x, z, count, light, r0, r1]`, fall line gullies round a centre; `rib`, `gully`, and `ribB`, `gullyB` for `b`; `height`), `look.road.track` (`{ ruts, grain, edge, grit }`: a track in loose sand; `grit`: dark and pale specks up close), `look.vent` (`{ crust, throat, ring, puff, puffB, size }`: a fumarole heaped with lava, its steam the renderer's billows alone). `world.groundPaint` (`{ canvas, rect: [x0, z0, x1, z1] }`): a canvas a landmark's `plan` lays on the ground, canvas y along +z.

Camera: chase, 5.5 m back and 2.2 m up with lag, slight roll into turns, widens with speed, shake on hits, follows jumps softly, never clips into terrain. A short drone flyover of the track before the countdown. Winner orbit at the end.

Effects (`fx.js`): tyre smoke and sparks by drift tier (three colours), surface dust (snow, sand, water), boost flames, confetti at the finish, cartoon "POF" stars on hits, kart squash on landing, wobble when tipsy, a gold glow when big. Readable at a glance.

HUD (`src/ui`), per view: place (huge, like Summit Descent), lap, item slot, minimap of the track with kart dots, wrong way, last lap banner, countdown 3-2-1-VIA with sound. DOM over canvas, scaled per view. Font: Fredoka, embedded (`src/ui/font-data.js`, `src/ui/fonts/`). Same family of chunky outlined stickers as Summit Descent (`ref/summit-descent-render/style.js`).

### Network and phone

Same protocol as Summit Descent (`server/room.js`, `src/net/`, `controller/pad.js`) with these changes:
- Four slots. Colours: `#4aa6f2` blue, `#f28bbd` pink, `#f6c23e` yellow, `#62c56e` green. A fifth phone waits.
- Input message `{t:'in', x, y, b, d, seq}`: `b` USE ITEM, `d` DRIFT. The server's `sanitizeInput` and `input.js` carry both, each with press counting for `b`.
- Phone layout, landscape: joystick on the right two thirds under the right thumb (as the owner set in Summit Descent on 28/10), the buttons under the left thumb: a big round USE ITEM showing the held item's icon with the roulette, above it or beside it a DRIFT button (hold). Vibration on hits, boxes, boosts. Screen wake kept as today.
- Host to phone messages through the existing relay (`{t, slot, ...}`): `phase {phase}`, `hud {place, lap, laps, item, charges, boost}`, `fx {kind}`, `menu {...}`. On every `{t:'join', slot}` the host sends that phone its `phase`, `menu` and `hud` again: a phone that came back knows nothing.
  - `phase`: `lobby`, `pick` (kart), `vote` (track), `loading`, `race`, `results`, `podium`. The phone shows the screen of the phase; `loading` and `race` show the controller.
  - `hud.item` is the held item id or null, `hud.boost` truthy while boosting. Send it about 5 times a second and when it changes.
  - `fx {kind}`: `roulette {item, ms}` (the phone spins the item button for `ms`, default 1200, and lands on `item`; hud.item is not shown until then), `box`, `hit`, `bump`, `boost`, `shield`, `lap`, `lastLap`, `finish {place}`, `buzz`. Any other kind (`rumble`, the frana's warning) is a small vibration.
  - `menu` fields are merged on the phone, so send only what changed. Lobby: `opts {difficulty, bots, laps, mode}`, `edit` (true lets a phone other than slot 0 edit them). Kart: `karts [ids]` (default: the whole roster), `kart`, `ready`, `others [{slot, kart, ready}]`. Track: `tracks [ids]`, `track`, `lock`, `others [{slot, track, lock}]`, and the verdict `spin` (the card the coin is on), `pick` (the winner), `landed`. Results: `place`, `time` (seconds).
- Phone to host: `in`, plus `pick {kart, ready}`, `vote {track, lock}`, `opt {difficulty, bots, laps, mode, go, next}` (slot 0 only, or anyone before the first pick; the room forgets the first pick when the host sends `phase lobby`), sanitised in `room.js`. `opt` carries only the fields that changed. `difficulty` easy, medium, hard; `bots` 0..7; `laps` 2, 3, 5; `mode` race, gp, time, teams. `go: true` is the lobby's start button; `next` is `rematch`, `track` or `lobby` from the results and podium screens. `vote.track` may be `random`. The host validates ids against its roster: the room only checks their shape. `pick` and `vote` with ready and lock false say which card is in front, so the TV can show it live.
- `src/net/input.js` `createInput(transport).get(slot)` returns `{x, y, item, drift, connected, source}`: `x` right positive, `y` up positive, already lightly smoothed; `item` and `drift` are booleans with every press counted (one frame per queued press, a released frame between them), so call `get` once per sim step. `controller/i18n.js` holds the phone's own strings (IT and EN), so the pad does not depend on the TV's dictionary.
- `src/ui/icons.js` exports `itemIcon(id) -> svg string` (also `ITEM_ICON_IDS`, `flag(region)`, `uiIcon(name)`, `UI_ICON_NAMES`; an unknown id gives an empty string), the phone imports it lazily and falls back to the item's name. Kart pictures are `assets/ui/karts/<id>.png`, track pictures optionally `assets/ui/tracks/<id>.png`: the server answers 204 for a missing one and the phone draws a coloured placeholder. `src/data/karts.js` exports `KARTS` and `src/data/tracks.js` exports `TRACKS`, arrays in display order of `{id, ...}`; the phone reads `name` or `names {it, en}`, `driver`, `stats`, `color`, `region`, `blurb`.
- Test hooks of the pad page: `window.__pad` has `state`, `slot`, `joined`, `phase`, `screen`, `menu`, `lang`, `awake`, `item` and `geometry()` (viewport px: `sx, sy, R, dead` for the stick, `bx, by, br` for USE ITEM, `dx, dy, dr` for DRIFT), and `carousel` (`{ids, focus, ready, rect(id), readyRect()}` of the screen on show).
- Phone menu: pick a kart from a swipeable carousel (its name, driver, stats as chunky bars, a rendered PNG from `tools/shoot.mjs`, stored in `assets/ui/karts/<id>.png`), ready; vote for a track with the same carousel; then the phone becomes the controller.
- Keyboard for development: player 1 WASD, Shift drift, E item. Player 2 arrows, Right Ctrl drift, Enter item. Players 3 and 4 use IJKL + U/O and numpad 8456 + 7/9. Mouse clicks work on the TV menus too.

Reconnection keeps working as in Summit Descent: a phone that comes back takes its slot; while it is gone its kart slows gently and the TV says who is missing.

### Game flow (`src/game/flow.js`, `src/main.js`)

1. **Lobby (TV)**: logo with a cartoon mountain scene, QR and address, four coloured seats filling up as phones join, the options: difficulty (Facile, Medio, Difficilissimo), bots (0 to 7 with 8 as the default field), laps (2, 3, 5), race or Gran Premio. Language switch.
2. **Kart pick**: on the TV a line-up of all nine karts on a turntable, each player's pick shown in their colour; on the phone the carousel. Ready when everyone has confirmed.
3. **Track pick**: track vote like Summit Descent's mountain vote (a coin between differing votes, or random). On the TV: big cards with the track's look and its region's name.
4. **Race**: a flyover with the track name, countdown, race. When all humans finish (or 30 s after the leader with only bots left), results.
5. **Results and podium**: time table, points in Gran Premio (10, 8, 6, 5, 4, 3, 2, 1), a podium scene with the top three karts and the drivers cheering, confetti. Rematch or change track by phone or TV. Gran Premio (asked by the owner 04/11/2026): the players choose how many tracks and which ones, from 2 up to all of them, on the phone or the TV, with quick presets (a region, all, random N); the order is the order picked; cumulative table after each race, a final podium.

On the TV the results lead to the podium by themselves after 9 s, or at a press, unless a Gran Premio has more races. Under the TV's podium of a single race the phones stay on their `results` screen, which is the one that offers rematch and change track; the phone's `podium` screen is the end of a Gran Premio. Gran Premio from the phone: confirming a track adds or removes it from the list (the host answers with `menu {lock:false}`), confirming the `random` card starts it, and a list that is too short is filled with a random draw. A phone gone 15 s has a bot driving its kart until it returns; its seat is given up after 60 s or on the way to the lobby.

`window.__game` also has `speed` (fast forward), `counts` (events by type), `rescue(i)`, `draw()`, `skipFlyover()`, `setScript(fn)`, `setAuto(on)`, `drive(i)`, `setPaused(on)`, `next(kind)`, `give`, `teleport`, `spinItem`, and more query params (`players`, `views`, `laps`, `seed`, `lang`, `flyover=0`, `countdown`, `manual=1`, `quality`): see `docs/testing.md`. `tools/shoot-ui.mjs` shoots every TV screen and audits the text on it.

Works with: one player with bots (full screen), four players with zero bots, a phone leaving and returning, and with no phone at all from the keyboard. `?track=bali&kart=jeep&bots=7&difficulty=hard&auto=1` skips menus for tools. `window.__game` exposes state and an `advance(n)` stepping hook for tests (with the rAF loop stopped, flag `manual`, or scripted inputs get re-read, a bug that bit Web Swing).

### Audio (`src/audio/`)

Everything is live WebAudio, no files; it starts on the first gesture on the TV page. With no gesture on the TV, it asks for one click with a friendly sticker the first time.
- `createAudio()`: `{ unlock(), music(name), onEvents(events, state, views), update(state, dt), setVolume(group, v), lastLap(on), dispose() }`. Master bus with a soft limiter and a light generated convolution reverb. Everything is guarded and tolerant of missing fields, and before `unlock()` every call is a silent no-op that only remembers the wanted music and volumes, so it starts at the first gesture.
  - `music(name)`: a track id, `menu`, `results`, `podium`, or `null` to fade out; a region name falls back to that region's first track, so pass the track id, not `def.music`. It crossfades and resets the last lap tempo.
  - `update(state, dt)`: every frame during a race; if it stops for 0.5 s the engines fade out by themselves. `views` is the last list given to `onEvents` (human player indices; the human karts if none was given).
  - `setVolume(group, v)`: `master`, `music`, `sfx`, `engine`, v in 0..1. `lastLap(on)` speeds the tune up by 7%; a `lastLap` event for a kart with a view does it too.
  - `onEvents` also takes the screen events `{type:'click'|'move'|'back'|'confirm'}` and `{type:'cheer', id:<kartId>}` for the podium, with no state needed.
- Engines: one voice per view (a fun, chubby two-stroke hum with pitch by speed; each kart has its own timbre: steam chuffs, tracks, bell, sail flap), other karts are cheap positional blips. Drift skid noise, boost roar, surface noise.
- Effects: original, playful, with character. Box take, roulette ticks, each item's use and hit, sambal's rude fire trumpet, the bubbling rendang pot, the rumble of the frana, sizzling pan, sausages on a grill, sips and a hiccup for grappa and țuică (`hic!`), cheese rumble, stink cartoon puff, chilli flame, cowbells, sheep, monkeys, bats, steam, lap chime, last lap fanfare, finish, countdown beeps, menu clicks. Little voice blips per driver for hits and cheers (gibberish synth, pitched per driver, never words).
- Music: original compositions, not arrangements of any game's music and not of any existing song. Traditional dance forms and scales are fine:
  - `cadore`: oom-pah Alpine feel, polka or Ländler: accordion, clarinet, tuba, cowbell accents.
  - `romania`: hora or sârbă energy, a taraf feel: țambal (hammered dulcimer via Karplus-Strong), fiddle, nai pan flute, Romanian minor scale, offbeat kontra.
  - `indonesia`: gamelan: pelog or slendro metallophones (FM bells), gongs, kendang drums, with an upbeat kart energy, interlocking kotekan patterns; Bali and Bromo each with its own mode.
  - `menu`: a cheerful theme that mixes accordion, țambal and gamelan bells; `results`, `podium`: short stingers.
  - Each track its own tune (6 in all) of at least 32 bars, loops without a seam, speeds up slightly on the last lap. Balanced to stay pleasant over minutes, under the effects.
- `tools/audio-check.mjs` renders each tune and effect in an `OfflineAudioContext` in headless Chrome and reports peak, RMS, clicks at the loop point and silence, because an agent cannot listen. It also writes WAVs to `docs/audio/`.

### Tests and tools

`npm test` runs everything with `node --test`, browser tests with `tools/harness.mjs` (Metal GPU headless). Must be green before anyone says done.
- `sim`: determinism (same seed gives byte-identical state), kart physics sanity, each item's effect with a scripted setup, each difficulty, bots finishing on every track.
- `world`: every track: closed, no self-intersection on the same level, band count 3 or 4, road above the terrain, slopes drivable, lap length in range.
- `net`: four slots, a fifth waits, reconnection, the new messages sanitised.
- `pad`: the page with touch in Chromium: stick, item, drift, kart carousel.
- `render`: each track and each kart builds without errors, stats under budget.
- `e2e`: the real server as its own process, four phones in real pad pages driven by touch from a simple driver that reads the host state: lobby to podium and rematch; a phone dropping out and returning; one player with seven bots at each difficulty; the keyboard alone. `npm test` runs the files one at a time, because these run in real time on the GPU.
- `disasters`: every kind on a flat ring and every track's real entries: determinism, the telegraph, a free line for all karts at every arrival, the way back up, frequency, protected places, bots by level, each kind's own sound. `disasters-render`: each kind on the real page draws in budget, the HUD names it, its sound is fired.
- `karts`: every kart and item builds, stays under 3500 triangles, one mesh per kart, poses move the bones, what the items do to a driver, the Logan's three boxes, the horse's gait, the cosmetic objects, the sail, icons parse, the real composite and the turntable's ink draw them, the UI PNGs are transparent.
- `tools/shoot-race.mjs [scenes] [2v] [4v]`: the real game with each item in use, at 1, 2 and 4 views: `docs/shots/race-*.png`.
- `tools/shoot-karts.mjs [--sheets large,back,small,poses,react,gait,items,spills,icons] [--png] [--only ids] [--pose names] [--dir path]`: `docs/shots/karts-*.png`, `items*.png`, `icons.png` and `assets/ui/karts/<id>.png`, through the real toon pipeline (`dev/karts-dev.js`); `small` is the race camera at the true size of a 4-way split, `react` the pan and the burnt face, `gait` the horse over a stride.
- `tools/shoot.mjs <track> [--views n] [--t seconds] [--at u] [--pose x,y,z,lx,ly,lz[,fov]] [--flyover 0..1] [--shots list.json] [--dir path]`: screenshots into `docs/shots/`, bundled through `tools/render-dev.mjs` into a private temp folder on a free port. Agents must LOOK at their screenshots with the Read tool and judge them against the reference pictures; "the test passes" is not the bar, delight is.
- `tools/shoot-disasters.mjs [scenes] [--size WxH] [--dir path]`: each kind through the real game page, and 2 and 4 views: `docs/shots/disaster-*.png`.
- `tools/playtest.mjs`: a bot drives from a real pad page, records a report: average speed, stuck time, items used.
- `tools/perf.mjs [track] [--views 1,2,3,4] [--seconds n] [--capped] [--quality auto] [--sweep]`: frame times on the Metal backend, each frame closed by a one pixel read so that the GPU's work is in the number, worst draw calls and triangles per view against the budget, `--sweep` round the whole lap. Close other GPU users first; fps measured while another agent renders is dirty.

Two agents rendering at once dirty the fps numbers but do not break anything. Use a private port (`PORT=0` picks a free one) and a private build folder (`DIST=<tmp>`) when you run the game, so agents do not step on each other's `dist/`.

## Who decided what

Asked for by the owner: the name Racing Karts (folder `racing-karts`), six more long tracks of 5 to 10 km in a third phase, landslides and real disasters, phone joystick architecture, kart racing, Romania, Indonesia and Borca di Cadore mountains with real references, 3 or 4 maps at least, kart choice inspired by the mountains, 1-4 players or AI, easy / medium / very hard, boxes in 3 or 4 bands per lap, rocket that chases the kart ahead, grappa, țuică, mici, uova speck e patate, music and sound effects, cartoon style like the drop game.

Choices made by Claude (he can overrule them): six tracks (two per region), nine karts and their drivers, the extra items polenta, formaggio, durian (later changes by the owner: speck joined to eggs and potatoes as one dish, gong replaced by rendang, sambal's fire fart, completely random assignment), what mici and țuică do exactly, real DEM skylines, the disaster for each track, automatic acceleration, synthesised audio, Gran Premio, IT and EN.

Additions from the Jakarta fixes, all off by default: `look.deck.style: 'concrete'` with `deck.color`, `deck.barrier`, `deck.span` (`src/render/concrete-deck.js`); `look.road.noKerbOn: <surface>`; `ground.river.walled`; `src/render/signwriter.js`, a stroke alphabet for signs in geometry; in `src/render/traffic.js`, vehicles that overlap within 130 m of a camera are drawn up to 1.1 m apart, the sim's own position unchanged; `tools/panoramas/jakarta-paint.py`.
