import type { Density, ThemeSlug } from "@elmeragroup/fuse/theme";
import { resolveThemeCatalog } from "@elmeragroup/fuse/theme-catalog";
import type { ResolvedTheme, ResolvedThemeCatalog } from "@elmeragroup/fuse/theme-catalog";

let catalog: ResolvedThemeCatalog | undefined;

/**
 * Fuse's resolved theme catalog, resolved once on first use. Scenes read role colours and
 * density metrics from it as values, so a frame never parses CSS or waits on the DOM for them.
 *
 * @returns The catalog.
 */
export function fuseCatalog(): ResolvedThemeCatalog {
  catalog ??= resolveThemeCatalog();
  return catalog;
}

/**
 * The medium control height of a density, in px, as the landing's density section states it.
 *
 * @param density - The density.
 * @returns The `control-h-md` metric in px.
 * @throws When Fuse's catalog lacks the metric, a defect in Fuse's density tables.
 */
export function mediumControlPx(density: Density): number {
  const metric = fuseCatalog().density.find((entry) => entry.name === "control-h-md");
  if (metric === undefined) {
    throw new Error("Fuse's density catalog has no control-h-md metric");
  }
  return metric.px[density];
}

/**
 * A theme in Fuse's resolved catalog, by the slug `themeSlug` gives it.
 *
 * @param slug - The theme's slug.
 * @returns The resolved theme.
 * @throws When Fuse's catalog lacks the theme, a defect in the theme tables.
 */
export function themeBySlug(slug: ThemeSlug): ResolvedTheme {
  const theme = fuseCatalog().themes.find((entry) => entry.slug === slug);
  if (theme === undefined) {
    throw new Error(`Fuse's theme catalog has no theme ${slug}`);
  }
  return theme;
}
