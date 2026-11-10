// The clock dial's geometry. Unit under test: slotAngles, instantAngle, clockRadius, wedgePad,
// columnAxis, columnSpan and columnFloorSpan. Oracles, written by hand: D11's equal slots, where
// slot i of n spans [360·i/n, 360·(i+1)/n); D13's radii, r = √(lerp(ri², R², t)) and lerp(ri, R, t);
// D14's constant gap, whose width 2·padRadius·sin(padAngle/2) holds at every radius, kept while the
// rim arc leaves at least one device pixel of wedge, (2π·R/n − gap)·dpr ≥ 1; and D24's floor, one device pixel along the radius away
// from the zero ring, settled for a stack by floor-settle.ts's rule that the span reaching farthest
// out wins.
import { describe, expect, it } from "vitest";

import {
  clockRadius,
  columnFloorSpan,
  columnAxis,
  columnSpan,
  instantAngle,
  slotAngles,
  wedgePad,
} from "./clock";
import { settleFloors } from "./floor-settle";

describe("slot angles (D11)", () => {
  it("gives every slot of a 25-hour day an equal 14.4°", () => {
    expect(slotAngles(7, 25)).toEqual({ start: 100.8, end: 115.2, centre: 108 });
  });

  it("puts slot 0 at 12 o'clock", () => {
    expect(slotAngles(0, 24)).toEqual({ start: 0, end: 15, centre: 7.5 });
  });

  it("points Now at the share of its slot that has passed", () => {
    expect(instantAngle(12, 0.5, 24)).toBe(187.5);
    expect(instantAngle(23, 2, 24)).toBe(360);
  });
});

describe("the radius (D13)", () => {
  const radii = { inner: 30, outer: 100, domain: [0, 1] } as const;

  it("keeps area true under the radial scale", () => {
    const r = clockRadius({ ...radii, scale: "radial" });
    expect(r(0)).toBe(30);
    expect(r(1)).toBe(100);
    // Half the domain fills half the annulus's area: r² = (30² + 100²) / 2 = 5450.
    expect(r(0.5)).toBeCloseTo(Math.sqrt(5450), 12);
  });

  it("keeps radius true under the linear scale", () => {
    expect(clockRadius({ ...radii, scale: "linear" })(0.5)).toBe(65);
  });
});

describe("the wedge pad (D14)", () => {
  it("cuts a 2 px gap at every radius", () => {
    const { padAngle, padRadius } = wedgePad(24, 100, 2, 2);
    expect(padRadius).toBe(100);
    expect(2 * padRadius * Math.sin(((padAngle / 2) * Math.PI) / 180)).toBeCloseTo(2, 12);
  });

  it("drops the gap once the rim leaves less than a device pixel of wedge", () => {
    // 8,760 hours around a 100 px rim leave 0.07 px of rim arc per wedge, less than the gap.
    expect(wedgePad(8760, 100, 2, 2).padAngle).toBe(0);
  });

  // The week dial: 168 hours, a 98 px rim. Its rim arc is 2π·98/168 = 3.665 px, so a 2 px gap leaves
  // 1.665 px of wedge there, while its 30 px hole's arc is only 1.122 px: each wedge tapers to the hole.
  it("keeps the week dial's gap at 1×, where the rim leaves 1.665 device pixels of wedge", () => {
    const { padAngle, padRadius } = wedgePad(168, 98, 2, 1);
    expect(padRadius).toBe(98);
    // 2·asin(2 / (2·98)) = 0.0204086 rad = 1.16932°.
    expect(padAngle).toBeCloseTo(1.16932, 5);
  });

  it("keeps the week dial's gap at 2×", () => {
    expect(wedgePad(168, 98, 2, 2).padAngle).toBeCloseTo(1.16932, 5);
  });

  it("drops a year of days' gap at 1× and 2×, where the rim arc of 1.687 px is narrower than the gap", () => {
    expect(wedgePad(365, 98, 2, 1).padAngle).toBe(0);
    expect(wedgePad(365, 98, 2, 2).padAngle).toBe(0);
  });

  it("keeps the gap when the rim leaves exactly one device pixel, and drops it just under", () => {
    // 6 slots on a 9/π px rim: a rim arc of 3 px, 1 px of wedge after a 2 px gap at 1×.
    expect(wedgePad(6, 9 / Math.PI, 2, 1).padAngle).toBeGreaterThan(0);
    expect(wedgePad(6, 9 / Math.PI - 1e-9, 2, 1).padAngle).toBe(0);
    // 6 slots on a 7.5/π px rim: 0.5 CSS px of wedge after the gap, one device pixel at 2×.
    expect(wedgePad(6, 7.5 / Math.PI, 2, 2).padAngle).toBeGreaterThan(0);
    expect(wedgePad(6, 7.5 / Math.PI - 1e-9, 2, 2).padAngle).toBe(0);
  });
});

describe("the column floor (D24)", () => {
  const axis = columnAxis(100, 1);

  it("keeps one device pixel outward for a sliver above the zero ring", () => {
    expect(columnSpan(axis, 40, 40.2)).toEqual([40, 41]);
  });

  it("hangs one device pixel inward for a sliver below the zero ring", () => {
    expect(columnSpan(axis, 40, 39.8)).toEqual([39, 40]);
  });

  it("snaps a long column to device pixels with no floor", () => {
    expect(columnSpan(axis, 40, 60.4)).toEqual([40, 60]);
  });

  it("measures in device pixels at a higher ratio", () => {
    expect(columnSpan(columnAxis(100, 2), 40, 40.1)).toEqual([40, 40.5]);
  });

  it("gives a stack's floor to the segment reaching farthest out", () => {
    const spans = [columnFloorSpan(axis, 3, "a", 40, 40.2), columnFloorSpan(axis, 3, "b", 40.2, 40.4)];
    expect([...settleFloors(spans, axis)]).toEqual([0, 1]);
  });
});
