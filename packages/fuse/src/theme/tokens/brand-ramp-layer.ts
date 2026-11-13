/**
 * A theme's brand ramps, from the colour each brand and segment seeds them with. The seed is
 * read from the palette data, upstream of role assignment: the brand palette's `feature`,
 * overlaid by its segment delta's `feature` where one exists. It never reads a composed theme,
 * because the branded identity layer points roles at the ramps the seed builds.
 *
 * `feature` seeds the ramps, so it stays a curated colour literal in every brand palette and
 * segment delta. An alias there would make the ramps depend on the roles they feed, so
 * {@link brandSeed} refuses one with a message that names the brand and segment.
 */

import type * as Oklch from "@elmeragroup/color/oklch";

import { cssVarReference } from "../css-values";
import type { BrandCode, ThemeInput, ThemeSegment } from "../theme-input";
import { tokenOklch } from "../token-color";
import { BRAND_PALETTES, paletteBrand } from "./brand-palettes";
import { brandRampTokens } from "./brand-ramps";
import type { BrandRampTokens } from "./brand-ramps";
import { segmentSheet } from "./segment-sheets";

/**
 * The chroma of the brand neutral ramp before gamut mapping. It sits in the middle of the
 * 0.005 to 0.02 a tinted grey reads in: enough to carry the brand hue beside the tinted page,
 * and under every brand page's own tint but Nordic Green Energy's, so a neutral never reads as
 * a brand fill. At step 50, near white, sRGB holds less than 0.01 for the warm and violet brand
 * hues, so gamut mapping lowers those steps to about 0.007, still a visible tint.
 */
const BRAND_NEUTRAL_CHROMA = 0.01;

/**
 * The colour a brand and segment seeds its ramps with: its branded light `feature`, the strong
 * brand colour every brand and segment curates. Fjordkraft's company segment, and `fkab` through
 * the alias, take its teal rather than the orange of the private segment.
 *
 * @param brand - The brand. `fkab` resolves to `fkas`.
 * @param segment - The segment.
 * @returns The seed colour.
 * @throws When the seed is a `var()` alias rather than a colour literal, a defect in the palettes.
 */
function brandSeed(brand: BrandCode, segment: ThemeSegment): Oklch.Oklch {
  const palette = paletteBrand(brand);
  const feature = segmentSheet(palette, segment)?.light.feature ?? BRAND_PALETTES[palette].feature;
  if (cssVarReference(feature) !== undefined) {
    throw new Error(
      `The ${brand} ${segment} feature seeds the brand ramps, so it must be a colour literal, not ${feature}.`
    );
  }
  return tokenOklch(feature);
}

/**
 * A theme's ramp tokens. They follow the brand and segment alone, so a theme holds the same
 * ramps in both color schemes and both identities: they are raw tones, and only roles change
 * with the scheme or the identity.
 *
 * @param theme - The theme. Its identity does not change the ramps.
 * @returns Every ramp token with its `oklch()` literal.
 */
export function brandRampLayer(theme: ThemeInput): BrandRampTokens {
  const seed = brandSeed(theme.brand, theme.segment);
  return brandRampTokens({ neutral: { hue: seed.h, chroma: BRAND_NEUTRAL_CHROMA } });
}
