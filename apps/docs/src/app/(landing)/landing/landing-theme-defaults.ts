import { parseThemeSlug, themeSlug } from "@elmeragroup/fuse/theme";
import type { Density, ThemeInput } from "@elmeragroup/fuse/theme";

import { docsDensityFor, OPENING_THEME } from "../../../lib/theme";
import { THEME_QUERY } from "../../../lib/theme-address";

/**
 * The density the landing deploys, the docs site's density for its opening identity. It stays put
 * when a visitor picks the neutral identity: hosts own density (AGENTS.md), and a density change
 * would reflow the page under the visitor's cursor.
 */
export const LANDING_DENSITY: Density = docsDensityFor(OPENING_THEME);

/** True when both themes name the same identity, brand and segment. */
export function sameTheme(left: ThemeInput, right: ThemeInput): boolean {
  return themeSlug(left) === themeSlug(right);
}

/**
 * The theme a slug names, read with Fuse's own slug parser so only a legal theme gets through. A
 * missing or illegal slug opens on `OPENING_THEME`.
 *
 * @param value - A theme slug, such as the themed route's `theme` param.
 * @returns The theme to render.
 */
export function parseThemeParam(value: string | undefined): ThemeInput {
  if (value === undefined) {
    return OPENING_THEME;
  }
  return parseThemeSlug(value) ?? OPENING_THEME;
}

/**
 * The theme a shared address names. Exactly one `theme` value parses through Fuse's slug parser;
 * none, several, or an illegal value opens on `OPENING_THEME`.
 *
 * @param params - The address's search parameters.
 * @returns The theme to render.
 */
export function parseThemeSearch(params: URLSearchParams): ThemeInput {
  const values = params.getAll(THEME_QUERY);
  return values.length === 1 ? parseThemeParam(values[0]) : OPENING_THEME;
}
