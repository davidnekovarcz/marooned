import { isFoodKind } from "@/web/src/food";

export const GROUND_CATEGORIES = ["tree", "nature", "food", "tool", "resource", "wreck", "camp", "other"] as const;

export type GroundCategory = (typeof GROUND_CATEGORIES)[number];

const TREES = new Set([
  "palm",
  "palmBend",
  "palmShort",
  "palmSimple",
  "oak",
  "pine",
  "piratePalm",
  "piratePalmStraight",
  "stump",
  "log",
  "logLarge",
  "natureLog",
]);

const NATURE = new Set([
  "bush",
  "bushSmall",
  "bushDetailed",
  "flowerYellow",
  "flowerPurple",
  "flowerRed",
  "rockSmall",
  "rockLarge",
  "sandRock",
  "lilypad",
  "campfireLogs",
  "campfireStones",
]);

const TOOLS = new Set(["knife", "hammer", "axe", "shovel", "torch", "fishingPole"]);
const RESOURCES = new Set(["stick", "stone", "fiber", "tinder"]);
const WRECK = new Set([
  "wreck",
  "crate",
  "barrel",
  "chest",
  "rowBoat",
  "mastRopes",
  "bottle",
  "crateBottles",
  "flag",
  "fishingBoat",
  "bow",
  "arrow",
]);
const CAMP = new Set([
  "structure",
  "tentHalf",
  "floorOld",
  "campfire",
  "fishStand",
  "bedroll",
  "bucket",
  "leanTo",
  "bridge",
]);

export function groundCategory(kind: string): GroundCategory {
  if (TREES.has(kind)) return "tree";
  if (isFoodKind(kind)) return "food";
  if (TOOLS.has(kind)) return "tool";
  if (RESOURCES.has(kind)) return "resource";
  if (WRECK.has(kind)) return "wreck";
  if (CAMP.has(kind)) return "camp";
  if (NATURE.has(kind)) return "nature";
  return "other";
}

export function groundCategoryLabel(category: GroundCategory): string {
  if (category === "tree") return "Trees";
  if (category === "nature") return "Nature";
  if (category === "food") return "Food";
  if (category === "tool") return "Tools";
  if (category === "resource") return "Resources";
  if (category === "wreck") return "Wreck";
  if (category === "camp") return "Camp";
  return "Other";
}
