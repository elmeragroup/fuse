import { describe, expect, it } from "vitest";

import { SIDE_TO_SWIPE_DIRECTION } from "./sheet";

describe("SIDE_TO_SWIPE_DIRECTION", () => {
  it("maps each side to the swipe direction that dismisses toward that edge", () => {
    expect(SIDE_TO_SWIPE_DIRECTION).toEqual({
      top: "up",
      right: "right",
      bottom: "down",
      left: "left",
    });
  });
});
