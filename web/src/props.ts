import * as THREE from "three";
import {
  BEACH_WIDTH,
  Biome,
  CELL,
  CENTER,
  GRID,
  GROUND_Y,
  ISLAND_RADIUS,
  POND_X,
  POND_Z,
  SEED,
  WATER_Y,
} from "@/web/src/constants";
import { canEnter } from "@/web/src/gridOverlay";
import {
  cellCenterDist,
  cellIndex,
  inBounds,
  isLand,
  nearestCell,
} from "@/web/src/island";
import { loadGlb, loadObj } from "@/web/src/loaders";
import type { Cell, LootSites } from "@/web/src/sim/loot";
import { Item } from "@/web/src/world/item";
import { LILY_URL, MODEL_URLS, TOMATO_URL, TORCH_URL, type ModelKind } from "@/web/src/models";
import { mulberry32 } from "@/web/src/rng";
import { fitAndPlant, plantOnGround, specFor } from "@/web/src/scale";

const PLUS: [number, number][] = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Land cells at Chebyshev 1–2 so palms on any bank (including the pond) can host fruit. */
const NEAR: [number, number][] = [];
for (let dz = -2; dz <= 2; dz++) {
  for (let dx = -2; dx <= 2; dx++) {
    const cheb = Math.max(Math.abs(dx), Math.abs(dz));
    if (cheb >= 1 && cheb <= 2) NEAR.push([dx, dz]);
  }
}

type PlaceKind = ModelKind | "lilypad" | "torch" | "tomato" | "fishCooked";

export type AudioAnchor = { id: string; position: THREE.Vector3 };

export type ScatterResult = {
  group: THREE.Group;
  audioAnchors: AudioAnchor[];
  items: Item[];
  lootSites: LootSites;
  spawn: (
    kind: ModelKind | "torch" | "tomato" | "fishCooked",
    x: number,
    z: number,
    extra?: { yaw?: number; dx?: number; dz?: number },
  ) => Item | null;
};

function sitOnGround(obj: THREE.Object3D): void {
  plantOnGround(obj);
}

function placeAtCell(
  obj: THREE.Object3D,
  kind: PlaceKind,
  x: number,
  z: number,
  yaw: number,
  y: number = GROUND_Y,
  vary = 1,
): void {
  obj.position.set(x * CELL + CELL / 2, 0, z * CELL + CELL / 2);
  obj.rotation.y = yaw;
    const spec = specFor(kind === "fishCooked" ? "fish" : kind);
  fitAndPlant(obj, { ...spec, meters: spec.meters * vary, min: spec.min ? spec.min * vary : undefined }, y);
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

function markRect(blocked: Uint8Array, x: number, z: number, rx: number, rz: number): void {
  for (let dz = -rz; dz <= rz; dz++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const nx = x + dx;
      const nz = z + dz;
      if (inBounds(nx, nz)) blocked[cellIndex(nx, nz)] = 1;
    }
  }
}

function plusFits(biomes: Uint8Array, blocked: Uint8Array, x: number, z: number): boolean {
  return PLUS.every(([dx, dz]) => canBlock(biomes, blocked, x + dx, z + dz));
}

function worldPos(x: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x * CELL + CELL / 2, 1.2, z * CELL + CELL / 2);
}

function collectAround(
  biomes: Uint8Array,
  blocked: Uint8Array,
  cx: number,
  cz: number,
  rx: number,
  rz: number,
  extra = 2,
): Cell[] {
  const out: Cell[] = [];
  for (let z = cz - rz - extra; z <= cz + rz + extra; z++) {
    for (let x = cx - rx - extra; x <= cx + rx + extra; x++) {
      if (!inBounds(x, z)) continue;
      if (Math.abs(x - cx) <= rx && Math.abs(z - cz) <= rz) continue;
      if (!canEnter(biomes, blocked, x, z)) continue;
      out.push({ x, z });
    }
  }
  return out;
}

function collectNearTree(biomes: Uint8Array, blocked: Uint8Array, px: number, pz: number): Cell[] {
  const out: Cell[] = [];
  for (const [dx, dz] of NEAR) {
    const x = px + dx;
    const z = pz + dz;
    if (!canEnter(biomes, blocked, x, z)) continue;
    if (!isLand(biomes[cellIndex(x, z)] as Biome)) continue;
    out.push({ x, z });
  }
  return out;
}

function uniqueCells(cells: Cell[]): Cell[] {
  const seen = new Set<string>();
  const out: Cell[] = [];
  for (const cell of cells) {
    const key = `${cell.x},${cell.z}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cell);
  }
  return out;
}

export async function scatterProps(
  scene: THREE.Scene,
  biomes: Uint8Array,
  blocked: Uint8Array,
): Promise<ScatterResult> {
  const rng = mulberry32(`${SEED}-props`);
  const templates: Partial<Record<PlaceKind, THREE.Object3D>> = {};

  await Promise.all(
    (Object.keys(MODEL_URLS) as ModelKind[]).map(async (kind) => {
      templates[kind] = await loadGlb(MODEL_URLS[kind]);
    }),
  );
  templates.lilypad = await loadObj(LILY_URL);
  templates.torch = await loadObj(TORCH_URL, 0x6a4a32);
  templates.tomato = await loadObj(TOMATO_URL, 0xc43b2b);

  const grass: [number, number][] = [];
  const land: [number, number][] = [];
  const sand: [number, number][] = [];
  const waterInland: [number, number][] = [];
  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
      const b = biomes[cellIndex(x, z)] as Biome;
      if (b === Biome.Grass) grass.push([x, z]);
      if (b === Biome.Sand) sand.push([x, z]);
      if (isLand(b)) land.push([x, z]);
      if (b === Biome.Water && cellCenterDist(x, z) < ISLAND_RADIUS) waterInland.push([x, z]);
    }
  }

  const group = new THREE.Group();
  group.name = "props";
  const audioAnchors: AudioAnchor[] = [];
  const items: Item[] = [];
  const lootSites: LootSites = {
    palm: [],
    inlandPalm: [],
    grove: [],
    wreck: [],
    boat: [],
    hut: [],
    forest: [],
    bush: [],
  };

  const add = (
    kind: PlaceKind,
    x: number,
    z: number,
    yaw: number,
    extra?: { tiltX?: number; tiltZ?: number; y?: number; dx?: number; dz?: number; vary?: boolean },
  ): THREE.Object3D | null => {
    if (!inBounds(x, z)) return null;
    const srcKey: PlaceKind = kind === "fishCooked" ? "fish" : kind;
    const src = templates[srcKey];
    if (!src) return null;
    const clone = src.clone(true);
    const vary = extra?.vary === false ? 1 : 0.92 + rng() * 0.16;
    placeAtCell(clone, kind, x, z, yaw, extra?.y ?? GROUND_Y, vary);
    if (extra?.dx) clone.position.x += extra.dx;
    if (extra?.dz) clone.position.z += extra.dz;
    if (extra?.tiltX) clone.rotation.x += extra.tiltX;
    if (extra?.tiltZ) clone.rotation.z += extra.tiltZ;
    if (extra?.tiltX || extra?.tiltZ) sitOnGround(clone);
    group.add(clone);
    items.push(new Item(kind, x, z, clone));
    return clone;
  };

  const wreck = nearestCell(
    biomes,
    CENTER,
    CENTER - ISLAND_RADIUS + BEACH_WIDTH * 0.45,
    (b) => b === Biome.Sand,
  );
  if (wreck) {
    markRect(blocked, wreck.x, wreck.z, 3, 2);
    add("wreck", wreck.x, wreck.z, 0.4, { tiltZ: 0.28 });
    add("crate", wreck.x + 2, wreck.z + 1, rng() * 6);
    add("barrel", wreck.x - 2, wreck.z, rng() * 6);
    add("barrel", wreck.x + 1, wreck.z + 2, rng() * 6);
    add("chest", wreck.x + 1, wreck.z - 1, 1.1);
    add("crateBottles", wreck.x + 3, wreck.z + 1, rng() * 4);
    add("bottle", wreck.x + 2, wreck.z, rng() * 6);
    add("bottle", wreck.x - 1, wreck.z - 2, rng() * 6);
    add("flag", wreck.x - 2, wreck.z + 1, 0.2);
    lootSites.wreck.push(...collectAround(biomes, blocked, wreck.x, wreck.z, 3, 2, 2));
    audioAnchors.push({ id: "wreck", position: worldPos(wreck.x, wreck.z) });
  }

  const boat = nearestCell(
    biomes,
    CENTER + ISLAND_RADIUS - BEACH_WIDTH * 0.5,
    CENTER,
    (b) => b === Biome.Sand,
  );
  if (boat) {
    markRect(blocked, boat.x, boat.z, 2, 2);
    add("fishingBoat", boat.x, boat.z, -0.6, { tiltX: 0.35, tiltZ: -0.2 });
    add("rowBoat", boat.x - 3, boat.z + 1, 0.8, { tiltZ: 0.22 });
    add("mastRopes", boat.x + 1, boat.z + 2, rng() * 3);
    add("fishStand", boat.x - 2, boat.z - 2, 0.4);
    add("fish", boat.x, boat.z + 2, rng() * 6);
    lootSites.boat.push(...collectAround(biomes, blocked, boat.x, boat.z, 2, 2, 2));
    audioAnchors.push({ id: "boat", position: worldPos(boat.x, boat.z) });
  }

  const hut = nearestCell(
    biomes,
    CENTER + 10,
    CENTER + 18,
    (b, x, z) => b === Biome.Grass && plusFits(biomes, blocked, x, z),
  );
  if (hut) {
    markRect(blocked, hut.x, hut.z, 2, 2);
    add("floorOld", hut.x, hut.z, 0.1);
    add("structure", hut.x, hut.z, 0.35, { tiltZ: 0.08 });
    add("tentHalf", hut.x + 2, hut.z - 1, -0.4);
    add("campfire", hut.x - 2, hut.z + 1, rng() * 2);
    add("log", hut.x - 1, hut.z + 2, rng() * 3);
    add("bedroll", hut.x + 1, hut.z - 1, rng() * 3);
    add("bucket", hut.x - 1, hut.z + 1, rng() * 4);
    add("tinder", hut.x + 1, hut.z + 1, rng() * 2);
    add("stick", hut.x - 3, hut.z, rng() * 2);
    add("stick", hut.x + 3, hut.z + 1, rng() * 2);
    add("fiber", hut.x + 2, hut.z + 1, rng() * 3);
    add("bow", hut.x + 1, hut.z + 2, 0.7);
    add("arrow", hut.x + 2, hut.z + 2, 1.2);
    lootSites.hut.push(...collectAround(biomes, blocked, hut.x, hut.z, 2, 2, 2));
    audioAnchors.push({ id: "hut", position: worldPos(hut.x, hut.z) });
  }

  const bridge = nearestCell(
    biomes,
    POND_X - 8,
    POND_Z,
    (b, x, z) => b === Biome.Water && cellCenterDist(x, z) < ISLAND_RADIUS,
  );
  if (bridge) {
    add("bridge", bridge.x, bridge.z, Math.PI / 2, { y: WATER_Y + 0.35 });
  }

  audioAnchors.push({ id: "pond", position: worldPos(POND_X, POND_Z) });

  const collectPalm = (px: number, pz: number) => {
    const near = collectNearTree(biomes, blocked, px, pz);
    lootSites.palm.push(...near);
    if (biomes[cellIndex(px, pz)] !== Biome.Grass) return;
    const grassNear = near.filter((cell) => biomes[cellIndex(cell.x, cell.z)] === Biome.Grass);
    lootSites.inlandPalm.push(...(grassNear.length ? grassNear : near));
  };
  const collectGrove = (px: number, pz: number) => {
    lootSites.grove.push(...collectNearTree(biomes, blocked, px, pz));
  };
  const collectBush = (px: number, pz: number) => {
    if (inForest(px, pz)) return;
    lootSites.bush.push(...collectNearTree(biomes, blocked, px, pz));
  };

  const tryPlace = (
    kind: ModelKind,
    cells: [number, number][],
    count: number,
    filter: (x: number, z: number) => boolean,
    occupy: "cell" | "plus" | "none" | "walk",
    after?: (x: number, z: number) => void,
  ) => {
    let placed = 0;
    let guard = 0;
    while (placed < count && guard < count * 50) {
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
      } else if (occupy === "walk") {
        if (!canEnter(biomes, blocked, x, z)) continue;
      } else {
        if (!inBounds(x, z) || !isLand(biomes[i] as Biome) || blocked[i]) continue;
      }
      add(kind, x, z, rng() * Math.PI * 2);
      after?.(x, z);
      placed += 1;
    }
  };

  const forest = nearestCell(
    biomes,
    CENTER - 14,
    CENTER - 10,
    (b, x, z) =>
      b === Biome.Grass &&
      plusFits(biomes, blocked, x, z) &&
      cellCenterDist(x, z) >= 16 &&
      cellCenterDist(x, z) <= 36,
    40,
  );
  const forestX = forest?.x ?? Math.floor(CENTER - 12);
  const forestZ = forest?.z ?? Math.floor(CENTER - 8);
  const inForest = (x: number, z: number) => Math.hypot(x - forestX, z - forestZ) <= 11;

  tryPlace(
    "palm",
    grass,
    22,
    (x, z) => {
      const d = cellCenterDist(x, z);
      return d >= 32 && d <= 62;
    },
    "cell",
    collectPalm,
  );
  tryPlace(
    "palmBend",
    grass,
    10,
    (x, z) => cellCenterDist(x, z) >= 36 && cellCenterDist(x, z) <= 64,
    "cell",
    collectPalm,
  );
  tryPlace("palmShort", sand, 8, () => true, "cell", collectPalm);
  tryPlace("palmSimple", sand, 6, () => true, "cell", collectPalm);
  tryPlace("piratePalm", sand, 6, () => true, "cell", collectPalm);
  tryPlace("piratePalmStraight", sand, 5, () => true, "cell", collectPalm);
  tryPlace(
    "palmShort",
    sand,
    4,
    (x, z) => Math.hypot(x - POND_X, z - POND_Z) <= 10,
    "cell",
    collectPalm,
  );
  tryPlace(
    "piratePalm",
    sand,
    3,
    (x, z) => Math.hypot(x - POND_X, z - POND_Z) <= 12,
    "cell",
    collectPalm,
  );
  tryPlace("oak", grass, 10, (x, z) => inForest(x, z), "cell", collectGrove);
  tryPlace("oak", grass, 6, (x, z) => !inForest(x, z), "cell", collectGrove);
  tryPlace("pine", grass, 14, (x, z) => inForest(x, z), "cell", collectGrove);
  tryPlace("stump", grass, 8, () => true, "cell");
  tryPlace("rockLarge", land, 12, (x, z) => !inForest(x, z), "plus");
  tryPlace("rockSmall", land, 28, (x, z) => !inForest(x, z), "cell");
  tryPlace("sandRock", sand, 10, () => true, "cell");
  tryPlace("bush", grass, 48, (x, z) => !inForest(x, z), "none", collectBush);
  tryPlace("bushSmall", grass, 28, (x, z) => !inForest(x, z), "none", collectBush);
  tryPlace("bushDetailed", grass, 22, (x, z) => !inForest(x, z), "none", collectBush);
  tryPlace("natureLog", grass, 3, (x, z) => inForest(x, z), "walk");
  tryPlace("logLarge", grass, 2, (x, z) => inForest(x, z), "walk");
  tryPlace("campfireStones", sand, 2, () => true, "none");

  for (let z = forestZ - 12; z <= forestZ + 12; z++) {
    for (let x = forestX - 12; x <= forestX + 12; x++) {
      if (!inForest(x, z)) continue;
      if (!canEnter(biomes, blocked, x, z)) continue;
      lootSites.forest.push({ x, z });
    }
  }
  lootSites.palm = uniqueCells(lootSites.palm);
  lootSites.inlandPalm = uniqueCells(lootSites.inlandPalm);
  lootSites.grove = uniqueCells(lootSites.grove);
  lootSites.wreck = uniqueCells(lootSites.wreck);
  lootSites.boat = uniqueCells(lootSites.boat);
  lootSites.hut = uniqueCells(lootSites.hut);
  lootSites.forest = uniqueCells(lootSites.forest);
  lootSites.bush = uniqueCells(lootSites.bush);

  let pads = 0;
  let padGuard = 0;
  while (pads < 14 && padGuard < 80 && waterInland.length) {
    padGuard += 1;
    const [x, z] = waterInland[Math.floor(rng() * waterInland.length)]!;
    add("lilypad", x, z, rng() * 6, { y: WATER_Y + 0.04 });
    pads += 1;
  }

  scene.add(group);
  const spawn = (
    kind: ModelKind | "torch" | "tomato" | "fishCooked",
    x: number,
    z: number,
    extra?: { yaw?: number; dx?: number; dz?: number },
  ): Item | null => {
    const mesh = add(kind, x, z, extra?.yaw ?? rng() * 6, {
      dx: extra?.dx,
      dz: extra?.dz,
      vary: false,
    });
    if (!mesh) return null;
    return items[items.length - 1] ?? null;
  };
  return { group, audioAnchors, items, lootSites, spawn };
}
