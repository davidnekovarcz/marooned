import { respawnLabel, roomStats, type RoomStats } from "@/web/src/admin/metrics";
import { clampMaxPlayers, parseLootTimers, type LootTimer } from "@/web/src/net/protocol";
import { parseSurvivor } from "@/web/src/net/survivor";
import { parseVisit, type Visit } from "@/web/src/net/visits";

export type PlayerRow = {
  uid: string;
  name: string;
  alive: boolean | null;
  livedSeconds: number;
};

export type ItemRow = {
  kind: string;
  cell: string;
  state: string;
  countdown: string;
};

export type RoomRecord = {
  id: string;
  online: number;
  maxPlayers: number;
  createdAt: number | null;
  players: PlayerRow[];
  items: ItemRow[];
  stats: RoomStats;
};

function asRecord(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

function onlineCount(slots: unknown): number {
  let n = 0;
  for (const row of Object.values(asRecord(slots))) {
    if (row && typeof row === "object" && typeof (row as { uid?: unknown }).uid === "string") n += 1;
  }
  return n;
}

function itemRows(world: Record<string, unknown>): ItemRow[] {
  const timers = parseLootTimers(world.loot);
  if (timers.length) {
    return timers.map((row) => rowFromTimer(row));
  }
  const placed = Array.isArray(world.items)
    ? world.items
    : Object.values(asRecord(world.items));
  return placed.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as { kind?: unknown; cellX?: unknown; cellZ?: unknown };
    const kind = typeof item.kind === "string" ? item.kind : "";
    if (!kind) return [];
    const cell =
      typeof item.cellX === "number" && typeof item.cellZ === "number" ? `${item.cellX}, ${item.cellZ}` : "—";
    return [{ kind, cell, state: "placed", countdown: "—" }];
  });
}

function rowFromTimer(row: LootTimer): ItemRow {
  const cell = row.cellX == null || row.cellZ == null ? "—" : `${row.cellX}, ${row.cellZ}`;
  return { kind: row.kind, cell, state: row.state, countdown: respawnLabel(row) };
}

export function parseRooms(raw: unknown, today: string): RoomRecord[] {
  return Object.entries(asRecord(raw))
    .map(([id, value]) => parseRoom(id, value, today))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function parseRoom(id: string, raw: unknown, today: string): RoomRecord {
  const room = asRecord(raw);
  const config = asRecord(room.config);
  const createdAt = typeof config.createdAt === "number" && Number.isFinite(config.createdAt) ? config.createdAt : null;
  const statsNode = asRecord(room.stats);
  const peak = typeof statsNode.peakPlayers === "number" && Number.isFinite(statsNode.peakPlayers) ? statsNode.peakPlayers : 0;
  const survivors = asRecord(room.survivors);
  const visits: Visit[] = [];
  const players: PlayerRow[] = [];
  for (const [uid, visitRaw] of Object.entries(asRecord(room.visits))) {
    const visit = parseVisit(visitRaw);
    if (!visit) continue;
    visits.push(visit);
    const survivor = parseSurvivor(survivors[uid]);
    players.push({
      uid,
      name: visit.name || survivor?.character.name || uid,
      alive: survivor ? survivor.alive : null,
      livedSeconds: visit.livedSeconds,
    });
  }
  players.sort((a, b) => a.name.localeCompare(b.name));
  return {
    id,
    online: onlineCount(room.slots),
    maxPlayers: clampMaxPlayers(config.maxPlayers),
    createdAt,
    players,
    items: itemRows(asRecord(room.world)),
    stats: roomStats(visits, peak, today),
  };
}
