/**
 * CSS hex color notation, read into and written from gamma-encoded sRGB.
 */

import { InvalidColor } from "./invalid-color.ts";
import { err, ok } from "./result-constructors.ts";
import { getOrThrow } from "./result.ts";
import type { Result } from "./result.ts";
import * as Srgb from "./srgb.ts";

export type { InvalidColor } from "./invalid-color.ts";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * Parse a six-digit CSS hex color, `#rrggbb` in either case, the form every hex token literal
 * uses. The color is opaque. The parser refuses the shorthand `#rgb` and `#rgba` forms and the
 * eight-digit `#rrggbbaa` form.
 *
 * @param input - The text to parse, without surrounding whitespace.
 * @returns The color, or `InvalidColor` when the input is not six-digit hex notation.
 */
export function parse(input: string): Result<Srgb.Srgb, InvalidColor> {
  if (!HEX_COLOR.test(input)) {
    return err(new InvalidColor("hex", input));
  }
  // A byte divided by 255 is in 0..1, so the channels always construct.
  const channels = {
    r: byte(input.slice(1, 3)),
    g: byte(input.slice(3, 5)),
    b: byte(input.slice(5, 7)),
    alpha: 1,
  };
  return ok(getOrThrow(Srgb.make(channels)));
}

function byte(pair: string): number {
  return Number.parseInt(pair, 16) / 255;
}

/**
 * Write a color's channels as uppercase `#RRGGBB`, the six-digit form that design-token formats
 * such as DTCG and Figma pair with a separate alpha. Each channel rounds to the nearest of 256
 * steps.
 *
 * @param color - A gamma-encoded sRGB color. Its alpha is not written, so carry it separately.
 * @returns The six-digit hex color.
 */
export function formatOpaque(color: Srgb.Srgb): string {
  const pair = (channel: number): string =>
    Math.round(channel * 255)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${pair(color.r)}${pair(color.g)}${pair(color.b)}`;
}
