/**
 * Readers for color token literals. Token modules write colors as `oklch()` or six-digit
 * `#rrggbb` hex. The theme pipeline's own math reads only `oklch()`, and contrast reads both.
 */

import * as CssColor from "@elmeragroup/color/css-color";
import type { InvalidColor } from "@elmeragroup/color/css-color";
import * as Hex from "@elmeragroup/color/hex";
import * as Oklch from "@elmeragroup/color/oklch";
import { getOrThrow } from "@elmeragroup/color/result";
import type { Result } from "@elmeragroup/color/result";
import type { Srgb } from "@elmeragroup/color/srgb";
import * as Wcag from "@elmeragroup/color/wcag";

/**
 * Reads a color token literal in either form token modules write, for exporters that report a
 * refused value with the token's name. It accepts no other notation, because composition would
 * refuse a value the exporter synced.
 *
 * @param literal - A color token's CSS value that is not a `var()` reference.
 * @returns The color, or the parser's `InvalidColor`. The reader parses a value starting with `#`
 *   as hex, and that value fails with the hex parser's message. Anything else fails with the
 *   `oklch()` parser's message.
 */
export function readTokenColor(literal: string): Result<Oklch.Oklch | Srgb, InvalidColor> {
  return literal.startsWith("#") ? Hex.parse(literal) : Oklch.parse(literal);
}

/**
 * Reads an `oklch()` token literal for the theme pipeline's color math. Token literals are source,
 * not input, so a literal the parser refuses is a defect in a token module.
 *
 * @param literal - A token value that a token module writes as an `oklch()` literal.
 * @returns The parsed color.
 * @throws The parser's `InvalidColor` when the literal is not `oklch()` notation.
 */
export function tokenOklch(literal: string): Oklch.Oklch {
  return getOrThrow(Oklch.parse(literal));
}

/**
 * The WCAG contrast ratio between two color token literals, each `oklch()` or `#rrggbb` hex. A
 * translucent foreground composites over the background. The background must be opaque, and every
 * surface the theme contract measures is opaque. A translucent surface would need an explicit
 * backdrop to composite against, so measuring one throws.
 *
 * @param foreground - The foreground's literal.
 * @param background - The background's literal, opaque.
 * @returns The ratio, from 1 to 21.
 * @throws The parser's `InvalidColor` for a literal in neither form, or the WCAG error for a
 *   translucent background.
 */
export function literalContrast(foreground: string, background: string): number {
  return getOrThrow(Wcag.contrastRatio(literalSrgb(foreground), literalSrgb(background)));
}

function literalSrgb(literal: string): Srgb {
  return CssColor.toSrgb(getOrThrow(readTokenColor(literal)));
}
