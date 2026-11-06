import { THEME_AXES, themeAxisAttributes } from "./theme-input";
import type { ThemeAxis, ThemeAxisValue, ThemeInput } from "./theme-input";
import { validateTheme } from "./validate-theme";

/** The `data-theme-*` attributes that stamp a theme on an element, one per theme axis. */
export type ThemeAttributes = {
  readonly [A in ThemeAxis as A["attribute"]]: ThemeAxisValue<A["name"]>;
};

/** One of the `data-theme-*` attribute names a theme stamps on its element. */
export type ThemeAttributeName = keyof ThemeAttributes;

/** Every `data-theme-*` attribute name, in write and diagnostic order. */
export const THEME_ATTRIBUTE_NAMES: readonly ThemeAttributeName[] = THEME_AXES.map((axis) => axis.attribute);

/**
 * Projects an already validated theme onto its `data-theme-*` attributes without revalidating.
 *
 * @param theme - A theme `validateTheme` returned.
 * @returns The attributes that stamp `theme` on an element.
 */
export function attributesOfValidatedTheme(theme: ThemeInput): ThemeAttributes {
  // SAFETY: themeAxisAttributes pairs every THEME_AXES attribute with its own axis's value, which
  // is exactly the mapped ThemeAttributes record; Object.fromEntries loses the key correlation.
  return Object.fromEntries(themeAxisAttributes(theme)) as ThemeAttributes;
}

/**
 * Validates a theme and returns the `data-theme-*` attributes to spread on an element.
 *
 * A segment a pinned brand does not allow throws in development. In production it is
 * coerced to the brand's pinned segment with a `console.warn`.
 *
 * @param theme - The theme to stamp.
 * @returns The attributes that stamp the validated theme on an element.
 * @throws When `theme` has an unknown or missing axis, or in development a segment its
 *   brand is not pinned to.
 */
export function themeAttributes(theme: ThemeInput): ThemeAttributes {
  return attributesOfValidatedTheme(validateTheme(theme));
}
