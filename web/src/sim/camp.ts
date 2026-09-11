import * as THREE from "three";
import { HEARTH_USE_CELLS, HEARTH_WARM_CELLS, SHELTER_CELLS } from "@/web/src/constants";
import type { GridPlayer } from "@/web/src/actor/player";
import type { Item } from "@/web/src/world/item";
import type { HeldKind } from "@/web/src/world/kinds";

const HEARTH_KINDS = new Set(["campfire", "campfireLogs", "campfireStones"]);

export type Hearth = {
  item: Item;
  lit: boolean;
};

function chebyshev(ax: number, az: number, bx: number, bz: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(az - bz));
}

export function cellDist(ax: number, az: number, bx: number, bz: number): number {
  return chebyshev(ax, az, bx, bz);
}

export class Camp {
  readonly hearths: Hearth[] = [];
  readonly shelters: { x: number; z: number }[] = [];

  scan(items: Item[]): void {
    this.hearths.length = 0;
    for (const item of items) {
      if (HEARTH_KINDS.has(item.kind)) this.hearths.push({ item, lit: false });
    }
  }

  nearestHearth(x: number, z: number, max = HEARTH_USE_CELLS): Hearth | null {
    let best: Hearth | null = null;
    let bestD = max;
    for (const h of this.hearths) {
      const d = chebyshev(x, z, h.item.cellX, h.item.cellZ);
      if (d <= bestD) {
        best = h;
        bestD = d;
      }
    }
    return best;
  }

  warmthAt(x: number, z: number): number {
    let best = 0;
    for (const h of this.hearths) {
      if (!h.lit) continue;
      const d = chebyshev(x, z, h.item.cellX, h.item.cellZ);
      if (d > HEARTH_WARM_CELLS) continue;
      best = Math.max(best, 1 - d / (HEARTH_WARM_CELLS + 0.01));
    }
    return best;
  }

  covered(x: number, z: number): boolean {
    for (const s of this.shelters) {
      if (chebyshev(x, z, s.x, s.z) <= SHELTER_CELLS) return true;
    }
    return false;
  }

  light(hearth: Hearth): void {
    hearth.lit = true;
  }

  douse(hearth: Hearth): void {
    hearth.lit = false;
  }

  /** Rain kills unsheltered flames. A lean-to over the hearth keeps it lit. */
  douseExposed(): void {
    for (const h of this.hearths) {
      if (!h.lit) continue;
      if (this.covered(h.item.cellX, h.item.cellZ)) continue;
      this.douse(h);
    }
  }

  addShelter(x: number, z: number): void {
    this.shelters.push({ x, z });
  }

  worldPos(hearth: Hearth): THREE.Vector3 {
    return new THREE.Vector3(
      hearth.item.mesh.position.x,
      hearth.item.mesh.position.y + 0.35,
      hearth.item.mesh.position.z,
    );
  }
}

export function countNearby(
  kind: HeldKind,
  player: GridPlayer,
  items: Item[],
  x: number,
  z: number,
): number {
  let n = 0;
  if (player.inventory.pocket("left") === kind) n += 1;
  if (player.inventory.pocket("right") === kind) n += 1;
  for (const it of items) {
    if (it.kind !== kind) continue;
    if (chebyshev(x, z, it.cellX, it.cellZ) > 1) continue;
    n += 1;
  }
  return n;
}

export function takeNearby(
  kind: HeldKind,
  n: number,
  player: GridPlayer,
  items: Item[],
  x: number,
  z: number,
  onRemoved?: (item: Item) => void,
): boolean {
  if (countNearby(kind, player, items, x, z) < n) return false;
  let need = n;
  for (const it of [...items]) {
    if (need <= 0) break;
    if (it.kind !== kind) continue;
    if (chebyshev(x, z, it.cellX, it.cellZ) > 1) continue;
    it.mesh.removeFromParent();
    const i = items.indexOf(it);
    if (i >= 0) items.splice(i, 1);
    onRemoved?.(it);
    need -= 1;
  }
  for (const slot of ["left", "right"] as const) {
    if (need <= 0) break;
    if (player.inventory.pocket(slot) !== kind) continue;
    player.inventory.clearPocket(slot);
    need -= 1;
  }
  return need === 0;
}
