/**
 * sRGB colors in the two encodings the color math needs. {@link Srgb} is gamma-encoded and
 * inside the gamut, the form CSS, hex and design tools store. {@link LinearSrgb} is linear
 * light and may fall outside the gamut, the form conversions pass through and luminance
 * reads. The two carry different tags, so a linear channel cannot reach a function that
 * expects an encoded one.
 */

import { clampToUnitInterval, FINITE, outOfRange, UNIT_RANGE } from "./component-range.ts";
import type { ComponentRange } from "./component-range.ts";
import { CSS_NUMBER, readAlpha } from "./css-number.ts";
import { InvalidColor } from "./invalid-color.ts";
import type { OutOfRange } from "./out-of-range.ts";
import { err, ok } from "./result-constructors.ts";
import { getOrThrow } from "./result.ts";
import type { Result } from "./result.ts";

/** The channels and alpha of an sRGB color, in either encoding. */
export type SrgbComponents = {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly alpha: number;
};

const SRGB_RANGES = {
  r: UNIT_RANGE,
  g: UNIT_RANGE,
  b: UNIT_RANGE,
  alpha: UNIT_RANGE,
} as const satisfies Record<keyof SrgbComponents, ComponentRange>;

const LINEAR_RANGES = {
  r: FINITE,
  g: FINITE,
  b: FINITE,
  alpha: UNIT_RANGE,
} as const satisfies Record<keyof SrgbComponents, ComponentRange>;

/**
 * A gamma-encoded sRGB color inside the gamut, with every channel and alpha in `0..1`. Only
 * {@link make} and this package's parsers and conversions construct one. The private brand
 * field keeps a spread copy from type-checking as an `Srgb`.
 */
class Srgb {
  /** The tag a `switch` over a color union matches on. */
  readonly _tag = "Srgb" as const;

  /** The encoded red channel, in `0..1`. */
  readonly r: number;

  /** The encoded green channel, in `0..1`. */
  readonly g: number;

  /** The encoded blue channel, in `0..1`. */
  readonly b: number;

  /** Alpha, in `0..1`. */
  readonly alpha: number;

  // oxlint-disable-next-line no-unused-private-class-members -- The field is the brand. No code reads it, but a spread cannot copy it, so only this class's instances have it.
  readonly #brand = true;

  private constructor(components: SrgbComponents) {
    this.r = components.r;
    this.g = components.g;
    this.b = components.b;
    this.alpha = components.alpha;
  }

  /**
   * Construct a gamma-encoded sRGB color after checking every component, the one path to
   * the private constructor.
   *
   * @param components - Channels and alpha, each in `0..1`.
   * @returns The color, or `OutOfRange` naming the first component outside `0..1`.
   */
  static make(components: SrgbComponents): Result<Srgb, OutOfRange> {
    const violation = outOfRange("Srgb", components, SRGB_RANGES);
    return violation === undefined ? ok(new Srgb(components)) : err(violation);
  }
}

/**
 * A linear-light sRGB color. Its channels are finite but may leave `0..1`, since a color from a
 * wider space can fall outside the sRGB gamut. Alpha is in `0..1`. Only {@link makeLinear} and
 * this package's conversions construct one. The private brand field keeps a spread copy from
 * type-checking as a `LinearSrgb`.
 */
class LinearSrgb {
  /** The tag that keeps a linear color apart from an encoded one. */
  readonly _tag = "LinearSrgb" as const;

  /** The linear red channel, any finite number. */
  readonly r: number;

  /** The linear green channel, any finite number. */
  readonly g: number;

  /** The linear blue channel, any finite number. */
  readonly b: number;

  /** Alpha, in `0..1`. */
  readonly alpha: number;

  // oxlint-disable-next-line no-unused-private-class-members -- The field is the brand. No code reads it, but a spread cannot copy it, so only this class's instances have it.
  readonly #brand = true;

  private constructor(components: SrgbComponents) {
    this.r = components.r;
    this.g = components.g;
    this.b = components.b;
    this.alpha = components.alpha;
  }

  /**
   * Construct a linear-light sRGB color after checking every component, the one path to the
   * private constructor.
   *
   * @param components - Finite channels, and an alpha in `0..1`.
   * @returns The color, or `OutOfRange` naming the first component that is not finite or an
   *   alpha outside `0..1`.
   */
  static make(components: SrgbComponents): Result<LinearSrgb, OutOfRange> {
    const violation = outOfRange("LinearSrgb", components, LINEAR_RANGES);
    return violation === undefined ? ok(new LinearSrgb(components)) : err(violation);
  }
}

export type { LinearSrgb, Srgb };

/**
 * Construct a gamma-encoded sRGB color from numbers, such as channels a design tool reports.
 *
 * @param components - Channels and alpha, each in `0..1`.
 * @returns The color, or `OutOfRange` naming the first component outside `0..1`.
 */
export function make(components: SrgbComponents): Result<Srgb, OutOfRange> {
  return Srgb.make(components);
}

/**
 * Construct a linear-light sRGB color from numbers.
 *
 * @param components - Finite channels, and an alpha in `0..1`.
 * @returns The color, or `OutOfRange` naming the first component that is not finite or an
 *   alpha outside `0..1`.
 */
export function makeLinear(components: SrgbComponents): Result<LinearSrgb, OutOfRange> {
  return LinearSrgb.make(components);
}

const LEGACY_RGB = new RegExp(
  `^rgba?\\(\\s*(${CSS_NUMBER})\\s*,\\s*(${CSS_NUMBER})\\s*,\\s*(${CSS_NUMBER})` +
    `\\s*(?:,\\s*(${CSS_NUMBER})\\s*)?\\)$`,
  "i"
);

/**
 * Parse CSS `rgb()` or `rgba()` in the legacy comma-separated form Chromium serializes a
 * computed sRGB color in: `rgb(r, g, b)` or `rgba(r, g, b, a)`. Channels are numbers from 0
 * to 255 and alpha is a number from 0 to 1. Out-of-range values clamp as CSS clamps them. The
 * parser refuses the space-separated form, percentages and the `none` keyword.
 *
 * @param input - The text to parse, without surrounding whitespace.
 * @returns The color, or `InvalidColor` when the input is not that notation.
 */
export function parse(input: string): Result<Srgb, InvalidColor> {
  const match = LEGACY_RGB.exec(input);
  if (match === null) {
    return err(new InvalidColor("rgb", input));
  }
  const [, r = "", g = "", b = "", alpha] = match;
  return ok(encoded(readChannel(r), readChannel(g), readChannel(b), readAlpha(alpha)));
}

function readChannel(value: string): number {
  return clampToUnitInterval(Number(value) / 255);
}

/**
 * Encode a linear-light color for display, clipping each channel into the gamut first. This
 * is the gamut clip CSS Color 4 names as the simplest mapping. It keeps in-gamut colors exact
 * and moves each out-of-gamut channel to the nearest end.
 *
 * @param color - A linear-light color, possibly out of gamut.
 * @returns The gamma-encoded color, with the same alpha.
 */
export function fromLinear(color: LinearSrgb): Srgb {
  return encoded(
    encode(clampToUnitInterval(color.r)),
    encode(clampToUnitInterval(color.g)),
    encode(clampToUnitInterval(color.b)),
    color.alpha
  );
}

/**
 * Decode a gamma-encoded color to linear light.
 *
 * @param color - A gamma-encoded sRGB color.
 * @returns The linear-light color, with the same alpha.
 */
export function toLinear(color: Srgb): LinearSrgb {
  return getOrThrow(
    makeLinear({ r: decode(color.r), g: decode(color.g), b: decode(color.b), alpha: color.alpha })
  );
}

/**
 * Composite one color over another with the source-over operator, in gamma-encoded sRGB as
 * CSS composites. The result's alpha is the union of both coverages.
 *
 * @param foreground - The color painted on top.
 * @param background - The color underneath.
 * @returns The composited color. Two fully transparent colors composite to transparent black.
 */
export function compositeOver(foreground: Srgb, background: Srgb): Srgb {
  const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha);
  if (alpha === 0) {
    return encoded(0, 0, 0, 0);
  }
  const backgroundWeight = background.alpha * (1 - foreground.alpha);
  const blend = (front: number, back: number): number =>
    clampToUnitInterval((front * foreground.alpha + back * backgroundWeight) / alpha);
  return encoded(
    blend(foreground.r, background.r),
    blend(foreground.g, background.g),
    blend(foreground.b, background.b),
    clampToUnitInterval(alpha)
  );
}

/** Construct an encoded color from channels the caller has already clamped into `0..1`. */
function encoded(r: number, g: number, b: number, alpha: number): Srgb {
  return getOrThrow(make({ r, g, b, alpha }));
}

/**
 * The sRGB transfer function, IEC 61966-2-1, for a channel in `0..1`. The curve maps 1 to 1,
 * but `1.055 - 0.055` rounds a step below it, so the top end returns exactly.
 */
function encode(linear: number): number {
  if (linear >= 1) {
    return 1;
  }
  return linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
}

/** The inverse sRGB transfer function, for a channel in `0..1`. */
function decode(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}
