/**
 * The displays the browser's default style sheet gives the elements the kit draws, which no class
 * of theirs sets (HTML, Rendering §15.3, and §15.5 for a form control, which is inline-block).
 */

import type { OuterDeclaration } from "./component-spec";

/** The elements whose default display a kit part reads. */
type DefaultedTag = "div" | "p" | "h2" | "li" | "input";

const DISPLAY = {
  div: "block",
  p: "block",
  h2: "block",
  li: "list-item",
  input: "inline-block",
} as const satisfies Readonly<Record<DefaultedTag, string>>;

/**
 * The display the browser's default style sheet gives an element.
 *
 * @param tag - The element.
 * @returns The one declaration that sets its display, named for the user agent style sheet.
 */
export function userAgentDisplay(tag: DefaultedTag): readonly OuterDeclaration[] {
  return [{ className: `user agent style sheet, ${tag}`, property: "display", value: DISPLAY[tag] }];
}

/** A `<div>`'s default display, `block`. */
export const DIV_BLOCK: readonly OuterDeclaration[] = userAgentDisplay("div");

/** An `<li>`'s default display, `list-item`. */
export const LI_LIST_ITEM: readonly OuterDeclaration[] = userAgentDisplay("li");
