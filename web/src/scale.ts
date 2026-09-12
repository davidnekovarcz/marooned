import * as THREE from "three";
import { GROUND_Y } from "@/web/src/constants";

export type SizeAxis = "height" | "longest";

/** Real-world metres for the chosen axis. Tiny loot uses `min` so it stays readable. */
export type SizeSpec = {
  axis: SizeAxis;
  meters: number;
  /** Floor on the chosen axis — small props (orange, knife) read bigger than life. */
  min?: number;
  /** Lie a tall-thin mesh on the ground (banana). */
  layFlat?: boolean;
  /** Plant a flat mesh upright in the ground (knife). */
  standUp?: boolean;
};

const _box = new THREE.Box3();
const _size = new THREE.Vector3();

export function measureSize(obj: THREE.Object3D): { x: number; y: number; z: number; longest: number } {
  obj.updateMatrixWorld(true);
  _box.setFromObject(obj);
  _box.getSize(_size);
  return {
    x: _size.x,
    y: _size.y,
    z: _size.z,
    longest: Math.max(_size.x, _size.y, _size.z),
  };
}

/** Scale so the native bbox matches a real-world measure (world unit = 1 m). */
export function fitToSpec(obj: THREE.Object3D, spec: SizeSpec): void {
  const native = measureSize(obj);
  const current = spec.axis === "height" ? native.y : native.longest;
  if (current < 1e-4) return;
  const target = Math.max(spec.meters, spec.min ?? 0);
  obj.scale.multiplyScalar(target / current);
  obj.updateMatrixWorld(true);
  if (spec.standUp) standUpIfFlat(obj);
  else if (spec.layFlat) layFlatIfUpright(obj);
}

export function layFlatIfUpright(obj: THREE.Object3D): void {
  const size = measureSize(obj);
  if (size.y <= Math.max(size.x, size.z) * 1.12) return;
  obj.rotation.x = -Math.PI / 2;
  obj.updateMatrixWorld(true);
}

export function standUpIfFlat(obj: THREE.Object3D): void {
  const size = measureSize(obj);
  const horiz = Math.max(size.x, size.z);
  if (size.y >= horiz * 0.55) return;
  if (size.x >= size.z) obj.rotation.z += Math.PI / 2;
  else obj.rotation.x += Math.PI / 2;
  obj.updateMatrixWorld(true);
}

export function plantOnGround(obj: THREE.Object3D, y: number = GROUND_Y): void {
  obj.updateMatrixWorld(true);
  _box.setFromObject(obj);
  obj.position.y += y - _box.min.y;
}

export function fitAndPlant(obj: THREE.Object3D, spec: SizeSpec, y: number = GROUND_Y): void {
  fitToSpec(obj, spec);
  plantOnGround(obj, y);
}

/**
 * Player is 1.6 m. Kenney/Quaternius native sizes vary wildly, so every placed
 * mesh is measured and scaled to these metres (with a readability floor for loot).
 */
export const PROP_SIZE: Record<string, SizeSpec> = {
  palm: { axis: "height", meters: 6.9 },
  palmBend: { axis: "height", meters: 6.3 },
  palmShort: { axis: "height", meters: 4.7 },
  palmSimple: { axis: "height", meters: 6.0 },
  piratePalm: { axis: "height", meters: 6.5 },
  piratePalmStraight: { axis: "height", meters: 6.8 },
  oak: { axis: "height", meters: 6.1 },
  pine: { axis: "height", meters: 7.2 },
  bush: { axis: "height", meters: 0.95 },
  bushSmall: { axis: "height", meters: 0.62 },
  bushDetailed: { axis: "height", meters: 0.88 },
  flowerYellow: { axis: "height", meters: 1.15 },
  flowerPurple: { axis: "height", meters: 1.15 },
  flowerRed: { axis: "height", meters: 1.1 },
  mushroomTan: { axis: "height", meters: 0.34 },
  mushroomRed: { axis: "height", meters: 0.36 },
  natureLog: { axis: "height", meters: 0.48 },
  logLarge: { axis: "height", meters: 0.62 },
  campfireLogs: { axis: "height", meters: 0.38 },
  campfireStones: { axis: "height", meters: 0.32 },
  rockSmall: { axis: "height", meters: 0.55 },
  rockLarge: { axis: "height", meters: 1.15 },
  stump: { axis: "height", meters: 0.7 },
  sandRock: { axis: "height", meters: 0.9 },
  wreck: { axis: "height", meters: 4.2 },
  crate: { axis: "height", meters: 0.7 },
  crateBottles: { axis: "height", meters: 0.72 },
  barrel: { axis: "height", meters: 0.85 },
  chest: { axis: "height", meters: 0.7 },
  rowBoat: { axis: "height", meters: 1.4 },
  mastRopes: { axis: "height", meters: 1.6 },
  flag: { axis: "height", meters: 1.7 },
  hammer: { axis: "longest", meters: 0.32, min: 0.42 },
  axe: { axis: "longest", meters: 0.7, min: 0.78 },
  shovel: { axis: "longest", meters: 0.95, min: 0.95 },
  structure: { axis: "height", meters: 3.2 },
  tentHalf: { axis: "height", meters: 1.6 },
  floorOld: { axis: "height", meters: 0.12 },
  campfire: { axis: "height", meters: 0.55 },
  fishStand: { axis: "height", meters: 1.4 },
  log: { axis: "height", meters: 0.45 },
  bedroll: { axis: "height", meters: 0.18 },
  bucket: { axis: "height", meters: 0.38 },
  fishingBoat: { axis: "height", meters: 2.2 },
  coconut: { axis: "longest", meters: 0.22, min: 0.4 },
  coconutHalf: { axis: "longest", meters: 0.18, min: 0.48 },
  knife: { axis: "longest", meters: 0.22, min: 0.58, standUp: true },
  pineapple: { axis: "longest", meters: 0.28, min: 0.55 },
  orange: { axis: "longest", meters: 0.085, min: 0.36 },
  banana: { axis: "longest", meters: 0.18, min: 0.7, layFlat: true },
  lemon: { axis: "longest", meters: 0.075, min: 0.3 },
  watermelon: { axis: "longest", meters: 0.3, min: 0.7 },
  tomato: { axis: "longest", meters: 0.08, min: 0.32 },
  fish: { axis: "longest", meters: 0.35, min: 0.38, layFlat: true },
  fishCooked: { axis: "longest", meters: 0.35, min: 0.38, layFlat: true },
  bow: { axis: "height", meters: 0.9 },
  arrow: { axis: "longest", meters: 0.55 },
  bridge: { axis: "height", meters: 2.8 },
  lilypad: { axis: "height", meters: 0.08 },
  bottle: { axis: "longest", meters: 0.28, min: 0.28 },
  tinder: { axis: "longest", meters: 0.18, min: 0.26 },
  torch: { axis: "longest", meters: 0.55, min: 0.55 },
  fishingPole: { axis: "height", meters: 1.45, min: 1.2 },
  stick: { axis: "longest", meters: 0.55, min: 0.5 },
  stone: { axis: "longest", meters: 0.28, min: 0.32 },
  fiber: { axis: "longest", meters: 0.42, min: 0.38 },
  leanTo: { axis: "height", meters: 1.85 },
};

export const ANIMAL_SIZE = {
  pig: { axis: "height" as const, meters: 0.95 },
  sheep: { axis: "height" as const, meters: 0.9 },
  llama: { axis: "height" as const, meters: 1.7 },
  fox: { axis: "height" as const, meters: 0.58 },
  deer: { axis: "height" as const, meters: 1.38 },
  fish1: { axis: "longest" as const, meters: 0.55 },
  fish2: { axis: "longest" as const, meters: 0.48 },
  fish3: { axis: "longest" as const, meters: 0.45 },
};

export function specFor(kind: string): SizeSpec {
  return PROP_SIZE[kind] ?? { axis: "height", meters: 1 };
}
