# Tilt steering: the test on real phones

Nothing here has run on a real phone. The tests (`test/gyro.test.mjs`) use headless Chromium, with a sensor that is emulated or stubbed and an iPhone's refusal of `wss://` that is simulated. These steps are the part only two hands and a TV can check. Do them once with an iPhone and once with an Android phone.

## Before starting

1. On the Mac: `npm run play`. The console must print a `tilt steering: https://<ip>:5192/pad` line. If it says "http only", the stick still works and the rest of this page does not apply.
2. Open the game on the TV as usual, and scan the QR with the phone (it is still plain `http`, port 5191).
3. If macOS asks whether `node` may accept connections, allow it. 5192 is a new port.

## iPhone, Safari

1. In the lobby, tap **Sterzo: Giroscopio**. A card explains the step. Tap **Continua**.
2. Safari shows "This connection is not private". Tap **Show Details**, then **visit this website**, then **Visit Website**. Italian: **Mostra dettagli**, **visita questo sito web**, **Visita sito web**.
3. The pad comes back on `https://...:5192/pad`, in the same seat. The TV may say offline for those seconds, and the seat must stay the same.
4. A card asks for a tap: **Attiva**, then **Allow** on Safari's question. Do not tap anything else first.
5. If rotation is locked in Control Center the steering still works, but the screen stays upright while you hold it on its side. Turn the lock off for the buttons to turn too.

## Android, Chrome

1. In the lobby, tap **Sterzo: Giroscopio**, then **Continua**.
2. Chrome shows "Your connection is not private". Tap **Advanced**, then **Proceed to ... (unsafe)**. Italian: **Avanzate**, **Procedi su ... (non sicuro)**.
3. The pad comes back in the same seat. If a card appears, tap **Attiva** and allow it. Recent Chrome versions may ask; older ones just start.

## What to check, in one race on each phone

| Check | Expected |
|---|---|
| Hold it sideways, level, thumbs on | The kart goes straight, nothing drifts by itself |
| Rest it crooked during the flyover, level during the 3, 2, 1 | At GO the kart goes straight: straight ahead is taken just before GO |
| On an iPhone with the rotation lock on, sideways at a normal angle | Same as without the lock: level is straight, right is right, **Centra** works |
| Turn it right, turn it left | The kart follows at once, small turns give small corrections, full lock at about 40 degrees |
| Tip the phone towards you, away, nearly flat | The steering does not change |
| Turn the phone over to the other landscape | Left is still left, right is still right |
| Thumb down on the stick | It brakes, also with the wheel turned hard |
| Thumb on Drift and on Item | As they were |
| **Centra** at the top right, holding it a bit crooked | That becomes straight ahead |
| Lock the phone for 20 s, unlock | Back in the seat, still steering by tilt |
| Back in the lobby, tap **Stick** | The page goes back to http, same seat, the thumb steers again |
| Scan the QR again on a phone that chose the gyroscope | A card, **Giroscopio: ancora un tocco**: **Continua** goes to https, the same seat, no new warning unless the browser forgot it; **Resto sullo stick** stays on http, for good |
| On that card tap **Continua**, then Back on the warning page | The http pad, on the stick, in the same seat. iPhone and Android both: this history is the part only Chromium was seen doing |
| With the rotation lock on, in a race, turn past 60 degrees and all the way to 90, and back | Full lock the same way all the time, never the other way, and straight ahead stays where it was |
| A second phone on the stick, all evening | No card, no warning, exactly as before |

## The question this answers

Safari on iPhone has a long record of refusing `wss://` to a self-signed certificate even after the warning was accepted, and current iOS may or may not still do it. The pad tries `wss://` first and falls back on a link made of ordinary requests. Look at the Mac's console while the iPhone is on https:

- no extra line: `wss://` worked on this phone;
- `pad xxxxxxxx on the https link: this phone refused wss`: the fallback is in use. Then say whether steering feels as immediate as on the Android phone. That delay is the one number no test here can measure.

## When something goes wrong

| What you see | What it means |
|---|---|
| "Si sterza con lo stick: I sensori non rispondono" | No sensor events in 2 s. Android: Chrome, Site settings, Motion sensors must be allowed |
| "Permesso dei sensori negato" | Tapped Don't Allow. iPhone: close the tab and scan again to be asked again |
| "La pagina sicura non si è aperta" | Went back from the warning. The phone stays on the stick; choose the gyroscope to try again |
| The warning comes back another day | The Mac's address changed (a new certificate is made), or the browser forgot. Same steps |
| "Scansiona di nuovo il QR" on https | The Mac changed network. Scan the QR; choose the gyroscope again on the new address |
| "La pagina sicura non si collega" after about 10 s on https | The page opened but neither `wss://` nor the link reached the game. **Resto sullo stick** goes back to http in the same seat. Report this one: it answers the question above, and it means this phone cannot steer by tilt |
| In a race with the rotation lock, a phone held upright reads full lock | It was laid on its side for a moment, and the race then holds it as a wheel. **Centra** lets it be upright again; the next race starts fresh too |
| A phone stuck at the warning page | Port 5192 blocked: check the macOS firewall and any VPN on the Mac |

Report which phone, which iOS or Android version and which browser. A tilt that is too sensitive or too lazy is a one-line change: `FULL_LOCK` and `steerCurve` in `controller/tilt.js`.
