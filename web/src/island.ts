import * as THREE from "three";
import {
  BEACH_WIDTH,
  Biome,
  CELL,
  CENTER,
  GRASS_A,
  GRASS_B,
  GRID,
  ISLAND_RADIUS,
  SAND_A,
  SAND_B,
  WATER,
  WATER_Y,
} from "./constants";

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
  const dist = cellCenterDist(x, z);
  if (dist > ISLAND_RADIUS) return Biome.Water;
  if (ISLAND_RADIUS - dist < BEACH_WIDTH) return Biome.Sand;
  return Biome.Grass;
}

export function isLand(biome: Biome): boolean {
  return biome !== Biome.Water;
}

function hexColor(hex: number, rng: () => number, other: number): THREE.Color {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color(other), rng() * 0.35);
  return c;
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

export function buildIslandMesh(biomes: Uint8Array, rng: () => number): THREE.Mesh {
  const positions: number[] = [];
  const colors: number[] = [];
  const normals: number[] = [];

  const up = [0, 1, 0];

  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
      const biome = biomes[cellIndex(x, z)] as Biome;
      if (!isLand(biome)) continue;

      const x0 = x * CELL;
      const z0 = z * CELL;
      const x1 = x0 + CELL;
      const z1 = z0 + CELL;
      const y = 0;

      // two triangles: (x0,z0)-(x1,z0)-(x1,z1) and (x0,z0)-(x1,z1)-(x0,z1)
      const quad: [number, number][] = [
        [x0, z0],
        [x1, z0],
        [x1, z1],
        [x0, z0],
        [x1, z1],
        [x0, z1],
      ];
      const color =
        biome === Biome.Sand
          ? hexColor(SAND_A, rng, SAND_B)
          : hexColor(GRASS_A, rng, GRASS_B);

      for (const [px, pz] of quad) {
        positions.push(px, y, pz);
        colors.push(color.r, color.g, color.b);
        normals.push(...up);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = "island";
  return mesh;
}

export function buildOcean(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(250, 250);
  const mat = new THREE.MeshStandardMaterial({
    color: WATER,
    roughness: 0.28,
    metalness: 0.05,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(CENTER, WATER_Y, CENTER);
  mesh.receiveShadow = true;
  mesh.name = "ocean";
  return mesh;
}

export function findSpawn(biomes: Uint8Array): { x: number; z: number } {
  // South beach / inner grass — first grass cell near the southern shore.
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
  return { x: 50, z: 50 };
}
