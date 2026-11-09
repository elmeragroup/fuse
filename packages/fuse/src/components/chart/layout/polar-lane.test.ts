// Unit under test: the polar tooltip's lanes and the safe triangle. Oracles, worked by hand in
// client pixels, where y grows downward: a dial of radius 100 centred at (300, 200) inside a figure
// from (0, 0) to (600, 400); a popup 40 px tall; a side lane's inner edge 8 px past the rim or the
// labels, taken when its room holds the content and 12 px, counted as at least 128 px and at most
// 256; a popup as wide as its widest content, at least 128 px and within its room; a ray's rim
// height 200 − 100 cos θ; the lane switch at 20° past 12 or 6 o'clock, sin 20° ≈ 0.342; and the
// bottom lane one gap below the labels and the Root's controls, unless that passes the viewport,
// then one gap below the rim, then the top lane one gap above the dial, the labels, the controls
// and the title, inside the viewport's top, and where neither fits, whichever shows more popup.
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
      viewportTop: Number.NEGATIVE_INFINITY,
      title: null,
      viewportLeft: Number.NEGATIVE_INFINITY,
      viewportRight: Number.POSITIVE_INFINITY,
      keep: null,
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

describe("laneRest past the viewport (R2.3)", () => {
  // Both side lanes of the figure from 170 to 430 hold 2 px, so the popup leaves them. It is
  // 128 px wide and 40 tall, centred on the dial from 236 to 364. Controls under the dial run from
  // 310 to 330, and a title above it from 60 to 90. The rim ends at 300, so below the controls is
  // 338, below the rim 308, and above the title's 60 the popup ends at 52 and starts at 12.
  const scene = (viewportTop: number, viewportBottom: number) =>
    laneRest({
      angle: 90,
      side: "right",
      dial: DIAL,
      labels: null,
      controls: { left: 150, top: 310, right: 450, bottom: 330 },
      size: SIZE,
      bounds: { left: 170, top: 0, right: 430, bottom: 500 },
      content: 80,
      viewportBottom,
      viewportTop,
      title: { left: 200, top: 60, right: 400, bottom: 90 },
      viewportLeft: Number.NEGATIVE_INFINITY,
      viewportRight: Number.POSITIVE_INFINITY,
      keep: null,
    });

  it("rests below the controls when 338 + 40 fits a viewport ending at 400", () => {
    expect(scene(0, 400)).toMatchObject({
      side: "bottom",
      box: { left: 236, top: 338, right: 364, bottom: 378 },
    });
  });

  it("rests below the rim when 378 passes a viewport ending at 360 and 308 + 40 does not", () => {
    expect(scene(0, 360)).toMatchObject({
      side: "bottom",
      box: { left: 236, top: 308, right: 364, bottom: 348 },
    });
  });

  it("rests above the title when 348 passes a viewport ending at 340 and 12 is inside its top at 0", () => {
    expect(scene(0, 340)).toMatchObject({ side: "top", box: { left: 236, top: 12, right: 364, bottom: 52 } });
  });

  it("keeps the dial, the labels and the controls clear above, whichever is highest", () => {
    // Labels reaching up to 40 lift the popup's bottom to 32 and its top to -8, inside a viewport
    // starting at -20.
    const { side, box } = laneRest({
      angle: 90,
      side: "right",
      dial: DIAL,
      labels: { left: 180, top: 40, right: 420, bottom: 280 },
      controls: null,
      size: SIZE,
      bounds: { left: 170, top: 0, right: 430, bottom: 500 },
      content: 80,
      viewportBottom: 320,
      viewportTop: -20,
      title: null,
      viewportLeft: Number.NEGATIVE_INFINITY,
      viewportRight: Number.POSITIVE_INFINITY,
      keep: null,
    });
    expect(side).toBe("top");
    expect(box).toEqual({ left: 236, top: -8, right: 364, bottom: 32 });
  });

  it("takes below the rim where neither fits and below shows more: 32 px against 22", () => {
    // A viewport from 30 to 340: below the rim shows 340 − 308 = 32 px, above shows 52 − 30 = 22.
    expect(scene(30, 340)).toMatchObject({ side: "bottom", box: { top: 308, bottom: 348 } });
  });

  it("takes above the title where neither fits and above shows more: 22 px against 12", () => {
    // A viewport from 30 to 320: below the rim shows 320 − 308 = 12 px, above shows 22.
    expect(scene(30, 320)).toMatchObject({ side: "top", box: { top: 12, bottom: 52 } });
  });
});

describe("laneRest clipped to the viewport (R2.3)", () => {
  // Every lane's vertical bounds are its own bounds cut to the viewport, and a lane fits only when
  // that cut holds the 40 px popup. The default scene: the dial of radius 100 at (300, 200) in the
  // figure from 0 to 400, its right lane from 408 with 192 px of room.
  const rest = (change: Partial<LaneInput>) =>
    laneRest({
      angle: 0,
      side: "right",
      dial: DIAL,
      labels: null,
      controls: null,
      size: SIZE,
      bounds: FIGURE,
      content: 80,
      viewportBottom: Number.POSITIVE_INFINITY,
      viewportTop: Number.NEGATIVE_INFINITY,
      title: null,
      viewportLeft: Number.NEGATIVE_INFINITY,
      viewportRight: Number.POSITIVE_INFINITY,
      keep: null,
      ...change,
    });
  // A figure too narrow for either side lane: both hold 2 px.
  const NARROW = { left: 170, top: 0, right: 430, bottom: 500 };

  it("keeps a side lane's popup below the viewport's top, at 150 where the ray's rim is at 100", () => {
    // At 12 o'clock the rim is at y 100, so the popup would centre there, 80 to 120. The viewport
    // starts at 150, so the lane's bounds start there and the popup rests at 150 to 190.
    expect(rest({ viewportTop: 150 })).toEqual({
      side: "right",
      box: { left: 408, top: 150, right: 536, bottom: 190 },
      room: 192,
      bounds: { ...FIGURE, top: 150 },
    });
  });

  it("keeps a side lane's popup above the viewport's bottom, at 290 where the ray's rim is at 300", () => {
    // At 6 o'clock the rim is at y 300, so the popup would centre there, 280 to 320.
    expect(rest({ angle: 180, viewportBottom: 290 }).box).toEqual({
      left: 408,
      top: 250,
      right: 536,
      bottom: 290,
    });
  });

  it("leaves a side lane whose cut to the viewport is shorter than the popup for one that fits", () => {
    // The viewport from 380 to 600 leaves the figure, which ends at 400, 20 px, under the popup's
    // 40, so neither side lane fits. Below the rim, at 308 moved down to 380, the popup fits from
    // 380 to 420.
    expect(rest({ viewportTop: 380, viewportBottom: 600 })).toMatchObject({
      side: "bottom",
      box: { top: 380, bottom: 420 },
    });
  });

  it("takes the lane that shows the most of the popup inside its own span where none fits", () => {
    // A viewport from 380 to 410. The right lane's span is the figure's 380 to 400: its popup,
    // clamped there, centres at 390, 370 to 410, and shows 20 px inside the span. The bottom lane's
    // span is 380 to 410, where its popup, 380 to 420, shows 30 px, so the popup takes it.
    expect(rest({ viewportTop: 380, viewportBottom: 410 })).toMatchObject({
      side: "bottom",
      box: { top: 380, bottom: 420 },
    });
  });

  it("takes the earlier lane on a tie", () => {
    // A viewport from 380 to 400: the right lane's popup, 370 to 410, and the bottom lane's, 380 to
    // 420, each show 20 px inside their spans, so the right lane, first in the order, holds it.
    expect(rest({ viewportTop: 380, viewportBottom: 400 })).toMatchObject({
      side: "right",
      box: { top: 370, bottom: 410 },
    });
  });

  it("leaves a side lane that controls under it cut shorter than the popup", () => {
    // A side legend from y 40 down the right lane (x 350 to 550) leaves the right lane 0 to 32, under
    // the popup's 40, so the popup takes the left lane, which the legend does not reach. The ray at
    // 0° meets the rim at 100, so the popup rests at 80 to 120, as wide as its 128 px floor.
    const controls = { left: 350, top: 40, right: 550, bottom: 360 };
    expect(rest({ controls })).toMatchObject({
      side: "left",
      box: { left: 64, top: 80, right: 192, bottom: 120 },
    });
  });

  it("leaves a side lane that a legend makes impossible, its bottom above its top", () => {
    // A legend from y 4 leaves the right lane's bottom at −4, above the figure's top at 0. The popup
    // would centre across that span and lie over the legend, so the lane is no candidate.
    const controls = { left: 350, top: 4, right: 550, bottom: 396 };
    expect(rest({ controls }).side).toBe("left");
  });

  it("leaves both side lanes when the controls and the viewport cut each below the popup", () => {
    // A legend across both lanes from 270, and a viewport from 230: each side lane keeps 230 to 262,
    // 32 px. Below the legend, which ends at 290, is 298, under the rim's 308, so the bottom lane
    // starts at 308.
    const controls = { left: 0, top: 270, right: 600, bottom: 290 };
    expect(rest({ controls, viewportTop: 230 })).toMatchObject({
      side: "bottom",
      box: { top: 308, bottom: 348 },
    });
  });

  it("leaves a side lane shorter than a tall popup for the bottom lane", () => {
    // A 272 px popup beside a figure 200 px tall: neither side lane holds it, so it rests below the
    // rim, from 308.
    const tall = { width: 80, height: 272 };
    expect(rest({ size: tall, bounds: { ...FIGURE, bottom: 200 } })).toMatchObject({
      side: "bottom",
      box: { top: 308, bottom: 580 },
    });
  });

  it("cuts the bottom lane to the visible area's sides, as a pinch zoom leaves them", () => {
    // The popup centres on the dial at 236 to 364, but the visible area ends at x 300, so it rests
    // against that edge, 172 to 300, inside the figure's 170 to 430.
    expect(rest({ bounds: NARROW, viewportTop: 0, viewportBottom: 1000, viewportRight: 300 })).toMatchObject({
      side: "bottom",
      box: { left: 172, right: 300 },
      bounds: { left: 170, right: 300 },
    });
  });

  it("leaves the figure across for the visible area when their overlap is narrower than the popup", () => {
    // The visible area from x 0 to 220 overlaps the figure's 170 to 430 by 50 px, under the popup's
    // 128 px floor, so the popup takes the visible area's own width: centred on the dial at 236 it
    // would end at 364, so it rests against the visible right edge, 92 to 220.
    expect(
      rest({ bounds: NARROW, viewportTop: 0, viewportBottom: 1000, viewportLeft: 0, viewportRight: 220 })
    ).toMatchObject({ side: "bottom", box: { left: 92, right: 220 } });
  });

  it("starts the right lane at the visible area's left edge when a pan leaves its inner edge hidden", () => {
    // The right lane's inner edge is the rim's 400 and the 8 px gap, 408, but the visible area runs
    // from x 450 to 950. The lane's span is 450 to the figure's 600, 150 px, which holds the 128 px
    // the content asks, so the popup starts at 450 and ends at 578, clear of the dial. The ray at
    // 90° meets the rim at y 200.
    expect(
      rest({ angle: 90, viewportTop: 0, viewportBottom: 400, viewportLeft: 450, viewportRight: 950 })
    ).toEqual({
      side: "right",
      box: { left: 450, top: 180, right: 578, bottom: 220 },
      room: 150,
      bounds: { ...FIGURE, top: 0, bottom: 400 },
    });
  });

  it("ends the left lane at the visible area's right edge when a pan leaves its inner edge hidden", () => {
    // The mirror: the left lane's inner edge is 192, and the visible area runs from x −350 to 150.
    // The span is the figure's 0 to 150, so the popup ends at 150 and starts at 22.
    expect(
      rest({
        angle: 270,
        side: "left",
        viewportTop: 0,
        viewportBottom: 400,
        viewportLeft: -350,
        viewportRight: 150,
      })
    ).toMatchObject({ side: "left", box: { left: 22, right: 150 }, room: 150 });
  });

  it("leaves both side lanes when the cut leaves each too narrow, for the bottom lane", () => {
    // A visible area from x 500 to 950: the right lane keeps 500 to 600, 100 px, and the left lane
    // none. The figure's visible part, 100 px, is under the popup's floor, so the bottom lane takes
    // the visible area's width and rests against its left edge, 500 to 628, below the rim at 308.
    expect(rest({ angle: 90, viewportLeft: 500, viewportRight: 950 })).toMatchObject({
      side: "bottom",
      box: { left: 500, top: 308, right: 628, bottom: 348 },
    });
  });

  it("cuts a side lane's room to the visible area's sides, at the lane's outer edge", () => {
    // The outer-edge cut, which predates the inner-edge cut: the right lane runs from 408 to the
    // figure's 600, but the visible area ends at x 500, which leaves 92 px, under the 128 the
    // content asks, so the popup takes the left lane, 0 to 192. It is 128 px wide and ends at the
    // lane's inner edge, 192, so it starts at 64; the ray at 0° meets the rim at y 100.
    expect(rest({ viewportRight: 500 })).toMatchObject({
      side: "left",
      box: { left: 64, top: 80, right: 192, bottom: 120 },
      room: 192,
    });
  });

  it("starts the bottom lane at the viewport's top when the dial is scrolled above it", () => {
    // Below the rim is 308, but the viewport starts at 320, so the popup rests at 320 to 360.
    expect(rest({ bounds: NARROW, viewportTop: 320, viewportBottom: 600 })).toMatchObject({
      side: "bottom",
      box: { left: 236, top: 320, right: 364, bottom: 360 },
    });
  });

  it("ends the top lane at the viewport's bottom when the dial is scrolled below it", () => {
    // Below the rim cannot fit a viewport ending at 60. Above the dial ends at 92, cut to 60, so
    // the popup rests at 20 to 60.
    expect(rest({ bounds: NARROW, viewportTop: -500, viewportBottom: 60 })).toMatchObject({
      side: "top",
      box: { left: 236, top: 20, right: 364, bottom: 60 },
    });
  });

  it("keeps the top lane the popup shows while it still fits, though the bottom lane fits too", () => {
    // The top lane, 52 to 92, and the bottom lane, 308 to 348, both fit a viewport from 0 to 1000.
    expect(rest({ bounds: NARROW, viewportTop: 0, viewportBottom: 1000 }).side).toBe("bottom");
    expect(rest({ bounds: NARROW, viewportTop: 0, viewportBottom: 1000, keep: "top" })).toMatchObject({
      side: "top",
      box: { top: 52, bottom: 92 },
    });
  });

  it("leaves a kept top lane that no longer fits for the first lane that does", () => {
    // A viewport from 100 to 1000 cuts the top lane's 52 to 92 away, so the popup goes below.
    expect(rest({ bounds: NARROW, viewportTop: 100, viewportBottom: 1000, keep: "top" })).toMatchObject({
      side: "bottom",
      box: { top: 308 },
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
      viewportTop: Number.NEGATIVE_INFINITY,
      title: null,
      viewportLeft: Number.NEGATIVE_INFINITY,
      viewportRight: Number.POSITIVE_INFINITY,
      keep: null,
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
