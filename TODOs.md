# TODOs

Checklist toward Steam launch. Docs: [`GAME.md`](_docs/GAME.md), [`STACK.md`](_docs/STACK.md), [`MVP.md`](_docs/MVP.md).

**Status:** Three.js web teaser on Heroku (`?room=demo`), 4-player host-client.

| Slice | Done | Target |
| --- | --- | --- |
| Prototype | ~85% | 20–40 min solo |
| MVP | ~55% | Vertical slice |
| Multiplayer | ~35% | 4-player live |
| Steam | ~15% | Desktop, store |

## Prototype — shipped

- [✓] ~~docs, CC0 packs, island, dressing, walk, camera, day/night, clock~~
- [✓] ~~HUD (thirst, hunger, temp, energy, wetness, health), death screen~~
- [✓] ~~hands, pockets, pickup/drop, eat/drink, swim, rain~~
- [✓] ~~campfire, torch, fishing, lean-to, loot timers~~
- [✓] ~~animals, audio, character select, cookie banner~~
- [✓] ~~Heroku + 4-player Firebase rooms~~

## Web teaser

- [✓] ~~other players (held mesh, nametags, say bubbles)~~
- [ ] host world snapshot missing in RTDB
- [ ] stale slots when tab dies

## Core loop

- [ ] loot tables (hand vs world)
- [ ] ~15 named types (cloth, bottle, rope, nails, pot, notes, bandage)
- [ ] inventory beyond pockets
- [ ] crafting (stone knife, bandage, rope, plank)
- [ ] hunting
- [ ] house stages 2–3
- [ ] storms, wreck events
- [ ] notes, pause/settings, pass-out, drink via container, audio pass

## Multiplayer (8–16 target)

- [ ] dedicated server (today: host tab)
- [ ] 8–16 concurrent
- [ ] persistence when offline
- [ ] presence (drops, share)
- [ ] indoor stash private
- [ ] emotes

## Steam

- [ ] engine call (Three.js vs Godot 4.6)
- [ ] desktop build
- [ ] Steamworks, demo, store, trailer
- [ ] price $12–20
- [ ] credits, EULA, privacy, age rating
- [ ] localization

## Later

- [ ] illness, more biomes, cosmetics
- [ ] Academy SKU, mobile, reputation, PvP shard
