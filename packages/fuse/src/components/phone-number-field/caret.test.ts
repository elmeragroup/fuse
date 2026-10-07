import { describe, expect, it } from "vitest";

import { caretOffset, significantAfter } from "./caret";

describe("significantAfter", () => {
  it.each([
    ["91 23 45 67", 0, 8],
    ["91 23 45 67", 2, 6],
    // Before or after the space, the same six digits follow.
    ["91 23 45 67", 3, 6],
    ["91 23 45 67", 11, 0],
    // A `+` counts like a digit.
    ["+47 41 23", 0, 7],
    ["(264) 235-1", 5, 4],
  ])("counts the digits after %s at %i as %i", (text, offset, count) => {
    expect(significantAfter(text, offset)).toBe(count);
  });
});

describe("caretOffset", () => {
  it.each([
    // Six digits after: right after the 1, before the space.
    ["91 23 45 67", 6, "afterPrevious", 2],
    // Six digits after: right before the 2, after the space.
    ["91 23 45 67", 6, "beforeNext", 3],
    ["91 23 45 67", 0, "afterPrevious", 11],
    ["91 23 45 67", 0, "beforeNext", 11],
    ["91 23 45 67", 8, "afterPrevious", 0],
    ["91 23 45 67", 8, "beforeNext", 0],
    // More digits than the text holds: its start.
    ["91 23", 9, "afterPrevious", 0],
    ["91 23", 9, "beforeNext", 0],
    // A prefix the display added stays before the caret.
    ["+47 9", 0, "afterPrevious", 5],
    ["+47 91 53 45 67", 5, "afterPrevious", 8],
    ["(264) 235-1", 4, "afterPrevious", 4],
    ["(264) 235-1", 4, "beforeNext", 6],
  ] as const)("places %s with %i digits after, %s, at %i", (text, after, side, offset) => {
    expect(caretOffset(text, after, side)).toBe(offset);
  });
});
