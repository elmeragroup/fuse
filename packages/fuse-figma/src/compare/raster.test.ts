import { describe, expect, it } from "vitest";

import { compose, crop, decodePng, diffRasters, encodePng } from "./raster";
import type { Raster } from "./raster";

const WHITE = { r: 255, g: 255, b: 255 };

/** A picture filled with one RGBA color. */
function solid(width: number, height: number, rgba: readonly number[]): Raster {
  const data = new Uint8Array(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data.set(rgba, index);
  }
  return { width, height, data };
}

function pixel(raster: Raster, x: number, y: number): number[] {
  const from = (y * raster.width + x) * 4;
  return [...raster.data.subarray(from, from + 4)];
}

describe("compose", () => {
  it("fills the canvas with the background and blends a translucent pixel over it", () => {
    const halfRed = solid(1, 1, [255, 0, 0, 128]);
    const canvas = compose({ width: 2, height: 1 }, WHITE, [{ raster: halfRed, at: { x: 1, y: 0 } }]);
    expect(pixel(canvas, 0, 0)).toEqual([255, 255, 255, 255]);
    // 128/255 of red over white: 255 · 0.502 + 255 · 0.498 = 255, and 0 · 0.502 + 255 · 0.498 = 127.
    expect(pixel(canvas, 1, 0)).toEqual([255, 127, 127, 255]);
  });

  it("drops the pixels of a layer that fall off the canvas", () => {
    const black = solid(2, 2, [0, 0, 0, 255]);
    const canvas = compose({ width: 2, height: 2 }, WHITE, [{ raster: black, at: { x: -1, y: -1 } }]);
    expect(pixel(canvas, 0, 0)).toEqual([0, 0, 0, 255]);
    expect(pixel(canvas, 1, 0)).toEqual([255, 255, 255, 255]);
    expect(pixel(canvas, 0, 1)).toEqual([255, 255, 255, 255]);
    expect(pixel(canvas, 1, 1)).toEqual([255, 255, 255, 255]);
  });
});

describe("crop", () => {
  it("cuts the rectangle out row by row", () => {
    const source: Raster = {
      width: 3,
      height: 2,
      data: Uint8Array.from({ length: 24 }, (_, index) => index),
    };
    expect([...crop(source, { x: 1, y: 1 }, { width: 2, height: 1 }).data]).toEqual([
      16, 17, 18, 19, 20, 21, 22, 23,
    ]);
  });

  it("refuses a rectangle that reaches outside the picture", () => {
    expect(() => crop(solid(2, 2, [0, 0, 0, 255]), { x: 1, y: 0 }, { width: 2, height: 1 })).toThrow(
      /outside/
    );
  });
});

describe("PNG round trip", () => {
  it("decodes what it encodes", () => {
    const source = solid(3, 2, [12, 34, 56, 78]);
    const decoded = decodePng(encodePng(source));
    expect(decoded.width).toBe(3);
    expect(decoded.height).toBe(2);
    expect([...decoded.data]).toEqual([...source.data]);
  });
});

describe("diffRasters", () => {
  it("finds nothing between two equal pictures", () => {
    const picture = solid(10, 10, [40, 80, 120, 255]);
    const { raw, tolerant, diff } = diffRasters(picture, solid(10, 10, [40, 80, 120, 255]), 0.1);
    expect([raw, tolerant]).toEqual([0, 0]);
    expect([diff.width, diff.height]).toEqual([10, 10]);
  });

  it("counts every pixel of a solid block in both counts, since a block is not anti-aliasing", () => {
    const before = solid(10, 10, [255, 255, 255, 255]);
    const after = solid(10, 10, [255, 255, 255, 255]);
    for (let y = 3; y < 7; y += 1) {
      for (let x = 3; x < 7; x += 1) {
        after.data.set([0, 0, 0, 255], (y * 10 + x) * 4);
      }
    }
    const { raw, tolerant } = diffRasters(before, after, 0.1);
    expect([raw, tolerant]).toEqual([16, 16]);
  });

  it("refuses pictures of two sizes", () => {
    expect(() => diffRasters(solid(2, 2, [0, 0, 0, 255]), solid(2, 3, [0, 0, 0, 255]), 0.1)).toThrow(/diff/);
  });
});
