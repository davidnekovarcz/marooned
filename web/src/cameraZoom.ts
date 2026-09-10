import * as THREE from "three";
import {
  CAMERA_OFFSET,
  CELL,
  FOG_DAWN_SCALE,
  FOG_NIGHT_SCALE,
  ISLAND_RADIUS,
  ZOOM_CELLS_IN,
  ZOOM_CELLS_OUT,
  ZOOM_CELLS_PER_SEC,
  ZOOM_CELLS_START,
} from "@/web/src/constants";
import { sunElevation } from "@/web/src/dayNight";

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
  dayT: number,
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
  let near = THREE.MathUtils.lerp(dist * 2.4, dist * 0.22, t);
  let far = THREE.MathUtils.lerp(dist * 9, dist * 1.05, t);

  const elev = sunElevation(dayT);
  const night = THREE.MathUtils.clamp(-elev, 0, 1);
  const dawn = elev > 0 ? THREE.MathUtils.clamp(1 - elev / 0.28, 0, 1) : 0;
  const vis = THREE.MathUtils.lerp(1, FOG_NIGHT_SCALE, night) * THREE.MathUtils.lerp(1, FOG_DAWN_SCALE, dawn);
  scene.fog.near = near * vis;
  scene.fog.far = Math.max(near * vis + 8, far * vis);
}
