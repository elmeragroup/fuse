import { describe, expect, it } from "vitest";

import { highlightScrollAlign } from "./highlight-scroll";

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
