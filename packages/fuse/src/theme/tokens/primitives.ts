import type { TokenPaint } from "./contract";
import { BRANDS } from "./themes";
import type { BrandCode } from "./themes";

export const WHITE = "oklch(1 0 0)";

/**
 * The focus ring's default colour in every theme and both colour schemes: one neutral grey.
 * Status Toasts and the warning and info Alerts rebind `--ring` on their soft fills. Lightness 0.6 meets
 * the 3:1 floor on every gated light and dark surface (page, card, card-soft and the muted Tabs
 * list track), the lowest measuring about 3.15:1 on the elma external dark muted track, so a
 * ring drawn flush against a control still separates from the surface around it.
 * `contrast-matrix.test.ts` holds that floor. `EXTERNAL_VARIANT_LAYER` describes how a brand
 * tunes its ring.
 */
export const NEUTRAL_RING = "oklch(0.6 0 0)";

export const PRIMITIVE_NAMES = [
  "neutral-50",
  "neutral-100",
  "neutral-200",
  "neutral-300",
  "neutral-400",
  "neutral-500",
  "neutral-600",
  "neutral-700",
  "neutral-800",
  "neutral-900",
  "neutral-950",
  "brand-fkas",
  "brand-fkas-foreground",
  "brand-tkas",
  "brand-tkas-foreground",
  "brand-guen",
  "brand-guen-foreground",
  "brand-fkab",
  "brand-fkab-foreground",
  "brand-fkse",
  "brand-fkse-foreground",
  "brand-elma",
  "brand-elma-foreground",
  "brand-ngfi",
  "brand-ngfi-foreground",
] as const;

export type PrimitiveName = (typeof PRIMITIVE_NAMES)[number];

export type PrimitiveTokens = {
  [Name in PrimitiveName]: string;
};

export const PRIMITIVES = {
  "neutral-50": "oklch(0.96 0 0)",
  "neutral-100": "oklch(0.91 0 0)",
  "neutral-200": "oklch(0.83 0 0)",
  "neutral-300": "oklch(0.74 0 0)",
  "neutral-400": "oklch(0.66 0 0)",
  "neutral-500": "oklch(0.57 0 0)",
  "neutral-600": "oklch(0.48 0 0)",
  "neutral-700": "oklch(0.40 0 0)",
  "neutral-800": "oklch(0.31 0 0)",
  "neutral-900": "oklch(0.23 0 0)",
  "neutral-950": "oklch(0.16 0 0)",
  "brand-fkas": "oklch(0.68 0.21747 38.8)",
  "brand-fkas-foreground": WHITE,
  "brand-tkas": "oklch(0.86 0.1035 191.11)",
  "brand-tkas-foreground": WHITE,
  "brand-guen": "oklch(0.21 0.0399 265.73)",
  "brand-guen-foreground": WHITE,
  "brand-fkab": "var(--brand-fkas)",
  "brand-fkab-foreground": WHITE,
  "brand-fkse": "oklch(0.4816 0.0908 240.16)",
  "brand-fkse-foreground": WHITE,
  "brand-elma": "oklch(0.28898 0.051828 217.7)",
  "brand-elma-foreground": WHITE,
  // Nordic Green Energy light primary #004B39, from the NGE Material 3 scheme (Figma file
  // q1sEYcZWmf1HUeuiaJFqm6, section 129:12419).
  "brand-ngfi": "oklch(0.3671893 0.072708 169.9789644)",
  "brand-ngfi-foreground": WHITE,
} as const satisfies PrimitiveTokens;

/**
 * Where each primitive is painted. The neutral ramp paints nothing: it holds one value in every
 * theme and scheme, so a part painted with it breaks dark mode and brand switching, and
 * `elmera/no-primitive-colors` bans it in Fuse and the docs. It stays a public alias target. A
 * brand accent fills an area, and its foreground colors text and icons on that fill, as in
 * cross-brand artwork that `bg-brand-fkas` draws.
 */
export const PRIMITIVE_PAINTS = {
  "neutral-50": [],
  "neutral-100": [],
  "neutral-200": [],
  "neutral-300": [],
  "neutral-400": [],
  "neutral-500": [],
  "neutral-600": [],
  "neutral-700": [],
  "neutral-800": [],
  "neutral-900": [],
  "neutral-950": [],
  "brand-fkas": ["surface"],
  "brand-fkas-foreground": ["ink"],
  "brand-tkas": ["surface"],
  "brand-tkas-foreground": ["ink"],
  "brand-guen": ["surface"],
  "brand-guen-foreground": ["ink"],
  "brand-fkab": ["surface"],
  "brand-fkab-foreground": ["ink"],
  "brand-fkse": ["surface"],
  "brand-fkse-foreground": ["ink"],
  "brand-elma": ["surface"],
  "brand-elma-foreground": ["ink"],
  "brand-ngfi": ["surface"],
  "brand-ngfi-foreground": ["ink"],
} as const satisfies Record<PrimitiveName, readonly TokenPaint[]>;

/** The description of one step of the neutral ramp. */
function neutralStep(step: number): string {
  return `Step ${String(step)} of the neutral ramp, where 50 is lightest. It holds one value in every theme and scheme, so bind a role token instead.`;
}

/** The description of a brand's accent. */
function brandAccent(code: BrandCode): string {
  return `The ${BRANDS[code].displayName} brand accent, the same in every theme. Use it for artwork of that brand, and use brand to follow the theme.`;
}

/** The description of the text color on a brand's accent. */
function brandAccentForeground(code: BrandCode): string {
  return `Text and icons on the ${BRANDS[code].displayName} brand accent. Use brand-foreground to follow the theme.`;
}

/**
 * What each primitive is for, in one or two sentences for a designer picking a variable. A new
 * primitive without one fails to compile.
 */
export const PRIMITIVE_DESCRIPTIONS = {
  "neutral-50": neutralStep(50),
  "neutral-100": neutralStep(100),
  "neutral-200": neutralStep(200),
  "neutral-300": neutralStep(300),
  "neutral-400": neutralStep(400),
  "neutral-500": neutralStep(500),
  "neutral-600": neutralStep(600),
  "neutral-700": neutralStep(700),
  "neutral-800": neutralStep(800),
  "neutral-900": neutralStep(900),
  "neutral-950": neutralStep(950),
  "brand-fkas": brandAccent("fkas"),
  "brand-fkas-foreground": brandAccentForeground("fkas"),
  "brand-tkas": brandAccent("tkas"),
  "brand-tkas-foreground": brandAccentForeground("tkas"),
  "brand-guen": brandAccent("guen"),
  "brand-guen-foreground": brandAccentForeground("guen"),
  "brand-fkab": `${brandAccent("fkab")} It aliases brand-fkas, because Fjordkraft Företag shares the Fjordkraft identity.`,
  "brand-fkab-foreground": brandAccentForeground("fkab"),
  "brand-fkse": brandAccent("fkse"),
  "brand-fkse-foreground": brandAccentForeground("fkse"),
  "brand-elma": brandAccent("elma"),
  "brand-elma-foreground": brandAccentForeground("elma"),
  "brand-ngfi": brandAccent("ngfi"),
  "brand-ngfi-foreground": brandAccentForeground("ngfi"),
} as const satisfies Record<PrimitiveName, string>;
