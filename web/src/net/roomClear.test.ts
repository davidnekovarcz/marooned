import { describe, expect, it } from "vitest";
import { playerRemovePaths, roomWipePaths, shouldDeleteKalokoRoom } from "@/web/src/net/roomClear";

describe("room wipe paths", () => {
  it("clears presence, visits, world, host, stats, caps, and the respawn command", () => {
    expect(
      roomWipePaths({
        slots: { "0": { uid: "a" } },
        players: { a: { name: "Ada" } },
        intents: { a: { seq: 1 } },
        grants: { a: { ok: true } },
        survivors: { a: { alive: true } },
        visits: { a: { name: "Ada" } },
        host: "a",
        world: { items: [{ kind: "coconut" }] },
        stats: { peakPlayers: 2 },
        config: { maxPlayers: 10, createdAt: 1, groundCaps: { coconut: 4, axe: 1 } },
        commands: { respawnItems: 9 },
      }),
    ).toEqual([
      "slots/0",
      "players/a",
      "intents/a",
      "grants/a",
      "survivors/a",
      "visits/a",
      "host",
      "world",
      "stats/peakPlayers",
      "config/maxPlayers",
      "config/createdAt",
      "config/groundCaps/coconut",
      "config/groundCaps/axe",
      "commands/respawnItems",
    ]);
  });

  it("clears array slots and ground cap children without touching a missing world", () => {
    const paths = roomWipePaths({
      slots: [{ uid: "a" }, null, { uid: "b" }],
      config: { groundCaps: { stick: 2 } },
    });
    expect(paths).toEqual([
      "slots/0",
      "slots/1",
      "slots/2",
      "config/maxPlayers",
      "config/createdAt",
      "config/groundCaps/stick",
    ]);
    expect(paths.some((path) => path === "world" || path.startsWith("rooms/"))).toBe(false);
  });

  it("returns nothing for an empty snapshot", () => {
    expect(roomWipePaths(null)).toEqual([]);
  });
});

describe("player remove paths", () => {
  it("drops one player's slot and rows and leaves everyone else and the ground", () => {
    expect(
      playerRemovePaths(
        {
          slots: [{ uid: "a" }, { uid: "b" }, { uid: "b" }],
          players: { a: {}, b: {} },
          world: { items: [{ kind: "coconut" }] },
          config: { groundCaps: { coconut: 3 } },
        },
        "b",
      ),
    ).toEqual([
      "slots/1",
      "slots/2",
      "players/b",
      "survivors/b",
      "intents/b",
      "grants/b",
      "visits/b",
    ]);
  });

  it("rejects a uid that could escape the room path", () => {
    expect(playerRemovePaths({ slots: { "0": { uid: "a/b" } } }, "a/b")).toEqual([]);
  });
});

describe("kaloko auto-delete", () => {
  it("deletes a finished kaloko island and leaves demo alone", () => {
    expect(shouldDeleteKalokoRoom("kaloko-fire-1791473845267", true, 0)).toBe(true);
    expect(shouldDeleteKalokoRoom("kaloko-smoke", false, 0)).toBe(true);
    expect(shouldDeleteKalokoRoom("kaloko-smoke", false, 1)).toBe(false);
    expect(shouldDeleteKalokoRoom("demo", true, 0)).toBe(false);
  });
});
