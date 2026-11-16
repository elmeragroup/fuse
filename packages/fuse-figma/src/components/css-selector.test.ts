/**
 * Which parts a compiled selector needs to be there, and which classes it names, for the cases the
 * build's optional-part tests in `component-spec.test.ts` do not reach, and which rules style every
 * child but the last. The units under test are `slotReadsOf`, `namedClasses` and
 * `exceptLastChildClass`. The oracle is CSS Selectors Level 4, under which `:has()` matches only
 * while an element its argument describes is there, a class inside a pseudo-class's argument, such
 * as a group marker, describes another element, and `.a > :not(:last-child)` matches each child of
 * an `.a` element but its last.
 */
import { describe, expect, it } from "vitest";

import { exceptLastChildClass, namedClasses, slotReadsOf } from "./css-selector";

describe("slotReadsOf", () => {
  it("reads no part where a data-slot sits outside any :has()", () => {
    expect(slotReadsOf(".x > [data-slot=chip-dot]")).toEqual({ kind: "read", tests: [], elements: [] });
  });

  it("reads an element type inside a :has(), and none outside one", () => {
    expect([slotReadsOf(".x:has( > svg)"), slotReadsOf(".x svg")]).toEqual([
      { kind: "read", tests: [], elements: [{ element: "svg", clause: ":has( > svg)" }] },
      { kind: "read", tests: [], elements: [] },
    ]);
  });

  it.each([
    ["a data-slot with no value", ".x:has([data-slot])"],
    ["a bracket that never closes", ".x:has([data-slot=chip-detail)"],
  ])("cannot read %s inside a :has()", (_case, selector) => {
    expect(slotReadsOf(selector).kind).toBe("unreadable");
  });
});

describe("namedClasses", () => {
  it("names the class a selector styles, and no group marker inside a pseudo-class's argument", () => {
    expect(namedClasses(".x:is(:where(.group\\/field)[data-disabled] *)")).toEqual(["x"]);
  });
});

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
