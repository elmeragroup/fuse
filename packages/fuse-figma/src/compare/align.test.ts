import { describe, expect, it } from "vitest";

import { browserFootprint, coversRenderBounds, figmaFootprint, sharedCanvas } from "./align";

const box = { x: 100.5, y: 40.25, width: 80, height: 32 };

describe("figmaFootprint", () => {
  it("starts the PNG where a 2px ring pushes the render bounds out, at 2x", () => {
    const ring = { x: 98.5, y: 38.25, width: 84, height: 36 };
    expect(figmaFootprint(box, ring, 2, { width: 168, height: 72 })).toEqual({
      x: -4,
      y: -4,
      width: 168,
      height: 72,
    });
  });

  it("starts the PNG at the box when nothing reaches outside it", () => {
    expect(figmaFootprint(box, box, 2, { width: 160, height: 64 })).toEqual({
      x: 0,
      y: 0,
      width: 160,
      height: 64,
    });
  });

  it("starts the PNG at the box's top when a shadow reaches only below it", () => {
    const shadow = { x: 100.5, y: 40.25, width: 80, height: 34 };
    expect(figmaFootprint(box, shadow, 2, { width: 160, height: 68 })).toEqual({
      x: 0,
      y: 0,
      width: 160,
      height: 68,
    });
  });
});

describe("browserFootprint", () => {
  it("starts the crop the padding before the box, in device pixels", () => {
    expect(browserFootprint(8, 2, { width: 178, height: 104 })).toEqual({
      x: -16,
      y: -16,
      width: 178,
      height: 104,
    });
  });
});

describe("sharedCanvas", () => {
  it("fits a ring export inside the browser crop's padding", () => {
    expect(
      sharedCanvas([
        { x: -4, y: -4, width: 168, height: 72 },
        { x: -16, y: -16, width: 178, height: 104 },
      ])
    ).toEqual({
      width: 180,
      height: 104,
      origins: [
        { x: 12, y: 12 },
        { x: 0, y: 0 },
      ],
    });
  });

  it("grows to hold an export that reaches past the padding", () => {
    expect(
      sharedCanvas([
        { x: -20, y: -2, width: 200, height: 40 },
        { x: -16, y: -16, width: 178, height: 104 },
      ])
    ).toEqual({
      width: 200,
      height: 104,
      origins: [
        { x: 0, y: 14 },
        { x: 4, y: 0 },
      ],
    });
  });
});

describe("coversRenderBounds", () => {
  const bounds = { x: 0, y: 0, width: 84.4, height: 36 };

  it("accepts a PNG that rounds a fractional edge", () => {
    expect(coversRenderBounds(bounds, 2, { width: 169, height: 72 })).toBe(true);
  });

  it("refuses a PNG two pixels off", () => {
    expect(coversRenderBounds(bounds, 2, { width: 171, height: 72 })).toBe(false);
    expect(coversRenderBounds(bounds, 2, { width: 169, height: 70 })).toBe(false);
  });
});
