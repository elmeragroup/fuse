// Unit under test: the polar tooltip's lanes and the safe triangle. Oracles, worked by hand in
// client pixels, where y grows downward: a dial of radius 100 centred at (300, 200) inside a figure
// from (0, 0) to (600, 400); a popup 40 px tall; a side lane's inner edge 8 px past the rim or the
// labels, taken when its room holds the content and 12 px, counted as at least 128 px and at most
// 256; a popup as wide as its widest content, at least 128 px and within its room; a ray's rim
// height 200 − 100 cos θ; the lane switch at 20° past 12 or 6 o'clock, sin 20° ≈ 0.342; and the
// bottom lane one gap below the labels and the Root's controls, unless that passes the viewport.
import { describe, expect, it } from "vitest";

import { inTriangle, laneNeed, laneRest, laneSide, laneY, nearEdge } from "./polar-lane";
import type { LaneInput } from "./polar-lane";

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
  /** A ray at 90° over the default scene, with whatever a case changes. */
  const rest = (change: Partial<LaneInput>) =>
    laneRest({
      angle: 90,
      side: "right",
      dial: DIAL,
      labels: null,
      controls: null,
      size: SIZE,
      bounds: FIGURE,
      content: 80,
      viewportBottom: Number.POSITIVE_INFINITY,
      ...change,
    });

  it("puts a right lane's inner edge one gap past the rim, at the ray's height, as wide as its content's floor", () => {
    // From 408 to the figure's 600 is 192 px of room; 80 px of content takes the 128 px floor.
    expect(rest({})).toEqual({
      side: "right",
      box: { left: 408, top: 180, right: 536, bottom: 220 },
      room: 192,
      bounds: FIGURE,
    });
  });

  it("puts a left lane's inner edge one gap past the labels when they reach further than the rim", () => {
    const labels = { left: 170, top: 80, right: 430, bottom: 330 };
    // 170 − 8 = 162 px of room; the ray at 300° meets the rim at 200 − 100 cos 300° = 150.
    expect(rest({ angle: 300, side: "left", labels })).toEqual({
      side: "left",
      box: { left: 34, top: 130, right: 162, bottom: 170 },
      room: 162,
      bounds: FIGURE,
    });
  });

  it("takes the other side lane when its own holds less than 128 px", () => {
    // The right lane runs from 408 to 450, 42 px; the left one from 0 to 192.
    expect(rest({ bounds: { ...FIGURE, right: 450 } }).side).toBe("left");
  });

  it("asks a lane for the content and 12 px: 120 and 128 px take a 140 px lane, and 130 px does not", () => {
    // The right lane runs from 408 to 548, 140 px, and the left from 120 to 192, 72 px. 120 px of
    // content needs 132, which fits; 130 needs 142, which neither lane holds.
    const bounds = { ...FIGURE, left: 120, right: 548 };
    expect(rest({ bounds, content: 120 }).side).toBe("right");
    expect(rest({ bounds, content: 130 }).side).toBe("bottom");
    // 128 px, the popup's own floor, needs exactly 140, so a lane of 140 takes it.
    expect(rest({ bounds, content: 128 }).side).toBe("right");
  });

  it("takes the other side lane when its own room is narrower than the content, as wide as the content", () => {
    // 150 px of content needs 162: the right lane's 152 px does not hold it, the left lane's 192 does.
    expect(rest({ bounds: { ...FIGURE, right: 560 }, content: 150 })).toMatchObject({
      side: "left",
      box: { left: 42, right: 192 },
      room: 192,
    });
  });

  it("asks no more than 256 px of a side lane, where wider content wraps", () => {
    // 400 px of content needs 256, which the right lane's 300 px holds; its box is 256 wide.
    expect(rest({ bounds: { ...FIGURE, right: 708 }, content: 400 }).box).toEqual({
      left: 408,
      top: 180,
      right: 664,
      bottom: 220,
    });
  });

  it("falls back below the labels, centred on the dial, when neither side lane fits", () => {
    // Both lanes hold 2 px. The labels reach 320, so the lane's top is 328, and the 128 px popup
    // centres on the dial at 236.
    const labels = { left: 180, top: 85, right: 420, bottom: 320 };
    expect(rest({ labels, bounds: { left: 170, top: 0, right: 430, bottom: 500 } }).box).toEqual({
      left: 236,
      top: 328,
      right: 364,
      bottom: 368,
    });
  });

  it("rests the bottom lane below the Root's legend and table toggle", () => {
    // 300 px of content needs 256, more than either 192 px lane. The controls end at 380, so the
    // lane's top is 388, and the 300 px popup centres on the dial at 150.
    const controls = { left: 150, top: 340, right: 450, bottom: 380 };
    expect(rest({ controls, content: 300 }).box).toEqual({ left: 150, top: 388, right: 450, bottom: 428 });
  });

  it("rests below the rim instead when below the controls would pass the viewport", () => {
    // 388 + 40 = 428 passes a viewport ending at 420, so the lane's top is the rim's 300 + 8.
    const controls = { left: 150, top: 340, right: 450, bottom: 380 };
    expect(rest({ controls, content: 300, viewportBottom: 420 }).box.top).toBe(308);
  });

  it("keeps a side lane's popup above controls under it", () => {
    // The right lane's 408 to 536 crosses controls from 350 to 550 whose top is 250, so its popup
    // stays above 242. The ray at 180° meets the rim at 300, and the 40 px popup centres at 222.
    const controls = { left: 350, top: 250, right: 550, bottom: 290 };
    expect(rest({ angle: 180, controls })).toEqual({
      side: "right",
      box: { left: 408, top: 202, right: 536, bottom: 242 },
      room: 192,
      bounds: { ...FIGURE, bottom: 242 },
    });
  });
});

describe("the bottom lane of a semicircle", () => {
  it("sits one gap below the flat edge, where the drawing ends, not below the missing half", () => {
    // A semicircle's drawing ends at its centre's height, 200, so the lane's top sits at 208.
    const { side, box } = laneRest({
      angle: 90,
      side: "right",
      dial: { ...DIAL, bottom: 0 },
      labels: null,
      controls: null,
      size: SIZE,
      bounds: { left: 200, top: 0, right: 400, bottom: 400 },
      content: 80,
      viewportBottom: Number.POSITIVE_INFINITY,
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
