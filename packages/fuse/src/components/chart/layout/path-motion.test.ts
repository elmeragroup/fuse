// Unit under test: pathMotion, the mode a path reaches new data in. Oracle: the four modes of
// motion-decision.md, read off hand-written slot keys, and issue #515's rule that unevenly spaced
// slots never slide.
import { describe, expect, it } from "vitest";

import { pathMotion } from "./path-motion";

describe("a window that shifts by whole slots", () => {
  const before = { keys: ["0", "5", "20"], ids: ["0", "5", "20"] };
  const after = { keys: ["5", "20", "50"], ids: ["5", "20", "50"] };

  it("slides one slot on an even grid and crossfades over unevenly spaced slots", () => {
    expect(pathMotion(before, after)).toEqual({ mode: "slide", by: 1 });
    // A slide moves every vertex by one even step, which a linear axis's slots do not share.
    expect(pathMotion({ ...before, spacing: "uneven" }, { ...after, spacing: "uneven" })).toEqual({
      mode: "crossfade",
    });
  });
});
