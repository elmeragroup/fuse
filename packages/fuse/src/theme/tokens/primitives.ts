export const WHITE = "oklch(1 0 0)";

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
} as const satisfies PrimitiveTokens;
