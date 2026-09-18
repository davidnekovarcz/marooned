---
name: Island props character tweaks
overview: On `cursor/item-scaling-and-spawning-b48d`, fix female skin tint so she doesn’t look male, stop scattering flowers and forest rocks, shrink trees, and spawn fruit off the trunk on the camera-facing side so it is not hidden behind the canopy.
todos:
  - id: female-tint
    content: Tighten female nearSkin so hair is not remapped to peach
    status: completed
  - id: hide-scatter
    content: Skip flowers; exclude rockSmall/rockLarge from inForest
    status: completed
  - id: trees-fruit
    content: Shrink PROP_SIZE trees ~25%; fruit at distance 2 on the camera-facing side only
    status: completed
isProject: false
---

# Island props and female look

Branch: [`cursor/item-scaling-and-spawning-b48d`](Marooned) (cloud scaling/spawn + character select). Small gameplay tweaks only — no docs rewrite.

## 1. Female still looks male

Kenney Survivors is **one mesh** ([`characterMedium.fbx`](Marooned/web/src/models.ts)) plus a PNG swap. Female vs male is the atlas, not geometry.

[`tintAtlas.ts`](Marooned/web/src/tintAtlas.ts) `nearSkin` for female matches reddish hues. The female atlas paints **hair** in dark red-browns (`#220f0f`, `#61150d`) in the same family as body (`#a83c34` / `#87221a`). Those pixels get remapped to the peach skin swatch, so hair disappears and she reads as the male body.

Fix in [`nearSkin`](Marooned/web/src/tintAtlas.ts): for female, only treat **mid** brick-red as skin (keep a higher lightness floor / tighter hue so dark hair stays). Do not add a 3D character-select preview unless the tint fix isn’t enough after a look in-game.

Confirm [`loadPlayerModel`](Marooned/web/src/playerModel.ts) still loads `PLAYER_URLS.female` when gender is female (that path is already correct).

## 2. Hide flowers; no rocks in the forest

In [`props.ts`](Marooned/web/src/props.ts) `scatterProps`:

- Skip `flowerYellow` / `flowerPurple` / `flowerRed` (comment or count `0`).
- Keep `rockLarge` / `rockSmall` on open grass and beach, but **not** in the forest patch: add `!inForest(x, z)` to those `tryPlace` filters.
- Leave `sandRock` on sand.

## 3. Smaller trees; fruit visible (not behind the trunk)

Heights in [`scale.ts`](Marooned/web/src/scale.ts) `PROP_SIZE` — about **25% shorter** (palms ~9.2→~6.9, oak 8.2→~6.1, pine 9.6→~7.2; same ratio for palm variants).

Orbit camera is [`CAMERA_OFFSET`](Marooned/web/src/constants.ts) `{ x: -18, y: 24, z: -18 }` — it looks from **southwest**. Fruit on the northeast of a tree sits behind the trunk/canopy and is hard to see. No see-through / X-ray in this task.

Change [`collectNearTree`](Marooned/web/src/props.ts) so loot cells are:

- **Chebyshev distance 2** (not touching the core)
- **Camera-facing only:** `dx <= 0` and `dz <= 0` (southwest of the tree), still walkable land
- If that ring is empty for a tree, skip it rather than falling back to the far side

No loot/count changes otherwise (wreck-cluster fruit stays; it already uses the same palm/grove site lists, so it will also sit on the visible side).
