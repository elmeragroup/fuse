import { describe, expect, it } from "vitest";

import { IDLE, stepGesture } from "../src/lib/studio/gesture";
import type { Gesture } from "../src/lib/studio/gesture";

// Every expected gesture and camera move below is worked by hand. A pinch's distance is the
// straight line between its two fingers and its midpoint is their average. A press stays a tap
// while its finger stays within 6 px of where it landed.

const touchPan: Gesture = { kind: "pan", pointerId: 1, anchor: { x: 10, y: 10 }, touch: true };

const press: Gesture = { kind: "press", pointerId: 1, origin: { x: 10, y: 10 }, point: { x: 10, y: 10 } };

const pinch: Gesture = {
  kind: "pinch",
  first: { id: 1, point: { x: 0, y: 0 } },
  second: { id: 2, point: { x: 100, y: 0 } },
  distance: 100,
  mid: { x: 50, y: 0 },
};

describe("stepGesture from idle", () => {
  it("starts a press where a finger lands, which is not yet a pan", () => {
    expect(
      stepGesture(IDLE, { type: "down", pointerId: 1, point: { x: 10, y: 10 }, touch: true, space: false })
    ).toEqual({
      gesture: press,
    });
  });

  it("starts a mouse pan at once", () => {
    expect(
      stepGesture(IDLE, { type: "down", pointerId: 1, point: { x: 10, y: 10 }, touch: false, space: false })
    ).toEqual({
      gesture: { ...touchPan, touch: false },
    });
  });

  it("starts a space pan when Space holds the hand", () => {
    expect(
      stepGesture(IDLE, { type: "down", pointerId: 7, point: { x: 3, y: 4 }, touch: false, space: true })
    ).toEqual({
      gesture: { kind: "space-pan", pointerId: 7, anchor: { x: 3, y: 4 } },
    });
  });

  it("ignores moves and lifts", () => {
    expect(stepGesture(IDLE, { type: "move", pointerId: 1, point: { x: 5, y: 5 } })).toEqual({
      gesture: IDLE,
    });
    expect(stepGesture(IDLE, { type: "up", pointerId: 1 })).toEqual({ gesture: IDLE });
  });
});

describe("stepGesture while a finger presses", () => {
  it("stays a press, without moving the camera, within 6 px of where it landed", () => {
    // (14, 14) is hypot(4, 4) ≈ 5.66 px from (10, 10).
    expect(stepGesture(press, { type: "move", pointerId: 1, point: { x: 14, y: 14 } })).toEqual({
      gesture: { ...press, point: { x: 14, y: 14 } },
    });
  });

  it("is a tap when the finger lifts within the threshold", () => {
    const moved: Gesture = { ...press, point: { x: 14, y: 14 } };
    expect(stepGesture(moved, { type: "up", pointerId: 1 })).toEqual({ gesture: IDLE, tap: true });
  });

  it("turns into a pan past the threshold, moving the camera the whole way from the press", () => {
    // (17, 10) is 7 px from (10, 10): a pan of (7, 0), anchored where the finger now is.
    expect(stepGesture(press, { type: "move", pointerId: 1, point: { x: 17, y: 10 } })).toEqual({
      gesture: { kind: "pan", pointerId: 1, anchor: { x: 17, y: 10 }, touch: true },
      move: { delta: { x: 7, y: 0 } },
    });
  });

  it("is no tap when a dragged finger lifts", () => {
    const dragged = stepGesture(press, { type: "move", pointerId: 1, point: { x: 17, y: 10 } }).gesture;
    expect(stepGesture(dragged, { type: "up", pointerId: 1 })).toEqual({ gesture: IDLE });
  });

  it("turns into a pinch, never a tap, when a second finger lands", () => {
    // Fingers at (12, 10) and (12, 50): 40 apart, midpoint (12, 30).
    const moved: Gesture = { ...press, point: { x: 12, y: 10 } };
    const pinched = stepGesture(moved, {
      type: "down",
      pointerId: 2,
      point: { x: 12, y: 50 },
      touch: true,
      space: false,
    });
    expect(pinched).toEqual({
      gesture: {
        kind: "pinch",
        first: { id: 1, point: { x: 12, y: 10 } },
        second: { id: 2, point: { x: 12, y: 50 } },
        distance: 40,
        mid: { x: 12, y: 30 },
      },
    });
    // Both fingers lift unmoved: the pinch hands over to a pan, whose lift is no tap.
    const handed = stepGesture(pinched.gesture, { type: "up", pointerId: 2 }).gesture;
    expect(stepGesture(handed, { type: "up", pointerId: 1 })).toEqual({ gesture: IDLE });
  });

  it("ends without a tap on cancel, and ignores another pointer's lift", () => {
    expect(stepGesture(press, { type: "cancel", pointerId: 1 })).toEqual({ gesture: IDLE });
    expect(stepGesture(press, { type: "up", pointerId: 2 })).toEqual({ gesture: press });
  });
});

describe("stepGesture while panning", () => {
  it("pans by the pointer's movement and re-anchors on it", () => {
    // (25, 40) - (10, 10) = (15, 30).
    expect(stepGesture(touchPan, { type: "move", pointerId: 1, point: { x: 25, y: 40 } })).toEqual({
      gesture: { ...touchPan, anchor: { x: 25, y: 40 } },
      move: { delta: { x: 15, y: 30 } },
    });
  });

  it("ignores another pointer's movement", () => {
    expect(stepGesture(touchPan, { type: "move", pointerId: 9, point: { x: 99, y: 99 } })).toEqual({
      gesture: touchPan,
    });
  });

  it("turns into a pinch when a second finger lands", () => {
    // Fingers at (10, 10) and (10, 50): 40 apart, midpoint (10, 30).
    expect(
      stepGesture(touchPan, {
        type: "down",
        pointerId: 2,
        point: { x: 10, y: 50 },
        touch: true,
        space: false,
      })
    ).toEqual({
      gesture: {
        kind: "pinch",
        first: { id: 1, point: { x: 10, y: 10 } },
        second: { id: 2, point: { x: 10, y: 50 } },
        distance: 40,
        mid: { x: 10, y: 30 },
      },
    });
  });

  it("keeps a mouse pan a pan when another pointer presses", () => {
    const mousePan: Gesture = { ...touchPan, touch: false };
    expect(
      stepGesture(mousePan, { type: "down", pointerId: 2, point: { x: 0, y: 0 }, touch: true, space: false })
    ).toEqual({ gesture: mousePan });
  });

  it("ends on the pointer's lift, cancel or lost capture, and on no other pointer's", () => {
    expect(stepGesture(touchPan, { type: "up", pointerId: 1 })).toEqual({ gesture: IDLE });
    expect(stepGesture(touchPan, { type: "cancel", pointerId: 1 })).toEqual({ gesture: IDLE });
    expect(stepGesture(touchPan, { type: "cancel", pointerId: 2 })).toEqual({ gesture: touchPan });
  });

  it("ends a space pan when Space is released, and leaves other pans alone", () => {
    const spacePan: Gesture = { kind: "space-pan", pointerId: 7, anchor: { x: 3, y: 4 } };
    expect(stepGesture(spacePan, { type: "space-up" })).toEqual({ gesture: IDLE });
    expect(stepGesture(touchPan, { type: "space-up" })).toEqual({ gesture: touchPan });
  });
});

describe("stepGesture while pinching", () => {
  it("zooms about the old midpoint by the distance ratio, then pans by the midpoint's travel", () => {
    // The second finger moves from (100, 0) to (200, 0): 200 apart, midpoint (100, 0).
    // Factor 200 / 100 = 2 about (50, 0), then a pan of (100 - 50, 0 - 0) = (50, 0).
    expect(stepGesture(pinch, { type: "move", pointerId: 2, point: { x: 200, y: 0 } })).toEqual({
      gesture: {
        kind: "pinch",
        first: { id: 1, point: { x: 0, y: 0 } },
        second: { id: 2, point: { x: 200, y: 0 } },
        distance: 200,
        mid: { x: 100, y: 0 },
      },
      move: { delta: { x: 50, y: 0 }, zoom: { anchor: { x: 50, y: 0 }, factor: 2 } },
    });
  });

  it("hands over to a pan on the finger that stays when one lifts", () => {
    expect(stepGesture(pinch, { type: "up", pointerId: 1 })).toEqual({
      gesture: { kind: "pan", pointerId: 2, anchor: { x: 100, y: 0 }, touch: true },
    });
    expect(stepGesture(pinch, { type: "up", pointerId: 2 })).toEqual({
      gesture: { kind: "pan", pointerId: 1, anchor: { x: 0, y: 0 }, touch: true },
    });
  });

  it("resets when either finger is cancelled", () => {
    expect(stepGesture(pinch, { type: "cancel", pointerId: 2 })).toEqual({ gesture: IDLE });
  });

  it("ignores a third finger", () => {
    expect(
      stepGesture(pinch, { type: "down", pointerId: 3, point: { x: 5, y: 5 }, touch: true, space: false })
    ).toEqual({ gesture: pinch });
  });
});
