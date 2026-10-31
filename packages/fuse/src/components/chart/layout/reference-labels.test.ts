// Unit under test: placeLabels, which places a vertical chart's value reference labels from the
// guides they draw. Oracles: the stacking rule written out by hand for labels at rest, where a label
// sits at the largest of its own edge, each label above it plus the heights of every label from
// just below that one down to itself, and, under a row of slot labels, its own height plus the
// heights above it; and two relations that hold for any guides and any label sizes: placement moves
// by a bounded amount when the guides move by a small one, so no label jumps, and labels whose
// guides rest on whole device pixels never overlap their boxes.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { placeLabels } from "./reference-labels";
import type { LabelGuide, LabelPlot } from "./reference-labels";

const PLOT: LabelPlot = { start: Number.NEGATIVE_INFINITY, end: 200, pixel: 1 };
/** The plot under a row of slot labels, which keeps every label box below its top. */
const UNDER_ROW: LabelPlot = { ...PLOT, start: 0 };

/** A line's 16 px label at an edge, mounted in a given order. */
function line(at: number, order: number, height = 16): LabelGuide {
  return { kind: "line", order, span: [at, at], height, inset: height + 4 };
}

/** An area's label with a given top and bottom edge, mounted in a given order. */
function area(top: number, bottom: number, order: number, height = 16, inset = 20): LabelGuide {
  return { kind: "area", order, span: [top, bottom], height, inset };
}

describe("placeLabels at rest", () => {
  it("keeps a lone label on its edge, and a line below a row of slot labels", () => {
    expect(placeLabels([line(40, 0)], PLOT)).toEqual([40]);
    expect(placeLabels([line(10, 0)], UNDER_ROW)).toEqual([16]);
  });

  it("stacks a second label on the same edge one line below the first mounted", () => {
    expect(placeLabels([line(0, 0), line(0, 1)], PLOT)).toEqual([0, 16]);
    expect(placeLabels([line(0, 1), line(0, 0)], PLOT)).toEqual([16, 0]);
    expect(placeLabels([line(0, 0), line(0, 1)], UNDER_ROW)).toEqual([16, 32]);
  });

  it("orders labels by their edge, not by mount order", () => {
    expect(placeLabels([line(50, 0), line(10, 1)], PLOT)).toEqual([50, 10]);
    expect(placeLabels([line(20, 0), line(10, 1)], PLOT)).toEqual([26, 10]);
  });

  it("counts every earlier label for the third, with one line per label between", () => {
    expect(placeLabels([line(5, 0), line(6, 1), line(7, 2)], PLOT)).toEqual([5, 21, 37]);
  });

  it("stacks lines at 10 and 9.5 of 0–20 on 200 px, at 100 and 116 px", () => {
    // Q3-2's chart before its update: 10 lies 100 px down, and 9.5 lies 105 px down, under it.
    expect(placeLabels([line(100, 0), line(105, 1)], PLOT)).toEqual([100, 116]);
  });

  it("stacks each label by its own height: a 32 px label at 9.5 under a 16 px one at 10", () => {
    // Q4-2: the 16 px label at 10 ends at 100 px, so the 32 px one at 9.5 ends 32 px lower, at
    // 132 px, its box from 100 to 132, whichever mounted first.
    expect(placeLabels([line(105, 0, 32), line(100, 1, 16)], PLOT)).toEqual([132, 100]);
    expect(placeLabels([line(100, 0, 16), line(105, 1, 32)], PLOT)).toEqual([100, 132]);
  });

  it("rests a cut area's label on a whole pixel, so it stacks with a line at pixel 23", () => {
    // Q4-3 with an 18 px root font and 18 px lines: the area's inset, 4.5 + 18 = 22.5 px, rests on
    // pixel 23, the line's own edge. They tie, and the earlier mount sits on 23 with the other a
    // line below.
    expect(placeLabels([line(23, 0, 18), area(-40, 150, 1, 18, 22.5)], PLOT)).toEqual([23, 41]);
    expect(placeLabels([area(-40, 150, 0, 18, 22.5), line(23, 1, 18)], PLOT)).toEqual([23, 41]);
  });

  it("drops a label whose guide left the plot from the others' stack", () => {
    // The first guide sits a pixel above the plot, so the second label keeps its own edge.
    expect(placeLabels([line(-1, 0), line(4, 1)], PLOT)[1]).toBe(4);
    expect(placeLabels([line(0, 0), line(4, 1)], PLOT)[1]).toBe(16);
  });

  it("slides a cut area's label inside the area by as much as the area left the plot", () => {
    // An area whose top lies 10 px above the plot labels 10 px down, and one 50 px above rests at
    // its 20 px inset.
    expect(placeLabels([area(-10, 150, 0)], PLOT)).toEqual([10]);
    expect(placeLabels([area(-50, 150, 0)], PLOT)).toEqual([20]);
    expect(placeLabels([area(30, 150, 0)], PLOT)).toEqual([30]);
  });
});

/** A label of either kind, its size from fractional text metrics. */
const labelled = fc.record({
  kind: fc.constantFrom("line" as const, "area" as const),
  height: fc.double({ min: 8, max: 40, noNaN: true }),
  rem: fc.double({ min: 10, max: 24, noNaN: true }),
});

/** A plot with or without a row of slot labels above it. */
const starts = fc.constantFrom(Number.NEGATIVE_INFINITY, 0);

const pixels = fc.constantFrom(1, 0.5, 1 / 3, 0.8);

describe("placeLabels as guides move", () => {
  it("moves every label by a bounded amount when the guides move a little, so none jumps", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            label: labelled,
            top: fc.double({ min: -60, max: 260, noNaN: true }),
            length: fc.double({ min: 0, max: 120, noNaN: true }),
          }),
          { minLength: 1, maxLength: 4 }
        ),
        pixels,
        starts,
        fc.array(fc.double({ min: -1e-6, max: 1e-6, noNaN: true }), { minLength: 4, maxLength: 4 }),
        (list, pixel, start, nudges) => {
          const guides = (shift: (index: number) => number): LabelGuide[] =>
            list.map(({ label, top, length }, order) => {
              const at = top + shift(order);
              return {
                kind: label.kind,
                order,
                span: [at, label.kind === "line" ? at : at + length],
                height: label.height,
                inset: label.rem / 4 + label.height,
              };
            });
          const plot = { start, end: 200, pixel };
          const before = placeLabels(
            guides(() => 0),
            plot
          );
          const after = placeLabels(
            guides((index) => nudges[index] ?? 0),
            plot
          );
          // Each blend turns a guide's move into at most one label height per device pixel, and a
          // label takes up to one such term per pair and per label between, so the bound grows
          // with the labels and stays far below a line for a move of a millionth of a pixel.
          const tallest = Math.max(...list.map(({ label }) => label.height));
          const bound = 1e-6 * 10 * (list.length + 1) ** 3 * (1 + tallest / pixel);
          after.forEach((bottom, index) => {
            expect(Math.abs(bottom - (before[index] ?? 0))).toBeLessThanOrEqual(bound);
          });
        }
      )
    );
  });

  it("keeps resting label boxes apart, lines and cut areas alike, with fractional text metrics", () => {
    // At rest every guide edge lies on a whole device pixel, inside the plot or, for a cut area,
    // above it. A line may rest anywhere in the plot or, where labels meet most often, on a pixel
    // next to where another label's cut area rests its label. Sorted by bottom edge, each label's
    // box starts at or below the one above it.
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            label: labelled,
            step: fc.integer({ min: -120, max: 200 }),
            length: fc.integer({ min: 1, max: 240 }),
            near: fc.option(fc.record({ area: fc.nat(), offset: fc.integer({ min: -1, max: 1 }) })),
          }),
          { minLength: 1, maxLength: 4 }
        ),
        pixels,
        starts,
        (list, pixel, start) => {
          const insets = list.map(({ label }) => label.rem / 4 + label.height);
          const areas = list.flatMap(({ label }, index) => (label.kind === "area" ? [index] : []));
          const guides: LabelGuide[] = list.map(({ label, step, length, near }, order) => {
            // A line by a cut area rests a pixel from that area's resting inset, which may be
            // fractional, and rounds to the grid as every resting edge does.
            const by = near === null || areas.length === 0 ? undefined : areas[near.area % areas.length];
            const anchored =
              by === undefined
                ? undefined
                : (Math.round((insets[by] ?? 0) / pixel) + (near?.offset ?? 0)) * pixel;
            // A line rests in the plot. An area may start above it, cut, and ends inside it.
            const top = label.kind === "line" ? (anchored ?? Math.abs(step) * pixel) : step * pixel;
            return {
              kind: label.kind,
              order,
              span: [top, label.kind === "line" ? top : Math.max(top, 0) + length * pixel],
              height: label.height,
              inset: insets[order] ?? 0,
            };
          });
          const boxes = placeLabels(guides, { start, end: 200, pixel })
            .map((bottom, index) => ({ bottom, height: guides[index]?.height ?? 0 }))
            .toSorted((a, b) => a.bottom - b.bottom);
          for (let index = 1; index < boxes.length; index += 1) {
            const box = boxes[index];
            const upper = boxes[index - 1];
            if (box === undefined || upper === undefined) continue;
            expect(box.bottom - box.height).toBeGreaterThanOrEqual(upper.bottom - 1e-9);
          }
        }
      )
    );
  });
});
