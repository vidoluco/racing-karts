<p align="center"><img src="docs/media/logo.png" width="520" alt="Racing Karts"></p>

<p align="center"><b>The TV shows the race. Every phone is a wheel.</b><br>A cartoon kart racer through the real mountains and cities of Cadore, Romania and Indonesia.</p>

<p align="center"><img src="docs/media/race.gif" width="800" alt="A race on the Antelao Loop: a rocket hits the kart ahead, a drift through the corner, the turbo, then a rival's sambal goes off in the road"></p>

<p align="center"><i>"Porta il fieno a casa prima di sera, costi quel che costi."</i><br>The hay gets home before dark, whatever it takes. Bepi, the marmot.</p>

## How it works

| | Where | What happens |
|---|---|---|
| 1 | **TV** | `npm run play` on the computer plugged into the TV. It shows a QR |
| 2 | **QR** | Each phone scans it. No app, no account, up to four phones on the same Wi-Fi |
| 3 | **Phones** | Hold it sideways: your thumbs steer, drift and fire. The race stays on the TV |

![The TV lobby with its QR code, next to a phone with the options and a phone with the stick, the drift button and the item button](docs/media/tv-and-phone.jpg)

**Driving it.** Throttle is automatic. Hold DRIFT through a corner: the longer you hold, the bigger the turbo when you let go. Crates give one of eleven items, and what a crate gives does not depend on your place.

## Ten tracks, ten real places

The skylines come from real elevation data, and the big mountains and landmarks far off are repainted photos of the places themselves.

<table>
<tr>
<td width="50%"><img src="docs/media/track-antelao.jpg" alt="Antelao Loop: a wooden barn kart heading for the old railway viaduct"><br><b>Antelao Loop</b> <i>(Giro dell'Antelao)</i><br>Borca di Cadore and Monte Antelao, Dolomites, Italy</td>
<td width="50%"><img src="docs/media/track-pelmo.jpg" alt="Pelmo in Winter: a red piste groomer kart on a snowy road under the Pelmo"><br><b>Pelmo in Winter</b> <i>(Pelmo d'Inverno)</i><br>Monte Pelmo above Vodo di Cadore, Dolomites, Italy</td>
</tr>
<tr>
<td width="50%"><img src="docs/media/track-transfagarasan.jpg" alt="Transfăgărășan: a little steam locomotive kart with the ladder of hairpins on the slope"><br><b>Transfăgărășan</b><br>Bâlea Lake and the DN7C hairpins, Făgăraș mountains, Romania</td>
<td width="50%"><img src="docs/media/track-bran.jpg" alt="Bran under the Moon: a painted cart at night, the castle and the full moon ahead"><br><b>Bran under the Moon</b> <i>(Bran sotto la Luna)</i><br>Bran Castle and the Bran pass, Carpathians, Romania</td>
</tr>
<tr>
<td width="50%"><img src="docs/media/track-bromo.jpg" alt="Sea of Sand: an old 4x4 kart on the sand at dawn with Bromo smoking"><br><b>Sea of Sand</b> <i>(Mare di Sabbia)</i><br>Tengger caldera with Bromo and Semeru, East Java, Indonesia</td>
<td width="50%"><img src="docs/media/track-bali.jpg" alt="Bali Terraces: a boat kart between the rice terraces under the volcano"><br><b>Bali Terraces</b> <i>(Terrazze di Bali)</i><br>The rice terraces under Gunung Agung, Bali, Indonesia</td>
</tr>
<tr>
<td width="50%"><img src="docs/media/track-jakarta.jpg" alt="Jakarta Gridlock: a pedal cab kart among scooters and buses, towers behind"><br><b>Jakarta Gridlock</b> <i>(Jakarta Macet)</i><br>The Monas, Thamrin and Sudirman, Jakarta, Indonesia</td>
<td width="50%"><img src="docs/media/track-batur.jpg" alt="Sea to Batur: a chef's trolley kart between terraces with the volcano ahead"><br><b>Sea to Batur</b> <i>(Dal Mare al Batur)</i><br>Tanah Lot, Ubud and the Batur caldera, Bali, Indonesia</td>
</tr>
<tr>
<td width="50%"><img src="docs/media/track-cortina.jpg" alt="Cortina and the Giau: a chairlift kart on an autumn road under a wall of Dolomites"><br><b>Cortina and the Giau</b> <i>(Cortina e il Giau)</i><br>Cortina d'Ampezzo, Pocol and the Giau pass at 2236 m, Dolomites, Italy</td>
<td width="50%"><img src="docs/media/track-bucarest.jpg" alt="Bucharest Golden Evening: a heating main bursts under a kart on a zebra crossing"><br><b>Bucharest Golden Evening</b> <i>(Bucarest Sera d'Oro)</i><br>Piața Unirii, the Parliament, Calea Victoriei, the Arch of Triumph and Herăstrău, Romania</td>
</tr>
</table>

## Four on one TV

One to four phones, split screen, and 0 to 7 bots to fill the grid.

![Four players in split screen on the Antelao Loop, each with a different kart](docs/media/four-players.jpg)

## When it goes wrong

Tracks have natural disasters that warn you on screen and leave a free lane: lava bombs, avalanches, rockfalls, mud. Jakarta has its traffic.

<table>
<tr>
<td width="50%"><img src="docs/media/chaos-eruption.jpg" alt="Lava bombs falling around a kart on the Sea of Sand"><br><b>Eruzione del Bromo.</b> Watch the shadows</td>
<td width="50%"><img src="docs/media/chaos-rocket.jpg" alt="A rocket hits a rival under Monte Antelao, stars and smoke"><br><b>Rocket.</b> It homes on the kart ahead</td>
</tr>
<tr>
<td width="50%"><img src="docs/media/jakarta-traffic.jpg" alt="Scooters and a bajaj around a pedal cab in a Jakarta street"><br><b>Jakarta Gridlock.</b> Scooters, bajaj, angkot and buses</td>
<td width="50%"><img src="docs/media/sky-rain-night.jpg" alt="A Jakarta avenue at night in the rain, tail lights on the wet road"><br><b>Rain at night.</b> The same avenue, another evening</td>
</tr>
<tr>
<td width="50%"><img src="docs/media/sky-snow.jpg" alt="A piste groomer kart in falling snow under the Pelmo"><br><b>Snow.</b> Or rain, or fog, by day or by night, or a surprise</td>
<td width="50%"><img src="docs/media/sky-night.jpg" alt="A lit village street on the Antelao Loop at night"><br><b>Night.</b> Headlights, street lamps, lit windows</td>
</tr>
</table>

## Eleven karts

Nine to start with. Stats run from 1 to 5 and always add up to 15, so no kart is simply best. A won Gran Premio opens a secret one, the next win opens the other.

![The line-up: nine karts and two secret ones, with their drivers](docs/media/karts.jpg)

| Kart | Driver | Speed | Accel | Handling | Weight | Off road |
|---|---|---|---|---|---|---|
| Il Tabià | Bepi, the marmot | 3 | 3 | 3 | 3 | 3 |
| Gatto delle Nevi | Toni, the chamois | 2 | 2 | 2 | 5 | 4 |
| Seggiovia | Nane, the ibex | 4 | 3 | 4 | 1 | 3 |
| Mocănița | Ursu, the Carpathian bear | 5 | 1 | 2 | 5 | 2 |
| Căruța | Oița, the sheep | 2 | 4 | 3 | 2 | 4 |
| Logan Vecchia | Vlăduț, the bat | 4 | 2 | 3 | 4 | 2 |
| Bromo 4x4 | Budi, the macaque | 3 | 2 | 2 | 3 | 5 |
| Becak | Tokek, the gecko | 2 | 5 | 4 | 1 | 3 |
| Jukung | Komo, the Komodo dragon | 4 | 3 | 4 | 2 | 2 |
| La Cuccia (secret) | Baileys, the cat | 3 | 4 | 3 | 2 | 3 |
| Il Carrello (secret) | Fifi, the chef | 4 | 3 | 2 | 4 | 2 |

Baileys bites whoever stays too close.

## Eleven items

![The eleven items](docs/media/items.jpg)

| Item | What it does |
|---|---|
| Rocket | Homes on the kart ahead. From first it sweeps the whole road and nothing touches you for 3 s |
| Grappa | A big boost, then a little wobble |
| Țuică | Three sips, a short boost for each |
| Mici | Three orbiting sausages block hits. Press to throw one |
| Eggs, speck and potatoes | For 5 s you grow, you fly and you bowl everyone over |
| Polenta | A sticky puddle behind you, or far ahead with the stick up. In Romania it is mămăligă |
| Cheese Wheel | Rolls back at the chasers, or ahead with the stick up |
| Durian | A stink cloud behind you for 7 s, or onto the leaders with the stick up |
| Sambal | A huge flame blast backward, then a 3 s boost and a trail of fire |
| Rendang | A smell nobody resists drags you to the kart ahead, and you steal its item |
| Landslide | Drops in front of the leader and leaves rocks to dodge |

## Modes

<table>
<tr>
<td width="50%"><img src="docs/media/mode-grand-prix.jpg" alt="The Grand Prix builder with a card for each track"><br><b>Gran Premio.</b> Your list of tracks, points after each race, a final podium</td>
<td width="50%"><img src="docs/media/mode-cheese.jpg" alt="A kart carrying a giant cheese: the cheese is yours"><br><b>Caccia alla Forma.</b> Three minutes, one cheese. Hold it longest to win, and it keeps getting heavier</td>
</tr>
<tr>
<td width="50%"><img src="docs/media/mode-ghost.jpg" alt="A pale ghost kart drives just ahead of the player"><br><b>Time trial.</b> No bots, no crates: splits, records and a ghost of your best lap</td>
<td width="50%"><img src="docs/media/mode-teams.jpg" alt="The team podium: Team Sambal wins"><br><b>Team championship.</b> Two against two over a Gran Premio, a bot fills any gap</td>
</tr>
</table>

Or a single race. Easy, Medium or Very hard, and 2, 3 or 5 laps.

## Start

Needs Node 24 or newer.

| Command | What it does |
|---|---|
| `npm install` | once |
| `npm run play` | builds, starts the server, opens the game |
| `npm test` | every test (see `docs/testing.md`) |

Scan the QR on the TV with each phone. Phones and computer must be on the same network: a Wi-Fi or a phone's hotspot. If the computer changes network, scan the QR again.

The commentary's voices are not in the repository (`assets/voice/` is git ignored, see `CREDITS.md`): a fresh clone plays it silently, with captions only. To make them for your own machine, `python3 tools/make-voices.py` (needs internet, about 48000 characters, makes its own `.venv`), then `npm run build`.

## How many can play

| Players | How | The screen |
|---|---|---|
| 1 | one phone, bots to race against | full screen |
| 2 | two phones | side by side |
| 3 | three phones | a grid, the fourth cell shows the whole track from above |
| 4 | four phones | a grid of four |
| No phone at all | the keyboard, or the mouse in the menus | as many as keys pressed |

A fifth phone waits for a free seat. A phone that leaves keeps its seat for 60 seconds.

## The evening

| Step | On the TV | On the phone |
|---|---|---|
| Lobby | QR, seats, options | options, Go |
| Kart | all the karts on turntables | swipe, confirm |
| Track | big cards, coin if you disagree | swipe, vote |
| Race | a flyover, 3, 2, 1, Go | the wheel |
| After | results, then the podium | rematch, change track |

## What the phone does

| Control | What it does |
|---|---|
| Stick, right two thirds | steer. Throttle is automatic. Pull down to brake and reverse |
| DRIFT, left thumb, hold | hop and slide. The longer you hold, the bigger the turbo on release |
| USE ITEM, left thumb, tap | use what the crate gave you. Stick up throws things ahead |

## Keyboard

| Player | Drive | Drift | Item |
|---|---|---|---|
| 1 | W A S D | Left Shift | E |
| 2 | Arrows | Right Ctrl | Enter |
| 3 | I J K L | U | O |
| 4 | Numpad 8 4 5 6 | Numpad 7 | Numpad 9 |

Esc or P pauses. In the menus, left and right move, the item key confirms.

## Under the hood

| Part | How |
|---|---|
| Rendering | three.js, in the browser on the TV |
| Simulation | deterministic: seeded, in fixed steps |
| Phones | a web page and a WebSocket to a small Node server on your network: they are only controllers |
| Skylines | real elevation data, Copernicus DEM GLO-30 |
| Backdrops | painted, the mountains and landmarks repainted from real photos of the real places |
| Art and sound | procedural geometry, music and sound synthesised live with WebAudio |

## Status

Tested by automated tests in headless Chromium. Real phones and real play are being tried now.

Every picture on this page is a real capture of the real game, with the karts driven by script and placed for the shot (`tools/shoot-readme.mjs`).

## Credits and licence

Code: MIT, see `LICENSE`. Painted backdrops: CC BY-SA 4.0, authors file by file in `assets/backdrops/CREDITS.md`. Data, fonts and libraries: `CREDITS.md`.

| More | What |
|---|---|
| `docs/specs/2026-11-04-racing-karts-design.md` | the design and every module's contract |
| `docs/testing.md` | when the phone cannot connect, tests, tools |
| `docs/references/` | the facts behind each real place, with sources |
