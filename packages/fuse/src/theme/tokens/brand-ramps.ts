/**
 * The brand ramps: two eleven-step scales per brand, `brand-neutral-{50…950}` and
 * `brand-shade-{50…950}`, from near-white at 50 to near-black at 950. A theme resolves them by
 * its brand and segment, as a mode of the Figma brand collection does. They hold the same values
 * in both color schemes and both variants, because that collection has neither axis.
 *
 * Five ramps come from Figma. Elmera and Nordic Green Energy have none there, so
 * `scripts/brand-ramp-recipe.ts` generates theirs from the brand primitive. These literals are
 * now the source, and Figma follows them.
 */

import { paletteBrand } from "./external-palettes";
import { BRAND_CODES } from "./themes";
import type { BrandCode, ThemeSegment } from "./themes";

/** The eleven steps of a ramp, lightest first. */
export const RAMP_STEPS = [
  "50",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
  "950",
] as const;

/** One step of a ramp, such as `500`. */
export type RampStep = (typeof RAMP_STEPS)[number];

/** The two scales of a brand: a tinted neutral and the brand hue. */
export const RAMP_SCALES = ["neutral", "shade"] as const;

/** A ramp's scale: `neutral` or `shade`. */
export type RampScale = (typeof RAMP_SCALES)[number];

/** One scale's color at every step: a `#RRGGBB` literal, or a `var()` of the brand primitive. */
export type Ramp = { readonly [S in RampStep]: string };

/** A brand's two ramps. */
export type BrandRamps = { readonly [S in RampScale]: Ramp };

/** Where a brand's ramps come from: the Figma brand collection, or the generation recipe. */
export type RampOrigin = "figma" | "generated";

/**
 * The ramps read from the Figma file "Elmera - Core" (FZJPeVrkpI4Nq9MWyy6ex4), local variable
 * collection `brand`, variables `brand-neutrals/*` and `brand-shades/*` resolved through the raw
 * colors `brands/<brand>/{neutrals,shades}/*`, on 2026-11-03. One entry per mode of the
 * collection, with the mode's hex values exactly.
 */
export const FIGMA_BRAND_RAMPS = {
  // Mode "Fjordkraft".
  fjordkraft: {
    neutral: {
      "50": "#FFF8F6",
      "100": "#FFEEE6",
      "200": "#EDE0DC",
      "300": "#D0C4C0",
      "400": "#B4A9A6",
      "500": "#998E8B",
      "600": "#7F7572",
      "700": "#655C5A",
      "800": "#4D4543",
      "900": "#2B2422",
      "950": "#15100E",
    },
    shade: {
      "50": "#FFF7F2",
      "100": "#FFEEE6",
      "200": "#F8D0BA",
      "300": "#F5AA81",
      "400": "#FA9868",
      "500": "#FF712B",
      "600": "#FF5500",
      "700": "#A82C00",
      "800": "#7C1A00",
      "900": "#5C1900",
      "950": "#390C00",
    },
  },
  // Mode "Bedrift".
  bedrift: {
    neutral: {
      "50": "#FCFCFA",
      "100": "#F0F1EE",
      "200": "#E2E3E0",
      "300": "#C6C7C4",
      "400": "#AAABA9",
      "500": "#8F918F",
      "600": "#767775",
      "700": "#5D5F5D",
      "800": "#454746",
      "900": "#242625",
      "950": "#0F1110",
    },
    shade: {
      "50": "#EFFCFF",
      "100": "#D7F6FE",
      "200": "#B7EAFF",
      "300": "#9BD0E7",
      "400": "#7CB6CC",
      "500": "#5D96A5",
      "600": "#3E7E8E",
      "700": "#1F6677",
      "800": "#004E60",
      "900": "#17343B",
      "950": "#07272D",
    },
  },
  // Mode "Telinet".
  telinet: {
    neutral: {
      "50": "#F8FAFA",
      "100": "#EFF1F1",
      "200": "#E1E3E3",
      "300": "#C4C7C7",
      "400": "#A9ACAC",
      "500": "#8E9192",
      "600": "#747878",
      "700": "#5C5F5F",
      "800": "#444748",
      "900": "#232627",
      "950": "#0E1212",
    },
    shade: {
      "50": "#ECFCFF",
      "100": "#CDF1FF",
      "200": "#8FF2FF",
      "300": "#50D8E8",
      "400": "#2DC0D0",
      "500": "#3A9EBA",
      "600": "#2F81A3",
      "700": "#24648C",
      "800": "#174976",
      "900": "#0A416E",
      "950": "#001D36",
    },
  },
  // Mode "Trøndelagkraft".
  trondelagkraft: {
    neutral: {
      "50": "#FCFCFA",
      "100": "#F0F1EE",
      "200": "#E2E3E0",
      "300": "#C6C7C4",
      "400": "#AAABA9",
      "500": "#8F918F",
      "600": "#767775",
      "700": "#5D5F5D",
      "800": "#454746",
      "900": "#242625",
      "950": "#0F1110",
    },
    shade: {
      "50": "#E3FFFC",
      "100": "#B0FFFA",
      "200": "#90F3ED",
      "300": "#69D8D2",
      "400": "#4ABCB6",
      "500": "#24A19C",
      "600": "#008581",
      "700": "#006A66",
      "800": "#00504D",
      "900": "#003735",
      "950": "#00201F",
    },
  },
  // Mode "GE".
  ge: {
    neutral: {
      "50": "#FCFCFA",
      "100": "#F0F1EE",
      "200": "#E2E3E0",
      "300": "#C6C7C4",
      "400": "#AAABA9",
      "500": "#8F918F",
      "600": "#767775",
      "700": "#5D5F5D",
      "800": "#454746",
      "900": "#151C39",
      "950": "#0E1128",
    },
    shade: {
      "50": "#EDEFFD",
      "100": "#D4D8FE",
      "200": "#C3C9FE",
      "300": "#A5AFFE",
      "400": "#8796FE",
      "500": "#697DFE",
      "600": "#4B64FE",
      "700": "#3A3AEA",
      "800": "#000087",
      "900": "#05054B",
      "950": "#0C0F2C",
    },
  },
} as const satisfies Record<string, BrandRamps>;

/**
 * The ramps of the two brands with no Figma ramp, generated once by
 * `scripts/brand-ramp-recipe.ts` from the brand primitive and the Figma ramps, and committed as
 * literals. Each passes through its brand primitive at its anchor step, which names the primitive:
 * shade 900 for Elmera and shade 800 for Nordic Green Energy. `brand-ramps.test.ts` checks the
 * literals against the recipe.
 */
export const GENERATED_BRAND_RAMPS = {
  elma: {
    neutral: {
      "50": "#FAFCFD",
      "100": "#EEF1F2",
      "200": "#E0E3E4",
      "300": "#C4C7C8",
      "400": "#A9ABAC",
      "500": "#8E9192",
      "600": "#757778",
      "700": "#5C5F60",
      "800": "#454748",
      "900": "#232627",
      "950": "#0E1213",
    },
    shade: {
      "50": "#F2FAFD",
      "100": "#DDF2F8",
      "200": "#C1E6F1",
      "300": "#99CCDB",
      "400": "#7BB6C7",
      "500": "#6596A4",
      "600": "#527F8C",
      "700": "#3C6571",
      "800": "#214B57",
      "900": "var(--brand-elma)",
      "950": "#071F26",
    },
  },
  ngfi: {
    neutral: {
      "50": "#FAFCFC",
      "100": "#EEF1F0",
      "200": "#E0E3E2",
      "300": "#C4C7C6",
      "400": "#A9ABAA",
      "500": "#8E9190",
      "600": "#757776",
      "700": "#5C5F5E",
      "800": "#454746",
      "900": "#232625",
      "950": "#0E1211",
    },
    shade: {
      "50": "#F0FCF7",
      "100": "#D9F5EA",
      "200": "#B9ECD9",
      "300": "#8BD4BA",
      "400": "#6ABEA2",
      "500": "#569D86",
      "600": "#458570",
      "700": "#2E6B58",
      "800": "var(--brand-ngfi)",
      "900": "#00392A",
      "950": "#002218",
    },
  },
} as const satisfies Record<"elma" | "ngfi", BrandRamps>;

/** Each brand's ramp origin. */
type BrandRampOrigins = { readonly [Code in BrandCode]: RampOrigin };

/**
 * Where each brand's ramps come from, which the docs mark beside a generated ramp: a brand with
 * an entry in {@link GENERATED_BRAND_RAMPS} is generated, every other one reads Figma.
 */
export const BRAND_RAMP_ORIGINS: BrandRampOrigins =
  // SAFETY: the map writes one origin per brand code, which is exactly the set of BrandCode keys.
  Object.fromEntries(
    BRAND_CODES.map((code) => [code, Object.hasOwn(GENERATED_BRAND_RAMPS, code) ? "generated" : "figma"])
  ) as BrandRampOrigins;

/**
 * A theme's ramps, by brand and segment. Fjordkraft company reads the Bedrift mode, and so does
 * Fjordkraft Företag through its fkas alias, as they share the Bedrift sheets; every other brand
 * reads one ramp in both segments.
 *
 * @param brand - The theme's brand.
 * @param segment - The theme's segment.
 * @returns The brand's two ramps.
 */
function brandRamps(brand: BrandCode, segment: ThemeSegment): BrandRamps {
  switch (paletteBrand(brand)) {
    case "fkas":
      return segment === "company" ? FIGMA_BRAND_RAMPS.bedrift : FIGMA_BRAND_RAMPS.fjordkraft;
    case "fkse":
      return FIGMA_BRAND_RAMPS.telinet;
    case "tkas":
      return FIGMA_BRAND_RAMPS.trondelagkraft;
    case "guen":
      return FIGMA_BRAND_RAMPS.ge;
    case "elma":
      return GENERATED_BRAND_RAMPS.elma;
    case "ngfi":
      return GENERATED_BRAND_RAMPS.ngfi;
  }
}

/** A ramp token, such as `brand-shade-500`. */
export type BrandRampTokenName = `brand-${RampScale}-${RampStep}`;

/** One value per ramp token. */
type BrandRampRecord<Value> = { readonly [Name in BrandRampTokenName]: Value };

/**
 * One entry per ramp token, in token order: neutral first, each lightest first.
 *
 * @param at - The entry of the token at a scale and step.
 * @returns The 22 entries, keyed by token name.
 */
function brandRampRecord<Value>(at: (scale: RampScale, step: RampStep) => Value): BrandRampRecord<Value> {
  // SAFETY: the two loops write every scale at every step, which is exactly the set of
  // BrandRampTokenName keys. Object.fromEntries cannot type the template-literal keys.
  return Object.fromEntries(
    RAMP_SCALES.flatMap((scale) => RAMP_STEPS.map((step) => [`brand-${scale}-${step}`, at(scale, step)]))
  ) as BrandRampRecord<Value>;
}

/** Every ramp token, neutral first, each lightest first. */
export const BRAND_RAMP_TOKEN_NAMES: readonly BrandRampTokenName[] = RAMP_SCALES.flatMap((scale) =>
  RAMP_STEPS.map((step): BrandRampTokenName => `brand-${scale}-${step}`)
);

/** The ramp tokens' entries in the contract's `TOKEN_KINDS`: every step is a color. */
export const BRAND_RAMP_KINDS = brandRampRecord(() => "color" as const);

/**
 * The ramp tokens' entries in the contract's `TOKEN_PAINTS`. The ramps are general-purpose steps
 * a product picks from, so every paint offers them.
 */
export const BRAND_RAMP_PAINTS = brandRampRecord(() => ["surface", "ink", "line"] as const);

/** How a ramp token's description names its scale. */
const RAMP_SCALE_DESCRIPTIONS = {
  neutral: "a grey tinted with the brand hue",
  shade: "the brand hue from light to dark",
} as const satisfies Record<RampScale, string>;

/** The ramp tokens' entries in the contract's `TOKEN_DESCRIPTIONS`. */
export const BRAND_RAMP_DESCRIPTIONS = brandRampRecord((scale, step) => {
  const end =
    step === RAMP_STEPS[0] ? ", the lightest step" : step === RAMP_STEPS.at(-1) ? ", the darkest step" : "";
  return `Step ${step} of the theme brand ${scale} ramp, ${RAMP_SCALE_DESCRIPTIONS[scale]}${end}. It holds one value per brand and segment in both color schemes. Elmera and Nordic Green Energy ramps are generated from the brand color.`;
});

/** Every ramp token with its value. */
export type BrandRampTokens = BrandRampRecord<string>;

/**
 * A theme's ramp tokens, by brand and segment, as composition overlays them and the defaults
 * declare them.
 *
 * @param brand - The theme's brand.
 * @param segment - The theme's segment.
 * @returns The 22 ramp tokens with the brand's values.
 */
export function brandRampTokens(brand: BrandCode, segment: ThemeSegment): BrandRampTokens {
  const ramps = brandRamps(brand, segment);
  return brandRampRecord((scale, step) => ramps[scale][step]);
}
