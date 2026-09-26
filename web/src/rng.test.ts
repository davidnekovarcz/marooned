import { describe, expect, it } from "vitest";

import { mulberry32, pickInt } from "./rng";

describe("mulberry32", () => {
  it("is deterministic for the same seed", () => {
    const a = mulberry32("marooned-mvp-1");
    const b = mulberry32("marooned-mvp-1");
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("picks integers inside the inclusive range", () => {
    const rng = mulberry32("sample-test");
    for (let i = 0; i < 20; i++) {
      const n = pickInt(rng, 2, 5);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(5);
    }
  });
});
