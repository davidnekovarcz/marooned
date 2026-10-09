import { FOOD_KINDS, isFoodKind } from "@/web/src/food";

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

/** Tools, food, stone, sticks, logs, wreck, and camp. Palms, bushes, rocks, fiber, and tinder stay off the list. */
const VISIBLE_GROUND_KINDS: string[] = [
  ...TOOLS,
  ...FOOD_KINDS,
  "stone",
  "stick",
  "log",
  "logLarge",
  "natureLog",
  ...WRECK,
  ...CAMP,
];

const VISIBLE_GROUND = new Set<string>(VISIBLE_GROUND_KINDS);

export const GROUND_CAP_MAX = 40;

export function visibleGroundKind(kind: string): boolean {
  return VISIBLE_GROUND.has(kind);
}

export function groundKindRank(kind: string): number {
  const index = VISIBLE_GROUND_KINDS.indexOf(kind);
  return index < 0 ? VISIBLE_GROUND_KINDS.length : index;
}

/** Built-in ground max. Logs, wreck, camp, and fish stay empty until a room saves one. */
export function builtinGroundCap(kind: string): number | null {
  if (TOOLS.has(kind)) return 2;
  if (kind === "coconut") return 10;
  if (kind === "stone") return 5;
  if (kind === "stick") return 8;
  if (isFoodKind(kind) && kind !== "fish" && kind !== "fishCooked") return 2;
  return null;
}

export function clampGroundCap(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
  if (!Number.isInteger(n) || n < 0 || n > GROUND_CAP_MAX) return null;
  return n;
}

export function parseGroundCaps(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [kind, value] of Object.entries(raw)) {
    if (!visibleGroundKind(kind)) continue;
    const cap = clampGroundCap(value);
    if (cap == null) continue;
    out[kind] = cap;
  }
  return out;
}
