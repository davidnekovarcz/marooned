import { LOOT_RESPAWN_SECONDS, TOOL_RESPAWN_SECONDS } from "@/web/src/constants";
import { livedHoursFromSeconds } from "@/web/src/dayNight";
import type { LootTimer } from "@/web/src/net/protocol";
import { livedTodaySeconds, type Visit } from "@/web/src/net/visits";

const TOOL_LOOT = new Set(["knife", "hammer", "shovel", "axe", "torch"]);

export function respawnWaitSeconds(kind: string): number {
  return TOOL_LOOT.has(kind) ? TOOL_RESPAWN_SECONDS : LOOT_RESPAWN_SECONDS;
}

/** Island days and hours. Leftover minutes are dropped. */
export function formatIslandSurvival(livedSeconds: number): string {
  const totalMinutes = Math.max(0, Math.floor(livedHoursFromSeconds(livedSeconds) * 60));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  if (days > 0 && hours > 0) return `${days}d ${hours}h`;
  if (days > 0) return `${days}d`;
  return `${hours}h`;
}

export type RoomStats = {
  players: number;
  playersToday: number;
  survivalSeconds: number;
  survivalTodaySeconds: number;
  peakPlayers: number;
};

export function roomStats(visits: Visit[], peakPlayers: number, today: string): RoomStats {
  let playersToday = 0;
  let survivalSeconds = 0;
  let survivalTodaySeconds = 0;
  for (const visit of visits) {
    survivalSeconds += visit.livedSeconds;
    if (visit.dayKey === today) {
      playersToday += 1;
      survivalTodaySeconds += livedTodaySeconds(visit, today);
    }
  }
  return {
    players: visits.length,
    playersToday,
    survivalSeconds,
    survivalTodaySeconds,
    peakPlayers: Math.max(0, peakPlayers),
  };
}

export function sumStats(rows: RoomStats[]): RoomStats {
  return rows.reduce(
    (sum, row) => ({
      players: sum.players + row.players,
      playersToday: sum.playersToday + row.playersToday,
      survivalSeconds: sum.survivalSeconds + row.survivalSeconds,
      survivalTodaySeconds: sum.survivalTodaySeconds + row.survivalTodaySeconds,
      peakPlayers: Math.max(sum.peakPlayers, row.peakPlayers),
    }),
    { players: 0, playersToday: 0, survivalSeconds: 0, survivalTodaySeconds: 0, peakPlayers: 0 },
  );
}

/** Remaining island time before a waiting item can return. Placed items have no countdown. */
export function respawnLabel(row: LootTimer): string {
  if (row.state !== "waiting" || !row.respawn) return "—";
  const left = Math.max(0, respawnWaitSeconds(row.kind) - row.age);
  return formatIslandSurvival(left);
}
