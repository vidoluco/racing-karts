# Jakarta Macet / Jakarta Gridlock (`jakarta`): references

The long Jakarta track: 8.4 km, one lap, the real road order folded by 0.82. The main obstacle is the traffic. Everything below exists; the jokes are about the traffic, never about the people in it.

| Place on the lap | Real thing | Where it really is |
|---|---|---|
| Start, Cikini | Rain trees and villas of Menteng, the Monas dead ahead down the road | -6.190, 106.838 |
| Medan Merdeka | Monas, 132 m (drawn 1.3 times larger), gold flame, the square round it; Masjid Istiqlal with its single minaret and the Cathedral opposite, both on the far side of the square and out of reach of anything thrown; Gambir station | -6.1754, 106.8272 |
| Merdeka Barat | The Arjuna Wijaya chariot | -6.1707, 106.8225 |
| Thamrin | Towers, the busway with its red lines, JPO footbridges with halte, TransJakarta buses | South of Monas |
| Bundaran HI | The Selamat Datang statue, the pair waving on their pedestal in the fountain; clockwise round it | -6.1950, 106.8231 |
| Sudirman | The canyon of towers, the jam, the stumps of the monorail that was never finished | South from HI |
| Dukuh Atas | The underpass, the commuter rail viaduct over it, a KRL train crossing | -6.2010, 106.8225 |
| Semanggi | The cloverleaf, a spiral ramp up and over Sudirman; Gelora Bung Karno seen from here | -6.2200, 106.8130 |
| Tol Dalam Kota | Elevated toll road, sound walls, a toll gate with its queue, billboards | South of the centre |
| Dr Saharjo | Ruko shophouses and every motorbike in the city; bakso, sate, soto, es cendol, pulsa, tambal ban | Tebet, Manggarai |
| Manggarai | The level crossing and the commuter trains, barriers, bell | -6.2100, 106.8500 |
| Kampung by the Ciliwung | Cobbled gang between stacked houses, red and white bunting, gerobak carts, concrete bridges over a canal of milky brown water with sloped revetments, houses facing it on both banks; the back lane along the west bank is the shortcut | -6.2050, 106.8480 |
| Back to Menteng | Rain trees, the Monas far ahead again | |

Real shapes the scene is held to, checked against photos: the Monas stands alone in a wide square, a broad square goblet base (45 m) under a tapered white shaft, a lookout cup and a large gilded flame (14 by 6 m). Bundaran HI is a round green pool with arching jets and a paved lotus ring; the bronze pair wave from a tall dark pedestal, facing north; the ring is modern: the teal glass Hotel Indonesia with its scalloped roof, the cream grid slabs, Plaza and Grand Indonesia, BCA. Gelora Bung Karno is white lattice under a pale ring roof, not teal. Semanggi is grey concrete on hammerhead piers with trees inside the clover, so elevated roads use `look.deck.style: 'concrete'` and not the Alpine stone arches. Jakarta's bumps are polisi tidur, marked with painted tyres, never hay.

Mountains to the south on a clear day: Gunung Pangrango 3019 m (-6.7705, 106.9636, true bearing 167) with Gede beside it, and Gunung Salak 2211 m (-6.7167, 106.7333, true bearing 190). True height in view is about 2.5 and 2 degrees; drawn at 15 and 12, marked `compressed` in the panel data. City photos stand where the composer puts them, not at a real bearing.

Traffic, from the real street: motor (step-through scooters), ojek in green, the family of four on one bike, krupuk sellers with their load, water gallons, chicken cages, the little green gas bottles, a sofa, gerobak, blue bajaj, angkot, MPVs and sedans, metromini, trucks on the toll road, TransJakarta buses; riders on the pavement going the wrong way. About 5000 on the lap. Plain scooters swerve out of your way; what carries a load does not. No vehicle carries a brand.

Street life: ondel-ondel, the giant Betawi street puppets, in pairs on the pavements (red face, white face, crown of fronds); kaki lima food stalls and parked bikes on every pavement; red and white on the lamp posts; a flyover over Dr Saharjo. The old colonnaded government buildings on the outside of Medan Merdeka and the Menteng villas are generic, not any one building.

The road itself: BUSWAY painted on the red lane, arrows, tar snakes, manholes, oil stains. Malls with shop bays stand round Bundaran HI and along Thamrin, and a static queue fills the far half of the roundabout. The fountain's jets are see-through arcs that breathe. The toll road has green gantries with real exits (Semanggi, Tomang, Kuningan, Cawang, Tebet, Pancoran, Manggarai, Cikini) and batik parang murals on its sound walls; the batik is a traditional public pattern, no one's design.

Disasters: Banjir Manggarai and Banjir Ciliwung, the seasonal flooding, told as brown water with a free lane: cartoon, no casualties. Rain may come by the seed, 70% of races, greases the road by 14% and darkens the view.

Music: an original tune, `src/audio/music/jakarta.js`, hand drum in the dangdut spirit but no existing song. Sounds: horns, bell, train, city roar, rain, all synthesized in `src/audio/sfx.js`. Words over the horns are street Indonesian: TIN TIN, TOT, TET TET, WOI, MINGGIR ("move over").

Photos: `assets/backdrops/CREDITS.md`, section Jakarta. Scene: `src/render/landmarks/jakarta.js`.

## Measures used by the rebuild of 06/11/2026

Monas (en.wikipedia.org/wiki/National_Monument_(Indonesia)): 132 m in all; a 45 m square Cawan, the cup, 17 m high; a look-out at 115 m, 11 m by 11 m; a flame of 14 m, 6 m across, gold leaf on bronze. Modelled at true height: shaft about 9.5 m wide at its foot and 8 at the top, so a cup of about six shaft widths; the bowl is drawn a little wider than the real 45 m so it reads from the far end of the start straight.
Medan Merdeka: the streets lean a few degrees toward the square and the north west corner swings out, because a street parallel to the square never has the monument inside the chase frame (half width 42 degrees). The west half of the lawn stays open for the same reason, only the south west quarter keeps its wood.
Sudirman (en.wikipedia.org/wiki/Jalan_Jenderal_Sudirman): carriageway, planted separator, slip road, pavement; a raised halte reached from a footbridge. The real halte stands in the median; here it stands on the separator, because a solid island in the racing line is not an option. Named shapes: Wisma 46 (pen nib), a dark bank slab with a crown of fins, twin towers tied by a portal, a slant topped glass tower. They are cartoons of the type, not surveys.
Kampung lane: 8.4 m in the game, about 2 to 3 cars. The water in the Ciliwung is a drawn ribbon at -1.05, the sim's water stays at -4.2 so that the Dukuh Atas underpass stays dry.
