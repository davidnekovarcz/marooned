import { describe, expect, it } from "vitest";
import { groundCategory } from "@/web/src/admin/ground";
import { parseRooms } from "@/web/src/admin/records";
import { formatIslandSurvival, respawnLabel, roomStats, sumStats } from "@/web/src/admin/metrics";
import { clampMaxPlayers, cleanRoomSlug, isKalokoRoomId, MAX_PLAYERS_LIMIT } from "@/web/src/net/protocol";
import { livedTodaySeconds, nextVisit, pragueDayKey } from "@/web/src/net/visits";

describe("online count", () => {
  it("counts people when the slot list comes back as an array", () => {
    const [demo] = parseRooms({ demo: { slots: [{ uid: "a" }, null, { uid: "b" }] } }, "2026-10-08");
    expect(demo?.online).toBe(2);
  });
});

describe("rooms", () => {
  it("keeps ten players on four beaches and only removes Kaloko islands", () => {
    expect(MAX_PLAYERS_LIMIT).toBe(10);
    expect(clampMaxPlayers(16)).toBe(10);
    expect(clampMaxPlayers(undefined)).toBe(10);
    expect(isKalokoRoomId("kaloko-smoke")).toBe(true);
    expect(isKalokoRoomId("kaloko-death-1791473845267")).toBe(true);
    expect(isKalokoRoomId("demo")).toBe(false);
  });
});

describe("ground categories", () => {
  it("sorts trees, nature, food, and tools apart", () => {
    expect(groundCategory("palm")).toBe("tree");
    expect(groundCategory("bush")).toBe("nature");
    expect(groundCategory("coconut")).toBe("food");
    expect(groundCategory("axe")).toBe("tool");
    expect(groundCategory("stick")).toBe("resource");
    expect(groundCategory("wreck")).toBe("wreck");
    expect(groundCategory("leanTo")).toBe("camp");
  });
});

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
