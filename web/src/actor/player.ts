import * as THREE from "three";
import {
  CAMERA_LERP,
  CAMERA_LERP_RUN,
  CAMERA_LERP_WALK,
  CELL,
  STEP_SECONDS_RUN,
  STEP_SECONDS_SWIM,
  STEP_SECONDS_WALK,
} from "@/web/src/constants";
import { BusyAction } from "@/web/src/actor/busy";
import { Inventory } from "@/web/src/actor/inventory";
import { canEnter } from "@/web/src/gridOverlay";
import type { Input } from "@/web/src/input/Input";
import { isInlandWater } from "@/web/src/island";
import type { PlayerGait, PlayerVisual } from "@/web/src/playerModel";
import { type HeldKind, type PocketSlot } from "@/web/src/world/kinds";

export type { HeldKind, PocketSlot } from "@/web/src/world/kinds";
export { isHeldFood } from "@/web/src/world/kinds";

export class GridPlayer {
  readonly mesh: THREE.Object3D;
  readonly inventory: Inventory;
  readonly busyAction = new BusyAction();
  cellX: number;
  cellZ: number;
  canSprint = true;
  alive = true;
  gait: PlayerGait = "idle";
  private moving = false;
  private destWater = false;
  private stepSeconds = STEP_SECONDS_WALK;
  private t = 0;
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();

  get busy(): boolean {
    return this.busyAction.busy;
  }

  get heldKind(): HeldKind | null {
    return this.inventory.heldKind;
  }

  get heldMesh(): THREE.Object3D | null {
    return this.inventory.heldMesh;
  }

  constructor(
    private biomes: Uint8Array,
    private blocked: Uint8Array,
    start: { x: number; z: number },
    private visual: PlayerVisual,
    private input: Input,
  ) {
    this.mesh = visual.root;
    this.cellX = start.x;
    this.cellZ = start.z;
    this.inventory = new Inventory(this.mesh, visual);
    this.snap();
  }

  placeAt(x: number, z: number): void {
    this.cellX = x;
    this.cellZ = z;
    this.snap();
  }

  inWater(): boolean {
    return isInlandWater(this.cellX, this.cellZ, this.biomes);
  }

  faceToward(x: number, z: number): void {
    this.mesh.lookAt(x, this.mesh.position.y, z);
  }

  pocket(slot: PocketSlot): HeldKind | null {
    return this.inventory.pocket(slot);
  }

  stowHeld(): boolean {
    return this.inventory.stowHeld();
  }

  swapPocket(slot: PocketSlot): boolean {
    return this.inventory.swapPocket(slot, this.busy, this.alive);
  }

  dropHeld(): { mesh: THREE.Object3D; kind: HeldKind } | null {
    return this.inventory.dropHeld(this.cellX, this.cellZ);
  }

  pickup(mesh: THREE.Object3D, kind: HeldKind): { dropped: { mesh: THREE.Object3D; kind: HeldKind } | null } | null {
    return this.inventory.pickup(mesh, kind, this.cellX, this.cellZ, this.busy, this.alive);
  }

  beginHeldMeal(seconds: number, onEnd?: () => void, keep = false): boolean {
    if (!this.alive || this.busy || !this.inventory.isHoldingFood() || !this.inventory.heldMesh) return false;
    this.stopMoving();
    this.busyAction.beginMeal(this.inventory.heldMesh, seconds, onEnd, keep);
    this.gait = this.inWater() ? "swim" : "idle";
    this.visual.setGait(this.gait);
    return true;
  }

  beginCut(seconds: number, onDone: () => void): boolean {
    if (!this.alive || this.busy || this.heldKind !== "knife") return false;
    this.stopMoving();
    this.busyAction.beginCut(seconds, onDone, this.inventory.heldMesh);
    this.gait = this.inWater() ? "swim" : "idle";
    this.visual.setGait(this.gait);
    return true;
  }

  beginBreak(mesh: THREE.Object3D, seconds: number, onCrack: () => void): boolean {
    if (!this.alive || this.busy || this.heldKind !== "hammer") return false;
    this.stopMoving();
    this.busyAction.beginBreak(mesh, seconds, onCrack, this.inventory.heldMesh);
    this.gait = this.inWater() ? "swim" : "idle";
    this.visual.setGait(this.gait);
    return true;
  }

  beginWork(seconds: number, onDone: () => void): boolean {
    if (!this.alive || this.busy) return false;
    this.stopMoving();
    this.busyAction.beginWork(seconds, onDone, this.inventory.heldMesh);
    this.gait = this.inWater() ? "swim" : "idle";
    this.visual.setGait(this.gait);
    return true;
  }

  private snap(): void {
    this.mesh.position.set(this.cellX * CELL + CELL / 2, 0, this.cellZ * CELL + CELL / 2);
  }

  private stopMoving(): void {
    if (!this.moving) return;
    if (this.t >= 0.5) {
      this.cellX = Math.round(this.to.x - CELL / 2);
      this.cellZ = Math.round(this.to.z - CELL / 2);
    }
    this.moving = false;
    this.snap();
  }

  private refreshGait(sprinting: boolean): PlayerGait {
    if (this.inWater() || (this.moving && this.destWater)) {
      this.gait = "swim";
      return this.gait;
    }
    if (!this.moving) {
      this.gait = "idle";
      return this.gait;
    }
    this.gait = sprinting && this.canSprint ? "run" : "walk";
    return this.gait;
  }

  update(dt: number): void {
    this.visual.mixer.update(dt);

    if (!this.alive) {
      this.busyAction.cancel((mesh) => this.inventory.clearHeldIf(mesh), this.visual);
      this.moving = false;
      this.gait = "idle";
      this.visual.setGait("idle");
      this.visual.setCrouch(0);
      this.visual.setSwim(0);
      this.visual.applyPose();
      return;
    }

    const water = this.inWater();
    this.visual.setSwim(water && this.busyAction.lock !== "meal" ? 1 : 0);

    if (this.busy) {
      this.gait = this.busyAction.tick(dt, this.visual, water, (mesh) => this.inventory.clearHeldIf(mesh));
      this.inventory.showHeld();
      return;
    }

    this.visual.setCrouch(0);
    this.visual.applyPose();

    if (this.moving) {
      this.visual.setGait(this.refreshGait(this.input.sprinting));
      this.t += dt / this.stepSeconds;
      const u = Math.min(1, this.t);
      const s = u * u * (3 - 2 * u);
      this.mesh.position.lerpVectors(this.from, this.to, s);
      if (u < 1) return;

      this.moving = false;
      this.cellX = Math.round(this.to.x - CELL / 2);
      this.cellZ = Math.round(this.to.z - CELL / 2);
      this.snap();
    }

    const dir = this.input.moveDir();
    if (dir && this.canStep(dir.x, dir.z)) {
      const nx = this.cellX + dir.x;
      const nz = this.cellZ + dir.z;
      const diagonal = dir.x !== 0 && dir.z !== 0;
      const intoWater = isInlandWater(nx, nz, this.biomes);
      this.destWater = intoWater;
      const pace = intoWater
        ? STEP_SECONDS_SWIM
        : this.input.sprinting && this.canSprint
          ? STEP_SECONDS_RUN
          : STEP_SECONDS_WALK;
      this.stepSeconds = diagonal ? pace * Math.SQRT2 : pace;
      this.from.copy(this.mesh.position);
      this.to.set(nx * CELL + CELL / 2, 0, nz * CELL + CELL / 2);
      this.t = 0;
      this.moving = true;
      this.mesh.lookAt(this.to.x, 0, this.to.z);
      this.visual.setGait(this.refreshGait(this.input.sprinting));
    }

    if (!this.moving) this.visual.setGait(this.refreshGait(this.input.sprinting));
  }

  private canStep(dx: number, dz: number): boolean {
    const nx = this.cellX + dx;
    const nz = this.cellZ + dz;
    if (!canEnter(this.biomes, this.blocked, nx, nz)) return false;
    if (dx !== 0 && dz !== 0) {
      if (!canEnter(this.biomes, this.blocked, this.cellX + dx, this.cellZ)) return false;
      if (!canEnter(this.biomes, this.blocked, this.cellX, this.cellZ + dz)) return false;
    }
    return true;
  }

  followCamera(camera: THREE.PerspectiveCamera, offset: THREE.Vector3): void {
    const lookY = this.inWater() ? 0.45 : 1.1;
    const target = new THREE.Vector3(
      this.mesh.position.x + offset.x,
      this.mesh.position.y + offset.y,
      this.mesh.position.z + offset.z,
    );
    const lerp =
      this.gait === "walk" ? CAMERA_LERP_WALK : this.gait === "run" ? CAMERA_LERP_RUN : CAMERA_LERP;
    camera.position.lerp(target, lerp);
    camera.lookAt(this.mesh.position.x, lookY, this.mesh.position.z);
  }
}
