import { CELL } from "@/web/src/constants";
import type { Camp } from "@/web/src/sim/camp";
import type { DayClock } from "@/web/src/dayNight";
import type { Weather } from "@/web/src/sim/weather";
import { Item, type ItemSnapshot, type SpawnFn } from "@/web/src/world/item";
import type { HeldKind } from "@/web/src/world/kinds";
import type { LootTimer, NetWorld } from "@/web/src/net/protocol";

function moveMesh(item: Item): void {
  item.mesh.position.x = item.cellX * CELL + CELL / 2;
  item.mesh.position.z = item.cellZ * CELL + CELL / 2;
}

/** Shelter pieces stay on the cells scatter built. A saved room must not slide them. */
const HUT_FIXTURE = new Set(["floorOld", "structure", "tentHalf", "campfire", "log", "bedroll", "bucket"]);

function isHutFixture(kind: string): boolean {
  return HUT_FIXTURE.has(kind);
}

export type ClaimedPickup = {
  id: string;
  kind: string;
  cellX: number;
  cellZ: number;
};

export type ClaimedHearth = {
  cellX: number;
  cellZ: number;
};

function asArray<T>(value: T[] | Record<string, T> | null | undefined): T[] {
  if (Array.isArray(value)) return value.filter((row) => row != null);
  if (value && typeof value === "object") return Object.values(value).filter((row) => row != null);
  return [];
}

function cellKey(x: number, z: number): string {
  return `${x},${z}`;
}

function chebyshev(ax: number, az: number, bx: number, bz: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(az - bz));
}

function matchesClaim(snap: ItemSnapshot, claim: ClaimedPickup): boolean {
  if (snap.id === claim.id) return true;
  return snap.kind === claim.kind && chebyshev(snap.cellX, snap.cellZ, claim.cellX, claim.cellZ) <= 1;
}

export type ApplyNetWorldOpts = {
  /** When false, keep local day/weather (stale or behind host snapshot). */
  clock?: boolean;
};

export function applyNetWorld(
  world: NetWorld,
  items: Item[],
  spawn: SpawnFn,
  camp: Camp,
  day: DayClock,
  weather: Weather,
  onRemoved: (item: Item) => void,
  claimed: ClaimedPickup[] = [],
  claimedHearths: ClaimedHearth[] = [],
  opts: ApplyNetWorldOpts = {},
): void {
  if (opts.clock !== false) {
    if (typeof world.elapsed === "number" && Number.isFinite(world.elapsed)) day.elapsed = world.elapsed;
    if (typeof world.dayT === "number" && Number.isFinite(world.dayT)) day.t = world.dayT;
    if (world.weather) {
      weather.intensity = world.weather.intensity;
      weather.raining = world.weather.raining;
      weather.storm = world.weather.storm;
      weather.flash = world.weather.flash;
    }
  }

  const snaps = asArray(world.items);
  if (world.items != null) {
    const incoming = new Map(snaps.map((snap) => [snap.id, snap]));
    for (const item of [...items]) {
      if (incoming.has(item.id) || isHutFixture(item.kind)) continue;
      item.mesh.removeFromParent();
      const i = items.indexOf(item);
      if (i >= 0) items.splice(i, 1);
      onRemoved(item);
    }

    const local = new Map(items.map((item) => [item.id, item]));
    for (const snap of snaps) {
      if (snap.kind === "bridge" || isHutFixture(snap.kind)) continue;
      if (claimed.some((claim) => matchesClaim(snap, claim))) continue;
      const cur = local.get(snap.id);
      if (cur) {
        if (isHutFixture(cur.kind)) continue;
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
      if (snaps.some((snap) => matchesClaim(snap, claim))) continue;
      claimed.splice(i, 1);
    }
  }

  const prevLit = new Map(camp.hearths.map((h) => [cellKey(h.item.cellX, h.item.cellZ), h.lit]));
  camp.scan(items);
  const hearthRows = asArray(world.hearths);
  const litById = new Map(hearthRows.map((h) => [h.id, h.lit]));
  const itemById = new Map(snaps.map((snap) => [snap.id, snap]));
  const litByCell = new Map<string, boolean>();
  for (const row of hearthRows) {
    const item = itemById.get(row.id);
    if (item) litByCell.set(cellKey(item.cellX, item.cellZ), row.lit);
  }
  for (const hearth of camp.hearths) {
    const key = cellKey(hearth.item.cellX, hearth.item.cellZ);
    const fromNet = litById.get(hearth.item.id) ?? litByCell.get(key);
    const keepLit = claimedHearths.some(
      (claim) => chebyshev(claim.cellX, claim.cellZ, hearth.item.cellX, hearth.item.cellZ) <= 1,
    );
    hearth.lit = fromNet !== undefined ? Boolean(fromNet) || keepLit : Boolean(prevLit.get(key)) || keepLit;
  }
  for (let i = claimedHearths.length - 1; i >= 0; i--) {
    const claim = claimedHearths[i]!;
    const netLit = hearthRows.some((row) => {
      if (!row.lit) return false;
      const item = itemById.get(row.id);
      return item ? chebyshev(claim.cellX, claim.cellZ, item.cellX, item.cellZ) <= 1 : false;
    });
    if (netLit) claimedHearths.splice(i, 1);
  }
  camp.replaceShelters(asArray(world.shelters));
}

export function snapshotWorld(
  items: Item[],
  camp: Camp,
  day: DayClock,
  weather: Weather,
  loot?: LootTimer[],
): NetWorld {
  return {
    elapsed: Number.isFinite(day.elapsed) ? day.elapsed : 0,
    dayT: Number.isFinite(day.t) ? day.t : 0,
    weather: {
      intensity: Number.isFinite(weather.intensity) ? weather.intensity : 0,
      raining: Boolean(weather.raining),
      storm: Boolean(weather.storm),
      flash: Number.isFinite(weather.flash) ? weather.flash : 0,
    },
    items: items.filter(Boolean).map((item) => item.snapshot()),
    hearths: camp.hearths.filter((h) => h?.item?.id).map((h) => ({ id: h.item.id, lit: Boolean(h.lit) })),
    shelters: camp.shelters.filter(Boolean).map((s) => ({ x: s.x, z: s.z })),
    ...(loot ? { loot } : {}),
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
