# Pelmo d'Inverno: references and where things stand

Track file: `src/world/tracks/pelmo.js`. Landmarks: `src/render/landmarks/pelmo.js`. Panorama: `tools/panoramas/pelmo.json`, preset `winter_dusk`. Plot: `node tools/plot-track.mjs pelmo out.png`. Researched 05/11/2026; `cadore.md` has the wider list.

## The real place

| Fact | Value | Source |
|---|---|---|
| Track origin | 46.4215 N, 12.195 E, on the eastern slope of the Pelmo above Vodo di Cadore. No named place | chosen with a scan of the DEM: the spot where the Pelmo stands highest with both great mountains still in sight |
| Real altitude of y = 0 | 1467 m | Copernicus GLO-30 at the origin |
| Monte Pelmo, 3168 m | bearing 268, 20.2 deg above the road, about 4.5 km | computed from 46.4200, 12.1347 (`cadore.md`) |
| Monte Antelao, 3264 m | bearing 56.5, 16.3 deg, about 7 km | computed from 46.4519, 12.2618 (`cadore.md`) |
| Caregón del Doge | the Pelmo's own nickname, "the Doge's armchair": the Val d'Arcia cirque makes the seat, the two shoulders the arms | it.wikipedia, `cadore.md` |
| The view chosen | from the east, as Vodo and San Vito see it: left arm, tall back with its flat top, right arm. Bedding as long ledges that hold the snow | photo `File:PelmoVododiCadore.jpg` (Verozmp), taken a few km along the same bearing |
| Antelao | `File:Monte_Antelao,_3264_m_und_San_Vito_di_Cadore.jpg` (Michael 2015, CC BY-SA 4.0), the sharp pyramid as it stands over San Vito from the Pelmo's side. The panorama uses its Gemini repaint (`antelao-gemini2`), graded to winter by `tools/panoramas/pelmo-paint.py`, raised to 22 deg (true 16.3). Sasso di Bosconero (S, SE) and Punta Sorapiss (N, NW) are the real DEM skyline in the same hand. It replaced `File:Antelao-Sorapis01.jpg`, which from Pian de Stau reads as a dome | Commons |
| Pelmetto footprints | real, 46.4110, 12.1220, 2050 m, on a fallen slab at the foot of the Pelmetto, an hour and more on foot. Small bipeds, about 220 million years old. Here brought to the road, big and friendly | `cadore.md` |
| Avalanches, lifts | avalanche fences are real in these valleys; chair lifts at Palafavera and San Marco; the shed and lake on this lap are cartoon inventions (the real frozen water nearby is the Lago di Vodo, down in the valley) | OSM, `cadore.md` |

Licence taken: the road is a cartoon. The mountains keep their true bearings from each other and from the place, `horizon.northDeg` 268 points -z straight at the Pelmo. The sun stands at true bearing 220, a low winter afternoon going to dusk: it rakes the south-east face, so the ledges read, and lights the Antelao's south-west side. In the real late evening the east face would go into shade first: chosen with open eyes, because the spec asks for dusk and the bedding must read.

## The lap, for whoever builds on it

| u | What | Notes |
|---|---|---|
| 0 to 0.2 | Rifugio, the start straight and sweepers through snowy firs, the throne dead ahead | `.09` first item band, the chair lift crosses overhead at about `.07` |
| 0.2 to 0.26 | The top bend, an ice patch in its shade | |
| 0.26 to 0.35 | The balcony, under the white slope with avalanche fences. Valanga del Pelmo at `.3`, from the left, down the bare gully. Item band `.31`. Timber rail on the drop | Antelao ahead right |
| 0.35 to 0.39 | The avalanche shed, curving right | Portal in a snow mound |
| 0.39 to 0.51 | The piste: white, 17 m wide, ribbed by the groomer, downhill at the Antelao. Over the stone bridge, boost, the kicker at `.487` | The jump: the Antelao fills the air |
| 0.51 to 0.58 | The bowl: banked left, 12 degrees, crash mats, the crowd, the groomer at rest | |
| 0.58 to 0.69 | The Pelmo again. Round the frozen lake: snow then ice. Shortcut `.606` to `.682` straight across, narrow and all ice. Item band `.585`. Skaters go round | The risk line of the lap |
| 0.69 to 0.86 | Under the bridge you flew over (an ice patch in its shade), the run home, boost at `.75`. The Pelmetto boulder and the dinosaur at `.74`, the sled run at `.795` with its kids crossing. Item band `.83` | |
| 0.86 to 1 | The hamlet on cobbles, lamps lit, the chapel inside the last bend, the rifugio and the line | The chapel is in `def.sacred` |

Third lap things: the chairs and their passengers, the skaters, the snowman judging the jump, chamois at the wood's edge.
