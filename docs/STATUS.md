# Status, 06/11/2026

Playable, and still being finished. All of this was checked by automated tests in headless Chromium on one Mac. **Real phones, real hands, a real TV and real ears are being tried now**: how it feels to drive, the sound and the hotspot are not proven yet.

## What works

| Area | State |
|---|---|
| Tracks | Ten: Antelao, Pelmo, Transfăgărășan, Bran, Sea of Sand, Bali, Jakarta, Sea to Batur, Cortina and the Giau, Bucharest. Bucharest and Cortina are the newest and the least polished |
| Karts and items | Eleven karts, two of them secret; eleven items, handed out at random |
| Modes | Race, Gran Premio with any number of tracks, Caccia alla Forma, time trial with ghost, team championship |
| Players | 1 to 4 phones plus bots at three levels; weather and night |
| Network | A simulated change of network keeps the seats in order and the QR up to date. A real hotspot has not been tried |
| Commentary | Captions always. Voices are not in the repository, see `CREDITS.md` |

## Balance, from models of drivers, not people

| Measure | Result |
|---|---|
| Easy | a driver as clumsy as the gyro player of 07/11/2026 podium 84%, never last; a casual driver wins 100% |
| Medium | a driver as slow as the stick player of 07/11/2026 podium 33%, a casual one 64%, a good driver wins 96% |
| Very hard | casual driver podium 10%, a good driver wins 56% |
| Karts | none above 18% of wins at medium |

## Known problems

- Bucharest: long plain stretches on Magheru; lake edge.
- Hard races: a lead change in the last lap in about 35 to 40% of races, target 50%.
- Dynamic resolution has never triggered, so it has never been seen working.

## Reproduce

`npm test`, one file at a time as configured, takes about half an hour. Timing tests can fail on a busy machine: rerun them alone.
