import type { Object3D } from "three";
import {
  EAT_COCONUT_HUNGER,
  EAT_COCONUT_THIRST,
  EAT_DRINK_HOLE_HUNGER,
  EAT_DRINK_HOLE_THIRST,
  EAT_FRUIT_HUNGER,
  EAT_FRUIT_THIRST,
} from "@/web/src/constants";
import { defaultPrep, isFoodKind, readFoodFreshness, readFoodPrep, type FoodPrep } from "@/web/src/food";
import type { Item, WorldKind } from "@/web/src/world/item";
import { isHeldFood, type HeldKind } from "@/web/src/world/kinds";

export type ActionId = "eat" | "drink" | "peel" | "slice" | "split" | "open" | "pickup";
export type BlockedId = "rotten" | "needKnife" | "needHammer" | "needKnifeOrHammer";

export type ResolvedAction = {
  id: ActionId;
  blocked?: BlockedId;
  meal?: { hunger: number; thirst: number };
  pickup?: HeldKind;
  needsHeld?: HeldKind;
  cut?: boolean;
  crack?: boolean;
  eatHeld?: boolean;
  drinkHeld?: boolean;
  poison?: boolean;
  keepHeld?: boolean;
};

const PICKUP: Record<string, HeldKind> = {
  coconut: "coconut",
  coconutHalf: "coconutHalf",
  orange: "orange",
  banana: "banana",
  lemon: "lemon",
  watermelon: "watermelon",
  pineapple: "pineapple",
  tomato: "tomato",
  mushroomTan: "mushroomTan",
  mushroomRed: "mushroomRed",
  knife: "knife",
  hammer: "hammer",
  axe: "axe",
  shovel: "shovel",
  torch: "torch",
  tinder: "tinder",
};

const fruitEat: ResolvedAction = {
  id: "eat",
  eatHeld: true,
  meal: { hunger: EAT_FRUIT_HUNGER, thirst: EAT_FRUIT_THIRST },
};

function pickupOf(kind: WorldKind): ResolvedAction | undefined {
  const pickup = PICKUP[kind];
  if (!pickup) return undefined;
  return { id: "pickup", pickup };
}

function itemPrep(item: Item): FoodPrep {
  if (item.prep) return item.prep;
  if (isFoodKind(item.kind)) return defaultPrep(item.kind);
  return "ready";
}

export function actionEnabled(action: ResolvedAction | undefined): boolean {
  return Boolean(action && !action.blocked);
}

export function resolveWorldAction(item: Item, held: HeldKind | null): ResolvedAction | undefined {
  if (item.freshness === "rotten") {
    return { id: "eat", blocked: "rotten" };
  }
  const prep = itemPrep(item);
  if (item.kind === "pineapple" && prep === "whole") {
    if (held === "knife") return { id: "peel", cut: true, needsHeld: "knife" };
    return pickupOf("pineapple");
  }
  if (item.kind === "watermelon" && prep === "whole") {
    if (held === "knife") return { id: "slice", cut: true, needsHeld: "knife" };
    return pickupOf("watermelon");
  }
  if (item.kind === "coconut" && (prep === "whole" || prep === "hole" || prep === "drunk")) {
    if (held === "hammer") return { id: "split", crack: true, needsHeld: "hammer" };
    if (held === "knife" && prep === "whole") return { id: "open", cut: true, needsHeld: "knife" };
    return pickupOf("coconut");
  }
  return pickupOf(item.kind);
}

export function resolveHeldMeal(held: HeldKind | null, mesh: Object3D | null): ResolvedAction | undefined {
  if (!isHeldFood(held) || !isFoodKind(held)) return undefined;
  const prep = readFoodPrep(mesh) ?? defaultPrep(held);
  const freshness = readFoodFreshness(mesh) ?? "fresh";
  if (freshness === "rotten") return { id: "eat", blocked: "rotten" };
  if (held === "coconut") {
    if (prep === "hole") {
      return {
        id: "drink",
        eatHeld: true,
        drinkHeld: true,
        keepHeld: true,
        meal: { hunger: EAT_DRINK_HOLE_HUNGER, thirst: EAT_DRINK_HOLE_THIRST },
      };
    }
    if (prep === "half") {
      return {
        id: "eat",
        eatHeld: true,
        meal: { hunger: EAT_COCONUT_HUNGER, thirst: EAT_COCONUT_THIRST },
      };
    }
    if (prep === "drunk") return { id: "split", blocked: "needHammer" };
    return { id: "open", blocked: "needKnifeOrHammer" };
  }
  if (held === "coconutHalf") {
    return {
      id: "eat",
      eatHeld: true,
      meal: { hunger: EAT_COCONUT_HUNGER, thirst: EAT_COCONUT_THIRST },
    };
  }
  if (held === "pineapple" && prep === "whole") {
    return { id: "peel", blocked: "needKnife" };
  }
  if (held === "watermelon" && prep === "whole") {
    return { id: "slice", blocked: "needKnife" };
  }
  if (held === "mushroomRed") {
    return { id: "eat", eatHeld: true, poison: true, meal: { hunger: 0, thirst: 0 } };
  }
  return fruitEat;
}

function chebyshev(ax: number, az: number, bx: number, bz: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(az - bz));
}

export function nearestItem(items: Item[], cellX: number, cellZ: number, held: HeldKind | null = null): Item | null {
  const px = cellX + 0.5;
  const pz = cellZ + 0.5;
  let best: Item | null = null;
  let bestDist = Infinity;
  let bestEnabled = false;
  for (const it of items) {
    if (chebyshev(cellX, cellZ, it.cellX, it.cellZ) > 1) continue;
    const dx = it.mesh.position.x - px;
    const dz = it.mesh.position.z - pz;
    const dist = dx * dx + dz * dz;
    const enabled = actionEnabled(resolveWorldAction(it, held));
    const closer = dist < bestDist - 1e-12;
    const tiePreferAction = Math.abs(dist - bestDist) <= 1e-12 && enabled && !bestEnabled;
    if (!best || closer || tiePreferAction) {
      best = it;
      bestDist = dist;
      bestEnabled = enabled;
    }
  }
  return best;
}
