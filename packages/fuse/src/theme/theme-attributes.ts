import type { ThemeInput } from "./tokens/themes";
import { validateTheme } from "./validate-theme";

/** The `data-theme-*` attributes that stamp a theme on an element. */
export type ThemeAttributes = {
  "data-theme-variant": ThemeInput["variant"];
  "data-theme-brand": ThemeInput["brand"];
  "data-theme-segment": ThemeInput["segment"];
};

/** One of the `data-theme-*` attribute names a theme stamps on its element. */
export type ThemeAttributeName = keyof ThemeAttributes;

/** Every `data-theme-*` attribute name, in write and diagnostic order. */
export const THEME_ATTRIBUTE_NAMES = [
  "data-theme-variant",
  "data-theme-brand",
  "data-theme-segment",
] as const satisfies ReadonlyArray<ThemeAttributeName>;

/**
 * Projects an already validated theme onto its `data-theme-*` attributes without revalidating.
 *
 * @param theme - A theme `validateTheme` returned.
 * @returns The attributes that stamp `theme` on an element.
 */
export function attributesOfValidatedTheme(theme: ThemeInput): ThemeAttributes {
  return {
    "data-theme-variant": theme.variant,
    "data-theme-brand": theme.brand,
    "data-theme-segment": theme.segment,
  };
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
