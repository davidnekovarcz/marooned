import type { Appearance } from "@/web/src/appearance";
import type { PocketCommand } from "@/web/src/input/Input";
import type { PlayerGait } from "@/web/src/playerModel";
import type { ResolvedAction } from "@/web/src/sim/actions";
import type { ItemSnapshot } from "@/web/src/world/item";
import type { HeldKind } from "@/web/src/world/kinds";

export const ROOM_SLOT_COUNT = 4;
export const PLAYER_HZ = 10;
export const WORLD_HZ = 2;

export type NetPlayer = {
  uid: string;
  slot: number;
  cellX: number;
  cellZ: number;
  gait: PlayerGait;
  heldKind: HeldKind | null;
  alive: boolean;
  name: string;
  appearance: Appearance;
  /** True after a minute without input; omit when false. */
  afk?: boolean;
};

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

export type NetWorld = {
  elapsed: number;
  dayT: number;
  weather: { intensity: number; raining: boolean; storm: boolean; flash: number };
  items: ItemSnapshot[];
  hearths: { id: string; lit: boolean }[];
  shelters: { x: number; z: number }[];
};

export function roomIdFromUrl(): string {
  const raw = new URLSearchParams(window.location.search).get("room") ?? "demo";
  const clean = raw.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
  return clean || "demo";
}
