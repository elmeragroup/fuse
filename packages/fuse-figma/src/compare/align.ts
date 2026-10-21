/**
 * Where the Figma PNG and the browser screenshot of one cell sit relative to each other. Both
 * pictures hold the same box: the Figma PNG covers the instance's render bounds, and the browser
 * screenshot covers the measured element's border box plus a fixed padding. The comparison aligns the two
 * boxes' top-left corners and puts both pictures on one canvas that holds them both.
 *
 * Every footprint is in device pixels, relative to the box's top-left corner, so a picture that
 * reaches past the box's left or top edge has a negative `x` or `y`.
 */

import type { CanvasRect } from "./snapshot.ts";

/** A picture's place and size relative to the box's top-left corner, in device pixels. */
export type Footprint = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/** A picture's size in pixels. */
export type PixelSize = { readonly width: number; readonly height: number };

/** A point on the shared canvas, in device pixels from its top-left corner. */
export type CanvasPoint = { readonly x: number; readonly y: number };

/** A canvas both pictures fit on, and where each picture's top-left corner lands. */
export type SharedCanvas = {
  readonly width: number;
  readonly height: number;
  /** One point per footprint, in the order given. */
  readonly origins: readonly CanvasPoint[];
};

/**
 * The Figma PNG's footprint. It starts where the render bounds start, which is left of and above
 * the box when an effect such as a focus ring reaches outside it. The offset rounds to the
 * nearest device pixel.
 *
 * @param box - The instance's `absoluteBoundingBox`.
 * @param renderBounds - The instance's `absoluteRenderBounds`, which the PNG covers.
 * @param scale - Device pixels per canvas pixel.
 * @param png - The PNG's size.
 * @returns The PNG's footprint relative to the box.
 */
export function figmaFootprint(
  box: CanvasRect,
  renderBounds: CanvasRect,
  scale: number,
  png: PixelSize
): Footprint {
  return {
    x: Math.round((renderBounds.x - box.x) * scale),
    y: Math.round((renderBounds.y - box.y) * scale),
    width: png.width,
    height: png.height,
  };
}

/**
 * The browser screenshot's footprint. The page crops each cell at `padding` CSS pixels outside
 * the measured element's border box.
 *
 * @param padding - The crop's margin around the box, in CSS pixels.
 * @param scale - The device scale factor.
 * @param png - The screenshot's size.
 * @returns The screenshot's footprint relative to the box.
 */
export function browserFootprint(padding: number, scale: number, png: PixelSize): Footprint {
  return { x: -padding * scale, y: -padding * scale, width: png.width, height: png.height };
}

/**
 * The smallest canvas that holds every footprint, so neither picture is cut.
 *
 * @param footprints - The pictures' footprints, relative to one box.
 * @returns The canvas size and each footprint's top-left corner on it.
 */
export function sharedCanvas(footprints: readonly Footprint[]): SharedCanvas {
  const left = Math.min(...footprints.map((footprint) => footprint.x));
  const top = Math.min(...footprints.map((footprint) => footprint.y));
  const right = Math.max(...footprints.map((footprint) => footprint.x + footprint.width));
  const bottom = Math.max(...footprints.map((footprint) => footprint.y + footprint.height));
  return {
    width: right - left,
    height: bottom - top,
    origins: footprints.map((footprint) => ({ x: footprint.x - left, y: footprint.y - top })),
  };
}

/**
 * Whether a PNG has the size its render bounds promise at the scale, give or take the pixel
 * that rounding a fractional edge adds.
 *
 * @param renderBounds - The rectangle the PNG covers, in canvas pixels.
 * @param scale - Device pixels per canvas pixel.
 * @param png - The PNG's size.
 * @returns False when either side is off by more than one pixel.
 */
export function coversRenderBounds(renderBounds: CanvasRect, scale: number, png: PixelSize): boolean {
  return (
    Math.abs(png.width - renderBounds.width * scale) <= 1 &&
    Math.abs(png.height - renderBounds.height * scale) <= 1
  );
}
