import type { ColorSchemeOptions, Density, ThemeInput } from "@elmeragroup/fuse/theme";

export const DOCUMENT_THEME = {
  identity: "neutral",
  brand: "elma",
  segment: "private",
} as const satisfies ThemeInput;

/** The fixture's document density: dense, as an internal tool on the neutral identity deploys. */
export const DOCUMENT_DENSITY = "dense" as const satisfies Density;

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
