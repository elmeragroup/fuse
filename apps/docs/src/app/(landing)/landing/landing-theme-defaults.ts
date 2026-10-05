import { defaultDensityForVariant, parseThemeSlug } from "@elmeragroup/fuse/theme";
import type { Density, ThemeInput } from "@elmeragroup/fuse/theme";

/** The coordinate the landing paints on first load, before a visitor picks a theme. */
export const LANDING_THEME = {
  variant: "external",
  brand: "elma",
  segment: "private",
} as const satisfies ThemeInput;

/**
 * The density the landing deploys, the library's default for its opening variant. It stays put
 * when a visitor picks the internal variant: hosts own density (AGENTS.md), and a density change
 * would reflow the page under the visitor's cursor.
 */
export const LANDING_DENSITY: Density = defaultDensityForVariant(LANDING_THEME.variant);

/** The search parameter that carries a shared theme, as Fuse's slug: `internal-fkas-company`. */
export const THEME_QUERY = "theme";

/** True when both themes name the same variant, brand and segment. */
export function sameTheme(left: ThemeInput, right: ThemeInput): boolean {
  return left.variant === right.variant && left.brand === right.brand && left.segment === right.segment;
}

/**
 * The theme a shared address names, read with Fuse's own slug parser so only a legal theme gets
 * through. A missing, repeated or illegal value opens on `LANDING_THEME`.
 *
 * @param value - The raw `theme` search parameter.
 * @returns The theme to render.
 */
export function parseThemeQuery(value: string | string[] | undefined): ThemeInput {
  if (value === undefined || Array.isArray(value)) {
    return LANDING_THEME;
  }
  return parseThemeSlug(value) ?? LANDING_THEME;
}
