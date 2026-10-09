/**
 * The three colors the Open Graph card paints, read from the resolved catalog so the card never
 * parses theme CSS. Satori reads neither `oklch()` nor custom properties, so the emitter writes
 * each color as `#RRGGBB`.
 */

import * as Hex from "@elmeragroup/color/hex";
import type { ResolvedThemeCatalog } from "@elmeragroup/fuse/theme-catalog";

/**
 * The theme the card paints: the landing's opening theme, `OPENING_THEME` in `src/lib/theme.ts`,
 * as its slug.
 */
const CARD_THEME = "external-elma-private";

/**
 * Renders the generated module: the dark scheme's background, foreground and muted foreground
 * of {@link CARD_THEME}.
 *
 * @param catalog - The resolved theme catalog.
 * @returns The module source, without the generated banner.
 * @throws {Error} When the catalog has no {@link CARD_THEME}, a defect in the theme pins.
 */
export function renderOgCardColors(catalog: ResolvedThemeCatalog): string {
  const theme = catalog.themes.find((candidate) => candidate.slug === CARD_THEME);
  if (theme === undefined) {
    throw new Error(`og card colors: the resolved catalog has no ${CARD_THEME} theme`);
  }
  const { tokens } = theme.schemes.dark;
  const colors = {
    background: Hex.formatOpaque(tokens.background.value),
    foreground: Hex.formatOpaque(tokens.foreground.value),
    mutedForeground: Hex.formatOpaque(tokens["muted-foreground"].value),
  };
  return `/** The Open Graph card's colors: the dark scheme of \`${CARD_THEME}\`, as Satori parses them. */
export const OG_CARD_COLORS = ${JSON.stringify(colors, null, 2)} as const;
`;
}
