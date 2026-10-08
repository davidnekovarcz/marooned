import { describe, expect, it } from "vitest";
import { excessGroundIds, lootGroundCap } from "@/web/src/sim/loot";

const FRUIT = ["banana", "orange", "lemon", "pineapple", "watermelon", "tomato", "mushroomTan", "mushroomRed", "coconutHalf"];
const TOOLS = ["knife", "hammer", "shovel", "axe", "torch", "fishingPole"];

describe("ground caps", () => {
  it("keeps ten coconuts, two of each other fruit, and two of each tool", () => {
    expect(lootGroundCap("coconut")).toBe(10);
    for (const kind of FRUIT) expect(lootGroundCap(kind)).toBe(2);
    for (const kind of TOOLS) expect(lootGroundCap(kind)).toBe(2);
    expect(lootGroundCap("stick")).toBeNull();
  });

  it("drops a local extra and a rotten copy before a fresh one", () => {
    const pieces = [
      { id: "saved-a", kind: "axe", rotten: false },
      { id: "saved-b", kind: "axe", rotten: false },
      { id: "local", kind: "axe", rotten: false },
      { id: "rotten", kind: "banana", rotten: true },
      { id: "fresh-a", kind: "banana", rotten: false },
      { id: "fresh-b", kind: "banana", rotten: false },
    ];
    expect(excessGroundIds(pieces).sort()).toEqual(["local", "rotten"]);
  });
});
