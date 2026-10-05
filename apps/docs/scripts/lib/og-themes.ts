/**
 * The theme values the Open Graph images paint, read from the resolved catalog so the images
 * never parse theme CSS. Satori reads neither `oklch()` nor custom properties, so each legal
 * theme's light scheme is emitted as sRGB channels and px: every color-kind and
 * dimension-kind role token, and the clamped radius rungs.
 */

import type { ResolvedThemeCatalog, TokenEntry, TokenKind } from "@elmeragroup/fuse/theme-catalog";

/** The role token names of one kind, in `TOKEN_NAMES` order. */
function namesOfKind(catalog: ResolvedThemeCatalog, kind: TokenKind): readonly string[] {
  const tokens: readonly TokenEntry[] = Object.values(catalog.themes[0].schemes.light.tokens);
  return tokens.filter((token) => token.kind === kind).map((token) => token.name);
}

/** A string-literal union of `names`. */
function union(names: readonly string[]): string {
  return names.map((name) => `\n  | ${JSON.stringify(name)}`).join("");
}

/** One theme's light-scheme values, each color on one line. */
function renderTheme(theme: ResolvedThemeCatalog["themes"][number]): string {
  const { tokens, rungs } = theme.schemes.light;
  const colors: string[] = [];
  const dimensions: string[] = [];
  for (const token of Object.values(tokens)) {
    if (token.kind === "color") {
      const { r, g, b, alpha } = token.value;
      colors.push(`      ${JSON.stringify(token.name)}: ${JSON.stringify({ r, g, b, alpha })},`);
    } else if (token.kind === "dimension") {
      dimensions.push(`      ${JSON.stringify(token.name)}: ${JSON.stringify(token.value)},`);
    }
  }
  const rungLines = Object.values(rungs).map(
    (rung) => `      ${JSON.stringify(rung.name)}: ${JSON.stringify(rung.value)},`
  );
  return `  ${JSON.stringify(theme.slug)}: {
    slug: ${JSON.stringify(theme.slug)},
    variant: ${JSON.stringify(theme.input.variant)},
    brand: ${JSON.stringify(theme.input.brand)},
    segment: ${JSON.stringify(theme.input.segment)},
    density: ${JSON.stringify(theme.defaultDensity)},
    colors: {
${colors.join("\n")}
    },
    dimensions: {
${dimensions.join("\n")}
    },
    rungs: {
${rungLines.join("\n")}
    },
  },`;
}

/**
 * Renders the generated module.
 *
 * @param catalog - The resolved theme catalog.
 * @returns The module source, without the generated banner.
 */
export function renderOgThemes(catalog: ResolvedThemeCatalog): string {
  return `import type { ThemeSlug } from "@elmeragroup/fuse/theme";

import type { OgTheme } from "../og/og-theme";

/** A color role an image may paint: every color-kind role token. */
export type OgColorRole =${union(namesOfKind(catalog, "color"))};

/** A dimension role token, in px at the 16px root. */
export type OgDimension =${union(namesOfKind(catalog, "dimension"))};

/** Every legal theme's light scheme as sRGB channels and px, keyed by slug. */
export const OG_THEMES: { readonly [S in ThemeSlug]: OgTheme } = {
${catalog.themes.map(renderTheme).join("\n")}
};
`;
}
