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
  "fish",
  "fishCooked",
] as const;

export type FoodKind = (typeof FOOD_KINDS)[number];

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

export type ItemLabelParts = {
  nounKey: string;
  prepKey?: string;
  stateKey?: string;
};

/** Locale keys for a food/tool/prop label. View composes `t(nounKey)` plus optional tags. */
export function itemLabelParts(
  kind: string,
  prep?: FoodPrep,
  freshness: Freshness = "fresh",
): ItemLabelParts {
  const nounKey = `item.${kind}`;
  if (freshness === "rotten") {
    if (prep === "half") return { nounKey, prepKey: "food.prep.half", stateKey: "food.state.rotten" };
    if (prep === "peeled") return { nounKey, prepKey: "food.prep.peeled", stateKey: "food.state.rotten" };
    if (prep === "sliced") return { nounKey, prepKey: "food.prep.sliced", stateKey: "food.state.rotten" };
    return { nounKey, stateKey: "food.state.rotten" };
  }
  if (kind === "mushroomRed") return { nounKey, stateKey: "food.state.poisonous" };
  if (kind === "coconut") {
    if (prep === "hole") return { nounKey, prepKey: "food.prep.hole" };
    if (prep === "half") return { nounKey, prepKey: "food.prep.half" };
    return { nounKey };
  }
  if (kind === "coconutHalf") return { nounKey, prepKey: "food.prep.half" };
  if (kind === "pineapple" && prep === "peeled") return { nounKey, prepKey: "food.prep.peeled" };
  if (kind === "watermelon" && prep === "sliced") return { nounKey, prepKey: "food.prep.sliced" };
  if (kind === "fishCooked") return { nounKey };
  return { nounKey };
}
