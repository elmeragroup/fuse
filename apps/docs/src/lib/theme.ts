import type {
  ColorScheme,
  ColorSchemeOptions,
  ThemeInput,
  ThemeSegment,
  ThemeVariant,
} from "@elmeragroup/fuse/theme";

export {
  BRAND_CODES as THEME_BRANDS,
  COLOR_SCHEMES,
  LEGAL_THEMES,
  THEME_SEGMENTS,
  THEME_VARIANTS,
} from "@elmeragroup/fuse/theme";

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

export const COLOR_SCHEME_LABELS = {
  light: "Light",
  dark: "Dark",
  system: "System",
} satisfies Record<ColorScheme, string>;

/** Display labels for the theme-variant axis. */
export const VARIANT_LABELS = {
  internal: "Internal",
  external: "External",
} satisfies Record<ThemeVariant, string>;

/** Display labels for the theme-segment axis. */
export const SEGMENT_LABELS = {
  private: "Private",
  company: "Company",
} satisfies Record<ThemeSegment, string>;
