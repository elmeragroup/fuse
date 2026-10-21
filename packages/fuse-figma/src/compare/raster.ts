/**
 * RGBA pictures and the pixel comparison. Both pictures of a cell go onto one canvas filled with
 * the preview's background before the diff, so a translucent fill such as `bg-error/10` is
 * compared as it looks on the page, and a pixel neither side draws matches.
 *
 * The diff runs pixelmatch twice. The raw count includes every pixel past the threshold. The
 * tolerant count leaves out the pixels pixelmatch takes for anti-aliasing, which is where text
 * and curved edges drawn by two renderers mostly differ.
 */

import { Result } from "effect";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

import type { CanvasPoint, PixelSize } from "./align.ts";

/** An RGBA picture, four bytes per pixel, rows top to bottom. */
export type Raster = {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
};

/** An opaque sRGB color, each channel from 0 to 255. */
export type Rgb = { readonly r: number; readonly g: number; readonly b: number };

/** What comparing two pictures of one size found. */
export type PixelDiff = {
  /** Pixels past the threshold, anti-aliasing included. */
  readonly raw: number;
  /** Pixels past the threshold that pixelmatch does not take for anti-aliasing. */
  readonly tolerant: number;
  /** The diff picture: differing pixels red, anti-aliasing yellow, over the faded Figma picture. */
  readonly diff: Raster;
};

/** pixelmatch's default: how far apart two colors may be before a pixel counts. */
export const DEFAULT_THRESHOLD = 0.1;

/** Bytes that should hold a PNG do not decode. */
class PngUnreadable extends Error {
  readonly _tag = "PngUnreadable" as const;
}

/**
 * Parse a PNG from outside the run, such as a snapshot's export.
 *
 * @param bytes - The encoded PNG.
 * @returns The picture, or `PngUnreadable`.
 */
export function parsePng(bytes: Uint8Array): Result.Result<Raster, PngUnreadable> {
  return Result.try({
    try: () => decodePng(bytes),
    catch: (error) => new PngUnreadable(`the PNG does not decode: ${String(error)}`),
  });
}

/**
 * Decode a PNG the run made itself, such as a browser screenshot.
 *
 * @param bytes - The encoded PNG.
 * @returns The picture.
 * @throws When the bytes are not a PNG, a defect in whatever produced them.
 */
export function decodePng(bytes: Uint8Array): Raster {
  const png = PNG.sync.read(Buffer.from(bytes));
  return { width: png.width, height: png.height, data: png.data };
}

/**
 * Encode a picture as a PNG.
 *
 * @param raster - The picture.
 * @returns The PNG's bytes.
 */
export function encodePng(raster: Raster): Uint8Array {
  const png = new PNG({ width: raster.width, height: raster.height });
  png.data = Buffer.from(raster.data);
  return PNG.sync.write(png);
}

/**
 * Lay pictures over a solid background, each at its origin, with source-over blending.
 *
 * @param size - The canvas size.
 * @param background - The canvas color.
 * @param layers - The pictures and where their top-left corners land. A pixel past the canvas
 *   edge is dropped.
 * @returns The opaque canvas.
 */
export function compose(
  size: PixelSize,
  background: Rgb,
  layers: readonly { readonly raster: Raster; readonly at: CanvasPoint }[]
): Raster {
  const data = new Uint8Array(size.width * size.height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = background.r;
    data[index + 1] = background.g;
    data[index + 2] = background.b;
    data[index + 3] = 255;
  }
  for (const { raster, at } of layers) {
    for (let y = 0; y < raster.height; y += 1) {
      const canvasY = y + at.y;
      if (canvasY < 0 || canvasY >= size.height) {
        continue;
      }
      for (let x = 0; x < raster.width; x += 1) {
        const canvasX = x + at.x;
        if (canvasX < 0 || canvasX >= size.width) {
          continue;
        }
        const from = (y * raster.width + x) * 4;
        const to = (canvasY * size.width + canvasX) * 4;
        const alpha = (raster.data[from + 3] ?? 0) / 255;
        for (let channel = 0; channel < 3; channel += 1) {
          const under = data[to + channel] ?? 0;
          const over = raster.data[from + channel] ?? 0;
          data[to + channel] = Math.round(over * alpha + under * (1 - alpha));
        }
      }
    }
  }
  return { width: size.width, height: size.height, data };
}

/**
 * Cut a rectangle out of a picture. The rectangle must lie inside the picture.
 *
 * @param raster - The picture.
 * @param at - The rectangle's top-left corner.
 * @param size - The rectangle's size.
 * @returns The cut picture.
 * @throws When the rectangle reaches outside the picture, a defect in the caller's geometry.
 */
export function crop(raster: Raster, at: CanvasPoint, size: PixelSize): Raster {
  if (at.x < 0 || at.y < 0 || at.x + size.width > raster.width || at.y + size.height > raster.height) {
    throw new Error(
      `crop ${size.width}×${size.height} at ${at.x},${at.y} reaches outside a ${raster.width}×${raster.height} picture`
    );
  }
  const data = new Uint8Array(size.width * size.height * 4);
  for (let y = 0; y < size.height; y += 1) {
    const from = ((y + at.y) * raster.width + at.x) * 4;
    data.set(raster.data.subarray(from, from + size.width * 4), y * size.width * 4);
  }
  return { width: size.width, height: size.height, data };
}

/**
 * Compare two pictures of one size.
 *
 * @param figma - The Figma side, composed on the shared canvas.
 * @param browser - The browser side, composed on the same canvas.
 * @param threshold - pixelmatch's threshold, 0 to 1; smaller is more sensitive.
 * @returns The raw and tolerant counts, and the diff picture.
 * @throws When the sizes differ, a defect in the caller's canvas.
 */
export function diffRasters(figma: Raster, browser: Raster, threshold: number): PixelDiff {
  if (figma.width !== browser.width || figma.height !== browser.height) {
    throw new Error(
      `cannot diff a ${figma.width}×${figma.height} picture with a ${browser.width}×${browser.height} one`
    );
  }
  const { width, height } = figma;
  const diff = new Uint8Array(width * height * 4);
  const raw = pixelmatch(figma.data, browser.data, undefined, width, height, { threshold, includeAA: true });
  const tolerant = pixelmatch(figma.data, browser.data, diff, width, height, { threshold, includeAA: false });
  return { raw, tolerant, diff: { width, height, data: diff } };
}
