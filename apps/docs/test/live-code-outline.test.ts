import { describe, expect, it } from "vitest";

import { paddingBox, ringBox } from "../src/lib/live-code/outline";

// Units under test: `ringBox` and `paddingBox`. Oracle: boxes and reaches worked out by hand from
// the rects below, as a reader would see them: what of the element its clipping ancestors leave,
// how far a 4px ring may paint before an ancestor's edge cuts it, and where a scaled ancestor's
// padding box sits on screen.
const ORIGIN = { left: 5, top: 5 };

describe("Live code part outline geometry", () => {
  it("cuts an element by nested clippers, and stops the ring at the edge they leave", () => {
    // A list clipping both axes, whose inline edges at 20 and 80 bind, and inside it a wrapper
    // clipping only its block axis to 30–80. The element at (10, 70)–(90, 110) shows from
    // (20, 70) to (80, 80): the list cuts its sides and the wrapper its bottom, and the ring
    // reaches 4px only at the top, where 40px of room is left.
    const list = { box: { left: 20, top: 0, right: 80, bottom: 200 }, x: true, y: true };
    const wrapper = { box: { left: 0, top: 30, right: 100, bottom: 80 }, x: false, y: true };
    expect(ringBox({ left: 10, top: 70, right: 90, bottom: 110 }, [wrapper, list], ORIGIN, 4)).toEqual({
      left: 15,
      top: 65,
      width: 60,
      height: 10,
      reach: [4, 0, 0, 0],
    });
  });

  it("clips only on the axes a clipper clips, and lets the ring reach as far as the room left", () => {
    // A clipper on the inline axis only, from 8 to 60; its block edges are ignored.
    const sideways = { box: { left: 8, top: 100, right: 60, bottom: 110 }, x: true, y: false };
    expect(ringBox({ left: 10, top: 10, right: 70, bottom: 30 }, [sideways], ORIGIN, 4)).toEqual({
      left: 5,
      top: 5,
      width: 50,
      height: 20,
      reach: [4, 0, 4, 2],
    });
  });

  it("rings nothing of an element its clippers hide whole, or of an empty one", () => {
    const list = { box: { left: 0, top: 0, right: 100, bottom: 100 }, x: true, y: true };
    // An overscan row below the list.
    expect(ringBox({ left: 0, top: 100, right: 100, bottom: 132 }, [list], ORIGIN, 4)).toBeNull();
    expect(ringBox({ left: 10, top: 10, right: 10, bottom: 40 }, [], ORIGIN, 4)).toBeNull();
  });

  it("finds a scaled ancestor's padding box in viewport px", () => {
    // A list laid out 200×100 with 2px borders and an 8px scrollbar, so a 188×96 padding box
    // inside the scrollbar, scaled to 0.8: the viewport sees its border box 160×80 at (20, 10),
    // its borders 1.6px, and that padding box 150.4×76.8 from (21.6, 11.6).
    const metrics = {
      offsetWidth: 200,
      offsetHeight: 100,
      clientLeft: 2,
      clientTop: 2,
      clientWidth: 188,
      clientHeight: 96,
    };
    const box = paddingBox({ left: 20, top: 10, width: 160, height: 80 }, metrics);
    expect(box.left).toBeCloseTo(21.6, 6);
    expect(box.top).toBeCloseTo(11.6, 6);
    expect(box.right).toBeCloseTo(172, 6);
    expect(box.bottom).toBeCloseTo(88.4, 6);
  });
});
