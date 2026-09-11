import type { Object3D } from "three";
import { defaultPrep, isFoodKind, writeFoodState, type FoodPrep, type Freshness } from "@/web/src/food";
import type { ModelKind } from "@/web/src/models";
import type { WorldKind } from "@/web/src/world/kinds";

export type { WorldKind } from "@/web/src/world/kinds";

/** Serializable slice — never includes a mesh. */
export type ItemSnapshot = {
  id: string;
  kind: WorldKind;
  cellX: number;
  cellZ: number;
  prep?: FoodPrep;
  freshness?: Freshness;
};

export type SpawnFn = (
  kind: ModelKind | "torch" | "tomato",
  x: number,
  z: number,
  extra?: { yaw?: number; dx?: number; dz?: number },
) => Item | null;

let nextId = 1;

export class Item {
  readonly id: string;
  loot = false;

  constructor(
    public kind: WorldKind,
    public cellX: number,
    public cellZ: number,
    public mesh: Object3D,
    public prep?: FoodPrep,
    public freshness?: Freshness,
  ) {
    this.id = `item-${nextId}`;
    nextId += 1;
    if (isFoodKind(kind)) this.applyFoodState();
  }

  applyFoodState(prep?: FoodPrep, freshness?: Freshness): void {
    if (!isFoodKind(this.kind)) return;
    this.prep = prep ?? this.prep ?? defaultPrep(this.kind);
    this.freshness = freshness ?? this.freshness ?? "fresh";
    writeFoodState(this.mesh, this.prep, this.freshness);
  }

  snapshot(): ItemSnapshot {
    return {
      id: this.id,
      kind: this.kind,
      cellX: this.cellX,
      cellZ: this.cellZ,
      prep: this.prep,
      freshness: this.freshness,
    };
  }
}

export function makeWorldItem(kind: WorldKind, cellX: number, cellZ: number, mesh: Object3D): Item {
  return new Item(kind, cellX, cellZ, mesh);
}
