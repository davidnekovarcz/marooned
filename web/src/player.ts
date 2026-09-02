import * as THREE from "three";
import {
  CELL,
  GROUND_Y,
  STEP_SECONDS_RUN,
  STEP_SECONDS_SWIM,
  STEP_SECONDS_WALK,
} from "./constants";
import { canEnter } from "./gridOverlay";
import { isInlandWater } from "./island";
import type { PlayerGait, PlayerVisual } from "./playerModel";

const DIRS: Record<string, { x: number; z: number }> = {
  KeyW: { x: 0, z: 1 },
  ArrowUp: { x: 0, z: 1 },
  KeyS: { x: 0, z: -1 },
  ArrowDown: { x: 0, z: -1 },
  KeyA: { x: 1, z: 0 },
  ArrowLeft: { x: 1, z: 0 },
  KeyD: { x: -1, z: 0 },
  ArrowRight: { x: -1, z: 0 },
};

const SHIFT = new Set(["ShiftLeft", "ShiftRight"]);
const PICK_AT = 0.32;

const FOOD_HOLD = { length: 0.16, pos: new THREE.Vector3(0, 0, 0), rot: new THREE.Euler(0.4, 0.2, 0.5) };
const KNIFE_HOLD = { length: 0.28, pos: new THREE.Vector3(0, 0, 0), rot: new THREE.Euler(0.2, 0.9, 1.2) };

const _holdBox = new THREE.Box3();
const _holdSize = new THREE.Vector3();
const _holdCenter = new THREE.Vector3();

function placeInGrip(grip: THREE.Object3D, mesh: THREE.Object3D, length: number, rot: THREE.Euler): void {
  grip.attach(mesh);
  mesh.rotation.copy(rot);
  mesh.position.set(0, 0, 0);
  mesh.updateWorldMatrix(true, true);
  _holdBox.setFromObject(mesh);
  _holdBox.getSize(_holdSize);
  const longest = Math.max(_holdSize.x, _holdSize.y, _holdSize.z, 1e-4);
  mesh.scale.multiplyScalar(length / longest);
  mesh.updateWorldMatrix(true, true);
  _holdBox.setFromObject(mesh);
  _holdBox.getCenter(_holdCenter);
  const local = grip.worldToLocal(_holdCenter);
  mesh.position.sub(local);
  mesh.visible = true;
  mesh.traverse((obj) => {
    obj.frustumCulled = false;
  });
}

export type HeldKind = "knife";
type LockKind = "meal" | "pickup" | "cut";

function smooth01(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
}

function crouchEnvelope(t: number, duration: number): number {
  const down = Math.min(0.4, duration * 0.45);
  const up = Math.min(0.4, duration * 0.45);
  if (t <= 0) return 0;
  if (t < down) return smooth01(t / down);
  if (t > duration - up) return smooth01((duration - t) / up);
  return 1;
}

export class GridPlayer {
  readonly mesh: THREE.Object3D;
  cellX: number;
  cellZ: number;
  canSprint = true;
  alive = true;
  busy = false;
  heldKind: HeldKind | null = null;
  gait: PlayerGait = "idle";
  private moving = false;
  private destWater = false;
  private sprinting = false;
  private stepSeconds = STEP_SECONDS_WALK;
  private t = 0;
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private pressed = new Set<string>();
  private lock: LockKind | null = null;
  private lockT = 0;
  private lockSeconds = 0;
  private tool: THREE.Object3D | null = null;
  private meal: THREE.Object3D | null = null;
  private grabbed = false;

  constructor(
    private biomes: Uint8Array,
    private blocked: Uint8Array,
    start: { x: number; z: number },
    private visual: PlayerVisual,
  ) {
    this.mesh = visual.root;
    this.cellX = start.x;
    this.cellZ = start.z;
    this.snap();

    window.addEventListener("keydown", (e) => {
      if (SHIFT.has(e.code)) this.sprinting = true;
      if (e.code in DIRS) {
        e.preventDefault();
        this.pressed.add(e.code);
      }
    });
    window.addEventListener("keyup", (e) => {
      if (SHIFT.has(e.code)) this.sprinting = false;
      this.pressed.delete(e.code);
    });
  }

  inWater(): boolean {
    return isInlandWater(this.cellX, this.cellZ, this.biomes);
  }

  faceToward(x: number, z: number): void {
    this.mesh.lookAt(x, this.mesh.position.y, z);
  }

  /** Returns `{ dropped }` on success; `dropped` is a previous knife left on this cell. */
  beginPickup(mesh: THREE.Object3D, seconds: number): { dropped: THREE.Object3D | null } | null {
    if (!this.alive || this.busy) return null;
    this.stopMoving();
    const dropped = this.detachToolToWorld();
    this.busy = true;
    this.lock = "pickup";
    this.lockT = 0;
    this.lockSeconds = seconds;
    this.meal = mesh;
    this.grabbed = false;
    this.gait = this.inWater() ? "swim" : "idle";
    this.visual.setGait(this.gait);
    return { dropped };
  }

  beginMeal(mesh: THREE.Object3D, seconds: number): boolean {
    if (!this.alive || this.busy) return false;
    this.stopMoving();
    this.busy = true;
    this.lock = "meal";
    this.lockT = 0;
    this.lockSeconds = seconds;
    this.meal = mesh;
    this.grabbed = false;
    if (this.tool) this.tool.visible = false;
    this.gait = this.inWater() ? "swim" : "idle";
    this.visual.setGait(this.gait);
    return true;
  }

  beginCut(mesh: THREE.Object3D, seconds: number): boolean {
    if (!this.alive || this.busy || this.heldKind !== "knife") return false;
    this.stopMoving();
    this.busy = true;
    this.lock = "cut";
    this.lockT = 0;
    this.lockSeconds = seconds;
    this.meal = mesh;
    this.grabbed = false;
    if (this.tool) this.tool.visible = true;
    this.gait = this.inWater() ? "swim" : "idle";
    this.visual.setGait(this.gait);
    return true;
  }

  private endLock(): void {
    if (this.lock === "meal" || this.lock === "cut") {
      this.meal?.removeFromParent();
      this.meal = null;
    }
    if (this.lock === "pickup" && this.meal && !this.grabbed) this.grabTool(this.meal);
    if (this.tool) this.tool.visible = true;
    this.meal = null;
    this.grabbed = false;
    this.busy = false;
    this.lock = null;
    this.lockT = 0;
    this.visual.setCrouch(0);
  }

  private grabTool(mesh: THREE.Object3D): void {
    placeInGrip(this.visual.grip, mesh, KNIFE_HOLD.length, KNIFE_HOLD.rot);
    this.tool = mesh;
    this.heldKind = "knife";
    this.meal = null;
  }

  private grabFood(mesh: THREE.Object3D): void {
    placeInGrip(this.visual.grip, mesh, FOOD_HOLD.length, FOOD_HOLD.rot);
    this.meal = mesh;
  }

  private detachToolToWorld(): THREE.Object3D | null {
    if (!this.tool) return null;
    const mesh = this.tool;
    const parent = this.mesh.parent;
    if (parent) parent.attach(mesh);
    else mesh.removeFromParent();
    mesh.position.set(this.cellX * CELL + CELL / 2, GROUND_Y + 0.04, this.cellZ * CELL + CELL / 2);
    mesh.rotation.set(0, 0.4, 0);
    mesh.visible = true;
    this.tool = null;
    this.heldKind = null;
    return mesh;
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

  private snap(): void {
    this.mesh.position.set(this.cellX * CELL + CELL / 2, 0, this.cellZ * CELL + CELL / 2);
  }

  private refreshGait(): PlayerGait {
    if (this.inWater() || (this.moving && this.destWater)) {
      this.gait = "swim";
      return this.gait;
    }
    if (!this.moving) {
      this.gait = "idle";
      return this.gait;
    }
    this.gait = this.sprinting && this.canSprint ? "run" : "walk";
    return this.gait;
  }

  private onLockTick(): void {
    if (this.lockT < PICK_AT || this.grabbed) return;
    this.grabbed = true;
    if (!this.meal) return;
    if (this.lock === "pickup") this.grabTool(this.meal);
    else if (this.lock === "meal") this.grabFood(this.meal);
    else if (this.lock === "cut") {
      this.meal.removeFromParent();
      this.meal = null;
    }
  }

  update(dt: number): void {
    this.visual.mixer.update(dt);

    if (!this.alive) {
      if (this.busy) this.endLock();
      this.moving = false;
      this.gait = "idle";
      this.visual.setGait("idle");
      this.visual.setCrouch(0);
      this.visual.setSwim(0);
      this.visual.applyPose();
      return;
    }

    const water = this.inWater();
    this.visual.setSwim(water && this.lock !== "meal" ? 1 : 0);

    if (this.busy) {
      this.lockT += dt;
      this.visual.setCrouch(crouchEnvelope(this.lockT, this.lockSeconds));
      this.onLockTick();
      this.visual.applyPose();
      this.gait = water ? "swim" : "idle";
      this.visual.setGait(this.gait);
      if (this.lockT >= this.lockSeconds) this.endLock();
      return;
    }

    this.visual.setCrouch(0);
    this.visual.applyPose();

    if (this.moving) {
      this.visual.setGait(this.refreshGait());
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

    for (const code of this.pressed) {
      const dir = DIRS[code];
      if (!dir) continue;
      const nx = this.cellX + dir.x;
      const nz = this.cellZ + dir.z;
      if (!canEnter(this.biomes, this.blocked, nx, nz)) continue;
      const intoWater = isInlandWater(nx, nz, this.biomes);
      this.destWater = intoWater;
      this.stepSeconds = intoWater
        ? STEP_SECONDS_SWIM
        : this.sprinting && this.canSprint
          ? STEP_SECONDS_RUN
          : STEP_SECONDS_WALK;
      this.from.copy(this.mesh.position);
      this.to.set(nx * CELL + CELL / 2, 0, nz * CELL + CELL / 2);
      this.t = 0;
      this.moving = true;
      this.mesh.lookAt(this.to.x, 0, this.to.z);
      this.visual.setGait(this.refreshGait());
      break;
    }

    if (!this.moving) this.visual.setGait(this.refreshGait());
  }

  followCamera(camera: THREE.PerspectiveCamera, offset: THREE.Vector3): void {
    const lookY = this.inWater() ? 0.45 : 1.1;
    const target = new THREE.Vector3(
      this.mesh.position.x + offset.x,
      this.mesh.position.y + offset.y,
      this.mesh.position.z + offset.z,
    );
    camera.position.lerp(target, 0.12);
    camera.lookAt(this.mesh.position.x, lookY, this.mesh.position.z);
  }
}
