// Unit under test: the plot frame, the one projection every mark, the focus ring and the tooltip
// anchor draw through. Oracles: band edges and centres worked by hand from CONTRACT section 8.15's
// equal cells and section 9.5's point scale, a linear value axis worked by hand, and the browser's
// own snapping of a box: an edge lands on the device pixel nearest its page position, and the
// layer's origin on the one nearest the plot's, so every snapped edge is a whole number of device
// pixels from the origin.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  WHOLE_BAND,
  barSpan,
  centreOf,
  frameRect,
  hairline,
  optionBand,
  plotFrame,
  pointAlong,
  cellRun,
  slotBandAt,
  ruleAcross,
  sameSnapping,
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

  it("counts a box moved by whole device pixels as the same snapping, and a box moved by part of one as new", () => {
    // Oracle: snapX and snapY are differences from the origin's own device pixel, so a move by k
    // device pixels draws every edge alike, while a move by half a device pixel rounds some edge
    // the other way. A scroll by 37 px at 1.5 dpr moves 55.5 device pixels, so it is a new snap.
    const at = box(200, 100, 2, 10.25, 30.5);
    expect(sameSnapping(at, box(200, 100, 2, 10.25 + 37, 30.5 - 120.5))).toBe(true);
    expect(sameSnapping(at, box(200, 100, 2, 10.5, 30.5))).toBe(false);
    expect(sameSnapping(at, box(200, 100, 2, 10.25, 30.75))).toBe(false);
    expect(sameSnapping(box(200, 100, 1.5, 0, 0), box(200, 100, 1.5, 37, 0))).toBe(false);
    expect(sameSnapping(box(200, 100, 1.5, 0, 0), box(200, 100, 1.5, 0, 38))).toBe(true);
    expect(sameSnapping(at, box(201, 100, 2, 10.25, 30.5))).toBe(false);
    expect(sameSnapping(at, box(200, 100, 1, 10.25, 30.5))).toBe(false);
    // A width serialized to three decimals is the full-precision one within 0.001 px.
    expect(sameSnapping(at, box(200.0004, 100, 2, 10.25, 30.5))).toBe(false);
    expect(sameSnapping(at, box(200.0004, 100, 2, 10.25, 30.5), 0.001)).toBe(true);
    expect(sameSnapping(at, box(200.002, 100, 2, 10.25, 30.5), 0.001)).toBe(false);
    fc.assert(
      fc.property(
        fc.constantFrom(1, 1.25, 1.5, 2, 3),
        fc.integer({ min: -6400, max: 6400 }).map((units) => units / 64),
        fc.integer({ min: -400, max: 400 }),
        fc.double({ min: -500, max: 500, noNaN: true }),
        (dpr, left, devices, x) => {
          const before = box(100, 100, dpr, left);
          const after = box(100, 100, dpr, left + devices / dpr);
          expect(sameSnapping(before, after)).toBe(true);
          expect(snapX(after, x)).toBeCloseTo(snapX(before, x), 9);
        }
      )
    );
  });

  it("rounds a body's width down and centres it along the slot axis, and snaps both value-axis edges", () => {
    // Along the slot axis the 3.4 px width rounds down to 3, centred on the span's middle 3.1, so
    // the start 1.6 snaps to 2 and the end lies 3 px on at 5. Across the value axis each edge snaps
    // alone, 2.6 to 3 and 3.8 to 4, so the height is 1.
    const frame = plotFrame(box(100, 100), "vertical", 1, [0, 1]);
    expect(snapBody(frame, { x: 1.4, y: 2.6, width: 3.4, height: 1.2 }, "start")).toEqual({
      x: 2,
      y: 3,
      width: 3,
      height: 1,
    });
  });

  it("keeps one device pixel along the slot axis, and along the value axis grows it away from the base", () => {
    // 0.2 px from 1.4 snaps both slot-axis edges to 1, and the floor takes the body to 2. Across the
    // value axis 2.6 to 2.8 snaps both edges to 3 at 1x. The base stays on 3 and the far edge moves
    // one device pixel on: up to 2 for "start", down to 4 for "end".
    const vertical = plotFrame(box(100, 100), "vertical", 1, [0, 1]);
    const horizontal = plotFrame(box(100, 100), "horizontal", 1, [0, 1]);
    const thin = { x: 1.4, y: 2.6, width: 0.2, height: 0.2 };
    expect(snapBody(vertical, thin, "start")).toEqual({ x: 1, y: 2, width: 1, height: 1 });
    expect(snapBody(vertical, thin, "end")).toEqual({ x: 1, y: 3, width: 1, height: 1 });
    const across = { x: 2.6, y: 1.4, width: 0.2, height: 0.2 };
    expect(snapBody(horizontal, across, "end")).toEqual({ x: 3, y: 1, width: 1, height: 1 });
    expect(snapBody(horizontal, across, "start")).toEqual({ x: 2, y: 1, width: 1, height: 1 });
  });

  it("keeps a body of no value-axis length flat, and a stack's inner segment its plain snap", () => {
    const vertical = plotFrame(box(100, 100), "vertical", 1, [0, 1]);
    // A zero reading has no length, so whichever way its floor grows it draws nothing.
    for (const floor of ["start", "end", "none"] as const) {
      expect(snapBody(vertical, { x: 1, y: 3, width: 4, height: 0 }, floor).height).toBe(0);
    }
    expect(snapBody(vertical, { x: 1, y: 2.6, width: 4, height: 0.2 }, "none")).toEqual({
      x: 1,
      y: 3,
      width: 4,
      height: 0,
    });
  });

  it("keeps the value-axis floor's device pixel at 2x a half CSS pixel from the base", () => {
    // At 2x 2.6 and 2.65 lie at device 5.2 and 5.3, both on edge 5, 2.5 px. The kept pixel is half
    // a CSS pixel: 2 to 2.5 up, 2.5 to 3 down.
    const frame = plotFrame(box(100, 100, 2), "vertical", 1, [0, 1]);
    const thin = { x: 1, y: 2.6, width: 4, height: 0.05 };
    expect(snapBody(frame, thin, "start")).toEqual({ x: 1, y: 2, width: 4, height: 0.5 });
    expect(snapBody(frame, thin, "end")).toEqual({ x: 1, y: 2.5, width: 4, height: 0.5 });
  });

  it("keeps the value-axis floor's pixel inside the plot, or the body flat", () => {
    // 0.1 to 0.3 snaps to the plot's top edge, 0, so a pixel above it lies outside the plot. 99.7 to
    // 99.9 snaps to its bottom edge, 100, and a pixel below it lies outside too. Grown inward, each
    // keeps its pixel.
    const frame = plotFrame(box(100, 100), "vertical", 1, [0, 1]);
    const top = { x: 1, y: 0.1, width: 4, height: 0.2 };
    const bottom = { x: 1, y: 99.7, width: 4, height: 0.2 };
    expect(snapBody(frame, top, "start")).toEqual({ x: 1, y: 0, width: 4, height: 0 });
    expect(snapBody(frame, top, "end")).toEqual({ x: 1, y: 0, width: 4, height: 1 });
    expect(snapBody(frame, bottom, "end")).toEqual({ x: 1, y: 100, width: 4, height: 0 });
    expect(snapBody(frame, bottom, "start")).toEqual({ x: 1, y: 99, width: 4, height: 1 });
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

  it("gives every band the same whole device pixels and splits the leftover between both ends", () => {
    // 31 slots on 514.109375 px at 2x: the plot draws 1028 device pixels, 33 per slot leaves 5,
    // so the bands start 2 device pixels in, 1 px, and run 16.5 px each, the last ending at 512.5.
    const frame = plotFrame(box(514.109375, 50, 2), "vertical", 31, [0, 1]);
    expect(slotBand(frame, 0)).toEqual([1, 17.5]);
    expect(slotBand(frame, 30)).toEqual([496, 512.5]);
    expect(centreOf(frame, 0, "band")).toBe(9);
    // At 1x the plot draws 514 pixels, 16 per slot leaves 18, so the bands start 9 px in and slot
    // 30 runs from 9 + 480 to 505.
    expect(slotBand(plotFrame(box(514.109375, 50, 1), "vertical", 31, [0, 1]), 30)).toEqual([489, 505]);
    // 20 slots on 45 px at 1x: 2 px bands leave 5, so slot 0 starts 2 px in. On 15 px a slot is
    // under a pixel, so the edges spread and slot 1 runs from 0.75 to 1.5, which snap to 1 and 1,
    // and keeps the pixel its middle, 1.125, lies in.
    expect(slotBand(plotFrame(box(45, 50), "vertical", 20, [0, 1]), 0)).toEqual([2, 4]);
    expect(slotBand(plotFrame(box(15, 50), "vertical", 20, [0, 1]), 1)).toEqual([1, 2]);
  });

  it("keeps every slot lookup finite on a plot of no length", () => {
    // R1-2: a plot measured 0 px along the slot axis spreads its bands over nothing, a step of 0.
    // Every lookup still returns finite numbers, at the plot's origin.
    for (const orientation of ["vertical", "horizontal"] as const) {
      const frame = plotFrame(box(0, 0), orientation, 3, [0, 1]);
      const numbers = [
        ...slotBandAt(frame, 0, "band"),
        ...slotBandAt(frame, 5, "band"),
        pointAlong(frame, 0, "band"),
        ...optionBand(frame, 1, "band"),
        ...cellRun(frame, 0),
        ...cellRun(frame, 0, 2),
      ];
      expect(numbers.every(Number.isFinite), numbers.join(", ")).toBe(true);
    }
  });

  it("runs slots down the plot under a horizontal frame", () => {
    const frame = plotFrame(box(300, 64), "horizontal", 2, [0, 1]);
    expect(slotBand(frame, 1)).toEqual([32, 64]);
  });
});

describe("exact gaps for the bars of a layout", () => {
  // Unit under test: barSpan, which every bar, its overlay, its tooltip row and a path column's
  // emphasis box draw. Oracle: the owner's grid rule worked from the box alone. The browser draws
  // the plot from the device pixel nearest its start to the one nearest its end, P device pixels.
  // A band x scale over n slots with w = floor(P / n) >= 1 gives every band w device pixels from
  // floor((P - n * w) / 2). One bar gap G = max(1, round(w * bandGap)) device pixels, none when w
  // is 1, and a BarGroup's bar gap max(1, round(barGap * dpr)), separate bars of one width.
  it("keeps every gap whole and equal, every width equal, and the margins split", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(1, 1.25, 1.5, 2, 3),
        fc.integer({ min: 0, max: 63 }).map((units) => units / 64),
        fc.constantFrom("vertical" as const, "horizontal" as const),
        fc.integer({ min: 160, max: 4800 }).map((quarters) => quarters / 4),
        fc.integer({ min: 1, max: 160 }),
        fc.constantFrom(1, 2, 4),
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 1, max: 60 }).map((percent) => percent / 100),
        fc.constantFrom(0, 1, 2, 4),
        (dpr, offset, orientation, length, count, span, groups, bandGap, barGap) => {
          const plot =
            orientation === "vertical" ? box(length, 100, dpr, offset) : box(100, length, dpr, 0, offset);
          const frame = plotFrame(plot, orientation, count, [0, 1]);
          const metrics = { bandGap, barGap, seam: 2 };
          const device = (at: number) => Math.ceil(at * dpr - 0.5 - 1e-6);
          const pixels = device(offset + length) - device(offset);
          const whole = Math.floor(pixels / count);
          if (whole < 1) return;
          const gap = whole > 1 ? Math.max(1, Math.round(whole * bandGap)) : 0;
          const between = groups > 1 && barGap > 0 ? Math.max(1, Math.round(barGap * dpr)) : 0;
          // A run of bands must hold the gaps and a pixel per bar.
          if (span * whole - gap - (groups - 1) * between < groups) return;
          const positions = Array.from({ length: Math.floor(count / span) }, (_, k) => k * span);
          if (positions.length === 0) return;
          // Every bar in slot order, as device pixels from the drawn origin.
          const bars = positions.flatMap((at) =>
            Array.from({ length: groups }, (_, index) =>
              barSpan(frame, at, metrics, { index, count: groups }, span).map((edge) => edge * dpr)
            )
          );
          for (const [start = 0, end = 0] of bars) {
            expect(Math.abs(start - Math.round(start))).toBeLessThan(1e-6);
            expect(Math.abs(end - Math.round(end))).toBeLessThan(1e-6);
          }
          const widths = bars.map(([start = 0, end = 0]) => Math.round(end - start));
          expect(new Set(widths).size).toBe(1);
          // A group's spare pixels, its inside less the bar gaps modulo its bars, lie at its ends,
          // so they join the gap between groups.
          const spare = (span * whole - gap - (groups - 1) * between) % groups;
          bars.slice(1).forEach(([start = 0], k) => {
            const apart = Math.round(start - (bars[k]?.[1] ?? 0));
            expect(apart).toBe((k + 1) % groups === 0 ? gap + spare : between);
          });
          if (groups > 1) return;
          const [first = 0] = bars[0] ?? [];
          const lastEnd = bars.at(-1)?.[1] ?? 0;
          const leftover = pixels - count * whole;
          // Rule A: the first band starts floor(leftover / 2) in, and the bar G's smaller half after.
          expect(Math.round(first)).toBe(Math.floor(leftover / 2) + Math.floor(gap / 2));
          if (positions.length * span === count)
            expect(Math.round(pixels - lastEnd)).toBe(
              leftover - Math.floor(leftover / 2) + Math.ceil(gap / 2)
            );
        }
      )
    );
  });

  it("keeps a device pixel for each bar of a group whose bar gap fills its band", () => {
    // 66 slots on 396 px at 1x take 6 px each with no band gap, and a group of two with a bar gap
    // a hair under 6 px, fast-check's counterexample, leaves a sliver for its bars. The gap then
    // takes half the band, 3 px, which leaves each bar 1.5 px, a device pixel once it snaps.
    const frame = plotFrame(box(396, 50), "vertical", 66, [0, 1]);
    for (const index of [0, 1]) {
      const [start, end] = barSpan(
        frame,
        43,
        { bandGap: 0, barGap: 5.999999999999943, seam: 2 },
        {
          index,
          count: 2,
        }
      );
      expect(end - start).toBeGreaterThanOrEqual(1);
      expect(start).toBeGreaterThanOrEqual(43 * 6);
      expect(end).toBeLessThanOrEqual(44 * 6);
    }
  });

  it("keeps a device pixel for every bar of a band too narrow for its gap", () => {
    // 300 slots on 100 px at 1x: a third of a pixel each, so each bar keeps the pixel floor, inside
    // the plot.
    const frame = plotFrame(box(100, 50), "vertical", 300, [0, 1]);
    for (const at of [0, 150, 299]) {
      const [start, end] = barSpan(frame, at, { bandGap: 0.25, barGap: 2, seam: 2 }, WHOLE_BAND);
      expect(end - start).toBe(1);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeLessThanOrEqual(100);
    }
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
    expect(frameRect(one, [3, 3.5], [0, 100], "outer")).toEqual({ x: 3, y: 0, width: 1, height: 100 });
    expect(frameRect(two, [3, 3.2], [0, 100], "outer")).toEqual({ x: 3, y: 0, width: 0.5, height: 100 });
    expect(frameRect(one, [3, 3], [0, 100], "outer").width).toBe(0);
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

  it("builds a rectangle from a slot span and a base and tip on either side of it", () => {
    const vertical = plotFrame(box(300, 200), "vertical", 1, [0, 1]);
    const horizontal = plotFrame(box(300, 200), "horizontal", 1, [0, 1]);
    expect(frameRect(vertical, [10, 40], [150, 50], "outer")).toEqual({
      x: 10,
      y: 50,
      width: 30,
      height: 100,
    });
    expect(frameRect(vertical, [10, 40], [50, 150], "outer")).toEqual({
      x: 10,
      y: 50,
      width: 30,
      height: 100,
    });
    expect(frameRect(horizontal, [10, 40], [150, 50], "outer")).toEqual({
      x: 50,
      y: 10,
      width: 100,
      height: 30,
    });
  });

  it("grows a body under a device pixel from its base toward its tip, unless it is an inner segment", () => {
    // 50.8 and 50.6 both snap to 51 at 1x. A tip above its base, a positive vertical bar, keeps 50
    // to 51, and a tip below it, a negative one, 51 to 52. Across a horizontal frame a tip left of
    // its base, a negative bar, keeps 74 to 75, and right of it 75 to 76.
    const vertical = plotFrame(box(300, 200), "vertical", 1, [0, 1]);
    const horizontal = plotFrame(box(300, 200), "horizontal", 1, [0, 1]);
    expect(frameRect(vertical, [10, 40], [50.8, 50.6], "outer")).toEqual({
      x: 10,
      y: 50,
      width: 30,
      height: 1,
    });
    expect(frameRect(vertical, [10, 40], [50.6, 50.8], "outer")).toEqual({
      x: 10,
      y: 51,
      width: 30,
      height: 1,
    });
    expect(frameRect(horizontal, [10, 40], [75, 74.8], "outer")).toEqual({
      x: 74,
      y: 10,
      width: 1,
      height: 30,
    });
    expect(frameRect(horizontal, [10, 40], [74.8, 75], "outer")).toEqual({
      x: 75,
      y: 10,
      width: 1,
      height: 30,
    });
    expect(frameRect(vertical, [10, 40], [50.8, 50.6], "inner").height).toBe(0);
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
    // slots take 1 px bands, the third pixel left over after them, so slot 1's line fills 1 to 2.
    expect(slotLine(plotFrame(box(3, 10, 1.5), "vertical", 2, [0, 1]), 1, "band")).toEqual([2, 2 + 2 / 3]);
    expect(slotLine(plotFrame(box(3, 10, 1), "vertical", 2, [0, 1]), 1, "band")).toEqual([1, 2]);
  });

  it("starts a 1 px rule at its coordinate, as a CSS border does, so both edges are whole pixels", () => {
    // At 2x, 40.3 px rounds to 40.5, so the rule covers 40.5 to 41.5.
    const centre = ruleAcross(box(100, 100, 2), "horizontal", 40.3).y1;
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
