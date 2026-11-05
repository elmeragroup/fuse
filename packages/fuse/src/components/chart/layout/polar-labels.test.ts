// Polar labels. Unit under test: insideLabel, outsideLabels and angleLabel. Oracles: CONTRACT
// section 8.4's three-slice fixture, chart-1, chart-seq-4 and chart-other, which gives one inside
// and two outside labels; ticket 08's Q10 leaders, which leave the rim on the slice's bisector and
// turn 8 % past it; d3's arc centroid, which d3-shape's own tests check through arc-path.test.ts;
// and the property that no two label boxes overlap.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { angleLabel, insideLabel, outsideLabels } from "./polar-labels";
import type { LabelBox } from "./polar-labels";

describe("inside labels (section 8.4)", () => {
  // A donut of three 120° slices from a 62 to a 100 radius, and a 30 by 16 label.
  const slice = (index: number) => ({
    innerRadius: 62,
    outerRadius: 100,
    startAngle: 120 * index,
    endAngle: 120 * (index + 1),
  });
  const size = { width: 30, height: 16 };

  it("puts chart-1's label inside and the sequential and Other labels outside", () => {
    const placements = [true, false, false].map((onColour, index) =>
      insideLabel(slice(index), size, onColour)
    );
    expect(placements.map(({ placement }) => placement)).toEqual(["inside", "outside", "outside"]);
  });

  it("centres the inside box on d3's centroid, mid-radius on the bisector", () => {
    // The centroid sits at radius 81 on 60°: (81·sin 60°, −81·cos 60°) = (70.148, −40.5).
    const placed = insideLabel(slice(0), size, true);
    if (placed.placement !== "inside") throw new Error("expected an inside label");
    expect(placed.box.left + 15).toBeCloseTo(81 * Math.sin(Math.PI / 3), 9);
    expect(placed.box.top + 8).toBeCloseTo(-40.5, 9);
  });

  it("moves a label outside when its box leaves the slice", () => {
    expect(insideLabel({ ...slice(0), endAngle: 10 }, size, true).placement).toBe("outside");
  });
});

describe("outside labels (Q10)", () => {
  it("leaves the rim on the bisector and turns 8 % past it", () => {
    const [label] = outsideLabels([45], [{ width: 40, height: 16 }], { radius: 100, reach: 0.08, run: 8 });
    const sin = Math.sin(Math.PI / 4);
    expect(label?.anchor.x).toBeCloseTo(100 * sin, 9);
    expect(label?.anchor.y).toBeCloseTo(-100 * sin, 9);
    expect(label?.elbow.x).toBeCloseTo(108 * sin, 9);
    expect(label?.end.x).toBeCloseTo(108 * sin + 8, 9);
    expect(label?.side).toBe("end");
    expect(label?.box.left).toBeCloseTo(108 * sin + 8, 9);
  });

  it("ends a left-hand label's box at its leader's end", () => {
    const [label] = outsideLabels([270], [{ width: 40, height: 16 }], { radius: 100, reach: 0.08, run: 8 });
    expect(label?.side).toBe("start");
    expect(label?.box.left).toBeCloseTo(-108 - 8 - 40, 9);
  });

  it("never overlaps two boxes", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            angle: fc.double({ min: 0, max: 359.99, noNaN: true }),
            width: fc.integer({ min: 8, max: 120 }),
            height: fc.integer({ min: 12, max: 24 }),
          }),
          { minLength: 1, maxLength: 24 }
        ),
        fc.integer({ min: 20, max: 300 }),
        (labels, radius) => {
          const boxes = outsideLabels(
            labels.map(({ angle }) => angle),
            labels,
            { radius, reach: 0.08, run: 8 }
          ).map(({ box }) => box);
          boxes.forEach((a, i) => {
            boxes.slice(i + 1).forEach((b) => expect(overlaps(a, b)).toBe(false));
          });
        }
      )
    );
  });
});

/** Whether two boxes share any area, touching edges apart. */
function overlaps(a: LabelBox, b: LabelBox): boolean {
  const epsilon = 1e-9;
  return (
    a.left + a.width > b.left + epsilon &&
    b.left + b.width > a.left + epsilon &&
    a.top + a.height > b.top + epsilon &&
    b.top + b.height > a.top + epsilon
  );
}

describe("angle labels", () => {
  it.each([
    [0, 0.5, 1],
    [90, 0, 0.5],
    [180, 0.5, 0],
    [270, 1, 0.5],
    [45, 0, 1],
  ])("aligns a label at %i° away from the centre", (angle, alignX, alignY) => {
    const label = angleLabel(angle, 110);
    expect([label.alignX, label.alignY]).toEqual([alignX, alignY]);
  });
});
