import * as THREE from "three";
import {
  EAT_ACTION_SECONDS,
  EAT_COCONUT_HUNGER,
  EAT_COCONUT_THIRST,
  EAT_FRUIT_HUNGER,
  EAT_FRUIT_THIRST,
} from "./constants";
import type { MealKind } from "./audio";
import type { Needs } from "./needs";
import type { ModelKind } from "./models";
import type { GridPlayer } from "./player";

export type WorldKind = ModelKind | "lilypad";

export type WorldItemAction = {
  label: string;
  blockedReason?: string;
  meal?: { hunger: number; thirst: number };
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

function chebyshev(ax: number, az: number, bx: number, bz: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(az - bz));
}

export function nearestItem(items: WorldItem[], cellX: number, cellZ: number): WorldItem | null {
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
    const enabled = Boolean(it.action && !it.action.blockedReason);
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
  audio: { playMeal: (kind: MealKind) => void },
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

  function perform(): void {
    const item = current;
    if (!item?.action || item.action.blockedReason) return;
    if (!player.alive || player.busy) return;
    player.faceToward(item.mesh.position.x, item.mesh.position.z);
    if (!player.beginMeal(item.mesh, EAT_ACTION_SECONDS)) return;
    if (item.action.meal) needs.feed(item.action.meal.hunger, item.action.meal.thirst);
    audio.playMeal(item.kind === "coconutHalf" ? "drink" : "eat");
    const i = items.indexOf(item);
    if (i >= 0) items.splice(i, 1);
    hide();
  }

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    perform();
  });
  window.addEventListener("keydown", (e) => {
    if (e.code !== "Space" && e.key !== " ") return;
    if (e.repeat) return;
    if (!current?.action || current.action.blockedReason) return;
    e.preventDefault();
    perform();
  });

  return {
    update: (cellX, cellZ, alive, busy) => {
      if (!alive || busy) {
        hide();
        return;
      }
      const next = nearestItem(items, cellX, cellZ);
      current = next;
      if (!next) {
        panel.hidden = true;
        return;
      }
      panel.hidden = false;
      nameEl.textContent = next.name;
      if (!next.action) {
        btn.hidden = true;
        return;
      }
      btn.hidden = false;
      btn.textContent = next.action.label;
      btn.disabled = Boolean(next.action.blockedReason);
    },
  };
}
