import { describe, expect, it } from "vitest";

import { checkboxVariants } from "./checkbox";

/** The ring utilities in a class string, in order. */
function ringClasses(className: string): string[] {
  return className.split(/\s+/u).filter((name) => name.startsWith("ring-"));
}

describe("GridList selection checkbox box", () => {
  // The invalid selection box is unreachable through GridList's public API, which never marks
  // its selection checkbox invalid, so the recipe is the seam. Expectations are written by hand.
  it("swaps the invalid halo for a solid 2px error ring while keyboard-focused", () => {
    const { box } = checkboxVariants();
    expect(ringClasses(box({ isInvalid: true, isFocusVisible: true }))).toEqual(["ring-2", "ring-error"]);
  });

  it("keeps the 3px error halo at rest and the plain ring on a valid focused box", () => {
    const { box } = checkboxVariants();
    expect(ringClasses(box({ isInvalid: true }))).toEqual(["ring-3", "ring-error/20"]);
    expect(ringClasses(box({ isFocusVisible: true }))).toEqual(["ring-2", "ring-ring"]);
  });
});
