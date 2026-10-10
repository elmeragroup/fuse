import { describe, expect, it } from "vitest";

import { childGaps, formatPx, paddingBands } from "../../src/studio/lib/measure";

const NO_BORDER = { top: 0, right: 0, bottom: 0, left: 0 };

describe("paddingBands", () => {
  it("shades each padded side in screen space and labels it in CSS px", () => {
    const box = { x: 100, y: 50, width: 200, height: 80 };
    // At 2× zoom, 8px of padding covers 16 screen px.
    expect(
      paddingBands(box, { padding: { top: 8, right: 12, bottom: 8, left: 12 }, border: NO_BORDER }, 2)
    ).toEqual([
      { box: { x: 100, y: 50, width: 200, height: 16 }, px: 8 },
      { box: { x: 276, y: 66, width: 24, height: 48 }, px: 12 },
      { box: { x: 100, y: 114, width: 200, height: 16 }, px: 8 },
      { box: { x: 100, y: 66, width: 24, height: 48 }, px: 12 },
    ]);
  });

  it("draws no band for an unpadded side", () => {
    const box = { x: 0, y: 0, width: 40, height: 20 };
    expect(
      paddingBands(box, { padding: { top: 0, right: 10, bottom: 0, left: 0 }, border: NO_BORDER }, 1)
    ).toEqual([{ box: { x: 30, y: 0, width: 10, height: 20 }, px: 10 }]);
  });

  it("starts the bands inside the border at non-unit zoom", () => {
    // A 120 × 60 screen px border box at 1.5× zoom with a 2px border: the padding box starts
    // 3 screen px in, at (13, 23), and is 114 × 54. 4px and 8px of padding cover 6 and 12.
    const box = { x: 10, y: 20, width: 120, height: 60 };
    const border = { top: 2, right: 2, bottom: 2, left: 2 };
    expect(paddingBands(box, { padding: { top: 4, right: 8, bottom: 4, left: 8 }, border }, 1.5)).toEqual([
      { box: { x: 13, y: 23, width: 114, height: 6 }, px: 4 },
      { box: { x: 115, y: 29, width: 12, height: 42 }, px: 8 },
      { box: { x: 13, y: 71, width: 114, height: 6 }, px: 4 },
      { box: { x: 13, y: 29, width: 12, height: 42 }, px: 8 },
    ]);
  });
});

describe("childGaps", () => {
  it("measures the gap between children laid out in a row, across their shared height", () => {
    const children = [
      { x: 0, y: 0, width: 50, height: 40 },
      { x: 58, y: 4, width: 50, height: 30 },
    ];
    expect(childGaps(children, 1)).toEqual([{ box: { x: 50, y: 4, width: 8, height: 30 }, px: 8 }]);
  });

  it("measures the gap between stacked children, across their shared width", () => {
    const children = [
      { x: 0, y: 0, width: 100, height: 20 },
      { x: 0, y: 44, width: 80, height: 20 },
    ];
    // At half zoom, 24 screen px are 48 CSS px.
    expect(childGaps(children, 0.5)).toEqual([{ box: { x: 0, y: 20, width: 80, height: 24 }, px: 48 }]);
  });

  it("skips children that touch or overlap", () => {
    const children = [
      { x: 0, y: 0, width: 50, height: 20 },
      { x: 50, y: 0, width: 50, height: 20 },
      { x: 60, y: 10, width: 50, height: 20 },
    ];
    expect(childGaps(children, 1)).toEqual([]);
  });
});

describe("formatPx", () => {
  it.each([
    [36, "36"],
    [4.5, "4.5"],
    [35.996, "36"],
    [13.333, "13.33"],
  ])("writes %d as %s", (px, text) => {
    expect(formatPx(px)).toBe(text);
  });
});
