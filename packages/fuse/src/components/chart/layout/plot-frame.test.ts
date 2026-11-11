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
  floorBody,
  frameRect,
  optionBand,
  plotFrame,
  pointAlong,
  cellRun,
  slotBandAt,
  slotBand,
  snapAcrossSpan,
  valueAt,
} from "./plot-frame";
import type { PlotBox, PlotFrame } from "./plot-frame";

function box(width: number, height: number, dpr = 1, left = 0, top = 0): PlotBox {
  return { width, height, dpr, left, top };
}

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

  it("builds a rectangle from a slot span and a base and tip on either side of it", () => {
    const vertical = plotFrame(box(300, 200), "vertical", 1, [0, 1]);
    const horizontal = plotFrame(box(300, 200), "horizontal", 1, [0, 1]);
    expect(frameRect(vertical, [10, 40], [150, 50])).toEqual({
      x: 10,
      y: 50,
      width: 30,
      height: 100,
    });
    expect(frameRect(vertical, [10, 40], [50, 150])).toEqual({
      x: 10,
      y: 50,
      width: 30,
      height: 100,
    });
    expect(frameRect(horizontal, [10, 40], [150, 50])).toEqual({
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
    const floored = (frame: PlotFrame, along: readonly [number, number], across: readonly [number, number]) =>
      floorBody(frame, frameRect(frame, along, across), across);
    expect(floored(vertical, [10, 40], [50.8, 50.6])).toEqual({
      x: 10,
      y: 50,
      width: 30,
      height: 1,
    });
    expect(floored(vertical, [10, 40], [50.6, 50.8])).toEqual({
      x: 10,
      y: 51,
      width: 30,
      height: 1,
    });
    expect(floored(horizontal, [10, 40], [75, 74.8])).toEqual({
      x: 74,
      y: 10,
      width: 1,
      height: 30,
    });
    expect(floored(horizontal, [10, 40], [74.8, 75])).toEqual({
      x: 75,
      y: 10,
      width: 1,
      height: 30,
    });
    expect(frameRect(vertical, [10, 40], [50.8, 50.6]).height).toBe(0);
  });
});
