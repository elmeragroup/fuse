import type { ThemeInput } from "../src/theme/tokens/themes";

/** fkas/private, internal: the theme every component browser suite mounts under. */
export const fkasPrivate = {
  variant: "internal",
  brand: "fkas",
  segment: "private",
} as const satisfies ThemeInput;

/** fkas/private, external: the same brand reached through the segment path. */
export const fkasExternal = {
  variant: "external",
  brand: "fkas",
  segment: "private",
} as const satisfies ThemeInput;

/** tkas/company, external: a brand/segment pair with no segment sheet. */
export const tkasCompany = {
  variant: "external",
  brand: "tkas",
  segment: "company",
} as const satisfies ThemeInput;

/** guen/private, internal: a second internal brand for scope fixtures. */
export const guenPrivate = {
  variant: "internal",
  brand: "guen",
  segment: "private",
} as const satisfies ThemeInput;

/** Stamp a theme's three axes onto an element, the way `ThemeScope` writes them. */
export function stampTheme(element: HTMLElement, theme: ThemeInput): void {
  element.setAttribute("data-theme-variant", theme.variant);
  element.setAttribute("data-theme-brand", theme.brand);
  element.setAttribute("data-theme-segment", theme.segment);
}
