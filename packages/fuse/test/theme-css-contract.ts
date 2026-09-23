/** The secondary hover as the themes declare it, a live mix of the scope's own roles. */
export const SECONDARY_HOVER_CSS = "color-mix(in oklch, var(--secondary), var(--foreground) 5%)";

/**
 * The value a theme rule declares for a composed role, written from the spec rather than
 * from the emitter. The themes declare the secondary hover as its live mix, and an internal
 * button radius that aliases `--radius` as `initial`, so the Button's
 * `var(--radius-button, var(--radius))` reads the radius on the button itself. Every other
 * role is declared as composed.
 *
 * @param name - A contract token name.
 * @param composed - The value `composeTheme` resolved for that role.
 * @returns The declaration value the emitted CSS must carry.
 */
export function declaredThemeValue(name: string, composed: string): string {
  if (name === "secondary-hover") return SECONDARY_HOVER_CSS;
  if (name === "radius-button" && composed === "var(--radius)") return "initial";
  return composed;
}
