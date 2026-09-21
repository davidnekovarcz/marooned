import { Camp, cellDist } from "@/web/src/sim/camp";
import type { Item, SpawnFn } from "@/web/src/world/item";
import type { NetGrant, NetIntent } from "@/web/src/net/protocol";

function itemAt(items: Item[], id: string | null | undefined): Item | null {
  if (!id) return null;
  return items.find((it) => it.id === id) ?? null;
}

function itemForPickup(items: Item[], intent: NetIntent): Item | null {
  const kind = intent.action?.pickup;
  const byId = itemAt(items, intent.itemId);
  if (byId && cellDist(intent.cellX, intent.cellZ, byId.cellX, byId.cellZ) <= 1) {
    if (!kind || byId.kind === kind) return byId;
  }
  if (!kind) return null;
  let best: Item | null = null;
  let bestDist = Infinity;
  for (const it of items) {
    if (it.kind !== kind) continue;
    const d = cellDist(intent.cellX, intent.cellZ, it.cellX, it.cellZ);
    if (d > 1 || d >= bestDist) continue;
    best = it;
    bestDist = d;
  }
  return best;
}

function takeItem(items: Item[], item: Item, onRemoved: (item: Item) => void): void {
  item.mesh.removeFromParent();
  const i = items.indexOf(item);
  if (i >= 0) items.splice(i, 1);
  onRemoved(item);
}

/** Host mutates the shared ground / camp from a guest intent. */
export function applyHostIntent(
  intent: NetIntent,
  items: Item[],
  camp: Camp,
  spawn: SpawnFn,
  onRemoved: (item: Item) => void,
): NetGrant | null {
  if (intent.pocket === "drop" && intent.dropKind) {
    const placed = spawn(intent.dropKind as Parameters<SpawnFn>[0], intent.cellX, intent.cellZ, {
      id: `drop-${intent.uid}-${intent.seq}`,
    });
    if (placed) placed.applyFoodState();
    return { seq: intent.seq };
  }

  const action = intent.action;
  if (!intent.interact || !action) return null;

  if (action.pickup) {
    const item = itemForPickup(items, intent);
    if (!item) return null;
    const snap = item.snapshot();
    takeItem(items, item, onRemoved);
    if (intent.taken) return null;
    return { seq: intent.seq, pickup: snap };
  }

  if (action.light) {
    const hearth = camp.nearestHearth(intent.cellX, intent.cellZ);
    if (hearth && !hearth.lit) camp.light(hearth);
    return { seq: intent.seq };
  }

  if (action.cut) {
    const item = itemAt(items, intent.itemId);
    if (item?.kind === "pineapple") item.applyFoodState("peeled", item.freshness ?? "fresh");
    else if (item?.kind === "watermelon") item.applyFoodState("sliced", item.freshness ?? "fresh");
    else if (item?.kind === "coconut") item.applyFoodState("hole", item.freshness ?? "fresh");
    return { seq: intent.seq };
  }

  if (action.crack) {
    const item = itemAt(items, intent.itemId);
    if (!item) return { seq: intent.seq };
    const x = item.cellX;
    const z = item.cellZ;
    takeItem(items, item, onRemoved);
    spawn("coconutHalf", x, z, { dx: 0.18, dz: 0.08 })?.applyFoodState("half", "fresh");
    spawn("coconutHalf", x, z, { dx: -0.16, dz: 0.12, yaw: 1.3 })?.applyFoodState("half", "fresh");
    return { seq: intent.seq };
  }

  if (action.fish) {
    const fish = spawn("fish", intent.cellX, intent.cellZ);
    if (!fish) return { seq: intent.seq };
    fish.applyFoodState("ready", "fresh");
    const snap = fish.snapshot();
    takeItem(items, fish, onRemoved);
    return { seq: intent.seq, pickup: snap };
  }

  if (action.cook) {
    return { seq: intent.seq, cook: true };
  }

  if (action.build) {
    const placed = spawn("leanTo", intent.cellX, intent.cellZ);
    if (placed) camp.addShelter(intent.cellX, intent.cellZ);
    return { seq: intent.seq };
  }

  return { seq: intent.seq };
}
