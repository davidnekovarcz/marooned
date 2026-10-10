---
name: Room ground caps
overview: The Marooned admin ground list will show only loot and place props, and each of those kinds can have a max saved on the room. A host on that room trims and refills to the saved max.
todos:
  - id: visible-kinds
    content: Limit the admin ground list to tools, food including fish, stone, sticks, logs, wreck, and camp
    status: completed
  - id: room-caps
    content: Save a 0-40 max per kind on the room and enforce it when the host loads
    status: completed
isProject: false
---

Shipped on Marooned PR 27. The instruction below to update that PR and not merge is historical.

# Per-room ground max

The admin list in [`Marooned/web/src/admin/Admin.vue`](Marooned/web/src/admin/Admin.vue) currently starts on tools but can still show every palm, bush, and rock. Caps live only in [`Marooned/web/src/sim/loot.ts`](Marooned/web/src/sim/loot.ts) (`lootGroundCap`: tools 2, coconut 10, other food 2). Stone, sticks, logs, wreck, camp, and fish have no admin max.

## What the list shows

Add `visibleGroundKind` in [`Marooned/web/src/admin/ground.ts`](Marooned/web/src/admin/ground.ts) and use it as the only filter. Drop the category dropdown.

Shown:

- Tools: knife, hammer, axe, shovel, torch, fishing pole
- Food: the fruit and mushrooms already capped, plus fish and cooked fish
- Stone, stick, log, logLarge, natureLog
- Wreck and boat pieces already in the wreck set (wreck, boats, crates, barrels, chest, bottles, flag, bow, arrow)
- Hut and camp pieces already in the camp set (structure, tent, floor, campfire, fish stand, bedroll, bucket, lean-to, bridge)

Hidden: palms and other trees, stump, bushes, flowers, rocks, lilypad, fiber, tinder, and the campfire log and stone rings.

Group the remaining rows by kind. The kind heading shows how many are on the ground, then the cells as they are now.

## Max saved on the room

Each kind heading gets a number and Save. That writes `rooms/$id/config/groundCaps/$kind` as an integer from 0 to 40. The field shows the saved value, or the built-in cap when the room has none (2 tools, 10 coconuts, 2 other loot food, 5 stone, 8 sticks). Wreck, camp, logs, and fish start empty, which means no limit until a number is saved.

Rules in [`Marooned/database.rules.json`](Marooned/database.rules.json): the admin email may write that number; a Kaloko host may delete it. [`deleteKalokoRoom`](Marooned/web/src/net/room.ts) already clears `maxPlayers` and `createdAt` one key at a time, so it must also clear each `groundCaps` child.

The host reads `groundCaps` when it loads the world and passes the map into `Loot`. `lootGroundCap` uses the room number when present, otherwise the built-in cap. `enforceCaps` drops extras (rotten first). For food and tools, if the room max is higher than the lives created in the constructor, the host adds waiting lives up to that max so the next respawn can fill them. Wreck, camp, logs, stone, sticks, and fish are only trimmed; a higher max does not build new props. The trim publishes the next time a host is in the room, same as the caps today. Pockets are not counted.

Update the ground-category test in [`Marooned/web/src/admin/metrics.test.ts`](Marooned/web/src/admin/metrics.test.ts) and the cap test in [`Marooned/web/src/sim/lootCaps.test.ts`](Marooned/web/src/sim/lootCaps.test.ts) for an override above and below the built-in cap.

Ship on `feature/marooned-admin`: commit, push, update PR 27, deploy with `git push heroku HEAD:main`. Do not merge.
