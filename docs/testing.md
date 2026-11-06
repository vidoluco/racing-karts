# Testing and playing

## Play

```
npm install        # once
npm run play       # builds dist/, starts the server, opens the game
```

| Address printed | Who opens it |
|---|---|
| `game (this Mac)` | the browser on the Mac or the TV |
| `game (LAN)` | the same page from another computer on the Wi-Fi |
| `phone pad` | each phone: scan the QR, or type the address |

## When the phone cannot connect

| Symptom | Cause and fix |
|---|---|
| The QR points to a `10.x` or `100.x` address, or the page never loads | A VPN on the Mac took over the address. Disconnect it, or force the Wi-Fi address: `LAN_IP=192.168.1.23 npm run play` (`ipconfig getifaddr en0` tells you which) |
| The page loads on the Mac, not on the phone | Allow incoming connections for `node` (System Settings, Network, Firewall). Guest Wi-Fi often isolates devices: use the home Wi-Fi or a phone hotspot |
| `Port 5191 is already in use` | Another copy is running. Stop it, or `PORT=5192 npm run play` |
| The phone says "Connection lost" | It reconnects by itself and keeps its seat for 60 s. Its kart coasts, the TV says who is missing; after 15 s a bot drives it until the phone is back |

## Tests

```
npm test                                  # everything
node --test test/flow.test.mjs            # one file
node --test --test-name-pattern=Premio test/flow.test.mjs
```

The browser tests use Chromium from the playwright or puppeteer cache and are skipped when there is none.

| File | What it covers | Browser |
|---|---|---|
| `sim`, `world` | the race and the tracks | no |
| `long` | the long track engine on a synthetic 10 km lap: index, levels at a crossing, everyone home, determinism; a whole lap at 1, 2 and 4 views against the budgets, frames at chunk borders, memory; the map | Metal |
| `e2e` | the real server as its own process, four phones in real pad pages driven by touch: lobby to podium and rematch; a phone dropping out and returning; one player with seven bots at each difficulty; the keyboard alone | Metal |
| `flow` | the state machine; then a whole evening on the real server with a real phone page, a phone leaving and returning, rematch, change track, Gran Premio | Metal |
| `timetrial` | the sim's option, the ghost's codec and replay, splits, records and their failures, a lap on every track; a phone from the lobby to the results twice with a reload between, then a normal race with none of it; the keyboard alone | Metal |
| `family-karts` | the secret karts: stats, what a won Gran Premio opens and saves, the bots never take them, the bite and a race with none of it; a phone from a locked line-up through a Gran Premio to Baileys picked and raced, with a reload between; Fifi | Metal |
| `teams` | the team championship: sides, field, points, tie-break, friendly fire and aim, the room; two phones and the TV from the lobby through two races to the team podium and a rematch, then a plain Gran Premio on the same page with none of it; the keyboard alone | Metal |
| `forma` | Caccia alla Forma: a normal race with none of it and the same bytes, determinism, clock and finish order, every way of dropping the wheel, the lock, weight, pull and leash, stork, razzo and frana, no rolling cheese from the crates, a real match on two short and two long roads; flow, room, phone, words, sounds. A phone and the TV from the lobby chip to results and podium, then a normal race on the same page with none of it; a long road from the tools' way in | Metal |
| `weather` | Rain, snow, fog and night: a plain race with none of it and the same bytes, determinism, grip by surface, one splash through a puddle, thunder, the options, bots home on every track under every sky; budgets at 1, 2, 4 views; no seam across the sky; lobby and vote by phone and TV to the results, then a plain race on the same page |
| `i18n` | dictionaries, diacritics, no em dash, every key the code asks for | no |
| `net`, `pad` | the room, the phone page with touch | pad only |
| `render` | tracks and karts build, stats under budget | Metal |
| `audio` | tunes and effects in an offline context | yes |

## Tools

| Command | What it does |
|---|---|
| `node tools/shoot-ui.mjs [menus] [hud1] [hud2] [hud3] [hud4] [--size 1440x900] [--suffix -small] [--locale en-US]` | screenshots of every TV screen through the real game, into `docs/shots/ui-*.png`. It also reports text under 13 px, cut off or off screen |
| `node tools/shoot-race.mjs [scenes] [2v] [4v]` | the real game with each item in use, into `docs/shots/race-*.png` |
| `node tools/shoot-tempo.mjs [--track id] [--dir path] [menus] [road] [2v] [4v]` | the time trial through the real game and a real phone page, into `docs/shots/tempo-*.png` |
| `node tools/shoot-teams.mjs [--track id] [--dir path] [--lang it] [--size 1920x1080] [--suffix -x] [menus] [road] [2v] [4v]` | the team championship through the real game and real phone pages, with the text audit, into `docs/shots/teams-*.png` |
| `node tools/shoot-forma.mjs [--track id] [--kart id] [--lang it] [--dir path] [--size 1920x1080] [menus] [pad] [road] [2v] [4v] [end]` | Caccia alla Forma through the real game and a real phone page, with the text audit, into `docs/shots/forma-*.png` |
| `node tools/shoot-weather.mjs [--track id] [--kart id] [--lang it] [--dir path] [--size 1920x1080] [--skies rain,snow,fog,night,rain+night] [--at u] [menus] [road] [2v] [4v]` | every sky through the real game, into `docs/shots/meteo-*.png`, with calls and triangles printed |
| `node tools/shoot.mjs <track> ...` | the world, from any pose |
| `node tools/perf.mjs` | frame times on the Metal backend |
| `node tools/simrun.mjs` | the sim alone, many races |

Use a private port and folder when several copies run at once: `PORT=0 DIST=/tmp/rk node build.mjs && PORT=0 DIST=/tmp/rk node server/index.js`.

## Hooks for tools

Query params: `?track=bali&kart=jeep&bots=7&difficulty=hard&auto=1` skips the menus. `?players=n` or `?views=n` seats humans, `?laps=n`, `?seed=n`, `?lang=it`, `?flyover=0`, `?countdown=n`, `?manual=1`, `?quality=capture`.

`window.__game`: `phase`, `ready`, `error`, `state` (the sim's), `t`, `track`, `views`, `seats`, `results`, `gp`, `podium`, `flyover`, `paused`, `counts` (sim events of this race by type, and `use:<item>`); `speed` runs the race that many times faster than real time; `manual` stops the sim on the screen's clock, so that nothing but `advance(n)` steps it and scripted inputs are read once per step; `advance(n)`, `draw()`, `skipFlyover()`, `setAuto(on)`, `setScript(fn)`, `drive(i)`, `botInput(slot)`, `give(i, item)`, `teleport(...)`, `rescue(i)`, `spinItem(i, item)`, `next(kind)`, `setPaused(on)`; `flowApi`, `ui`, `renderer`, `audio` for the tests.
