/**
 * Pixel reads from a browser screenshot, and the check of a read pixel against a theme token's
 * color. A screenshot shows the painted result after stacking and clipping, which computed styles
 * do not report.
 */
import { expect } from "vitest";
import { page } from "vitest/browser";

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
 */
export async function pixelsAt(element: Element, at: readonly Point[]): Promise<number[][]> {
  const base64 = await page.screenshot({ element, base64: true, save: false, scale: "css" });
  const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("expected a 2d context");
  context.drawImage(bitmap, 0, 0);
  return at.map(([column, row]) => [...context.getImageData(column, row, 1, 1).data]);
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
