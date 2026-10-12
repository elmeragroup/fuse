import { describe, expect, it } from "vitest";

import { withHighlightedRow } from "./virtual-highlight";

describe("withHighlightedRow", () => {
  it("adds a highlighted row outside the window in index order", () => {
    expect(withHighlightedRow([10, 11, 12], 999, 1000)).toEqual([10, 11, 12, 999]);
    expect(withHighlightedRow([10, 11, 12], 0, 1000)).toEqual([0, 10, 11, 12]);
  });

  it("leaves the window alone when the row is in it, out of range or absent", () => {
    expect(withHighlightedRow([10, 11, 12], 11, 1000)).toEqual([10, 11, 12]);
    expect(withHighlightedRow([0, 1], 5, 2)).toEqual([0, 1]);
    expect(withHighlightedRow([0, 1], -1, 2)).toEqual([0, 1]);
    expect(withHighlightedRow([0, 1], undefined, 2)).toEqual([0, 1]);
  });
});
