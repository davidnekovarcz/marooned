import * as THREE from "three";
import { CELL, GROUND_Y, STEP_SECONDS_RUN, STEP_SECONDS_SWIM, STEP_SECONDS_WALK } from "./constants";
import { canEnter } from "./gridOverlay";
import { isInlandWater } from "./island";
import type { PlayerGait, PlayerVisual } from "./playerModel";
import { fitAndPlant, specFor } from "./scale";

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

export type HeldKind =
  | "knife"
  | "hammer"
  | "axe"
  | "shovel"
  | "torch"
  | "tinder"
  | "coconutHalf"
  | "orange"
  | "pineapple"
  | "banana"
  | "lemon"
  | "watermelon";
export type PocketSlot = "left" | "right";
type LockKind = "meal" | "cut" | "break";
type PocketItem = { kind: HeldKind; mesh: THREE.Object3D };

const FOOD_HOLD = { rot: new THREE.Euler(0.4, 0.2, 0.5) };
const PINEAPPLE_HOLD = { rot: new THREE.Euler(0.35, 0.15, 0.45) };
const TOOL_HOLD: Record<"knife" | "hammer" | "axe" | "shovel" | "torch", { length: number; rot: THREE.Euler }> = {
  knife: { length: 0.28, rot: new THREE.Euler(0.2, 0.9, 1.2) },
  hammer: { length: 0.36, rot: new THREE.Euler(0.15, 0.7, 1.05) },
  axe: { length: 0.42, rot: new THREE.Euler(0.12, 0.65, 1.08) },
  shovel: { length: 0.48, rot: new THREE.Euler(0.1, 0.6, 1.05) },
  torch: { length: 0.38, rot: new THREE.Euler(0.12, 0.65, 1.1) },
};

const HELD_FOOD = new Set<HeldKind>([
  "coconutHalf",
  "orange",
  "pineapple",
  "banana",
  "lemon",
  "watermelon",
]);

export function isHeldFood(
  kind: HeldKind | null,
): kind is "coconutHalf" | "orange" | "pineapple" | "banana" | "lemon" | "watermelon" {
  return kind !== null && HELD_FOOD.has(kind);
}

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

/** `length` null keeps the mesh's world size (food while eating). */
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
  private mealScale = new THREE.Vector3(1, 1, 1);
  private grabbed = false;
  private pockets: Record<PocketSlot, PocketItem | null> = { left: null, right: null };
  private pocketGroup = new THREE.Group();
  private onCutDone: (() => void) | null = null;
  private onCrack: (() => void) | null = null;
  private onMealEnd: (() => void) | null = null;

  constructor(
    private biomes: Uint8Array,
    private blocked: Uint8Array,
    start: { x: number; z: number },
    private visual: PlayerVisual,
  ) {
    this.mesh = visual.root;
    this.cellX = start.x;
    this.cellZ = start.z;
    this.pocketGroup.name = "pockets";
    this.pocketGroup.visible = false;
    this.mesh.add(this.pocketGroup);
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

  pocket(slot: PocketSlot): HeldKind | null {
    return this.pockets[slot]?.kind ?? null;
  }

  /** Stow the held tool into the first empty pocket. */
  stowHeld(): boolean {
    if (!this.tool || !this.heldKind) return false;
    const slot: PocketSlot | null = !this.pockets.left ? "left" : !this.pockets.right ? "right" : null;
    if (!slot) return false;
    this.hideInPocket(slot, { kind: this.heldKind, mesh: this.tool });
    this.tool = null;
    this.heldKind = null;
    return true;
  }

  /** Swap the named pocket with whatever is in the hands. */
  swapPocket(slot: PocketSlot): boolean {
    if (!this.alive || this.busy) return false;
    const pocket = this.pockets[slot];
    const hand: PocketItem | null = this.tool && this.heldKind ? { kind: this.heldKind, mesh: this.tool } : null;
    if (!pocket && !hand) return false;
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

  dropHeld(): { mesh: THREE.Object3D; kind: HeldKind } | null {
    return this.detachToolToWorld();
  }

  /** Instant — no crouch. Previous held item stows or drops. */
  pickup(mesh: THREE.Object3D, kind: HeldKind): { dropped: { mesh: THREE.Object3D; kind: HeldKind } | null } | null {
    if (!this.alive || this.busy) return null;
    let dropped: { mesh: THREE.Object3D; kind: HeldKind } | null = null;
    if (this.tool && this.heldKind && !this.stowHeld()) dropped = this.detachToolToWorld();
    this.grabHeld(mesh, kind);
    return { dropped };
  }

  /** Eat whatever food is already in the hands. */
  beginHeldMeal(seconds: number, onEnd?: () => void): boolean {
    if (!this.alive || this.busy || !this.tool || !isHeldFood(this.heldKind)) return false;
    this.stopMoving();
    this.busy = true;
    this.lock = "meal";
    this.lockT = 0;
    this.lockSeconds = seconds;
    this.meal = this.tool;
    this.grabbed = true;
    this.onMealEnd = onEnd ?? null;
    this.tool.visible = true;
    this.mealScale.copy(this.tool.scale);
    this.gait = this.inWater() ? "swim" : "idle";
    this.visual.setGait(this.gait);
    return true;
  }

  beginCut(seconds: number, onDone: () => void): boolean {
    if (!this.alive || this.busy || this.heldKind !== "knife") return false;
    this.stopMoving();
    this.busy = true;
    this.lock = "cut";
    this.lockT = 0;
    this.lockSeconds = seconds;
    this.meal = null;
    this.grabbed = true;
    this.onCutDone = onDone;
    if (this.tool) this.tool.visible = true;
    this.gait = this.inWater() ? "swim" : "idle";
    this.visual.setGait(this.gait);
    return true;
  }

  beginBreak(mesh: THREE.Object3D, seconds: number, onCrack: () => void): boolean {
    if (!this.alive || this.busy || this.heldKind !== "hammer") return false;
    this.stopMoving();
    this.busy = true;
    this.lock = "break";
    this.lockT = 0;
    this.lockSeconds = seconds;
    this.meal = mesh;
    this.grabbed = false;
    this.onCrack = onCrack;
    if (this.tool) this.tool.visible = true;
    this.gait = this.inWater() ? "swim" : "idle";
    this.visual.setGait(this.gait);
    return true;
  }

  private endLock(): void {
    const finished = this.lockT >= this.lockSeconds;
    const lock = this.lock;
    if (lock === "meal") {
      if (this.tool === this.meal) {
        this.tool = null;
        this.heldKind = null;
      }
      this.meal?.removeFromParent();
      this.meal = null;
      const ended = this.onMealEnd;
      this.onMealEnd = null;
      ended?.();
    }
    if (lock === "cut" && finished) this.onCutDone?.();
    if (this.tool) this.tool.visible = true;
    this.meal = null;
    this.grabbed = false;
    this.busy = false;
    this.lock = null;
    this.lockT = 0;
    this.onCutDone = null;
    this.onCrack = null;
    this.visual.setCrouch(0);
  }

  private grabHeld(mesh: THREE.Object3D, kind: HeldKind): void {
    const hold = poseFor(kind);
    placeInGrip(this.visual.grip, mesh, hold.length, hold.rot);
    this.tool = mesh;
    this.heldKind = kind;
    this.meal = null;
  }

  private hideInPocket(slot: PocketSlot, item: PocketItem): void {
    this.pocketGroup.attach(item.mesh);
    item.mesh.visible = false;
    this.pockets[slot] = item;
  }

  private detachToolToWorld(): { mesh: THREE.Object3D; kind: HeldKind } | null {
    if (!this.tool || !this.heldKind) return null;
    const mesh = this.tool;
    const kind = this.heldKind;
    const parent = this.mesh.parent;
    if (parent) parent.attach(mesh);
    else mesh.removeFromParent();
    mesh.position.set(this.cellX * CELL + CELL / 2, GROUND_Y, this.cellZ * CELL + CELL / 2);
    mesh.rotation.set(0, 0.4, 0);
    fitAndPlant(mesh, specFor(kind), GROUND_Y);
    mesh.visible = true;
    this.tool = null;
    this.heldKind = null;
    return { mesh, kind };
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
    if (this.lock === "break") {
      this.meal.removeFromParent();
      this.meal = null;
      this.onCrack?.();
      this.onCrack = null;
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
      if (this.lock === "meal") {
        this.visual.setCrouch(0);
        if (this.meal) {
          const u = Math.min(1, this.lockT / Math.max(0.001, this.lockSeconds));
          this.meal.scale.copy(this.mealScale).multiplyScalar(Math.max(0.08, 1 - u));
        }
      } else {
        this.visual.setCrouch(crouchEnvelope(this.lockT, this.lockSeconds));
      }
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
