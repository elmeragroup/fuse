/**
 * The brand ramps: eleven-step tone scales, `brand-<scale>-50` to `brand-<scale>-950`, 50 the
 * lightest. A ramp is a palette of raw tones, not a role. Roles point at its steps, such as
 * `--muted: var(--brand-neutral-100)`, so one table explains which tone a theme paints where.
 *
 * A theme carries two kinds of ramp. The brand neutral ramp, scale `neutral`, is a grey tinted
 * with the brand hue. The brand palettes, scales `1` and `2` in {@link HUE_SCALES}, carry the
 * brand's own colours: palette 1 the brand colour, palette 2 a second brand colour where the
 * brand curates one, otherwise an alias of palette 1 step for step.
 *
 * Every ramp is a function of a hue and a chroma and shares one lightness per step,
 * {@link RAMP_LIGHTNESS}, so a step sits at roughly the same place in every brand and scale.
 * Equal lightness is not equal contrast, since luminance also follows hue and chroma, so a real
 * foreground and background pair is still measured, as `contrast-matrix.test.ts` does. `@elmeragroup/color` maps each step into sRGB by lowering its
 * chroma, which keeps the step's lightness and hue, and writes it as an `oklch()` literal.
 *
 * A brand palette is built from a seed, a curated colour literal, and passes through it: the
 * step whose lightness is nearest the seed's holds the seed itself, unchanged, so a role that
 * points at that step paints the curated colour exactly. Every other step sits on the shared
 * lightness table at the seed's hue and chroma, or, where sRGB holds less chroma at the step's
 * lightness, as much as sRGB holds: no curve is invented.
 *
 * The module owns the ramp contract entries too, built from one record, so the contract
 * spreads them and a new scale adds its tokens, kinds, paints and descriptions in one place.
 * Which hue and chroma a theme's ramps take is `brand-ramp-layer.ts`'s concern.
 */

import * as Oklch from "@elmeragroup/color/oklch";
import { getOrThrow } from "@elmeragroup/color/result";

import { tokenOklch } from "../token-color";

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

/**
 * The OKLCH lightness of every step, shared by every ramp. The light end sits on the tones the
 * neutral roles had before they pointed at the ramp, so a branded theme's roles change hue, not
 * value: 50 is the sidebar and right panel, 100 the muted and accent fills, 200 the field edge
 * and the sidebar's hover fill and border, and 300 the hairline. 100 sits between muted's former
 * 0.97 and accent's 0.96, as light as a highlighted menu row's 1.1:1 on the white popover allows.
 * 300 is darker than the 0.92 the other lines take, because the hairline must hold 1.19:1 on the
 * darkest brand page tint. From 400 the steps follow Tailwind's neutral scale, down to 950 at the
 * 0.16 of `--neutral-950`. `contrast-matrix.test.ts` holds those floors.
 */
export const RAMP_LIGHTNESS = {
  "50": 0.985,
  "100": 0.965,
  "200": 0.92,
  "300": 0.88,
  "400": 0.71,
  "500": 0.556,
  "600": 0.44,
  "700": 0.37,
  "800": 0.27,
  "900": 0.205,
  "950": 0.16,
} as const satisfies Record<RampStep, number>;

/**
 * The brand palettes, the hue ramps a theme carries: `1` is the brand colour and `2` a second
 * brand colour. No brand curates a third colour, so there is no `3`: adding one is this entry,
 * its seeds in `brand-ramp-layer.ts` and its `--color-brand-N-*` utilities in `fuse.css`, and the
 * contract tokens and exporters follow.
 */
export const HUE_SCALES = ["1", "2"] as const;

/**
 * The ramp scales a theme carries: `neutral`, a grey tinted with the brand hue, then the brand
 * palettes.
 */
export const RAMP_SCALES = ["neutral", ...HUE_SCALES] as const;

/** A ramp's scale, such as `neutral`. */
export type RampScale = (typeof RAMP_SCALES)[number];

/** A ramp token, such as `brand-neutral-100`. */
export type BrandRampTokenName = `brand-${RampScale}-${RampStep}`;

/** One value per ramp token. */
type BrandRampRecord<Value> = { readonly [Name in BrandRampTokenName]: Value };

/**
 * The token of one ramp step.
 *
 * @param scale - The ramp's scale.
 * @param step - The step.
 * @returns The token name, such as `brand-neutral-100`.
 */
function brandRampTokenName(scale: RampScale, step: RampStep): BrandRampTokenName {
  return `brand-${scale}-${step}`;
}

/**
 * Every ramp token with its scale and step, in token order: each scale in {@link RAMP_SCALES}
 * order, each lightest first.
 */
const RAMP_TOKEN_PARTS = RAMP_SCALES.flatMap((scale) =>
  RAMP_STEPS.map((step) => ({ name: brandRampTokenName(scale, step), scale, step }))
);

/**
 * One entry per ramp token, in token order.
 *
 * @template Value - The entry type.
 * @param at - The entry of the token at a scale and step.
 * @returns The entries, keyed by token name.
 */
function brandRampRecord<Value>(at: (scale: RampScale, step: RampStep) => Value): BrandRampRecord<Value> {
  // SAFETY: RAMP_TOKEN_PARTS holds every scale at every step, which is exactly the set of
  // BrandRampTokenName keys. Object.fromEntries cannot type the template-literal keys.
  return Object.fromEntries(
    RAMP_TOKEN_PARTS.map(({ name, scale, step }) => [name, at(scale, step)])
  ) as BrandRampRecord<Value>;
}

/** Every ramp token, in token order. */
export const BRAND_RAMP_TOKEN_NAMES: readonly BrandRampTokenName[] = RAMP_TOKEN_PARTS.map(({ name }) => name);

/** The ramp tokens' entries in the contract's `TOKEN_KINDS`: every step is a color. */
export const BRAND_RAMP_KINDS = brandRampRecord(() => "color" as const);

/**
 * The ramp tokens' entries in the contract's `TOKEN_PAINTS`. A ramp is a set of general-purpose
 * tones a product picks from, so every paint offers its steps.
 */
export const BRAND_RAMP_PAINTS = brandRampRecord(() => ["surface", "ink", "line"] as const);

/** How a ramp token's description names its ramp. */
const RAMP_SCALE_DESCRIPTIONS = {
  neutral: "brand neutral ramp, a grey tinted with the brand hue",
  "1": "brand palette 1, the brand colour",
  "2": "brand palette 2, the second colour of a two-colour brand, or an alias of palette 1 in a single-colour brand",
} as const satisfies Record<RampScale, string>;

/** The ramp tokens' entries in the contract's `TOKEN_DESCRIPTIONS`. */
export const BRAND_RAMP_DESCRIPTIONS = brandRampRecord((scale, step) => {
  const end = step === "50" ? ", the lightest step" : step === "950" ? ", the darkest step" : "";
  return `Step ${step} of the ${RAMP_SCALE_DESCRIPTIONS[scale]}${end}. It holds one value per brand and segment in both color schemes and identities, and every ramp shares its lightness positions, so a step lines up roughly across brands. Measure the contrast of a real text and surface pair.`;
});

/** Every ramp token with its value. */
export type BrandRampTokens = BrandRampRecord<string>;

/** The hue and chroma one ramp scale is built from. */
export type RampTint = {
  readonly _tag: "tint";

  /** The OKLCH hue in degrees. */
  readonly hue: number;

  /** The OKLCH chroma before gamut mapping. */
  readonly chroma: number;
};

/**
 * A ramp scale that points at another scale step for step, as a single-colour brand's palette 2
 * points at its palette 1. The steps are `var()` aliases, so overriding a step of the target
 * moves the alias too.
 */
export type RampAlias = {
  readonly _tag: "alias";

  /** The scale every step points at. */
  readonly of: RampScale;
};

/**
 * A brand palette's seed: a curated colour literal. The palette passes through it at the step
 * whose lightness is nearest the seed's, and every other step takes the seed's hue and chroma at
 * its own lightness from {@link RAMP_LIGHTNESS}.
 */
export type RampSeed = {
  readonly _tag: "seed";

  /** The curated `oklch()` literal, emitted unchanged at its step. */
  readonly literal: string;
};

/** Where one ramp scale's steps come from. */
export type RampSource = RampTint | RampSeed | RampAlias;

/**
 * One step of a ramp: the step's lightness at the tint, mapped into sRGB by lowering chroma.
 *
 * @param tint - The ramp's hue and chroma.
 * @param step - The step.
 * @returns The step as an `oklch()` literal.
 */
function rampTone(tint: RampTint, step: RampStep): string {
  const color = getOrThrow(Oklch.make({ l: RAMP_LIGHTNESS[step], c: tint.chroma, h: tint.hue, alpha: 1 }));
  return Oklch.format(Oklch.clampChromaToSrgb(color));
}

/**
 * The step whose lightness is nearest a colour's. The seed it holds lies closer to that step's
 * lightness than to either neighbour's, so the ramp still darkens at every step.
 *
 * @param lightness - The OKLCH lightness.
 * @returns The nearest step.
 */
function nearestStep(lightness: number): RampStep {
  const distance = (step: RampStep): number => Math.abs(RAMP_LIGHTNESS[step] - lightness);
  return RAMP_STEPS.reduce((nearest, step) => (distance(step) < distance(nearest) ? step : nearest));
}

/**
 * One step of a seeded palette: the seed literal itself at its nearest step, otherwise the
 * seed's hue and chroma at the step's lightness, gamut-mapped as {@link rampTone} does.
 *
 * @param seed - The palette's seed.
 * @param step - The step.
 * @returns The step as an `oklch()` literal.
 */
function seededTone(seed: RampSeed, step: RampStep): string {
  const color = tokenOklch(seed.literal);
  if (step === nearestStep(color.l)) return seed.literal;
  return rampTone({ _tag: "tint", hue: color.h, chroma: color.c }, step);
}

/**
 * Every ramp token, each scale built from its source.
 *
 * @param sources - The tint or seed of each scale, or the scale it aliases.
 * @returns The ramp tokens with their `oklch()` literals or `var()` aliases.
 */
export function brandRampTokens(sources: { readonly [S in RampScale]: RampSource }): BrandRampTokens {
  return brandRampRecord((scale, step) => {
    const source = sources[scale];
    switch (source._tag) {
      case "tint":
        return rampTone(source, step);
      case "seed":
        return seededTone(source, step);
      case "alias":
        return brandRampStep(source.of, step);
    }
  });
}

/** An untinted grey. */
const GREY: RampTint = { _tag: "tint", hue: 0, chroma: 0 };

/**
 * The untinted ramps the root declares, so a scope without a brand reads a grey at every step of
 * every scale. They share the lightness table with every brand's ramps.
 */
export const GREY_RAMP_TOKENS: BrandRampTokens = brandRampRecord((_scale, step) => rampTone(GREY, step));

/**
 * A `var()` of one ramp step, the value a role takes to point at it.
 *
 * @param scale - The ramp's scale.
 * @param step - The step.
 * @returns The reference, such as `var(--brand-neutral-100)`.
 */
export function brandRampStep<S extends RampScale, T extends RampStep>(
  scale: S,
  step: T
): `var(--brand-${S}-${T})` {
  return `var(--brand-${scale}-${step})`;
}
