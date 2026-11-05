// The clock dial's geometry. Unit under test: slotAngles, instantAngle, clockRadius, wedgePad,
// columnAxis, columnSpan and columnFloorSpan. Oracles, written by hand: D11's equal slots, where
// slot i of n spans [360·i/n, 360·(i+1)/n); D13's radii, r = √(lerp(ri², R², t)) and lerp(ri, R, t);
// D14's constant gap, whose width 2·padRadius·sin(padAngle/2) holds at every radius, vanishing once
// the inner arc falls under 2 device pixels; and D24's floor, one device pixel along the radius away
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
    const { padAngle, padRadius } = wedgePad(24, 30, 100, 2, 2);
    expect(padRadius).toBe(100);
    expect(2 * padRadius * Math.sin(((padAngle / 2) * Math.PI) / 180)).toBeCloseTo(2, 12);
  });

  it("drops the gap once a wedge's inner arc falls under 2 device pixels", () => {
    // 8,760 hours around a 30 px hole leave 0.02 px of inner arc per wedge.
    expect(wedgePad(8760, 30, 100, 2, 2).padAngle).toBe(0);
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
