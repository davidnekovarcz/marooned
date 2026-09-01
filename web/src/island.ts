import * as THREE from "three";
import {
  BEACH_WIDTH,
  Biome,
  CELL,
  CENTER,
  GRASS_A,
  GRID,
  ISLAND_RADIUS,
  SAND_A,
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

export function buildBiomes(): Uint8Array {
  const biomes = new Uint8Array(GRID * GRID);
  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
      biomes[cellIndex(x, z)] = biomeAt(x, z);
    }
  }
  return biomes;
}

export function buildIslandMesh(biomes: Uint8Array): THREE.Group {
  const group = new THREE.Group();
  group.name = "island";
  group.add(buildBiomeMesh(biomes, Biome.Grass, GRASS_A));
  group.add(buildBiomeMesh(biomes, Biome.Sand, SAND_A));
  return group;
}

function buildBiomeMesh(biomes: Uint8Array, want: Biome, color: number): THREE.Mesh {
  const positions: number[] = [];

  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
      if (biomes[cellIndex(x, z)] !== want) continue;

      const x0 = x * CELL;
      const z0 = z * CELL;
      const x1 = x0 + CELL;
      const z1 = z0 + CELL;
      const y = 0.02;
      const quad: [number, number][] = [
        [x0, z0],
        [x0, z1],
        [x1, z1],
        [x0, z0],
        [x1, z1],
        [x1, z0],
      ];
      for (const [px, pz] of quad) {
        positions.push(px, y, pz);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = want === Biome.Sand ? "beach" : "grass";
  return mesh;
}

export function buildOcean(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(250, 250);
  const mat = new THREE.MeshLambertMaterial({
    color: WATER,
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
