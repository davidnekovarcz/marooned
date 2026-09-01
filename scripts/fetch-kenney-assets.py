#!/usr/bin/env python3
"""Re-download Kenney CC0 packs listed in STACK.md / MVP.md into assets/vendor/kenney/."""
from __future__ import annotations

import hashlib
import json
import re
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "vendor" / "kenney"
UA = {"User-Agent": "MaroonedAssetFetch/1.0"}

SLUGS = [
    "survival-kit",
    "nature-kit",
    "mini-forest",
    "modular-cave-kit",
    "pirate-kit",
    "watercraft-kit",
    "food-kit",
    "furniture-kit",
    "animated-characters-survivors",
    "animated-characters-protagonists",
    "skyboxes",
    "rpg-audio",
    "impact-sounds",
    "interface-sounds",
    "ui-audio",
    "music-jingles",
]


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def zip_url_for(slug: str) -> str:
    html = fetch(f"https://kenney.nl/assets/{slug}").decode("utf-8", "replace")
    zips = re.findall(r"https://kenney\.nl/media/pages/assets/[^\"']+\.zip", html)
    if not zips:
        raise SystemExit(f"No zip URL on Kenney page for {slug}")
    return zips[0]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = []
    for slug in SLUGS:
        url = zip_url_for(slug)
        print(f"GET {slug}")
        data = fetch(url)
        dest = OUT / slug
        dest.mkdir(parents=True, exist_ok=True)
        tmp = dest / "_pack.zip"
        tmp.write_bytes(data)
        with zipfile.ZipFile(tmp) as z:
            z.extractall(dest)
        tmp.unlink()
        manifest.append(
            {
                "slug": slug,
                "url": url,
                "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
            }
        )
    (OUT / "MANIFEST.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print("done", len(manifest), "packs")


if __name__ == "__main__":
    main()
