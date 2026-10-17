import * as Hex from "@elmeragroup/color/hex";
import * as Wcag from "@elmeragroup/color/wcag";
import type { BrandCode, ThemeInput } from "@elmeragroup/fuse/theme";
import { themeSlug } from "@elmeragroup/fuse/theme";
import type { ResolvedColorScheme } from "@elmeragroup/fuse/theme-catalog";

import { fuseCatalog, themeBySlug } from "./fuse-catalog";

/** The brand's tonal roles that make up its heat ramp, as the landing reads them. */
const HEAT_ROLES = [
  "secondary",
  "primary",
  "feature",
  "feature-bright",
  "feature-foreground",
  "primary-soft",
] as const;

/** The Heatmap shader takes at most seven colours. */
const RAMP_LENGTH = 7;

/** The colours the brand heatmap draws with. */
export type Heat = {
  /**
   * Hex colours, cold to hot for the scheme. Mutable in type only, because the shader's prop
   * takes `string[]`; nothing writes to it.
   */
  readonly colors: string[];
  /** Hex of the theme's background, so the shader's grain meets the page without a seam. */
  readonly back: string;
};

/** One ramp per theme and scheme, so a frame-by-frame caller gets the same arrays every time. */
const ramps = new Map<string, Heat>();

/**
 * The landing's heat ramp for a theme, read from Fuse's resolved catalog instead of computed
 * styles, so a frame never waits on the DOM for it. Results are cached per theme and scheme. The roles and the brand primitive are
 * deduplicated, sorted by WCAG luminance and cut to seven: dark runs dark to light so the mark
 * glows, light runs light to dark so it inks.
 *
 * @param theme - The theme the heatmap sits in.
 * @param scheme - The color scheme.
 * @returns The ramp and the background hex.
 * @throws When Fuse's catalog lacks the theme, a defect in the theme tables.
 */
export function heatFor(theme: ThemeInput, scheme: ResolvedColorScheme): Heat {
  const slug = themeSlug(theme);
  const key = `${slug}/${scheme}`;
  const cached = ramps.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const { tokens } = themeBySlug(slug).schemes[scheme];
  const brand: BrandCode = theme.brand;
  const srgbs = [
    ...HEAT_ROLES.map((role) => tokens[role].value),
    fuseCatalog().primitives[`brand-${brand}`].value,
  ];
  const unique = new Map(srgbs.map((srgb) => [Hex.formatOpaque(srgb), Wcag.relativeLuminance(srgb)]));
  const rising = [...unique.entries()].sort((left, right) => left[1] - right[1]).map(([hex]) => hex);
  const heat = {
    colors: scheme === "dark" ? rising.slice(-RAMP_LENGTH) : rising.reverse().slice(0, RAMP_LENGTH),
    back: Hex.formatOpaque(tokens.background.value),
  };
  ramps.set(key, heat);
  return heat;
}
