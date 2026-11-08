/**
 * The CSS color notations the workspace reads, behind one parser. Theme tokens are `oklch()`
 * or hex literals, and Chromium serializes a computed color as `rgb()`, or in the space it was
 * declared or mixed in: `oklch()`, `lab()`, or `oklab()` for every `color-mix(in oklab, …)`
 * such as Tailwind's `/NN` opacity modifier. A caller that takes any of them parses here and
 * converts to sRGB.
 */

import * as Hex from "./hex.ts";
import { InvalidColor } from "./invalid-color.ts";
import * as Lab from "./lab.ts";
import * as Oklab from "./oklab.ts";
import * as Oklch from "./oklch.ts";
import { err } from "./result-constructors.ts";
import type { Result } from "./result.ts";
import * as Srgb from "./srgb.ts";

export type { InvalidColor } from "./invalid-color.ts";
export type { Lab, LabComponents } from "./lab.ts";
export type { Oklab, OklabComponents } from "./oklab.ts";

/** A parsed CSS color, in the space its notation writes. Hex and `rgb()` are both sRGB. */
export type CssColor = Lab.Lab | Oklab.Oklab | Oklch.Oklch | Srgb.Srgb;

/**
 * Parse an `oklch()`, `oklab()`, `lab()`, `rgb()`, `rgba()` or hex color. The leading characters choose
 * the notation, so a malformed color fails with that notation's error rather than a generic
 * one. The parser refuses named colors such as `white` and other color functions.
 *
 * @param input - The text to parse, without surrounding whitespace.
 * @returns The color, or `InvalidColor` when the input is none of those notations.
 */
export function parse(input: string): Result<CssColor, InvalidColor> {
  const prefix = input.slice(0, 6).toLowerCase();
  if (prefix.startsWith("#")) {
    return Hex.parse(input);
  }
  if (prefix === "oklch(") {
    return Oklch.parse(input);
  }
  if (prefix === "oklab(") {
    return Oklab.parse(input);
  }
  if (prefix.startsWith("lab(")) {
    return Lab.parse(input);
  }
  if (prefix.startsWith("rgb(") || prefix.startsWith("rgba(")) {
    return Srgb.parse(input);
  }
  return err(new InvalidColor("css-color", input));
}

/**
 * Convert a parsed color to gamma-encoded sRGB, clipping a color outside the gamut.
 *
 * @param color - A color from {@link parse}.
 * @returns The sRGB color, with the same alpha.
 */
export function toSrgb(color: CssColor): Srgb.Srgb {
  switch (color._tag) {
    case "Lab":
      return Lab.toSrgb(color);
    case "Oklab":
      return Oklab.toSrgb(color);
    case "Oklch":
      return Oklch.toSrgb(color);
    case "Srgb":
      return color;
  }
}
