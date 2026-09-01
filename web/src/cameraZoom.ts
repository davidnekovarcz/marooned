import * as THREE from "three";
import {
  CAMERA_OFFSET,
  CELL,
  ISLAND_RADIUS,
  ZOOM_CELLS_IN,
  ZOOM_CELLS_OUT,
  ZOOM_CELLS_PER_SEC,
  ZOOM_CELLS_START,
} from "./constants";

function isZoomIn(e: KeyboardEvent): boolean {
  return e.key === "+" || e.key === "=" || e.code === "NumpadAdd";
}

function isZoomOut(e: KeyboardEvent): boolean {
  return e.key === "-" || e.key === "_" || e.code === "NumpadSubtract";
}

export class CameraZoom {
  cells = ZOOM_CELLS_START;
  private dir = 0;

  constructor() {
    window.addEventListener("keydown", (e) => {
      if (isZoomIn(e)) {
        e.preventDefault();
        this.dir = -1;
      } else if (isZoomOut(e)) {
        e.preventDefault();
        this.dir = 1;
      }
    });
    window.addEventListener("keyup", (e) => {
      if (isZoomIn(e) && this.dir < 0) this.dir = 0;
      if (isZoomOut(e) && this.dir > 0) this.dir = 0;
    });
  }

  update(dt: number): void {
    if (this.dir === 0) return;
    this.cells = THREE.MathUtils.clamp(
      this.cells + this.dir * ZOOM_CELLS_PER_SEC * dt,
      ZOOM_CELLS_IN,
      ZOOM_CELLS_OUT,
    );
  }
}

export function offsetForZoom(camera: THREE.PerspectiveCamera, cells: number): THREE.Vector3 {
  const dir = new THREE.Vector3(CAMERA_OFFSET.x, CAMERA_OFFSET.y, CAMERA_OFFSET.z).normalize();
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const dist =
    (cells * CELL) / (2 * Math.max(0.25, dir.y) * Math.tan(vFov / 2) * camera.aspect);
  return dir.multiplyScalar(dist);
}

export function applyZoomFog(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  dist: number,
  cells: number,
): void {
  camera.far = Math.max(420, dist + ISLAND_RADIUS * 3);
  camera.updateProjectionMatrix();
  if (!(scene.fog instanceof THREE.Fog)) return;
  const t = THREE.MathUtils.clamp(
    (cells - ZOOM_CELLS_IN) / (ZOOM_CELLS_OUT - ZOOM_CELLS_IN),
    0,
    1,
  );
  // t=0 zoomed in: fog starts beyond the close view. t=1 zoomed out: haze over the island.
  scene.fog.near = THREE.MathUtils.lerp(dist * 2.4, dist * 0.22, t);
  scene.fog.far = THREE.MathUtils.lerp(dist * 9, dist * 1.05, t);
}
