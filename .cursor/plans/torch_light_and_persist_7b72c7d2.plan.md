---
name: Torch light and persist
overview: Show other players' torch light from their published heldKind, and reload the shared world (including lit hearths) when anyone joins so fires survive refresh. The world snapshot already has most island state; the host currently ignores it on boot.
todos:
  - id: remote-torch-lights
    content: Atmosphere torch light pool; Game collects local + remote torch positions
    status: completed
  - id: hydrate-world
    content: loadWorld() on join; host and guest applyNetWorld after scatter so hearths/clock/items survive refresh
    status: completed
isProject: false
---

# Torch light and world persist

## What is already saved

**Per player** (`/rooms/{id}/survivors/{uid}`): look, name, needs, pockets/held, cell, alive.

**Shared island** (`/rooms/{id}/world`, host writes ~2 Hz): clock (`elapsed` / `dayT`), weather, ground items, **hearth `lit` flags**, lean-to cells.

Guests already apply that snapshot every frame. **The host never loads it on boot.** A refresh rebuilds scatter, `camp.scan()` sets every hearth to `lit: false`, then the host overwrites RTDB with a cold island. That is why a started fireplace dies when you come back.

```mermaid
flowchart LR
  boot[Host boot scatter]
  scan["camp.scan lit false"]
  rtdb["RTDB world.hearths lit true"]
  boot --> scan
  scan -->|"publishWorld"| rtdb
```

## Not persisted (and staying out of this change)

- Wildlife (local/cosmetic by design)
- Loot respawn / rot timers (fresh `Loot` on boot; ground items *will* restore if we hydrate the snapshot)
- Needs `poisoned` flag
- Busy actions / animations
- Chat, profiles, leaderboard

## 1. Other players' torch light

[`Atmosphere`](Marooned/web/src/fx/atmosphere.ts) has **one** torch pair, fed only the local player in [`Game.ts`](Marooned/web/src/game/Game.ts) (`heldKind === "torch"` + `heldMesh` world position). Remotes already publish `heldKind` on [`NetPlayer`](Marooned/web/src/net/protocol.ts) but [`RemotePlayer`](Marooned/web/src/actor/remotePlayer.ts) never lights.

- Keep a pool of 4 torch point lights (same as `fireLights`).
- Change `updateLights` to take `THREE.Vector3[]` (local + remotes).
- In the frame loop, if a remote's `heldKind === "torch"`, push `visual.root.position` (plus a small Y offset). No torch mesh required to see the glow.

## 2. Persist / restore lit fireplaces (and the rest of the island)

Add `Room.loadWorld()` (`get` of `rooms/{id}/world`) next to `loadSurvivor`.

After scatter + `camp.scan` in [`Game.ts`](Marooned/web/src/game/Game.ts), if a snapshot exists, run [`applyNetWorld`](Marooned/web/src/net/worldSync.ts) **for host and guest**. That restores:

- lit hearths (atmosphere already reads `camp.hearths[].lit`)
- lean-tos, ground loot, clock, weather

[`Camp.scan`](Marooned/web/src/sim/camp.ts) always creates `lit: false`; `applyNetWorld` already copies `world.hearths[].lit` afterward. No schema change.

Rain can still douse unsheltered fires via `douseExposed` after restore (current game rule).

## Verify

- Two browsers: player A holds a torch at night; B sees a moving orange light on A.
- Light a campfire, refresh both clients: pit still lit, warmth/cook prompt still work.
- Refresh as host: clock is not reset to 08:00 if the room already had elapsed time.
