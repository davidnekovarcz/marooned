---
name: Admin look and cap
overview: Delete Kaloko test rooms when a walk finishes, restyle the admin page as a light screen over an island, and raise the player cap to 10 while keeping the four shore spawns.
todos:
  - id: kaloko-delete
    content: Let the Kaloko host delete only kaloko- rooms, and do it at the end of every walk
    status: completed
  - id: admin-screen
    content: Restyle /admin as a light dashboard screen over a palm island
    status: completed
  - id: cap-10
    content: Set the player cap to 10 and share the four shore spawns
    status: completed
isProject: false
---

Shipped on Marooned PR 27. The line below that says to continue on that open PR is historical.

# Admin look, cap 10, Kaloko cleanup

Continue on `feature/marooned-admin` (open PR 27). Rules for room deletion go out to `grand-island-survival` with the cap change.

## Kaloko rooms disappear after a walk

Survival walks already open a fresh id (`kaloko-death-<time>`, and the same for fish and fire). Boot, Say, and mobile share `kaloko-smoke`. None of these nodes are removed, so they pile up on `/admin`.

A player still cannot delete `demo`. Only a room whose id matches `kaloko-` plus letters, digits, and hyphens, and only the host, may delete that room’s own rows. The delete permission is added on the leaves the host cannot clear today (`config/maxPlayers`, `config/createdAt`, `stats/peakPlayers`, and `visits/$uid`) in [`Marooned/database.rules.json`](Marooned/database.rules.json). A write rule on the room itself would also block ordinary play, so the client clears those children one by one. When the last child is gone, the room node is gone.

[`Marooned/web/src/net/room.ts`](Marooned/web/src/net/room.ts) gains that cleanup. The game calls it when a Kaloko page closes. Each step in [`Marooned/qa/flows/steps`](Marooned/qa/flows/steps) also calls it in `finally`, including when the walk fails, through one helper in [`helpers.mjs`](Marooned/qa/flows/steps/helpers.mjs). `demo` and rooms created from admin are left alone.

## The admin screen

[`Marooned/web/src/admin/Admin.vue`](Marooned/web/src/admin/Admin.vue) and the `body.admin` rules in [`Marooned/web/src/style.css`](Marooned/web/src/style.css) become a light dashboard sitting on a lagoon. Sky, water, and sand are CSS, with palm silhouettes at the edges. The controls stay inside one rounded off-white screen: rooms in a sidebar, stat cards across the top, players and ground items as cards. Sign-in uses the same screen. The game HUD is unchanged.

## Cap 10, four spawns

[`findSpawns`](Marooned/web/src/island.ts) already returns the four shore points (north, east, south, west). [`Game.ts`](Marooned/web/src/game/Game.ts) today uses `spawns[room.slot]`, so a slot of 4 or higher misses those points and falls back to one cell. It will use `spawns[room.slot % 4]` instead. Ten people can be in the room; they still wash up on those four beaches.

In [`protocol.ts`](Marooned/web/src/net/protocol.ts), `ROOM_SLOT_COUNT` stays 4 for the beaches. `DEFAULT_MAX_PLAYERS` and `MAX_PLAYERS_LIMIT` become 10. The admin number fields, the database rule (`1` through `10`), and every existing room’s `config/maxPlayers` are set to 10. A room can still be lowered later; it cannot be raised past 10. Someone already inside stays if the cap drops.
