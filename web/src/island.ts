import * as THREE from "three";
import {
  BEACH_WIDTH,
  Biome,
  CELL,
  CENTER,
  GRASS_A,
  GRASS_B,
  GRID,
  GROUND_Y,
  ISLAND_RADIUS,
  POND_RADIUS,
  POND_X,
  POND_Z,
  RIVER_HALF,
  SAND_A,
  SAND_B,
} from "@/web/src/constants";

export function cellIndex(x: number, z: number): number {
  return z * GRID + x;
}

export function inBounds(x: number, z: number): boolean {
  return x >= 0 && z >= 0 && x < GRID && z < GRID;
}

export function cellCenterDist(x: number, z: number): number {
  return Math.hypot(x + 0.5 - CENTER, z + 0.5 - CENTER);
}

export function biomeAt(x: number, z: number): Biome {
  return biomeAtPoint(x + 0.5, z + 0.5);
}

export function isLand(biome: Biome): boolean {
  return biome !== Biome.Water;
}

function riverDistance(px: number, pz: number): number {
  const zc = POND_Z + 0.5;
  if (px > POND_X) return 1e6;
  return Math.abs(pz - zc);
}

/** Positive on land, negative in ocean / pond / river. */
function landSDF(px: number, pz: number): number {
  const island = ISLAND_RADIUS - Math.hypot(px - CENTER, pz - CENTER);
  const pond = Math.hypot(px - POND_X, pz - POND_Z) - POND_RADIUS;
  const river = riverDistance(px, pz) - RIVER_HALF;
  return Math.min(island, pond, river);
}

function biomeAtPoint(px: number, pz: number): Biome {
  if (landSDF(px, pz) <= 0) return Biome.Water;
  if (sandSDF(px, pz) > 0) return Biome.Sand;
  return Biome.Grass;
}

/** Positive on the beach / pond / river banks, negative on inland grass. */
function sandSDF(px: number, pz: number): number {
  const islandD = Math.hypot(px - CENTER, pz - CENTER);
  const beach = islandD - (ISLAND_RADIUS - BEACH_WIDTH);
  const pondRing = POND_RADIUS + 1.8 - Math.hypot(px - POND_X, pz - POND_Z);
  const riverRing =
    px <= POND_X + 1.2 ? RIVER_HALF + 1.5 - riverDistance(px, pz) : -1e6;
  return Math.max(beach, pondRing, riverRing);
}

export function buildBiomes(): Uint8Array {
  const biomes = new Uint8Array(GRID * GRID);
  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
      biomes[cellIndex(x, z)] = biomeAt(x, z);
    }
  }
  return biomes;
}

export function isOceanCell(x: number, z: number, biomes: Uint8Array): boolean {
  if (!inBounds(x, z)) return false;
  return biomes[cellIndex(x, z)] === Biome.Water && cellCenterDist(x, z) >= ISLAND_RADIUS;
}

const NEIGHBOR8: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function landTouches(x: number, z: number, biomes: Uint8Array, pred: (nx: number, nz: number) => boolean): boolean {
  if (!inBounds(x, z)) return false;
  if (!isLand(biomes[cellIndex(x, z)] as Biome)) return false;
  for (const [dx, dz] of NEIGHBOR8) {
    const nx = x + dx;
    const nz = z + dz;
    if (!inBounds(nx, nz)) continue;
    if (pred(nx, nz)) return true;
  }
  return false;
}

/** Pond, river, or open sea next to this land cell (including diagonals). */
export function isShore(x: number, z: number, biomes: Uint8Array): boolean {
  return landTouches(x, z, biomes, (nx, nz) => biomes[cellIndex(nx, nz)] === Biome.Water);
}

/** Pond and river — not the open sea. */
export function isInlandWater(x: number, z: number, biomes: Uint8Array): boolean {
  if (!inBounds(x, z)) return false;
  return biomes[cellIndex(x, z)] === Biome.Water && !isOceanCell(x, z, biomes);
}

/** Dry bank of the pond or river — kneel and drink without swimming. */
export function isPondShore(x: number, z: number, biomes: Uint8Array): boolean {
  if (!inBounds(x, z)) return false;
  if (!isLand(biomes[cellIndex(x, z)] as Biome)) return false;
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx === 0 && dz === 0) continue;
      if (isInlandWater(x + dx, z + dz, biomes)) return true;
    }
  }
  return false;
}

export type CoastField = {
  dist: Float32Array;
  nearX: Int16Array;
  nearZ: Int16Array;
};

/** Distance (in cells) from every tile to the nearest open-ocean cell — not pond/river. */
export function buildCoastField(biomes: Uint8Array): CoastField {
  const n = GRID * GRID;
  const dist = new Float32Array(n);
  dist.fill(1e9);
  const nearX = new Int16Array(n);
  const nearZ = new Int16Array(n);
  const qx = new Int16Array(n);
  const qz = new Int16Array(n);
  let head = 0;
  let tail = 0;

  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
      if (!isOceanCell(x, z, biomes)) continue;
      const i = cellIndex(x, z);
      dist[i] = 0;
      nearX[i] = x;
      nearZ[i] = z;
      qx[tail] = x;
      qz[tail] = z;
      tail += 1;
    }
  }

  const step: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (head < tail) {
    const x = qx[head]!;
    const z = qz[head]!;
    head += 1;
    const i = cellIndex(x, z);
    for (const [dx, dz] of step) {
      const nx = x + dx;
      const nz = z + dz;
      if (!inBounds(nx, nz)) continue;
      const ni = cellIndex(nx, nz);
      const nd = dist[i] + 1;
      if (nd >= dist[ni]) continue;
      dist[ni] = nd;
      nearX[ni] = nearX[i];
      nearZ[ni] = nearZ[i];
      qx[tail] = nx;
      qz[tail] = nz;
      tail += 1;
    }
  }

  return { dist, nearX, nearZ };
}

export function nearestCell(
  biomes: Uint8Array,
  tx: number,
  tz: number,
  pred: (biome: Biome, x: number, z: number) => boolean,
  maxR = 28,
): { x: number; z: number } | null {
  const x0 = Math.round(tx);
  const z0 = Math.round(tz);
  for (let r = 0; r <= maxR; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = x0 + dx;
        const z = z0 + dz;
        if (!inBounds(x, z)) continue;
        if (pred(biomes[cellIndex(x, z)] as Biome, x, z)) return { x, z };
      }
    }
  }
  return null;
}

export function buildIslandMesh(_biomes: Uint8Array): THREE.Mesh {
  const positions: number[] = [];
  const colors: number[] = [];
  const grassA = new THREE.Color(GRASS_A);
  const grassB = new THREE.Color(GRASS_B);
  const sandA = new THREE.Color(SAND_A);
  const sandB = new THREE.Color(SAND_B);
  const tint = new THREE.Color();

  const pushTri = (poly: [number, number][], color: THREE.Color): void => {
    for (let i = 1; i < poly.length - 1; i++) {
      const ring: [number, number][] = [poly[0]!, poly[i]!, poly[i + 1]!];
      for (const [px, pz] of ring) {
        positions.push(px * CELL, GROUND_Y, pz * CELL);
        colors.push(color.r, color.g, color.b);
      }
    }
  };

  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
      const sand = isoPoly(x, z, (px, pz) => Math.min(landSDF(px, pz), sandSDF(px, pz)));
      const grass = isoPoly(x, z, (px, pz) => Math.min(landSDF(px, pz), -sandSDF(px, pz)));
      if (sand.length >= 3) {
        cellTint(Biome.Sand, x, z, grassA, grassB, sandA, sandB, tint);
        pushTri(sand, tint);
      }
      if (grass.length >= 3) {
        cellTint(Biome.Grass, x, z, grassA, grassB, sandA, sandB, tint);
        pushTri(grass, tint);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = "island";
  return mesh;
}

function isoPoly(x: number, z: number, sdf: (px: number, pz: number) => number): [number, number][] {
  const corners: [number, number][] = [
    [x, z],
    [x + 1, z],
    [x + 1, z + 1],
    [x, z + 1],
  ];
  const s = corners.map(([cx, cz]) => sdf(cx * CELL, cz * CELL));
  const pts: [number, number][] = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const si = s[i]!;
    const sj = s[j]!;
    const ci = corners[i]!;
    const cj = corners[j]!;
    if (si >= 0) pts.push(ci);
    if (si >= 0 !== sj >= 0) {
      const t = si / (si - sj);
      if (t > 1e-4 && t < 1 - 1e-4) {
        pts.push([ci[0] + (cj[0] - ci[0]) * t, ci[1] + (cj[1] - ci[1]) * t]);
      }
    }
  }
  return pts;
}

function cellHash01(x: number, z: number): number {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n >>> 0) % 1000) / 1000;
}

function cellTint(
  biome: number,
  x: number,
  z: number,
  grassA: THREE.Color,
  grassB: THREE.Color,
  sandA: THREE.Color,
  sandB: THREE.Color,
  out: THREE.Color,
): void {
  const u = cellHash01(x, z) * 0.22;
  if (biome === Biome.Grass) out.copy(grassA).lerp(grassB, u);
  else out.copy(sandA).lerp(sandB, u);
}

export function findSpawn(biomes: Uint8Array): { x: number; z: number } {
  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
      if (biomes[cellIndex(x, z)] !== Biome.Grass) continue;
      const dist = cellCenterDist(x, z);
      if (dist >= ISLAND_RADIUS - BEACH_WIDTH - 2 && dist <= ISLAND_RADIUS - BEACH_WIDTH) {
        return { x, z };
      }
    }
  }
  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
      if (biomes[cellIndex(x, z)] === Biome.Grass) return { x, z };
    }
  }
  return { x: Math.floor(CENTER), z: Math.floor(CENTER) };
}
