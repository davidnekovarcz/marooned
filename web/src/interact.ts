import * as THREE from "three";
import {
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
import type { GridPlayer, HeldKind } from "./player";

export type WorldKind = ModelKind | "lilypad";

export type WorldItemAction = {
  label: string;
  blockedReason?: string;
  meal?: { hunger: number; thirst: number };
  pickup?: HeldKind;
  needsHeld?: HeldKind;
  cut?: boolean;
};

export type WorldItem = {
  kind: WorldKind;
  name: string;
  cellX: number;
  cellZ: number;
  mesh: THREE.Object3D;
  action?: WorldItemAction;
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
    label: "Open (needs hammer / knife)",
    blockedReason: "needs hammer / knife",
  },
  pineapple: {
    label: "Peel (needs a knife)",
    blockedReason: "needs a knife",
    needsHeld: "knife",
    cut: true,
    meal: { hunger: EAT_PINEAPPLE_HUNGER, thirst: EAT_PINEAPPLE_THIRST },
  },
  knife: {
    label: "Pick up",
    pickup: "knife",
  },
};

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
  const action = item.action;
  if (!action) return undefined;
  if (action.needsHeld) {
    if (held === action.needsHeld) {
      return {
        ...action,
        label: "Cut / eat",
        blockedReason: undefined,
      };
    }
    return action;
  }
  return action;
}

function actionEnabled(action: WorldItemAction | undefined): boolean {
  return Boolean(action && !action.blockedReason);
}

function chebyshev(ax: number, az: number, bx: number, bz: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(az - bz));
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
): { update: (cellX: number, cellZ: number, alive: boolean, busy: boolean) => void } {
  const panelEl = document.getElementById("interact");
  const nameEl = document.getElementById("interact-name");
  const btnEl = document.getElementById("interact-action");
  if (!panelEl || !nameEl || !(btnEl instanceof HTMLButtonElement)) {
    throw new Error("Interact markup missing from index.html");
  }
  const panel = panelEl;
  const btn = btnEl;

  let current: WorldItem | null = null;

  function hide(): void {
    current = null;
    panel.hidden = true;
  }

  function dropReturnedKnife(mesh: THREE.Object3D): void {
    items.push(makeWorldItem("knife", player.cellX, player.cellZ, mesh));
  }

  function perform(): void {
    const item = current;
    if (!item) return;
    const action = resolveAction(item, player.heldKind);
    if (!action || action.blockedReason) return;
    if (!player.alive || player.busy) return;
    player.faceToward(item.mesh.position.x, item.mesh.position.z);

    if (action.pickup === "knife") {
      const started = player.beginPickup(item.mesh, PICKUP_SECONDS);
      if (!started) return;
      if (started.dropped) dropReturnedKnife(started.dropped);
      audio.playPickup();
      const i = items.indexOf(item);
      if (i >= 0) items.splice(i, 1);
      hide();
      return;
    }

    if (action.cut && action.meal) {
      if (!player.beginCut(item.mesh, CUT_SECONDS)) return;
      needs.feed(action.meal.hunger, action.meal.thirst);
      audio.playMeal("eat");
      const i = items.indexOf(item);
      if (i >= 0) items.splice(i, 1);
      hide();
      return;
    }

    if (action.meal) {
      if (!player.beginMeal(item.mesh, EAT_ACTION_SECONDS)) return;
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

  return {
    update: (cellX, cellZ, alive, busy) => {
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
