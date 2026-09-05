/**
 * The `/api/themes` catalog builder (docs-site.md §9).
 *
 * Imports through the workspace-only `@elmeragroup/ui/theme-catalog` tooling entry —
 * Node generate cannot load `/theme` because that facade re-exports client TSX.
 */

import {
  composeTheme,
  defaultDensityForVariant,
  densityAttributes,
  LEGAL_THEMES,
  PRIMITIVE_NAMES,
  PRIMITIVES,
  themeAttributes,
  themeSlug,
  TOKEN_NAMES,
} from "@elmeragroup/ui/theme-catalog";

import type { ThemeCatalog, ThemeCatalogEntry } from "../../src/lib/docs-model.ts";

export { TOKEN_NAMES };

type CssCustomProperties<Name extends string> = {
  [Key in Name as `--${Key}`]: string;
};

function cssCustomProperties<Name extends string>(
  names: readonly Name[],
  values: { readonly [Key in Name]: string }
): CssCustomProperties<Name> {
  // SAFETY: every `Name` is written as `--${Name}`; fromEntries cannot prove that remap.
  return Object.fromEntries(names.map((name) => [`--${name}`, values[name]])) as CssCustomProperties<Name>;
}

/** Twenty legal themes; density locked to variant; values are composeTheme CSS strings. */
export function buildThemeCatalog(): ThemeCatalog {
  const themes = LEGAL_THEMES.map((theme): ThemeCatalogEntry => {
    const density = defaultDensityForVariant(theme.variant);
    return {
      slug: themeSlug(theme),
      variant: theme.variant,
      brand: theme.brand,
      segment: theme.segment,
      density,
      attributes: {
        ...themeAttributes(theme),
        ...densityAttributes(density),
      },
      tokens: cssCustomProperties(TOKEN_NAMES, composeTheme(theme)),
    };
  });
  return {
    legalThemeCount: themes.length,
    themes,
    primitives: cssCustomProperties(PRIMITIVE_NAMES, PRIMITIVES),
  };
}

/** The generated module the `/api/themes` route imports. */
export function renderThemeCatalog(catalog: ThemeCatalog): string {
  return `import type { ThemeCatalog } from "../lib/docs-model";

/** Twenty legal themes with CSS-honest token values (docs-site.md §9.1). */
export const THEME_CATALOG: ThemeCatalog = ${JSON.stringify(catalog, null, 2)};
`;
}
