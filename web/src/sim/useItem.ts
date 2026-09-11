import * as THREE from "three";
import {
  BREAK_SECONDS,
  BUILD_SECONDS,
  COOK_SECONDS,
  CUT_SECONDS,
  DRINK_POND_SECONDS,
  EAT_ACTION_SECONDS,
  FISH_SECONDS,
  LEAN_TO_FIBER,
  LEAN_TO_STICKS,
  LIGHT_SECONDS,
} from "@/web/src/constants";
import { writeFoodState } from "@/web/src/food";
import type { MealKind } from "@/web/src/audio";
import type { Needs } from "@/web/src/needs";
import type { GridPlayer } from "@/web/src/actor/player";
import { Actions, type ResolvedAction } from "@/web/src/sim/actions";
import { Camp, countNearby, takeNearby } from "@/web/src/sim/camp";
import { Item, type SpawnFn } from "@/web/src/world/item";
import { isHeldFood, type PocketSlot } from "@/web/src/world/kinds";

export type UseItemAudio = {
  playMeal: (kind: MealKind) => void;
  stopMeal: () => void;
  playPickup: () => void;
  playSplash: () => void;
  playDrink: () => void;
  playBuild: () => void;
  playLight: () => void;
  playCook: () => void;
};

function tintCooked(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = src.map((mat) => {
      const clone = mat.clone();
      const colored = clone as THREE.MeshStandardMaterial;
      if (colored.color) colored.color.setHex(0xc56a28);
      return clone;
    });
    mesh.material = Array.isArray(mesh.material) ? next : next[0]!;
  });
}

export class Interactor {
  constructor(
    private items: Item[],
    private needs: Needs,
    private player: GridPlayer,
    private audio: UseItemAudio,
    private spawn: SpawnFn,
    private actions: Actions,
    private camp: Camp,
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

    if (action.pond) {
      this.audio.playDrink();
      return this.player.beginWork(DRINK_POND_SECONDS, () => {
        if (action.meal) this.needs.feed(action.meal.hunger, action.meal.thirst);
      });
    }

    if (action.fish) {
      this.audio.playSplash();
      return this.player.beginWork(FISH_SECONDS, () => this.catchFish());
    }

    if (action.light) {
      const hearth = this.camp.nearestHearth(this.player.cellX, this.player.cellZ);
      if (!hearth || hearth.lit) return false;
      this.player.faceToward(hearth.item.mesh.position.x, hearth.item.mesh.position.z);
      return this.player.beginWork(LIGHT_SECONDS, () => {
        this.camp.light(hearth);
        this.audio.playLight();
      });
    }

    if (action.cook) {
      if (this.player.heldKind !== "fish" || !this.player.heldMesh) return false;
      const mesh = this.player.heldMesh;
      return this.player.beginWork(COOK_SECONDS, () => {
        if (this.player.heldKind !== "fish" || this.player.heldMesh !== mesh) return;
        tintCooked(mesh);
        this.player.inventory.relabelHeld("fishCooked");
        writeFoodState(mesh, "ready", "fresh");
        this.audio.playCook();
      });
    }

    if (action.build) {
      if (this.player.heldKind !== "hammer") return false;
      const x = this.player.cellX;
      const z = this.player.cellZ;
      if (
        countNearby("stick", this.player, this.items, x, z) < LEAN_TO_STICKS ||
        countNearby("fiber", this.player, this.items, x, z) < LEAN_TO_FIBER
      ) {
        return false;
      }
      this.audio.playBuild();
      return this.player.beginWork(BUILD_SECONDS, () => {
        takeNearby("stick", LEAN_TO_STICKS, this.player, this.items, x, z, this.onRemoved);
        takeNearby("fiber", LEAN_TO_FIBER, this.player, this.items, x, z, this.onRemoved);
        const placed = this.spawn("leanTo", x, z, { yaw: this.player.mesh.rotation.y + Math.PI });
        if (placed) this.camp.addShelter(x, z);
        this.audio.playBuild();
      });
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

  private catchFish(): void {
    const item = this.spawn("fish", this.player.cellX, this.player.cellZ);
    if (!item) return;
    item.applyFoodState("ready", "fresh");
    const started = this.player.pickup(item.mesh, "fish");
    if (!started) return;
    if (started.dropped) this.dropToWorld(started.dropped);
    const i = this.items.indexOf(item);
    if (i >= 0) this.items.splice(i, 1);
    this.onRemoved?.(item);
    this.audio.playSplash();
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
