import { defineStore } from "pinia";
import { SEED } from "@/web/src/constants";
import type { LocaleCode } from "@/web/src/i18n";
import type { PocketCommand } from "@/web/src/input/Input";
import type { ActionId, BlockedId } from "@/web/src/sim/actions";
import type { ItemSnapshot } from "@/web/src/world/item";
import type { HeldKind } from "@/web/src/world/kinds";
import type { FoodPrep, Freshness } from "@/web/src/food";
import type { PlayerGait } from "@/web/src/playerModel";

export const useSessionStore = defineStore("session", {
  state: () => ({
    seed: SEED,
    dayT: 0,
    clock: "08:00",
    survivedHours: 0,
    alive: true,
    sky: "sun" as "sun" | "moon",
  }),
});

export const useNeedsStore = defineStore("needs", {
  state: () => ({
    energy: 0.75,
    energyMax: 1,
    thirst: 0.5,
    hunger: 0.5,
    temperature: 0.5,
    health: 1,
  }),
});

export const usePlayerStore = defineStore("player", {
  state: () => ({
    cellX: 0,
    cellZ: 0,
    gait: "idle" as PlayerGait,
    heldKind: null as HeldKind | null,
    busy: false,
  }),
});

export const useInventoryStore = defineStore("inventory", {
  state: () => ({
    heldKind: null as HeldKind | null,
    heldPrep: undefined as FoodPrep | undefined,
    heldFreshness: undefined as Freshness | undefined,
    left: null as HeldKind | null,
    right: null as HeldKind | null,
  }),
});

export const useWorldStore = defineStore("world", {
  state: () => ({
    items: [] as ItemSnapshot[],
  }),
});

export const useUiStore = defineStore("ui", {
  state: () => ({
    locale: "en" as LocaleCode,
    nearbyItemId: null as string | null,
    promptKind: null as string | null,
    promptPrep: undefined as FoodPrep | undefined,
    promptFreshness: undefined as Freshness | undefined,
    actionId: null as ActionId | null,
    actionBlocked: undefined as BlockedId | undefined,
    audioUnlocked: false,
    dead: false,
    deathHours: 0,
    pocketQueued: null as PocketCommand | null,
    interactQueued: false,
  }),
  actions: {
    queuePocket(command: PocketCommand) {
      this.pocketQueued = command;
    },
    queueInteract() {
      this.interactQueued = true;
    },
    consumePocket(): PocketCommand | null {
      const next = this.pocketQueued;
      this.pocketQueued = null;
      return next;
    },
    consumeInteract(): boolean {
      const next = this.interactQueued;
      this.interactQueued = false;
      return next;
    },
  },
});
