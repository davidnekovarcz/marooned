import { canEnter } from "@/web/src/gridOverlay";
import { isShore } from "@/web/src/island";
import type { Needs } from "@/web/src/needs";
import { cloneHeld } from "@/web/src/props";
import type { Camp } from "@/web/src/sim/camp";
import type { Weather } from "@/web/src/sim/weather";
import type { HeldKind } from "@/web/src/world/kinds";
import type { Item } from "@/web/src/world/item";
import type { GridPlayer } from "@/web/src/actor/player";

export type QaLandmark = "fishingPole" | "hutFire" | "hutTinder" | "boatFish" | "shore";

export type MaroonedQa = {
  teleport: (cellX: number, cellZ: number) => boolean;
  goLandmark: (name: QaLandmark) => boolean;
  give: (kind: HeldKind) => boolean;
  setNeeds: (partial: {
    hunger?: number;
    thirst?: number;
    health?: number;
    wetness?: number;
    temperature?: number;
    energy?: number;
  }) => void;
  setRaining: (on: boolean) => void;
  interact: () => void;
  held: () => string;
  fireLit: () => boolean;
};

const LANDMARK_KIND: Record<Exclude<QaLandmark, "shore">, string> = {
  fishingPole: "fishingPole",
  hutFire: "campfire",
  hutTinder: "tinder",
  boatFish: "fish",
};

function qaEnabled(): boolean {
  return new URLSearchParams(window.location.search).has("qa");
}

function standOn(player: GridPlayer, biomes: Uint8Array, blocked: Uint8Array, x: number, z: number): boolean {
  if (canEnter(biomes, blocked, x, z)) {
    player.placeAt(x, z);
    return true;
  }
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dz === 0) continue;
      if (canEnter(biomes, blocked, x + dx, z + dz)) {
        player.placeAt(x + dx, z + dz);
        return true;
      }
    }
  }
  return false;
}

export function installQaHarness(opts: {
  player: GridPlayer;
  biomes: Uint8Array;
  blocked: Uint8Array;
  items: Item[];
  needs: Needs;
  weather: Weather;
  camp: Camp;
  interact: () => void;
}): void {
  if (!qaEnabled()) return;

  const findKind = (kind: string): Item | undefined =>
    opts.items.find((item) => item.kind === kind && item.mesh.parent);

  const api: MaroonedQa = {
    teleport(cellX, cellZ) {
      return standOn(opts.player, opts.biomes, opts.blocked, cellX, cellZ);
    },
    goLandmark(name) {
      if (name === "shore") {
        const grid = Math.round(Math.sqrt(opts.biomes.length));
        for (let z = 0; z < grid; z++) {
          for (let x = 0; x < grid; x++) {
            if (!isShore(x, z, opts.biomes)) continue;
            if (canEnter(opts.biomes, opts.blocked, x, z)) {
              opts.player.placeAt(x, z);
              return true;
            }
          }
        }
        return false;
      }
      const item = findKind(LANDMARK_KIND[name]);
      if (!item) return false;
      return standOn(opts.player, opts.biomes, opts.blocked, item.cellX, item.cellZ);
    },
    give(kind) {
      const mesh = cloneHeld(kind);
      if (!mesh) return false;
      if (opts.player.heldKind) opts.player.stowHeld();
      opts.player.inventory.grabHeld(mesh, kind);
      return opts.player.heldKind === kind;
    },
    setNeeds(partial) {
      opts.needs.restore(partial);
    },
    setRaining(on) {
      opts.weather.pinned = on ? "rain" : "clear";
    },
    interact() {
      opts.interact();
    },
    held() {
      return opts.player.heldKind ?? "";
    },
    fireLit() {
      return opts.camp.hearths.some((hearth) => hearth.lit);
    },
  };

  window.__maroonedQa = api;
}

export function syncQaDom(held: string, fireLit: boolean): void {
  if (!qaEnabled()) return;
  document.body.dataset.qaHeld = held;
  document.body.dataset.qaFire = fireLit ? "1" : "0";
}

declare global {
  interface Window {
    __maroonedQa?: MaroonedQa;
  }
}
