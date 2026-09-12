#!/usr/bin/env python3
"""Download curated CC0 OpenGameArt audio into assets/vendor/opengameart/."""
from __future__ import annotations

import hashlib
import json
import subprocess
import zipfile
from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "vendor" / "opengameart"
UA = {"User-Agent": "MaroonedAssetFetch/1.0"}

PACKS = [
    {
        "slug": "beach-ocean-waves",
        "page": "https://opengameart.org/content/beach-ocean-waves",
        "license": "CC0",
        "author": "jasinski (via qubodup)",
        "files": [
            "https://opengameart.org/sites/default/files/wave_01_cc0-18363__jasinski__alkaibeach.flac",
            "https://opengameart.org/sites/default/files/wave_02_cc0-18363__jasinski__alkaibeach.flac",
            "https://opengameart.org/sites/default/files/wave_03_cc0-18363__jasinski__alkaibeach.flac",
            "https://opengameart.org/sites/default/files/wave_04_cc0-18363__jasinski__alkaibeach.flac",
        ],
        "extract_zip": False,
    },
    {
        "slug": "sea-and-river-waves",
        "page": "https://opengameart.org/content/sea-and-river-wave-sounds",
        "license": "CC0",
        "author": "RandomMind",
        "files": [
            "https://opengameart.org/sites/default/files/VistulaShort_0.mp3",
        ],
        "extract_zip": False,
    },
    {
        "slug": "ambient-bird-sounds",
        "page": "https://opengameart.org/content/ambient-bird-sounds",
        "license": "CC0",
        "author": "isaiah658",
        "files": [
            "https://opengameart.org/sites/default/files/birds-isaiah658_0.ogg",
        ],
        "extract_zip": False,
    },
    {
        "slug": "sheep-baa",
        "page": "https://opengameart.org/content/sheep-baa",
        "license": "CC0",
        "author": "mikewest (via OpenGameArt)",
        "files": [
            "https://opengameart.org/sites/default/files/sheep_baa_0.ogg",
        ],
        "extract_zip": False,
    },
    {
        "slug": "80-cc0-creature-sfx",
        "page": "https://opengameart.org/content/80-cc0-creature-sfx",
        "license": "CC0",
        "author": "rubberduck",
        "files": [
            "https://opengameart.org/sites/default/files/80-CC0-creature-SFX_0.zip",
        ],
        "extract_zip": True,
    },
    {
        "slug": "rain-loopable",
        "page": "https://opengameart.org/content/rain-loopable",
        "license": "CC0",
        "author": "Ylmir",
        "files": [
            "https://opengameart.org/sites/default/files/Rain%20OGG.zip",
        ],
        "extract_zip": True,
    },
    {
        "slug": "fire-crackling",
        "page": "https://opengameart.org/content/fire-crackling",
        "license": "CC0",
        "author": "AntumDeluge",
        "files": [
            "https://opengameart.org/sites/default/files/fire-1_0.ogg",
        ],
        "extract_zip": False,
    },
    {
        "slug": "fireplace-sound-loop",
        "page": "https://opengameart.org/content/fireplace-sound-loop",
        "license": "CC0",
        "author": "PagDev",
        "files": [
            "https://opengameart.org/sites/default/files/fire.wav",
        ],
        "extract_zip": False,
    },
    {
        "slug": "water-splash-slime-sfx",
        "page": "https://opengameart.org/content/40-cc0-water-splash-slime-sfx",
        "license": "CC0",
        "author": "rubberduck",
        "files": [
            "https://opengameart.org/sites/default/files/water-splash-slime-sfx.zip",
        ],
        "extract_zip": True,
    },
    {
        "slug": "liquid-bottle-drink-set",
        "page": "https://opengameart.org/content/liquid-bottle-drink-set",
        "license": "CC0",
        "author": "qubodup",
        "files": [
            "https://opengameart.org/sites/default/files/qubodup-bottle-and-drink-sounds.7z",
        ],
        "extract_zip": False,
        "extract_7z": True,
    },
]


def fetch(url: str) -> bytes:
    req = Request(url, headers=UA)
    with urlopen(req, timeout=180) as r:
        return r.read()


def write_license(dest: Path, pack: dict) -> None:
    (dest / "License.txt").write_text(
        f"{pack['slug']}\n"
        f"Author: {pack['author']}\n"
        f"License: {pack['license']}\n"
        f"Source: {pack['page']}\n"
        "Creative Commons CC0 — public domain. Attribution not required.\n"
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = []
    for pack in PACKS:
        dest = OUT / pack["slug"]
        dest.mkdir(parents=True, exist_ok=True)
        write_license(dest, pack)
        file_entries = []
        for url in pack["files"]:
            print(f"GET {url}")
            data = fetch(url)
            name = url.rsplit("/", 1)[-1]
            sha = hashlib.sha256(data).hexdigest()
            if pack.get("extract_7z") and name.lower().endswith(".7z"):
                archive = dest / name
                archive.write_bytes(data)
                subprocess.run(["7z", "x", "-y", f"-o{dest}", str(archive)], check=True)
                stored = name
            elif pack["extract_zip"] and name.lower().endswith(".zip"):
                with zipfile.ZipFile(BytesIO(data)) as z:
                    z.extractall(dest)
                stored = name
            else:
                (dest / name).write_bytes(data)
                stored = name
            file_entries.append(
                {
                    "url": url,
                    "file": stored,
                    "bytes": len(data),
                    "sha256": sha,
                }
            )
        manifest.append(
            {
                "slug": pack["slug"],
                "page": pack["page"],
                "license": pack["license"],
                "author": pack["author"],
                "files": file_entries,
            }
        )
    (OUT / "MANIFEST.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print("done", len(manifest), "packs")


if __name__ == "__main__":
    main()
