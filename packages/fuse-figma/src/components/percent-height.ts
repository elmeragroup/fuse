/**
 * A percentage height inside a parent whose height hugs, as the Navigation menu popup's viewport and
 * content are `100%` tall in a popup as tall as they are. CSS 2.1 §10.5: a percentage height whose
 * containing block's height depends on its content computes to `auto`, so the box is as tall as what
 * it holds, which a hug draws. The rule reads a parent that stacks its layers down, a column or a box
 * of blocks, where the box's own height decides nothing about its siblings'. In a row that hugs its
 * height, the row's stretch of the item is a further question, so the height stays unread there, and
 * across, a percentage of a width that hugs stays unread too (CSS Sizing 3 §5.2.1).
 */
import type { PercentBasis } from "./css-values";
import type { SizeSpec } from "./kit-spec";
import type { Layout } from "./placement";

/** Why a percentage height in a parent that hugs its height draws as a hug. */
export const AUTO_HEIGHT =
  "the parent's height depends on its content, so a percentage height computes to auto, which hugs (CSS 2.1 §10.5)";

/** The basis of a percentage height that computes to `auto`. */
const AUTO_BASIS: PercentBasis = { kind: "auto" };

/**
 * The basis a part's percentage height takes in its parent where the parent stacks its layers down
 * and hugs its own height.
 *
 * @param layout - The parent's layout.
 * @param height - The parent's height sizing.
 * @returns The `auto` basis, or undefined where the rule does not decide the part's percentage.
 */
export function autoHeightBasis(layout: Layout, height: SizeSpec): PercentBasis | undefined {
  const stacksDown = (layout.flex || layout.blocks) && layout.direction === "VERTICAL";
  return stacksDown && height.kind === "hug" ? AUTO_BASIS : undefined;
}
