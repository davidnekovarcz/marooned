import * as THREE from "three";
import { sourceClothes, sourceSkin, type Appearance } from "./appearance";

const _src = { h: 0, s: 0, l: 0 };
const _dst = { h: 0, s: 0, l: 0 };
const _px = { h: 0, s: 0, l: 0 };

function hueDelta(a: number, b: number): number {
  const d = Math.abs(a - b);
  return d > 0.5 ? 1 - d : d;
}

function nearSkin(hsl: { h: number; s: number; l: number }, gender: Appearance["gender"]): boolean {
  if (hsl.s < 0.18) return false;
  if (gender === "male") {
    return hueDelta(hsl.h, 0.045) < 0.07 && hsl.l > 0.48;
  }
  // Female body is mid brick-red. Dark hair (#220f0f, #61150d) shares the hue — keep it.
  return hueDelta(hsl.h, 0.015) < 0.05 && hsl.s > 0.28 && hsl.l > 0.3 && hsl.l < 0.52;
}

function nearClothes(hsl: { h: number; s: number; l: number }): boolean {
  if (hsl.l < 0.52) return false;
  if (hsl.s < 0.14 && hsl.l > 0.62) return true;
  return hueDelta(hsl.h, 0.55) < 0.14 && hsl.s < 0.5;
}

function writeHsl(
  data: Uint8ClampedArray,
  i: number,
  src: { h: number; s: number; l: number },
  dst: { h: number; s: number; l: number },
  px: { h: number; s: number; l: number },
  out: THREE.Color,
): void {
  const l = Math.min(1, Math.max(0, px.l + (dst.l - src.l)));
  const s = Math.min(1, Math.max(0, dst.s * 0.65 + px.s * 0.35));
  out.setHSL(dst.h, s, l);
  data[i] = Math.round(out.r * 255);
  data[i + 1] = Math.round(out.g * 255);
  data[i + 2] = Math.round(out.b * 255);
}

/** Recolor Kenney peach skin and pale-blue clothes; hair, dirt, and blacks stay. */
export function tintSurvivorAtlas(map: THREE.Texture, appearance: Appearance): THREE.Texture {
  const img = map.image as HTMLImageElement | HTMLCanvasElement | ImageBitmap;
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return map;
  ctx.drawImage(img as CanvasImageSource, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;

  const srcSkin = new THREE.Color(sourceSkin(appearance.gender));
  const srcCloth = new THREE.Color(sourceClothes(appearance.gender));
  const dstSkin = new THREE.Color(appearance.skin);
  const dstCloth = new THREE.Color(appearance.clothes);
  srcSkin.getHSL(_src);
  const srcSkinHsl = { h: _src.h, s: _src.s, l: _src.l };
  srcCloth.getHSL(_src);
  const srcClothHsl = { h: _src.h, s: _src.s, l: _src.l };
  dstSkin.getHSL(_dst);
  const dstSkinHsl = { h: _dst.h, s: _dst.s, l: _dst.l };
  dstCloth.getHSL(_dst);
  const dstClothHsl = { h: _dst.h, s: _dst.s, l: _dst.l };

  const px = new THREE.Color();
  const out = new THREE.Color();
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] ?? 0) < 8) continue;
    px.setRGB((data[i] ?? 0) / 255, (data[i + 1] ?? 0) / 255, (data[i + 2] ?? 0) / 255);
    px.getHSL(_px);
    const hsl = { h: _px.h, s: _px.s, l: _px.l };
    if (nearSkin(hsl, appearance.gender)) {
      writeHsl(data, i, srcSkinHsl, dstSkinHsl, hsl, out);
    } else if (nearClothes(hsl)) {
      writeHsl(data, i, srcClothHsl, dstClothHsl, hsl, out);
    }
  }
  ctx.putImageData(image, 0, 0);
  const tinted = new THREE.CanvasTexture(canvas);
  tinted.colorSpace = THREE.SRGBColorSpace;
  tinted.flipY = map.flipY;
  tinted.needsUpdate = true;
  map.dispose();
  return tinted;
}
