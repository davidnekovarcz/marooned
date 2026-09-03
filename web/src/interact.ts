import * as THREE from "three";
import {
  BREAK_SECONDS,
  CUT_SECONDS,
  EAT_ACTION_SECONDS,
  EAT_COCONUT_HUNGER,
  EAT_COCONUT_THIRST,
  EAT_FRUIT_HUNGER,
  EAT_FRUIT_THIRST,
  EAT_PINEAPPLE_HUNGER,
  EAT_PINEAPPLE_THIRST,
} from "./constants";
import type { MealKind } from "./audio";
import type { Needs } from "./needs";
import type { ModelKind } from "./models";
import { isHeldFood, type GridPlayer, type HeldKind, type PocketSlot } from "./player";

export type WorldKind = ModelKind | "lilypad" | "torch";

export type WorldItemAction = {
  label: string;
  blockedReason?: string;
  meal?: { hunger: number; thirst: number };
  pickup?: HeldKind;
  needsHeld?: HeldKind;
  cut?: boolean;
  crack?: boolean;
  eatHeld?: boolean;
};

export type WorldItem = {
  kind: WorldKind;
  name: string;
  cellX: number;
  cellZ: number;
  mesh: THREE.Object3D;
  action?: WorldItemAction;
  cut?: boolean;
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
  mushroomTan: "Mushroom",
  mushroomRed: "Mushroom",
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
  coconutHalf: "Open coconut",
  knife: "Knife",
  pineapple: "Pineapple",
  orange: "Orange",
  banana: "Banana",
  lemon: "Lemon",
  watermelon: "Watermelon",
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
  coconutHalf: "Open coconut",
  orange: "Orange",
  pineapple: "Pineapple",
  banana: "Banana",
  lemon: "Lemon",
  watermelon: "Watermelon",
};

const fruitEat: WorldItemAction = {
  label: "Eat",
  eatHeld: true,
  meal: { hunger: EAT_FRUIT_HUNGER, thirst: EAT_FRUIT_THIRST },
};

const HELD_MEAL: Record<
  "coconutHalf" | "orange" | "pineapple" | "banana" | "lemon" | "watermelon",
  WorldItemAction
> = {
  coconutHalf: {
    label: "Eat / drink",
    eatHeld: true,
    meal: { hunger: EAT_COCONUT_HUNGER, thirst: EAT_COCONUT_THIRST },
  },
  orange: fruitEat,
  pineapple: {
    label: "Eat",
    eatHeld: true,
    meal: { hunger: EAT_PINEAPPLE_HUNGER, thirst: EAT_PINEAPPLE_THIRST },
  },
  banana: fruitEat,
  lemon: fruitEat,
  watermelon: fruitEat,
};

const PICKUP: WorldItemAction = { label: "Pick up" };

const ACTIONS: Partial<Record<WorldKind, WorldItemAction>> = {
  coconutHalf: { ...PICKUP, pickup: "coconutHalf" },
  orange: { ...PICKUP, pickup: "orange" },
  banana: { ...PICKUP, pickup: "banana" },
  lemon: { ...PICKUP, pickup: "lemon" },
  watermelon: { ...PICKUP, pickup: "watermelon" },
  coconut: {
    label: "Break (needs a hammer)",
    blockedReason: "needs a hammer",
    needsHeld: "hammer",
  },
  pineapple: {
    label: "Peel (needs a knife)",
    blockedReason: "needs a knife",
    needsHeld: "knife",
  },
  knife: { ...PICKUP, pickup: "knife" },
  hammer: { ...PICKUP, pickup: "hammer" },
  axe: { ...PICKUP, pickup: "axe" },
  shovel: { ...PICKUP, pickup: "shovel" },
  torch: { ...PICKUP, pickup: "torch" },
  tinder: { ...PICKUP, pickup: "tinder" },
};

export type SpawnFn = (
  kind: ModelKind | "torch",
  x: number,
  z: number,
  extra?: { yaw?: number; dx?: number; dz?: number },
) => WorldItem | null;

export function makeWorldItem(
  kind: WorldKind,
  cellX: number,
  cellZ: number,
  mesh: THREE.Object3D,
): WorldItem {
  return {
    kind,
    name: NAMES[kind] ?? kind,
    cellX,
    cellZ,
    mesh,
    action: ACTIONS[kind],
  };
}

function resolveAction(item: WorldItem, held: HeldKind | null): WorldItemAction | undefined {
  if (item.freshness === "rotten") {
    return { label: "Rotten", blockedReason: "too rotten to eat" };
  }
  if (item.kind === "pineapple") {
    if (item.cut) return { label: "Pick up", pickup: "pineapple" };
    if (held === "knife") return { label: "Cut", cut: true, needsHeld: "knife" };
    return ACTIONS.pineapple;
  }
  if (item.kind === "coconut") {
    if (held === "hammer") return { label: "Break", crack: true, needsHeld: "hammer" };
    return ACTIONS.coconut;
  }
  return item.action;
}

function heldMealAction(held: HeldKind | null): WorldItemAction | undefined {
  if (!isHeldFood(held)) return undefined;
  return HELD_MEAL[held];
}

function actionEnabled(action: WorldItemAction | undefined): boolean {
  return Boolean(action && !action.blockedReason);
}

function chebyshev(ax: number, az: number, bx: number, bz: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(az - bz));
}

function slotLabel(kind: HeldKind | null): string {
  return kind ? HELD_NAME[kind] : "Empty";
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
  audio: { playMeal: (kind: MealKind) => void; playPickup: () => void },
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
    handsItem.textContent = slotLabel(player.heldKind);
    leftItem.textContent = slotLabel(player.pocket("left"));
    rightItem.textContent = slotLabel(player.pocket("right"));
  }

  function dropToWorld(dropped: { mesh: THREE.Object3D; kind: HeldKind }): void {
    const item = makeWorldItem(dropped.kind, player.cellX, player.cellZ, dropped.mesh);
    if (dropped.kind === "pineapple") {
      item.cut = true;
      item.name = "Cut pineapple";
    }
    items.push(item);
  }

  function perform(): void {
    const action = currentAction;
    if (!action || action.blockedReason) return;
    if (!player.alive || player.busy) return;

    if (action.eatHeld) {
      if (!action.meal || !isHeldFood(player.heldKind)) return;
      const food = player.heldKind;
      if (!player.beginHeldMeal(EAT_ACTION_SECONDS)) return;
      needs.feed(action.meal.hunger, action.meal.thirst);
      audio.playMeal(food === "coconutHalf" ? "drink" : "eat");
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
      if (!player.beginCut(CUT_SECONDS, () => {
        item.cut = true;
        item.name = "Cut pineapple";
      })) return;
      hide();
      return;
    }

    if (action.crack) {
      if (
        !player.beginBreak(item.mesh, BREAK_SECONDS, () => {
          const i = items.indexOf(item);
          if (i >= 0) items.splice(i, 1);
          onRemoved?.(item);
          spawn("coconutHalf", item.cellX, item.cellZ, { dx: 0.18, dz: 0.08 });
          spawn("coconutHalf", item.cellX, item.cellZ, { dx: -0.16, dz: 0.12, yaw: 1.3 });
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
      const eatHeld = heldMealAction(player.heldKind);
      const preferWorld = Boolean(next && actionEnabled(worldAction));
      if (preferWorld && next && worldAction) {
        current = next;
        currentAction = worldAction;
      } else if (eatHeld) {
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
      nameEl.textContent = current ? current.name : slotLabel(player.heldKind);
      btn.hidden = false;
      btn.textContent = currentAction.label;
      btn.disabled = Boolean(currentAction.blockedReason);
    },
  };
}
