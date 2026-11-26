/**
 * Pixel reads from a browser screenshot, the WCAG contrast of read pixels, the check of a read
 * pixel against a theme token's color, and the check of a region against the forced-colors
 * canvas. A screenshot shows the painted result after stacking and clipping, which computed
 * styles do not report.
 */
import { expect } from "vitest";
import { page } from "vitest/browser";

import { getOrThrow } from "@elmeragroup/color/result";
import * as Srgb from "@elmeragroup/color/srgb";
import * as Wcag from "@elmeragroup/color/wcag";

import { toSrgb } from "./surface-paint";
import { cssVarColor } from "./themed-browser-render";

/** A point in an element's screenshot, as a column and a row in CSS pixels from its top left corner. */
export type Point = readonly [column: number, row: number];

/**
 * The colors of one screenshot of an element at several points, in CSS pixels.
 *
 * @param element - The element to shoot.
 * @param at - The points to read.
 * @returns Each point's RGBA channels, 0 to 255.
 * @throws When a point leaves the screenshot.
 */
export async function pixelsAt(element: Element, at: readonly Point[]): Promise<number[][]> {
  const image = await screenshotOf(element);
  return at.map(([x, y]) => {
    // A fractional point reads the pixel it falls in, as `getImageData` truncates.
    const column = Math.trunc(x);
    const row = Math.trunc(y);
    if (column < 0 || row < 0 || column >= image.width || row >= image.height) {
      throw new Error(`the point (${String(column)}, ${String(row)}) leaves the screenshot`);
    }
    const index = (row * image.width + column) * 4;
    return [...image.data.subarray(index, index + 4)];
  });
}

/**
 * One screenshot of an element, in CSS pixels. It covers the whole pixels the element's border
 * box touches, so a box from x = 0.5 to 8.5 gives columns 0 to 8.
 *
 * @param element - The element to shoot.
 * @returns The screenshot's RGBA pixels, row by row.
 */
export async function screenshotOf(element: Element): Promise<ImageData> {
  const base64 = await page.screenshot({ element, base64: true, save: false, scale: "css" });
  const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("expected a 2d context");
  context.drawImage(bitmap, 0, 0);
  return context.getImageData(0, 0, bitmap.width, bitmap.height);
}

/**
 * The color of one pixel of a screenshot.
 *
 * @param shot - A screenshot, as `screenshotOf` returns it.
 * @param point - The pixel's column and row.
 * @returns Its RGB channels, 0 to 255.
 */
export function rgbAt(shot: ImageData, [column, row]: Point): number[] {
  const index = (row * shot.width + column) * 4;
  return [...shot.data.subarray(index, index + 3)];
}

/**
 * Finishes the animations that have an end. An infinite animation, such as a skeleton's pulse,
 * has none, and `finish()` throws on it, so it runs on.
 */
function finishFinite(animations: readonly Animation[]): void {
  for (const animation of animations) {
    if (Number.isFinite(animation.effect?.getComputedTiming().endTime)) animation.finish();
  }
}

/**
 * Finishes the transitions and animations on the elements and inside them, so a screenshot shows
 * their end state. An infinite animation runs on.
 *
 * @param elements - The elements to finish the animations on and inside.
 * @param options - With `ancestors`, it first finishes the animations on each element's ancestors
 * too, such as a popup's entry around a part inside it.
 */
export function finishAnimations(
  elements: readonly Element[],
  { ancestors = false }: { readonly ancestors?: boolean } = {}
): void {
  for (const element of elements) {
    if (ancestors) {
      for (let node = element.parentElement; node !== null; node = node.parentElement) {
        finishFinite(node.getAnimations());
      }
    }
    finishFinite(element.getAnimations({ subtree: true }));
  }
}

/**
 * The colors of one screenshot of an element at one column and several rows, in CSS pixels.
 *
 * @param element - The element to shoot.
 * @param column - The column, in CSS pixels from its left edge.
 * @param at - The rows, in CSS pixels from its top edge.
 * @returns Each row's RGBA channels, 0 to 255.
 */
export async function rows(element: Element, column: number, at: readonly number[]): Promise<number[][]> {
  return pixelsAt(
    element,
    at.map((row) => [column, row] as const)
  );
}

/**
 * The square at the center of an element's box, a region a centered mark fills whatever its edges
 * and size.
 *
 * @param element - The element, such as a dot.
 * @param size - The square's side, in CSS pixels.
 * @returns The square, in CSS pixels from the viewport's top left corner.
 */
export function middleOf(element: Element, size: number): DOMRect {
  const { x, y, width, height } = element.getBoundingClientRect();
  return new DOMRect(x + (width - size) / 2, y + (height - size) / 2, size, size);
}

/**
 * Whether each region of one screenshot of an element shows a pixel in a color other than
 * `Canvas`. Forced-colors mode gives most backgrounds that system color, so a mark drawn only by
 * a background fill shows nothing there unless a forced-colors rule gives it another color.
 *
 * @param element - The element to shoot, which holds every region.
 * @param regions - Boxes in CSS pixels from the viewport's top left corner, as
 * `getBoundingClientRect` reports them.
 * @returns One answer per region, in order.
 * @throws When a region is empty or leaves the element's box, where every answer would read alike.
 */
export async function differsFromCanvas(
  element: Element,
  regions: readonly DOMRectReadOnly[]
): Promise<boolean[]> {
  const box = element.getBoundingClientRect();
  const probe = document.createElement("span");
  probe.style.backgroundColor = "Canvas";
  element.append(probe);
  const { r, g, b, alpha } = toSrgb(getComputedStyle(probe).backgroundColor);
  probe.remove();
  const canvas = [r, g, b, alpha].map((value) => value * 255);
  // The screenshot covers the whole pixels the box touches: a host from x = 0.5 to 8.5 gives
  // columns 0 to 8, 9 wide. A region maps to the pixels it touches the same way. Subtracting the
  // fractional box edge before rounding would read the pixel before the region.
  const origin = { x: Math.floor(box.left), y: Math.floor(box.top) };
  const size = { width: Math.ceil(box.right) - origin.x, height: Math.ceil(box.bottom) - origin.y };
  const points = regions.map((region) => {
    const left = Math.floor(region.left) - origin.x;
    const top = Math.floor(region.top) - origin.y;
    const right = Math.ceil(region.right) - origin.x;
    const bottom = Math.ceil(region.bottom) - origin.y;
    if (left < 0 || top < 0 || right > size.width || bottom > size.height) {
      throw new Error(`the region at (${String(region.x)}, ${String(region.y)}) leaves the element's box`);
    }
    if (right <= left || bottom <= top) throw new Error("expected a region at least one pixel wide and tall");
    return Array.from({ length: right - left }, (_, column) =>
      Array.from({ length: bottom - top }, (_, row): Point => [left + column, top + row])
    ).flat();
  });
  const pixels = await pixelsAt(element, points.flat());
  return points.map(({ length }) =>
    pixels
      .splice(0, length)
      .some((pixel) => canvas.some((value, channel) => Math.abs((pixel[channel] ?? Number.NaN) - value) > 1))
  );
}

/** An opaque screenshot pixel, RGBA from 0 to 255, as an sRGB color. */
function pixelColor(pixel: readonly number[]): Srgb.Srgb {
  const [r = 0, g = 0, b = 0] = pixel;
  return getOrThrow(Srgb.make({ r: r / 255, g: g / 255, b: b / 255, alpha: 1 }));
}

/**
 * The WCAG contrast of two screenshot pixels.
 *
 * @param a - A pixel, RGBA from 0 to 255.
 * @param b - Another pixel, RGBA from 0 to 255.
 * @returns The ratio, from 1 to 21.
 */
export function pixelContrast(a: readonly number[], b: readonly number[]): number {
  return getOrThrow(Wcag.contrastRatio(pixelColor(a), pixelColor(b)));
}

/**
 * The highest WCAG contrast between a pixel of an element's screenshot and a ground pixel, which
 * for an icon is the contrast of its strokes against what it is drawn on.
 *
 * @param element - The element to shoot, such as an icon.
 * @param ground - The pixel it is drawn on, RGBA from 0 to 255.
 * @returns The ratio, from 1 to 21.
 */
export async function inkContrast(element: Element, ground: readonly number[]): Promise<number> {
  finishAnimations([element]);
  const shot = await screenshotOf(element);
  let highest = 1;
  for (let index = 0; index < shot.data.length; index += 4) {
    highest = Math.max(highest, pixelContrast([...shot.data.subarray(index, index + 3)], ground));
  }
  return highest;
}

/**
 * The WCAG contrast between the lightest and the darkest pixel inside the box of an element's
 * text, inset by 1px, in one screenshot of the element. It measures the glyphs against whatever
 * paints behind them, such as a forced-colors backplate, which computed styles do not report: a
 * box of one color, where no glyph shows, reads 1.
 *
 * @param element - The element whose text to read.
 * @returns The ratio, from 1 to 21.
 * @throws When the element's text box is under 3px on a side, too small to inset.
 */
export async function glyphInkContrast(element: Element): Promise<number> {
  const range = document.createRange();
  range.selectNodeContents(element);
  const text = range.getBoundingClientRect();
  if (text.width < 3 || text.height < 3) throw new Error("expected a text box at least 3px on each side");
  const box = element.getBoundingClientRect();
  const left = Math.ceil(text.left - Math.floor(box.left)) + 1;
  const top = Math.ceil(text.top - Math.floor(box.top)) + 1;
  const right = Math.floor(text.right - Math.floor(box.left)) - 1;
  const bottom = Math.floor(text.bottom - Math.floor(box.top)) - 1;
  const points = Array.from({ length: right - left }, (_, column) =>
    Array.from({ length: bottom - top }, (_, row): Point => [left + column, top + row])
  ).flat();
  const colors = (await pixelsAt(element, points)).map(pixelColor);
  const byLuminance = colors.toSorted((a, b) => Wcag.relativeLuminance(a) - Wcag.relativeLuminance(b));
  const [darkest] = byLuminance;
  const lightest = byLuminance.at(-1);
  if (darkest === undefined || lightest === undefined) throw new Error("expected pixels in the text box");
  return getOrThrow(Wcag.contrastRatio(darkest, lightest));
}

/**
 * Checks that a read pixel shows a theme token's color, each channel within 1 of the token's sRGB
 * value on the 0 to 255 scale, which allows for 8-bit rounding.
 *
 * @param pixel - The RGBA channels `pixelsAt` or `rows` read.
 * @param host - An element under a `ThemeScope`, where the token resolves.
 * @param token - The custom property, such as `--ring`.
 * @param label - What the pixel shows, for the failure message.
 */
export function expectTokenColor(
  pixel: readonly number[],
  host: HTMLElement,
  token: string,
  label: string
): void {
  const { r, g, b, alpha } = toSrgb(cssVarColor(host, token));
  for (const [channel, value] of [r, g, b, alpha].entries()) {
    expect(Math.abs((pixel[channel] ?? Number.NaN) - value * 255), `${label} ${token}`).toBeLessThanOrEqual(
      1
    );
  }
}
