import * as THREE from "three";
import { CAMERA_OFFSET, CELL, STEP_SECONDS } from "./constants";
import { isWalkable } from "./gridOverlay";

const DIRS: Record<string, { x: number; z: number }> = {
  KeyW: { x: 0, z: 1 },
  ArrowUp: { x: 0, z: 1 },
  KeyS: { x: 0, z: -1 },
  ArrowDown: { x: 0, z: -1 },
  KeyA: { x: -1, z: 0 },
  ArrowLeft: { x: -1, z: 0 },
  KeyD: { x: 1, z: 0 },
  ArrowRight: { x: 1, z: 0 },
};

export class GridPlayer {
  readonly mesh: THREE.Object3D;
  cellX: number;
  cellZ: number;
  private moving = false;
  private t = 0;
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private pressed = new Set<string>();

  constructor(
    private biomes: Uint8Array,
    private blocked: Uint8Array,
    start: { x: number; z: number },
  ) {
    const geo = new THREE.CapsuleGeometry(0.28, 0.9, 4, 10);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf0d2a8,
      roughness: 0.7,
      metalness: 0,
    });
    const body = new THREE.Mesh(geo, mat);
    body.castShadow = true;
    body.position.y = 0.73;
    const wrap = new THREE.Group();
    wrap.add(body);
    this.mesh = wrap;
    this.cellX = start.x;
    this.cellZ = start.z;
    this.snap();

    window.addEventListener("keydown", (e) => {
      if (e.code in DIRS) {
        e.preventDefault();
        this.pressed.add(e.code);
      }
    });
    window.addEventListener("keyup", (e) => {
      this.pressed.delete(e.code);
    });
  }

  private snap(): void {
    this.mesh.position.set(this.cellX * CELL + CELL / 2, 0, this.cellZ * CELL + CELL / 2);
  }

  update(dt: number): void {
    if (this.moving) {
      this.t += dt / STEP_SECONDS;
      const u = Math.min(1, this.t);
      const s = u * u * (3 - 2 * u);
      this.mesh.position.lerpVectors(this.from, this.to, s);
      if (u >= 1) {
        this.moving = false;
        this.cellX = Math.round(this.to.x - CELL / 2);
        this.cellZ = Math.round(this.to.z - CELL / 2);
        this.snap();
      }
      return;
    }

    for (const code of this.pressed) {
      const dir = DIRS[code];
      if (!dir) continue;
      const nx = this.cellX + dir.x;
      const nz = this.cellZ + dir.z;
      if (!isWalkable(this.biomes, this.blocked, nx, nz)) continue;
      this.from.copy(this.mesh.position);
      this.to.set(nx * CELL + CELL / 2, 0, nz * CELL + CELL / 2);
      this.t = 0;
      this.moving = true;
      this.mesh.lookAt(this.to.x, 0, this.to.z);
      break;
    }
  }

  followCamera(camera: THREE.PerspectiveCamera): void {
    const target = new THREE.Vector3(
      this.mesh.position.x + CAMERA_OFFSET.x,
      this.mesh.position.y + CAMERA_OFFSET.y,
      this.mesh.position.z + CAMERA_OFFSET.z,
    );
    camera.position.lerp(target, 0.12);
    camera.lookAt(this.mesh.position.x, 1.1, this.mesh.position.z);
  }
}
