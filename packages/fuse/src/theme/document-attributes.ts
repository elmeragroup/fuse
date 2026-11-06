import { densityAttributes } from "./density";
import type { Density, DensityAttributes } from "./density";
import { themeAttributes } from "./theme-attributes";
import type { ThemeAttributes } from "./theme-attributes";
import type { ThemeInput } from "./theme-input";

/** Everything a document root carries for Fuse: the `data-theme-*` attributes, then `data-density`. */
export type DocumentAttributes = ThemeAttributes & DensityAttributes;

/** What a document root is stamped with: its theme and its density, both explicit. */
export type DocumentAttributesInput = {
  /** The document's theme. */
  readonly theme: ThemeInput;

  /** The document's density. No identity implies one, so every document names it. */
  readonly density: Density;
};

/**
 * Validates a document's theme and density and returns the attributes to spread on `<html>`.
 * It is the one place a document gets both: ThemeProvider and ThemeScope stamp the theme and
 * never density, which stays a document axis.
 *
 * @param input - The document's theme and density.
 * @returns The `data-theme-*` attributes followed by `data-density`.
 * @throws When the theme has an unknown or missing axis (in development, also a segment its
 *   pinned brand does not span), or when the density is unknown.
 */
export function documentAttributes({ theme, density }: DocumentAttributesInput): DocumentAttributes {
  return { ...themeAttributes(theme), ...densityAttributes(density) };
}
