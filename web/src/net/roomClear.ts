import { isKalokoRoomId } from "@/web/src/net/protocol";

const PRESENCE = ["slots", "players", "intents", "grants", "survivors", "visits"] as const;
const PLAYER_ROWS = ["players", "survivors", "intents", "grants", "visits"] as const;

function isRtdbKey(key: string): boolean {
  return key.length > 0 && !/[.#$[\]/]/.test(key);
}

function childKeys(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  return Object.keys(raw as Record<string, unknown>).filter(isRtdbKey);
}

/**
 * Paths under one room that a full wipe sets to null.
 * Ground loot, pockets, and visit history for this room go with it.
 * The list is relative, so a sibling room is never included.
 */
export function roomWipePaths(room: unknown): string[] {
  if (!room || typeof room !== "object") return [];
  const row = room as Record<string, unknown>;
  const paths: string[] = [];
  for (const node of PRESENCE) {
    for (const key of childKeys(row[node])) paths.push(`${node}/${key}`);
  }
  if ("host" in row) paths.push("host");
  if ("world" in row) paths.push("world");
  if (row.stats && typeof row.stats === "object") paths.push("stats/peakPlayers");
  if (row.config && typeof row.config === "object") {
    paths.push("config/maxPlayers");
    paths.push("config/createdAt");
    const caps = (row.config as { groundCaps?: unknown }).groundCaps;
    for (const key of childKeys(caps)) paths.push(`config/groundCaps/${key}`);
  }
  if (row.commands && typeof row.commands === "object") paths.push("commands/respawnItems");
  return paths;
}

/** Paths that drop one person from a room. Ground loot and other people stay. Visits go so the admin list drops them. */
export function playerRemovePaths(room: unknown, uid: string): string[] {
  if (!isRtdbKey(uid)) return [];
  const paths: string[] = [];
  if (room && typeof room === "object") {
    const slots = (room as { slots?: unknown }).slots;
    if (slots && typeof slots === "object") {
      const rows = slots as Record<string, unknown>;
      for (const key of childKeys(slots)) {
        const value = rows[key];
        if (!value || typeof value !== "object") continue;
        if ((value as { uid?: unknown }).uid === uid) paths.push(`slots/${key}`);
      }
    }
  }
  for (const node of PLAYER_ROWS) paths.push(`${node}/${uid}`);
  return paths;
}

/** Kaloko smoke islands only. `demo` and admin rooms stay. Slot 0 may delete before host uid lands. */
export function shouldDeleteKalokoRoom(roomId: string, isHost: boolean, slot: number): boolean {
  return isKalokoRoomId(roomId) && (isHost || slot === 0);
}
