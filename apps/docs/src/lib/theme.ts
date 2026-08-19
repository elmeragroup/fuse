import type {
  BrandCode,
  ColorSchemeOptions,
  ThemeInput,
  ThemeSegment,
  ThemeVariant,
} from "@elmeragroup/ui/theme";

export const DOCUMENT_THEME = {
  variant: "internal",
  brand: "elma",
  segment: "private",
} as const satisfies ThemeInput;

export const DOCUMENT_COLOR_SCHEME = {
  storageKey: "elmera-color-scheme",
  defaultColorScheme: "system",
  enableSystem: true,
} as const satisfies ColorSchemeOptions;

export const DEFAULT_THEME = {
  variant: "internal",
  brand: "fkas",
  segment: "private",
} as const satisfies ThemeInput;

export const THEME_VARIANTS = ["internal", "external"] as const satisfies readonly ThemeVariant[];

export const THEME_BRANDS = [
  "fkas",
  "tkas",
  "guen",
  "fkab",
  "fkse",
  "elma",
] as const satisfies readonly BrandCode[];

export const THEME_SEGMENTS = ["private", "company"] as const satisfies readonly ThemeSegment[];

export function parseThemeVariant(value: string): ThemeVariant | null {
  if (value === "internal" || value === "external") {
    return value;
  }
  return null;
}

export function parseThemeBrand(value: string): BrandCode | null {
  if (
    value === "fkas" ||
    value === "tkas" ||
    value === "guen" ||
    value === "fkab" ||
    value === "fkse" ||
    value === "elma"
  ) {
    return value;
  }
  return null;
}

export function parseThemeSegment(value: string): ThemeSegment | null {
  if (value === "private" || value === "company") {
    return value;
  }
  return null;
}

export function themeFromAxes(variant: ThemeVariant, brand: BrandCode, segment: ThemeSegment): ThemeInput {
  if (brand === "fkab") {
    return { variant, brand, segment: "company" };
  }
  if (brand === "fkse") {
    return { variant, brand, segment: "private" };
  }
  return { variant, brand, segment };
}
