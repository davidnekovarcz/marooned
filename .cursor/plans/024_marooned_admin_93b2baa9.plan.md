---
name: Marooned admin
overview: Add a Marooned admin page, signed in with your Google account, to list rooms, players, and ground items, show survival stats, and set the player cap, force a ground respawn, or create a room.
todos:
  - id: admin-page
    content: Branch /admin off before the 3D game starts and sign in with Google
    status: completed
  - id: data
    content: Persist visits, peak players, room config, and loot timers; enforce them in rules and join
    status: completed
  - id: lists
    content: Room, player, and item lists plus whole-game and per-room stats
    status: completed
  - id: controls
    content: Player cap, force ground respawn, and create room
    status: completed
isProject: false
---

Shipped. This plan is finished. Instructions in other plans to continue on PR 27 or not to merge are not current work.

# Marooned admin

A room is one shared island (`?room=demo`). The map is the same for every room. "World" in the database is that room's island snapshot, not a second kind of place.

Admin is a page on the Marooned app at `/admin`. [`web/src/main.ts`](Marooned/web/src/main.ts) starts the 3D game immediately today; `/admin` skips that and renders a plain Vue page. `serve -s` already falls through to the SPA, so the path works on Heroku.

## Who can use it

Players stay anonymous on [`grand-island-survival`](Marooned/.firebaserc). Admin signs in with Google on that same project, and only on the admin page. Firebase rules allow the admin writes and the room list only when `auth.token.email` is `nekovar.david@gmail.com`. Say if that mailbox is wrong.

Google sign-in must be enabled on `grand-island-survival` (it is a different project from the Playful games). The email is in the rules, not a password in the client.

## What the page shows

Drill-down, not a player editor:

- Rooms: id, online count, player cap, created time. Filter by id.
- Players in the selected room: name, alive or dead, survival time. Filter by name and alive/dead.
- Ground items: kind, cell, state, and the respawn countdown. Pockets are not listed.

Stats, for the whole game and again for the selected room:

- players who have played
- players active today
- total survival time
- survival time today
- most players online at once

Survival time uses the same island clock as the death screen (`livedHoursFromSeconds` in [`web/src/dayNight.ts`](Marooned/web/src/dayNight.ts)), shown as days and hours. "Today" is the Europe/Prague calendar day.

## What is not stored yet

Current data cannot answer this. [`rooms/$id/survivors`](Marooned/web/src/net/survivor.ts) is the live body, and ghost cleanup deletes it. Loot timers live only in the host tab ([`web/src/sim/loot.ts`](Marooned/web/src/sim/loot.ts)); the saved world is placed items without an age. The cap is the constant `ROOM_SLOT_COUNT = 4`.

Add, written by the player or the host, readable by the admin:

- `rooms/$id/visits/$uid` — name, first seen, last seen, cumulative lived seconds, and the offset used for "today". The player updates their own row when they save. Ghost cleanup does not delete it.
- `rooms/$id/stats/peakPlayers` — the host raises this when the slot count exceeds it. It is a record, not a limit.
- `rooms/$id/config` — `maxPlayers` (default 4, at most 16) and `createdAt`.
- Loot timers on the world snapshot the host already publishes: kind, state (`fresh`, `rotten`, `waiting`), age, whether it respawns, cell. Admin turns age into the remaining island time (fruit waits 2 island hours, tools 3).

Whole-game numbers are the sums of those room rows. No Cloud Function.

## The three controls

1. Player cap. [`joinRoom`](Marooned/web/src/net/room.ts) and the host election loop read `config.maxPlayers` instead of the constant. A lower cap refuses new joins and does not kick people already inside.
2. Force ground respawn. Admin writes `rooms/$id/commands/respawnItems` as a timestamp. The host, including one who joins later, spawns waiting ground loot immediately and then clears the command. Inventories stay as they are.
3. Create a room. Admin writes `config` for a new slug (same character rules as [`roomIdFromUrl`](Marooned/web/src/net/protocol.ts)). The island appears when someone opens `?room=that-slug`.

Rules in [`database.rules.json`](Marooned/database.rules.json): the admin email can list `rooms` and write `config` and commands. A known room stays publicly readable. The host may delete a respawn command and raise `peakPlayers` only upward. A player may write only their own visit row.

## Done means

- `/admin` shows the lists and both stat scopes after a Google sign-in.
- Creating a room, changing its cap, and forcing a ground respawn work against local Vite and the `grand-island-survival` database.
- A pocket item is still in hand after a forced respawn.
- Unit tests cover the slug check, the Prague day split, and the survival label.
