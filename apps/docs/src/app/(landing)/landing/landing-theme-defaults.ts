import type { Density, ThemeInput } from "@elmeragroup/fuse/theme";

/** The coordinate the landing paints on first load, before a brand is picked. */
export const LANDING_THEME = {
  variant: "external",
  brand: "elma",
  segment: "private",
} as const satisfies ThemeInput;

export const LANDING_DENSITY: Density = "comfortable";
