import {
  BREAK_SECONDS,
  CUT_SECONDS,
  EAT_ACTION_SECONDS,
} from "@/web/src/constants";
import { writeFoodState } from "@/web/src/food";
import type { MealKind } from "@/web/src/audio";
import type { Needs } from "@/web/src/needs";
import type { GridPlayer } from "@/web/src/actor/player";
import { Actions, type ResolvedAction } from "@/web/src/sim/actions";
import { Item, type SpawnFn } from "@/web/src/world/item";
import { isHeldFood, type PocketSlot } from "@/web/src/world/kinds";

export type UseItemAudio = {
  playMeal: (kind: MealKind) => void;
  stopMeal: () => void;
  playPickup: () => void;
};

export class Interactor {
  constructor(
    private items: Item[],
    private needs: Needs,
    private player: GridPlayer,
    private audio: UseItemAudio,
    private spawn: SpawnFn,
    private actions: Actions,
    private onRemoved?: (item: Item) => void,
  ) {}

  perform(action: ResolvedAction, item: Item | null): boolean {
    if (!this.actions.enabled(action)) return false;
    if (!this.player.alive || this.player.busy) return false;

    if (action.eatHeld) {
      if (!isHeldFood(this.player.heldKind)) return false;
      const food = this.player.heldKind;
      const keep = Boolean(action.keepHeld);
      if (
        !this.player.beginHeldMeal(
          EAT_ACTION_SECONDS,
          () => {
            this.audio.stopMeal();
            if (keep && this.player.heldMesh && food === "coconut") {
              writeFoodState(this.player.heldMesh, "drunk", "fresh");
            }
          },
          keep,
        )
      ) {
        return false;
      }
      if (action.poison) this.needs.poison();
      else if (action.meal) this.needs.feed(action.meal.hunger, action.meal.thirst);
      this.audio.playMeal(action.drinkHeld ? "drink" : "eat");
      return true;
    }

    if (!item) return false;
    this.player.faceToward(item.mesh.position.x, item.mesh.position.z);

    if (action.pickup) {
      const started = this.player.pickup(item.mesh, action.pickup);
      if (!started) return false;
      if (started.dropped) this.dropToWorld(started.dropped);
      this.audio.playPickup();
      const i = this.items.indexOf(item);
      if (i >= 0) this.items.splice(i, 1);
      this.onRemoved?.(item);
      return true;
    }

    if (action.cut) {
      return this.player.beginCut(CUT_SECONDS, () => this.finishKnifePrep(item));
    }

    if (action.crack) {
      if (
        !this.player.beginBreak(item.mesh, BREAK_SECONDS, () => {
          const i = this.items.indexOf(item);
          if (i >= 0) this.items.splice(i, 1);
          this.onRemoved?.(item);
          const a = this.spawn("coconutHalf", item.cellX, item.cellZ, { dx: 0.18, dz: 0.08 });
          const b = this.spawn("coconutHalf", item.cellX, item.cellZ, { dx: -0.16, dz: 0.12, yaw: 1.3 });
          for (const half of [a, b]) {
            half?.applyFoodState("half", "fresh");
          }
        })
      ) {
        return false;
      }
      this.audio.playPickup();
      return true;
    }

    return false;
  }

  pocket(command: "hands" | PocketSlot | "drop"): void {
    if (!this.player.alive || this.player.busy) return;
    if (command === "drop") {
      const dropped = this.player.dropHeld();
      if (dropped) {
        this.dropToWorld(dropped);
        this.audio.playPickup();
      }
      return;
    }
    if (command === "hands") {
      this.player.stowHeld();
      return;
    }
    this.player.swapPocket(command);
  }

  private dropToWorld(dropped: { mesh: Item["mesh"]; kind: NonNullable<GridPlayer["heldKind"]> }): void {
    this.items.push(new Item(dropped.kind, this.player.cellX, this.player.cellZ, dropped.mesh));
  }

  private finishKnifePrep(item: Item): void {
    if (item.kind === "pineapple") item.applyFoodState("peeled", item.freshness ?? "fresh");
    else if (item.kind === "watermelon") item.applyFoodState("sliced", item.freshness ?? "fresh");
    else if (item.kind === "coconut") item.applyFoodState("hole", item.freshness ?? "fresh");
  }
}
