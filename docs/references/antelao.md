# Giro dell'Antelao: references and where things stand

Track file: `src/world/tracks/antelao.js`. Plot it with `node tools/plot-track.mjs antelao out.png`. Positions below are fractions `u` of the lap; read exact places from `track.pointAt(u)` and `track.structures`, because numbers here drift if the road is retuned.

## The real place

| Fact | Value | Source |
|---|---|---|
| Track origin | 46.437 N, 12.218 E, Borca di Cadore | spec |
| Real altitude of y = 0 | 919 m | Copernicus GLO-30 at the origin (read 04/11/2026) |
| Boite, downstream bearing at Borca | about 140 to 150 deg | lowest ground on rings of 0.8, 1.5 and 2.5 km on the DEM |
| Monte Antelao, 3264 m | bearing 64 deg, about 3.8 km | computed from approximate coordinates, spec for the height |
| Monte Pelmo, 3168 m | bearing 253 deg, about 6.7 km | the DEM's own peak on that side (05/11/2026), and `cadore.md`'s coordinates agree; spec for the height |
| Villaggio ENI, Corte di Cadore | a holiday village for ENI staff by Edoardo Gellner, in Borca di Cadore, built from the mid 1950s; villas spread among the trees | FAI, montagna.tv |
| Chiesa di Nostra Signora del Cadore | steep modernist concrete church inside the village, Gellner with Carlo Scarpa, design begun in 1956 | Ingenio, FAI |
| Ferrovia delle Dolomiti | Calalzo to Dobbiaco, opened 1921, closed 1964 | Wikivoyage, montagna.tv |
| Ciclabile delle Dolomiti | runs on the old railway bed with its original bridges, embankments and galleries, along the Boite | Wikivoyage, dolomiti.org |

Sources: https://fondoambiente.it/luoghi/villaggio-corte-delle-dolomiti, https://www.montagna.tv/246993/corte-di-cadore-il-villaggio-nato-dal-nulla-a-due-passi-da-cortina-dampezzo/, https://www.ingenio-web.it/articoli/il-calcestruzzo-nella-chiesa-di-nostra-signora-del-cadore/, https://it.wikivoyage.org/wiki/Ciclabile_delle_Dolomiti, https://www.montagna.tv/234710/ferrovia-delle-dolomiti-quanto-ci-manchi-il-sogno-impossibile-del-suo-ripristino/, https://www.dolomiti.org/storage/6680/ciclabile-dolomiti-pdf4.pdf

The layout is a cartoon of these places, not a survey: the order and the bearings are real, the distances are not.

## The lap, for whoever builds the landmarks

| u | What | Landmark ideas |
|---|---|---|
| 0.00 | Start line in Borca on the SS51, heading downstream | Banner, parish bell tower on the left of the run in (u 0.96), houses |
| 0.03 to 0.17 | Sweepers along the Boite | Tabià barns, hay racks, band 1 at u 0.09 |
| 0.068 | The SS51 passes under the viaduct (viaduct's u 0.412), 14.7 m of clearance | Viaduct arches span it: keep piers off this road |
| 0.17 to 0.20 | Hard right, the low point | Wood piles, a road sign for the bridge |
| 0.20 to 0.22 | Stone bridge over the Boite (`bridge`) | Humped stone arches, the only cobble on the low level |
| 0.24 to 0.33 | Far bank meadows, climbing, band 2 at u 0.285 | Open meadow, cows far off, the Antelao across the valley |
| 0.35 to 0.43 | Old railway viaduct (`viaduct`), pad at u 0.40 | Tall stone arches over the Boite and the SS51, old telegraph poles, a small railway signal |
| 0.44 to 0.47 | Short gallery (`tunnel`), road cut through a spur the terrain provides | Stone portals and a roof over the cut. Terrain stands about 9 m above the road 12 m off its centre |
| 0.47 to 0.50 | Corte di Cadore, cobble, band 3 at u 0.488 | Gellner's pointed roofed villas and the steep church among pines, set back: scenery, no driving inside |
| 0.50 to 0.66 | Three hairpins (`markers`) through the larch wood | Golden larches densest here, stone kerbs, hairpin arrows, a view back over the valley |
| 0.66 to 0.70 | High pasture, dirt, flat out | Fences, hay bales lining the road |
| 0.701 | Jump off the meadow crest | Wooden kicker or hay ramp at the lip, the Pelmo beyond |
| 0.70 to 0.82 | The sprint begins, Pelmo dead ahead (heading about 265 deg), band 4 at u 0.785 | Open fields, tabià |
| 0.822 to 0.898 | Road bends round the farmyard; the dirt cart track (`shortcuts[0]`) cuts inside | A big tabià with a hay cart in the middle of the bend |
| 0.888 | Pad, biased to the left | |
| 0.925 | Cows cross on their way down from the pasture | Bells, a cattle gate |
| 0.95 to 1.00 | Cobbled run into Borca | Bell tower, houses, flower boxes, crowd of friendly animals |

Backdrop, 06/11/2026: the heroes moved from Gemini repaints to `tools/panoramas/antelao-paint.py` on the real photos (Pelmo from Villanova di Borca with the separate right hand summit, Antelao from San Vito). The Pelmo stands behind a wooded ridge built from the belts' `dips` at 252 degrees; the real foot is never shown.
