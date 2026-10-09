import { describe, expect, it } from "vitest";
import { excessGroundIds, lootGroundCap } from "@/web/src/sim/loot";

const FRUIT = ["banana", "orange", "lemon", "pineapple", "watermelon", "tomato", "mushroomTan", "mushroomRed", "coconutHalf"];
const TOOLS = ["knife", "hammer", "shovel", "axe", "torch", "fishingPole"];

describe("ground caps", () => {
  it("keeps ten coconuts, two of each other fruit, two of each tool, five stones, and eight sticks", () => {
    expect(lootGroundCap("coconut")).toBe(10);
    for (const kind of FRUIT) expect(lootGroundCap(kind)).toBe(2);
    for (const kind of TOOLS) expect(lootGroundCap(kind)).toBe(2);
    expect(lootGroundCap("stone")).toBe(5);
    expect(lootGroundCap("stick")).toBe(8);
    expect(lootGroundCap("fish")).toBeNull();
    expect(lootGroundCap("fishCooked")).toBeNull();
    expect(lootGroundCap("fiber")).toBeNull();
    expect(lootGroundCap("log")).toBeNull();
    expect(lootGroundCap("wreck")).toBeNull();
    expect(lootGroundCap("leanTo")).toBeNull();
  });

  it("uses a room max above or below the built-in cap", () => {
    expect(lootGroundCap("coconut", { coconut: 40 })).toBe(40);
    expect(lootGroundCap("coconut", { coconut: 0 })).toBe(0);
    expect(lootGroundCap("axe", { axe: 1 })).toBe(1);
    expect(lootGroundCap("stick", { stick: 12 })).toBe(12);
    expect(lootGroundCap("fish", { fish: 3 })).toBe(3);
    expect(lootGroundCap("wreck", { wreck: 6 })).toBe(6);
    expect(lootGroundCap("axe", { coconut: 40 })).toBe(2);
    const axes = [
      { id: "fresh-a", kind: "axe", rotten: false },
      { id: "rotten", kind: "axe", rotten: true },
      { id: "fresh-b", kind: "axe", rotten: false },
    ];
    expect(excessGroundIds(axes, { axe: 1 }).sort()).toEqual(["fresh-b", "rotten"]);
    expect(excessGroundIds(axes, { axe: 5 })).toEqual([]);
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
