import { isFoodKind } from "@/web/src/food";
import type { ModelKind } from "@/web/src/models";

export type WorldKind = ModelKind | "lilypad" | "torch" | "tomato" | "fishCooked" | "fishingPole";

export type HeldKind =
  | "knife"
  | "hammer"
  | "axe"
  | "shovel"
  | "torch"
  | "fishingPole"
  | "tinder"
  | "stick"
  | "stone"
  | "fiber"
  | "coconut"
  | "coconutHalf"
  | "orange"
  | "pineapple"
  | "banana"
  | "lemon"
  | "watermelon"
  | "tomato"
  | "mushroomTan"
  | "mushroomRed"
  | "fish"
  | "fishCooked";

export type PocketSlot = "left" | "right";

export type ToolKind = "knife" | "hammer" | "axe" | "shovel" | "torch";

const HELD_KIND: Record<HeldKind, true> = {
  knife: true,
  hammer: true,
  axe: true,
  shovel: true,
  torch: true,
  fishingPole: true,
  tinder: true,
  stick: true,
  stone: true,
  fiber: true,
  coconut: true,
  coconutHalf: true,
  orange: true,
  pineapple: true,
  banana: true,
  lemon: true,
  watermelon: true,
  tomato: true,
  mushroomTan: true,
  mushroomRed: true,
  fish: true,
  fishCooked: true,
};

export function isHeldKind(kind: string | null | undefined): kind is HeldKind {
  return typeof kind === "string" && kind in HELD_KIND;
}

export function isHeldFood(kind: HeldKind | null): boolean {
  return kind !== null && isFoodKind(kind);
}
