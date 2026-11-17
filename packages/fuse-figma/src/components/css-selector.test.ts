/**
 * Which rules style every child but the last. The unit under test is `exceptLastChildClass`. The
 * oracle is CSS Selectors Level 4, under which `.a > :not(:last-child)` matches each child of an
 * `.a` element but its last.
 */
import { describe, expect, it } from "vitest";

import { exceptLastChildClass } from "./css-selector";

describe("exceptLastChildClass", () => {
  it.each([
    [
      "each child but the last of the class's element",
      ":where(.-space-x-2 > :not(:last-child))",
      "-space-x-2",
    ],
    [
      "every child of a class's element that is not its own parent's last",
      ":where(.-space-x-2:not(:last-child) > *)",
      undefined,
    ],
    [
      "the first child only, where it is not also the last",
      ":where(.-space-x-2 > :first-child:not(:last-child))",
      undefined,
    ],
    ["every descendant but a last child", ":where(.-space-x-2 :not(:last-child))", undefined],
  ])("reads a rule that styles %s", (_case, selector, spaced) => {
    expect(exceptLastChildClass(selector)).toBe(spaced);
  });
});
