// Unit under test: slotCentre and valueTop, the plot's own fractions. Oracle: CONTRACT section 8.15,
// where a bar and a line draw at the band centre of equal cells, section 9.5's point scale, whose
// slots run from the first edge to the last, and section 8.11's linear value axis, with every
// expected fraction worked by hand below.
import { describe, expect, it } from "vitest";

import { slotCentre, valueTop } from "./plot-geometry";

// A window of slots 2 to 5, so four slots that do not start at 0.
const WINDOW = { first: 2, last: 5 } as const;

describe("slotCentre", () => {
  it("centres a band slot in its own quarter of the width", () => {
    // Slot 3 is the second of four cells, so its centre is 1.5 / 4.
    expect(slotCentre(WINDOW, 3, "band")).toBe(0.375);
    expect(slotCentre(WINDOW, 2, "band")).toBe(0.125);
    expect(slotCentre(WINDOW, 5, "band")).toBe(0.875);
  });

  it("runs point slots from the first edge to the last", () => {
    // Four points split the width into three steps.
    expect(slotCentre(WINDOW, 2, "point")).toBe(0);
    expect(slotCentre(WINDOW, 3, "point")).toBeCloseTo(1 / 3, 12);
    expect(slotCentre(WINDOW, 5, "point")).toBe(1);
  });

  it("centres a lone point, which has no step to run along", () => {
    expect(slotCentre({ first: 4, last: 4 }, 4, "point")).toBe(0.5);
    expect(slotCentre({ first: 4, last: 4 }, 4, "band")).toBe(0.5);
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
