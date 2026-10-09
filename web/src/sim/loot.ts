import * as THREE from "three";
import { builtinGroundCap, GROUND_CAP_MAX } from "@/web/src/admin/ground";
import {
  CELL,
  GRID,
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
import { Item, type SpawnFn } from "@/web/src/world/item";
import type { LootTimer } from "@/web/src/net/protocol";
import { isHeldKind, type ToolKind } from "@/web/src/world/kinds";

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

export type LootKind = FoodKind | ToolKind | "fishingPole" | "stick" | "stone" | "fiber";

type SiteKey = keyof LootSites;

type FoodSpec = {
  kind: FoodKind;
  cap: number;
  sites: SiteKey[];
  rots: boolean;
  nearWreck?: boolean;
};

type ToolSpec = {
  kind: ToolKind | "fishingPole" | "stick" | "stone" | "fiber";
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
  { kind: "knife", count: 2, sites: ["wreck", "boat", "hut"] },
  { kind: "hammer", count: 2, sites: ["wreck", "hut", "boat"] },
  { kind: "shovel", count: 2, sites: ["hut", "forest"] },
  { kind: "axe", count: 2, sites: ["forest", "hut"] },
  { kind: "torch", count: 2, sites: ["hut", "boat"] },
  { kind: "fishingPole", count: 2, sites: ["wreck", "boat"] },
];

const RESOURCES: ToolSpec[] = [
  { kind: "stick", count: 8, sites: ["forest", "grove", "boat"] },
  { kind: "stone", count: 5, sites: ["wreck", "forest", "hut"] },
  { kind: "fiber", count: 6, sites: ["bush", "palm"] },
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

export type GroundPiece = { id: string; kind: string; rotten: boolean };

function savedGroundCap(kind: string, roomCaps?: Readonly<Record<string, number>> | null): number | null {
  if (!roomCaps || !Object.prototype.hasOwnProperty.call(roomCaps, kind)) return null;
  const saved = roomCaps[kind];
  if (typeof saved !== "number" || !Number.isInteger(saved) || saved < 0 || saved > GROUND_CAP_MAX) return null;
  return saved;
}

/** Room max when one is saved, otherwise the built-in cap. Logs, wreck, camp, and fish have none until saved. */
export function lootGroundCap(kind: string, roomCaps?: Readonly<Record<string, number>> | null): number | null {
  const saved = savedGroundCap(kind, roomCaps);
  if (saved != null) return saved;
  return builtinGroundCap(kind);
}

/** Ids to remove so each capped kind stays within its ground limit. Rotten copies go first. */
export function excessGroundIds(pieces: GroundPiece[], roomCaps?: Readonly<Record<string, number>> | null): string[] {
  const byKind = new Map<string, GroundPiece[]>();
  for (const piece of pieces) {
    if (lootGroundCap(piece.kind, roomCaps) == null) continue;
    const list = byKind.get(piece.kind) ?? [];
    list.push(piece);
    byKind.set(piece.kind, list);
  }
  const drop: string[] = [];
  for (const [kind, list] of byKind) {
    const cap = lootGroundCap(kind, roomCaps);
    if (cap == null || list.length <= cap) continue;
    const ranked = [...list].sort((a, b) => Number(a.rotten) - Number(b.rotten));
    for (const extra of ranked.slice(cap)) drop.push(extra.id);
  }
  return drop;
}

export class Loot {
  private readonly rng = mulberry32(`${SEED}-loot`);
  private readonly lives: Live[] = [];
  private playerAt: Cell | null = null;
  private roomCaps: Record<string, number> | null = null;

  constructor(
    private sites: LootSites,
    private items: Item[],
    private spawn: SpawnFn,
    private keepOff: Cell | null = null,
    private canStand: (x: number, z: number) => boolean = () => true,
  ) {
    for (const spec of FOOD) {
      const count = builtinGroundCap(spec.kind) ?? spec.cap;
      for (let i = 0; i < count; i++) {
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
        this.lives.push(live);
        this.trySpawn(live, {
          stagger: spec.kind !== "coconutHalf" || i > 0,
          nearWreck: Boolean(spec.nearWreck) && i === 0,
        });
      }
    }
    for (const spec of TOOLS) {
      const count = builtinGroundCap(spec.kind) ?? spec.count;
      for (let i = 0; i < count; i++) {
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
        this.lives.push(live);
        this.trySpawn(live);
      }
    }
    for (const spec of RESOURCES) {
      for (let i = 0; i < spec.count; i++) {
        const live: Live = {
          kind: spec.kind,
          sites: spec.sites,
          rots: false,
          respawn: true,
          cell: null,
          state: "waiting",
          age: 0,
          item: null,
        };
        this.lives.push(live);
        this.trySpawn(live, { ignoreCap: true });
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
      placed: this.lives.filter((it) => it.state !== "waiting").length,
      kinds: this.lives.map((it) => `${it.kind}:${it.state}:${it.cell ? `${it.cell.x},${it.cell.z}` : "-"}`),
    });
  }

  exportTimers(): LootTimer[] {
    return this.lives.map((live) => ({
      kind: live.kind,
      state: live.state,
      age: live.age,
      respawn: live.respawn,
      cellX: live.cell?.x ?? null,
      cellZ: live.cell?.z ?? null,
    }));
  }

  /** Waiting ground loot is due now. Held and pocket items are not lives. */
  forceGroundRespawn(): void {
    for (const live of this.lives) {
      if (live.state !== "waiting" || !live.respawn) continue;
      const tool = TOOLS.some((spec) => spec.kind === live.kind);
      live.age = tool ? TOOL_RESPAWN_SECONDS : LOOT_RESPAWN_SECONDS;
    }
  }

  /** Continue saved countdowns after the host reloads. */
  adoptTimers(rows: LootTimer[]): void {
    const pending = [...rows];
    for (const live of this.lives) {
      const index = pending.findIndex((row) => row.kind === live.kind);
      if (index < 0) continue;
      const row = pending.splice(index, 1)[0];
      if (!row) continue;
      live.respawn = row.respawn;
      if (row.state === "waiting") {
        if (live.item) this.despawn(live);
        live.state = "waiting";
        live.age = row.age;
        continue;
      }
      if (live.state === "waiting") this.trySpawn(live);
      if (row.state === "rotten" && live.item && live.state === "fresh") this.rotItem(live);
      live.age = row.age;
    }
  }

  /** Remember the room max, then add waiting food and tool lives when that max is higher than the built-in count. */
  useGroundCaps(caps: Record<string, number>): void {
    this.roomCaps = caps;
    for (const spec of FOOD) this.addWaitingLives(spec.kind, spec.sites, spec.rots);
    for (const spec of TOOLS) this.addWaitingLives(spec.kind, spec.sites, false);
  }

  /**
   * Move food, fish, tools, stone, sticks, fiber, and tinder off a cell the player cannot enter.
   * Trees, bushes, rocks, and hut, wreck, and camp pieces stay where they are.
   * When every other cell is blocked or already taken, the pickup stays put.
   */
  relocateBlockedPickups(): void {
    const taken = new Map<string, number>();
    for (const item of this.items) {
      const key = keyOf({ x: item.cellX, z: item.cellZ });
      taken.set(key, (taken.get(key) ?? 0) + 1);
    }
    for (const item of this.items) {
      if (!isHeldKind(item.kind)) continue;
      if (this.canStand(item.cellX, item.cellZ)) continue;
      const next = this.nearestOpen(item.cellX, item.cellZ, taken);
      if (!next) continue;
      const from = keyOf({ x: item.cellX, z: item.cellZ });
      taken.set(from, (taken.get(from) ?? 1) - 1);
      taken.set(keyOf(next), (taken.get(keyOf(next)) ?? 0) + 1);
      this.movePickup(item, next);
    }
  }

  /** Drop ground copies past the saved or built-in cap. Rotten copies go first. Pockets are not in the list. */
  enforceCaps(): void {
    const drop = new Set(
      excessGroundIds(
        this.items.map((item) => ({
          id: item.id,
          kind: item.kind,
          rotten: item.freshness === "rotten",
        })),
        this.roomCaps,
      ),
    );
    if (!drop.size) return;
    for (const item of [...this.items]) {
      if (!drop.has(item.id)) continue;
      const live = this.lives.find((row) => row.item === item);
      if (live) {
        this.despawn(live);
        continue;
      }
      item.mesh.removeFromParent();
      const index = this.items.indexOf(item);
      if (index >= 0) this.items.splice(index, 1);
    }
  }

  update(dt: number, playerX?: number, playerZ?: number): void {
    if (playerX !== undefined && playerZ !== undefined) this.playerAt = { x: playerX, z: playerZ };
    for (const live of [...this.lives]) {
      live.age += dt;
      if (live.state === "waiting") {
        if (!live.respawn) continue;
        const tool = TOOLS.some((spec) => spec.kind === live.kind);
        const wait = tool ? TOOL_RESPAWN_SECONDS : LOOT_RESPAWN_SECONDS;
        if (live.age >= wait) this.trySpawn(live, { awayFromPlayer: !tool });
        continue;
      }
      if (!live.rots) continue;
      if (live.state === "fresh" && live.age >= LOOT_FRESH_SECONDS) {
        this.rotItem(live);
        this.spawnReplacement(live.kind);
        live.respawn = false;
      } else if (live.state === "rotten" && live.age >= LOOT_ROTTEN_SECONDS) {
        this.despawn(live);
        const i = this.lives.indexOf(live);
        if (i >= 0) this.lives.splice(i, 1);
      }
    }
  }

  onRemoved(item: Item): void {
    const live = this.lives.find((it) => it.item === item);
    if (!live) return;
    live.item = null;
    live.state = "waiting";
    live.age = 0;
    if (!live.respawn) {
      live.cell = null;
      return;
    }
    const food = FOOD.find((spec) => spec.kind === live.kind);
    if (food) this.trySpawn(live, { awayFromPlayer: true });
    if (live.state === "waiting") live.cell = null;
  }

  private occupiedKeys(): Set<string> {
    const occupied = new Set<string>();
    for (const live of this.lives) {
      if (live.cell && live.state !== "waiting") occupied.add(keyOf(live.cell));
    }
    for (const it of this.items) occupied.add(`${it.cellX},${it.cellZ}`);
    return occupied;
  }

  private groundCount(kind: LootKind): number {
    return this.items.filter((item) => item.kind === kind).length;
  }

  /** Food and tools can wait for the next respawn. Stone, sticks, fish, logs, wreck, and camp are only trimmed. */
  private addWaitingLives(kind: LootKind, sites: SiteKey[], rots: boolean): void {
    const cap = lootGroundCap(kind, this.roomCaps);
    if (cap == null) return;
    let have = this.lives.filter((live) => live.kind === kind).length;
    while (have < cap) {
      this.lives.push({
        kind,
        sites,
        rots,
        respawn: true,
        cell: null,
        state: "waiting",
        age: 0,
        item: null,
      });
      have += 1;
    }
  }

  private pickCell(live: Live, nearWreck: boolean, awayFromPlayer: boolean): Cell | null {
    let cells = nearWreck && this.sites.inlandPalm.length ? this.sites.inlandPalm : pool(this.sites, live.sites);
    if (nearWreck) {
      const wreckAt = centroid(this.sites.wreck);
      if (wreckAt && cells.length) {
        cells = [...cells].sort(
          (a, b) =>
            Math.hypot(a.x - wreckAt.x, a.z - wreckAt.z) - Math.hypot(b.x - wreckAt.x, b.z - wreckAt.z),
        );
      }
    }
    if (!cells.length) return null;
    const occupied = this.occupiedKeys();
    const avoid = live.cell;
    const origin = this.playerAt ?? (awayFromPlayer ? live.cell : null);
    const far = (cell: Cell): boolean => {
      if (!awayFromPlayer || !origin) return true;
      return Math.hypot(cell.x - origin.x, cell.z - origin.z) >= LOOT_SPAWN_AWAY;
    };
    const ok = (cell: Cell, strict: boolean): boolean => {
      if (!this.canStand(cell.x, cell.z)) return false;
      if (avoid && cell.x === avoid.x && cell.z === avoid.z) return false;
      if (strict && occupied.has(keyOf(cell))) return false;
      if (!far(cell)) return false;
      if (
        live.kind === "shovel" &&
        this.keepOff &&
        Math.max(Math.abs(cell.x - this.keepOff.x), Math.abs(cell.z - this.keepOff.z)) < 8
      ) {
        return false;
      }
      return true;
    };
    const tryPick = (strict: boolean): Cell | null => {
      if (nearWreck) return cells.find((c) => ok(c, strict)) ?? null;
      for (let n = 0; n < 96; n++) {
        const cell = cells[Math.floor(this.rng() * cells.length)];
        if (!cell) continue;
        if (!ok(cell, strict)) continue;
        return cell;
      }
      return cells.find((c) => ok(c, strict)) ?? null;
    };
    return tryPick(true) ?? tryPick(false);
  }

  private nearestOpen(fromX: number, fromZ: number, taken: Map<string, number>): Cell | null {
    for (let radius = 1; radius < GRID; radius++) {
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          const x = fromX + dx;
          const z = fromZ + dz;
          if (!this.canStand(x, z)) continue;
          if ((taken.get(keyOf({ x, z })) ?? 0) > 0) continue;
          return { x, z };
        }
      }
    }
    return null;
  }

  private movePickup(item: Item, cell: Cell): void {
    item.cellX = cell.x;
    item.cellZ = cell.z;
    item.mesh.position.x = cell.x * CELL + CELL / 2;
    item.mesh.position.z = cell.z * CELL + CELL / 2;
    const live = this.lives.find((row) => row.item === item);
    if (live) live.cell = cell;
  }

  private place(live: Live, cell: Cell, stagger: boolean): boolean {
    const item = this.spawn(live.kind as ModelKind, cell.x, cell.z, { yaw: this.rng() * Math.PI * 2 });
    if (!item) return false;
    live.cell = cell;
    live.item = item;
    live.state = "fresh";
    live.age = stagger ? this.rng() * LOOT_FRESH_SECONDS : 0;
    item.loot = true;
    if (isFoodKind(live.kind)) item.applyFoodState();
    return true;
  }

  private trySpawn(
    live: Live,
    opts?: { stagger?: boolean; nearWreck?: boolean; ignoreCap?: boolean; awayFromPlayer?: boolean },
  ): boolean {
    const cap = lootGroundCap(live.kind, this.roomCaps);
    if (cap != null && !opts?.ignoreCap && this.groundCount(live.kind) >= cap) return false;
    const cell = this.pickCell(live, Boolean(opts?.nearWreck), Boolean(opts?.awayFromPlayer));
    if (!cell) return false;
    return this.place(live, cell, Boolean(opts?.stagger));
  }

  private despawn(live: Live): void {
    if (live.item) {
      live.item.mesh.removeFromParent();
      const i = this.items.indexOf(live.item);
      if (i >= 0) this.items.splice(i, 1);
    }
    live.item = null;
    live.state = "waiting";
    live.age = 0;
  }

  private rotItem(live: Live): void {
    if (!live.item) return;
    live.state = "rotten";
    live.age = 0;
    live.item.applyFoodState(live.item.prep, "rotten");
    tintRotten(live.item.mesh);
  }

  private spawnReplacement(kind: LootKind): void {
    const spec = FOOD.find((it) => it.kind === kind);
    if (!spec) return;
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
    this.lives.push(live);
    const cap = lootGroundCap(kind, this.roomCaps);
    if (cap != null && this.groundCount(kind) >= cap) return;
    this.trySpawn(live, { stagger: false, awayFromPlayer: true });
  }
}

