# Bromo: the Sea of Sand (Mare di Sabbia)

The place behind `src/world/tracks/bromo.js`, its landmarks and its panorama. Everything that is bent for the game is said here.

## The place

The Tengger caldera, East Java, Indonesia: about 10 km across, its floor (Laut Pasir, the Sea of Sand) a plain of dark volcanic sand at about 2100 m. Inside it stand Bromo (active, smoking crater, rim about 2330 to 2380 m), Batok (the grooved extinct cone, about 2440 m, fluted by gullies from the top down) and Kursi. Semeru (3676 m), the highest mountain of Java, puffs far off to the south. Jeeps cross the sand before dawn, ponies carry visitors from the jeeps to the concrete stair up Bromo's ash, and Cemoro Lawang stands on the caldera's lip to the north-east. Pura Luhur Poten, the Hindu temple of the Tengger people, stands on the sand at Bromo's foot, built of black stone, with split gates and a tiered meru.

Bromo's hazards are real: ash, and lava bombs near the crater. Semeru's plume is a daily sight. In the game they are cartoon set pieces with no casualties, and the temple is `sacred` so nothing lands near it.

## The viewpoint and the true bearings

Horizon centre: -7.916, 112.953, ground 2124 m, on the north of the sand sea under the wall, looking south. From here Bromo, Semeru and Batok stand in one frame, which is the classic view and what names the place. `northDeg` -80 lays the long legs of the road at them.

| What | True bearing | True elevation | In the painting | Why |
|---|---|---|---|---|
| Semeru | 188.9 | 4.1 deg | 18.75 deg, at its true bearing | The hand repaint keeps the photo's framing, seen from the rim; from the floor a long lens would be needed. Written in `compressed` in the track file |
| Bromo (crater) | 180.0 | 5.0 deg | bearing 167.1, 10.3 deg | Where the repaint, 78 degrees wide with Semeru on its bearing, puts it |
| Batok | 197 | 8.3 deg | about 200, 16 deg | Where the repaint puts it |
| Wall | all round the rest | | 12 to 15 deg, nearly level, falling to 6 at bearing 90 for the sunrise | The DEM's skyline, squeezed under the frame |

## The photo

The hero is now the hand repaint `data/raw/backdrop-photos/bromo-dawn-gemini/bromo-dawn.jpg` (Gemini, from the photo below, see `docs/progress/repaints.md`), laid as it is through `tools/panoramas/bromo.json` and `tools/panoramas/bromo-paint.py`; the wall round the rest of the circle takes its colours. The world's rose sand and mauve shade come from it too: the real sand is dark grey, rose only at dawn. What follows is the source photo.

One photo for the whole great view, so one viewpoint and one light: File:Bromo and Semeru volcanoes, Java, Indonesia, 20220820 0718 9524.jpg, Jakub Hałun, CC BY-SA 4.0. Its smoke is removed and painted again, its colours re-graded for dawn and gathered into soft planes, every gully and outline is the photo's. The rest of the circle has no photo: the wall is painted by `tools/panoramas/bromo-paint.py` in the same colours. Summit Descent's Indonesian paintings are of Kerinci, not of this place, so none is used.

## The ground and the road

- The floor is flat and open to the west and south, as it is. The north and east wall is an analytic level rim over fluted cliffs (`wall` in the track file), shaped after the DEM and the photos, not the DEM itself.
- The ash shoulder is an invented low cone: real Bromo's flank, moved to where the road can climb it, with the radial gullies of the real flanks. The carousel spirals up it to a crest jump with Semeru ahead.
- The stair is the real thing's idea (a straight concrete stair with handrails); here it runs up the shoulder's east face so you see it from the start straight.
- Vents: grey fumaroles in a heap of lava, no yellow. The real sulphur is inside Bromo's crater and the real sand has none; fumaroles on the road are the game's invention.
- Temple: the true position on the sand relative to the shoulder is approximate. Its plan (black stone wall, split gates, meru, cemara in the yard) follows the photos and is nothing that names or copies a specific shrine layout. UNVERIFIED: the number of tiers of the meru.
- Cemoro Lawang: little bright houses on the lip, placed by walking out to the wall on each bearing. Real position, schematic houses.
- Trees: cemara gunung (Casuarina junghuhniana) on the wall, uses the game's tall crowned `pine` shape. The real tree is thinner and more drooping.
- Tan grass on the savanna leg: real, south-east of the sand in the real caldera (the "Teletubbies hill" side); moved a little closer to the road.

## The light

Dawn: sun at bearing 100, elevation 11, sky and ramps at the top of `tools/panoramas/bromo-paint.py`. Charcoal sand, cool even at dawn, warm only on what stands up. Mist lies on the floor in soft sheets that stay away from the camera (`look.mist.high`, the sheets in the landmarks file).

## Disasters

`Eruzione del Bromo` (`eruption`, u 0.514, on the run-out of the gullies) and `Nube del Semeru` (`cloud`, u 0.42, seen while coming off the crest). `sacred` holds the temple. See the spec, Natural disasters.

## Rebuilding

`python3 -I tools/panoramas/bromo-paint.py [--preview p.jpg]` writes the tiles and prints the panels: paste them into `backdrops:` of the track.

## Correction of 06/11/2026

Bromo is one 3D ash cone now (`bromoCone`, `rimR`, `rimY` in the track file): a truncated cone with a torn, breached lip, the stair ending on that lip and low steam rising from inside. Batok is a 3D fluted cone at `BATOK` wearing the repaint's Batok as a skin. The panorama keeps only Semeru and far walls that stay under the 3D wall. Compare with Commons 'Mount Bromo at sunrise, showing its volcanoes and Mount Semeru (background).jpg' and 'Bromo Tengger Semeru National Park Java 471.jpg': real steam is a low wide soft bank, Semeru's a small puff, the floor dark grey ash, the wall dark and irregular. Options added for this: `look.vent.rock`, `look.vent.lit`, `look.terrain.ripple[2]`, `world.backdropBase`.

## Correction of 06/11/2026, the art direction

The painting is the hero. The whole repaint bromo-dawn lies in the panorama, 88 degrees wide, with Semeru on its true bearing and Bromo and Batok where it puts them, and the plumes are its own. The 3D Batok and the live steam are gone. The cone the road climbs is still ground (`bromoCone`), in the painting's colours, a foothill in front of it. The floor is a stylised dawn: sand glowing rose and gold with violet shadows, not the real dark ash.
