/**
 * The modes a designer can pick for a kit frame, which the capture's page function measures a fact
 * in before it keeps one that must hold in every mode, and which a Chromium test of a set's layout
 * sweeps the same way.
 */
import { BRAND_CODES, BRANDS, THEME_IDENTITIES, themeAxisAttributes } from "@elmeragroup/fuse/theme-catalog";
import type { Density, ResolvedColorScheme } from "@elmeragroup/fuse/theme-catalog";

/**
 * A mode a designer can pick for a kit frame, as the page stamps it: the color scheme and the
 * density on `<html>`, and the theme's `data-theme-*` attributes on `<body>`. `themes.css` matches the
 * dark scheme as `[data-theme="dark"]` on an ancestor of the themed element.
 */
export type PageMode = {
  readonly root: Readonly<Record<"data-theme", ResolvedColorScheme> & Record<"data-density", Density>>;
  readonly body: ReturnType<typeof themeAxisAttributes>;
};

/** The color schemes, which a host's rule can key a length or a `z-index` on as well as a color. */
const SCHEMES = ["light", "dark"] as const satisfies readonly ResolvedColorScheme[];

/** The densities the role metrics follow, which change the type and the lengths of a box. */
const DENSITIES = ["dense", "comfortable"] as const satisfies readonly Density[];

/**
 * Every color scheme and density with every legal theme: each identity and brand, with each segment
 * the brand allows. A fact that must hold wherever a designer puts the kit is measured in each.
 */
export const EVERY_MODE: readonly PageMode[] = SCHEMES.flatMap((scheme) =>
  DENSITIES.flatMap((density) =>
    THEME_IDENTITIES.flatMap((identity) =>
      BRAND_CODES.flatMap((brand) =>
        BRANDS[brand].segments.map((segment): PageMode => ({
          root: { "data-theme": scheme, "data-density": density },
          body: themeAxisAttributes({ identity, brand, segment }),
        }))
      )
    )
  )
);
