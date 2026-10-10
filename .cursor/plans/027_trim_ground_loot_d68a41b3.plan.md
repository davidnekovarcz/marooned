---
name: Trim ground loot
overview: Demo room ground items are far over the fruit and tool caps. The admin respawn command is already queued, but it only runs inside a live host, and that host load is also what deletes the extras.
todos:
  - id: host-trim
    content: Open demo as host so enforceCaps publishes and the pending respawn fills waiting tools
    status: completed
  - id: recheck
    content: Re-read rooms/demo world items and confirm fruit and tools are within caps
    status: completed
isProject: false
---

Shipped. This plan is finished. Instructions in other plans to continue on PR 27 or not to merge are not current work.

# Trim demo ground loot

`rooms/demo/world/items` is public and currently **not** within the caps in [`Marooned/web/src/sim/loot.ts`](Marooned/web/src/sim/loot.ts). The loot timer list (52 lives) is mostly inside the caps; the extras are old copies saved on the ground.

Over the cap (ground count / max):

- Fruit: banana 34/2, orange 36/2, lemon 35/2, pineapple 37/2, watermelon 36/2, tomato 37/2, mushroomTan 41/2, mushroomRed 37/2, coconutHalf 36/2. Coconut is 10/10.
- Tools: axe 13/2, torch 6/2. Knife, hammer, and shovel are 1/2. Fishing pole is 0/2.
- Stick 9/8 and fiber 11/6 are above the spawn counts, but `lootGroundCap` returns no cap for resources, so `enforceCaps` will not remove them.

The admin button only writes `rooms/demo/commands/respawnItems`. That timestamp is already set (2026-10-08 18:43 Prague). `slots` is null, so no host is running the loop in [`Marooned/web/src/game/Game.ts`](Marooned/web/src/game/Game.ts) that calls `forceGroundRespawn()`. That call only marks waiting loot as due. It does not delete the extra bananas and axes.

Those extras come off when a host on the cap build loads the room: `applyNetWorld`, then `loot.enforceCaps()`, then the host publishes the trimmed world. The pending respawn then fills waiting tools (including the missing fishing poles) up to 2. Pockets are not in this list.

After you confirm, open `https://marooned-island-e8bc6f06ff39.herokuapp.com/?room=demo` and stay until this client is host long enough to publish. Then re-read `world/items` and `world/loot` and confirm fruit and tools are at or under the caps. Do not write the respawn command again.
