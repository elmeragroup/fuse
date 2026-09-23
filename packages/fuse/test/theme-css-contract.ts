/** The secondary hover as the themes declare it, a live mix of the scope's own roles. */
export const SECONDARY_HOVER_CSS = "color-mix(in oklch, var(--secondary), var(--foreground) 5%)";

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
