import { coerceTheme, LEGAL_THEMES, parseThemeSlug, themeSlug } from "@elmeragroup/ui/theme";
import type { ThemeInput, ThemeSlug } from "@elmeragroup/ui/theme";

export { LEGAL_THEMES };

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

export const LEGAL_THEME_SLUGS: readonly ThemeSlug[] = LEGAL_THEMES.map((theme) => themeSlug(theme));

/** `null` for anything that is not one of the 20 legal slugs. */
export function themeFromSlug(value: string): ThemeInput | null {
  const parsed = parseThemeSlug(value);
  if (parsed === null) {
    return null;
  }
  return coerceTheme(parsed);
}
