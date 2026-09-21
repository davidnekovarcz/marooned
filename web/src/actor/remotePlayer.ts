import * as THREE from "three";
import { CELL } from "@/web/src/constants";
import type { Appearance } from "@/web/src/appearance";
import { loadPlayerModel, type PlayerGait, type PlayerVisual } from "@/web/src/playerModel";
import type { NetPlayer } from "@/web/src/net/protocol";

export class RemotePlayer {
  visual: PlayerVisual | null = null;
  private loading = false;
  private appearanceKey = "";
  private target = new THREE.Vector3();

  constructor(readonly uid: string) {}

  async ensure(scene: THREE.Scene, appearance: Appearance): Promise<void> {
    const key = `${appearance.gender}:${appearance.skin}:${appearance.clothes}`;
    if (this.visual && this.appearanceKey === key) return;
    if (this.loading) return;
    this.loading = true;
    try {
      const visual = await loadPlayerModel(appearance);
      this.visual?.root.removeFromParent();
      this.visual = visual;
      this.appearanceKey = key;
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
    const dx = this.target.x - this.visual.root.position.x;
    const dz = this.target.z - this.visual.root.position.z;
    if (dx * dx + dz * dz > 0.01) this.visual.root.lookAt(this.target.x, 0, this.target.z);
    const gait: PlayerGait = net.alive ? net.gait : "idle";
    this.visual.setGait(gait);
    this.visual.mixer.update(dt);
    this.visual.setCrouch(0);
    this.visual.setSwim(gait === "swim" ? 1 : 0);
    this.visual.applyPose();
    this.visual.root.visible = net.alive;
  }

  dispose(): void {
    this.visual?.root.removeFromParent();
    this.visual = null;
  }
}
