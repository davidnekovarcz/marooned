import * as THREE from "three";
import {
  LOOT_FRESH_SECONDS,
  LOOT_RESPAWN_SECONDS,
  LOOT_ROTTEN_SECONDS,
  LOOT_SPAWN_AWAY,
  SEED,
  TOOL_RESPAWN_SECONDS,
} from "@/web/src/constants";
import { isFoodKind, type FoodKind } from "@/web/src/food";
import type { ModelKind } from "@/web/src/models";
import { mulberry32 } from "@/web/src/rng";
import { applyFoodState, type Item, type SpawnFn } from "@/web/src/world/item";
import type { ToolKind } from "@/web/src/world/kinds";

export type Cell = { x: number; z: number };

export type LootSites = {
  palm: Cell[];
  inlandPalm: Cell[];
  grove: Cell[];
  wreck: Cell[];
  boat: Cell[];
  hut: Cell[];
  forest: Cell[];
  bush: Cell[];
};

export type LootKind = FoodKind | ToolKind;

type SiteKey = keyof LootSites;

type FoodSpec = {
  kind: FoodKind;
  cap: number;
  sites: SiteKey[];
  rots: boolean;
  nearWreck?: boolean;
};

type ToolSpec = {
  kind: ToolKind;
  count: number;
  sites: SiteKey[];
};

const FOOD: FoodSpec[] = [
  { kind: "coconut", cap: 10, sites: ["palm"], rots: false },
  { kind: "banana", cap: 2, sites: ["palm"], rots: true },
  { kind: "orange", cap: 2, sites: ["palm"], rots: true },
  { kind: "lemon", cap: 2, sites: ["palm"], rots: true },
  { kind: "pineapple", cap: 2, sites: ["palm"], rots: true },
  { kind: "watermelon", cap: 2, sites: ["bush"], rots: true },
  { kind: "tomato", cap: 2, sites: ["bush"], rots: true },
  { kind: "mushroomTan", cap: 2, sites: ["forest"], rots: true },
  { kind: "mushroomRed", cap: 2, sites: ["forest"], rots: true },
  { kind: "coconutHalf", cap: 2, sites: ["palm"], rots: true, nearWreck: true },
];

const TOOLS: ToolSpec[] = [
  { kind: "knife", count: 1, sites: ["wreck", "boat", "hut"] },
  { kind: "hammer", count: 1, sites: ["wreck", "hut", "boat"] },
  { kind: "shovel", count: 1, sites: ["hut", "wreck"] },
  { kind: "axe", count: 1, sites: ["forest", "hut"] },
  { kind: "torch", count: 1, sites: ["hut", "boat"] },
];

/** Timers only — freshness/prep live on Item. */
type Live = {
  kind: LootKind;
  sites: SiteKey[];
  rots: boolean;
  respawn: boolean;
  cell: Cell | null;
  state: "fresh" | "rotten" | "waiting";
  age: number;
  item: Item | null;
};

function keyOf(cell: Cell): string {
  return `${cell.x},${cell.z}`;
}

function centroid(cells: Cell[]): Cell | null {
  if (!cells.length) return null;
  let x = 0;
  let z = 0;
  for (const cell of cells) {
    x += cell.x;
    z += cell.z;
  }
  return { x: x / cells.length, z: z / cells.length };
}

function tintRotten(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = src.map((mat) => {
      const clone = mat.clone();
      const colored = clone as THREE.MeshStandardMaterial;
      if (colored.color) {
        colored.color.offsetHSL(0.05, -0.35, -0.22);
        colored.color.multiplyScalar(0.55);
      }
      return clone;
    });
    mesh.material = Array.isArray(mesh.material) ? next : next[0]!;
  });
}

function pool(sites: LootSites, keys: SiteKey[]): Cell[] {
  const out: Cell[] = [];
  for (const key of keys) out.push(...sites[key]);
  return out;
}

export type LootSystem = {
  update: (dt: number, playerX?: number, playerZ?: number) => void;
  onRemoved: (item: Item) => void;
};

export function createLoot(sites: LootSites, items: Item[], spawn: SpawnFn): LootSystem {
  const rng = mulberry32(`${SEED}-loot`);
  const lives: Live[] = [];
  let playerAt: Cell | null = null;

  const occupiedKeys = (): Set<string> => {
    const occupied = new Set<string>();
    for (const live of lives) {
      if (live.cell && live.state !== "waiting") occupied.add(keyOf(live.cell));
    }
    for (const it of items) occupied.add(`${it.cellX},${it.cellZ}`);
    return occupied;
  };

  const freshCount = (kind: LootKind): number =>
    lives.filter((live) => live.kind === kind && live.state === "fresh" && live.item).length;

  const pickCell = (live: Live, nearWreck: boolean, awayFromPlayer: boolean): Cell | null => {
    let cells = nearWreck && sites.inlandPalm.length ? sites.inlandPalm : pool(sites, live.sites);
    if (nearWreck) {
      const wreckAt = centroid(sites.wreck);
      if (wreckAt && cells.length) {
        cells = [...cells].sort(
          (a, b) =>
            Math.hypot(a.x - wreckAt.x, a.z - wreckAt.z) - Math.hypot(b.x - wreckAt.x, b.z - wreckAt.z),
        );
      }
    }
    if (!cells.length) return null;
    const occupied = occupiedKeys();
    const avoid = live.cell;
    const origin = playerAt ?? (awayFromPlayer ? live.cell : null);
    const far = (cell: Cell): boolean => {
      if (!awayFromPlayer || !origin) return true;
      return Math.hypot(cell.x - origin.x, cell.z - origin.z) >= LOOT_SPAWN_AWAY;
    };
    const ok = (cell: Cell, strict: boolean): boolean => {
      if (avoid && cell.x === avoid.x && cell.z === avoid.z) return false;
      if (strict && occupied.has(keyOf(cell))) return false;
      if (!far(cell)) return false;
      return true;
    };
    const tryPick = (strict: boolean): Cell | null => {
      if (nearWreck) return cells.find((c) => ok(c, strict)) ?? null;
      for (let n = 0; n < 96; n++) {
        const cell = cells[Math.floor(rng() * cells.length)];
        if (!cell) continue;
        if (!ok(cell, strict)) continue;
        return cell;
      }
      return cells.find((c) => ok(c, strict)) ?? null;
    };
    return tryPick(true) ?? tryPick(false);
  };

  const place = (live: Live, cell: Cell, stagger: boolean): boolean => {
    const item = spawn(live.kind as ModelKind, cell.x, cell.z, { yaw: rng() * Math.PI * 2 });
    if (!item) return false;
    live.cell = cell;
    live.item = item;
    live.state = "fresh";
    live.age = stagger ? rng() * LOOT_FRESH_SECONDS : 0;
    item.loot = true;
    if (isFoodKind(live.kind)) applyFoodState(item);
    return true;
  };

  const trySpawn = (
    live: Live,
    opts?: { stagger?: boolean; nearWreck?: boolean; ignoreCap?: boolean; awayFromPlayer?: boolean },
  ): boolean => {
    const food = FOOD.find((spec) => spec.kind === live.kind);
    if (food && !opts?.ignoreCap && freshCount(live.kind) >= food.cap) return false;
    const cell = pickCell(live, Boolean(opts?.nearWreck), Boolean(opts?.awayFromPlayer));
    if (!cell) return false;
    return place(live, cell, Boolean(opts?.stagger));
  };

  const despawn = (live: Live): void => {
    if (live.item) {
      live.item.mesh.removeFromParent();
      const i = items.indexOf(live.item);
      if (i >= 0) items.splice(i, 1);
    }
    live.item = null;
    live.state = "waiting";
    live.age = 0;
  };

  const rotItem = (live: Live): void => {
    if (!live.item) return;
    live.state = "rotten";
    live.age = 0;
    applyFoodState(live.item, live.item.prep, "rotten");
    tintRotten(live.item.mesh);
  };

  const spawnReplacement = (kind: LootKind): void => {
    const spec = FOOD.find((it) => it.kind === kind);
    if (!spec) return;
    if (freshCount(kind) >= spec.cap) return;
    const live: Live = {
      kind,
      sites: spec.sites,
      rots: spec.rots,
      respawn: true,
      cell: null,
      state: "waiting",
      age: 0,
      item: null,
    };
    lives.push(live);
    trySpawn(live, { stagger: false, awayFromPlayer: true });
  };

  for (const spec of FOOD) {
    for (let i = 0; i < spec.cap; i++) {
      const live: Live = {
        kind: spec.kind,
        sites: spec.sites,
        rots: spec.rots,
        respawn: true,
        cell: null,
        state: "waiting",
        age: 0,
        item: null,
      };
      lives.push(live);
      trySpawn(live, {
        stagger: spec.kind !== "coconutHalf" || i > 0,
        nearWreck: Boolean(spec.nearWreck) && i === 0,
      });
    }
  }

  for (const spec of TOOLS) {
    for (let i = 0; i < spec.count; i++) {
      const live: Live = {
        kind: spec.kind,
        sites: spec.sites,
        rots: false,
        respawn: true,
        cell: null,
        state: "waiting",
        age: TOOL_RESPAWN_SECONDS,
        item: null,
      };
      lives.push(live);
      trySpawn(live, { ignoreCap: true });
    }
  }

  console.info("[loot]", {
    sites: {
      palm: sites.palm.length,
      inlandPalm: sites.inlandPalm.length,
      grove: sites.grove.length,
      wreck: sites.wreck.length,
      boat: sites.boat.length,
      hut: sites.hut.length,
      forest: sites.forest.length,
      bush: sites.bush.length,
    },
    placed: lives.filter((it) => it.state !== "waiting").length,
    kinds: lives.map((it) => `${it.kind}:${it.state}:${it.cell ? `${it.cell.x},${it.cell.z}` : "-"}`),
  });

  return {
    update: (dt: number, playerX?: number, playerZ?: number) => {
      if (playerX !== undefined && playerZ !== undefined) playerAt = { x: playerX, z: playerZ };
      for (const live of [...lives]) {
        live.age += dt;
        if (live.state === "waiting") {
          if (!live.respawn) continue;
          const tool = TOOLS.some((spec) => spec.kind === live.kind);
          const wait = tool ? TOOL_RESPAWN_SECONDS : LOOT_RESPAWN_SECONDS;
          if (live.age >= wait) trySpawn(live, { awayFromPlayer: !tool });
          continue;
        }
        if (!live.rots) continue;
        if (live.state === "fresh" && live.age >= LOOT_FRESH_SECONDS) {
          rotItem(live);
          spawnReplacement(live.kind);
          live.respawn = false;
        } else if (live.state === "rotten" && live.age >= LOOT_ROTTEN_SECONDS) {
          despawn(live);
          const i = lives.indexOf(live);
          if (i >= 0) lives.splice(i, 1);
        }
      }
    },
    onRemoved: (item: Item) => {
      const live = lives.find((it) => it.item === item);
      if (!live) return;
      live.item = null;
      live.state = "waiting";
      live.age = 0;
      if (!live.respawn) {
        live.cell = null;
        return;
      }
      const food = FOOD.find((spec) => spec.kind === live.kind);
      if (food) trySpawn(live, { awayFromPlayer: true });
      if (live.state === "waiting") live.cell = null;
    },
  };
}
