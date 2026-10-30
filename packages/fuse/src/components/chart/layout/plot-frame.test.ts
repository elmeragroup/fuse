// Unit under test: the plot frame, the one projection every mark, the focus ring and the tooltip
// anchor draw through. Oracles: band edges and centres worked by hand from CONTRACT section 8.15's
// equal cells and section 9.5's point scale, a linear value axis worked by hand, and the browser's
// own snapping of a box: an edge lands on the device pixel nearest its page position, and the
// layer's origin on the one nearest the plot's, so every snapped edge is a whole number of device
// pixels from the origin.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  centreOf,
  frameRect,
  hairline,
  optionBand,
  plotFrame,
  ruleAcross,
  ruleAt,
  slotBand,
  slotLine,
  snapAcrossSpan,
  snapBody,
  snapX,
  snapY,
  strokeCentre,
  valueAt,
} from "./plot-frame";
import type { PlotBox } from "./plot-frame";

function box(width: number, height: number, dpr = 1, left = 0, top = 0): PlotBox {
  return { width, height, dpr, left, top };
}

/** Whether a page coordinate lies on a device pixel edge. */
function onGrid(page: number, dpr: number): boolean {
  return Math.abs(page * dpr - Math.round(page * dpr)) < 1e-9;
}

describe("snapping", () => {
  it("lands every edge a whole number of device pixels from the origin, on the pixel nearest its page position", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(1, 1.25, 1.5, 2, 3, 4),
        fc.double({ min: -500, max: 500, noNaN: true }),
        fc.double({ min: -2000, max: 2000, noNaN: true }),
        (dpr, left, at) => {
          const plot = box(100, 100, dpr, left);
          const origin = Math.round(left * dpr) / dpr;
          expect(onGrid(snapX(plot, at), dpr)).toBe(true);
          expect(Math.abs(origin + snapX(plot, at) - (left + at))).toBeLessThanOrEqual(0.5 / dpr + 1e-9);
        }
      )
    );
  });

  it("rounds an edge as the browser rounds a box at the same page position", () => {
    // The plot starts 0.4 px into a pixel and draws its origin on pixel 0. An edge at 40.3 px sits
    // at 40.7 on the page, which the browser draws on pixel 41.
    expect(snapX(box(100, 100, 1, 0.4), 40.3)).toBe(41);
    expect(snapY(box(100, 100, 1, 0, 0.4), 40.3)).toBe(41);
  });

  it("rounds a coordinate exactly between two device pixels toward the top left", () => {
    expect([snapX(box(10, 10), 2.5), snapX(box(10, 10, 2), 2.25), snapX(box(10, 10), -0.5)]).toEqual([
      2, 2, -1,
    ]);
  });

  it("returns a snapped coordinate when it snaps it again, wherever the plot's origin lies", () => {
    // Expectation: snapping is a projection. A plot at page 3 with a pixel ratio of 1.5 starts on
    // a tie, at device pixel 4.5, so a snapped edge lies on a tie too. Float error put 0.8 px,
    // snapped to 1 1/3 px, past its tie, and a second snap a device pixel further on.
    fc.assert(
      fc.property(
        fc.constantFrom(1, 1.25, 1.5, 2, 3),
        // Layout positions are whole 1/64 px, which puts some origins on a tie.
        fc.integer({ min: -6400, max: 6400 }).map((units) => units / 64),
        fc.double({ min: -500, max: 500, noNaN: true }),
        (dpr, left, at) => {
          const plot = box(100, 100, dpr, left);
          const snapped = snapX(plot, at);
          expect(snapX(plot, snapped)).toBe(snapped);
        }
      ),
      { examples: [[1.5, 3, 0.8]] }
    );
  });

  it("snaps a body's four edges, so its size may change by a device pixel", () => {
    const frame = plotFrame(box(100, 100), "vertical", 1, [0, 1]);
    expect(snapBody(frame, { x: 1.4, y: 2.6, width: 3.4, height: 1.2 })).toEqual({
      x: 1,
      y: 3,
      width: 4,
      height: 1,
    });
  });

  it("keeps one device pixel along the slot axis only, so a zero value stays flat", () => {
    // 0.2 px from 1.4 snaps both slot-axis edges to 1, and the floor takes the body to 2. The value
    // axis keeps its 0.2 px height snapped to nothing, as a zero reading draws.
    const vertical = plotFrame(box(100, 100), "vertical", 1, [0, 1]);
    const horizontal = plotFrame(box(100, 100), "horizontal", 1, [0, 1]);
    expect(snapBody(vertical, { x: 1.4, y: 2.6, width: 0.2, height: 0.2 })).toEqual({
      x: 1,
      y: 3,
      width: 1,
      height: 0,
    });
    expect(snapBody(horizontal, { x: 2.6, y: 1.4, width: 0.2, height: 0.2 })).toEqual({
      x: 3,
      y: 1,
      width: 0,
      height: 1,
    });
  });
});

describe("slot bands and centres", () => {
  it("splits a 300 px plot into three 100 px bands", () => {
    const frame = plotFrame(box(300, 50), "vertical", 3, [0, 1]);
    expect([0, 1, 2].map((position) => slotBand(frame, position))).toEqual([
      [0, 100],
      [100, 200],
      [200, 300],
    ]);
    expect(centreOf(frame, 1, "band")).toBe(150);
  });

  it("shares each edge between neighbouring bands a device pixel or more wide, at any width and pixel ratio", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 2000, noNaN: true }),
        fc.integer({ min: 2, max: 400 }),
        fc.constantFrom(1, 1.5, 2, 4),
        (width, count, dpr) => {
          // Narrower bands keep a device pixel each, so neighbours may share it.
          fc.pre(width / count >= 1 / dpr);
          const frame = plotFrame(box(width, 50, dpr), "vertical", count, [0, 1]);
          for (let position = 1; position < count; position += 1) {
            expect(slotBand(frame, position)[0]).toBe(slotBand(frame, position - 1)[1]);
          }
        }
      )
    );
  });

  it("runs point slots from the first edge to the last, and gives each a clipped band-wide cell", () => {
    // Four points on 300 px lie 100 px apart, and each owns 75 px around its point. An edge half
    // way between two pixels rounds toward the left.
    const frame = plotFrame(box(300, 50), "vertical", 4, [0, 1]);
    expect([0, 1, 3].map((position) => centreOf(frame, position, "point"))).toEqual([0, 100, 300]);
    expect(optionBand(frame, 1, "point")).toEqual([62, 137]);
    expect(optionBand(frame, 0, "point")).toEqual([0, 37]);
    expect(optionBand(frame, 3, "point")).toEqual([262, 300]);
  });

  it("keeps the device pixel a band's middle lies in when the pixel before it is the plot's first", () => {
    // 300 slots on 100 px at 1.25x, the plot 2.9375 px in, its origin on device pixel 4. Slot 2
    // runs from 3.6042 to 3.9375 px on the page, device 4.505 to 4.922, both inside pixel 4: the
    // plot's first, 0 to 0.8 px from the origin. Its edges snap onto pixel 5, past its middle.
    const frame = plotFrame(box(100, 50, 1.25, 2.9375), "vertical", 300, [0, 1]);
    const [start, end] = slotBand(frame, 2);
    expect(start).toBeCloseTo(0, 9);
    expect(end).toBeCloseTo(0.8, 9);
  });

  it("runs slots down the plot under a horizontal frame", () => {
    const frame = plotFrame(box(300, 64), "horizontal", 2, [0, 1]);
    expect(slotBand(frame, 1)).toEqual([32, 64]);
  });
});

describe("the value axis", () => {
  it("puts the maximum at the top of a vertical frame and at the right of a horizontal one", () => {
    const vertical = plotFrame(box(300, 200), "vertical", 1, [-50, 150]);
    const horizontal = plotFrame(box(300, 200), "horizontal", 1, [-50, 150]);
    // Zero lies a quarter of the way up the domain.
    expect([valueAt(vertical, 150), valueAt(vertical, 0), valueAt(vertical, -50)]).toEqual([0, 150, 200]);
    expect([valueAt(horizontal, -50), valueAt(horizontal, 0), valueAt(horizontal, 150)]).toEqual([
      0, 75, 300,
    ]);
  });

  it("keeps one device pixel of a span narrower than a pixel, and none of an empty span", () => {
    // B2-1: 0.5 px from 3 px snaps both edges to 3 at 1x, and 0.2 px from 3 px both to 3 at 2x.
    const one = plotFrame(box(400, 200), "vertical", 1, [0, 1]);
    const two = plotFrame(box(400, 200, 2), "vertical", 1, [0, 1]);
    expect(frameRect(one, [3, 3.5], [0, 100])).toEqual({ x: 3, y: 0, width: 1, height: 100 });
    expect(frameRect(two, [3, 3.2], [0, 100])).toEqual({ x: 3, y: 0, width: 0.5, height: 100 });
    expect(frameRect(one, [3, 3], [0, 100]).width).toBe(0);
  });

  it("keeps the device pixel a value span's middle lies in, inside the plot, and none of an empty span", () => {
    // On 200 px down a vertical frame at 1x: 99.8 to 100 lies in pixel 99, 100 to 100.3 in pixel
    // 100, and 199.8 to 200 in pixel 199, the plot's last. Across a horizontal frame, 0 to 0.2
    // lies in pixel 0.
    const vertical = plotFrame(box(400, 200), "vertical", 1, [0, 1]);
    const horizontal = plotFrame(box(400, 200), "horizontal", 1, [0, 1]);
    expect(snapAcrossSpan(vertical, 99.8, 100)).toEqual([99, 100]);
    expect(snapAcrossSpan(vertical, 100, 100.3)).toEqual([100, 101]);
    expect(snapAcrossSpan(vertical, 199.8, 200)).toEqual([199, 200]);
    expect(snapAcrossSpan(horizontal, 0, 0.2)).toEqual([0, 1]);
    expect(snapAcrossSpan(vertical, 50, 50)).toEqual([50, 50]);
  });

  it("builds a rectangle from a slot span and two values in either order", () => {
    const vertical = plotFrame(box(300, 200), "vertical", 1, [0, 1]);
    const horizontal = plotFrame(box(300, 200), "horizontal", 1, [0, 1]);
    expect(frameRect(vertical, [10, 40], [150, 50])).toEqual({ x: 10, y: 50, width: 30, height: 100 });
    expect(frameRect(horizontal, [10, 40], [150, 50])).toEqual({ x: 50, y: 10, width: 100, height: 30 });
  });
});

describe("rules", () => {
  it("draws every rule 1 px rounded down to whole device pixels, at least one", () => {
    // Expectation: one device pixel at 1.25x and 1.5x, two at 2x, three at 3x, and two of the
    // 2.625 device pixels a CSS pixel covers on a common phone.
    expect([1, 1.25, 1.5, 2, 3, 2.625].map((dpr) => hairline(box(10, 10, dpr)))).toEqual([
      1,
      0.8,
      1 / 1.5,
      1,
      1,
      2 / 2.625,
    ]);
  });

  it("centres a rule across the plot half a hairline past its snapped edge, so both edges are device pixels", () => {
    // At 1.5x, 40.3 px is device pixel 60.45, which rounds to 60, 40 px. The rule covers device
    // pixel 60, from 40 to 40 2/3 px, so its centre lies at 40 1/3.
    const plot = box(100, 100, 1.5);
    const rule = ruleAcross(plot, "horizontal", 40.3);
    expect(rule.y1).toBeCloseTo(40 + 1 / 3, 12);
    expect(rule.y2).toBe(rule.y1);
    expect(onGrid(rule.y1 - 1 / 3, 1.5)).toBe(true);
    expect(onGrid(rule.y1 + 1 / 3, 1.5)).toBe(true);
  });
  it("draws a slot's hairline whole device pixels wide, inside its band", () => {
    // Expectation: at 1.5x a 1 px hairline would cover a device pixel and a half and spill half a
    // pixel past a two-device-pixel band. Two slots on 3 px: slot 1 covers device pixels 2 to 4.
    // It draws one device pixel, 2/3 px, from its centre at device pixel 3, 2 px. At 1x the same
    // slots draw 1 px from slot 1's centre, 2 px, which ends on the plot's edge.
    expect(slotLine(plotFrame(box(3, 10, 1.5), "vertical", 2, [0, 1]), 1, "band")).toEqual([2, 2 + 2 / 3]);
    expect(slotLine(plotFrame(box(3, 10, 1), "vertical", 2, [0, 1]), 1, "band")).toEqual([2, 3]);
  });

  it("starts a 1 px rule at its coordinate, as a CSS border does, so both edges are whole pixels", () => {
    // At 2x, 40.3 px rounds to 40.5, so the rule covers 40.5 to 41.5.
    const plot = box(100, 100, 2);
    const centre = ruleAt((at) => snapY(plot, at), 40.3);
    expect(centre).toBe(41);
    expect(onGrid(centre - 0.5, 2)).toBe(true);
    expect(onGrid(centre + 0.5, 2)).toBe(true);
  });

  it("sets all four endpoints of a rule across the plot, whichever way it runs", () => {
    // The plot starts 0.4 px into a pixel both ways, so 40.3 px sits at 40.7 on the page, which
    // the browser draws on pixel 41, and the rule's centre lies half a pixel past it.
    const plot = box(300, 200, 1, 0.4, 0.4);
    expect(ruleAcross(plot, "horizontal", 40.3)).toEqual({ x1: 0, y1: 41.5, x2: 300, y2: 41.5 });
    expect(ruleAcross(plot, "vertical", 40.3)).toEqual({ x1: 41.5, y1: 0, x2: 41.5, y2: 200 });
  });
});

describe("strokeCentre (review round 1, B1-10)", () => {
  it("centres a stroke an odd number of device pixels wide on a pixel's middle, and an even one on an edge", () => {
    // [dpr, width in CSS px, offset from the snapped edge]: 1 px at DPR 1 is 1 device pixel, so it
    // moves half a pixel, and 2 px is 2, so it stays. At DPR 1.5, 2 px is 3 device pixels and
    // moves a third of a CSS pixel, and 1 px rounds to 2. At DPR 2, 1.5 px is 3 device pixels.
    const cases: readonly (readonly [number, number, number])[] = [
      [1, 1, 0.5],
      [1, 2, 0],
      [1, 3, 0.5],
      [1.5, 1, 0],
      [1.5, 2, 1 / 3],
      [2, 1, 0],
      [2, 1.5, 0.25],
      [1, 0, 0],
    ];
    for (const [dpr, width, offset] of cases) {
      const frame = plotFrame(box(100, 100, dpr), "vertical", 1, [0, 1]);
      expect(strokeCentre(frame, 40, width) - 40, `${String(width)} px at DPR ${String(dpr)}`).toBeCloseTo(
        offset,
        9
      );
    }
  });

  it("puts both edges of the stroke on device pixels", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(1, 1.25, 1.5, 2, 3),
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 0, max: 400 }),
        (dpr, pixels, at) => {
          const frame = plotFrame(box(100, 100, dpr), "vertical", 1, [0, 1]);
          const width = pixels / dpr;
          const centre = strokeCentre(frame, at / dpr, width);
          expect(onGrid(centre - width / 2, dpr) && onGrid(centre + width / 2, dpr)).toBe(true);
        }
      )
    );
  });
});
