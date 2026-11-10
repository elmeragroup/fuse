import { describe, expect, it } from "vitest";

import { buttonVariants } from "../button/button-variants";
import { dataTableFilterSlots } from "./data-table-filter-variants";

/**
 * The fill classes a class string applies at rest. A class with a variant, such as `hover:bg-…`,
 * starts with the variant, so starting with `bg-` means no variant comes before it.
 */
function restFills(classes: string): string[] {
  return classes.split(/\s+/u).filter((token) => token.startsWith("bg-"));
}

describe("dataTableFilterVariants", () => {
  it("rests the chip in the outline Button's fill", () => {
    // Unit under test: the chip slot's rest fill. Oracle: the outline Button's rest fill, the
    // Trigger beside the chips in the same strip. Both must show the same surface beneath them.
    const outline = restFills(buttonVariants({ variant: "outline" }));
    expect(outline).toHaveLength(1);
    expect(restFills(dataTableFilterSlots.chip())).toEqual(outline);
  });
});
