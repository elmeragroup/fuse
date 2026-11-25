import type { TokenName } from "../src/theme/tokens/contract";

/** The secondary hover as the themes declare it, a live mix of the scope's own roles. */
export const SECONDARY_HOVER_CSS = "color-mix(in oklch, var(--secondary), var(--foreground) 5%)";

/**
 * The derived roles that read the brand pointer, listed from the spec rather than from the
 * emitter. Outside `:root`, only the brand pointer and the brand-scoped companions declare them,
 * and a host restyles them at the pointer's weight.
 */
export const BRAND_SCOPED_ROLES: readonly TokenName[] = [
  "brand-ink",
  "sidebar-brand",
  "sidebar-brand-foreground",
];

/**
 * The value a theme rule declares for a composed role, written from the spec rather than
 * from the emitter. The themes declare the secondary hover as its live mix and every other
 * role as composed.
 *
 * @param name - A contract token name.
 * @param composed - The value `composeTheme` resolved for that role.
 * @returns The declaration value the emitted CSS must carry.
 */
export function declaredThemeValue(name: string, composed: string): string {
  return name === "secondary-hover" ? SECONDARY_HOVER_CSS : composed;
}
