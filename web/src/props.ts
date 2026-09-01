import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Biome, CELL, GRID, GROUND_Y, SEED } from "./constants";
import { cellCenterDist, cellIndex, inBounds, isLand } from "./island";
import { MODEL_URLS } from "./models";
import { mulberry32 } from "./rng";

const loader = new GLTFLoader();

const PLUS: [number, number][] = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export type PropKind = "palm" | "oak" | "pine" | "bush" | "rockSmall" | "rockLarge";

const HEIGHT: Record<PropKind, number> = {
  palm: 3.6,
  oak: 3.1,
  pine: 3.3,
  bush: 0.85,
  rockSmall: 0.55,
  rockLarge: 1.15,
};

function prepareTemplate(root: THREE.Object3D): THREE.Object3D {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of materials) {
      const std = mat as THREE.MeshStandardMaterial;
      if (std.metalness !== undefined) {
        std.metalness = 0;
        std.roughness = 0.82;
      }
    }
  });
  return root;
}

async function loadTemplate(url: string): Promise<THREE.Object3D> {
  const gltf = await loader.loadAsync(url);
  return prepareTemplate(gltf.scene);
}

function scaleToHeight(obj: THREE.Object3D, height: number): void {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  if (size.y < 1e-4) return;
  obj.scale.multiplyScalar(height / size.y);
}

function sitOnGround(obj: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(obj);
  obj.position.y += GROUND_Y - box.min.y;
}

function placeAtCell(obj: THREE.Object3D, x: number, z: number, yaw: number): void {
  obj.position.x = x * CELL + CELL / 2;
  obj.position.z = z * CELL + CELL / 2;
  obj.rotation.y = yaw;
  sitOnGround(obj);
}

function canBlock(biomes: Uint8Array, blocked: Uint8Array, x: number, z: number): boolean {
  if (!inBounds(x, z)) return false;
  const i = cellIndex(x, z);
  if (blocked[i]) return false;
  return isLand(biomes[i] as Biome);
}

function markPlus(blocked: Uint8Array, x: number, z: number): void {
  for (const [dx, dz] of PLUS) {
    const nx = x + dx;
    const nz = z + dz;
    if (inBounds(nx, nz)) blocked[cellIndex(nx, nz)] = 1;
  }
}

function plusFits(biomes: Uint8Array, blocked: Uint8Array, x: number, z: number): boolean {
  return PLUS.every(([dx, dz]) => canBlock(biomes, blocked, x + dx, z + dz));
}

export async function scatterProps(
  scene: THREE.Scene,
  biomes: Uint8Array,
  blocked: Uint8Array,
): Promise<void> {
  const rng = mulberry32(`${SEED}-props`);
  const templates: Record<PropKind, THREE.Object3D> = {
    palm: await loadTemplate(MODEL_URLS.palm),
    oak: await loadTemplate(MODEL_URLS.oak),
    pine: await loadTemplate(MODEL_URLS.pine),
    bush: await loadTemplate(MODEL_URLS.bush),
    rockSmall: await loadTemplate(MODEL_URLS.rockSmall),
    rockLarge: await loadTemplate(MODEL_URLS.rockLarge),
  };

  const grass: [number, number][] = [];
  const land: [number, number][] = [];
  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
      const b = biomes[cellIndex(x, z)] as Biome;
      if (b === Biome.Grass) grass.push([x, z]);
      if (isLand(b)) land.push([x, z]);
    }
  }

  const group = new THREE.Group();
  group.name = "props";

  const tryPlace = (
    kind: PropKind,
    cells: [number, number][],
    count: number,
    filter: (x: number, z: number) => boolean,
    occupy: "cell" | "plus" | "none",
  ) => {
    let placed = 0;
    let guard = 0;
    while (placed < count && guard < count * 40) {
      guard += 1;
      const [x, z] = cells[Math.floor(rng() * cells.length)]!;
      if (!filter(x, z)) continue;
      const i = cellIndex(x, z);
      if (occupy === "plus") {
        if (!plusFits(biomes, blocked, x, z)) continue;
        markPlus(blocked, x, z);
      } else if (occupy === "cell") {
        if (!canBlock(biomes, blocked, x, z)) continue;
        blocked[i] = 1;
      } else {
        if (!inBounds(x, z) || !isLand(biomes[i] as Biome) || blocked[i]) continue;
      }

      const clone = templates[kind].clone(true);
      scaleToHeight(clone, HEIGHT[kind] * (0.9 + rng() * 0.2));
      placeAtCell(clone, x, z, rng() * Math.PI * 2);
      group.add(clone);
      placed += 1;
    }
  };

  tryPlace(
    "palm",
    grass,
    16,
    (x, z) => {
      const d = cellCenterDist(x, z);
      return d >= 20 && d <= 38;
    },
    "cell",
  );
  tryPlace("oak", grass, 14, () => true, "cell");
  tryPlace(
    "pine",
    grass,
    10,
    (x, z) => cellCenterDist(x, z) <= 28,
    "cell",
  );
  tryPlace("rockLarge", land, 8, () => true, "plus");
  tryPlace("rockSmall", land, 20, () => true, "cell");
  tryPlace("bush", grass, 32, () => true, "none");

  scene.add(group);
}
