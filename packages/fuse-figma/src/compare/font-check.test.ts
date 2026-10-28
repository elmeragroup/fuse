/**
 * Unit under test: `checkUsedFonts`, which decides whether the cells' text draws in a face the page
 * loaded. Oracle: CSS Fonts 4 §5, where a family with no face available falls through to the next
 * family in the stack, and `LICENSED_FAMILIES`, the families neither the compare page nor the real
 * file has, whose text both sides draw in that fallback. Any other family the page lacks would fall
 * back on the page alone, so it stops the run.
 */
import { Result } from "effect";
import { describe, expect, it } from "vitest";

import { checkUsedFonts } from "./font-check";
import { LICENSED_FAMILIES } from "./page-assets";

/** The page has Roboto at 400 and 500, as `@fontsource/roboto` loads it. */
const LOADED = ["400|Roboto", "500|Roboto"];

describe("the font check", () => {
  it("accepts a licensed family whose next family in the stack is loaded", () => {
    const checked = checkUsedFonts(
      [{ weight: "500", families: ['"Neo Sans"', "Roboto"] }],
      LOADED,
      LICENSED_FAMILIES
    );
    expect(Result.isSuccess(checked)).toBe(true);
  });

  it("stops at a family the page lacks that is not on the licensed list", () => {
    const checked = checkUsedFonts(
      [{ weight: "500", families: ['"Unknown Face"', "Roboto"] }],
      LOADED,
      LICENSED_FAMILIES
    );
    expect(Result.isFailure(checked) ? checked.failure.message : "").toContain("Unknown Face at weight 500");
  });

  it("stops at a licensed family whose next family has no loaded face at the weight", () => {
    const checked = checkUsedFonts(
      [{ weight: "700", families: ['"Neo Sans"', "Roboto"] }],
      LOADED,
      LICENSED_FAMILIES
    );
    expect(Result.isFailure(checked)).toBe(true);
  });
});
