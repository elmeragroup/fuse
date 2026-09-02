import { isBrandCode } from "@elmeragroup/ui/theme";
import type {
  BrandCode,
  ColorSchemeOptions,
  ThemeInput,
  ThemeSegment,
  ThemeVariant,
} from "@elmeragroup/ui/theme";

export {
  BRAND_CODES as THEME_BRANDS,
  LEGAL_THEMES,
  THEME_SEGMENTS,
  THEME_VARIANTS,
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
