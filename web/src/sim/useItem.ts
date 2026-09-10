import {
  BREAK_SECONDS,
  CUT_SECONDS,
  EAT_ACTION_SECONDS,
} from "@/web/src/constants";
import { writeFoodState } from "@/web/src/food";
import type { MealKind } from "@/web/src/audio";
import type { Needs } from "@/web/src/needs";
import type { GridPlayer } from "@/web/src/actor/player";
import { actionEnabled, type ResolvedAction } from "@/web/src/sim/actions";
import { applyFoodState, makeWorldItem, type Item, type SpawnFn } from "@/web/src/world/item";
import { isHeldFood, type PocketSlot } from "@/web/src/world/kinds";

export type UseItemAudio = {
  playMeal: (kind: MealKind) => void;
  stopMeal: () => void;
  playPickup: () => void;
};

export type PromptState = {
  item: Item | null;
  action: ResolvedAction;
  nameKind: string;
  namePrep?: string;
  nameFreshness?: string;
};

function dropToWorld(
  items: Item[],
  player: GridPlayer,
  dropped: { mesh: Item["mesh"]; kind: NonNullable<GridPlayer["heldKind"]> },
): void {
  items.push(makeWorldItem(dropped.kind, player.cellX, player.cellZ, dropped.mesh));
}

function finishKnifePrep(item: Item): void {
  if (item.kind === "pineapple") applyFoodState(item, "peeled", item.freshness ?? "fresh");
  else if (item.kind === "watermelon") applyFoodState(item, "sliced", item.freshness ?? "fresh");
  else if (item.kind === "coconut") applyFoodState(item, "hole", item.freshness ?? "fresh");
}

export function performAction(
  action: ResolvedAction,
  item: Item | null,
  items: Item[],
  needs: Needs,
  player: GridPlayer,
  audio: UseItemAudio,
  spawn: SpawnFn,
  onRemoved?: (item: Item) => void,
): boolean {
  if (!actionEnabled(action)) return false;
  if (!player.alive || player.busy) return false;

  if (action.eatHeld) {
    if (!isHeldFood(player.heldKind)) return false;
    const food = player.heldKind;
    const keep = Boolean(action.keepHeld);
    if (
      !player.beginHeldMeal(
        EAT_ACTION_SECONDS,
        () => {
          audio.stopMeal();
          if (keep && player.heldMesh && food === "coconut") {
            writeFoodState(player.heldMesh, "drunk", "fresh");
          }
        },
        keep,
      )
    ) {
      return false;
    }
    if (action.poison) needs.poison();
    else if (action.meal) needs.feed(action.meal.hunger, action.meal.thirst);
    audio.playMeal(action.drinkHeld ? "drink" : "eat");
    return true;
  }

  if (!item) return false;
  player.faceToward(item.mesh.position.x, item.mesh.position.z);

  if (action.pickup) {
    const started = player.pickup(item.mesh, action.pickup);
    if (!started) return false;
    if (started.dropped) dropToWorld(items, player, started.dropped);
    audio.playPickup();
    const i = items.indexOf(item);
    if (i >= 0) items.splice(i, 1);
    onRemoved?.(item);
    return true;
  }

  if (action.cut) {
    return player.beginCut(CUT_SECONDS, () => finishKnifePrep(item));
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
          applyFoodState(half, "half", "fresh");
        }
      })
    ) {
      return false;
    }
    audio.playPickup();
    return true;
  }

  return false;
}

export function applyPocketCommand(
  command: "hands" | PocketSlot | "drop",
  items: Item[],
  player: GridPlayer,
  audio: UseItemAudio,
): void {
  if (!player.alive || player.busy) return;
  if (command === "drop") {
    const dropped = player.dropHeld();
    if (dropped) {
      dropToWorld(items, player, dropped);
      audio.playPickup();
    }
    return;
  }
  if (command === "hands") {
    player.stowHeld();
    return;
  }
  player.swapPocket(command);
}
