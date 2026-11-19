/**
 * Whether a background color the page read paints nothing. The capture's page functions return the
 * computed color as Chromium serializes it, and Node judges it here, where `@elmeragroup/color`
 * parses it, so `pseudo-boxes.ts` and `page-facts.ts` read a fill the same way.
 */
import * as CssColor from "@elmeragroup/color/css-color";

/**
 * Whether a computed background color is clear: its alpha is zero. A color the parser cannot read
 * counts as painting, since nothing shows it clear.
 *
 * @param color - The computed `background-color`, as `getComputedStyle` gives it.
 * @returns True where the color's alpha is zero.
 */
export function clearFill(color: string): boolean {
  const fill = CssColor.parse(color);
  return fill._tag === "ok" && CssColor.toSrgb(fill.value).alpha === 0;
}
