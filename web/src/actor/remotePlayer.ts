import * as THREE from "three";
import { CELL } from "@/web/src/constants";
import type { Appearance } from "@/web/src/appearance";
import { equipHeld } from "@/web/src/actor/inventory";
import { loadPlayerModel, type PlayerGait, type PlayerVisual } from "@/web/src/playerModel";
import type { NetPlayer } from "@/web/src/net/protocol";
import { cloneHeld } from "@/web/src/props";
import type { HeldKind } from "@/web/src/world/kinds";

function lerpAngle(from: number, to: number, t: number): number {
  return from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * t;
}

export class RemotePlayer {
  visual: PlayerVisual | null = null;
  private loading = false;
  private appearanceKey = "";
  private target = new THREE.Vector3();
  private heldKind: HeldKind | null | undefined = undefined;
  private held: THREE.Object3D | null = null;
  private hasYaw = false;

  constructor(readonly uid: string) {}

  get heldMesh(): THREE.Object3D | null {
    return this.held;
  }

  async ensure(scene: THREE.Scene, appearance: Appearance): Promise<void> {
    const key = `${appearance.gender}:${appearance.skin}:${appearance.clothes}`;
    if (this.visual && this.appearanceKey === key) return;
    if (this.loading) return;
    this.loading = true;
    try {
      const visual = await loadPlayerModel(appearance);
      this.clearHeld();
      this.visual?.root.removeFromParent();
      this.visual = visual;
      this.appearanceKey = key;
      this.heldKind = undefined;
      this.hasYaw = false;
      visual.root.name = `remote-${this.uid}`;
      scene.add(visual.root);
    } finally {
      this.loading = false;
    }
  }

  apply(net: NetPlayer, dt: number): void {
    if (!this.visual) return;
    this.target.set(net.cellX * CELL + CELL / 2, 0, net.cellZ * CELL + CELL / 2);
    this.visual.root.position.lerp(this.target, Math.min(1, dt * 8));
    if (typeof net.yaw === "number" && Number.isFinite(net.yaw)) {
      if (!this.hasYaw) {
        this.visual.root.rotation.y = net.yaw;
        this.hasYaw = true;
      } else {
        this.visual.root.rotation.y = lerpAngle(this.visual.root.rotation.y, net.yaw, Math.min(1, dt * 8));
      }
    } else {
      const dx = this.target.x - this.visual.root.position.x;
      const dz = this.target.z - this.visual.root.position.z;
      if (dx * dx + dz * dz > 0.01) this.visual.root.lookAt(this.target.x, 0, this.target.z);
    }
    const gait: PlayerGait = net.alive ? net.gait : "idle";
    this.visual.setGait(gait);
    this.visual.mixer.update(dt);
    this.visual.setCrouch(0);
    this.visual.setSwim(gait === "swim" ? 1 : 0);
    this.visual.applyPose();
    this.visual.root.visible = net.alive;
    this.syncHeld(net.heldKind ?? null);
  }

  dispose(): void {
    this.clearHeld();
    this.visual?.root.removeFromParent();
    this.visual = null;
  }

  private syncHeld(kind: HeldKind | null): void {
    if (!this.visual) return;
    if (this.heldKind === kind && (kind === null || this.held)) return;
    this.clearHeld();
    this.heldKind = kind;
    if (!kind) return;
    const mesh = cloneHeld(kind);
    if (!mesh) return;
    equipHeld(this.visual.grip, mesh, kind);
    this.held = mesh;
  }

  private clearHeld(): void {
    this.held?.removeFromParent();
    this.held = null;
  }
}
