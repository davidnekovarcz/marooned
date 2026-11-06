---
name: Island audio leftover
overview: The only unfinished gameplay outside extended Prague and Kaloko is Marooned island audio. Pickup, the AFK clock, and survival scores are already on main; those plan files just were never marked done.
todos:
  - id: audio
    content: Add wildlife calls and the landmark distance and volume tweaks in Marooned audio
    status: pending
  - id: mark-shipped
    content: Mark pickup, AFK, and survival-score plans done; leave OOP and extended Prague open
    status: pending
  - id: ship
    content: Test, open the Marooned pull request, and deploy that branch to Heroku
    status: pending
isProject: false
---

# Finish the leftover island audio

Nothing in Prague is left to build. [prague_roads_and_river_fc46a10b.plan.md](PragueGTA/.cursor/plans/prague_roads_and_river_fc46a10b.plan.md) is the wider-disk and corridor growth, which is the extended map. Kaloko stays out. The Marooned git-hooks mirror todo is obsolete: Marooned already points `core.hooksPath` at the shared kit, so that `.githooks` copy is not reapplied.

## Already on main, plan files still open

Mark these completed. Do not rebuild them.

- [012_fix_multiplayer_pickup_b380037a.plan.md](Marooned/.cursor/plans/012_fix_multiplayer_pickup_b380037a.plan.md). `Item.snapshot()` omits empty `prep` and `freshness`. `toRtdb` JSON-sanitizes writes. Guests grab only when `grant.pickup` is present.
- [016_afk_zzz_survival_clock_437e2185.plan.md](Marooned/.cursor/plans/016_afk_zzz_survival_clock_437e2185.plan.md). `livedSeconds` ticks only while alive and not AFK, the 60s idle flag is in `Game.ts`, and the chip shows Zzz for the local player and remotes.
- [023_marooned_survival_scores_e262a210.plan.md](Marooned/.cursor/plans/023_marooned_survival_scores_e262a210.plan.md). A fresh death posts `GAME_OVER` once from `Game.ts`. The hub already formats island minutes on the Marooned card. The daytime thumbnail stays as it is unless the current `marooned.png` is obviously the old night shot.

## Build

Implement [005_improve_island_audio_4aeb1e83.plan.md](Marooned/.cursor/plans/005_improve_island_audio_4aeb1e83.plan.md) on a new Marooned branch from `origin/main`.

- In [Marooned/web/src/audio.ts](Marooned/web/src/audio.ts), raise `LANDMARK_HEAR` from 20 to 28. Keep ocean hear at 42 and reference distance at 3. Ocean volume 0.5 to 0.42, pond bed 0.22 to 0.28, frogs 0.48 to 0.52, wreck creak 0.55 to 0.48.
- Add procedural buffers for fox, deer, sheep, llama, and fish, using the same style as the existing oink and frog buffers. Attach them in [Marooned/web/src/wildlife.ts](Marooned/web/src/wildlife.ts) at the intervals, volumes, and ranges in that plan. Fish bubbles stay on the pond fish. Moving critters keep their positional audio with them.
- Wire the buffers from `setupIslandAudio()` into `spawnWildlife()`. The plan still names `main.ts`; follow the current boot in [Marooned/web/src/game/Game.ts](Marooned/web/src/game/Game.ts) if that is what starts the island.

## Leave for later

[008_oop_architecture_ideas_ba84fdb8.plan.md](Marooned/.cursor/plans/008_oop_architecture_ideas_ba84fdb8.plan.md) stays open. `Game`, Pinia, and the Vue HUD already exist. The rest is an item-model, locale, and player split, not a missing feature.

## Ship

Marooned tests, then commit, push, and open a pull request. Do not merge. Deploy that branch to the Marooned Heroku app when the tests pass. Mark plan 005 done in the same change.
