# Real backdrops: from a photo to a panel in the game

Binding section of the spec: "Real backdrops". `antelao` is the worked example: read `tools/panoramas/antelao.json` and the `backdrops` list in `src/world/tracks/antelao.js`. A critic given only race screenshots must be able to name the place, so this is the most visible thing on a track. Expect to iterate, and look at every step with Read.

## The steps

A track's backdrop is one continuous painted panorama, 360 degrees, cut into tiles. Nothing fades into anything: every direction is painted, so no panel can end in air.

| # | What | Command or file |
|---|---|---|
| 1 | List the views that matter: the famous mountain, what stands in each other direction. Get lat, lon, altitude from `docs/references/*.md`, or Nominatim | `curl -A RacingKarts 'https://nominatim.openstreetmap.org/search?format=json&q=Croda+Marcora'` |
| 2 | Find photos of that exact place | `node tools/fetch-photo.mjs --search "Pelmo Borca di Cadore"`, `--category "Monte Pelmo"` |
| 3 | Download the candidates, then look at them side by side | `node tools/fetch-photo.mjs pelmo-borca "File:Borca di Cadore.jpg"` |
| 4 | Bake the real skyline: it fills all that no photo covers | `node tools/bake-horizon.mjs <track>` |
| 5 | Write the recipe: the photos in order, back to front, with width, crop, and per-photo paint arguments | `tools/panoramas/<track>.json`, see "The recipe" |
| 6 | Compose. It prints the panels on stdout, and the MB, the true figures and the photos per tile on stderr | `python3 -I tools/compose-panorama.py tools/panoramas/<track>.json --preview /tmp/p.jpg > /tmp/panels.json` |
| 7 | Look at the preview, then paste the panels in `def.backdrops` | track file |
| 8 | One row per tile in `assets/backdrops/CREDITS.md`, with every photo the tool says reaches that tile; the test looks for `| <file> ` at the start of a line | CREDITS.md |
| 9 | Turn the road: choose `horizon.northDeg`, and recompose if the sun changes | see "Turning the road" |
| 10 | Look at it from all round the lap, at 1, 2 and 4 views and from the flyover | `node tools/shoot.mjs <track> --shots list.json --dir <tmp>` with entries like `{"at":0.3,"out":"a"}`, `{"views":4,"at":0.3,"out":"b"}`, `{"flyover":0.75,"out":"c"}` |
| 11 | Test and budget | `node --test test/backdrop.test.mjs`, `node tools/perf.mjs <track> --views 1,2,4` |

Python: always `python3 -I`, with the script outside the photo folder, because these are downloaded files. Originals go to `data/raw/backdrop-photos/<id>/` with a sidecar json (gitignored); only tiles are bundled.

## How the panorama is painted

`tools/compose-panorama.py`, on one cylinder at `ppd` pixels per degree, painted at 1.5x and area-downscaled, back to front:

| Layer | What |
|---|---|
| Sky | The elevation table of the preset (`sky_el`), with clouds that wrap round |
| DEM | The real ground from `data/horizon/<id>.bin`, rendered by ray in the same paint. It is why no ridge ever ends in air |
| Mountains | Every photo goes through `paint-photo.py` `planes()`, so they are all by one hand; a finished repaint stays as it is (`painted: true`, its sky goes along the pen line; antelao's hero, see "A hand repaint as the hero"). Each has its summit at its true bearing and elevation, cut along its ridge. Near its sides the ridge falls to the DEM's skyline. Before any photo is laid, the DEM nearer than `clear_dist` is cleared behind all of them, so the DEM's version of a mountain does not stand up behind the painting, the far ranges stay, and a clearing never bites a photo already laid |
| Forest | One painter, `paint_forest`: a dark mass, light that follows the fall line, soft larch drifts, low contrast tree stamps, and air toward the distance. The forest of the photos, of the DEM and of the belts is all this one, so no two greens meet |
| Near DEM | `front_dem`: the DEM's forest nearer than `dist` is laid back over the mountains, except on the bearings in `except` (the feet of the great mountains); the reach shrinks over `fade` degrees toward them, so there is no notch. A far slope never lies over a nearer ridge |
| Belts | Opaque forest in three bands, paler and bluer with distance (`air`, `foot_air`). They lie over the foot of every mountain and are what the 3D treeline stands against. `walls` give them the long straight slopes of a narrow valley, falling toward the two great mountains; `villages` paints small houses and a tower on a band, at a bearing and elevation |

Then it is cut into tiles with `edge: 0`: their identical pixels meet with no fade, and the DEM ring is switched off once they cover the circle (`backdrop.covers`). If one tile fails to load, `covers` is false and the ring stays to fill it. Parallax is per pixel against one cylinder of radius `horizon.panelDistance` (default 6000), so tiles never slide on each other.

## The recipe

| Key | Meaning | Antelao's |
|---|---|---|
| `ppd`, `topTan`, `bottomTan` | Pixels per degree, and how far up and down the cylinder goes in tan(elevation) | 30, 0.6, -0.052 |
| `preset` | Colours of the hour in `paint-photo.py` | `golden` |
| `sun: { bearing, elevation }` | The sun that lights the DEM and sets the sunny side of the trees. Keep its bearing the same as `look.sun` | 225, 21 |
| `compress: { from, factor }` | DEM elevations over `from` degrees are scaled by `factor`, so the DEM agrees with the compressed photos | 10, 0.68 |
| `tiles: { file, centers, half, edge }` | Tile names and their centres; `half` over 30 leaves a degree of overlap | 6 tiles, 31, 0 |
| `front_dem` | `dist` m, `except` bearings, `fade` degrees: see Near DEM above | 3500, 355 to 140 and 196 to 282, 22 |
| `belts` | `base`, `amp`: height of each band in degrees; `tree`: tree size in px (0 is forest in mass); `air`, `foot_air`; `larch`: how much gold; `seed`; `dips: [bearing, width, by]`; `walls: [bearing, reach to lower bearings, reach to higher, height]`, `wall_power`: under 1 a wall stays steep longer; `villages: [{ bearing, el, spread, houses, size, seed, tower }]` | 3, 2.6, 2.2, 1.4; air .55, .42, .28, .05; `ink` on all four |
| `mist` | The panel's `mist` value, the colour the far 3D world turns into. Match the forest of the belts or the far 3D slopes stand out in another colour | `#3d4a64` |
| `photo_tree` | Tree size in px on the forest of the photos | 6 |
| `preset_over` | Colours of the preset this panorama takes from its hero repaint (`sky_el`, `rock_i`, `spruce_m`, `larch_m`, the air, `ink`) | read off the repaint |
| `dem_clear` | `[[from, to, fade]]`, bearings where the real land goes back to sky: where the DEM would stand up next to a painting | three stretches |

A mountain: `id`, `file` (under `data/raw/backdrop-photos/<id>/`), `painted`, `style` (`illustrate` for the older painter, default `planes`), `summit`, `width`, `crop`, `fall: [left, right]` (degrees over which the ridge falls to the skyline), `haze` (0..1 toward the air of distance, a far mountain is paler than a near one), `drop_veg` (leave out the photo's own forest), `args` (any `paint-photo.py` parameter, with `_` for `-`). Change as little per photo as possible.

When the eye has to help, on a photo with thin cloud or a forest that reaches the crest: `ridge_hint` (`[[u, row], ...]` in fractions of the photo, traced by eye; the true ridge is found within `ridge_win` of it), `veg_hint` (the line under which ground may be forest, so a rock band stays rock), `veg_force_hint` (under this it is forest whatever the tone). `foot: [from, to, amount]` (elevations in degrees: the rock goes toward the air by `amount` as it comes down to the forest), `forest_air` (air on the forest of this photo), `clear_dist` (see Mountains). `flank: { id, file, x: [u0, u1], width, ridge_hint, veg_force }` joins a piece of a second photo at the right edge when the first one ends too soon: the ridges are aligned, 2 degrees of crossfade, and the composer prints both files for the credits. Never mirror a photo to extend it: the symmetry shows at once.

Later photos lie over earlier ones: put the great mountain last.

## Choosing a photo

- A photo from where the track is, of the summit as people photograph it. "Borca di Cadore.jpg" shows the Pelmo as Borca sees it: better than a sharper picture from the wrong side.
- A clean sky behind the ridge. Clouds on the crest confuse the sky finder and hide the shape; `monti-borca`, with cloud across the face, was refused.
- Rock lit from the side shows its shape. A snow dusting makes pretty ledges but turns the mountain into another season: match the track's season.
- The viewpoint decides. It has to feel like being down there, on the road, under the mountain: the Antelao from San Vito, seen from high up, was a postcard however well it was painted. Then a photo from the valley's own level (Pian de Stau) was recognised by nobody: head on, the Antelao is a blunt double summit split by a shadow gash. The shape won: the hero is now a repaint of the San Vito view, the single pointed asymmetric pyramid with its long ridge, and with the valley's forest laid over its foot and the 3D world in front it stops reading as a postcard. Look for the mountain's signature before you look at sharpness or viewpoint, and ask someone who knows the place.
- Several images per track: a track turns through 360 degrees. Two on antelao (both real photos through `tools/panoramas/antelao-paint.py`, flat soft planes with no pen, because inked mountains read as another game beside the plain 3D foreground), six tiles and 1.6 MB; budget is 3 MB, 8 tiles at most. A direction that has nothing famous gets a forest wall: a mediocre peak reads as a wrong copy of the great one. The Bosconero and La Rocheta were dropped for this.
- Treatment: one painter for all the mountains on a track, `planes()`. A Gemini repaint from a photo is worth using when its shape is right and every other mountain can be brought to its hand; two painters side by side read at once as two art styles, so read the sky, rock and forest colours off the repaint and give them to the rest (`preset_over`). Never prompt-only invented views.

## A hand repaint as the hero

The repaint must come from a real photo, with the photo's shapes. antelao's: `data/raw/backdrop-photos/antelao-gemini2/antelao-repaint.jpg`, from the `antelao-sanvito` photo.

| Step | What |
|---|---|
| Ridge | `python3 -I tools/trace-ridge.py <repaint> tools/panoramas/<track>-ridge.json --check /tmp/r.jpg`, look at the line, then `ridge_file` in the recipe. `pen_ridge`, the default, ate the summit: a pale crest breaks the pen and spikes down |
| Recipe entry | `painted: true`, `summit` with `elevation` and `compressed`, `width`, `crop` to drop the foreground, `fall` for the sides, `fall_pen` (the pen only where a side has fallen, its crest is inked already), `source_photo` for the record |
| Lesser mountains | `squash: { foot, at: [[u, k], ...] }` brings them down to k of their height over the row `foot`, ridge and paint together. The only redraw allowed, and only on what is not the hero |
| Sky | Sample the repaint's sky by row, convert to elevation at the width you chose, write it in `preset_over.sky_el` and in `look.sky.stops`, set `cloud_bank: 0`. The sky the crest is cut out of then matches, and no halo shows |
| Its sides | A repaint has hard sides. A forest wall in the back belt must stand over each one, `walls` falling toward the hero, and `dem_clear` removes the DEM behind it; `front_dem.except` must cover the cleared bearings or the near DEM comes back as a slab with a vertical edge |
| Its foot | The belts lie over the foreground. Raise them with `dips` of positive `by` round the hero: forest that climbs the foot is the signature, and it is what the 3D trees stand against |
| Rest of the circle | Belts with `ink: { tones, sx, sy, contrast, soft, octaves, pen, tree_gold }`: flat planes under a pen line on the crest, larch one tree at a time in groves. A belt's soft or crisp larch patches (`drift`) read as camouflage at race distance; a large `sy` over `sx` reads as curtains of light. `wall_rough` breaks a wall's crest |
| Other mountains | Until they have a repaint: `rock_i` per photo in the repaint's ramp, `alpenglow: [from, to, amount, colour]` for the last sun high up, `plane_tones` and `mid` to give them the repaint's share of light and shade |
| The 3D world | Move `look.terrain`, `look.trees`, `look.sky`, `look.fog` and `mist` toward the same colours, and keep the road readable |

## Width and elevation

A photo covers `width` degrees of azimuth on a cylinder: its image height in tan(elevation) is `hy = rad(width) / aspect`. The tool places the highest point of its ridge at the summit's true bearing and at `elevation`.

- Elevation comes from the real coordinates: the test computes it (`summitTruth`) and fails if you declare another figure without writing why in `compressed`.
- Chase camera: the top of the frame is 24.45 degrees at its slowest (fov 54, pitched 2.6 down, `LOOK_UP` in `src/render/camera.js`), about 29 at top speed. Anything over it must be compressed: antelao's Antelao stands at 24, true 32, and the test enforces the limit. A cylinder's perspective lifts what stands off to a side by 1/cos of its angle from the view: a lesser peak 34 degrees off looks 20% higher, and in frame beat the hero until it was brought down (`squash`).
- Pick `width` so the mountain has its true angular width. A wider photo makes the mountain bigger across without raising it: that is the way to make it dominate once elevation is capped. The Antelao's repaint is 92 degrees wide: the summit stays at 24 and its foot goes under the belts.
- Size on screen is decided by what stands in front as much as by the painting. Keep the belts, the 3D slopes and the near trees low toward the hero: `dips` in the belts, the valley dug by `ground.shape`, clearings in the landmark's `plan`.
- A tile with no summit in it: `bearing`, `elevation`, `row`, written by the tool.

## Turning the road

`horizon.northDeg` is the true bearing of `-z`. It changes nothing in the sim: it turns the whole road against the real mountains, so it is the cheap way to make a long stretch face the great mountain. On antelao, -61 lays the valley axis along the line from the Pelmo to the Antelao: start straight, sweepers and every +a leg run at the Antelao, the sprint at the Pelmo, the viaduct at the Sorapiss group. The mountains keep their true bearings from each other and from the place.

Keep the light true: set `look.sun.azimuth: <true> - NORTH`. The test requires the hero within 30 degrees of the road's heading on 18% of the lap at least. Compute headings before shooting, it takes a minute and saves many screenshots.

## paint-photo.py parameters

`planes()` is the style to use: the photo is smoothed along the rock's own grain, gets local contrast, is cut at a few tones into flat polygons with straightened edges (the facets of a painted mountain), then takes a broad wash of light, a broken thin pen on its deepest edges and strokes down the gullies. It holds up at a glance and stands beside the toon world. The composer's defaults are at the top of `paint_photo`; run a photo alone with `paint-photo.py <photo> <out.jpg> --style planes --place w,e`, and change one thing at a time. `illustrate`, `cel` and `strokes` are older styles, kept for reference; `illustrate` shares most of the parameters below.

| `planes` parameter | What it does, and how to choose |
|---|---|
| `plane_cuts`, `plane_tones` (lists, in the recipe's `args` only) | Where the tones are cut, and the tone each band takes on the ramp. A hero wants a darker bottom tone for its gullies, a far mountain a raised one so it sits back |
| `--plane-sm`, `--plane-eps`, `--plane-min`, `--plane-px` | Smoothing of an outline, how far it may be straightened (bigger is more angular), smallest shape in px squared, scale of all sizes against 45 px per degree. Too small: gravel. Too big: wax |
| `--plane-local`, `--plane-wash` | Contrast of shapes over the broad masses of the face (lower on a far mountain, it would go blotchy), and the light across the whole face |
| `--plane-gully` | Pen on the long gullies. 0 on a face with bedding: the strokes fight it |
| `--veg-cut` | Tone under which ground at the foot is forest. With `veg_min`, it decides how much pale rock stands in the dark belt, which is the Antelao's signature |

| Parameter | What it does, and how to choose |
|---|---|
| `--preset` | `golden` has the rose rock ramp (`rock_i`), the forest of the panorama (`spruce_m`, `larch_m`, `forest_air`) and `sky_el`. For a new hour: read the track's `look.sky.stops`, write them as `sky_el`, and take the ramp from a repaint of that hour |
| `--mid`, `--gamma`, `--lo`, `--hi` | Exposure of the rock: where the median lands on the ramp. Up `--mid` for a rosier mountain |
| `--v-max` | The brightest tone on the ramp. Snow of a photo in another season stays a cream ledge under it |
| `--strokes`, `--grain-s`, `--grain-len`, `--shock` | Passes along the grain, how widely it is read, stroke length, how hard the ramps are pushed apart. More passes melt the rock into marble |
| `--tones`, `--step`, `--soft`, `--local` | Tones, how much they gather into steps, softness of a step, contrast over the broad masses |
| `--crease`, `--crease-t`, `--crease-len`, `--crease-s`, `--bend`, `--pen` | The pen: strength, how deep a gully must be, shortest stroke, gully width, how much a stroke may wind (cracked mud winds, a gully runs), line width. A panorama paints at 1.5x and is seen smaller: 1.2 here is a thin line on screen |
| `--strata`, `--strata-t`, `--strata-len` | Bedding lines, for a rock that has them: what makes the Pelmo read |
| `--veg-any`, `--veg-from`, `--veg-min`, `--veg-dark`, `--dark-veg` | What counts as forest. `--veg-from 0` when dark forest reaches the ridge line. Bigger `--veg-min` drops spruce flecks on bare rock |
| `--tree`, `--no-trees`, `--sun-side` | Tree size, flat forest, which side of the trees is lit |
| `--foot-air`, `--air-from` | The teal air at the foot of the land |
| `--sky-top`, `--land-from` | Rows that are surely sky and surely land, seeds for the sky finder. Check the ridge: if a crest is eaten or a cloud is kept, this is what to change |
| `--cloud` | A white cloud touching the ridge is sky, not land: how smooth it must be, 1.5 is a start. Without it the cloud becomes a flat cream block on the mountain, and the summit goes to that column. Read the printed `summit` u against the photo |
| `--crop x0,y0,x1,y1` (recipe: `crop`) | Fractions of the photo: drop foreground, cars, roofs. Crop before the filter, not after |

Recipe keys that default off, for a place that needs them: `plane_soft`, `plane_detail` (planes: 0 to 1, softer tone steps and less fine detail on a far mountain at night), photo `vstretch` and `shear` (height of a face and lean of a crest, when the long lens flattened them), `moon.glow` and `moon.disc: false` (only the glow in the panorama, when the game draws the disc), `cumulus` (`seed`, `count`, `el`, `size`, `at`: piled white tropical clouds in one sheet; `volume`, 0 to 1, `volume_sun`: each lit as a heap, with lumps pressed in), `forest_style: 'jungle'`, `sea` (`color`, `far`, `level`: DEM at sea level is water), `erase` per photo (boxes in fractions of the crop, inpainted: roofs and poles), `plane_green` in a photo's `args` (`line`, `sm`, `cuts`, `tones`, `min`, `crown`, `rag`), `plane_bed` in a photo's `args` (a bedded face: `dip` in degrees or `[[u, deg], ...]`, the rest as read in `bed_paint` in `tools/paint-photo.py`: dead straight ledges in ochre and grey beds, read in the sheared frame), `dem_forest_air` (0 to 1: air over the forest on the real skyline, for a cold hour when that wood at full colour stands out from everything nearer).

## Panel keys

The tool writes these. A tile has `edge: 0`, `rise: 0`, `baseHaze: [1, 1.01, 0]`. For a free standing panel, not used on antelao:

| Key | Meaning |
|---|---|
| `baseHaze: [from, to, amount]` | From row `from` the image goes `amount` toward `mist`, past `to` it is only mist |
| `edge` | Degrees of side fade; 0 is a tile that meets its neighbour |
| `rise` | Image heights the land dissolves upward near a side, default 0.3 |
| `sky` | Weight in the dome's colours, default 1 |

`look.mist: { from, to, amount, ring }` in metres from the camera: near ground, far trees and water turn toward the mist strip. On antelao, amount 0.62 from 180 to 1300 m: aerial perspective, the far woods go pale and teal into the belts. In `look.horizon`, tint the DEM ring for when a tile is missing. `look.outline.fade: [from, to]` lifts the pen with distance: far woods with ink lines are dark noise.

Around the panorama, the world has to agree with it. On antelao: `ground.rimHeight`, `rimFrom`, `rimTo` and `displayRise` raise steep forest walls close to the road; `ground.shape` digs the valley out along its axis, widening toward each great mountain (with `ground.dry`, so no lake opens where the land goes under `water`), and the edge of its open band wanders, because a straight one read as a ruled wedge once faded; the river's gravel is painted per pixel by height (`look.terrain.bank`, `bankHeight`), `look.trees.drift` small scatters the larch through the spruce, `nearScale` and `roadGap` keep the trees by the road smaller and out of the chase camera's way, and the landmark's `plan` clears the sightline from the start straight.

The near world has to be in the same style as the painting too. `look.terrain.grass: [brush, tuft]` brushes the meadow with short strokes and warm and cool tufts in place of facets (keep `facetTone`, `facetTilt` near 0). `look.terrain.wood: { from, to, amount, dark, light, gold }` paints the far slopes as forest wherever `forestOf` says so, from `from` to `to` m, so a slope with no room for trees is still wood and not a bald wedge; the far tree test uses the drawn ground for slope, not the sim's. `look.trees.farGold` dims the golden kinds far away, or they read as orange confetti. `look.staticRim: [amount, power]` is a warm edge on walls and roofs at a glancing angle: keep it low, or plaster goes flat and pale. `look.road.kerbW` (m) and a real road width: a mountain road is 12 to 13 m here with a low stone edge, not a wide circuit with red and white kerbs, and it should fill much less of the frame than the mountain. `look.road.verge` is what the shoulder fades into.

## What I learned

- First thing to do is rotate north: the mountain ahead is worth more than any filter.
- One sky and one painter. Separate panels with fades always showed: teal glows, ghost forest, wedges. One closed painting cannot.
- Compose back to front and let an opaque forest lie over every foot: a foot dissolved in mist looks like a mistake, a foot behind trees looks like a mountain.
- One strict critic, shots only, round 2: the shape of the mountain and the style of the painting beat every other fix. Then air: pale far woods, no ink far off, walls that make a valley. Bosconero's dome was read as a wrong Antelao: a lesser peak is worse than forest.
- The test on the ridge row caught what the eye had passed: on a tile few frames show, the Marcora was a cloud. Look at every tile as a strip, not only at the race frames.
- A valley wall as a Gaussian bump reads as a low round hill. A long straight slope falling toward the valley's end reads as a trench.
- A dashed vertical line in the sky at the meeting of two tiles was the mip level: a pixel that skips the texture fetch leaves its neighbour with no derivatives. Sample first, then test the edge (`backdrop.js`).
- Long streak clouds curve under perspective. Short lumpy ones do not.
- The test finds a ridge by the step nearest the declared row, because a painted cloud has steps of its own.
- Far trees are what make the slopes forest, and they are the triangle budget: watch `tris` at every shot, at 4 views too. The far band's cap is in `BANDS`, `src/render/trees.js`.
- Bali, a green mountain under a hot sun: a chroma mask for the forest went to camouflage. A hand traced treeline (`plane_green`) and flat tree planes read as jungle. A belt at 2 degrees also hid every real low skyline: look at what the DEM says by bearing first, and let the belts come down to it (`dips`). A bump in a crest can be the treeline crossing the ridge, not the ridge.
- Screenshots in a contact sheet find seams fast; then look at one at 1080p for the painting's quality.
- Keep signs with the track's name out of the blind shots.
- Round 4, strict critic on shots only: it read the ground and the buildings as harshly as the mountains. A backdrop that nothing overlaps is a poster, so 3D ridges and trees must cross its foot.
- A photo chosen for its shape can still be the wrong photo: the viewpoint cost more than any paint fault, and no filter repairs it. Change the photo first.
- The tear in a ridge was order of work: clearing the DEM behind one photo bit into the one laid before. Clear for all, then lay all.
- Two painters in one panorama show. So do two forests. One function for each.
- A flat wedge on a slope was a bald far 3D hill faded by mist, with one straight edge from the valley digger. Fix the edge and the slope's trees, not the fog.
- Where a hand repaint stands next to real photos (transfagarasan), `planes()` cannot match it. `tools/paint-toon.py` repaints a photo with the repaint's own colour ramps and finds the true ridge by flooding the sky down from the top; the result goes in the recipe as `painted: true` with `ridge_hint` from its `.ridge.json`, and `source_photo` says what it came from. Options the recipe gained, all off by default: `summit_u` (the summit's column, when it is not the highest), `ridge_win`, `edge` (deg a side melts over), `dem_cover.rock_slope`, and for belts `floor`, `ramps`, `stones`.
- Blank plaster reads as a dollhouse from any distance: shutters and a larch top floor on every house cost a few thousand triangles and are worth them.
- A sky strip under the next mountain, at the end of a hero's low flank, is `clear_behind` removing near ground there: `clear_keep` in the photo entry. Recipe keys of the same kind: `dem_lift` (lift a stretch of far DEM so an island clears the near ground), `cloud_bank`, cumulus `puffy`, `plane_green.fade` and `tongue`.
- A round rock or bush with a thin stitched cross on it was the paint's `wd`: `along` swaps axis with the normal and its derivative spikes along that line. Kinds 9 and 15 now use the derivative of the position. A rock that fills half the frame up close stops being a wall when trees climb its lower half: bran has a wooded skirt, bare stone only under the castle, and low spurs that reach down to the lowest ground round their foot.
- Bromo has no recipe: `tools/panoramas/bromo-paint.py` is its own painter, because one photo holds the whole great view and the rest of the circle is a wall with no forest. A blind critic's lessons from it: a mountain's silhouette and viewpoint beat its texture, so the classic view from one photo beat three good paintings at true bearings; a wall painted in strokes reads as a comb or as twigs, in soft noise cells down the fall line it reads as a cliff; mist that follows height paints stripes on a fluted slope unless its range is much taller than the flutes; a mist sprite the camera drives through washes the whole frame, so fade it by view depth; tiles at 45 px per degree (`OUT_PPD`) are as sharp as the near world at 1080p and stay well under budget at 0.9 MB.
- Transfăgărășan, round 2: the flat cut of `planes()` went to camouflage on a mixed face of grass and schist. `plane_keep` with many even tones (as on Pelmo) and no glow, for every photo of the track, read as rock at once and stopped the two styles. Recipe key `ridge_smooth` (deg, default off): a median and blur along a photo's ridge, where forest or haze combs it into spikes. A photo's `fall` and `fall_to` on both sides of a join, not only `edge`: a high end melting into the sky behind it reads as a fin or a notch. Never `erase` a big building out of a photo's foot, inpaint leaves teeth: crop it off.

- Transfăgărășan, hand repaint as hero (06/11): `tools/panoramas/transfagarasan-paint.py` brings other photos into a repaint's hand with no mask: smoothed, Lab channels matched by histogram to the repaint's land, soft steps, thin pen. It beat `paint-toon.py` ramps, which went blotchy on mixed grass and schist. Trace a ridge whose summit is near the top with `trace-ridge.py --from 0`. Check a panorama photo's width against the DEM before anything else: at width 110 the left peak of the pass photo fell on Piscul Bâlii at its true 11 deg. `def.boxesAcross` (default 5) for a road under 11 m. A ladder of rungs reads only from in front of the slope: looking along the rungs hides them.

- Bali, hand repaint as hero (06/11): the cone keeps its true proportions and goes up whole, 1.37 times at 19 degrees and 115 wide, so nothing is redrawn. The repaint's pale foot ended in a slab at both sides until `walls` in the two back belts stood over it. Near world: `PLOTS` in `landmarks/bali.js`, toon paint kinds 17 (paddy that mirrors the sky and the cone) and 18 (rice with long stripes at any distance).

## Painting a city: `tools/panoramas/jakarta-paint.py`

Jakarta's panorama is seen from eye level: rain trees band behind band, far towers standing up out of them, two real skylines in the haze, and the Monas drawn from its true profile at the true bearing from Manggarai (`def.horizon.center`). A hand repaint seen from the top of the Monas stood here until 06/11: roofs from above behind a street camera read as a painted wall to a blind critic, whatever its quality. The painted Monas and the 3D one are one object: past 797 m, where both are the same size, the 3D one is not drawn; within it `jakarta-hero-far.jpg` (a panel with `showWithin: { x, z, r }`, per view, default none) covers the painted one with the same pixels without it.

A skyline photo cut out by colour keeps its posterised edge and reads as a card standing in the air. For a city in haze, paint instead: take the photo's silhouette, wash it far toward the air colour, leave only a suggestion of towers, and put it where it helps. Keep what the road looks straight at clear: the Jakarta panorama is thinned along the start straight so that the Monas stands against the sky. Far volcanoes need their ridges traced from a photo but their lines soft: separate cones, pale, with haze at the foot, or they read as an Alpine crest.
- antelao, 06/11: `look.deck.weather` (default none) tones an arch viaduct's faces by height and stands a buttress on each pier: one tone reads as a flat plate past the stone joints. A panel raised over its true elevation must carry `compressed`, or the composer prints no `elevation` and the tile sits off its neighbours, a vertical seam in the sky. At speed the frame widens: judge a mountain's size in a moving chase shot, not from the figures.
