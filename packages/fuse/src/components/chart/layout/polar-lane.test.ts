// Unit under test: the polar tooltip's lanes (MOTION-REVIEW Fix R2) and Q9's safe triangle.
// Oracles, worked by hand in client pixels, where y grows downward: a dial of radius 100 centred at
// (300, 200) inside a figure from (0, 0) to (600, 400); a popup of 80 by 40 whose content needs 80 px;
// a side lane's inner edge 8 px past the rim or the labels, taken when its room holds the content
// with 15% to spare, counted as at least 128 px and at most 256, and its box the room up to 256 px;
// a ray's rim height
// 200 − 100 cos θ; and the lane switch at 20° past 12 or 6 o'clock, sin 20° ≈ 0.342.
import { describe, expect, it } from "vitest";

import { inTriangle, laneNeed, laneRest, laneSide, laneY, nearEdge } from "./polar-lane";

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

describe("laneNeed", () => {
  it.each([
    [80, 128],
    [180, 180],
    [400, 256],
  ])("needs %s px of content to take a %s px lane", (content, need) => {
    expect(laneNeed(content)).toBe(need);
  });
});

describe("laneRest", () => {
  it("puts a right lane's inner edge one gap past the rim, at the ray's height", () => {
    // From 408 to the figure's 600 is 192 px of room.
    expect(laneRest(90, "right", DIAL, null, SIZE, FIGURE, 80)).toEqual({
      side: "right",
      box: { left: 408, top: 180, right: 600, bottom: 220 },
      room: 192,
    });
  });

  it("puts a left lane's inner edge one gap past the labels when they reach further than the rim", () => {
    const labels = { left: 170, top: 80, right: 430, bottom: 330 };
    // 170 − 8 = 162 px of room; the ray at 300° meets the rim at 200 − 100 cos 300° = 150.
    expect(laneRest(300, "left", DIAL, labels, SIZE, FIGURE, 80)).toEqual({
      side: "left",
      box: { left: 0, top: 130, right: 162, bottom: 170 },
      room: 162,
    });
  });

  it("takes the other side lane when its own holds less than 128 px", () => {
    // The right lane runs from 408 to 450, 42 px; the left one from 0 to 192.
    const { side } = laneRest(90, "right", DIAL, null, SIZE, { ...FIGURE, right: 450 }, 80);
    expect(side).toBe("left");
  });

  it("takes the other side lane when its own room is narrower than the content (N2)", () => {
    // 150 px of content asks 172.5 with its slack. From 408 to 560 is 152 px, which holds 128 but not
    // 172.5; the left lane's 192 does.
    const { side, room } = laneRest(90, "right", DIAL, null, SIZE, { ...FIGURE, right: 560 }, 150);
    expect([side, room]).toEqual(["left", 192]);
  });

  it("asks a side lane for 15% more room than the content it opens with", () => {
    // 140 px of content asks 161, which the right lane's 152 px does not hold, though the content
    // alone would fit; with the left lane at 192 − 120 = 72 px, it rests below.
    const { side } = laneRest(90, "right", DIAL, null, SIZE, { ...FIGURE, left: 120, right: 560 }, 140);
    expect(side).toBe("bottom");
  });

  it("falls back below when neither side lane's room holds the content (N2)", () => {
    // The right lane holds 152 px and the left one 192 − 120 = 72, both under 200 px of content's 230.
    // Below the rim at 300 plus the gap, the 80 px popup centres on the dial at 260.
    const { side, box } = laneRest(90, "right", DIAL, null, SIZE, { ...FIGURE, left: 120, right: 560 }, 200);
    expect(side).toBe("bottom");
    expect(box).toEqual({ left: 260, top: 308, right: 340, bottom: 348 });
  });

  it("asks no more than 256 px of a side lane, where wider content wraps", () => {
    // 400 px of content, 460 with its slack, needs 256, which the right lane's 300 px of room holds;
    // its box is 256 wide.
    expect(laneRest(90, "right", DIAL, null, SIZE, { ...FIGURE, right: 708 }, 400)).toEqual({
      side: "right",
      box: { left: 408, top: 180, right: 664, bottom: 220 },
      room: 300,
    });
  });

  it("falls back below the labels, centred on the dial, when neither side lane fits", () => {
    const labels = { left: 180, top: 85, right: 420, bottom: 320 };
    const { side, box } = laneRest(
      90,
      "right",
      DIAL,
      labels,
      SIZE,
      {
        left: 170,
        top: 0,
        right: 430,
        bottom: 500,
      },
      80
    );
    expect(side).toBe("bottom");
    expect(box).toEqual({ left: 260, top: 328, right: 340, bottom: 368 });
  });
});

describe("the bottom lane of a semicircle", () => {
  it("sits one gap below the flat edge, where the drawing ends, not below the missing half", () => {
    // A semicircle's drawing ends at its centre's height, 200, so the lane's top sits at 208.
    const semicircle = { ...DIAL, bottom: 0 };
    const { side, box } = laneRest(
      90,
      "right",
      semicircle,
      null,
      SIZE,
      {
        left: 200,
        top: 0,
        right: 400,
        bottom: 400,
      },
      80
    );
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
