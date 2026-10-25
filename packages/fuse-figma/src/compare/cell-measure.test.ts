// Unit under test: `measuredBox` and `cellClip`, the box the page compares and the crop it takes
// around it. Oracle: the hand-computed rectangles below. The union of two rectangles spans from the
// smaller left and top edges to the larger right and bottom edges. The crop keeps the layout's
// padding on every side, starts on a whole CSS pixel and so on a device pixel at scale 2, and is no
// larger than a slot. A client cell's crop must also stay inside its own slot, which `slotRect`
// places from the page's grid, since its popup lays out wherever Base UI places it.
import { describe, expect, it } from "vitest";

import { cellClip, clipInsideSlot, measuredBox } from "./cell-measure";
import { PAGE_LAYOUT, slotRect } from "./preview-page";

describe("measuredBox", () => {
  it("is the one element's box for a cell that measures one element", () => {
    expect(measuredBox([{ x: 8, y: 24, width: 120, height: 36 }])).toEqual({
      x: 8,
      y: 24,
      width: 120,
      height: 36,
    });
  });

  it("is the union of the trigger and the popup for an open composite", () => {
    const trigger = { x: 8, y: 24, width: 96, height: 36 };
    const popup = { x: 8, y: 64, width: 288, height: 120 };
    expect(measuredBox([trigger, popup])).toEqual({ x: 8, y: 24, width: 288, height: 160 });
  });

  it("spans a popup that sits left of and above its trigger", () => {
    const trigger = { x: 40, y: 200, width: 20, height: 20 };
    const popup = { x: 10, y: 100, width: 100, height: 96 };
    expect(measuredBox([trigger, popup])).toEqual({ x: 10, y: 100, width: 100, height: 120 });
  });
});

describe("slotRect", () => {
  it("places a cell's slot on the page's grid, below the probe row", () => {
    expect(slotRect(PAGE_LAYOUT, 0)).toEqual({ x: 0, y: 16, width: 528, height: 400 });
    expect(slotRect(PAGE_LAYOUT, 7)).toEqual({ x: 528, y: 416, width: 528, height: 400 });
  });
});

describe("cellClip", () => {
  const slot = { x: 528, y: 352, width: 528, height: 336 };

  it("crops the box with the padding on every side, rounding a fractional size up", () => {
    expect(cellClip("c7", slot, { x: 536, y: 360, width: 110.546875, height: 36 }, 8)).toEqual({
      x: 528,
      y: 352,
      width: 127,
      height: 52,
    });
  });

  it("refuses a box off the pixel grid", () => {
    expect(() => cellClip("c7", slot, { x: 536.5, y: 360, width: 20, height: 20 }, 8)).toThrow(
      "the page placed cell c7 at 536.5,360, off the pixel grid"
    );
  });

  it("refuses a box whose crop is larger than a slot", () => {
    expect(() => cellClip("c7", slot, { x: 536, y: 360, width: 513, height: 20 }, 8)).toThrow(
      "cell c7 is 513×20, larger than its slot"
    );
  });
});

describe("clipInsideSlot", () => {
  const slot = { x: 528, y: 352, width: 528, height: 336 };

  it("accepts a crop inside the slot, up to its edges", () => {
    expect(() => clipInsideSlot("c7", slot, { x: 528, y: 352, width: 528, height: 336 })).not.toThrow();
  });

  it("refuses a crop that reaches past the slot, as a popup below the slot's last row would", () => {
    expect(() => clipInsideSlot("c7", slot, { x: 528, y: 592, width: 304, height: 106 })).toThrow(
      "cell c7 crops 528,592 304×106, past its slot at 528,352 528×336"
    );
    expect(() => clipInsideSlot("c7", slot, { x: 522, y: 352, width: 36, height: 36 })).toThrow(
      "past its slot"
    );
  });
});
