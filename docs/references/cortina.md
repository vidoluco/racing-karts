# Cortina d'Ampezzo and Passo Giau

For the track `cortina`. Coordinates WGS84 from OpenStreetMap (Overpass, Nominatim, 06/11/2026), altitudes measured on Copernicus GLO-30 along the road.

| Place | Lat, lon | Altitude | On the lap |
|---|---|---|---|
| Corso Italia at the campanile | 46.5378, 12.1365 | 1224 m | start, tower on the left heading south east |
| Trampolino Olimpico Italia, Zuel | 46.5107, 12.1462 | 1120 m at the road | under the in-run, u 0.109 |
| Pocol | 46.5246, 12.1146 | 1530 m | origin of the map |
| Ponte di Ru Curto | 46.5130, 12.0900 | 1565 m | first stack, panorama centre |
| Malga Giau | 46.4930, 12.0656 | about 2000 m | meadow and shortcut |
| Passo Giau | 46.4826, 12.0536 | 2236 m | top of the lap |
| Ra Gusela | 46.4907, 12.0510 | 2595 m | hero, bearing 230 from Ru Curto |
| Tofana di Mezzo, Tofana di Rozes | 46.5456, 12.0655; 46.5370, 12.0511 | 3244, 3225 m | hero, bearings 332, 312 |
| Cinque Torri | 46.5092, 12.0533 | about 2360 m | 3D, beside the descent, at their true place on the squeezed map |
| Antelao, Pelmo | 46.4519, 12.2618; 46.42, 12.1347 | 3264, 3168 m | at true bearing on the panorama, raised, see `compressed` in the panels |

## How the map is squeezed

The real circuit on roads (Corso, SS51, Via Mortisa, SR48, SP638, the return by the tracks) is 36.5 km with 1116 m of climb from Zuel. The world is the real map at 0.249 from Pocol, true north, and y = (altitude - 1120) x 0.28, so the land keeps about its true slope. Hairpins stay at driving size (radius 21 m), and the road between them is drawn by hand along the OSM line. Anchors read off the DEM: Corso 1224, Zuel 1125, Pocol 1530, Ru Curto 1565, 1747 at the second stack, 2043 at the end of the ladder, the pass 2236.

The return is the one folded part: the real SP638 is one road, so the descent runs on the north west side of it toward the Tofane and arrives at the Corso from Ronco, as the road from Falzarego does. `src/world/cortina-relief.js` is the real DEM over the road's own height, capped so that the ground never stands in front of the paintings.

## The Trampolino Italia

Built for the 1956 Winter Olympics at Zuel, out of use for competition since 1990. Concrete in-run on tall frames, a judges' tower, a landing hill. No rings modelled: none could be confirmed from a photo here, and the brief allows them only as the real jump shows them. The road passing under the in-run is licence of the game: in reality the local road runs at the foot of the out-run.

## Rules kept

The basilica, its tower and the ossuary above Pocol are never hit (`def.sacred`). The ossuary is not modelled. The rockfall is generic and friendly and refers to no real event, with no name of a real incident.

## Paintings

`data/raw/backdrop-photos/giau-nuvolau-gemini/giau-nuvolau.jpg`, from the Giau photo, is used as it comes. `cortina-tofane.jpg` is a winter view with the campanile in front: `tools/panoramas/cortina-fit.py` moves the rock over the tower and turns the snow under the tree line to October gold, keeping the first dusting on the high ledges.
