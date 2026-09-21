# TODOs

Living checklist toward a paid store launch (Steam first).
Design: [`_docs/GAME.md`](_docs/GAME.md). Stack: [`_docs/STACK.md`](_docs/STACK.md). MVP: [`_docs/MVP.md`](_docs/MVP.md). Investor one-pager: [`_docs/LEAN_CANVAS2.md`](_docs/LEAN_CANVAS2.md). Short canvas: [`_docs/LEAN_CANVAS.md`](_docs/LEAN_CANVAS.md).

**Status (2026-09-21):** playable Three.js web teaser on Heroku (`marooned-island`, `?room=demo`). Not a Steam build.

| Slice | Roughly done | What “100%” means |
| --- | --- | --- |
| Prototype island (walk, loot, body, weather, fire) | **~85%** | Fun 20–40 min solo session |
| GAME.md MVP (demo-able fantasy, incl. house 1–3 + wreck race) | **~55%** | Vertical slice + lean-to + storms optional |
| Shared island (design: 8–16, dedicated server) | **~35%** | 4-player host-client teaser is live; not 8–16 authoritative |
| Steam v1 / store | **~15%** | Desktop build, page, trailer, paid SKU |

HUD: thirst, hunger, temperature, **wetness**, **energy**, **health**. Design v1 in [`_docs/GAME.md`](_docs/GAME.md) §3.1 is four meters (thirst, hunger, temperature, wetness). Energy/health are prototype extras and can stay.

## TODOs:

### Prototype (Three.js) — shipped

- [✓] ~~docs (GAME, STACK, MVP, COMPETITORS, THIRD_PARTY)~~
- [✓] ~~CC0 vendor packs (Kenney complete; Quaternius nature, animals, fish)~~
- [✓] ~~basic island (beach, grass, ocean, pond/river, wreck, hut)~~
- [✓] ~~island dressing (flowers, bushes, logs, wreck/hut props)~~
- [✓] ~~grid walk, sprint, Kenney survivor, orbit camera + zoom~~
- [✓] ~~day/night + clock~~
- [✓] ~~HUD: thirst, hunger, temperature, energy, wetness, health; death screen~~
- [✓] ~~hands + two pockets; pickup/drop (knife, hammer, torch, tinder, food)~~
- [✓] ~~eat/drink: coconut (hammer → halves), fruit, pineapple (knife cut)~~
- [✓] ~~inland swim (ocean blocked)~~
- [✓] ~~rain, wetness, unsheltered fire douse~~
- [✓] ~~lit campfire (PointLight + particles; cook fish, dry, warm)~~
- [✓] ~~darker night + torch radius (local + other players’ torches)~~
- [✓] ~~drink from pond~~
- [✓] ~~shore fishing (pole required)~~
- [✓] ~~lean-to (sticks + fiber + hammer)~~
- [✓] ~~loot respawn / rot timers (client; rehydrate ground items from room snapshot)~~
- [✓] ~~pond fish visible (cosmetic swim) + idle/walk animals~~
- [✓] ~~ambient audio (surf, rain, fire, frogs, birds)~~
- [✓] ~~character select; EU cookie banner + Consent Mode v2~~
- [✓] ~~Heroku SPA + 4-player Firebase room (host world, guest intents, persist survivor + island on refresh)~~

### Next on the web teaser

- [✓] ~~other players: held mesh in hands + nametag (name)~~
- [✓] ~~say bubble: Enter, type, Enter; one line over the head; no queue~~
- [ ] host world snapshot sometimes missing in RTDB (fires/items still work locally; guests need the write)
- [ ] stale room slots when a tab dies before `onDisconnect`

### Core loop (sellable session)

- [ ] loot tables: explicit hand loot vs world loot (today: mixed scatter + Loot timers)
- [ ] ~15 named loot types as in GAME.md (missing: cloth, bottle, rope, nails, pot, notes, bandage as first-class)
- [ ] inventory beyond two pockets
- [ ] crafting board (stone knife, bandage, campfire-from-kit, rope, plank — lean-to and cooked fish exist)
- [ ] hunting (kill/loot using existing animal packs)
- [ ] player-built house stages 2–3 (hut, house); stage 1 lean-to is in
- [ ] storms + wreck-crate events (rain/storm sky exists; crate event does not)
- [ ] notes (optional other languages; wet paper later)
- [ ] pause/settings, title flow; save/load is room RTDB + local survivor, not a pause menu
- [ ] pass-out on beach (not only permadeath screen)
- [ ] drink from pond via container / boil (bare-hands pond drink is in)
- [ ] audio/music pass (hammering from others, music)

### Shared island (v1 target: 8–16 players, no PvP)

Shipped teaser: **4 slots**, Firebase RTDB, host-authoritative world, anonymous auth, Heroku static client.

- [ ] dedicated server (authoritative loot, houses, weather) — today the **host tab** is the sim
- [ ] 8–16 concurrent (overflow shards)
- [ ] persistence when **everyone** is offline (RTDB keeps the last snapshot; no host → clock/loot freeze)
- [ ] presence: names (planned), drops (ground drop exists), share-water
- [ ] indoor stash private; open world contested
- [ ] emotes beyond say bubbles

### Product / Steam

- [ ] engine call: keep Three.js as teaser vs Godot 4.6 as Steam product (same glTF)
- [ ] desktop build (not a browser tab)
- [ ] Steamworks, demo, store page, trailer, capsules
- [ ] price $12–20; no pay-to-win
- [ ] in-game credits (Kenney, Quaternius, Poly Haven)
- [ ] EULA, privacy policy, age rating
- [ ] UI localization (en strings exist; more locales TBD)
- [ ] Steam achievements / cloud saves (NTH for v1)

### Later (not v1 blockers)

- [ ] tropical illness + medicine
- [ ] more biomes / islands
- [ ] cosmetics (no survival advantage)
- [ ] Marooned Academy SKU
- [ ] iOS / Android
- [ ] reputation / co-op house
- [ ] optional PvP shard (never the default family island)
