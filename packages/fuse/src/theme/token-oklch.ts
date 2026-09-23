import * as Oklch from "@elmeragroup/color/oklch";
import { getOrThrow } from "@elmeragroup/color/result";

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
