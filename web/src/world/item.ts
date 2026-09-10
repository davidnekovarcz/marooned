import type { Object3D } from "three";
import { defaultPrep, isFoodKind, writeFoodState, type FoodPrep, type Freshness } from "@/web/src/food";
import type { ModelKind } from "@/web/src/models";
import type { WorldKind } from "@/web/src/world/kinds";

export type { WorldKind } from "@/web/src/world/kinds";

export type Item = {
  id: string;
  kind: WorldKind;
  cellX: number;
  cellZ: number;
  mesh: Object3D;
  prep?: FoodPrep;
  freshness?: Freshness;
  loot?: boolean;
};

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

export function makeItemId(): string {
  const id = `item-${nextId}`;
  nextId += 1;
  return id;
}

export function applyFoodState(item: Item, prep?: FoodPrep, freshness?: Freshness): void {
  if (!isFoodKind(item.kind)) return;
  item.prep = prep ?? item.prep ?? defaultPrep(item.kind);
  item.freshness = freshness ?? item.freshness ?? "fresh";
  writeFoodState(item.mesh, item.prep, item.freshness);
}

export function makeWorldItem(kind: WorldKind, cellX: number, cellZ: number, mesh: Object3D): Item {
  const item: Item = {
    id: makeItemId(),
    kind,
    cellX,
    cellZ,
    mesh,
  };
  if (isFoodKind(kind)) applyFoodState(item);
  return item;
}

export function itemSnapshot(item: Item): ItemSnapshot {
  return {
    id: item.id,
    kind: item.kind,
    cellX: item.cellX,
    cellZ: item.cellZ,
    prep: item.prep,
    freshness: item.freshness,
  };
}

/** @deprecated Use Item. Kept so call sites can migrate in one pass. */
export type WorldItem = Item;
