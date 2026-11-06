# Dal Mare al Batur (`batur`): references

The long Bali track, in a different part of the island from `bali` (Muncan and the south flank of Agung). Everything below is real; the distances are folded onto 4 km and the climb told in 76 m.

| Place on the lap | Real thing | Where it really is |
|---|---|---|
| Start, coast road | Pura Tanah Lot, the sea temple on its rock, cut off at high tide; Pura Batu Bolong, the rock with the hole, just to its north west. Black volcanic sand, jukung outriggers | Tabanan, -8.6212, 115.0868 |
| Rice | The subak terraces of Tabanan (Jatiluwih is the UNESCO listed one), Bali cattle, ducks herded through the paddies, lelakut scarecrows | Tabanan |
| Ubud | The long street, Puri Saren with its kori agung, Pura Taman Saraswati and its lotus pond, the market, penjor and umbul-umbul | -8.5069, 115.2625 |
| Monkey Forest | Mandala Suci Wenara Wana: banyans, mossy statues, long-tailed macaques | Ubud |
| Ayung gorge | The river of the rafts; the tall bridge stands for the road bridges over the gorges of central Bali | East and north of Ubud |
| Kintamani, Penelokan | "The place to look": the caldera rim, restaurants and fruit stalls, the oranges of Kintamani; Pura Ulun Danu Batur, moved here from Kalanganyar on the same road, its tall meru | -8.28, 115.36 |
| Caldera | The lava flows of 1963, 1968 and 1974, black and bare under Gunung Batur 1717 m. Gunung Abang 2152 m across the lake | Summits from Copernicus GLO-30: Batur -8.2369, 115.3773; Abang -8.2803, 115.4296 |
| Lake | Danau Batur, 1031 m, fish cages on barrels, Toya Bungkah's hot springs, Pura Jati, Songan | -8.25, 115.41 |
| Penglipuran | The traditional village in Bangli: one stone street, a row of identical bamboo roofed angkul-angkul gates, a bamboo forest behind it | -8.4217, 115.3591 |

Hazards: Bali cattle, macaques, the hot springs under the road. Disasters: Letusan Batur (the volcano's real eruptions, 1963 and 2000 among them), Longsor Penelokan (rockfall on the caldera wall), Lahar Batur (mudflow on the outer slope). All cartoon, none on a temple.

`horizon.center` is -8.255, 115.351, near Kintamani on the west rim, the viewpoint of the photo: Batur at bearing 55, Abang at 108, Agung at 120. `horizon.altitude` is the lake's level, 1031 m, y = 0: the elevations of the panels are measured from there. The true sea is on the bearings 160 to 300, but it cannot be seen from Kintamani's eye level over the land: `dem_clear` puts it in there.

The panorama is one photo: Denny Octora's view from the rim holds the far rim, the cone, the lake and Abang at their true bearings, repainted region by region through `tools/paint-regions.py` (`tools/panoramas/batur-paint.json`), stretched to 2 times its height. Batur stands at 9.6 degrees (true 11), so the whole photo fits under a chase frame. Agung is a second photo (madras91's postcard), behind, at 9.4 degrees (true 6): it is told larger on purpose, written in `compressed`, because from the road it is what stands over Abang's shoulder, and kept just under Batur, the hero of this road. Abang is painted dark and wooded as it is; Batur is dark rock and old lava, never tan.

The caldera wall that closes the lake on the sea side is built ground (`CALDERA` in the def), far lower than the true 300 m, so that the road can cross it. Tanah Lot stands 3D in the sea on a reef of its own, about 2.4 km from the rim on the folded map instead of 50 km. Painted bearings and folded ground agree only at the rim and the descent, which is where the road looks at them.
