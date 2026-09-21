---
name: Rain then remote presence
overview: Rain is still easy to miss because it is a 36-second window on the shared room clock, and storm days skip the afternoon entirely. Widen the schedule so a normal session sees rain, then build held meshes, nametags, and Enter-to-say bubbles.
todos:
  - id: rain-windows
    content: Widen daily rain windows; storm days keep afternoon showers plus night storm
    status: completed
  - id: remote-held
    content: RemotePlayer clones held mesh into grip from net.heldKind
    status: completed
  - id: nametag-held
    content: "Player chip second line: held item label on remotes"
    status: completed
  - id: say-bubble
    content: Enter compose/send; say+sayAt on NetPlayer; 5s bubble local + remotes
    status: completed
isProject: false
---

# Rain you can actually see, then remote presence

## Why you still see no rain

The code path is live (host `weather.update`, HUD `sky`, [`Atmosphere.setRain`](Marooned/web/src/fx/atmosphere.ts)). The schedule is the problem.

[`windowsForDay`](Marooned/web/src/sim/weather.ts) still only opens:

- **Most days:** `14:20–16:00` (~36 real seconds)
- **Every 4th day:** **only** `20:30–22:24` (no afternoon shower)

`?room=demo` uses the **shared** `day.t` / `elapsed`, not your spawn. If the room clock is 08:00, 17:00, or 23:00, there is no rain. Waiting ~2 minutes after *you* spawn does nothing unless the island clock is already inside that window. Storm days are dry all afternoon.

```mermaid
flowchart LR
  clock["shared dayT elapsed"]
  win["14:20-16:00 or storm night"]
  rain["intensity then HUD plus streaks"]
  clock --> win
  win -->|outside| dry[always sun or moon]
  win -->|inside ~36s| rain
```

## Fix rain first

In [`windowsForDay`](Marooned/web/src/sim/weather.ts):

- **Every day:** afternoon shower **and** a second window (e.g. `09:30–11:00` and `14:20–16:30`) so morning and afternoon sessions both get rain (~2 minutes of rain per day, not 36 seconds).
- **Storm days:** keep those showers **plus** the night storm `20:30–22:40` (do not replace the afternoon).
- Leave ramp / particles / HUD as they are.

No protocol change. After deploy, if the HUD clock is inside a window you should see the rain icon and streaks within a few seconds of ramp-in.

## Next slice: see other survivors

[`TODOs.md`](Marooned/TODOs.md) “Next on the web teaser” and your call: **held mesh + nametag + Enter say**. `heldKind` and `name` are already on [`NetPlayer`](Marooned/web/src/net/protocol.ts). [`RemotePlayer`](Marooned/web/src/actor/remotePlayer.ts) still only lerps the body.

1. **Held mesh:** export grip placement from inventory; `cloneHeld(kind)` from scatter templates (do not `spawn()` a second world item). `RemotePlayer.apply` swaps the grip when `net.heldKind` changes.
2. **Nametag:** already have screen-space chips in [`playerChip.ts`](Marooned/web/src/fx/playerChip.ts). Add an optional second line for the held item label (`formatItemLabel`). Local player: name or sleep face only (Gear already shows your hands).
3. **Say bubble:** Enter opens a tiny compose field (pause WASD/Space). Enter sends one line (max 72). `say` + `sayAt` on `NetPlayer` (omit when idle). Chip or sprite above the name for ~5s. Escape cancels. No log, no queue.

After that, leftover teaser bugs: missing `/world` write, stale slots when a tab dies before `onDisconnect`.
