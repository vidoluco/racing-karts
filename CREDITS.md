# Credits

Everything in the game is original and made for it: art is procedural geometry, music and sound are synthesised live with WebAudio, with two exceptions: the far backdrops are paintings of real photos of the real places, listed in `assets/backdrops/CREDITS.md`, and the commentators' voices, below. Nothing here comes from another game.

| What | Source | Licence |
|---|---|---|
| Real skylines (`data/horizon/`) | Copernicus DEM GLO-30, © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA | Free, with this attribution |
| Painted backdrops (`assets/backdrops/`) | Real photos from Wikimedia Commons, repainted, authors file by file in `assets/backdrops/CREDITS.md`, released here as CC BY-SA 4.0 | CC BY-SA, CC BY and public domain, same licence for the paintings |
| Font in the HUD and on the phone | Fredoka, The Fredoka Project Authors | SIL Open Font License 1.1 |
| Rendering | three.js | MIT |
| Network | ws | MIT |
| QR code | qrcode | MIT |
| Screen wake on phones | NoSleep.js (its media only) | MIT |

Facts about the real places are in `docs/references/`, with their sources.

## The commentators' voices: not in this repository

The telecronaca is the second exception to "all sound is live". Its voices (`assets/voice/`, made by `tools/make-voices.py`) are synthetic speech, no person recorded these lines; the lines themselves are written for this game. Checked on 05/11/2026:

| What | Source | Licence, as far as it goes |
|---|---|---|
| The tool, `edge-tts` 7.3.1, on the build machine only, never bundled | github.com/rany2/edge-tts | LGPLv3 (`srt_composer.py` MIT). This covers the tool, it says nothing about the audio |
| The audio: it-IT-DiegoNeural, it-IT-IsabellaNeural, ro-RO-EmilNeural, ro-RO-AlinaNeural, id-ID-ArdiNeural, id-ID-GadisNeural | Microsoft's neural voices, through the service behind Edge's Read Aloud | **No licence for this use that we can point to.** `edge-tts` is not a Microsoft product and that service is not a public API. Microsoft's answer on its own forum: to provide text to speech legally, use Azure AI Speech, and commercial use without a valid subscription could violate its terms |

So the packs are not distributed. They are git ignored, and the game runs without them, with captions only. `tools/make-voices.py` can build them on your own machine for your own use; check the terms of the voice service first.

Sources: learn.microsoft.com/en-us/answers/questions/2088770 (edge-tts, 07/10/2024), learn.microsoft.com/answers/a/12933078 (redistribution of Azure audio, 27/08/2026), learn.microsoft.com/en-us/answers/questions/1192398 (commercial use).
