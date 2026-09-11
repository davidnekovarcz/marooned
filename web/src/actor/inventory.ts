import * as THREE from "three";
import { CELL, GROUND_Y } from "@/web/src/constants";
import { fitAndPlant, specFor } from "@/web/src/scale";
import { isHeldFood, type HeldKind, type PocketSlot } from "@/web/src/world/kinds";
import type { PlayerVisual } from "@/web/src/playerModel";
import type { FoodPrep, Freshness } from "@/web/src/food";

export type PocketItem = { kind: HeldKind; mesh: THREE.Object3D };
export type InventorySnapshot = {
  heldKind: HeldKind | null;
  heldPrep?: FoodPrep;
  heldFreshness?: Freshness;
  left: HeldKind | null;
  right: HeldKind | null;
};

const FOOD_HOLD = { rot: new THREE.Euler(0.4, 0.2, 0.5) };
const PINEAPPLE_HOLD = { rot: new THREE.Euler(0.35, 0.15, 0.45) };
const TOOL_HOLD: Record<"knife" | "hammer" | "axe" | "shovel" | "torch", { length: number; rot: THREE.Euler }> = {
  knife: { length: 0.28, rot: new THREE.Euler(0.2, 0.9, 1.2) },
  hammer: { length: 0.36, rot: new THREE.Euler(0.15, 0.7, 1.05) },
  axe: { length: 0.42, rot: new THREE.Euler(0.12, 0.65, 1.08) },
  shovel: { length: 0.48, rot: new THREE.Euler(0.1, 0.6, 1.05) },
  torch: { length: 0.38, rot: new THREE.Euler(0.12, 0.65, 1.1) },
};

function poseFor(kind: HeldKind): { length: number | null; rot: THREE.Euler } {
  if (kind === "knife" || kind === "hammer" || kind === "axe" || kind === "shovel" || kind === "torch") {
    return TOOL_HOLD[kind];
  }
  if (kind === "tinder") return { length: 0.16, rot: FOOD_HOLD.rot };
  if (kind === "pineapple") return { length: null, rot: PINEAPPLE_HOLD.rot };
  return { length: null, rot: FOOD_HOLD.rot };
}

const _holdBox = new THREE.Box3();
const _holdSize = new THREE.Vector3();
const _holdCenter = new THREE.Vector3();

function placeInGrip(grip: THREE.Object3D, mesh: THREE.Object3D, length: number | null, rot: THREE.Euler): void {
  grip.attach(mesh);
  mesh.rotation.copy(rot);
  mesh.position.set(0, 0, 0);
  mesh.updateWorldMatrix(true, true);
  if (length !== null) {
    _holdBox.setFromObject(mesh);
    _holdBox.getSize(_holdSize);
    const longest = Math.max(_holdSize.x, _holdSize.y, _holdSize.z, 1e-4);
    mesh.scale.multiplyScalar(length / longest);
    mesh.updateWorldMatrix(true, true);
  }
  _holdBox.setFromObject(mesh);
  _holdBox.getCenter(_holdCenter);
  const local = grip.worldToLocal(_holdCenter);
  mesh.position.sub(local);
  mesh.visible = true;
  mesh.traverse((obj) => {
    obj.frustumCulled = false;
  });
}

export class Inventory {
  heldKind: HeldKind | null = null;
  private tool: THREE.Object3D | null = null;
  private pockets: Record<PocketSlot, PocketItem | null> = { left: null, right: null };
  private pocketGroup = new THREE.Group();

  constructor(
    private root: THREE.Object3D,
    private visual: PlayerVisual,
  ) {
    this.pocketGroup.name = "pockets";
    this.pocketGroup.visible = false;
    this.root.add(this.pocketGroup);
  }

  get heldMesh(): THREE.Object3D | null {
    return this.tool;
  }

  pocket(slot: PocketSlot): HeldKind | null {
    return this.pockets[slot]?.kind ?? null;
  }

  snapshot(): InventorySnapshot {
    const mesh = this.tool;
    const heldPrep = typeof mesh?.userData.foodPrep === "string" ? (mesh.userData.foodPrep as FoodPrep) : undefined;
    const heldFreshness =
      mesh?.userData.foodFreshness === "rotten" || mesh?.userData.foodFreshness === "fresh"
        ? (mesh.userData.foodFreshness as Freshness)
        : undefined;
    return {
      heldKind: this.heldKind,
      heldPrep,
      heldFreshness,
      left: this.pockets.left?.kind ?? null,
      right: this.pockets.right?.kind ?? null,
    };
  }

  /** Stow the held tool into the first empty pocket. Food never pockets. */
  stowHeld(): boolean {
    if (!this.tool || !this.heldKind || isHeldFood(this.heldKind)) return false;
    const slot: PocketSlot | null = !this.pockets.left ? "left" : !this.pockets.right ? "right" : null;
    if (!slot) return false;
    this.hideInPocket(slot, { kind: this.heldKind, mesh: this.tool });
    this.tool = null;
    this.heldKind = null;
    return true;
  }

  swapPocket(slot: PocketSlot, busy: boolean, alive: boolean): boolean {
    if (!alive || busy) return false;
    const pocket = this.pockets[slot];
    const hand: PocketItem | null = this.tool && this.heldKind ? { kind: this.heldKind, mesh: this.tool } : null;
    if (!pocket && !hand) return false;
    if (hand && isHeldFood(hand.kind)) return false;
    if (pocket) {
      const hold = poseFor(pocket.kind);
      placeInGrip(this.visual.grip, pocket.mesh, hold.length, hold.rot);
      this.tool = pocket.mesh;
      this.heldKind = pocket.kind;
    } else {
      this.tool = null;
      this.heldKind = null;
    }
    if (hand) this.hideInPocket(slot, hand);
    else this.pockets[slot] = null;
    return true;
  }

  dropHeld(cellX: number, cellZ: number): { mesh: THREE.Object3D; kind: HeldKind } | null {
    return this.detachToolToWorld(cellX, cellZ);
  }

  pickup(
    mesh: THREE.Object3D,
    kind: HeldKind,
    cellX: number,
    cellZ: number,
    busy: boolean,
    alive: boolean,
  ): { dropped: { mesh: THREE.Object3D; kind: HeldKind } | null } | null {
    if (!alive || busy) return null;
    let dropped: { mesh: THREE.Object3D; kind: HeldKind } | null = null;
    if (this.tool && this.heldKind) {
      if (isHeldFood(this.heldKind) || !this.stowHeld()) dropped = this.detachToolToWorld(cellX, cellZ);
    }
    this.grabHeld(mesh, kind);
    return { dropped };
  }

  grabHeld(mesh: THREE.Object3D, kind: HeldKind): void {
    const hold = poseFor(kind);
    placeInGrip(this.visual.grip, mesh, hold.length, hold.rot);
    this.tool = mesh;
    this.heldKind = kind;
  }

  clearHeldIf(mesh: THREE.Object3D | null): void {
    if (this.tool === mesh) {
      this.tool = null;
      this.heldKind = null;
    }
  }

  showHeld(): void {
    if (this.tool) this.tool.visible = true;
  }

  isHolding(kind: HeldKind): boolean {
    return this.heldKind === kind;
  }

  isHoldingFood(): boolean {
    return isHeldFood(this.heldKind) && this.tool !== null;
  }

  private hideInPocket(slot: PocketSlot, item: PocketItem): void {
    this.pocketGroup.attach(item.mesh);
    item.mesh.visible = false;
    this.pockets[slot] = item;
  }

  private detachToolToWorld(cellX: number, cellZ: number): { mesh: THREE.Object3D; kind: HeldKind } | null {
    if (!this.tool || !this.heldKind) return null;
    const mesh = this.tool;
    const kind = this.heldKind;
    const parent = this.root.parent;
    if (parent) parent.attach(mesh);
    else mesh.removeFromParent();
    mesh.position.set(cellX * CELL + CELL / 2, GROUND_Y, cellZ * CELL + CELL / 2);
    mesh.rotation.set(0, 0.4, 0);
    fitAndPlant(mesh, specFor(kind), GROUND_Y);
    mesh.visible = true;
    this.tool = null;
    this.heldKind = null;
    return { mesh, kind };
  }
}
