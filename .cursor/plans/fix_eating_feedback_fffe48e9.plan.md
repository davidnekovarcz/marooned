---
name: Fix Eating Feedback
overview: Disable broken crouch-while-eating, shrink the held fruit over the meal lock, and replace procedural chew with OpenGameArt eat_01/eat_04 played back-to-back (never cut mid-clip).
todos:
  - id: no-eat-crouch
    content: Skip crouch pose during meal lock; keep idle standing
    status: completed
  - id: eat-shrink
    content: Scale held food mesh 1→0 over EAT_ACTION_SECONDS
    status: completed
  - id: eat-sound
    content: Wire eat_01.ogg + eat_04.ogg; loop sequence until meal ends, never cut mid-clip
    status: completed
isProject: false
---

# Fix Eating Feedback

## Context

Eating locks the player for [`EAT_ACTION_SECONDS`](Marooned/web/src/constants.ts) (3s) via `beginHeldMeal` in [`web/src/player.ts`](Marooned/web/src/player.ts). Busy locks currently drive a broken crouch pose. Procedural `makeChewBuffer` sounds bad.

Vendored clips (already on disk):

- [`assets/vendor/opengameart/80-cc0-creature-sfx/eat_01.ogg`](Marooned/assets/vendor/opengameart/80-cc0-creature-sfx/eat_01.ogg)
- [`assets/vendor/opengameart/80-cc0-creature-sfx/eat_04.ogg`](Marooned/assets/vendor/opengameart/80-cc0-creature-sfx/eat_04.ogg)

Default fruit visual: **uniform scale down** on the held mesh (1 → ~0 over the meal).

## Changes

### 1. No crouch animation while eating

In [`web/src/player.ts`](Marooned/web/src/player.ts) busy update (~382–389):

- For `lock === "meal"`, keep `setCrouch(0)` (stand idle).
- Still advance `lockT` / `endLock`.
- Keep crouch for cut/break.

### 2. Eating sound — OGA `eat_01` then `eat_04`

In [`web/src/models.ts`](Marooned/web/src/models.ts) / [`web/src/audio.ts`](Marooned/web/src/audio.ts):

- Import and load `eat_01.ogg` + `eat_04.ogg`.
- On `playMeal("eat")`: start a meal SFX sequence that plays **eat_01, then eat_04, then eat_01, …** until the meal lock is over.
- **Never cut mid-clip:** when the eat lock ends, stop scheduling the *next* clip, but let the currently playing clip finish fully.
- Remove (or stop using) procedural `makeChewBuffer` for eat.
- Drink (`coconutHalf`) can keep `makeDrinkBuffer` for now (no new drink asset requested).

Wire a `stopMeal()` (or meal-ended flag) from interact/player end of meal so audio knows not to queue another clip — without calling `sound.stop()` on the active buffer.

### 3. Held food shrinks while eating (visual only)

In [`web/src/player.ts`](Marooned/web/src/player.ts):

- On `beginHeldMeal`, store meal mesh start scale.
- Each meal frame: scale = `start * (1 - lockT/lockSeconds)` (floor ~0.05).
- On `endLock`: remove mesh as today (full bite restore unchanged).

## Files

- [`web/src/player.ts`](Marooned/web/src/player.ts) — no meal crouch; shrink meal mesh; signal meal end to audio if needed
- [`web/src/audio.ts`](Marooned/web/src/audio.ts) — load/play eat_01↔eat_04 sequence; no mid-clip cut
- [`web/src/models.ts`](Marooned/web/src/models.ts) — URL imports for the two oggs
- [`web/src/interact.ts`](Marooned/web/src/interact.ts) — only if meal-end must notify audio

## Out of scope

- Character select / female look
- Real partial-fruit inventory state
- Replacing drink SFX
- Spawn-camera delay
