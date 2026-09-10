import * as THREE from "three";
import {
  LOOT_FRESH_SECONDS,
  LOOT_RESPAWN_SECONDS,
  LOOT_ROTTEN_SECONDS,
  LOOT_SPAWN_AWAY,
  SEED,
  TOOL_RESPAWN_SECONDS,
} from "@/web/src/constants";
import { defaultPrep, formatFoodName, isFoodKind, writeFoodState } from "@/web/src/food";
import type { SpawnFn, WorldItem } from "@/web/src/interact";
import type { ModelKind } from "@/web/src/models";
import { mulberry32 } from "@/web/src/rng";

export type Cell = { x: number; z: number };
export type Freshness = "fresh" | "rotten";

export type LootSites = {
  palm: Cell[];
  grove: Cell[];
  wreck: Cell[];
  boat: Cell[];
  hut: Cell[];
  forest: Cell[];
  bush: Cell[];
};

export type FruitKind =
  | "coconut"
  | "coconutHalf"
  | "banana"
  | "orange"
  | "lemon"
  | "pineapple"
  | "watermelon"
  | "tomato"
  | "mushroomTan"
  | "mushroomRed";
export type ToolKind = "knife" | "hammer" | "axe" | "shovel" | "torch";
export type LootKind = FruitKind | ToolKind;

type SiteKey = keyof LootSites;

type FoodSpec = {
  kind: FruitKind;
  cap: number;
  sites: SiteKey[];
  rots: boolean;
  /** Starter coconut half: spawn once near wreck, never respawn as wild loot. */
  starter?: boolean;
};

type ToolSpec = {
  kind: ToolKind;
  count: number;
  sites: SiteKey[];
};

const FOOD: FoodSpec[] = [
  { kind: "coconut", cap: 2, sites: ["palm"], rots: false },
  { kind: "banana", cap: 2, sites: ["palm"], rots: true },
  { kind: "orange", cap: 2, sites: ["palm"], rots: true },
  { kind: "lemon", cap: 2, sites: ["palm"], rots: true },
  { kind: "pineapple", cap: 2, sites: ["palm"], rots: true },
  { kind: "watermelon", cap: 2, sites: ["bush"], rots: true },
  { kind: "tomato", cap: 2, sites: ["bush"], rots: true },
  { kind: "mushroomTan", cap: 2, sites: ["forest"], rots: true },
  { kind: "mushroomRed", cap: 2, sites: ["forest"], rots: true },
  { kind: "coconutHalf", cap: 1, sites: ["palm"], rots: true, starter: true },
];

const TOOLS: ToolSpec[] = [
  { kind: "knife", count: 1, sites: ["wreck", "boat", "hut"] },
  { kind: "hammer", count: 1, sites: ["wreck", "hut", "boat"] },
  { kind: "shovel", count: 1, sites: ["hut", "wreck"] },
  { kind: "axe", count: 1, sites: ["forest", "hut"] },
  { kind: "torch", count: 1, sites: ["hut", "boat"] },
];

type Live = {
  kind: LootKind;
  sites: SiteKey[];
  rots: boolean;
  respawn: boolean;
  cell: Cell | null;
  state: "fresh" | "rotten" | "waiting";
  age: number;
  item: WorldItem | null;
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

function nameLoot(kind: LootKind, rotten: boolean): string {
  if (isFoodKind(kind)) {
    return formatFoodName(kind, defaultPrep(kind), rotten ? "rotten" : "fresh");
  }
  const names: Record<ToolKind, string> = {
    knife: "Knife",
    hammer: "Hammer",
    axe: "Axe",
    shovel: "Shovel",
    torch: "Torch",
  };
  return names[kind];
}

export type LootSystem = {
  update: (dt: number, playerX?: number, playerZ?: number) => void;
  onRemoved: (item: WorldItem) => void;
};

export function createLoot(
  sites: LootSites,
  items: WorldItem[],
  spawn: SpawnFn,
): LootSystem {
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
    let cells = pool(sites, live.sites);
    if (nearWreck) {
      const origin = centroid(sites.wreck);
      if (origin) {
        const close = cells.filter((c) => Math.hypot(c.x - origin.x, c.z - origin.z) <= 26);
        if (close.length) cells = close;
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

  const decorateFood = (item: WorldItem, kind: LootKind, rotten: boolean): void => {
    if (!isFoodKind(kind)) return;
    const prep = defaultPrep(kind);
    const freshness = rotten ? "rotten" : "fresh";
    item.prep = prep;
    item.freshness = freshness;
    item.loot = true;
    item.name = formatFoodName(kind, prep, freshness);
    writeFoodState(item.mesh, prep, freshness);
    if (rotten) item.action = { label: "Rotten", blockedReason: "too rotten to eat" };
  };

  const place = (live: Live, cell: Cell, stagger: boolean, nearWreck: boolean): boolean => {
    const item = spawn(live.kind as ModelKind, cell.x, cell.z, { yaw: rng() * Math.PI * 2 });
    if (!item) return false;
    live.cell = cell;
    live.item = item;
    live.state = "fresh";
    live.age = stagger ? rng() * LOOT_FRESH_SECONDS : 0;
    item.loot = true;
    item.name = nameLoot(live.kind, false);
    decorateFood(item, live.kind, false);
    void nearWreck;
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
    return place(live, cell, Boolean(opts?.stagger), Boolean(opts?.nearWreck));
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
    live.item.freshness = "rotten";
    decorateFood(live.item, live.kind, true);
    tintRotten(live.item.mesh);
  };

  const spawnReplacement = (kind: LootKind): void => {
    const spec = FOOD.find((it) => it.kind === kind);
    if (!spec || spec.starter) return;
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
    const n = spec.starter ? 1 : spec.cap;
    for (let i = 0; i < n; i++) {
      const live: Live = {
        kind: spec.kind,
        sites: spec.sites,
        rots: spec.rots,
        respawn: !spec.starter,
        cell: null,
        state: "waiting",
        age: 0,
        item: null,
      };
      lives.push(live);
      trySpawn(live, { stagger: !spec.starter, nearWreck: spec.starter, ignoreCap: spec.starter });
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

  const placed = lives.filter((it) => it.state !== "waiting").length;
  console.info("[loot]", {
    sites: {
      palm: sites.palm.length,
      grove: sites.grove.length,
      wreck: sites.wreck.length,
      boat: sites.boat.length,
      hut: sites.hut.length,
      forest: sites.forest.length,
      bush: sites.bush.length,
    },
    placed,
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
    onRemoved: (item: WorldItem) => {
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
