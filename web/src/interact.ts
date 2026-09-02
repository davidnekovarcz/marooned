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
  PICKUP_SECONDS,
} from "./constants";
import type { MealKind } from "./audio";
import type { Needs } from "./needs";
import type { ModelKind } from "./models";
import type { GridPlayer, HeldKind, PocketSlot } from "./player";

export type WorldKind = ModelKind | "lilypad";

export type WorldItemAction = {
  label: string;
  blockedReason?: string;
  meal?: { hunger: number; thirst: number };
  pickup?: HeldKind;
  needsHeld?: HeldKind;
  cut?: boolean;
  crack?: boolean;
};

export type WorldItem = {
  kind: WorldKind;
  name: string;
  cellX: number;
  cellZ: number;
  mesh: THREE.Object3D;
  action?: WorldItemAction;
  cut?: boolean;
};

const NAMES: Record<WorldKind, string> = {
  palm: "Palm",
  palmBend: "Palm",
  palmShort: "Palm",
  oak: "Oak",
  pine: "Pine",
  bush: "Bush",
  rockSmall: "Rock",
  rockLarge: "Rock",
  stump: "Stump",
  wreck: "Shipwreck",
  piratePalm: "Palm",
  crate: "Crate",
  barrel: "Barrel",
  chest: "Chest",
  rowBoat: "Rowboat",
  mastRopes: "Mast",
  sandRock: "Rock",
  hammer: "Hammer",
  axe: "Axe",
  shovel: "Shovel",
  structure: "Shelter",
  tentHalf: "Tent",
  floorOld: "Floorboards",
  campfire: "Campfire",
  fishStand: "Fishing stand",
  log: "Log",
  fishingBoat: "Fishing boat",
  coconut: "Coconut",
  coconutHalf: "Open coconut",
  knife: "Knife",
  pineapple: "Pineapple",
  orange: "Orange",
  fish: "Fish",
  bow: "Bow",
  arrow: "Arrow",
  bridge: "Bridge",
  lilypad: "Lily pad",
};

const HELD_NAME: Record<HeldKind, string> = {
  knife: "Knife",
  hammer: "Hammer",
};

const ACTIONS: Partial<Record<WorldKind, WorldItemAction>> = {
  coconutHalf: {
    label: "Eat / drink",
    meal: { hunger: EAT_COCONUT_HUNGER, thirst: EAT_COCONUT_THIRST },
  },
  orange: {
    label: "Eat",
    meal: { hunger: EAT_FRUIT_HUNGER, thirst: EAT_FRUIT_THIRST },
  },
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
  knife: {
    label: "Pick up",
    pickup: "knife",
  },
  hammer: {
    label: "Pick up",
    pickup: "hammer",
  },
};

export type SpawnFn = (
  kind: ModelKind,
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
  if (item.kind === "pineapple") {
    if (item.cut) {
      return { label: "Eat", meal: { hunger: EAT_PINEAPPLE_HUNGER, thirst: EAT_PINEAPPLE_THIRST } };
    }
    if (held === "knife") return { label: "Cut", cut: true, needsHeld: "knife" };
    return ACTIONS.pineapple;
  }
  if (item.kind === "coconut") {
    if (held === "hammer") return { label: "Break", crack: true, needsHeld: "hammer" };
    return ACTIONS.coconut;
  }
  return item.action;
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

  function hide(): void {
    current = null;
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
    items.push(makeWorldItem(dropped.kind, player.cellX, player.cellZ, dropped.mesh));
  }

  function perform(): void {
    const item = current;
    if (!item) return;
    const action = resolveAction(item, player.heldKind);
    if (!action || action.blockedReason) return;
    if (!player.alive || player.busy) return;
    player.faceToward(item.mesh.position.x, item.mesh.position.z);

    if (action.pickup) {
      const started = player.beginPickup(item.mesh, action.pickup, PICKUP_SECONDS);
      if (!started) return;
      if (started.dropped) dropToWorld(started.dropped);
      audio.playPickup();
      const i = items.indexOf(item);
      if (i >= 0) items.splice(i, 1);
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
          spawn("coconutHalf", item.cellX, item.cellZ, { dx: 0.18, dz: 0.08 });
          spawn("coconutHalf", item.cellX, item.cellZ, { dx: -0.16, dz: 0.12, yaw: 1.3 });
        })
      ) {
        return;
      }
      audio.playPickup();
      hide();
      return;
    }

    if (action.meal) {
      if (player.heldKind && !player.stowHeld()) {
        const dropped = player.dropHeld();
        if (dropped) dropToWorld(dropped);
      }
      const pineapple = item.kind === "pineapple";
      if (!player.beginMeal(item.mesh, EAT_ACTION_SECONDS, pineapple ? { pineapple: true } : undefined)) {
        return;
      }
      needs.feed(action.meal.hunger, action.meal.thirst);
      audio.playMeal(item.kind === "coconutHalf" ? "drink" : "eat");
      const i = items.indexOf(item);
      if (i >= 0) items.splice(i, 1);
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
    if (!current) return;
    const action = resolveAction(current, player.heldKind);
    if (!actionEnabled(action)) return;
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
      if (dropped) dropToWorld(dropped);
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
      current = next;
      if (!next) {
        panel.hidden = true;
        return;
      }
      panel.hidden = false;
      nameEl.textContent = next.name;
      const action = resolveAction(next, player.heldKind);
      if (!action) {
        btn.hidden = true;
        return;
      }
      btn.hidden = false;
      btn.textContent = action.label;
      btn.disabled = Boolean(action.blockedReason);
    },
  };
}
