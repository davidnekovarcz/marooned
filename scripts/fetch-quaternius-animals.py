#!/usr/bin/env python3
"""Re-download Quaternius CC0 animal/fish packs into assets/vendor/quaternius/.

Farm animals and animated fish are stable OpenGameArt zips.
Ultimate Animated Animals is a Google Drive folder (gdown); keep glTF only.
"""
from __future__ import annotations

import shutil
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "vendor" / "quaternius"
UA = {"User-Agent": "Mozilla/5.0 MaroonedAssetFetch/1.0"}

OGA = [
    {
        "id": "farm-animals",
        "url": "https://opengameart.org/sites/default/files/Farm%20Animals%20by%20%40Quaternius.zip",
        "drop": ["Blends", "Preview.gif"],
    },
    {
        "id": "animated-fish",
        "url": "https://opengameart.org/sites/default/files/Animated%20Fish%20Pack%20by%20%40Quaternius.zip",
        "drop": ["Blends"],
    },
]

DRIVE = {
    "id": "ultimate-animated-animals",
    "folder": "https://drive.google.com/drive/folders/1uJ3N5HfB7jKTseJUNQr3N4YaN0UuEtHk",
    "keep": ["glTF"],
}


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read()


def unzip_oga(pack: dict) -> None:
    dest = OUT / pack["id"]
    dest.mkdir(parents=True, exist_ok=True)
    print(f"GET {pack['id']}")
    data = fetch(pack["url"])
    tmp = dest / "_pack.zip"
    tmp.write_bytes(data)
    with zipfile.ZipFile(tmp) as z:
        z.extractall(dest)
    tmp.unlink()
    for path in list(dest.rglob("*")):
        if path.name not in pack["drop"]:
            continue
        if path.is_dir():
            shutil.rmtree(path)
        elif path.is_file():
            path.unlink()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for pack in OGA:
        unzip_oga(pack)
    print(
        "Ultimate Animated Animals: run\n"
        f'  python3 -m gdown --folder "{DRIVE["folder"]}" -O "{OUT / DRIVE["id"]}" --remaining-ok\n'
        "then delete Blends/, FBX/, OBJ/ and keep glTF/."
    )
    print("manifest", (OUT / "ANIMALS_MANIFEST.json").read_text()[:80], "...")


if __name__ == "__main__":
    main()
