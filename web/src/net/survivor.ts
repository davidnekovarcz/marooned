import { parseCharacter, type Character } from "@/web/src/appearance";
import type { InventoryGear, StowedGear } from "@/web/src/actor/inventory";
import type { NeedsState } from "@/web/src/needs";
import { isHeldKind } from "@/web/src/world/kinds";
import type { FoodPrep, Freshness } from "@/web/src/food";

export const SURVIVOR_HZ = 0.5;
const FORCE_RESPAWN_KEY = "marooned.force-respawn";
const localKey = (roomId: string) => `marooned.survivor.${roomId}`;

export type SurvivorNeeds = Omit<NeedsState, "energyMax">;

export type NetSurvivor = {
  character: Character;
  needs: SurvivorNeeds;
  inventory: InventoryGear;
  cellX: number;
  cellZ: number;
  alive: boolean;
  deathHours: number;
  updatedAt: number;
};

export function markForceRespawn(): void {
  sessionStorage.setItem(FORCE_RESPAWN_KEY, "1");
}

export function consumeForceRespawn(): boolean {
  try {
    if (sessionStorage.getItem(FORCE_RESPAWN_KEY) !== "1") return false;
    sessionStorage.removeItem(FORCE_RESPAWN_KEY);
    return true;
  } catch {
    return false;
  }
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function parsePrep(raw: unknown): FoodPrep | undefined {
  if (raw === "whole" || raw === "hole" || raw === "drunk" || raw === "half" || raw === "peeled" || raw === "sliced" || raw === "ready") {
    return raw;
  }
  return undefined;
}

function parseGear(raw: unknown): StowedGear | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const kind = typeof o.kind === "string" ? o.kind : null;
  if (!isHeldKind(kind)) return null;
  const prep = parsePrep(o.prep);
  const freshness: Freshness | undefined = o.freshness === "rotten" || o.freshness === "fresh" ? o.freshness : undefined;
  return { kind, ...(prep ? { prep } : {}), ...(freshness ? { freshness } : {}) };
}

function parseNeed(raw: unknown, fallback: number): number {
  return typeof raw === "number" && Number.isFinite(raw) ? clamp01(raw) : fallback;
}

export function parseSurvivor(raw: unknown): NetSurvivor | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const character = parseCharacter(o.character);
  if (!character) return null;
  const invRaw = o.inventory && typeof o.inventory === "object" ? (o.inventory as Record<string, unknown>) : {};
  const needsRaw = o.needs && typeof o.needs === "object" ? (o.needs as Record<string, unknown>) : {};
  const cellX = typeof o.cellX === "number" && Number.isFinite(o.cellX) ? Math.round(o.cellX) : null;
  const cellZ = typeof o.cellZ === "number" && Number.isFinite(o.cellZ) ? Math.round(o.cellZ) : null;
  if (cellX === null || cellZ === null) return null;
  return {
    character,
    needs: {
      energy: parseNeed(needsRaw.energy, 0.75),
      thirst: parseNeed(needsRaw.thirst, 0.5),
      hunger: parseNeed(needsRaw.hunger, 0.5),
      temperature: parseNeed(needsRaw.temperature, 0.5),
      wetness: parseNeed(needsRaw.wetness, 0),
      health: parseNeed(needsRaw.health, 1),
    },
    inventory: {
      held: parseGear(invRaw.held),
      left: parseGear(invRaw.left),
      right: parseGear(invRaw.right),
    },
    cellX,
    cellZ,
    alive: o.alive !== false && parseNeed(needsRaw.health, 1) > 0,
    deathHours: typeof o.deathHours === "number" && Number.isFinite(o.deathHours) ? Math.max(0, o.deathHours) : 0,
    updatedAt: typeof o.updatedAt === "number" && Number.isFinite(o.updatedAt) ? o.updatedAt : 0,
  };
}

export function loadLocalSurvivor(roomId: string): NetSurvivor | null {
  try {
    const raw = localStorage.getItem(localKey(roomId));
    if (!raw) return null;
    return parseSurvivor(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function saveLocalSurvivor(roomId: string, row: NetSurvivor): void {
  try {
    localStorage.setItem(localKey(roomId), JSON.stringify(row));
  } catch {
    /* quota / private mode */
  }
}

export function emptyInventory(): InventoryGear {
  return { held: null, left: null, right: null };
}
