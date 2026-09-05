import type { ColorSchemeOptions, ThemeInput } from "@elmeragroup/ui/theme";

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

export const FORCED_DARK_COLOR_SCHEME = {
  storageKey: DOCUMENT_COLOR_SCHEME.storageKey,
  defaultColorScheme: DOCUMENT_COLOR_SCHEME.defaultColorScheme,
  enableSystem: DOCUMENT_COLOR_SCHEME.enableSystem,
  forcedColorScheme: "dark",
} as const satisfies ColorSchemeOptions;
