---
name: Promote used assets
overview: Copy used assets into a tidy tree, leave vendor/ untouched, and make every app import use `@/` — TS modules via `@/file` and files via `@/assets/...`.
todos:
  - id: alias
    content: Vite+tsconfig aliases — `@/assets` → Marooned/assets, `@` → web/src (array form, assets first)
    status: completed
  - id: copy
    content: Scan web/src; copy used + parked assets and sidecars into assets/model|texture|audio (leave vendor/)
    status: completed
  - id: retarget-assets
    content: Rewrite models.ts asset imports to @/assets/{model|texture|audio}/...
    status: completed
  - id: retarget-ts
    content: Rewrite every relative ./ TS import in web/src to @/... (leave three/node builtins)
    status: completed
  - id: verify
    content: Grep-ban relative and ../../assets imports; web npm run build succeeds
    status: completed
isProject: false
---

# Promote used assets + `@/` everywhere

The bundler is **Vite**, not webpack. **Every** local import in `web/src` uses `@/` — modules and assets. Package imports (`three`, `three/addons/...`, `node:path`) stay as-is.

Two aliases (array form, **`@/assets` first** so `@` does not swallow it):

- `@/assets` → [`Marooned/assets`](Marooned/assets)
- `@` → [`Marooned/web/src`](Marooned/web/src)

Vite [`web/vite.config.ts`](Marooned/web/vite.config.ts):

```ts
resolve: {
  alias: [
    { find: "@/assets", replacement: path.resolve(__dirname, "../assets") },
    { find: "@", replacement: path.resolve(__dirname, "src") },
  ],
},
```

(`fs.allow` already includes the parent dir.)

TypeScript [`web/tsconfig.json`](Marooned/web/tsconfig.json):

```json
"baseUrl": ".",
"paths": {
  "@/assets/*": ["../assets/*"],
  "@/*": ["./src/*"]
}
```

Examples:

- `import { GRID } from "@/constants"`
- `import palmUrl from "@/assets/model/tree_palmDetailedTall.glb?url"`

Leave [`web/index.html`](Marooned/web/index.html) `src="/src/main.ts"` (browser URL, not a TS import) and [`vite.config.ts`](Marooned/web/vite.config.ts) `node:path`.

## Target tree

Leave [`assets/vendor/`](Marooned/assets/vendor) as the full dump. Copy used files (do not move/delete vendor):

```
Marooned/assets/
  vendor/     # unchanged
  model/      # .glb .gltf .fbx .obj + sidecars (.mtl, maps)
  texture/    # standalone skins (survivor pngs)
  audio/      # .ogg
```

Keep original filenames in the type folder (they are unique: `log.glb` vs `tree-log.glb`). Flatten — no Kenney/Quaternius subfolders in the tidy tree.

## Scan + copy set

Re-scan `web/src` at execute time (`from "...assets`, `?url`, `new URL`). Current graph is **only** [`models.ts`](Marooned/web/src/models.ts) (~90 files). Include parked/commented wiring:

- Flowers (`flower_yellowA` / purple / red) — in `MODEL_URLS`, not placed
- Sheep / llama FBX — imported; spawn skipped in [`wildlife.ts`](Marooned/web/src/wildlife.ts)
- Extra eat clips `eat_02.ogg` / `eat_03.ogg` (same pack as wired `eat_01`/`eat_04`)

Sidecars (copy next to the mesh so relative refs stay valid):

- `Lilypad.obj` + `Lilypad.mtl` (color-only MTL)
- `Torch_Metal.obj` + `Torch_Metal.mtl` + any `map_*` files it names (`T_Trim_Metal_*.png`) if they exist beside the OBJ
- Fox/Deer `.gltf` are self-contained (`data:` URIs) — copy the `.gltf` only

Do **not** bulk-copy unused AUDIO_INDEX catalog (ocean flacs, 5 min river mp3). Vendor stays for that.

If execute-time scan finds extra files (e.g. tomato OBJ on another branch), copy those too.

## Rewrite imports

Assets — [`web/src/models.ts`](Marooned/web/src/models.ts): map each file to `@/assets/{model|texture|audio}/<filename>?url`. Other TS files already go through `MODEL_URLS` / `SOUND_URLS` / `ANIMAL_URLS`.

TS modules — every `from "./foo"` in `web/src` (~18 files, ~70 imports today) becomes `from "@/foo"`. Same-folder files stay flat (`@/constants`, `@/player`, …). No `./` or `../` in `web/src`.

`loadObj` in [`loaders.ts`](Marooned/web/src/loaders.ts) still ignores MTL; copying sidecars is for completeness, not a loader change.

## Verify

- `rg 'from ["'\'']\.\.?/' Marooned/web/src` empty
- `rg '\.\./.*assets' Marooned/web` empty
- `npm run build` in `web/` (tsc + vite) succeeds
- Do not delete or rewrite `vendor/`
