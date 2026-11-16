// Unit under test: slotCenter and valueTop, the plot's own fractions. Oracle: a bar and a line draw
// at the band center of equal cells, a point scale's slots run from the first edge to the last, and
// the value axis is linear, with every expected fraction worked by hand below.
import { describe, expect, it } from "vitest";

import { slotCenter, valueTop } from "./plot-geometry";

// A window of slots 2 to 5, so four slots that do not start at 0.
const WINDOW = { first: 2, last: 5 } as const;

describe("slotCenter", () => {
  it("centers a band slot in its own quarter of the width", () => {
    // Slot 3 is the second of four cells, so its center is 1.5 / 4.
    expect(slotCenter(WINDOW, 3, "band")).toBe(0.375);
    expect(slotCenter(WINDOW, 2, "band")).toBe(0.125);
    expect(slotCenter(WINDOW, 5, "band")).toBe(0.875);
  });

  it("runs point slots from the first edge to the last", () => {
    // Four points split the width into three steps.
    expect(slotCenter(WINDOW, 2, "point")).toBe(0);
    expect(slotCenter(WINDOW, 3, "point")).toBeCloseTo(1 / 3, 12);
    expect(slotCenter(WINDOW, 5, "point")).toBe(1);
  });

  it("centers a lone point, which has no step to run along", () => {
    expect(slotCenter({ first: 4, last: 4 }, 4, "point")).toBe(0.5);
    expect(slotCenter({ first: 4, last: 4 }, 4, "band")).toBe(0.5);
  });
});

describe("valueTop", () => {
  it("measures a value's distance from the plot top in percent of the domain", () => {
    expect(valueTop([0, 10], 10)).toBe(0);
    expect(valueTop([0, 10], 0)).toBe(100);
    expect(valueTop([0, 10], 2.5)).toBe(75);
    // Zero in [-5, 15] lies 15 of 20 units below the top.
    expect(valueTop([-5, 15], 0)).toBe(75);
  });
});
