/**
 * Which parts a compiled selector needs to be there, and which classes it names, for the cases the
 * build's optional-part tests in `component-spec.test.ts` do not reach. The units under test are
 * `slotReadsOf` and `namedClasses`. The oracle is CSS Selectors Level 4, under which `:has()`
 * matches only while an element its argument describes is there, and a class inside a
 * pseudo-class's argument, such as a group marker, describes another element.
 */
import { describe, expect, it } from "vitest";

import { namedClasses, slotReadsOf } from "./css-selector";

describe("slotReadsOf", () => {
  it("reads no part where a data-slot sits outside any :has()", () => {
    expect(slotReadsOf(".x > [data-slot=chip-dot]")).toEqual({ kind: "read", tests: [] });
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
