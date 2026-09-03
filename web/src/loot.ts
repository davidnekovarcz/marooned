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
};

const FRUIT: Spec[] = [
  { kind: "coconut", count: 4, sites: ["palm"], rots: true },
  { kind: "coconutHalf", count: 1, sites: ["palm"], rots: true },
  { kind: "banana", count: 3, sites: ["palm"], rots: true },
  { kind: "orange", count: 3, sites: ["grove"], rots: true },
  { kind: "lemon", count: 2, sites: ["grove"], rots: true },
  { kind: "pineapple", count: 2, sites: ["grove"], rots: true },
  { kind: "watermelon", count: 2, sites: ["grove"], rots: true },
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
  cell: Cell | null;
  state: "fresh" | "rotten" | "waiting";
  age: number;
  item: WorldItem | null;
};

function keyOf(cell: Cell): string {
  return `${cell.x},${cell.z}`;
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
  };

  const pickCell = (spec: Spec, avoid: Cell | null): Cell | null => {
    const cells = pool(sites, spec.sites);
    if (!cells.length) return null;
    occupiedByLoot();
    for (let n = 0; n < 48; n++) {
      const cell = cells[Math.floor(rng() * cells.length)];
      if (!cell) continue;
      if (avoid && cell.x === avoid.x && cell.z === avoid.z) continue;
      if (occupied.has(keyOf(cell))) continue;
      return cell;
    }
    return cells.find((c) => !occupied.has(keyOf(c)) && (!avoid || c.x !== avoid.x || c.z !== avoid.z)) ?? null;
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
    inst.cell = null;
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
    const cell = pickCell(inst.spec, inst.cell);
    if (!cell) return;
    if (place(inst, cell)) return;
  };

  for (const spec of [...FRUIT, ...TOOLS]) {
    for (let n = 0; n < spec.count; n++) {
      const inst: Instance = { spec, cell: null, state: "waiting", age: LOOT_RESPAWN_SECONDS, item: null };
      instances.push(inst);
      trySpawn(inst);
    }
  }

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
      inst.cell = inst.cell;
    },
  };
}
