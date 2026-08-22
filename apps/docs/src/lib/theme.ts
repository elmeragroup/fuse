import { BRAND_CODES, BRANDS, coerceTheme, isBrandCode } from "@elmeragroup/ui/theme";
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

export const THEME_BRANDS = BRAND_CODES;

export const THEME_SEGMENTS = ["private", "company"] as const satisfies readonly ThemeSegment[];

/**
 * The 20 legal theme permutations, in variant → brand → segment order.
 *
 * Built from the library's own pin table rather than a list written here, so a brand
 * that gains or loses a segment changes this set without an edit. `coerceTheme` is what
 * narrows each candidate — the four illegal permutations return `null` and never enter
 * the array, so the matrix cannot render one.
 */
export const LEGAL_THEMES: readonly ThemeInput[] = THEME_VARIANTS.flatMap((variant) =>
  THEME_BRANDS.flatMap((brand) =>
    BRANDS[brand].segments
      .map((segment) => coerceTheme({ variant, brand, segment }))
      .filter((theme): theme is ThemeInput => theme !== null)
  )
);

export function parseThemeVariant(value: string): ThemeVariant | null {
  if (value === "internal" || value === "external") {
    return value;
  }
  return null;
}

export function parseThemeBrand(value: string): BrandCode | null {
  return isBrandCode(value) ? value : null;
}

export function parseThemeSegment(value: string): ThemeSegment | null {
  if (value === "private" || value === "company") {
    return value;
  }
  return null;
}
