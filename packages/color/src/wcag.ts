/**
 * WCAG 2.2 relative luminance and contrast between two sRGB colors, the measure the theme's
 * text-grade gate and the success criteria for text (1.4.3, 1.4.6) and non-text contrast
 * (1.4.11) use.
 */

import { err, ok } from "./result-constructors.ts";
import type { Result } from "./result.ts";
import * as Srgb from "./srgb.ts";

/**
 * A background with alpha below 1. Contrast needs the color the reader sees, and a
 * translucent background shows whatever lies beneath it, so composite it over its backdrop
 * with `compositeOver` first.
 */
export class TranslucentBackground extends Error {
  /** The tag Effect's `catchTag` and a `switch` match on. */
  readonly _tag = "TranslucentBackground" as const;

  /** The background's alpha. */
  readonly alpha: number;

  /**
   * Build the error for a background that is not opaque.
   *
   * @param alpha - The background's alpha, below 1.
   */
  constructor(alpha: number) {
    super(`Contrast needs an opaque background, received alpha ${alpha}`);
    this.name = "TranslucentBackground";
    this.alpha = alpha;
  }
}

/**
 * The WCAG 2.2 relative luminance of a color: its linear-light channels weighted by the sRGB
 * primaries' share of luminance, from 0 for black to 1 for white. It equals CIE Y under the
 * D65 white point.
 *
 * @param color - A gamma-encoded sRGB color. Its alpha does not enter, so composite a
 *   translucent color over its backdrop with `compositeOver` first.
 * @returns The relative luminance in `0..1`.
 */
export function relativeLuminance(color: Srgb.Srgb): number {
  const linear = Srgb.toLinear(color);
  return 0.2126 * linear.r + 0.7152 * linear.g + 0.0722 * linear.b;
}

/**
 * The WCAG 2.2 contrast ratio of a foreground over an opaque background, from 1 to 21. A
 * translucent foreground composites over the background in sRGB first, as the browser paints
 * it. The ratio is symmetric in the two colors once both are opaque.
 *
 * @param foreground - The text or glyph color, of any alpha.
 * @param background - The surface color, which must be opaque.
 * @returns The ratio, or `TranslucentBackground` when the background has alpha below 1.
 */
export function contrastRatio(
  foreground: Srgb.Srgb,
  background: Srgb.Srgb
): Result<number, TranslucentBackground> {
  if (background.alpha < 1) {
    return err(new TranslucentBackground(background.alpha));
  }
  const seen = relativeLuminance(Srgb.compositeOver(foreground, background));
  const surface = relativeLuminance(background);
  return ok((Math.max(seen, surface) + 0.05) / (Math.min(seen, surface) + 0.05));
}
