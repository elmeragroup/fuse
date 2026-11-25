import * as Oklch from "@elmeragroup/color/oklch";
import { getOrThrow } from "@elmeragroup/color/result";

import { cssVarReference } from "../css-values";
import { literalContrast, tokenOklch } from "../token-color";
import { isDerivedTokenName, isTokenName } from "./contract";
import type { LayerTokens } from "./contract";
import { isPrimitiveName, PRIMITIVES } from "./primitives";

/** The WCAG floor for small text, which every stepped tone reaches on its surfaces. */
export const TEXT_FLOOR = 4.5;

const LIGHTNESS_STEP = 0.01;

/**
 * The literal at the end of a value's `var()` chain, through the composed roles and the
 * primitives.
 *
 * @param tokens - Every layer-assigned role of one composed theme in one scheme.
 * @param value - A role's value, a literal or a `var()` reference.
 * @returns The literal the chain ends on.
 * @throws When the chain names neither a layer role nor a primitive, which is a defect in a layer.
 */
export function literalOf(tokens: LayerTokens, value: string): string {
  const name = cssVarReference(value);
  if (name === undefined) {
    return value;
  }
  if (isTokenName(name) && !isDerivedTokenName(name)) {
    return literalOf(tokens, tokens[name]);
  }
  if (!isPrimitiveName(name)) {
    throw new Error(`${value} names neither a layer role nor a primitive`);
  }
  return literalOf(tokens, PRIMITIVES[name]);
}

/**
 * The WCAG contrast of two colors, each measured as its `oklch()` literal reads.
 *
 * @param foreground - The text color.
 * @param background - The surface color.
 * @returns The contrast ratio, 1 to 21.
 */
export function toneContrast(foreground: Oklch.Oklch, background: Oklch.Oklch): number {
  return literalContrast(Oklch.format(foreground), Oklch.format(background));
}

/** The color at one lightness, with its hue and the chroma the sRGB gamut allows there. */
function atLightness(color: Oklch.Oklch, lightness: number): Oklch.Oklch {
  const components = { l: lightness, c: color.c, h: color.h, alpha: color.alpha };
  return tokenOklch(Oklch.format(Oklch.clampChromaToSrgb(getOrThrow(Oklch.make(components)))));
}

/**
 * The nearest sampled tone of a color that reaches the text floor on every surface. A color that
 * already does comes back as the same object, so a caller can keep its alias. Otherwise the function
 * samples the lightness every 0.01 in both directions and returns the nearest sample that passes. A
 * passing tone between two samples is never found. At equal distance it prefers the direction away
 * from the surfaces' mean lightness. Each sample keeps the hue and the chroma the sRGB gamut allows,
 * and the function measures it as its `oklch()` literal reads back, so the emitted value is the one
 * that passed.
 *
 * @param color - The color to keep as close as possible, such as the brand.
 * @param surfaces - The surfaces the tone must reach the floor on.
 * @returns The color itself, or the nearest passing sample.
 * @throws When no sampled lightness reaches the floor on every surface, which is a defect in the
 *   palettes.
 */
export function readableTone(color: Oklch.Oklch, surfaces: readonly Oklch.Oklch[]): Oklch.Oklch {
  const passes = (tone: Oklch.Oklch): boolean =>
    surfaces.every((surface) => toneContrast(tone, surface) >= TEXT_FLOOR);
  if (passes(color)) {
    return color;
  }
  const meanLightness = surfaces.reduce((sum, surface) => sum + surface.l, 0) / surfaces.length;
  const away = color.l < meanLightness ? -1 : 1;
  const maxSteps = Math.round(1 / LIGHTNESS_STEP);
  for (let step = 1; step <= maxSteps; step++) {
    for (const direction of [away, -away]) {
      const lightness = Math.min(1, Math.max(0, color.l + direction * step * LIGHTNESS_STEP));
      const tone = atLightness(color, lightness);
      if (passes(tone)) {
        return tone;
      }
    }
  }
  const named = surfaces.map((surface) => Oklch.format(surface)).join(", ");
  throw new Error(
    `No lightness of ${Oklch.format(color)} sampled every ${LIGHTNESS_STEP} reaches ${TEXT_FLOOR}:1 on ${named}`
  );
}
