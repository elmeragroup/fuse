import { describe, expect, it } from "vitest";

import { highlightScrollAlign, withHighlightedRow } from "./virtual-highlight";

describe("highlightScrollAlign", () => {
  it.each([
    // A programmatic highlight scrolls wherever it lands.
    ["none", 0, 1000, "end"],
    ["none", 500, 1000, "end"],
    ["none", 999, 1000, "start"],
    // A keyboard highlight scrolls only where the arrows wrap.
    ["keyboard", 0, 1000, "end"],
    ["keyboard", 999, 1000, "start"],
    ["keyboard", 500, 1000, undefined],
    // A pointer highlight is on a row the user can see.
    ["pointer", 0, 1000, undefined],
    ["pointer", 999, 1000, undefined],
  ] as const)("a %s highlight on row %i of %i scrolls to %s", (reason, index, count, expected) => {
    expect(highlightScrollAlign(reason, index, count)).toBe(expected);
  });
});

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
