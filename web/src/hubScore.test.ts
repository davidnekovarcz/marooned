import { describe, expect, it, vi, afterEach } from "vitest";

import { postSurvivalScore } from "./hubScore";

describe("postSurvivalScore", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts whole island minutes to the parent frame", () => {
    const postMessage = vi.fn();
    vi.stubGlobal("window", {
      parent: { postMessage },
    });

    postSurvivalScore(2.25);

    expect(postMessage).toHaveBeenCalledWith(
      { type: "GAME_OVER", gameName: "Marooned", score: 135 },
      "*",
    );
  });

  it("does nothing when the game is not embedded", () => {
    const frame = { postMessage: vi.fn() };
    vi.stubGlobal("window", frame);
    Object.defineProperty(frame, "parent", { value: frame });

    postSurvivalScore(1);

    expect(frame.postMessage).not.toHaveBeenCalled();
  });
});
