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

export class GridPlayer {
  readonly mesh: THREE.Object3D;
  cellX: number;
  cellZ: number;
  canSprint = true;
  alive = true;
  gait: PlayerGait = "idle";
  private moving = false;
  private sprinting = false;
  private stepSeconds = STEP_SECONDS_WALK;
  private t = 0;
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private pressed = new Set<string>();

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

  update(dt: number): void {
    this.visual.mixer.update(dt);
    if (!this.alive) {
      this.moving = false;
      this.gait = "idle";
      this.visual.setGait("idle");
      return;
    }

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
