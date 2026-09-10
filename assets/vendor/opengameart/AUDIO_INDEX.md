# OpenGameArt audio — intended use

CC0 packs in this folder. Re-fetch with `scripts/fetch-opengameart-audio.py`. Eating SFX (`eat_01` / `eat_04`) are wired in `web/src/audio.ts`; other packs are still catalog-only.

Kenney already covers actions (chop, creak, cloth, footsteps, impacts) under `vendor/kenney/rpg-audio` and `vendor/kenney/impact-sounds`.

| Use | Folder | Files | Notes |
| --- | --- | --- | --- |
| Ocean / surf loop | `beach-ocean-waves/` | `wave_01_…flac` … `wave_04_…flac` | jasinski, CC0. Replace procedural `makeWaveBuffer` later. |
| Inland / river bed | `sea-and-river-waves/` | `VistulaShort_0.mp3` | RandomMind, CC0. Short (~5 min) only; full 180 MB zip not downloaded. |
| Forest birds | `ambient-bird-sounds/` | `birds-isaiah658_0.ogg` | isaiah658, CC0. Ambient loop, not UFO seagull. |
| Sheep | `sheep-baa/` | `sheep_baa_0.ogg` | When sheep spawn again. |
| Pig / fox / deer audition | `80-cc0-creature-sfx/` | `grunt_*.ogg`, `barking_*.ogg`, `cute_*.ogg`, `hurt_*.ogg` | rubberduck, CC0. Skip alien/weird/monster unless a later pass needs them. |
| Eating (wired) | `80-cc0-creature-sfx/` | `eat_01.ogg`, `eat_04.ogg` | Alternating chew while meal lock runs; clips never cut mid-play. |

Credits: not required for CC0; still name authors in game credits (jasinski, RandomMind, isaiah658, mikewest, rubberduck).
