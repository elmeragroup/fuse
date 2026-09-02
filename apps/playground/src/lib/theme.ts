import { BRAND_CODES, BRANDS, coerceTheme, parseThemeSlug, themeSlug } from "@elmeragroup/ui/theme";
import type { ThemeInput, ThemeSegment, ThemeSlug, ThemeVariant } from "@elmeragroup/ui/theme";

/** The coordinate the server renders `<html>` with; the switcher starts here. */
export const DEFAULT_THEME = {
  variant: "internal",
  brand: "fkas",
  segment: "private",
} as const satisfies ThemeInput;

export const COLOR_SCHEME = {
  storageKey: "elmera-playground-color-scheme",
  defaultColorScheme: "system",
  enableSystem: true,
} as const;

const THEME_VARIANTS = ["internal", "external"] as const satisfies readonly ThemeVariant[];

/**
 * The 20 legal theme permutations, in variant → brand → segment order — the same
 * derivation `apps/docs/src/lib/theme.ts` uses. Built from the library's own pin table
 * rather than a list written here, so a brand that gains or loses a segment changes this
 * set without an edit. `coerceTheme` narrows each candidate: the illegal permutations
 * return `null` and never enter the array, so the switcher cannot offer one.
 */
export const LEGAL_THEMES: readonly ThemeInput[] = THEME_VARIANTS.flatMap((variant) =>
  BRAND_CODES.flatMap((brand) =>
    BRANDS[brand].segments
      .map((segment: ThemeSegment) => coerceTheme({ variant, brand, segment }))
      .filter((theme): theme is ThemeInput => theme !== null)
  )
);

export const LEGAL_THEME_SLUGS: readonly ThemeSlug[] = LEGAL_THEMES.map((theme) => themeSlug(theme));

/** `null` for anything that is not one of the 20 legal slugs. */
export function themeFromSlug(value: string): ThemeInput | null {
  const parsed = parseThemeSlug(value);
  if (parsed === null) {
    return null;
  }
  return coerceTheme(parsed);
}
