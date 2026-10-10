---
name: Tool and fruit caps
overview: Open the admin ground list on tools, and keep at most two of each tool on the island. Fruit stays at the counts already in the loot table, counted on the ground only.
todos:
  - id: default-tools
    content: Default the admin ground category filter to tools
    status: completed
  - id: tool-cap
    content: Set each tool, including the fishing pole, to two ground copies
    status: completed
  - id: enforce-caps
    content: Trim fruit and tools to the ground caps after world load, spawn, and rot
    status: completed
isProject: false
---

Shipped. This plan is finished. Instructions in other plans to continue on PR 27 or not to merge are not current work.

# Tool and fruit caps

Default the admin ground filter to tools, and stop the island from holding more than the planned ground counts. Pockets and held items stay out of the count.

## Default filter

In [`Marooned/web/src/admin/Admin.vue`](Marooned/web/src/admin/Admin.vue), `categoryFilter` starts as `"all"`. Start it as `"tool"` so Ground items opens on tools. The category value is already `tool` (label “Tools”) in [`Marooned/web/src/admin/ground.ts`](Marooned/web/src/admin/ground.ts).

## Counts

No plan file states different fruit numbers. The table in [`Marooned/web/src/sim/loot.ts`](Marooned/web/src/sim/loot.ts) is the limit:

- coconut: 10
- coconut half, banana, orange, lemon, pineapple, watermelon, tomato, tan mushroom, red mushroom: 2 each

Tools there are one each (`knife`, `hammer`, `shovel`, `axe`, `torch`). Raise those to 2. `fishingPole` is the other admin tool and is placed once by hand in [`Marooned/web/src/props.ts`](Marooned/web/src/props.ts); move it into the same tool table at 2 and drop that one-off prop so it is not a third pole. Sticks, stones, and fiber stay at their current resource counts.

## Why the island exceeds those numbers

[`Loot`](Marooned/web/src/sim/loot.ts) already refuses a new fresh fruit when `freshCount` is at the cap. Two paths still put more on the ground:

- Joining loads a full local spawn, then [`applyNetWorld`](Marooned/web/src/net/worldSync.ts) adds the saved items (different ids) and [`adoptTimers`](Marooned/web/src/sim/loot.ts) can spawn again. The host then publishes the extras.
- A fruit that rots still sits on the ground while a replacement spawns, so fresh plus rotten can pass the cap. Tools never check a cap on respawn (`ignoreCap: true` at startup).

## Enforcement

Count ground copies only: fresh and rotten items of that kind in the world list. Waiting timers and inventories do not count.

After the host applies a saved world and adopts timers, drop extras down to the cap (rotten first). `trySpawn` and the rot replacement use that same ground count, for fruit and for tools. A tool still waits its current respawn time before the empty slot is filled.

A small test locks the table (tools 2, coconut 10, other fruit 2) and a case where saved ground items plus a local spawn are trimmed back to the cap.
