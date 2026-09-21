import { CELL } from "@/web/src/constants";
import type { Camp } from "@/web/src/sim/camp";
import type { DayClock } from "@/web/src/dayNight";
import type { Weather } from "@/web/src/sim/weather";
import { Item, type ItemSnapshot, type SpawnFn } from "@/web/src/world/item";
import type { HeldKind } from "@/web/src/world/kinds";
import type { NetWorld } from "@/web/src/net/protocol";

function moveMesh(item: Item): void {
  item.mesh.position.x = item.cellX * CELL + CELL / 2;
  item.mesh.position.z = item.cellZ * CELL + CELL / 2;
}

export type ClaimedPickup = {
  id: string;
  kind: string;
  cellX: number;
  cellZ: number;
};

function chebyshev(ax: number, az: number, bx: number, bz: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(az - bz));
}

function matchesClaim(snap: ItemSnapshot, claim: ClaimedPickup): boolean {
  if (snap.id === claim.id) return true;
  return snap.kind === claim.kind && chebyshev(snap.cellX, snap.cellZ, claim.cellX, claim.cellZ) <= 1;
}

export function applyNetWorld(
  world: NetWorld,
  items: Item[],
  spawn: SpawnFn,
  camp: Camp,
  day: DayClock,
  weather: Weather,
  onRemoved: (item: Item) => void,
  claimed: ClaimedPickup[] = [],
): void {
  day.elapsed = world.elapsed;
  day.t = world.dayT;
  weather.intensity = world.weather.intensity;
  weather.raining = world.weather.raining;
  weather.storm = world.weather.storm;
  weather.flash = world.weather.flash;

  const incoming = new Map(world.items.map((snap) => [snap.id, snap]));
  for (const item of [...items]) {
    if (incoming.has(item.id)) continue;
    item.mesh.removeFromParent();
    const i = items.indexOf(item);
    if (i >= 0) items.splice(i, 1);
    onRemoved(item);
  }

  const local = new Map(items.map((item) => [item.id, item]));
  for (const snap of world.items) {
    if (claimed.some((claim) => matchesClaim(snap, claim))) continue;
    const cur = local.get(snap.id);
    if (cur) {
      cur.cellX = snap.cellX;
      cur.cellZ = snap.cellZ;
      if (snap.prep || snap.freshness) cur.applyFoodState(snap.prep, snap.freshness);
      moveMesh(cur);
      continue;
    }
    const spawned = spawn(snap.kind as Parameters<SpawnFn>[0], snap.cellX, snap.cellZ, { id: snap.id });
    if (!spawned) continue;
    if (snap.prep || snap.freshness) spawned.applyFoodState(snap.prep, snap.freshness);
  }

  for (let i = claimed.length - 1; i >= 0; i--) {
    const claim = claimed[i]!;
    if (world.items.some((snap) => matchesClaim(snap, claim))) continue;
    claimed.splice(i, 1);
  }

  const lit = new Map(world.hearths.map((h) => [h.id, h.lit]));
  camp.scan(items);
  for (const hearth of camp.hearths) {
    hearth.lit = Boolean(lit.get(hearth.item.id));
  }
  camp.replaceShelters(world.shelters);
}

export function snapshotWorld(items: Item[], camp: Camp, day: DayClock, weather: Weather): NetWorld {
  return {
    elapsed: day.elapsed,
    dayT: day.t,
    weather: {
      intensity: weather.intensity,
      raining: Boolean(weather.raining),
      storm: Boolean(weather.storm),
      flash: weather.flash,
    },
    items: items.map((item) => item.snapshot()),
    hearths: camp.hearths.map((h) => ({ id: h.item.id, lit: Boolean(h.lit) })),
    shelters: camp.shelters.map((s) => ({ x: s.x, z: s.z })),
  };
}

export function spawnFromSnapshot(spawn: SpawnFn, snap: ItemSnapshot): Item | null {
  const item = spawn(snap.kind as Parameters<SpawnFn>[0], snap.cellX, snap.cellZ, { id: snap.id });
  if (!item) return null;
  if (snap.prep || snap.freshness) item.applyFoodState(snap.prep, snap.freshness);
  return item;
}

export function takeCarriedItem(
  spawn: SpawnFn,
  items: Item[],
  onRemoved: (item: Item) => void,
  kind: HeldKind,
  cellX: number,
  cellZ: number,
  extra?: { prep?: ItemSnapshot["prep"]; freshness?: ItemSnapshot["freshness"] },
): Item | null {
  const item = spawnFromSnapshot(spawn, {
    id: `carry-${kind}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    cellX,
    cellZ,
    prep: extra?.prep,
    freshness: extra?.freshness,
  });
  if (!item) return null;
  const i = items.indexOf(item);
  if (i >= 0) items.splice(i, 1);
  onRemoved(item);
  return item;
}
