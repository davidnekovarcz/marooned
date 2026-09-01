import * as THREE from "three";
import { CELL, STEP_SECONDS_RUN, STEP_SECONDS_WALK } from "./constants";
import { isWalkable } from "./gridOverlay";
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

function smooth01(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
}

function crouchEnvelope(t: number, duration: number): number {
  const down = 0.4;
  const up = 0.4;
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
  gait: PlayerGait = "idle";
  private moving = false;
  private sprinting = false;
  private stepSeconds = STEP_SECONDS_WALK;
  private t = 0;
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private pressed = new Set<string>();
  private mealT = 0;
  private mealSeconds = 0;
  private held: THREE.Object3D | null = null;
  private picked = false;

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

  faceToward(x: number, z: number): void {
    this.mesh.lookAt(x, this.mesh.position.y, z);
  }

  beginMeal(mesh: THREE.Object3D, seconds: number): boolean {
    if (!this.alive || this.busy) return false;
    this.stopMoving();
    this.busy = true;
    this.mealT = 0;
    this.mealSeconds = seconds;
    this.held = mesh;
    this.picked = false;
    this.gait = "idle";
    this.visual.setGait("idle");
    return true;
  }

  private endMeal(): void {
    this.held?.removeFromParent();
    this.held = null;
    this.picked = false;
    this.busy = false;
    this.mealT = 0;
    this.visual.setCrouch(0);
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
    if (!this.moving) {
      this.gait = "idle";
      return this.gait;
    }
    this.gait = this.sprinting && this.canSprint ? "run" : "walk";
    return this.gait;
  }

  private pickUp(): void {
    if (this.picked || !this.held) return;
    this.picked = true;
    const hand = this.visual.leftHand;
    if (!hand) {
      this.held.removeFromParent();
      this.held = null;
      return;
    }
    hand.attach(this.held);
    this.held.position.set(0.05, 0.02, 0.1);
    this.held.rotation.set(0.5, 0.3, 0.8);
  }

  update(dt: number): void {
    this.visual.mixer.update(dt);

    if (!this.alive) {
      if (this.busy) this.endMeal();
      this.moving = false;
      this.gait = "idle";
      this.visual.setGait("idle");
      this.visual.setCrouch(0);
      this.visual.applyPose();
      return;
    }

    if (this.busy) {
      this.mealT += dt;
      this.visual.setCrouch(crouchEnvelope(this.mealT, this.mealSeconds));
      if (this.mealT >= PICK_AT) this.pickUp();
      this.visual.applyPose();
      this.gait = "idle";
      this.visual.setGait("idle");
      if (this.mealT >= this.mealSeconds) this.endMeal();
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

    const sprint = this.sprinting && this.canSprint;
    for (const code of this.pressed) {
      const dir = DIRS[code];
      if (!dir) continue;
      const nx = this.cellX + dir.x;
      const nz = this.cellZ + dir.z;
      if (!isWalkable(this.biomes, this.blocked, nx, nz)) continue;
      this.stepSeconds = sprint ? STEP_SECONDS_RUN : STEP_SECONDS_WALK;
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
    const target = new THREE.Vector3(
      this.mesh.position.x + offset.x,
      this.mesh.position.y + offset.y,
      this.mesh.position.z + offset.z,
    );
    camera.position.lerp(target, 0.12);
    camera.lookAt(this.mesh.position.x, 1.1, this.mesh.position.z);
  }
}
