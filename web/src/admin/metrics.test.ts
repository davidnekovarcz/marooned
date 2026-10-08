import { describe, expect, it } from "vitest";
import { formatIslandSurvival, respawnLabel, roomStats, sumStats } from "@/web/src/admin/metrics";
import { cleanRoomSlug } from "@/web/src/net/protocol";
import { livedTodaySeconds, nextVisit, pragueDayKey } from "@/web/src/net/visits";

describe("cleanRoomSlug", () => {
  it("keeps a short slug and drops everything else", () => {
    expect(cleanRoomSlug("  Demo Room! ")).toBe("demoroom");
    expect(cleanRoomSlug("north-beach_2")).toBe("north-beach_2");
    expect(cleanRoomSlug("!!!")).toBeNull();
    expect(cleanRoomSlug("a".repeat(40))).toHaveLength(32);
  });
});

describe("prague day", () => {
  it("splits the calendar day at Prague midnight", () => {
    expect(pragueDayKey(Date.parse("2026-10-07T21:30:00Z"))).toBe("2026-10-07");
    expect(pragueDayKey(Date.parse("2026-10-07T22:30:00Z"))).toBe("2026-10-08");
  });

  it("starts today's survival from the life already lived before midnight", () => {
    const yesterday = Date.parse("2026-10-07T20:00:00Z");
    const today = Date.parse("2026-10-07T23:00:00Z");
    const first = nextVisit(null, 100, "Ada", yesterday);
    const rolled = nextVisit(first, 140, "Ada", today);
    expect(rolled.livedOffset).toBe(100);
    expect(livedTodaySeconds(rolled, pragueDayKey(today))).toBe(40);
    expect(roomStats([rolled], 3, pragueDayKey(today))).toEqual({
      players: 1,
      playersToday: 1,
      survivalSeconds: 140,
      survivalTodaySeconds: 40,
      peakPlayers: 3,
    });
  });
});

describe("survival label", () => {
  it("shows island days and hours and drops leftover minutes", () => {
    expect(formatIslandSurvival(0)).toBe("0h");
    expect(formatIslandSurvival(20)).toBe("1h");
    expect(formatIslandSurvival(480)).toBe("1d");
    expect(formatIslandSurvival(500)).toBe("1d 1h");
  });

  it("counts down a waiting fruit and hides a fresh one", () => {
    expect(respawnLabel({ kind: "apple", state: "waiting", age: 0, respawn: true, cellX: 1, cellZ: 2 })).toBe("2h");
    expect(respawnLabel({ kind: "axe", state: "waiting", age: 0, respawn: true, cellX: 1, cellZ: 2 })).toBe("3h");
    expect(respawnLabel({ kind: "apple", state: "fresh", age: 0, respawn: true, cellX: 1, cellZ: 2 })).toBe("—");
  });
});

describe("whole game stats", () => {
  it("adds the rooms and keeps the highest crowd", () => {
    const a = { players: 2, playersToday: 1, survivalSeconds: 10, survivalTodaySeconds: 4, peakPlayers: 3 };
    const b = { players: 1, playersToday: 0, survivalSeconds: 5, survivalTodaySeconds: 0, peakPlayers: 8 };
    expect(sumStats([a, b]).peakPlayers).toBe(8);
    expect(sumStats([a, b]).players).toBe(3);
    expect(sumStats([a, b]).survivalSeconds).toBe(15);
  });
});
