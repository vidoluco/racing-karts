# Building a long track

For tracks of 5 to 10 km. One line switches the engine on; a short track that does not have it behaves exactly as before. Read this with `docs/backdrops-howto.md`: backdrops work as on any track.

## Start

| Step | What |
|---|---|
| 1 | In the def: `long: true`, and leave `itemBands` out: a band every 500 m comes by itself, stepped off jump lips. Give `itemBands` only to place them by hand |
| 2 | Add the row to `TRACKS` in `src/data/tracks.js`, after the first six. `test/world.test.mjs` then checks it: 5 to 10.5 km, slopes, bands, grid |
| 3 | `node tools/plot-track.mjs <id> /tmp/<id>.png`, and look: shape, profile, `pointU` of every control point |
| 4 | `node tools/long-check.mjs <id>`: a whole lap at 1, 2 and 4 views against the budgets. It must end with exit code 0 |
| 5 | Screenshots with `tools/shoot.mjs`, at many `--at u`: a long lap has many places where nothing has been looked at |

The race is one lap (`?laps=` still overrides it for tools), and the HUD says the kilometres to go.

## Road

| Rule | Why |
|---|---|
| Control points about every 40 to 120 m | Same spline as short tracks; a 10 km lap has 100 to 250 points. Generate stretches with small pure functions in the track file if it helps, as `test/helpers/long-track.mjs` does |
| Two levels at a crossing at least 6 m apart, and at least 130 m apart along the road | `nearest` with a hint looks 64 m each way. The upper one is tagged `viaduct` or `bridge` |
| Keep the map within about 4 km by 4 km | The shade map is one 4096 texture over the road's box plus 300 m: at 3.5 km a texel is about 0.9 m and it still looks right; at 8 km the shadows of trees would be mush |
| Place things in metres | `u = metres / track.length`, so moving a stretch moves what is on it. `track.pointU[j]` gives the control points |
| `def.horizon.panelDistance` close to the real distance of the great mountain | Default 6000. On a world 3 km wide that default slides the panels by tens of degrees as you drive: use 12000 to 25000 and look at the far ends of the map |

## Landmarks

Same file, same `plan` and `build` as a short track (spec, Tracks). What changes is that `ctx.batch` is now cut into cells of 320 m, and each cell is drawn only near a view.

| Call | Drawn |
|---|---|
| `batch.add(g)` | Up to 1100 m from the camera, then gone |
| `batch.add(g, { low })` | `g` up to 500 m, then `low`, up to 1100 m |
| `batch.add(g, { far: true })` | To the horizon. For what is seen from afar, a castle, a palace, a tower. Few of them, and always with `low` |
| `batch.add(g, { far: true, low })` | `g` near, `low` from 500 m to the horizon |
| A mesh added to `world.staticGroup` | Up to 1100 m, as one draw call |
| Anything added elsewhere | Always. Do not |

| Do | Do not |
|---|---|
| Keep a cell under about 40k triangles, or give it `low` | Merge a whole district into one geometry: over 320 m across it is drawn from everywhere near it, as one piece |
| Budget `update(time, dt, karts)` by distance from `karts`, as traffic must | Loop over `track.n`, or over every prop of the lap, per frame |
| Use `track.nearest(x, z, hint)` per frame | Keep hundreds of `InstancedMesh` entries with `frustumCulled = false`: they are drawn in every view |
| Several hundred `keepOut` and up to a couple of hundred `groves` | Thousands of groves: every ground vertex and tree candidate looks at each |

Per view the budget is 500k triangles and 150 draw calls. Trees take what the rest leaves: above 450k the far bands thin out per view, down to 30% of their number, so an overfull stretch shows as a sparser far forest before it shows as a broken budget. `long-check` prints the worst figures of the lap.

## Options

`long: { ... }`, all in metres from the camera, defaults in `LONG_DEFAULTS` in `src/render/stream.js`.

| Key | Default | What |
|---|---|---|
| `bandEvery` | 500 | Between bands of crates |
| `groundNear` | 300 | From a 1 km ground cell, fine chunks replace its coarse mesh. Up to about 600 costs about twice the triangles |
| `roadNear` | 300 | The same for a 512 m stretch of road |
| `statics` | 1100 | Where cells of landmarks stop. A city wants less with `low`, an open plain more |
| `detail` | 500 | Where a cell swaps to `low` |
| `water` | 2600 | Chunks of water |
| `release` | 1100 | Past this, near geometry gives back its GPU buffers |

With `look.mist.amount` at 1 nothing is drawn past `look.mist.to`, the cheapest horizon there is. Below 1 the coarse ground goes on to the camera's far plane, as on antelao's look, whose far hills show through the mist.

## Hazards, traffic, items

| What | How |
|---|---|
| `def.hazards` | As on short tracks, more of them: spread them along the lap, not one per band. Each is simulated all the time, and drawn only within 650 m of a view |
| Traffic (Jakarta, Bucarest) | `def.traffic`, see below. A pure function of time: no agents are stepped, so its cost does not grow with the lap |
| Leader's razzo | Flies at most 2400 m (`RAZZO.sweepLong`), not the whole lap |
| Last kilometre | A `lastLap` event: music, phone and a banner |

## A river in a flat city

`ground.river.walled: true` cuts a canal and no valley: the default digs a wide valley round a river, which in a flat city turns into 170 m of empty sunken plain. Water must sit 2 m under the lowest road on land, so a deep underpass sinks the river with it: keep the underpass shallow. A canal seen from a lane wants a sloped bank, not a wall: the slope is what lets a low camera see the water. `src/render/landmarks/jakarta.js` draws the bank and a coping that covers the ground grid's teeth.

## City traffic: `def.traffic`

`src/sim/traffic.js` does what vehicles do, `src/render/traffic.js` draws them, `src/render/vehicles.js` holds the models. To reuse it on another city, write the data and pick the models; there is nothing else to wire. `jakarta.js` is the worked example.

```js
traffic: {
  jams: [{ from: ['sudirman', 60], to: ['sudirman2', 430], k: 0.42, ramp: 110 }],   // the road squeezes here: slots bunch up and slow down by k
  lanes: [{ from, to, d: 5.3, dir: 1, speed: 11, gap: 25, fill: 0.8, mix: { car: 5, angkot: 2 }, weave: 0.1, swarm: 0.3, swap: 1.3, wave: 1 }],
  crossings: [{ at: ['crossing', 2], period: 36, warn: 5, pass: 5, half: 7 }],      // a train across the road
  showTrains: [{ at: ['dukuh', 72], y: 4.5, period: 40, reach: 340 }],              // only scenery
  rain: { chance: 0.7, first: 40, spread: 110, len: 95 },
}
```

| Rule | Why |
|---|---|
| `from`, `to`, `at`: a fraction of the lap or `[markName, metres]` with `def.marks` | The lanes survive a change of the road |
| Leave a gap: car and bus lanes with a kart's width between them, then fill the gaps with bikes as thick as you like | `test/traffic.test.mjs` asks that what can stop a kart leaves a gap across 97.5% of every 6 m of road, no wall deeper than 36 m. Bikes do not count: they are never a wall |
| Plain scooters swerve, loaded bikes scatter, cars scrape, heavy vehicles spin you out | `heavy` 0, 1, 2 and `load` in `VEHICLES`: a scooter just ahead of a kart gets out of the way at no cost (`PART_T`, `PART_W`), so the swarm opens like water and the rule is one you can read: what carries a load does not dodge |
| Time decides position; a knocked vehicle is the only state, `state.traffic.knocked` | Same seed, same race; nothing costs anything until a kart or a camera looks |
| Vehicles between a chase camera and its kart are not drawn | `CLEAR_AHEAD` in `src/render/traffic.js`: the sim still has them |
| Budget: near model under 24 m for a bike, 36 m for a car, 52 m for a bus, 18 scooters and 9 ojek at most; a bike and rider of about 280 triangles to 58 m; a box of 24 beyond; 430 m cut | 24 draws for the traffic in a view, about 5000 vehicles live on 8 km, 1000 or so in reach of a camera. A city also wants `long: { statics: 620, detail: 296, groundNear: 230, roadNear: 250 }` to stay under 150 calls and 500k triangles |
| Thousands of small roofs in `Blocks` of their own | A cell with a tower in it has a radius over its size and is drawn to the horizon with its `low`; roofs in the same block go with it and cost 150k triangles across the map |
| Dress only what is seen | A tower's street face and approach end, the faces of a house that look at the road: `jakarta.js`, `tower` and `hutRoof`. Back faces of offices are skipped altogether |
| Lane keys for a rabble | `jit`: a slot sits up to this share of `gap` off its place, or a rank of bikes looks like a parade. `lift`: m over the road, for a pavement lane. `dir: -1` on the pavement: half of them are going the wrong way |

Events: `honk {kart, veh, horn, x, y, z, seed}`, `traffic {kart, veh, kind, x, y, z}`, `crossing {kart, phase}`; hit causes `traffic`, `train`. Bots use `trafficAvoid` (a cost row across the road, looking at future positions). A wider road than the default: `def.roadRange: [min, max]`.

## Done means

`node --test test/world.test.mjs test/sim.test.mjs`, `node tools/long-check.mjs <id>`, and looking at it. For reference, the synthetic 10 km lap with a house every 30 m on both sides on this Mac, at 1, 2 and 4 views: about 210, 135 to 185 and 120 to 140 fps while other agents were rendering, 83 calls at worst, 479k triangles at worst, frames at chunk borders no slower than the others, memory growth under 1% along the lap, every kart home, load under a second.

| Tool | For |
|---|---|
| `node tools/long-check.mjs [id] --views 1,2,4 --speed 4` | The whole lap. Prints frame times, frames with a stream change against the others, worst calls and triangles, memory along the lap, who got home |
| `node tools/perf.mjs <id> --views 1,2,4 --sweep` | Real time fps, the budget at 100 places |
| `?track=<id>&hud=1` on the dev page (`dev/render-dev.js`) | The real race HUD, `__dev.stepDraw(n)` steps and draws |
| `R.stats().stream` | Items, what is warm, bytes on the GPU, swaps so far |
