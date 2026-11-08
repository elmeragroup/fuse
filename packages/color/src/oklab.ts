/**
 * Björn Ottosson's OKLab, as CSS Color 4 `oklab()` writes it, and ΔE as the Euclidean distance
 * between two OKLab colors times 100, the distance the chart palette gates measure. Chromium
 * serializes a computed `color-mix(in oklab, …)`, such as Tailwind's `/NN` opacity modifier, in
 * `oklab()`, so the browser suites read translucent fills here. OKLCH converts to sRGB through
 * this module's {@link toLinearSrgb}.
 */

import { clampToUnitInterval, outOfRange, UNIT_RANGE } from "./component-range.ts";
import type { ComponentRange } from "./component-range.ts";
import { CSS_NUMBER, readAlpha } from "./css-number.ts";
import { InvalidColor } from "./invalid-color.ts";
import { apply, LINEAR_SRGB_TO_LMS, LMS_TO_LINEAR_SRGB, LMS_TO_OKLAB, OKLAB_TO_LMS } from "./matrix3.ts";
import type { OutOfRange } from "./out-of-range.ts";
import { err, ok } from "./result-constructors.ts";
import { getOrThrow } from "./result.ts";
import type { Result } from "./result.ts";
import * as Srgb from "./srgb.ts";

export type { InvalidColor } from "./invalid-color.ts";
export type { OutOfRange } from "./out-of-range.ts";

// CSS leaves the `a` and `b` axes unbounded, but no display gamut reaches 0.5. The conversion
// to sRGB cubes sums of about 1.3 times an axis and scales them by about 4, so an axis within
// 1e6 keeps every intermediate below 1e20, where overflow to infinity needs about 1e102. The
// bound matches OKLCH's chroma bound, so every OKLCH color has an OKLab form, and sits far
// outside any gamut and far inside the finite range, so every constructible color converts.
const MAX_AXIS = 1e6;

/** The lightness, `a` and `b` axes and alpha of an OKLab color. */
export type OklabComponents = {
  readonly l: number;
  readonly a: number;
  readonly b: number;
  readonly alpha: number;
};

const AXIS_RANGE: ComponentRange = { _tag: "Interval", min: -MAX_AXIS, max: MAX_AXIS, upper: "inclusive" };

const RANGES = {
  l: UNIT_RANGE,
  a: AXIS_RANGE,
  b: AXIS_RANGE,
  alpha: UNIT_RANGE,
} as const satisfies Record<keyof OklabComponents, ComponentRange>;

/**
 * An OKLab color. Lightness and alpha are in `0..1`, and the `a` and `b` axes, green to red
 * and blue to yellow, are in `-1e6..1e6`. Only {@link make}, {@link parse} and
 * {@link fromSrgb} construct one. The private brand field keeps a spread copy from
 * type-checking as an `Oklab`.
 */
class Oklab {
  /** The tag a `switch` over a color union matches on. */
  readonly _tag = "Oklab" as const;

  /** Perceptual lightness, in `0..1`. */
  readonly l: number;

  /** The green to red axis, in `-1e6..1e6`. */
  readonly a: number;

  /** The blue to yellow axis, in `-1e6..1e6`. */
  readonly b: number;

  /** Alpha, in `0..1`. */
  readonly alpha: number;

  // oxlint-disable-next-line no-unused-private-class-members -- The field is the brand. No code reads it, but a spread cannot copy it, so only this class's instances have it.
  readonly #brand = true;

  private constructor(components: OklabComponents) {
    this.l = components.l;
    this.a = components.a;
    this.b = components.b;
    this.alpha = components.alpha;
  }

  /**
   * Construct an OKLab color after checking every component.
   *
   * @param components - Lightness and alpha in `0..1`, axes in `-1e6..1e6`.
   * @returns The color, or `OutOfRange` naming the first component outside its range.
   */
  static make(components: OklabComponents): Result<Oklab, OutOfRange> {
    const violation = outOfRange("Oklab", components, RANGES);
    return violation === undefined ? ok(new Oklab(components)) : err(violation);
  }

  /**
   * Convert a gamma-encoded sRGB color. Every sRGB color lands in range, so the conversion
   * skips the check.
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
    return new Oklab({ l: clampToUnitInterval(lightness), a: green, b: yellow, alpha: color.alpha });
  }
}

export type { Oklab };

/**
 * Construct an OKLab color from numbers.
 *
 * @param components - Lightness and alpha in `0..1`, axes in `-1e6..1e6`.
 * @returns The color, or `OutOfRange` naming the first component outside its range.
 */
export function make(components: OklabComponents): Result<Oklab, OutOfRange> {
  return Oklab.make(components);
}

const OKLAB = new RegExp(
  `^oklab\\(\\s*(${CSS_NUMBER})\\s+(${CSS_NUMBER})\\s+(${CSS_NUMBER})` +
    `\\s*(?:/\\s*(${CSS_NUMBER})(%?)\\s*)?\\)$`,
  "i"
);

/**
 * Parse CSS `oklab()` notation as Chromium serializes a computed color: `oklab(L a b)` or
 * `oklab(L a b / A)`, with plain numbers for lightness and the axes, and alpha as a number or
 * a percentage, the forms `oklch()` parsing reads. As CSS does at parse time, lightness and
 * alpha clamp to `0..1`. The axes have no bound to clamp to, so an axis beyond ±1e6 is refused
 * rather than carried into the conversion math. Percentages for lightness or the axes, and the
 * `none` keyword, are refused: Chromium's computed values write neither.
 *
 * @param input - The text to parse, without surrounding whitespace.
 * @returns The color, or `InvalidColor` when the input is not that notation or holds an axis
 *   out of range.
 */
export function parse(input: string): Result<Oklab, InvalidColor> {
  const match = OKLAB.exec(input);
  if (match === null) {
    return err(new InvalidColor("oklab", input));
  }
  const [, lightness = "", a = "", b = "", alpha, alphaPercent] = match;
  const green = Number(a);
  const yellow = Number(b);
  if (Math.abs(green) > MAX_AXIS || Math.abs(yellow) > MAX_AXIS) {
    return err(new InvalidColor("oklab", input));
  }
  return ok(
    getOrThrow(
      make({
        l: clampToUnitInterval(Number(lightness)),
        a: green,
        b: yellow,
        alpha: readAlpha(alpha, alphaPercent),
      })
    )
  );
}

/**
 * Convert a color to linear-light sRGB, without clipping. A color outside the sRGB gamut keeps
 * channels beyond `0..1`, so a caller chooses how to map it.
 *
 * @param color - The color to convert.
 * @returns The linear-light sRGB color, with the same alpha.
 */
export function toLinearSrgb(color: Oklab): Srgb.LinearSrgb {
  // Ottosson's OKLab to LMS and LMS to linear sRGB matrices, with the cube between them.
  const [l, m, s] = apply(OKLAB_TO_LMS, [color.l, color.a, color.b]);
  const [r, g, b] = apply(LMS_TO_LINEAR_SRGB, [l ** 3, m ** 3, s ** 3]);
  // The axis bound keeps every term finite, so the channels always construct.
  return getOrThrow(Srgb.makeLinear({ r, g, b, alpha: color.alpha }));
}

/**
 * Convert a color to gamma-encoded sRGB. A color outside the sRGB gamut has each channel
 * clipped into `0..1`.
 *
 * @param color - The color to convert.
 * @returns The sRGB color, with the same alpha.
 */
export function toSrgb(color: Oklab): Srgb.Srgb {
  return Srgb.fromLinear(toLinearSrgb(color));
}

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
