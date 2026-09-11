import { isFoodKind } from "@/web/src/food";
import type { ModelKind } from "@/web/src/models";

export type WorldKind = ModelKind | "lilypad" | "torch" | "tomato";

export type HeldKind =
  | "knife"
  | "hammer"
  | "axe"
  | "shovel"
  | "torch"
  | "tinder"
  | "coconut"
  | "coconutHalf"
  | "orange"
  | "pineapple"
  | "banana"
  | "lemon"
  | "watermelon"
  | "tomato"
  | "mushroomTan"
  | "mushroomRed";

export type PocketSlot = "left" | "right";

export type ToolKind = "knife" | "hammer" | "axe" | "shovel" | "torch";

export function isHeldFood(kind: HeldKind | null): boolean {
  return kind !== null && isFoodKind(kind);
}
