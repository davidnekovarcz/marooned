# Marooned — Kaloko smoke acceptance

Long-lived flows that catch “the game will not boot / chat / phone UI is broken” regressions while features land.

Room: `/?room=kaloko-smoke` (isolated from the public `demo` island).

## Smoke — character gate to HUD (`smoke-boot.yml`)

1. Open the smoke room as a new visitor (cleared `marooned.*` storage).
2. If the cookie banner appears, Accept.
3. Click **Choose character**.
4. Expect: character overlay gone, `#hud-clock` (HUD), `#gear`, and `#game` present.

## Smoke — Say compose (`smoke-say.yml`)

1. Same boot as above.
2. Press Enter, type `Kaloko smoke`, press Enter again.
3. Expect: `#say-compose` hidden; HUD still visible.

## Smoke — mobile controls (`smoke-mobile.yml`)

1. Same boot at ~390×844.
2. Expect: `body.mobile-ui`, visible `#mobile-controls` stick and `#mobile-toolbar`.

## Out of scope (for now)

- Multiplayer / full island
- Picking up world items (flaky pathfinding)
- Production Heroku walks (config has a readonly URL when local is stable)
