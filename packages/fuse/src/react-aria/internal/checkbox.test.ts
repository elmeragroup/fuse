import { describe, expect, it } from "vitest";

import { checkboxVariants } from "./checkbox";

/** The ring utilities in a class string, in order. */
function ringClasses(className: string): string[] {
  return className.split(/\s+/u).filter((name) => name.startsWith("ring-"));
}

describe("GridList selection checkbox box", () => {
  // The invalid selection box is unreachable through GridList's public API, which never marks
  // its selection checkbox invalid, so the recipe is the seam. Expectations are written by hand.
  it("draws a solid 1px error line inside the invalid halo while keyboard-focused", () => {
    const { box } = checkboxVariants();
    expect(ringClasses(box({ isInvalid: true, isFocusVisible: true })).toSorted()).toEqual([
      "ring-3",
      "ring-error/20",
      "ring-offset-1",
      "ring-offset-error",
    ]);
  });

  it("fills a selected box from the primary role and an invalid one from the error role", () => {
    const { box } = checkboxVariants();
    expect(box({ isSelected: true })).toContain("[--checkbox-color:var(--primary)]");
    expect(box({ isInvalid: true })).toContain("[--checkbox-color:var(--error)]");
  });

  it("keeps the 3px error halo at rest and the plain ring on a valid focused box", () => {
    const { box } = checkboxVariants();
    expect(ringClasses(box({ isInvalid: true }))).toEqual(["ring-3", "ring-error/20"]);
    expect(ringClasses(box({ isFocusVisible: true }))).toEqual(["ring-2", "ring-ring"]);
  });
});
