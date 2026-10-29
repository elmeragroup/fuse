import { describe, expect, it } from "vitest";

import { classTokens, splitVariants } from "../../../test/class-tokens";
import { buttonVariants } from "../button/button-variants";
import { dataTableFilterSlots } from "./data-table-filter-variants";

/** The fill classes a class string applies at rest, with no variant before them. */
function restFills(classes: string): string[] {
  return classTokens(classes).filter((token) => {
    const { variants, utility } = splitVariants(token);
    return variants.length === 0 && utility.startsWith("bg-");
  });
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
