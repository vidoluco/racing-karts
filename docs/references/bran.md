# Bran sotto la Luna: references and where things stand

Track file: `src/world/tracks/bran.js`, landmarks `src/render/landmarks/bran.js`, panorama `tools/panoramas/bran.json`. Plot it with `node tools/plot-track.mjs bran out.png`. Positions are fractions `u` of the lap; read exact places from `track.pointAt(u)`, because numbers here drift if the road is retuned. Facts on the place are in `romania.md`.

## The real place

| Fact | Value | Source |
|---|---|---|
| Track origin | 45.505 N, 25.3175 E, the pasture hill west of Bran, which sees both massifs | `romania.md`, DEM |
| Real altitude of y = 0 | 943 m | Copernicus GLO-30 at the origin, read 05/11/2026 |
| Omu, top of the Bucegi | 45.4456, 25.4563, 2505 m. Bearing 121.3, true elevation 7.0 deg | OSM, computed |
| La Om, top of Piatra Craiului | 45.527, 25.2117, 2238 m. Bearing 286.6, true elevation 8.6 deg | OSM, computed |
| Castelul Bran | 45.5151, 25.3671, on a 60 m spur, built by Brașov Saxons in 1377. Queen Marie's home from 1920 | `romania.md`, photo `bran-ref-castle1` |
| The castle in front of the Bucegi | The real view: File:Castelul din Bran si Muntii Bucegi.jpg, from the hill behind the castle, April 2016, with snow on the wall | Commons |
| Hay stacks round a pole, căpițe | The real farm form of Peștera and Măgura | File:Piatra Craiului Pestera.jpg |
| Babele, Sfinxul | 14 km SE on the Bucegi plateau, in reality hidden behind the wall: a set piece, brought to the road (spec) | `romania.md` |
| Saxon houses, fortified church | Viscri, Hărman, Prejmer, 33 km and more: a cartoon mix (spec) | `romania.md` |
| Poarta maramureșeană | 250 km north: a gift from the Mocănița's country (spec) | `romania.md` |

The layout is a cartoon of these places, not a survey. What is true: the bearings of the two massifs, and the order in the first view, castle on its rock with the Bucegi wall behind it. What took the licence: the road (the DN73 does not go round the rock), the distances, and both summits raised over their true elevation, with the whole skyline, as the long lens of the photos does: Omu 13 deg against a true 7 (9.5 from the castle itself), La Om 12.5 against 8.6. They stay under the chase frame's 24.45 and each is written in `compressed`. The moon stands over the castle (bearing 94, painted in the panorama), the key light comes across the road (bearing 205) so that the walls are lit: a licence too. `horizon.northDeg` 31 lays `a`, the valley axis, along the line from Piatra Craiului to the Bucegi.

## The lap

| u | What | Landmark |
|---|---|---|
| 0.00 to 0.09 | Market street, heading at the Bucegi with the castle ahead on the left and the moon over it | Start gate, stalls (wool, cheese in bark, pots), Bran houses with galleries, strings of lanterns |
| 0.09 | Under the stone arch you will cross at u 0.43, 15 m clearance | The arch is `viaduct` u 0.405 to 0.46, it also spans the Turcu |
| 0.12 to 0.39 | The castle ring: always left, always climbing, cobbles, the crag on your left hand | 3D crag and castle, firs in the folds of the rock, posts with lanterns on the outside |
| 0.405 to 0.46 | Over the arch, over the market, over the river | Lanterns on the parapets |
| 0.46 to 0.61 | The firs, sweepers, the dip at u 0.55 where the bats cross | Thick wood, sign LILIECI, lanterns |
| 0.62 to 0.74 | The high pasture on a shelf: open on both sides, jump at u 0.633, Piatra Craiului whole over the drop | Căpițe, rail fence, sleeping flock, a shepherd's hut |
| 0.725 to 0.785 | The hairpin; the dirt track cuts inside it, past the stones of Babele | Babele, the Sphinx on the lip outside the hairpin |
| 0.785 to 0.82 | The gorge bridge over the Turcu | Stone arches, lanterns |
| 0.87 to 0.95 | The Saxon village: long pastel fronts gable to the street, castle and Bucegi dead ahead | Cart gates, the Maramureș gate across the road at u 0.893, the fortified church on the left at u 0.915 |

## What moves

Lanterns hang free, frames and glass in two instanced meshes, swung per frame in the landmarks' `update`: a breath of wind always, hard when `world.quake` (0..1) is up. Sixteen bats circle the castle's towers and never come down; the ones that cross the road at u 0.54 are the sim's hazard. The castle and the fortified church are scenery: nothing in the sim reaches them.

## Photos

Used in the panorama, credits in `assets/backdrops/CREDITS.md`: `bran-buc-culoar` for the Bucegi (the Rucăr-Bran corridor looking at the wall, Omu raised to 15 deg as the long lens sees it, true 7), `bran-pc-kamm` for the saw-toothed crest of Piatra Craiului. Left out after the first critique: `bran-castle-buc` and `bran-pc-west`: the first read as a snowy lump once the castle was cropped off, the second as a far smooth ridge. References for the modelling only: `bran-ref-castle1`, `bran-ref-prejmer`, `bran-ref-babele`, `bran-ref-sphinx`.

The night: moon at bearing 96, elevation 18.5, a screen aligned sprite in the game and only a glow in the panorama; the key light at bearing 152, on the moon's side of the sky, cold and low. The rock is smooth tilted limestone with moss and trees on its ledges, a tan grey in the moon. The market and the village stand on made ground (`def.ground.flats`): a licence of the game, so that the houses of the low side stand on their street.

## 06/11 correction round (q-bran-fix)

The two Gemini repaints are out of the recipe. `tools/panoramas/bran-dem.mjs` writes the ground on a metre grid, `tools/panoramas/bran-paint.py` renders each massif along its true bearings: the outline is the real skyline, raised by one factor (Bucegi 2.64 with its crest softened over 2130 m and 1.28 wider about Omu, Piatra Craiului 1.7 and 1.18 wider). Omu now stands at 15.5 deg, La Om at 14.5. Outlines compared with `bran-castle-buc` (from behind the castle), `bran-pc-kamm`, `bran-pc-haupt`.

The castle is the real squat lopsided silhouette at scale 1.22 on a rock of top 42 m clothed in beech, with pale patches (`castleRock`, `palePatch`); spurs and the watch tower are gone. No house stands on the castle's side of the street between u 0.04 and the arch. The church is Prejmer: low thick ring, one huge cross roof. `look.camera.chaseUp`, `chaseBack`, `chaseLook` are a new shared option, default the old camera. `dev.at` and `shoot.mjs` take `spread` to place rivals for a shot.
