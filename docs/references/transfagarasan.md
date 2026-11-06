# Transfăgărășan: what is real on this track

Everything here was checked on 05/11/2026 against OpenStreetMap (Overpass), the Copernicus DEM and the Commons photos listed in `assets/backdrops/CREDITS.md`. General background, sources and the rules on the disasters: `docs/references/romania.md`.

## The panorama (06/11)

The whole circle is painted from the DEM by `tools/panoramas/transfagarasan-dem-paint.py` (ground from `tools/panoramas/transfagarasan-dem.mjs`, real DN7C from OpenStreetMap in `tools/panoramas/transfagarasan-road.json`): every skyline is the real one, green grass from the water up, grey schist in bands, late snow low in the gullies. Toward the valley the eye moves out over the lip and up and a long lens draws what lies under the horizon up toward it, so the real stack, the trough and the plain show over the 3D slope. `tools/panoramas/transfagarasan.json` and the photo repaints are no longer used. The table below still gives the true figures of the peaks.

## Where the camera stands

`horizon.center` is the middle of Bâlea Lac, 45.6035, 24.6160, 2034 m. Not the ridge at 45.628, 24.624 that `romania.md` once proposed for Moldoveanu: both of Summit Descent's repaints look out from the lake, and the walls round it stand 20 to 28 deg high. Moldoveanu is truly hidden from here by the Capra and Vânătarea lui Buteanu wall, so it is not in the picture. Nothing invented stands in for it.

| Bearing | Distance | True elevation | Peak | Altitude | In the panorama |
|---|---|---|---|---|---|
| 88 | 769 m | 28.0 deg | Văiuga | 2443 m | The hero. Summit Descent's `carpazi-summit.jpg`, drawn at 24 deg so that it fits the chase frame |
| 86 | 1247 m | | Vânătarea lui Buteanu | 2507 m | Behind Văiuga, in the same repaint |
| 92 | | | Capra | 2494 m | Same |
| 128 | 692 m | 29 deg | Iezerul Caprei | 2418 m | The right peak of the repaint; its spacing from Văiuga fixes the repaint's true width at about 76 deg |
| 230 | 902 m | 22.0 deg | Paltinu | 2399 m | `Llac Bâlea.jpg` repainted, drawn at 19.5 deg |
| 242 | | | Laița | 2397 m | Same |
| 270 | | 10.8 deg | The ridge over the west shore | 2135 m | The west half of the wide panorama photo, repainted |
| 297 | 743 m | 11.1 deg | Piscul Bâlii | 2180 m | Summit Descent's `carpazi.jpg`, whose own horizon lies on the real one at 0 deg, so drawn at 7.25 |
| 29 | 1610 m | 11.2 deg | Netedu | 2351 m | The east part of the wide panorama photo, repainted |

Negoiu (2535 m, bearing 245, 4.9 km) is hidden by Paltinu.

## The road

The real road (OSM way geometry of the DN7C) leaves the tunnel's north portal at about 190 m west and 170 m north of the lake's centre, runs along the north shore, then falls north in long legs running east and west, down Valea Bâlii. The lap keeps that orientation, in true compass metres from the lake: east legs run at the great wall, west legs at Paltinu.

Compressed to fit a lap of about 2110 m: the real ladder falls 784 m over 13 km with 13 switchbacks; the lap has four hairpins and 80 m of drop, then the painted road goes on down. Kept: the shore, the ladder, a concrete bridge on one leg, the arched viaduct on the climb, the curved tunnel, 887 m in reality and 98 m here. The tunnel's real south portal is on the far side of the mountain; here it comes back out on the lake side, so the lap closes.

The lake is really 360 by 190 m and is drawn 300 by 156.

## What is done differently from reality, on purpose

- The hour: a clear late morning in summer, as the real photos have it (05/11: a blind critic refused the rose sunrise of the repaints; the place's signature is dark grey schist, grey scree fans and olive grass). The Summit Descent repaints are not used: their colour is that sunrise and their ridge does not lie on the DEM. Six real photos at their true bearings through `planes()`, see `tools/panoramas/transfagarasan.json`.
- The cable car runs from the lake's shore down the valley over the ladder, as the real one runs from Bâlea Cascadă up to the lake, shortened.
- The stalls sell mici, cheese and honey, the real stalls at the lake do. Three low timber chalets on stone stand for the real group of buildings north of the lake.

## Disasters

`Valanga di Bâlea`: a snow slide off the spur above the climb to the tunnel. `Caduta massi`: stones off the cutting onto the second leg of the ladder. Both are cartoon, with no casualties, and neither refers to any real event. The roadside cross above the tunnel's mouth is in `def.sacred`.
