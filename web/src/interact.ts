import * as THREE from "three";
import {
  BREAK_SECONDS,
  CUT_SECONDS,
  EAT_ACTION_SECONDS,
  EAT_COCONUT_HUNGER,
  EAT_COCONUT_THIRST,
  EAT_DRINK_HOLE_HUNGER,
  EAT_DRINK_HOLE_THIRST,
  EAT_FRUIT_HUNGER,
  EAT_FRUIT_THIRST,
} from "@/web/src/constants";
import type { MealKind } from "@/web/src/audio";
import {
  defaultPrep,
  formatFoodName,
  heldFoodLabel,
  isFoodKind,
  readFoodFreshness,
  readFoodPrep,
  writeFoodState,
  type FoodPrep,
} from "@/web/src/food";
import type { Needs } from "@/web/src/needs";
import type { ModelKind } from "@/web/src/models";
import { isHeldFood, type GridPlayer, type HeldKind, type PocketSlot } from "@/web/src/player";

export type WorldKind = ModelKind | "lilypad" | "torch" | "tomato";

export type WorldItemAction = {
  label: string;
  blockedReason?: string;
  meal?: { hunger: number; thirst: number };
  pickup?: HeldKind;
  needsHeld?: HeldKind;
  cut?: boolean;
  crack?: boolean;
  eatHeld?: boolean;
  drinkHeld?: boolean;
  poison?: boolean;
  keepHeld?: boolean;
};

export type WorldItem = {
  kind: WorldKind;
  name: string;
  cellX: number;
  cellZ: number;
  mesh: THREE.Object3D;
  action?: WorldItemAction;
  cut?: boolean;
  prep?: FoodPrep;
  freshness?: "fresh" | "rotten";
  loot?: boolean;
};

const NAMES: Record<WorldKind, string> = {
  palm: "Palm",
  palmBend: "Palm",
  palmShort: "Palm",
  palmSimple: "Palm",
  oak: "Oak",
  pine: "Pine",
  bush: "Bush",
  bushSmall: "Bush",
  bushDetailed: "Bush",
  flowerYellow: "Flowers",
  flowerPurple: "Flowers",
  flowerRed: "Flowers",
  mushroomTan: "Tan mushroom",
  mushroomRed: "Red mushroom",
  natureLog: "Log",
  logLarge: "Log",
  campfireLogs: "Fire pit",
  campfireStones: "Fire pit",
  rockSmall: "Rock",
  rockLarge: "Rock",
  stump: "Stump",
  wreck: "Shipwreck",
  piratePalm: "Palm",
  piratePalmStraight: "Palm",
  crate: "Crate",
  crateBottles: "Bottles",
  barrel: "Barrel",
  chest: "Chest",
  rowBoat: "Rowboat",
  mastRopes: "Mast",
  sandRock: "Rock",
  bottle: "Bottle",
  flag: "Flag",
  hammer: "Hammer",
  axe: "Axe",
  shovel: "Shovel",
  structure: "Shelter",
  tentHalf: "Tent",
  floorOld: "Floorboards",
  campfire: "Campfire",
  fishStand: "Fishing stand",
  log: "Log",
  bedroll: "Bedroll",
  bucket: "Bucket",
  tinder: "Tinder box",
  fishingBoat: "Fishing boat",
  coconut: "Coconut",
  coconutHalf: "Coconut",
  knife: "Knife",
  pineapple: "Pineapple",
  orange: "Orange",
  banana: "Banana",
  lemon: "Lemon",
  watermelon: "Melon",
  tomato: "Tomato",
  fish: "Fish",
  bow: "Bow",
  arrow: "Arrow",
  bridge: "Bridge",
  lilypad: "Lily pad",
  torch: "Torch",
};

const HELD_NAME: Record<HeldKind, string> = {
  knife: "Knife",
  hammer: "Hammer",
  axe: "Axe",
  shovel: "Shovel",
  torch: "Torch",
  tinder: "Tinder box",
  coconut: "Coconut",
  coconutHalf: "Coconut",
  orange: "Orange",
  pineapple: "Pineapple",
  banana: "Banana",
  lemon: "Lemon",
  watermelon: "Melon",
  tomato: "Tomato",
  mushroomTan: "Tan mushroom",
  mushroomRed: "Red mushroom",
};

const fruitEat: WorldItemAction = {
  label: "Eat",
  eatHeld: true,
  meal: { hunger: EAT_FRUIT_HUNGER, thirst: EAT_FRUIT_THIRST },
};

const PICKUP: WorldItemAction = { label: "Pick up" };

const ACTIONS: Partial<Record<WorldKind, WorldItemAction>> = {
  coconut: { ...PICKUP, pickup: "coconut" },
  coconutHalf: { ...PICKUP, pickup: "coconutHalf" },
  orange: { ...PICKUP, pickup: "orange" },
  banana: { ...PICKUP, pickup: "banana" },
  lemon: { ...PICKUP, pickup: "lemon" },
  watermelon: { ...PICKUP, pickup: "watermelon" },
  pineapple: { ...PICKUP, pickup: "pineapple" },
  tomato: { ...PICKUP, pickup: "tomato" },
  mushroomTan: { ...PICKUP, pickup: "mushroomTan" },
  mushroomRed: { ...PICKUP, pickup: "mushroomRed" },
  knife: { ...PICKUP, pickup: "knife" },
  hammer: { ...PICKUP, pickup: "hammer" },
  axe: { ...PICKUP, pickup: "axe" },
  shovel: { ...PICKUP, pickup: "shovel" },
  torch: { ...PICKUP, pickup: "torch" },
  tinder: { ...PICKUP, pickup: "tinder" },
};

export type SpawnFn = (
  kind: ModelKind | "torch" | "tomato",
  x: number,
  z: number,
  extra?: { yaw?: number; dx?: number; dz?: number },
) => WorldItem | null;

function itemPrep(item: WorldItem): FoodPrep {
  if (item.prep) return item.prep;
  if (isFoodKind(item.kind)) return defaultPrep(item.kind);
  return "ready";
}

function refreshFoodItem(item: WorldItem): void {
  if (!isFoodKind(item.kind)) return;
  const prep = itemPrep(item);
  const freshness = item.freshness ?? "fresh";
  item.prep = prep;
  item.name = formatFoodName(item.kind, prep, freshness);
  writeFoodState(item.mesh, prep, freshness);
  if (freshness === "rotten") {
    item.action = { label: "Rotten", blockedReason: "too rotten to eat" };
    return;
  }
  item.action = ACTIONS[item.kind];
}

export function makeWorldItem(
  kind: WorldKind,
  cellX: number,
  cellZ: number,
  mesh: THREE.Object3D,
): WorldItem {
  const item: WorldItem = {
    kind,
    name: NAMES[kind] ?? kind,
    cellX,
    cellZ,
    mesh,
    action: ACTIONS[kind],
  };
  if (isFoodKind(kind)) {
    const prep = readFoodPrep(mesh) ?? defaultPrep(kind);
    const freshness = readFoodFreshness(mesh) ?? "fresh";
    item.prep = prep;
    item.freshness = freshness;
    refreshFoodItem(item);
  }
  return item;
}

function resolveAction(item: WorldItem, held: HeldKind | null): WorldItemAction | undefined {
  if (item.freshness === "rotten") {
    return { label: "Rotten", blockedReason: "too rotten to eat" };
  }
  const prep = itemPrep(item);
  if (item.kind === "pineapple" && prep === "whole") {
    if (held === "knife") return { label: "Peel", cut: true, needsHeld: "knife" };
    return { ...PICKUP, pickup: "pineapple" };
  }
  if (item.kind === "watermelon" && prep === "whole") {
    if (held === "knife") return { label: "Slice", cut: true, needsHeld: "knife" };
    return { ...PICKUP, pickup: "watermelon" };
  }
  if (item.kind === "coconut" && (prep === "whole" || prep === "hole" || prep === "drunk")) {
    if (held === "hammer") return { label: "Split", crack: true, needsHeld: "hammer" };
    if (held === "knife" && prep === "whole") return { label: "Open", cut: true, needsHeld: "knife" };
    return { ...PICKUP, pickup: "coconut" };
  }
  return item.action;
}

function heldMealAction(held: HeldKind | null, mesh: THREE.Object3D | null): WorldItemAction | undefined {
  if (!isHeldFood(held) || !isFoodKind(held)) return undefined;
  const prep = readFoodPrep(mesh) ?? defaultPrep(held);
  const freshness = readFoodFreshness(mesh) ?? "fresh";
  if (freshness === "rotten") return { label: "Rotten", blockedReason: "too rotten to eat" };
  if (held === "coconut") {
    if (prep === "hole") {
      return {
        label: "Drink",
        eatHeld: true,
        drinkHeld: true,
        keepHeld: true,
        meal: { hunger: EAT_DRINK_HOLE_HUNGER, thirst: EAT_DRINK_HOLE_THIRST },
      };
    }
    if (prep === "half") {
      return {
        label: "Eat",
        eatHeld: true,
        meal: { hunger: EAT_COCONUT_HUNGER, thirst: EAT_COCONUT_THIRST },
      };
    }
    if (prep === "drunk") return { label: "Split (need a hammer)", blockedReason: "need a hammer" };
    return { label: "Open (need a knife or hammer)", blockedReason: "need a knife or hammer" };
  }
  if (held === "coconutHalf") {
    return {
      label: "Eat",
      eatHeld: true,
      meal: { hunger: EAT_COCONUT_HUNGER, thirst: EAT_COCONUT_THIRST },
    };
  }
  if (held === "pineapple" && prep === "whole") {
    return { label: "Peel (need a knife)", blockedReason: "need a knife" };
  }
  if (held === "watermelon" && prep === "whole") {
    return { label: "Slice (need a knife)", blockedReason: "need a knife" };
  }
  if (held === "mushroomRed") {
    return { label: "Eat", eatHeld: true, poison: true, meal: { hunger: 0, thirst: 0 } };
  }
  return fruitEat;
}

function actionEnabled(action: WorldItemAction | undefined): boolean {
  return Boolean(action && !action.blockedReason);
}

function chebyshev(ax: number, az: number, bx: number, bz: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(az - bz));
}

function slotLabel(kind: HeldKind | null, mesh: THREE.Object3D | null = null): string {
  if (!kind) return "Empty";
  if (isFoodKind(kind)) return heldFoodLabel(kind, mesh);
  return HELD_NAME[kind];
}

export function nearestItem(
  items: WorldItem[],
  cellX: number,
  cellZ: number,
  held: HeldKind | null = null,
): WorldItem | null {
  const px = cellX + 0.5;
  const pz = cellZ + 0.5;
  let best: WorldItem | null = null;
  let bestDist = Infinity;
  let bestEnabled = false;
  for (const it of items) {
    if (chebyshev(cellX, cellZ, it.cellX, it.cellZ) > 1) continue;
    const dx = it.mesh.position.x - px;
    const dz = it.mesh.position.z - pz;
    const dist = dx * dx + dz * dz;
    const enabled = actionEnabled(resolveAction(it, held));
    const closer = dist < bestDist - 1e-12;
    const tiePreferAction = Math.abs(dist - bestDist) <= 1e-12 && enabled && !bestEnabled;
    if (!best || closer || tiePreferAction) {
      best = it;
      bestDist = dist;
      bestEnabled = enabled;
    }
  }
  return best;
}

export function createInteract(
  items: WorldItem[],
  needs: Needs,
  player: GridPlayer,
  audio: { playMeal: (kind: MealKind) => void; stopMeal: () => void; playPickup: () => void },
  spawn: SpawnFn,
  onRemoved?: (item: WorldItem) => void,
): { update: (cellX: number, cellZ: number, alive: boolean, busy: boolean) => void } {
  const panelEl = document.getElementById("interact");
  const nameEl = document.getElementById("interact-name");
  const btnEl = document.getElementById("interact-action");
  if (!panelEl || !nameEl || !(btnEl instanceof HTMLButtonElement)) {
    throw new Error("Interact markup missing from index.html");
  }
  const panel = panelEl;
  const btn = btnEl;
  const gearEl = document.getElementById("gear");
  const handsItem = document.getElementById("gear-hands-item");
  const leftItem = document.getElementById("gear-left-item");
  const rightItem = document.getElementById("gear-right-item");

  let current: WorldItem | null = null;
  let currentAction: WorldItemAction | null = null;

  function hide(): void {
    current = null;
    currentAction = null;
    panel.hidden = true;
  }

  function updateGear(alive: boolean): void {
    if (!gearEl || !handsItem || !leftItem || !rightItem) return;
    if (!alive) {
      gearEl.hidden = true;
      return;
    }
    gearEl.hidden = false;
    handsItem.textContent = slotLabel(player.heldKind, player.heldMesh);
    leftItem.textContent = slotLabel(player.pocket("left"));
    rightItem.textContent = slotLabel(player.pocket("right"));
  }

  function dropToWorld(dropped: { mesh: THREE.Object3D; kind: HeldKind }): void {
    const item = makeWorldItem(dropped.kind, player.cellX, player.cellZ, dropped.mesh);
    items.push(item);
  }

  function finishKnifePrep(item: WorldItem): void {
    const kind = item.kind;
    if (kind === "pineapple") item.prep = "peeled";
    else if (kind === "watermelon") item.prep = "sliced";
    else if (kind === "coconut") item.prep = "hole";
    refreshFoodItem(item);
  }

  function perform(): void {
    const action = currentAction;
    if (!action || action.blockedReason) return;
    if (!player.alive || player.busy) return;

    if (action.eatHeld) {
      if (!isHeldFood(player.heldKind) || !isFoodKind(player.heldKind)) return;
      const food = player.heldKind;
      const keep = Boolean(action.keepHeld);
      if (!player.beginHeldMeal(EAT_ACTION_SECONDS, () => {
        audio.stopMeal();
        if (keep && player.heldMesh && food === "coconut") {
          writeFoodState(player.heldMesh, "drunk", "fresh");
        }
      }, keep)) return;
      if (action.poison) needs.poison();
      else if (action.meal) needs.feed(action.meal.hunger, action.meal.thirst);
      audio.playMeal(action.drinkHeld ? "drink" : "eat");
      hide();
      return;
    }

    const item = current;
    if (!item) return;
    player.faceToward(item.mesh.position.x, item.mesh.position.z);

    if (action.pickup) {
      const started = player.pickup(item.mesh, action.pickup);
      if (!started) return;
      if (started.dropped) dropToWorld(started.dropped);
      audio.playPickup();
      const i = items.indexOf(item);
      if (i >= 0) items.splice(i, 1);
      onRemoved?.(item);
      hide();
      return;
    }

    if (action.cut) {
      if (!player.beginCut(CUT_SECONDS, () => finishKnifePrep(item))) return;
      hide();
      return;
    }

    if (action.crack) {
      if (
        !player.beginBreak(item.mesh, BREAK_SECONDS, () => {
          const i = items.indexOf(item);
          if (i >= 0) items.splice(i, 1);
          onRemoved?.(item);
          const a = spawn("coconutHalf", item.cellX, item.cellZ, { dx: 0.18, dz: 0.08 });
          const b = spawn("coconutHalf", item.cellX, item.cellZ, { dx: -0.16, dz: 0.12, yaw: 1.3 });
          for (const half of [a, b]) {
            if (!half) continue;
            half.prep = "half";
            half.freshness = "fresh";
            refreshFoodItem(half);
          }
        })
      ) {
        return;
      }
      audio.playPickup();
      hide();
    }
  }

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    perform();
  });
  window.addEventListener("keydown", (e) => {
    if (e.code !== "Space" && e.key !== " ") return;
    if (e.repeat) return;
    if (!actionEnabled(currentAction ?? undefined)) return;
    e.preventDefault();
    perform();
  });

  function hotkey(e: KeyboardEvent): "hands" | PocketSlot | "drop" | null {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return null;
    if (e.code === "Digit1" || e.code === "Numpad1") return "left";
    if (e.code === "Digit2" || e.code === "Numpad2") return "right";
    if (e.code === "Digit0" || e.code === "Numpad0") return "hands";
    if (e.code === "KeyG") return "drop";
    return null;
  }

  window.addEventListener("keydown", (e) => {
    const action = hotkey(e);
    if (!action) return;
    if (!player.alive || player.busy) return;
    e.preventDefault();
    if (action === "drop") {
      const dropped = player.dropHeld();
      if (dropped) {
        dropToWorld(dropped);
        audio.playPickup();
      }
      return;
    }
    if (action === "hands") {
      player.stowHeld();
      return;
    }
    player.swapPocket(action);
  });

  gearEl?.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const slotBtn = target.closest("[data-slot]");
    if (!(slotBtn instanceof HTMLElement)) return;
    const slot = slotBtn.dataset.slot;
    e.preventDefault();
    if (!player.alive || player.busy) return;
    if (slot === "hands") {
      player.stowHeld();
      return;
    }
    if (slot === "left" || slot === "right") player.swapPocket(slot as PocketSlot);
  });

  return {
    update: (cellX, cellZ, alive, busy) => {
      updateGear(alive);
      if (!alive || busy) {
        hide();
        return;
      }
      const next = nearestItem(items, cellX, cellZ, player.heldKind);
      const worldAction = next ? resolveAction(next, player.heldKind) : undefined;
      const eatHeld = heldMealAction(player.heldKind, player.heldMesh);
      if (eatHeld) {
        current = null;
        currentAction = eatHeld;
      } else if (next && worldAction) {
        current = next;
        currentAction = worldAction;
      } else {
        panel.hidden = true;
        current = null;
        currentAction = null;
        return;
      }
      panel.hidden = false;
      nameEl.textContent = current
        ? current.name
        : slotLabel(player.heldKind, player.heldMesh);
      btn.hidden = false;
      btn.textContent = currentAction.label;
      btn.disabled = Boolean(currentAction.blockedReason);
    },
  };
}
