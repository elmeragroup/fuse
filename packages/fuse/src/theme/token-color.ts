/**
 * Readers for color token literals. Token modules write colors as `oklch()` or six-digit
 * `#rrggbb` hex, and the theme pipeline's own math reads only `oklch()`.
 */

import type { InvalidColor } from "@elmeragroup/color/css-color";
import * as Hex from "@elmeragroup/color/hex";
import * as Oklch from "@elmeragroup/color/oklch";
import { getOrThrow } from "@elmeragroup/color/result";
import type { Result } from "@elmeragroup/color/result";
import type { Srgb } from "@elmeragroup/color/srgb";
import * as Wcag from "@elmeragroup/color/wcag";

/**
 * Read a color token literal in either form token modules write, for exporters that report a
 * refused value with the token's name. It accepts no other notation, because composition
 * would refuse a value the exporter synced.
 *
 * @param literal - A color token's CSS value that is not a `var()` reference.
 * @returns The color, or the parser's `InvalidColor`. A value starting with `#` is read as hex
 *   and fails with the hex parser's message; anything else fails with the `oklch()` parser's.
 */
export function readTokenColor(literal: string): Result<Oklch.Oklch | Srgb, InvalidColor> {
  return literal.startsWith("#") ? Hex.parse(literal) : Oklch.parse(literal);
}

/**
 * Read an `oklch()` token literal for the theme pipeline's color math. Token literals are
 * source, not input, so a literal the parser refuses is a defect in a token module.
 *
 * @param literal - A token value that a token module writes as an `oklch()` literal.
 * @returns The parsed color.
 * @throws The parser's `InvalidColor` when the literal is not `oklch()` notation.
 */
export function tokenOklch(literal: string): Oklch.Oklch {
  return getOrThrow(Oklch.parse(literal));
}

/**
 * The WCAG contrast ratio between two `oklch()` token literals. A translucent foreground
 * composites over the background; the background must be opaque, which every surface the theme
 * contract measures is. A translucent surface would need an explicit backdrop to composite
 * against, so measuring one throws.
 *
 * @param foreground - The foreground's `oklch()` literal.
 * @param background - The background's `oklch()` literal, opaque.
 * @returns The ratio, from 1 to 21.
 * @throws The parser's `InvalidColor` for a literal that is not `oklch()`, or the WCAG error for a
 *   translucent background.
 */
export function literalContrast(foreground: string, background: string): number {
  return getOrThrow(
    Wcag.contrastRatio(Oklch.toSrgb(tokenOklch(foreground)), Oklch.toSrgb(tokenOklch(background)))
  );
}
