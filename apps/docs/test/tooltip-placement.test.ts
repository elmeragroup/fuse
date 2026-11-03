import { describe, expect, it } from "vitest";

import { cellSide } from "../src/components/palette-inspector/tooltip-placement";

/** A grid 300px wide from x = 100, and the cells of its columns at a given count and gap. */
function columns(count: number, gap = 8) {
  const grid = { left: 100, right: 400 };
  const width = (300 - gap * (count - 1)) / count;
  return {
    grid,
    cells: Array.from({ length: count }, (_, column) => {
      const left = 100 + column * (width + gap);
      return { left, right: left + width };
    }),
  };
}

describe("cellSide", () => {
  it.each([
    [1, ["top"]],
    [2, ["left", "right"]],
    [3, ["left", "top", "right"]],
    [5, ["left", "top", "top", "top", "right"]],
  ] as const)("places %s columns as %j", (count, sides) => {
    const { grid, cells } = columns(count);
    expect(cells.map((cell) => cellSide(cell, grid))).toEqual(sides);
  });

  it("reads a cell within a pixel of the grid's edge as in the edge column", () => {
    const grid = { left: 100, right: 400 };
    expect(cellSide({ left: 100.6, right: 196 }, grid)).toBe("left");
    expect(cellSide({ left: 304, right: 399.4 }, grid)).toBe("right");
  });
});
