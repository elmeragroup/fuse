/**
 * The recipe that generates a brand's ramps where the Figma brand collection has none, as for
 * Elmera and Nordic Green Energy. It is deterministic and reads only the five Figma ramps and the
 * brand primitive, so `brand-ramps.test.ts` checks the literals in `src/theme/tokens/brand-ramps.ts`
 * against it. Run `print-brand-ramps.ts` to print fresh literals after a Figma ramp changes.
 *
 * For each step of the shade ramp:
 *
 * - Lightness is the median OKLCH lightness of the five Figma shade ramps at that step.
 * - Hue is the brand primitive's hue.
 * - Chroma is the brand primitive's chroma scaled by the median Figma shade chroma at the step,
 *   relative to the median at the anchor step.
 * - The anchor is the step whose median lightness lies nearest the primitive's. It is a `var()`
 *   of the primitive, so the ramp passes through the brand color exactly.
 * - Every other step is gamut-mapped into sRGB by lowering chroma, keeping lightness and hue, and
 *   written as `#RRGGBB`, as the Figma ramps are.
 *
 * For each step of the neutral ramp, lightness and chroma are the median lightness and chroma of
 * the five Figma neutral ramps at that step, at the brand primitive's hue, gamut-mapped the same
 * way.
 *
 * The Figma ramps all darken at every step, so their medians do too, and a generated ramp is
 * monotonic. The anchor is the nearest step, so its lightness lies between its neighbours'.
 */

import * as Hex from "@elmeragroup/color/hex";
import * as Oklch from "@elmeragroup/color/oklch";
import { getOrThrow } from "@elmeragroup/color/result";

import { readTokenColor } from "../src/theme/token-color.ts";
import { FIGMA_BRAND_RAMPS, RAMP_STEPS } from "../src/theme/tokens/brand-ramps.ts";
import type { BrandRamps, RampScale, RampStep } from "../src/theme/tokens/brand-ramps.ts";
import { PRIMITIVES } from "../src/theme/tokens/primitives.ts";

/** A literal as OKLCH: a Figma ramp's hex, or a primitive's `oklch()`. */
function oklchOf(literal: string): Oklch.Oklch {
  const color = getOrThrow(readTokenColor(literal));
  return color._tag === "Oklch" ? color : Oklch.fromSrgb(color);
}

/** One value at every step of a ramp. */
type StepValues<T> = { readonly [S in RampStep]: T };

/** A value at every step of a ramp, from a per-step function. */
function perStep<T>(at: (step: RampStep) => T): StepValues<T> {
  return {
    "50": at("50"),
    "100": at("100"),
    "200": at("200"),
    "300": at("300"),
    "400": at("400"),
    "500": at("500"),
    "600": at("600"),
    "700": at("700"),
    "800": at("800"),
    "900": at("900"),
    "950": at("950"),
  };
}

/** The median of five or more values: the middle one, or the mean of the middle two. */
function median(values: readonly number[]): number {
  const sorted = values.toSorted((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;
  return sorted.length % 2 === 1 ? upper : ((sorted[middle - 1] ?? upper) + upper) / 2;
}

/** The median OKLCH lightness and chroma of one scale's Figma ramps at every step. */
type MedianScale = StepValues<{ readonly l: number; readonly c: number }>;

/** The median lightness and chroma of the Figma ramps of one scale at every step. */
function medianScale(scale: RampScale): MedianScale {
  const ramps = Object.values(FIGMA_BRAND_RAMPS).map((ramps) => ramps[scale]);
  return perStep((step) => {
    const colors = ramps.map((ramp) => oklchOf(ramp[step]));
    return { l: median(colors.map((color) => color.l)), c: median(colors.map((color) => color.c)) };
  });
}

/**
 * A gamut-mapped color at the given lightness, chroma and hue, as `#RRGGBB`: the notation and the
 * 8-bit precision of the Figma ramps, and the shortest literal `themes.css` can ship.
 */
function literal(l: number, c: number, h: number): string {
  return Hex.formatOpaque(
    Oklch.toSrgb(Oklch.clampChromaToSrgb(getOrThrow(Oklch.make({ l, c, h, alpha: 1 }))))
  );
}

/**
 * The step a brand primitive anchors: the step whose median Figma shade lightness lies nearest
 * the primitive's lightness, the lighter one on a tie.
 *
 * @param brand - The brand primitive's color.
 * @param shades - The median Figma shade ramp.
 * @returns The anchor step.
 */
function anchorStep(brand: Oklch.Oklch, shades: MedianScale): RampStep {
  return RAMP_STEPS.reduce((nearest, step) =>
    Math.abs(shades[step].l - brand.l) < Math.abs(shades[nearest].l - brand.l) ? step : nearest
  );
}

/**
 * A brand's generated ramps, by the recipe above.
 *
 * @param code - A brand with no Figma ramp: `elma` or `ngfi`.
 * @returns The neutral and shade ramps as `#RRGGBB` literals, the anchor step a `var()` of the
 *   brand primitive, so it holds the brand color exactly and follows it.
 */
export function generatedBrandRamps(code: "elma" | "ngfi"): BrandRamps {
  const primitive = PRIMITIVES[`brand-${code}`];
  const brand = oklchOf(primitive);
  const shades = medianScale("shade");
  const neutrals = medianScale("neutral");
  const anchor = anchorStep(brand, shades);
  return {
    neutral: perStep((step) => literal(neutrals[step].l, neutrals[step].c, brand.h)),
    shade: perStep((step) =>
      step === anchor
        ? `var(--brand-${code})`
        : literal(shades[step].l, (brand.c * shades[step].c) / shades[anchor].c, brand.h)
    ),
  };
}
