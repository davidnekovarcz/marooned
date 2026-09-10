import type { Object3D } from "three";

export type FoodPrep = "whole" | "hole" | "drunk" | "half" | "peeled" | "sliced" | "ready";
export type Freshness = "fresh" | "rotten";

export const FOOD_KINDS = [
  "coconut",
  "coconutHalf",
  "orange",
  "pineapple",
  "banana",
  "lemon",
  "watermelon",
  "tomato",
  "mushroomTan",
  "mushroomRed",
] as const;

export type FoodKind = (typeof FOOD_KINDS)[number];

const NOUN: Record<FoodKind, string> = {
  coconut: "Coconut",
  coconutHalf: "Coconut",
  orange: "Orange",
  pineapple: "Pineapple",
  banana: "Banana",
  lemon: "Lemon",
  watermelon: "Melon",
  tomato: "Tomato",
  mushroomTan: "Tan mushroom",
  mushroomRed: "Red mushroom",
};

export function isFoodKind(kind: string | null | undefined): kind is FoodKind {
  return kind !== null && kind !== undefined && (FOOD_KINDS as readonly string[]).includes(kind);
}

export function defaultPrep(kind: FoodKind): FoodPrep {
  if (kind === "coconut") return "whole";
  if (kind === "coconutHalf") return "half";
  if (kind === "pineapple" || kind === "watermelon") return "whole";
  return "ready";
}

export function readFoodPrep(mesh: Object3D | null | undefined): FoodPrep | undefined {
  const prep = mesh?.userData?.foodPrep;
  return typeof prep === "string" ? (prep as FoodPrep) : undefined;
}

export function readFoodFreshness(mesh: Object3D | null | undefined): Freshness | undefined {
  const freshness = mesh?.userData?.foodFreshness;
  return freshness === "rotten" || freshness === "fresh" ? freshness : undefined;
}

export function writeFoodState(mesh: Object3D, prep: FoodPrep, freshness: Freshness = "fresh"): void {
  mesh.userData.foodPrep = prep;
  mesh.userData.foodFreshness = freshness;
}

export function formatFoodName(kind: FoodKind, prep: FoodPrep, freshness: Freshness = "fresh"): string {
  const noun = NOUN[kind];
  if (freshness === "rotten") {
    if (prep === "half") return `${noun} (half) [rotten]`;
    if (prep === "peeled") return `${noun} (peeled) [rotten]`;
    if (prep === "sliced") return `${noun} (sliced) [rotten]`;
    return `${noun} [rotten]`;
  }
  if (kind === "mushroomRed") return `${noun} [poisonous]`;
  if (kind === "coconut") {
    if (prep === "whole") return `${noun}`;
    if (prep === "hole") return `${noun} (with drinking hole)`;
    if (prep === "drunk") return `${noun}`;
    if (prep === "half") return `${noun} (half)`;
  }
  if (kind === "coconutHalf") return `${noun} (half)`;
  if (kind === "pineapple") {
    if (prep === "whole") return `${noun}`;
    if (prep === "peeled") return `${noun} (peeled)`;
  }
  if (kind === "watermelon") {
    if (prep === "whole") return `${noun}`;
    if (prep === "sliced") return `${noun} (sliced)`;
  }
  return `${noun}`;
}

export function heldFoodLabel(kind: string | null, mesh: Object3D | null): string {
  if (!isFoodKind(kind)) return kind ?? "Empty";
  const prep = readFoodPrep(mesh) ?? defaultPrep(kind);
  const freshness = readFoodFreshness(mesh) ?? "fresh";
  return formatFoodName(kind, prep, freshness);
}
