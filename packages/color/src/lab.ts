/**
 * CIE Lab with the D50 white point, as CSS Color 4 `lab()` writes it. Chromium serializes a
 * computed color in `lab()` when the declared color came through a pipeline, such as
 * Tailwind's, that writes it that way, so the browser suites read it here.
 */

import { outOfRange, UNIT_RANGE } from "./component-range.ts";
import type { ComponentRange } from "./component-range.ts";
import { CSS_NUMBER, readAlpha } from "./css-number.ts";
import { InvalidColor } from "./invalid-color.ts";
import type { OutOfRange } from "./out-of-range.ts";
import { err, ok } from "./result-constructors.ts";
import { getOrThrow } from "./result.ts";
import type { Result } from "./result.ts";
import * as Srgb from "./srgb.ts";

// CSS leaves the `a` and `b` axes unbounded, but the widest display gamuts stay within
// about 150 of 0. The conversion divides an axis by 200 or 500 and cubes the result, so an axis
// within 1e6 keeps every intermediate below 1e12, where overflow to infinity needs an axis
// near 1e104. The bound sits far outside any gamut and far inside the finite range, so every
// constructible color converts.
const MAX_AXIS = 1e6;

/** The lightness, `a` and `b` axes and alpha of a CIE Lab color. */
export type LabComponents = {
  readonly l: number;
  readonly a: number;
  readonly b: number;
  readonly alpha: number;
};

const AXIS_RANGE: ComponentRange = { _tag: "Interval", min: -MAX_AXIS, max: MAX_AXIS, upper: "inclusive" };

const RANGES = {
  l: { _tag: "Interval", min: 0, max: 100, upper: "inclusive" },
  a: AXIS_RANGE,
  b: AXIS_RANGE,
  alpha: UNIT_RANGE,
} as const satisfies Record<keyof LabComponents, ComponentRange>;

/**
 * A CIE Lab color. Lightness is in `0..100`, the `a` and `b` axes are in `-1e6..1e6`, and
 * alpha is in `0..1`. Only {@link make} and {@link parse} construct one. The private brand
 * field keeps a spread copy from type-checking as a `Lab`.
 */
class Lab {
  /** The tag a `switch` over a color union matches on. */
  readonly _tag = "Lab" as const;

  /** CIE lightness L*, in `0..100`. */
  readonly l: number;

  /** The green to red axis, in `-1e6..1e6`. */
  readonly a: number;

  /** The blue to yellow axis, in `-1e6..1e6`. */
  readonly b: number;

  /** Alpha, in `0..1`. */
  readonly alpha: number;

  // oxlint-disable-next-line no-unused-private-class-members -- The field is the brand. No code reads it, but a spread cannot copy it, so only this class's instances have it.
  readonly #brand = true;

  private constructor(components: LabComponents) {
    this.l = components.l;
    this.a = components.a;
    this.b = components.b;
    this.alpha = components.alpha;
  }

  /**
   * Construct a CIE Lab color after checking every component, the one path to the private
   * constructor.
   *
   * @param components - Lightness in `0..100`, axes in `-1e6..1e6`, alpha in `0..1`.
   * @returns The color, or `OutOfRange` naming the first component outside its range.
   */
  static make(components: LabComponents): Result<Lab, OutOfRange> {
    const violation = outOfRange("Lab", components, RANGES);
    return violation === undefined ? ok(new Lab(components)) : err(violation);
  }
}

export type { Lab };

/**
 * Construct a CIE Lab color from numbers.
 *
 * @param components - Lightness in `0..100`, axes in `-1e6..1e6`, alpha in `0..1`.
 * @returns The color, or `OutOfRange` naming the first component outside its range.
 */
export function make(components: LabComponents): Result<Lab, OutOfRange> {
  return Lab.make(components);
}

const LAB = new RegExp(
  `^lab\\(\\s*(${CSS_NUMBER})\\s+(${CSS_NUMBER})\\s+(${CSS_NUMBER})` +
    `\\s*(?:/\\s*(${CSS_NUMBER})\\s*)?\\)$`,
  "i"
);

/**
 * Parse CSS `lab()` notation as Chromium serializes a computed color: `lab(L a b)` or
 * `lab(L a b / A)`, every component a plain number. As CSS does at parse time, lightness
 * clamps to `0..100` and alpha to `0..1`. The axes have no bound to clamp to, so an axis
 * beyond ±1e6 is refused rather than carried into the conversion math. Percentages and the
 * `none` keyword are refused.
 *
 * @param input - The text to parse, without surrounding whitespace.
 * @returns The color, or `InvalidColor` when the input is not that notation or holds an axis
 *   out of range.
 */
export function parse(input: string): Result<Lab, InvalidColor> {
  const match = LAB.exec(input);
  if (match === null) {
    return err(new InvalidColor("lab", input));
  }
  const [, lightness = "", a = "", b = "", alpha] = match;
  const green = Number(a);
  const blue = Number(b);
  if (Math.abs(green) > MAX_AXIS || Math.abs(blue) > MAX_AXIS) {
    return err(new InvalidColor("lab", input));
  }
  const l = Math.min(100, Math.max(0, Number(lightness)));
  return ok(getOrThrow(make({ l, a: green, b: blue, alpha: readAlpha(alpha) })));
}

const EPSILON = 216 / 24389;
const KAPPA = 24389 / 27;

// The D50 white point, from its CIE chromaticity x 0.3457, y 0.3585.
const WHITE_X = 0.3457 / 0.3585;
const WHITE_Z = (1 - 0.3457 - 0.3585) / 0.3585;

/**
 * Convert a color to linear-light sRGB, without clipping: Lab to XYZ under D50, the Bradford
 * adaptation to D65, then the XYZ to linear sRGB matrix, all as CSS Color 4 specifies them.
 *
 * @param color - The color to convert.
 * @returns The linear-light sRGB color, with the same alpha.
 */
export function toLinearSrgb(color: Lab): Srgb.LinearSrgb {
  const fy = (color.l + 16) / 116;
  const fx = color.a / 500 + fy;
  const fz = fy - color.b / 200;
  const x = (fx ** 3 > EPSILON ? fx ** 3 : (116 * fx - 16) / KAPPA) * WHITE_X;
  const y = color.l > KAPPA * EPSILON ? fy ** 3 : color.l / KAPPA;
  const z = (fz ** 3 > EPSILON ? fz ** 3 : (116 * fz - 16) / KAPPA) * WHITE_Z;
  const x65 = 0.955473421488075 * x - 0.02309845494876471 * y + 0.06325924320057072 * z;
  const y65 = -0.0283697093338637 * x + 1.0099953980813041 * y + 0.021041441191917323 * z;
  const z65 = 0.012314014864481998 * x - 0.020507649298898964 * y + 1.330365926242124 * z;
  // The axis bound keeps every term finite, so the channels always construct.
  return getOrThrow(
    Srgb.makeLinear({
      r: 3.2409699419045226 * x65 - 1.537383177570094 * y65 - 0.4986107602930034 * z65,
      g: -0.9692436362808796 * x65 + 1.8759675015077202 * y65 + 0.04155505740717559 * z65,
      b: 0.05563007969699366 * x65 - 0.20397695888897652 * y65 + 1.0569715142428786 * z65,
      alpha: color.alpha,
    })
  );
}

/**
 * Convert a color to gamma-encoded sRGB. A color outside the sRGB gamut has each channel
 * clipped into `0..1`.
 *
 * @param color - The color to convert.
 * @returns The sRGB color, with the same alpha.
 */
export function toSrgb(color: Lab): Srgb.Srgb {
  return Srgb.fromLinear(toLinearSrgb(color));
}
