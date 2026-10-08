import type { Appearance } from "@/web/src/appearance";
import type { PocketCommand } from "@/web/src/input/Input";
import type { PlayerGait } from "@/web/src/playerModel";
import type { ResolvedAction } from "@/web/src/sim/actions";
import type { ItemSnapshot } from "@/web/src/world/item";
import type { HeldKind } from "@/web/src/world/kinds";

export const ROOM_SLOT_COUNT = 4;
/** Highest cap an admin can set. Existing occupants above a lower cap stay. */
export const MAX_PLAYERS_LIMIT = 16;
export const DEFAULT_MAX_PLAYERS = ROOM_SLOT_COUNT;

export function clampMaxPlayers(value: unknown): number {
  const n = typeof value === "number" ? Math.floor(value) : DEFAULT_MAX_PLAYERS;
  if (!Number.isFinite(n)) return DEFAULT_MAX_PLAYERS;
  return Math.min(MAX_PLAYERS_LIMIT, Math.max(1, n));
}

/** Room ids are URL slugs: letters, digits, underscore, hyphen. */
export function cleanRoomSlug(raw: string): string | null {
  const clean = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
  return clean || null;
}
export const PLAYER_HZ = 10;
export const WORLD_HZ = 2;
export const SAY_MS = 5000;
export const SAY_MAX = 72;

export type NetPlayer = {
  uid: string;
  slot: number;
  cellX: number;
  cellZ: number;
  gait: PlayerGait;
  /** Radians; which way the body is looking. */
  yaw: number;
  heldKind: HeldKind | null;
  alive: boolean;
  name: string;
  appearance: Appearance;
  /** True after a minute without input; omit when false. */
  afk?: boolean;
  /** One-line say; omit when idle. */
  say?: string;
  sayAt?: number;
};

export function liveSay(say?: string, sayAt?: number, now = Date.now()): string | null {
  if (!say || typeof sayAt !== "number" || !Number.isFinite(sayAt)) return null;
  if (now - sayAt >= SAY_MS || now - sayAt < 0) return null;
  return say;
}

export type NetIntent = {
  seq: number;
  uid: string;
  cellX: number;
  cellZ: number;
  heldKind: HeldKind | null;
  interact?: boolean;
  pocket?: PocketCommand;
  itemId?: string | null;
  action?: ResolvedAction;
  dropKind?: HeldKind;
  /** Guest already took the item locally; host only removes it from the shared ground. */
  taken?: boolean;
};

export type NetGrant = {
  seq: number;
  pickup?: ItemSnapshot;
  cook?: boolean;
};

/** Ground loot timer. Inventory is not included. */
export type LootTimer = {
  kind: string;
  state: "fresh" | "rotten" | "waiting";
  age: number;
  respawn: boolean;
  cellX: number | null;
  cellZ: number | null;
};

export type NetWorld = {
  elapsed: number;
  dayT: number;
  weather: { intensity: number; raining: boolean; storm: boolean; flash: number };
  items: ItemSnapshot[];
  hearths: { id: string; lit: boolean }[];
  shelters: { x: number; z: number }[];
  loot?: LootTimer[];
};

export function parseLootTimers(raw: unknown): LootTimer[] {
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? Object.values(raw as Record<string, unknown>)
      : [];
  const out: LootTimer[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const kind = typeof o.kind === "string" ? o.kind : "";
    if (!kind) continue;
    const state = o.state === "fresh" || o.state === "rotten" || o.state === "waiting" ? o.state : "waiting";
    const age = typeof o.age === "number" && Number.isFinite(o.age) ? Math.max(0, o.age) : 0;
    const cellX = typeof o.cellX === "number" && Number.isFinite(o.cellX) ? o.cellX : null;
    const cellZ = typeof o.cellZ === "number" && Number.isFinite(o.cellZ) ? o.cellZ : null;
    out.push({ kind, state, age, respawn: o.respawn !== false, cellX, cellZ });
  }
  return out;
}

export function roomIdFromUrl(): string {
  const raw = new URLSearchParams(window.location.search).get("room") ?? "demo";
  return cleanRoomSlug(raw) ?? "demo";
}
