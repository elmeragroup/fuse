import { describe, expect, it } from "vitest";

import { someSideHolds, tooltipSideOffset } from "./tooltip-place";

// The oracle is arithmetic on boxes written by hand: a 320 × 225 viewport, the 400 % zoom of a
// 1280 × 900 window, and CONTRACT section 9.5's 8 px inset at every edge.
const VIEWPORT = { width: 320, height: 225 };

describe("someSideHolds", () => {
  // Each case holds the popup on one side alone, so a mutant of any one side's rule shows.
  it("holds a popup above a column that leaves room above, and on no other side", () => {
    // 120 − 60 = 60 above. Below, 215 + 60 passes 217, and 200 px fits beside neither side.
    expect(
      someSideHolds({ top: 120, right: 170, bottom: 215, left: 150 }, { width: 200, height: 60 }, VIEWPORT)
    ).toBe(true);
  });

  it("holds a popup below a column that ends high, and on no other side", () => {
    // 100 + 100 = 200, inside 225 − 8. Above, 5 − 100 is outside.
    expect(
      someSideHolds({ top: 5, right: 170, bottom: 100, left: 150 }, { width: 200, height: 100 }, VIEWPORT)
    ).toBe(true);
  });

  it("holds a popup right of a column near the left edge, and on no other side", () => {
    // 60 + 140 = 200, inside 320 − 8, and 40 − 140 is outside.
    expect(
      someSideHolds({ top: 20, right: 60, bottom: 215, left: 40 }, { width: 140, height: 120 }, VIEWPORT)
    ).toBe(true);
  });

  it("holds a popup left of a column near the right edge, and on no other side", () => {
    // 290 − 140 = 150 leaves the inset, and 310 + 140 passes 312.
    expect(
      someSideHolds({ top: 20, right: 310, bottom: 215, left: 290 }, { width: 140, height: 120 }, VIEWPORT)
    ).toBe(true);
  });

  it("holds no side for a centred column that fills the viewport's height", () => {
    // 20 px above, 10 px below, 160 px left and 150 px right of the column: none take 155 + 8.
    expect(
      someSideHolds({ top: 20, right: 170, bottom: 215, left: 160 }, { width: 155, height: 52 }, VIEWPORT)
    ).toBe(false);
  });

  it.each([
    [
      "above",
      { top: 70, right: 170, bottom: 215, left: 160 },
      { top: 69, right: 170, bottom: 215, left: 160 },
      62,
    ],
    [
      "below",
      { top: 5, right: 170, bottom: 155, left: 160 },
      { top: 5, right: 170, bottom: 156, left: 160 },
      62,
    ],
    [
      "right",
      { top: 20, right: 157, bottom: 215, left: 142 },
      { top: 20, right: 158, bottom: 215, left: 143 },
      120,
    ],
    [
      "left",
      { top: 20, right: 173, bottom: 215, left: 163 },
      { top: 20, right: 172, bottom: 215, left: 162 },
      120,
    ],
  ])(
    "counts a popup that exactly meets the inset %s as held, and one a pixel past it as not",
    (_, meets, past, height) => {
      // Above: 70 − 62 = 8. Below: 155 + 62 = 217. Right: 157 + 155 = 312. Left: 163 − 155 = 8.
      expect(someSideHolds(meets, { width: 155, height }, VIEWPORT)).toBe(true);
      expect(someSideHolds(past, { width: 155, height }, VIEWPORT)).toBe(false);
    }
  );
});

describe("tooltipSideOffset", () => {
  it("keeps a popup above or below on its column's edge whenever a side holds it", () => {
    for (const side of ["top", "bottom"]) {
      expect(
        tooltipSideOffset(
          side,
          { top: 120, right: 170, bottom: 215, left: 150 },
          { width: 140, height: 60 },
          VIEWPORT
        ),
        side
      ).toBe(0);
    }
  });

  it("reaches half a pixel over the column's edge beside it, which whole-pixel rounding cannot open into a gap", () => {
    // Rounding moves the popup by at most 0.5 px, so a 0.5 px reach leaves 0 to 1 px over the edge.
    for (const column of [
      { top: 120, right: 170, bottom: 215, left: 150 },
      { top: 20, right: 170, bottom: 215, left: 160 },
    ]) {
      expect(tooltipSideOffset("right", column, { width: 155, height: 52 }, VIEWPORT)).toBe(-0.5);
      expect(tooltipSideOffset("left", column, { width: 155, height: 52 }, VIEWPORT)).toBe(-0.5);
    }
  });

  it("moves a popup above the column down until its top meets the inset when no side holds it", () => {
    // The popup's bottom would sit at 20, so its top at 20 − 52 = −32. The offset moves the top
    // to 8: 20 − 52 − 8 = −40.
    const column = { top: 20, right: 170, bottom: 215, left: 160 };
    expect(tooltipSideOffset("top", column, { width: 155, height: 52 }, VIEWPORT)).toBe(-40);
  });

  it("moves a popup below the column up until its bottom meets the inset when no side holds it", () => {
    // Its top would sit at 215. The bottom must end at 225 − 8 = 217, so the top at 165: 165 − 215.
    const column = { top: 20, right: 170, bottom: 215, left: 160 };
    expect(tooltipSideOffset("bottom", column, { width: 155, height: 52 }, VIEWPORT)).toBe(-50);
  });
});
