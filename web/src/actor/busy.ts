import * as THREE from "three";
import type { PlayerGait, PlayerVisual } from "@/web/src/playerModel";

const PICK_AT = 0.32;

export type LockKind = "meal" | "cut" | "break" | "work";

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

export class BusyAction {
  busy = false;
  lock: LockKind | null = null;
  private lockT = 0;
  private lockSeconds = 0;
  private meal: THREE.Object3D | null = null;
  private mealScale = new THREE.Vector3(1, 1, 1);
  private grabbed = false;
  private onCutDone: (() => void) | null = null;
  private onCrack: (() => void) | null = null;
  private onMealEnd: (() => void) | null = null;
  private mealKeep = false;

  get mealMesh(): THREE.Object3D | null {
    return this.meal;
  }

  beginMeal(mesh: THREE.Object3D, seconds: number, onEnd?: () => void, keep = false): void {
    this.busy = true;
    this.lock = "meal";
    this.lockT = 0;
    this.lockSeconds = seconds;
    this.meal = mesh;
    this.grabbed = true;
    this.onMealEnd = onEnd ?? null;
    this.mealKeep = keep;
    mesh.visible = true;
    this.mealScale.copy(mesh.scale);
  }

  beginCut(seconds: number, onDone: () => void, held: THREE.Object3D | null): void {
    this.busy = true;
    this.lock = "cut";
    this.lockT = 0;
    this.lockSeconds = seconds;
    this.meal = null;
    this.grabbed = true;
    this.onCutDone = onDone;
    if (held) held.visible = true;
  }

  beginBreak(mesh: THREE.Object3D, seconds: number, onCrack: () => void, held: THREE.Object3D | null): void {
    this.busy = true;
    this.lock = "break";
    this.lockT = 0;
    this.lockSeconds = seconds;
    this.meal = mesh;
    this.grabbed = false;
    this.onCrack = onCrack;
    if (held) held.visible = true;
  }

  beginWork(seconds: number, onDone: () => void, held: THREE.Object3D | null): void {
    this.busy = true;
    this.lock = "work";
    this.lockT = 0;
    this.lockSeconds = seconds;
    this.meal = null;
    this.grabbed = true;
    this.onCutDone = onDone;
    if (held) held.visible = true;
  }

  tick(
    dt: number,
    visual: PlayerVisual,
    water: boolean,
    onMealMeshGone: (mesh: THREE.Object3D) => void,
  ): PlayerGait {
    this.lockT += dt;
    if (this.lock === "meal") {
      visual.setCrouch(0);
      if (this.meal && !this.mealKeep) {
        const u = Math.min(1, this.lockT / Math.max(0.001, this.lockSeconds));
        this.meal.scale.copy(this.mealScale).multiplyScalar(Math.max(0.08, 1 - u));
      }
    } else {
      visual.setCrouch(crouchEnvelope(this.lockT, this.lockSeconds));
    }
    this.onLockTick();
    visual.applyPose();
    const gait: PlayerGait = water ? "swim" : "idle";
    visual.setGait(gait);
    if (this.lockT >= this.lockSeconds) this.end(onMealMeshGone, visual);
    return gait;
  }

  cancel(onMealMeshGone: (mesh: THREE.Object3D) => void, visual: PlayerVisual): void {
    if (this.busy) this.end(onMealMeshGone, visual);
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

  private end(onMealMeshGone: (mesh: THREE.Object3D) => void, visual: PlayerVisual): void {
    const finished = this.lockT >= this.lockSeconds;
    const lock = this.lock;
    if (lock === "meal") {
      if (this.mealKeep && this.meal) {
        this.meal.scale.copy(this.mealScale);
        this.mealKeep = false;
      } else if (this.meal) {
        onMealMeshGone(this.meal);
        this.meal.removeFromParent();
      }
      this.meal = null;
      const ended = this.onMealEnd;
      this.onMealEnd = null;
      ended?.();
    }
    if (lock === "cut" && finished) this.onCutDone?.();
    if (lock === "work" && finished) this.onCutDone?.();
    this.meal = null;
    this.grabbed = false;
    this.busy = false;
    this.lock = null;
    this.lockT = 0;
    this.onCutDone = null;
    this.onCrack = null;
    visual.setCrouch(0);
  }
}
