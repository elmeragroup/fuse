/**
 * A theme's brand ramps, from the colours each brand and segment seeds them with. The brand seed
 * is read from the palette data, upstream of role assignment: the brand palette's `feature`,
 * overlaid by its segment delta's `feature` where one exists. It never reads a composed theme,
 * because the palettes point roles at the ramps the seed builds. It seeds the brand neutral ramp's
 * hue and brand palette 1.
 *
 * Each brand palette passes through its seed literal at the step nearest the seed's lightness
 * (`brand-ramps.ts`), so palette 1 holds the brand's `feature` exactly.
 *
 * Brand palette 2 takes a seed from {@link SECOND_BRAND_SEEDS} where the brand curates a second
 * colour, and otherwise aliases palette 1 step for step, so a role that points at palette 2 shows
 * the brand colour in a single-colour brand.
 *
 * `feature` seeds the ramps, so it stays a curated colour literal in every brand palette and
 * segment delta. An alias there would make the ramps depend on the roles they feed, so
 * {@link brandSeed} refuses one with a message that names the brand and segment.
 */

import { cssVarReference } from "../css-values";
import type { BrandCode, ThemeInput, ThemeSegment } from "../theme-input";
import { tokenOklch } from "../token-color";
import { GUEN_ORANGE } from "./brand-dark-palettes";
import { BRAND_PALETTES, paletteBrand } from "./brand-palettes";
import type { PaletteBrandCode } from "./brand-palettes";
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
 * @returns The seed colour, the curated `oklch()` literal.
 * @throws When the seed is a `var()` alias rather than a colour literal, a defect in the palettes.
 */
function brandSeed(brand: BrandCode, segment: ThemeSegment): string {
  const palette = paletteBrand(brand);
  const feature = segmentSheet(palette, segment)?.light.feature ?? BRAND_PALETTES[palette].feature;
  if (cssVarReference(feature) !== undefined) {
    throw new Error(
      `The ${brand} ${segment} feature seeds the brand ramps, so it must be a colour literal, not ${feature}.`
    );
  }
  return feature;
}

/**
 * The second colour of each brand that curates one, the seed of its brand palette 2. Each is a
 * tone the brand already paints, never an invented one. Gudbrandsdal Energi's orange is
 * {@link GUEN_ORANGE}, the constant its branded dark `secondary` paints. Telinet's green is its
 * branded light `feature-foreground`, but stays a literal here, because that role points at this
 * palette and cannot also seed it. Every other brand has one colour and is
 * `undefined`. A segment that needs its own second colour would overlay this table per segment,
 * as `feature` does.
 */
const SECOND_BRAND_SEEDS = {
  fkas: undefined,
  tkas: undefined,
  guen: GUEN_ORANGE,
  fkse: "oklch(0.72225 0.16251 154.25)", // #36C275, the Telinet green
  elma: undefined,
  ngfi: undefined,
} as const satisfies Record<PaletteBrandCode, string | undefined>;

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
  const second = SECOND_BRAND_SEEDS[paletteBrand(theme.brand)];
  return brandRampTokens({
    neutral: { _tag: "tint", hue: tokenOklch(seed).h, chroma: BRAND_NEUTRAL_CHROMA },
    "1": { _tag: "seed", literal: seed },
    "2": second === undefined ? { _tag: "alias", of: "1" } : { _tag: "seed", literal: second },
  });
}
