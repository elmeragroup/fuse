/**
 * OKLCH, the polar form of Björn Ottosson's OKLab, as CSS Color 4 writes it. The theme
 * tokens are OKLCH literals, so this module reads and writes them, mixes them as CSS
 * `color-mix(in oklch, …)` does, and converts them to sRGB for contrast checks and design
 * tools.
 */

import { clampToUnitInterval, outOfRange, UNIT_RANGE } from "./component-range.ts";
import type { ComponentRange } from "./component-range.ts";
import { CSS_NUMBER, readAlpha } from "./css-number.ts";
import { InvalidColor } from "./invalid-color.ts";
import type { OutOfRange } from "./out-of-range.ts";
import { err, ok } from "./result-constructors.ts";
import { getOrThrow } from "./result.ts";
import type { Result } from "./result.ts";
import * as Srgb from "./srgb.ts";

// CSS leaves chroma unbounded, but no display gamut reaches 0.5. The conversion to sRGB cubes
// sums of about 1.3 times the chroma and scales them by about 4, so a chroma of 1e6 keeps
// every intermediate below 1e20, where overflow to infinity needs about 1e102. The bound sits
// far outside any gamut and far inside the finite range, so every constructible color
// converts.
const MAX_CHROMA = 1e6;

declare const mixWeightBrand: unique symbol;

/** The lightness, chroma, hue and alpha of an OKLCH color. */
export type OklchComponents = {
  readonly l: number;
  readonly c: number;
  readonly h: number;
  readonly alpha: number;
};

const RANGES = {
  l: UNIT_RANGE,
  c: { _tag: "Interval", min: 0, max: MAX_CHROMA, upper: "inclusive" },
  h: { _tag: "Interval", min: 0, max: 360, upper: "exclusive" },
  alpha: UNIT_RANGE,
} as const satisfies Record<keyof OklchComponents, ComponentRange>;

/**
 * An OKLCH color. Lightness and alpha are in `0..1`, chroma is in `0..1e6`, and the hue is in
 * degrees within `0..360`, exclusive. Only {@link make} and this package's parsers and math
 * construct one, so parse untrusted text with {@link parse}. The private brand field keeps a
 * spread copy such as `{ ...color, h: 720 }` from type-checking as an `Oklch`.
 */
class Oklch {
  /** The tag a `switch` over a color union matches on. */
  readonly _tag = "Oklch" as const;

  /** Lightness, in `0..1`. */
  readonly l: number;

  /** Chroma, in `0..1e6`. */
  readonly c: number;

  /** Hue in degrees, in `0..360` exclusive. */
  readonly h: number;

  /** Alpha, in `0..1`. */
  readonly alpha: number;

  // oxlint-disable-next-line no-unused-private-class-members -- The field is the brand. No code reads it, but a spread cannot copy it, so only this class's instances have it.
  readonly #brand = true;

  private constructor(components: OklchComponents) {
    this.l = components.l;
    this.c = components.c;
    this.h = components.h;
    this.alpha = components.alpha;
  }

  /**
   * Construct an OKLCH color after checking every component, the one path to the private
   * constructor.
   *
   * @param components - Lightness and alpha in `0..1`, chroma in `0..1e6`, hue in `0..360`
   *   exclusive.
   * @returns The color, or `OutOfRange` naming the first component outside its range.
   */
  static make(components: OklchComponents): Result<Oklch, OutOfRange> {
    const violation = outOfRange("Oklch", components, RANGES);
    return violation === undefined ? ok(new Oklch(components)) : err(violation);
  }
}

export type { Oklch };

/**
 * Construct an OKLCH color from numbers.
 *
 * @param components - Lightness and alpha in `0..1`, chroma in `0..1e6`, hue in `0..360`
 *   exclusive.
 * @returns The color, or `OutOfRange` naming the first component outside its range.
 */
export function make(components: OklchComponents): Result<Oklch, OutOfRange> {
  return Oklch.make(components);
}

/** Construct a color from components the caller has already clamped into range. */
function inRange(l: number, c: number, h: number, alpha: number): Oklch {
  return getOrThrow(make({ l, c, h, alpha }));
}

const OKLCH = new RegExp(
  `^oklch\\(\\s*(${CSS_NUMBER})\\s+(${CSS_NUMBER})\\s+(${CSS_NUMBER})` +
    `\\s*(?:/\\s*(${CSS_NUMBER})(%?)\\s*)?\\)$`,
  "i"
);

/**
 * Parse CSS `oklch()` notation as the token literals and Chromium's computed values write it:
 * `oklch(L C H)` or `oklch(L C H / A)`, with plain numbers for lightness, chroma and hue in
 * degrees, and alpha as a number or a percentage. As CSS does at parse time, lightness and
 * alpha clamp to `0..1`, a negative chroma clamps to 0 and the hue wraps into `0..360`.
 * Chroma and hue have no upper bound to clamp to, so a chroma above 1e6 or a hue too large
 * for a double is refused rather than carried into the conversion math. Percentages for
 * lightness or chroma, angle units and the `none` keyword are refused.
 *
 * @param input - The text to parse, without surrounding whitespace.
 * @returns The color, or `InvalidColor` when the input is not that notation or holds a
 *   chroma or hue out of range.
 */
export function parse(input: string): Result<Oklch, InvalidColor> {
  const match = OKLCH.exec(input);
  if (match === null) {
    return err(new InvalidColor("oklch", input));
  }
  const [, lightness = "", chroma = "", hue = "", alpha, alphaPercent] = match;
  const c = Number(chroma);
  const h = Number(hue);
  if (c > MAX_CHROMA || !Number.isFinite(h)) {
    return err(new InvalidColor("oklch", input));
  }
  return ok(
    inRange(
      clampToUnitInterval(Number(lightness)),
      Math.max(0, c),
      wrapHue(h),
      readAlpha(alpha, alphaPercent)
    )
  );
}

/**
 * Wrap a finite hue into `0..360`, folding `-0` and the `360` that rounding can leave. A hue
 * already in range passes through untouched, because the modulo arithmetic would perturb
 * its last bit and change how it formats.
 */
function wrapHue(hue: number): number {
  if (hue > 0 && hue < 360) {
    return hue;
  }
  const wrapped = ((hue % 360) + 360) % 360;
  return wrapped === 360 || Object.is(wrapped, -0) ? 0 : wrapped;
}

// Seven decimals keep every literal the theme palettes hold, the longest being seven-decimal
// coordinates, so writing a parsed literal returns its spelling. 1e-7 is far below any
// perceptible OKLCH difference.
const DECIMALS = 7;

/** A fixed-point number without trailing zeros and without a negative zero. */
function formatNumber(value: number): string {
  const fixed = value.toFixed(DECIMALS);
  const trimmed = fixed.includes(".") ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
  return trimmed === "-0" ? "0" : trimmed;
}

/**
 * Write a color as CSS `oklch()` notation with up to seven decimals per component. An
 * opaque color is written `oklch(L C H)` and a translucent one `oklch(L C H / A)`.
 *
 * @param color - The color to write.
 * @returns The `oklch()` literal, which {@link parse} reads back to the same components at
 *   seven-decimal precision.
 */
export function format(color: Oklch): string {
  // A hue within half a step of 360 rounds up to it; 0 is the same angle, in range.
  const hue = formatNumber(color.h);
  const components = `${formatNumber(color.l)} ${formatNumber(color.c)} ${hue === "360" ? "0" : hue}`;
  // The check reads the alpha after rounding, because `0.95 + 0.05` need not sum to exactly
  // 1 in floating point.
  const opacity = formatNumber(color.alpha);
  return opacity === "1" ? `oklch(${components})` : `oklch(${components} / ${opacity})`;
}

/**
 * The share of the second color in a mix, from 0 to 1. CSS `color-mix(…, to 5%)` is `0.05`.
 * Only {@link makeMixWeight} constructs one.
 */
export type MixWeight = number & { readonly [mixWeightBrand]: true };

/**
 * Construct a mix weight.
 *
 * @param weight - The share of the second color, from 0 to 1.
 * @returns The weight, or `OutOfRange` when it is outside `0..1`.
 */
export function makeMixWeight(weight: number): Result<MixWeight, OutOfRange> {
  const violation = outOfRange("MixWeight", { weight }, { weight: UNIT_RANGE });
  // SAFETY: TypeScript cannot express the range brand. The check above proved the weight is
  // in 0..1, and this is the only place that brands a MixWeight.
  return violation === undefined ? ok(weight as MixWeight) : err(violation);
}

/**
 * Mix two colors as CSS `color-mix(in oklch, from, to weight)` does, following CSS Color 4
 * interpolation. Lightness and chroma interpolate premultiplied by alpha, alpha
 * interpolates linearly, and the hue takes the shorter arc. A hue written as a number
 * interpolates even when its chroma is 0; only a `none` hue would be missing, and
 * {@link parse} refuses `none`.
 *
 * @param from - The color the mix starts from.
 * @param to - The color the mix moves toward.
 * @param weight - The share of `to`.
 * @returns The mixed color.
 */
export function mix(from: Oklch, to: Oklch, weight: MixWeight): Oklch {
  const keep = 1 - weight;
  const alpha = clampToUnitInterval(from.alpha * keep + to.alpha * weight);
  const premultiplied = (start: number, end: number): number =>
    alpha === 0 ? 0 : (start * from.alpha * keep + end * to.alpha * weight) / alpha;
  // Premultiplication divides by the mixed alpha, which can land a rounding step outside
  // the endpoints' range. The clamps keep the result constructible.
  return inRange(
    clampToUnitInterval(premultiplied(from.l, to.l)),
    Math.min(MAX_CHROMA, Math.max(0, premultiplied(from.c, to.c))),
    shorterArcHue(from.h, to.h, weight),
    alpha
  );
}

function shorterArcHue(fromHue: number, toHue: number, weight: number): number {
  let start = fromHue;
  let end = toHue;
  if (end - start > 180) {
    start += 360;
  } else if (end - start < -180) {
    end += 360;
  }
  return wrapHue(start * (1 - weight) + end * weight);
}

/**
 * Convert a color to linear-light sRGB through OKLab, without clipping. A color outside the
 * sRGB gamut keeps channels beyond `0..1`, so a caller chooses how to map it.
 *
 * @param color - The color to convert.
 * @returns The linear-light sRGB color, with the same alpha.
 */
export function toLinearSrgb(color: Oklch): Srgb.LinearSrgb {
  const hue = (color.h * Math.PI) / 180;
  const a = color.c * Math.cos(hue);
  const b = color.c * Math.sin(hue);
  // Ottosson's OKLab to LMS and LMS to linear sRGB matrices, with the cube between them.
  const l = (color.l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (color.l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (color.l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  // The chroma bound keeps every term finite, so the channels always construct.
  return getOrThrow(
    Srgb.makeLinear({
      r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
      alpha: color.alpha,
    })
  );
}

/**
 * Convert a color to gamma-encoded sRGB, the form hex and design tools store. A color
 * outside the sRGB gamut has each channel clipped into `0..1`.
 *
 * @param color - The color to convert.
 * @returns The sRGB color, with the same alpha.
 */
export function toSrgb(color: Oklch): Srgb.Srgb {
  return Srgb.fromLinear(toLinearSrgb(color));
}
