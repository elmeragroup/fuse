/**
 * Readers for the CSS values a theme token holds, for exporters that translate tokens into
 * design-tool units. Each reader returns `undefined` when the value is not in its form, so a
 * caller can try the forms a token kind allows and report the value when none fits.
 */

import { oklchToSrgb } from "./contrast";
import type { SrgbColor } from "./contrast";
import { readOklch } from "./oklch";

const VAR_REFERENCE = /^var\(--([a-z0-9-]+)\)$/;
const HEX_COLOR = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const LENGTH = /^(-?[0-9]*\.?[0-9]+)(rem|px)$/;
const QUOTED = /^(["'])(.*)\1$/;

// CSS rem resolves against the 16px root font size the library assumes.
const ROOT_FONT_PX = 16;

/**
 * The custom property a `var(--name)` value refers to.
 *
 * @param value - A token's CSS value.
 * @returns The property name without its leading dashes, or `undefined` when the value is not a single `var()` reference.
 */
export function cssVarReference(value: string): string | undefined {
  return VAR_REFERENCE.exec(value)?.[1];
}

/**
 * Read an `oklch()` or `#rrggbb` color as gamma-encoded sRGB. A hex color is opaque.
 *
 * @param value - A token's CSS value.
 * @returns The color, or `undefined` when the value is neither a well-formed `oklch()` nor a six-digit hex color.
 */
export function cssColorToSrgb(value: string): SrgbColor | undefined {
  const oklch = readOklch(value);
  if (oklch !== undefined) {
    return oklchToSrgb(oklch);
  }
  const hex = HEX_COLOR.exec(value);
  if (hex === null) {
    return undefined;
  }
  const channel = (pair: string | undefined): number => Number.parseInt(pair ?? "", 16) / 255;
  return { r: channel(hex[1]), g: channel(hex[2]), b: channel(hex[3]), alpha: 1 };
}

/**
 * Read a `rem` or `px` length as pixels, with `rem` at the 16px root.
 *
 * @param value - A token's CSS value.
 * @returns The length in pixels, or `undefined` when the value is not a `rem` or `px` length.
 */
export function cssLengthToPx(value: string): number | undefined {
  const length = LENGTH.exec(value);
  if (length === null) {
    return undefined;
  }
  const amount = Number(length[1]);
  return length[2] === "rem" ? amount * ROOT_FONT_PX : amount;
}

/**
 * The first family of a CSS font stack, without its quotes. Design tools bind one family, so
 * the first one is the designed choice and the rest are fallbacks.
 *
 * @param value - A token's CSS value, such as `"Neo Sans", Roboto, sans-serif`.
 * @returns The family name, or `undefined` when the stack does not start with a named family.
 */
export function cssFirstFontFamily(value: string): string | undefined {
  const [first = ""] = value.split(",");
  const family = first.trim().replace(QUOTED, "$2");
  return family === "" || family.startsWith("var(") ? undefined : family;
}
