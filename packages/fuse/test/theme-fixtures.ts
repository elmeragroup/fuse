import type { ThemeInput } from "../src/theme/theme-input";

/** fkas/private, neutral: the theme every component browser suite mounts under. */
export const fkasPrivate = {
  identity: "neutral",
  brand: "fkas",
  segment: "private",
} as const satisfies ThemeInput;

/** fkas/private, branded: the same brand reached through the segment path. */
export const fkasBranded = {
  identity: "branded",
  brand: "fkas",
  segment: "private",
} as const satisfies ThemeInput;

/** tkas/company, branded: a brand/segment pair with no segment sheet. */
export const tkasCompany = {
  identity: "branded",
  brand: "tkas",
  segment: "company",
} as const satisfies ThemeInput;

/** guen/private, branded: the light page tint closest to the shared field border. */
export const guenBranded = {
  identity: "branded",
  brand: "guen",
  segment: "private",
} as const satisfies ThemeInput;

/** guen/private, neutral: a second neutral brand for scope fixtures. */
export const guenPrivate = {
  identity: "neutral",
  brand: "guen",
  segment: "private",
} as const satisfies ThemeInput;

/** Stamp a theme's three axes onto an element, the way `ThemeScope` writes them. */
export function stampTheme(element: HTMLElement, theme: ThemeInput): void {
  element.setAttribute("data-theme-identity", theme.identity);
  element.setAttribute("data-theme-brand", theme.brand);
  element.setAttribute("data-theme-segment", theme.segment);
}
