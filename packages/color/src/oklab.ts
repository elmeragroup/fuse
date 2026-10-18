/**
 * Björn Ottosson's OKLab, and ΔE as the Euclidean distance between two OKLab colors times 100,
 * the distance the chart palette gates measure.
 */

import { clampToUnitInterval } from "./component-range.ts";
import { apply, LINEAR_SRGB_TO_LMS, LMS_TO_OKLAB } from "./matrix3.ts";
import * as Srgb from "./srgb.ts";

/**
 * An OKLab color. Lightness is in `0..1` for every sRGB color, and the `a` and `b` axes run
 * green to red and blue to yellow. Only {@link fromSrgb} constructs one. The private brand
 * field keeps a spread copy from type-checking as an `Oklab`.
 */
class Oklab {
  /** The tag a `switch` over a color union matches on. */
  readonly _tag = "Oklab" as const;

  /** Perceptual lightness, in `0..1` for an sRGB color. */
  readonly l: number;

  /** The green to red axis. */
  readonly a: number;

  /** The blue to yellow axis. */
  readonly b: number;

  /** Alpha, in `0..1`. */
  readonly alpha: number;

  // The brand's value is never read, so flipping it is an equivalent mutant.
  // Stryker disable next-line BooleanLiteral
  // oxlint-disable-next-line no-unused-private-class-members -- The field is the brand. No code reads it, but a spread cannot copy it, so only this class's instances have it.
  readonly #brand = true;

  private constructor(l: number, a: number, b: number, alpha: number) {
    this.l = l;
    this.a = a;
    this.b = b;
    this.alpha = alpha;
  }

  /**
   * Convert a gamma-encoded sRGB color, the one path to the private constructor.
   *
   * @param color - The sRGB color.
   * @returns Its OKLab coordinates, with the same alpha.
   */
  static fromSrgb(color: Srgb.Srgb): Oklab {
    const { r, g, b } = Srgb.toLinear(color);
    const [l, m, s] = apply(LINEAR_SRGB_TO_LMS, [r, g, b]);
    const [lightness, green, yellow] = apply(LMS_TO_OKLAB, [Math.cbrt(l), Math.cbrt(m), Math.cbrt(s)]);
    // A subnormal channel underflows in some matrix terms and not others, which can leave the
    // lightness a hair outside 0..1, so it clamps.
    return new Oklab(clampToUnitInterval(lightness), green, yellow, color.alpha);
  }
}

export type { Oklab };

/**
 * Convert a gamma-encoded sRGB color to OKLab.
 *
 * @param color - The sRGB color.
 * @returns Its OKLab coordinates, with the same alpha.
 */
export function fromSrgb(color: Srgb.Srgb): Oklab {
  return Oklab.fromSrgb(color);
}

/**
 * ΔE between two colors: the Euclidean distance between their OKLab coordinates, times 100.
 * White and black are 100 apart.
 *
 * @param left - One color. Its alpha does not enter, so composite a translucent color over
 *   its backdrop with `compositeOver` first.
 * @param right - The other color, read the same way.
 * @returns The distance, 0 for one color, symmetric in the two.
 */
export function deltaE(left: Srgb.Srgb, right: Srgb.Srgb): number {
  const from = fromSrgb(left);
  const to = fromSrgb(right);
  return 100 * Math.hypot(from.l - to.l, from.a - to.a, from.b - to.b);
}
