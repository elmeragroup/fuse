import type { ColorSchemeOptions, Density, ThemeInput } from "@elmeragroup/fuse/theme";

/** The theme of the whole document: Fjordkraft's private customers, branded. */
export const THEME = { identity: "branded", brand: "fkas", segment: "private" } as const satisfies ThemeInput;

/** The density of the whole document. */
export const DENSITY = "comfortable" as const satisfies Density;

/** The color scheme options the bootstrap script and the provider share. */
export const COLOR_SCHEME = {
  storageKey: "color-scheme",
  defaultColorScheme: "system",
  enableSystem: true,
} as const satisfies ColorSchemeOptions;
