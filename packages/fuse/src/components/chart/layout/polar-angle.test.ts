// The polar angle convention. Unit under test: pointerAngle, angleInSweep, sweepOf, polarPoint and
// sweepBox. Oracles: CONTRACT section 8.5's frame, d3-shape 3.2.0's lineRadial vector for the same
// frame, ticket 08's Q8 cases, and the sweep boxes of
// ticket 08's plot-cell judge, worked by hand for a 200 px cell: 200 by 200 for a circle, 200 by 100
// for −90 to 90, 200 by 150 for −120 to 120 and 200 by 170.71 for −135 to 135.
import { describe, expect, it } from "vitest";

import { angleInSweep, pointerAngle, polarPoint, sweepBox, sweepOf } from "./polar-angle";

describe("pointerAngle", () => {
  it("reads 0 at the exact centre, where atan2(0, −0) would read 180", () => {
    expect(Math.atan2(0, -0)).toBe(Math.PI);
    expect(pointerAngle(0, 0)).toBe(0);
  });

  it.each([
    ["12 o'clock", 0, -0.001, 0],
    ["3 o'clock", 0.001, 0, 90],
    ["6 o'clock", 0, 0.001, 180],
    ["9 o'clock", -0.001, 0, 270],
  ])("reads %s from an offset of 0.001 px", (_, dx, dy, angle) => {
    expect(pointerAngle(dx, dy)).toBeCloseTo(angle, 9);
  });

  it("stays below 360 just left of 12 o'clock", () => {
    const angle = pointerAngle(-1e-12, -1);
    expect(angle).toBeGreaterThan(359.999);
    expect(angle).toBeLessThan(360);
  });
});

describe("angleInSweep", () => {
  const gauge = sweepOf(-135, 135);

  it("measures from a −135 to 135 gauge's start", () => {
    expect(angleInSweep(0, gauge)).toBe(135);
    expect(angleInSweep(225, gauge)).toBe(0);
    expect(angleInSweep(135, gauge)).toBe(270);
    expect(angleInSweep(180, gauge)).toBeNull();
  });

  it("measures a counter-clockwise 90 to −270 sweep in its own direction", () => {
    const sweep = sweepOf(90, -270);
    expect(sweep).toEqual({ start: 90, end: -270, width: 360, direction: -1 });
    expect(angleInSweep(0, sweep)).toBe(90);
    expect(angleInSweep(180, sweep)).toBe(270);
  });

  it("clamps a sweep wider than a turn to one turn, which holds every angle", () => {
    const sweep = sweepOf(0, 500);
    expect(sweep.width).toBe(360);
    expect(sweep.end).toBe(360);
    expect(angleInSweep(359, sweep)).toBe(359);
  });

  it("holds nothing past a 90 to 270 sweep, where the exact centre's 0 lies outside", () => {
    expect(angleInSweep(pointerAngle(0, 0), sweepOf(90, 270))).toBeNull();
  });
});

describe("the frame", () => {
  it("puts 0° at 12 o'clock and 90° at 3 o'clock, clockwise", () => {
    const top = polarPoint(0, 100);
    const right = polarPoint(90, 100);
    expect([top.x, top.y]).toEqual([0, -100]);
    expect(right.x).toBeCloseTo(100, 12);
    expect(right.y).toBeCloseTo(0, 12);
  });

  it("places a vertex in d3's radial frame at any angle, as d3-shape's own lineRadial test expects", () => {
    // d3-shape 3.2.0's test "lineRadial() returns a default radial line shape", line 12: the points
    // [2 rad, 3] and [4 rad, 5] draw at (2.727892, 1.248441) and (−3.784012, 3.268218). Every radar
    // and clock vertex goes through polarPoint, so the vector replays here, in degrees.
    const degrees = (radians: number) => (radians * 180) / Math.PI;
    const a = polarPoint(degrees(2), 3);
    const b = polarPoint(degrees(4), 5);
    expect([a.x, a.y, b.x, b.y].map((value) => Number(value.toFixed(6)))).toEqual([
      2.727892, 1.248441, -3.784012, 3.268218,
    ]);
  });
});

describe("sweepBox", () => {
  // Each box in units of the outer radius, scaled to a 200 px wide cell.
  const pixels = (start: number, end: number) => {
    const box = sweepBox(sweepOf(start, end));
    const scale = 200 / (box.right - box.left);
    return [(box.right - box.left) * scale, (box.bottom - box.top) * scale];
  };

  it.each([
    ["a full circle", 0, 360, 200, 200],
    ["the top semicircle", -90, 90, 200, 100],
    ["the bottom semicircle", 90, 270, 200, 100],
    ["a 240° gauge", -120, 120, 200, 150],
    ["a 270° gauge", -135, 135, 200, 170.71],
  ])("sizes %s at the hand-worked cell", (_, start, end, width, height) => {
    const [w, h] = pixels(start, end);
    expect(w).toBeCloseTo(width, 2);
    expect(h).toBeCloseTo(height, 2);
  });

  it("sets the top semicircle's flat edge at the centre's line, at the bottom", () => {
    expect(sweepBox(sweepOf(-90, 90))).toEqual({ left: -1, top: -1, right: 1, bottom: 0 });
  });
});
