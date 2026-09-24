/**
 * The `/api/themes` catalog builder.
 *
 * Reads the resolved catalog through the workspace-only `@elmeragroup/fuse/theme-catalog`
 * tooling entry — Node generate cannot load `/theme` because that facade re-exports client TSX.
 */

import type { ResolvedThemeCatalog } from "@elmeragroup/fuse/theme-catalog";

import type { ThemeCatalog, ThemeCatalogEntry, ThemeCatalogTokenMap } from "../../src/lib/docs-model.ts";

/** Each entry's declared CSS under its `--name` key, in the record's own order. */
function cssCustomProperties(entries: {
  readonly [name: string]: { readonly name: string; readonly css: string };
}): ThemeCatalogTokenMap {
  return Object.fromEntries(Object.values(entries).map((entry) => [`--${entry.name}`, entry.css]));
}

/**
 * Twenty legal themes; density locked to variant; values are the light scheme's CSS as
 * `composeTheme` declares it.
 *
 * @param catalog - The resolved theme catalog.
 * @returns The `/api/themes` payload.
 */
export function buildThemeCatalog(catalog: ResolvedThemeCatalog): ThemeCatalog {
  const themes = catalog.themes.map((theme): ThemeCatalogEntry => ({
    slug: theme.slug,
    variant: theme.input.variant,
    brand: theme.input.brand,
    segment: theme.input.segment,
    density: theme.defaultDensity,
    attributes: theme.attributes,
    tokens: cssCustomProperties(theme.schemes.light.tokens),
  }));
  return {
    legalThemeCount: themes.length,
    themes,
    primitives: cssCustomProperties(catalog.primitives),
  };
}

/** The generated module the `/api/themes` route imports. */
export function renderThemeCatalog(catalog: ThemeCatalog): string {
  return `import type { ThemeCatalog } from "../lib/docs-model";

/** Twenty legal themes with CSS-honest token values. */
export const THEME_CATALOG: ThemeCatalog = ${JSON.stringify(catalog, null, 2)};
`;
}
