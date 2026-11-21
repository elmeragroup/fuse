/**
 * The corner inside a border: the outer radius less the border width, at least 0 (CSS Backgrounds 3
 * §5.2). The token sync writes a synced variable with this code syntax for each outer corner a set
 * fills inside a border, and the kit's builder binds that fill's corner by the same spelling, so the
 * two cannot drift.
 */

/**
 * The code syntax of the corner inside a border.
 *
 * @param outer - The outer corner's code syntax, such as `var(--radius)`.
 * @param width - The border width in pixels.
 * @returns `max(0px, <outer> - <width>px)`.
 */
export function innerCornerSyntax(outer: string, width: number): string {
  return `max(0px, ${outer} - ${String(width)}px)`;
}
