import { defaultDensityForVariant } from "@elmeragroup/fuse/theme";
import type { Density, ThemeInput } from "@elmeragroup/fuse/theme";

/** The coordinate the landing paints on first load, before a brand is picked. */
export const LANDING_THEME = {
  variant: "external",
  brand: "elma",
  segment: "private",
} as const satisfies ThemeInput;

/** The density the landing deploys, the library's default for its variant. */
export const LANDING_DENSITY: Density = defaultDensityForVariant(LANDING_THEME.variant);
