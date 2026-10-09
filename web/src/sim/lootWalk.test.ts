import { describe, expect, it } from "vitest";
import { Object3D } from "three";
import { CELL } from "@/web/src/constants";
import { Loot, type Cell, type LootSites } from "@/web/src/sim/loot";
import { Item, type SpawnFn } from "@/web/src/world/item";
import type { WorldKind } from "@/web/src/world/kinds";

function sitesOf(cells: Cell[]): LootSites {
  return {
    palm: cells,
    inlandPalm: cells,
    grove: cells,
    wreck: cells,
    boat: cells,
    hut: cells,
    forest: cells,
    bush: cells,
  };
}

function world(canStand: (x: number, z: number) => boolean, cells: Cell[]) {
  const items: Item[] = [];
  const spawn: SpawnFn = (kind, x, z) => {
    const item = new Item(kind, x, z, new Object3D());
    items.push(item);
    return item;
  };
  const loot = new Loot(sitesOf(cells), items, spawn, null, canStand);
  return { items, loot, spawn };
}

function put(items: Item[], kind: WorldKind, x: number, z: number): Item {
  const item = new Item(kind, x, z, new Object3D());
  item.mesh.position.set(x * CELL + CELL / 2, 0, z * CELL + CELL / 2);
  items.push(item);
  return item;
}

describe("walkable loot cells", () => {
  it("tool spawn cell must be walkable", () => {
    const fire = { x: 4, z: 4 };
    const open = [
      { x: 0, z: 0 },
      { x: 10, z: 2 },
      { x: 3, z: 8 },
      { x: 8, z: 8 },
      { x: 1, z: 6 },
    ];
    const stand = (x: number, z: number) => !(x === fire.x && z === fire.z);
    const { items } = world(stand, [...open, fire]);
    const axes = items.filter((item) => item.kind === "axe");
    const tools = items.filter((item) =>
      ["knife", "hammer", "shovel", "axe", "torch", "fishingPole"].includes(item.kind),
    );
    expect(axes.length).toBeGreaterThan(0);
    expect(tools.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(stand(item.cellX, item.cellZ)).toBe(true);
      expect(item.cellX === fire.x && item.cellZ === fire.z).toBe(false);
    }
  });

  it("item already on a blocked cell is moved", () => {
    const blocked = { x: 50, z: 50 };
    const stand = (x: number, z: number) => !(x === blocked.x && z === blocked.z);
    const { items, loot } = world(stand, [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 0, z: 1 },
    ]);
    const pickups = ["axe", "coconut", "fish", "stone", "stick", "fiber", "tinder"].map((kind) =>
      put(items, kind as WorldKind, blocked.x, blocked.z),
    );
    const campfire = put(items, "campfire", blocked.x, blocked.z);
    const palm = put(items, "palm", blocked.x, blocked.z);
    const wreck = put(items, "wreck", blocked.x, blocked.z);

    loot.relocateBlockedPickups();

    for (const item of pickups) {
      expect(stand(item.cellX, item.cellZ)).toBe(true);
      expect(Math.max(Math.abs(item.cellX - blocked.x), Math.abs(item.cellZ - blocked.z))).toBe(1);
      expect(item.mesh.position.x).toBe(item.cellX * CELL + CELL / 2);
      expect(item.mesh.position.z).toBe(item.cellZ * CELL + CELL / 2);
    }
    const cells = pickups.map((item) => `${item.cellX},${item.cellZ}`);
    expect(new Set(cells).size).toBe(pickups.length);
    for (const scenery of [campfire, palm, wreck]) {
      expect(scenery.cellX).toBe(blocked.x);
      expect(scenery.cellZ).toBe(blocked.z);
    }
  });

  it("leaves a pickup where it is when no walkable cell is free", () => {
    const { items, loot } = world(
      () => false,
      [{ x: 1, z: 1 }],
    );
    const axe = put(items, "axe", 1, 1);
    loot.relocateBlockedPickups();
    expect(axe.cellX).toBe(1);
    expect(axe.cellZ).toBe(1);
    expect(items.filter((item) => item.kind === "axe")).toEqual([axe]);
  });
});
