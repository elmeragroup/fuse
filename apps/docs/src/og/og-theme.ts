/**
 * A theme's tokens in the form Satori paints: sRGB colors and pixel lengths.
 *
 * Satori parses neither `oklch()` nor custom properties, so an image cannot read the theme the
 * way a page does. The docs generate pass writes `OG_THEMES` from the resolved theme catalog,
 * each legal theme's light scheme as sRGB channels and px, and this module reads it.
 */

import * as Hex from "@elmeragroup/color/hex";
import { getOrThrow } from "@elmeragroup/color/result";
import * as Srgb from "@elmeragroup/color/srgb";
import type { BrandCode, Density, ThemeSegment, ThemeSlug, ThemeVariant } from "@elmeragroup/fuse/theme";
import type { RadiusRungName } from "@elmeragroup/fuse/theme-catalog";

import { OG_THEMES } from "../generated/og-themes";
import type { OgColorRole, OgDimension } from "../generated/og-themes";

/** One theme's light-scheme palette and shape, ready for Satori styles. */
export type OgTheme = {
  /** The theme's canonical slug. */
  readonly slug: ThemeSlug;
  /** The audience axis. */
  readonly variant: ThemeVariant;
  /** The brand code. */
  readonly brand: BrandCode;
  /** The customer segment. */
  readonly segment: ThemeSegment;
  /** The variant's deployment density, which sets the control metrics a specimen draws. */
  readonly density: Density;
  /** Every color role as gamma-encoded sRGB channels. */
  readonly colors: { readonly [R in OgColorRole]: Srgb.SrgbComponents };
  /** Every dimension role in px, such as `radius`, `radius-button` and `button-outline-width`. */
  readonly dimensions: { readonly [D in OgDimension]: number };
  /** Every radius rung in px, clamped at 0 as CSS clamps a negative `border-radius`. */
  readonly rungs: { readonly [R in RadiusRungName]: number };
};

/**
 * One legal theme's values.
 *
 * @param slug - A legal theme slug.
 * @returns The theme.
 */
export function ogTheme(slug: ThemeSlug): OgTheme {
  return OG_THEMES[slug];
}

/**
 * A color as a CSS string Satori parses: `#RRGGBB` when opaque, `rgba()` otherwise.
 *
 * @param color - Gamma-encoded sRGB channels.
 * @param alpha - An opacity in `0..1` that replaces the color's own, as Tailwind's `/80` does.
 * @returns The CSS color.
 * @throws {OutOfRange} When a channel lies outside `0..1`, which the generated catalog never writes.
 */
export function css(color: Srgb.SrgbComponents, alpha: number = color.alpha): string {
  if (alpha >= 1) {
    return Hex.formatOpaque(getOrThrow(Srgb.make(color)));
  }
  const channel = (value: number): string => String(Math.round(value * 255));
  return `rgba(${channel(color.r)}, ${channel(color.g)}, ${channel(color.b)}, ${String(alpha)})`;
}
