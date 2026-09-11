import type { Object3D } from "three";
import {
  EAT_COCONUT_HUNGER,
  EAT_COCONUT_THIRST,
  EAT_DRINK_HOLE_HUNGER,
  EAT_DRINK_HOLE_THIRST,
  EAT_FRUIT_HUNGER,
  EAT_FRUIT_THIRST,
  FISH_COOKED_HUNGER,
  FISH_COOKED_THIRST,
  FISH_HUNGER,
  DRINK_POND_THIRST,
  LEAN_TO_FIBER,
  LEAN_TO_STICKS,
} from "@/web/src/constants";
import { defaultPrep, isFoodKind, readFoodFreshness, readFoodPrep, type FoodPrep } from "@/web/src/food";
import { Item } from "@/web/src/world/item";
import { isHeldFood, type HeldKind, type WorldKind } from "@/web/src/world/kinds";

export type ActionId =
  | "eat"
  | "drink"
  | "peel"
  | "slice"
  | "split"
  | "open"
  | "pickup"
  | "fish"
  | "light"
  | "cook"
  | "build";
export type BlockedId = "rotten" | "needKnife" | "needHammer" | "needKnifeOrHammer" | "needFire" | "needMats" | "tooWet";

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
  pond?: boolean;
  fish?: boolean;
  light?: boolean;
  cook?: boolean;
  build?: boolean;
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
  stick: "stick",
  stone: "stone",
  fiber: "fiber",
  fish: "fish",
  fishCooked: "fishCooked",
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

function chebyshev(ax: number, az: number, bx: number, bz: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(az - bz));
}

export class Actions {
  enabled(action: ResolvedAction | undefined): boolean {
    return Boolean(action && !action.blocked);
  }

  world(item: Item, held: HeldKind | null): ResolvedAction | undefined {
    if (item.freshness === "rotten") return { id: "eat", blocked: "rotten" };
    const prep = this.prepOf(item);
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

  heldMeal(held: HeldKind | null, mesh: Object3D | null): ResolvedAction | undefined {
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
    if (held === "pineapple" && prep === "whole") return { id: "peel", blocked: "needKnife" };
    if (held === "watermelon" && prep === "whole") return { id: "slice", blocked: "needKnife" };
    if (held === "mushroomRed") {
      return { id: "eat", eatHeld: true, poison: true, meal: { hunger: 0, thirst: 0 } };
    }
    if (held === "fish") {
      return { id: "eat", eatHeld: true, meal: { hunger: FISH_HUNGER, thirst: 0 } };
    }
    if (held === "fishCooked") {
      return {
        id: "eat",
        eatHeld: true,
        meal: { hunger: FISH_COOKED_HUNGER, thirst: FISH_COOKED_THIRST },
      };
    }
    return fruitEat;
  }

  context(opts: {
    held: HeldKind | null;
    inWater: boolean;
    onShore: boolean;
    atFreshWater: boolean;
    nearLitFire: boolean;
    nearUnlitFire: boolean;
    raining: boolean;
    fireSheltered: boolean;
    sticks: number;
    fiber: number;
  }): ResolvedAction | undefined {
    if (opts.held === "fish" && opts.nearLitFire) {
      return { id: "cook", cook: true };
    }
    if (opts.nearUnlitFire && (opts.held === "tinder" || opts.held === "torch")) {
      if (opts.raining && !opts.fireSheltered) return { id: "light", light: true, blocked: "tooWet" };
      return { id: "light", light: true };
    }
    if (opts.held === "hammer" && !opts.inWater) {
      if (opts.sticks >= LEAN_TO_STICKS && opts.fiber >= LEAN_TO_FIBER) {
        return { id: "build", build: true };
      }
    }
    // Pond/river first so a coconut at your feet doesn't steal Drink.
    if (opts.atFreshWater) {
      return { id: "drink", pond: true, meal: { hunger: 0, thirst: DRINK_POND_THIRST } };
    }
    if (opts.onShore && !opts.held) {
      return { id: "fish", fish: true };
    }
    return undefined;
  }

  nearest(items: Item[], cellX: number, cellZ: number, held: HeldKind | null = null): Item | null {
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
      const enabled = this.enabled(this.world(it, held));
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

  private prepOf(item: Item): FoodPrep {
    if (item.prep) return item.prep;
    if (isFoodKind(item.kind)) return defaultPrep(item.kind);
    return "ready";
  }
}
