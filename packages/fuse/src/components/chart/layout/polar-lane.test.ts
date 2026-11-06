// Unit under test: the polar tooltip's lanes (MOTION-REVIEW Fix R2) and Q9's safe triangle.
// Oracles, worked by hand in client pixels, where y grows downward: a dial of radius 100 centred at
// (300, 200) inside a figure from (0, 0) to (600, 400); a popup of 80 by 40; a side lane's inner
// edge 8 px past the rim or the labels, taken when it holds 128 px; a ray's rim height
// 200 − 100 cos θ; and the lane switch at 20° past 12 or 6 o'clock, sin 20° ≈ 0.342.
import { describe, expect, it } from "vitest";

import { inTriangle, laneRest, laneSide, laneY, nearEdge } from "./polar-lane";

const DIAL = { centre: { x: 300, y: 200 }, radius: 100 };
const FIGURE = { left: 0, top: 0, right: 600, bottom: 400 };
const SIZE = { width: 80, height: 40 };

describe("laneSide", () => {
  it.each([
    [10, null, "right"],
    [180, null, "right"],
    [0, null, "right"],
    [190, null, "left"],
    [350, null, "left"],
    // A popup keeps its lane until the ray is 20° into the other half.
    [345, "right", "right"],
    [339, "right", "left"],
    [195, "right", "right"],
    [201, "right", "left"],
    [15, "left", "left"],
    [21, "left", "right"],
  ] as const)("puts a ray at %s° from %s in the %s lane", (angle, current, side) => {
    expect(laneSide(angle, current)).toBe(side);
  });
});

describe("laneY", () => {
  it.each([
    [90, 200],
    [0, 100],
    [180, 300],
    [60, 150],
  ])("centres a side lane at the ray's rim height for %s°", (angle, y) => {
    expect(laneY(angle, DIAL, 40, FIGURE)).toBeCloseTo(y, 9);
  });

  it("keeps the popup inside the figure", () => {
    // At 12 o'clock the rim is at y = 20 in a figure starting at 30, so a 40 px popup centres at 50.
    expect(laneY(0, { centre: { x: 300, y: 120 }, radius: 100 }, 40, { ...FIGURE, top: 30 })).toBe(50);
  });
});

describe("laneRest", () => {
  it("puts a right lane's inner edge one gap past the rim, at the ray's height", () => {
    expect(laneRest(90, "right", DIAL, null, SIZE, FIGURE)).toEqual({
      side: "right",
      box: { left: 408, top: 180, right: 488, bottom: 220 },
      room: 192,
    });
  });

  it("puts a left lane's inner edge one gap past the labels when they reach further than the rim", () => {
    const labels = { left: 170, top: 80, right: 430, bottom: 330 };
    // 162 − 80 = 82; the ray at 300° meets the rim at 200 − 100 cos 300° = 150.
    expect(laneRest(300, "left", DIAL, labels, SIZE, FIGURE)).toEqual({
      side: "left",
      box: { left: 82, top: 130, right: 162, bottom: 170 },
      room: 162,
    });
  });

  it("takes the other side lane when its own holds less than 128 px", () => {
    // The right lane runs from 408 to 450, 42 px; the left one from 0 to 192.
    const { side } = laneRest(90, "right", DIAL, null, SIZE, { ...FIGURE, right: 450 });
    expect(side).toBe("left");
  });

  it("caps a popup wider than its lane at the lane's room, whatever its text", () => {
    // From 408 to 560 is 152 px, at least 128, so a 200 px popup takes the lane at 152 px.
    expect(laneRest(90, "right", DIAL, null, { width: 200, height: 40 }, { ...FIGURE, right: 560 })).toEqual({
      side: "right",
      box: { left: 408, top: 180, right: 560, bottom: 220 },
      room: 152,
    });
  });

  it("falls back below the labels, centred on the dial, when neither side lane fits", () => {
    const labels = { left: 180, top: 85, right: 420, bottom: 320 };
    const { side, box } = laneRest(90, "right", DIAL, labels, SIZE, {
      left: 170,
      top: 0,
      right: 430,
      bottom: 500,
    });
    expect(side).toBe("bottom");
    expect(box).toEqual({ left: 260, top: 328, right: 340, bottom: 368 });
  });
});

describe("the bottom lane of a semicircle", () => {
  it("sits one gap below the flat edge, where the drawing ends, not below the missing half", () => {
    // A semicircle's drawing ends at its centre's height, 200, so the lane's top sits at 208.
    const semicircle = { ...DIAL, bottom: 0 };
    const { side, box } = laneRest(90, "right", semicircle, null, SIZE, {
      left: 200,
      top: 0,
      right: 400,
      bottom: 400,
    });
    expect(side).toBe("bottom");
    expect(box.top).toBe(208);
  });
});

describe("the safe triangle (Q9)", () => {
  const a = { x: 0, y: 0 };
  const b = { x: 10, y: 0 };
  const c = { x: 0, y: 10 };

  it.each([
    [{ x: 2, y: 2 }, true],
    [{ x: 5, y: 5 }, true],
    [{ x: 0, y: 0 }, true],
    [{ x: 6, y: 6 }, false],
    [{ x: -1, y: 2 }, false],
  ])("holds %o: %s", (point, inside) => {
    expect(inTriangle(point, a, b, c)).toBe(inside);
  });

  const box = { left: 100, top: 100, right: 140, bottom: 120 };

  it("takes the box's left edge from a point to its left", () => {
    expect(nearEdge({ x: 50, y: 110 }, box)).toEqual([
      { x: 100, y: 100 },
      { x: 100, y: 120 },
    ]);
  });

  it("takes the box's bottom edge from a point mostly below it", () => {
    expect(nearEdge({ x: 130, y: 200 }, box)).toEqual([
      { x: 100, y: 120 },
      { x: 140, y: 120 },
    ]);
  });
});
