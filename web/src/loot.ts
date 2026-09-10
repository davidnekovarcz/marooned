import * as THREE from "three";
import {
  LOOT_FRESH_SECONDS,
  LOOT_RESPAWN_SECONDS,
  LOOT_ROTTEN_SECONDS,
  SEED,
  TOOL_RESPAWN_SECONDS,
} from "./constants";
import type { SpawnFn, WorldItem } from "./interact";
import type { ModelKind } from "./models";
import { mulberry32 } from "./rng";

export type Cell = { x: number; z: number };
export type Freshness = "fresh" | "rotten";

export type LootSites = {
  palm: Cell[];
  grove: Cell[];
  wreck: Cell[];
  boat: Cell[];
  hut: Cell[];
  forest: Cell[];
};

export type FruitKind = "coconut" | "coconutHalf" | "banana" | "orange" | "lemon" | "pineapple" | "watermelon";
export type ToolKind = "knife" | "hammer" | "axe" | "shovel" | "torch";
export type LootKind = FruitKind | ToolKind;

type SiteKey = keyof LootSites;

type Spec = {
  kind: LootKind;
  count: number;
  sites: SiteKey[];
  rots: boolean;
  /** First `nearCount` pieces spawn near this landmark so the opening beach has food. */
  near?: SiteKey;
  nearCount?: number;
  nearRadius?: number;
};

const FRUIT: Spec[] = [
  { kind: "coconut", count: 8, sites: ["palm"], rots: true, near: "wreck", nearCount: 3, nearRadius: 26 },
  { kind: "coconutHalf", count: 2, sites: ["palm"], rots: true, near: "wreck", nearCount: 1, nearRadius: 26 },
  { kind: "banana", count: 5, sites: ["palm"], rots: true, near: "wreck", nearCount: 2, nearRadius: 26 },
  { kind: "orange", count: 4, sites: ["grove"], rots: true, near: "hut", nearCount: 2, nearRadius: 22 },
  { kind: "lemon", count: 3, sites: ["grove"], rots: true, near: "hut", nearCount: 1, nearRadius: 22 },
  { kind: "pineapple", count: 3, sites: ["grove"], rots: true, near: "hut", nearCount: 1, nearRadius: 22 },
  { kind: "watermelon", count: 3, sites: ["grove"], rots: true, near: "hut", nearCount: 1, nearRadius: 22 },
];

const TOOLS: Spec[] = [
  { kind: "knife", count: 1, sites: ["wreck", "boat", "hut"], rots: false },
  { kind: "hammer", count: 1, sites: ["wreck", "hut", "boat"], rots: false },
  { kind: "shovel", count: 1, sites: ["hut", "wreck"], rots: false },
  { kind: "axe", count: 1, sites: ["forest", "hut"], rots: false },
  { kind: "torch", count: 1, sites: ["hut", "boat"], rots: false },
];

type Instance = {
  spec: Spec;
  index: number;
  cell: Cell | null;
  state: "fresh" | "rotten" | "waiting";
  age: number;
  item: WorldItem | null;
  /** After the first pickup/rot, respawn anywhere — not back at the starter cluster. */
  wander: boolean;
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

function displayName(kind: LootKind, rotten: boolean): string {
  const names: Record<LootKind, string> = {
    coconut: "Coconut",
    coconutHalf: "Open coconut",
    banana: "Banana",
    orange: "Orange",
    lemon: "Lemon",
    pineapple: "Pineapple",
    watermelon: "Watermelon",
    knife: "Knife",
    hammer: "Hammer",
    axe: "Axe",
    shovel: "Shovel",
    torch: "Torch",
  };
  const name = names[kind];
  return rotten ? `Rotten ${name.toLowerCase()}` : name;
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
  update: (dt: number) => void;
  onRemoved: (item: WorldItem) => void;
};

export function createLoot(
  sites: LootSites,
  items: WorldItem[],
  spawn: SpawnFn,
): LootSystem {
  const rng = mulberry32(`${SEED}-loot`);
  const occupied = new Set<string>();
  const instances: Instance[] = [];

  const occupiedByLoot = () => {
    occupied.clear();
    for (const inst of instances) {
      if (inst.cell && inst.state !== "waiting") occupied.add(keyOf(inst.cell));
    }
    for (const it of items) {
      occupied.add(`${it.cellX},${it.cellZ}`);
    }
  };

  const pickCell = (inst: Instance): Cell | null => {
    let cells = pool(sites, inst.spec.sites);
    if (
      !inst.wander &&
      inst.spec.near &&
      inst.index < (inst.spec.nearCount ?? 0)
    ) {
      const origin = centroid(sites[inst.spec.near]);
      const radius = inst.spec.nearRadius ?? 24;
      if (origin) {
        const close = cells.filter((c) => Math.hypot(c.x - origin.x, c.z - origin.z) <= radius);
        if (close.length) cells = close;
      }
    }
    if (!cells.length) return null;
    occupiedByLoot();
    const avoid = inst.cell;
    const tryPick = (strict: boolean): Cell | null => {
      for (let n = 0; n < 64; n++) {
        const cell = cells[Math.floor(rng() * cells.length)];
        if (!cell) continue;
        if (avoid && cell.x === avoid.x && cell.z === avoid.z) continue;
        if (strict && occupied.has(keyOf(cell))) continue;
        return cell;
      }
      return (
        cells.find(
          (c) => (!avoid || c.x !== avoid.x || c.z !== avoid.z) && (!strict || !occupied.has(keyOf(c))),
        ) ?? null
      );
    };
    return tryPick(true) ?? tryPick(false);
  };

  const place = (inst: Instance, cell: Cell): boolean => {
    const item = spawn(inst.spec.kind as ModelKind, cell.x, cell.z, { yaw: rng() * Math.PI * 2 });
    if (!item) return false;
    inst.cell = cell;
    inst.item = item;
    inst.state = "fresh";
    inst.age = 0;
    item.freshness = "fresh";
    item.loot = true;
    item.name = displayName(inst.spec.kind, false);
    return true;
  };

  const despawn = (inst: Instance, startWait: boolean): void => {
    if (inst.item) {
      inst.item.mesh.removeFromParent();
      const i = items.indexOf(inst.item);
      if (i >= 0) items.splice(i, 1);
    }
    inst.item = null;
    inst.state = "waiting";
    inst.age = startWait ? 0 : LOOT_RESPAWN_SECONDS;
    inst.wander = true;
  };

  const rotItem = (inst: Instance): void => {
    if (!inst.item) return;
    inst.state = "rotten";
    inst.age = 0;
    inst.item.freshness = "rotten";
    inst.item.name = displayName(inst.spec.kind, true);
    inst.item.action = { label: "Rotten", blockedReason: "too rotten to eat" };
    tintRotten(inst.item.mesh);
  };

  const trySpawn = (inst: Instance): void => {
    const cell = pickCell(inst);
    if (!cell) return;
    place(inst, cell);
  };

  for (const spec of [...FRUIT, ...TOOLS]) {
    for (let n = 0; n < spec.count; n++) {
      const inst: Instance = {
        spec,
        index: n,
        cell: null,
        state: "waiting",
        age: LOOT_RESPAWN_SECONDS,
        item: null,
        wander: false,
      };
      instances.push(inst);
      trySpawn(inst);
    }
  }

  const placed = instances.filter((it) => it.state !== "waiting").length;
  console.info("[loot]", {
    sites: {
      palm: sites.palm.length,
      grove: sites.grove.length,
      wreck: sites.wreck.length,
      boat: sites.boat.length,
      hut: sites.hut.length,
      forest: sites.forest.length,
    },
    placed,
    kinds: instances.map((it) => `${it.spec.kind}:${it.state}:${it.cell ? `${it.cell.x},${it.cell.z}` : "-"}`),
  });

  return {
    update: (dt: number) => {
      for (const inst of instances) {
        inst.age += dt;
        if (inst.state === "waiting") {
          const wait = inst.spec.rots ? LOOT_RESPAWN_SECONDS : TOOL_RESPAWN_SECONDS;
          if (inst.age >= wait) trySpawn(inst);
          continue;
        }
        if (!inst.spec.rots) continue;
        if (inst.state === "fresh" && inst.age >= LOOT_FRESH_SECONDS) rotItem(inst);
        else if (inst.state === "rotten" && inst.age >= LOOT_ROTTEN_SECONDS) despawn(inst, true);
      }
    },
    onRemoved: (item: WorldItem) => {
      const inst = instances.find((it) => it.item === item);
      if (!inst) return;
      inst.item = null;
      inst.state = "waiting";
      inst.age = 0;
      inst.wander = true;
    },
  };
}
