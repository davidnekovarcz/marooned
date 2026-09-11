# Third-party assets

Everything under `assets/vendor/` is **not original Marooned art**. Keep this file when shipping.

| Vendor | License | Use |
| --- | --- | --- |
| [Kenney](https://kenney.nl) | CC0 | All packs in `vendor/kenney/` |
| [Quaternius](https://quaternius.com) | CC0 | Packs in `vendor/quaternius/` (nature, megakits, UAL, farm animals, ultimate animated animals, animated fish) |
| [Poly Haven](https://polyhaven.com/license) | CC0 | `vendor/polyhaven/` HDRI |
| [OpenGameArt](https://opengameart.org) | CC0 | Audio packs in `vendor/opengameart/` (ocean, river, rain, fire, splash, birds, sheep, creature SFX) |

Credit is not required for CC0; credit Kenney / Quaternius / Poly Haven / OpenGameArt authors in the game credits anyway.

**Not in this repo (need an account or Drive quota blocked us):**

- Mixamo (Adobe; commercial OK, not CC0, no raw-file redistribution)
- Remaining Quaternius Drive files for Survival / Pirate / Food / Home Interior (partial; Kenney covers the same roles)
- Freesound clips (API needs a login). See `vendor/freesound/README.md`. Environment/wildlife audio is under `vendor/opengameart/` instead.

Re-fetch Kenney zips with `scripts/fetch-kenney-assets.py`.
Re-fetch OpenGameArt audio with `scripts/fetch-opengameart-audio.py` (index: `vendor/opengameart/AUDIO_INDEX.md`).
Re-fetch animal/fish packs with `scripts/fetch-quaternius-animals.py` (OGA zips) plus gdown for Ultimate Animated Animals (see `vendor/quaternius/ANIMALS_MANIFEST.json`).
