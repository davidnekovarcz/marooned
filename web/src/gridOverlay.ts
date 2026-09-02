import * as THREE from "three";
import { CELL, GRID } from "./constants";
import { cellIndex, inBounds, isOceanCell } from "./island";

/** Semi-transparent grid on walkable cells only. */
export function buildGridOverlay(
  biomes: Uint8Array,
  blocked: Uint8Array,
): THREE.LineSegments {
  const positions: number[] = [];
  const y = 0.03;
  const inset = 0.04;

  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
      if (!isWalkable(biomes, blocked, x, z)) continue;
      const x0 = x * CELL + inset;
      const z0 = z * CELL + inset;
      const x1 = (x + 1) * CELL - inset;
      const z1 = (z + 1) * CELL - inset;
      // square
      positions.push(x0, y, z0, x1, y, z0);
      positions.push(x1, y, z0, x1, y, z1);
      positions.push(x1, y, z1, x0, y, z1);
      positions.push(x0, y, z1, x0, y, z0);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.05,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.name = "grid";
  lines.renderOrder = 2;
  return lines;
}

export function isWalkable(biomes: Uint8Array, blocked: Uint8Array, x: number, z: number): boolean {
  if (!inBounds(x, z)) return false;
  const i = cellIndex(x, z);
  if (blocked[i]) return false;
  return biomes[i] !== 0;
}

/** Land, or inland pond/river. Open ocean stays blocked. */
export function canEnter(biomes: Uint8Array, blocked: Uint8Array, x: number, z: number): boolean {
  if (!inBounds(x, z)) return false;
  const i = cellIndex(x, z);
  if (blocked[i]) return false;
  if (biomes[i] !== 0) return true;
  return !isOceanCell(x, z, biomes);
}
