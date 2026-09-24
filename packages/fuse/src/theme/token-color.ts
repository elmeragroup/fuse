import type { InvalidColor } from "@elmeragroup/color/css-color";
import * as Hex from "@elmeragroup/color/hex";
import * as Oklch from "@elmeragroup/color/oklch";
import type { Result } from "@elmeragroup/color/result";
import type { Srgb } from "@elmeragroup/color/srgb";

/**
 * Read a color token literal in the two forms token modules write: `oklch()` or six-digit
 * `#rrggbb` hex. The theme pipeline's own math reads only `oklch()` (see `tokenOklch`), so an
 * exporter that accepted any other notation would sync a value that composition then refuses.
 * `tokenOklch` throws, because its callers read only token source; this returns the failure,
 * because the exporters report it with the token's name.
 *
 * @param literal - A color token's CSS value that is not a `var()` reference.
 * @returns The color, or the parser's `InvalidColor`. A value starting with `#` is read as hex
 *   and fails with the hex parser's message; anything else fails with the `oklch()` parser's.
 */
export function readTokenColor(literal: string): Result<Oklch.Oklch | Srgb, InvalidColor> {
  return literal.startsWith("#") ? Hex.parse(literal) : Oklch.parse(literal);
}
