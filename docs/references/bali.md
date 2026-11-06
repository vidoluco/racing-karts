# Terrazze di Bali: reference

For `src/world/tracks/bali.js` and `src/render/landmarks/bali.js`. Written 05/11/2026. General Bali facts, peaks and temples: `docs/references/indonesia.md`. Numbers marked DEM were measured on Copernicus GLO-30 (tiles S09 E114 and S09 E115, in `data/raw/dem/`, which is a real folder here and not the Summit Descent link).

## Where the track really is

The spec named Tegallalang. From Tegallalang Agung stands only 5.4 degrees high and the track could not look at it, so the place moved to the south flank, on the Rendang road above Muncan, at -8.41, 115.45, 651 m (DEM). Muncan and Iseh are terraces with Agung over them in the historical photographs too (Tropenmuseum collection on Commons). This is a true view of terraces under the volcano, not Tegallalang's.

| Seen from the center | Bearing | Elevation | Distance | How it is drawn |
|---|---|---|---|---|
| Gunung Agung, 3031 m | 37.6 | 19 deg drawn, 13.9 true | 9.6 km | Gemini repaint of the real postcard photo, whole cone, at true bearing, its summit line inferred where the photo's clouds hide it. LICENCE: raised by 3 degrees, because a long even cone squeezed under a chase frame reads as a hill |
| Gunung Abang, 2151 m | 345 to 352 | 5.8 deg | 14 km | DEM |
| Gunung Batur, 1717 m | 336 | about 3 deg, just over the outer rim | 19 km | DEM. No photo: every free photo of Batur is from Kintamani, across its lake, which cannot be seen from here |
| Catur, 2096 m, and Batukaru, 2276 m | 300 and 283 | 2.3 and 2.2 deg | 33 and 41 km | DEM |
| Nusa Penida, across the strait | 150 to 165 | under the horizon, over the sea, lifted to show (`dem_lift`) | 36 km | DEM |
| Plain and sea, south and south west | 170 to 260 | below the horizon, the sea line at -0.9 | up to 42 km | DEM, `sea` in the recipe |

The road turns first: world -z is the bearing of Agung, so the street, the jump and the climb up the far bank all look straight at it. The hero stands within 30 degrees of the heading for the share of the lap that `test/backdrop.test.mjs` asks for.

## What is real and what is licence

| Thing | Real | In the game |
|---|---|---|
| Rice terraces | Stepped along the contours of the slope, thin bunds, flooded mirror, young, green and gold plots side by side, coconut palms standing in them, subak water channels | Real geometry: flat plates cut along the contours of the ground (`buildPlates` in the landmarks module), a riser and a bund on each step, stone retaining walls by the road, plates of 1.5 m near and 3 m further out |
| Candi bentar | Split gate, two halves of one tower as if cut with a knife, red brick and paras | At both ends of the village and at the lake shore, with a road through a village and no courtyard behind |
| Penjor | Tall curved bamboo pole with a fringe of janur, for Galungan | Both sides of the street and along the shore |
| Meru | Tiered black ijuk roofs, always an odd number | 11 and 3 tiers on two islets, as at Pura Ulun Danu Beratan |
| Lake and temple | Beratan is 30 km west of the viewpoint, at 1231 m | LICENCE, the biggest one: a lake is brought to the track and the temple modelled on Ulun Danu stands on it, dark and still, on its own reflection. It is on the true bearing of Beratan, so the real Catur skyline stands behind it |
| Bridge and plank | Bamboo footbridges and bunds | LICENCE: 12 m wide for four karts |
| Road | One and a half lanes of old tarmac, no paint, a stone gutter | LICENCE: 12 m, the narrowest the track test allows, no racing kerbs, no centre line, setts at the village, invisible walls at the edge low enough to stay out of the way (`def.wall.max`) |
| Kites | Great bebean kites flown from the fields in the windy months, July to September | Three of them, in the sky of a midday that has no one month |
| Bali cattle, ducks, lelakut scarecrows, macaques at temple forests | Real | Scattered, macaques are the track's hazard |

Hard rules kept: nothing is ever thrown at a temple (`def.sacred` covers both islets, and the lahar entries are away from the lake and the village gates), no road enters a courtyard, offerings and penjor are left whole and are not items.

## Lahar del Gunung Agung

Agung's lahars are real and are the volcano's main hazard: in the eruption of 1963 they ran down the south flank valleys, and the alerts of 2017 and after warned of the same danger. Which river near Muncan carried what: UNVERIFIED, so no river is named in the game. In the game (`def.disasters`, kind `lahar`) mud comes through the terraces from the side of the volcano, in two places: on the far bank climb with Agung ahead (u 0.39) and on the run south (u 0.625), and a lane stays free. Ash in the air comes with the kind. Cartoon, a tumble, no casualties, no figures.

## Hour and weather

Late afternoon as in the repaint, warm sun at true bearing 290, 38 degrees, tropical cumulus (`cumulus` with `puffy`, one kind of cloud, `cloud_bank` 0), `tropical` preset in `tools/paint-photo.py`. The photo's jungle is repainted as traced tree planes (`plane_green`, with `fade` and `tongue` for the forest running up the lava channels), so its rock crown stays and the forest is the one forest of the panorama.

## Photos

Used: the repaint `agung-gemini` of `agung-postcard`, File:Indonesian postcard (gunung Agung) (23559356208).jpg, madras91, CC BY 2.0. Reference only, not in any tile: Besakih Bali Indonesia Pura-Besakih-03.jpg (CEphoto, Uwe Aranas, CC BY-SA 3.0), Rice terraces, Bali.jpg (Vyacheslav Argenberg, CC BY 4.0), Tegallalang Rice Terraces Bali.jpg (Philip Nalangan, CC BY 4.0). Recheck attribution before any public release.

## Round 2 of the look (05/11)

From a road below the fields you see risers, not plates: banks lean back in their normals and carry the rice of the plate above at their top. The crest is marked by harvest sheaves and woven boards (`look.road.jumpMarks` false). The lahar channels are grey, stony and wander, as dry lahar beds are (`gully` on each entry). Road side shrines, banana, fern and hibiscus along the verge.

## Correction round of 06/11, against the Muncan and Bandem photos

- The ground beside the road now follows the road next to it and rises gently (`sideFall`, `follow` in the track file): at 25 m from the kerb it stood 12 m up, so the plates stacked into walls.
- Plates are 0.62 m high near the road and 1.24 m further out, on plots usually many times deeper than that, with thin earth bunds, rice blades close to, and the mix of water, young and ripening rice.
- Where the fields stop by the road there is a short earth bank over low dry stone, with ferns on its top. The sheer leaf textured walls are gone.
- Ravines every 230 m down the fall line (`ground.ravine`), cut into the ground and filled with trees; clumps of trees in the fields instead of single palms; a wooded ridge in the south past the lake.
- Agung is regraded by `tools/panoramas/bali-agung-grade.py`: ink closed, blue brown haze, fine gullies, forest belt on the lower flanks. The cone's outline and bearing are untouched.
- The candi bentar are one split tower, flat inner faces, mirror images. The village has two small ones beside the street, 6.4 m high; none stands across the road or frames the mountain, so it no longer points to Lempuyang.
