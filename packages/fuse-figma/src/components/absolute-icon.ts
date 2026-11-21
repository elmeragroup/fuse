/**
 * Whether an absolute icon that `absolute-placement.ts` places paints as CSS paints it once the box
 * draws it as its last layer, over every other layer of the box. The build places such an icon only
 * where that holds, and keeps it in the box's flow otherwise, with the reason.
 *
 * CSS paints a box's in-flow, non-positioned descendants first, then its positioned ones and the
 * stacking contexts at level 0 in tree order, then the positive levels (CSS 2.1 Appendix E, steps 4
 * to 9). A flex container paints its items in order-modified document order (CSS Flexbox 1 §5.4.1).
 * So the icon paints over every box of its box's subtree where:
 *
 * - the box is a flex row or column in its own order, since a block box may paint its first layer
 *   on top (`stacksFirstOnTop` in `stacking.ts`) and a reversed flex box lays its items out against
 *   their order;
 * - no item of the box sets an `order`, and no box of its subtree, the icon included, sets a
 *   `z-index`;
 * - every element and pseudo-element after the icon in the markup is static and makes no stacking
 *   context (`stackingOf` in `stacking.ts`), a value that may make one included;
 * - no flush run draws two of the box's layers in a frame of their own (`flush-layers.ts`), whose
 *   key no paint of the icon's names.
 *
 * Every box before it in the markup paints under it then. The icon's `<svg>` is a child of the
 * box's own element, which the capture holds (`IconNeighbours`), as `planPlacement` requires.
 */
import type { IconNeighbours } from "./box-cascade";
import { normalizeCss } from "./css-values";
import { cancelsGap } from "./flush-layers";
import type { LayerStyle } from "./layer-style";
import { stackingOf } from "./stacking";

/** Why an absolute icon draws in its box's flow, where its paint is not provably as CSS paints it. */
const NOT_FLEX =
  "the absolute icon's box is no flex container, and the build proves the icon's paint only in a flex row or column, since a block box can paint its first layer on top, which puts the icon, its last layer, under boxes CSS paints it over";
const REVERSED =
  "the absolute icon's box lays its items out in reverse, against the order Figma paints its layers in";
const UNCAPTURED =
  "the capture does not hold the absolute icon's `<svg>` as a child of its box's own element, so the build cannot tell what CSS paints over it";
const FLUSH =
  "a flex item of the absolute icon's box cancels the column's gap, so a frame draws it with the layer before it, whose paint beside the icon the build does not follow";
const REORDERED =
  "an item of the absolute icon's box sets an `order`, and a flex container paints its items in order-modified document order (CSS Flexbox 1 §5.4.1)";
const LEVELLED =
  "a box in the absolute icon's box sets a `z-index`, which can paint it over the icon (CSS 2.1 §9.9.1)";
const COVERED =
  "a box after the absolute icon in the markup is positioned or makes a stacking context, which CSS paints over the icon (CSS 2.1 Appendix E, step 8), while Figma draws the icon over every layer of its box";
const UNKNOWN =
  "a box after the absolute icon in the markup sets a value that may or may not make a stacking context, so the build cannot tell whether CSS paints it over the icon";

/** What an absolute icon's paint reads of the box that holds it. */
export type IconBox = {
  /** The box's style. */
  readonly style: LayerStyle;
  /** The styles of the box's parts in its flow, in their order, which a flush run reads. */
  readonly flow: readonly LayerStyle[];
};

/**
 * Why an absolute icon that keeps a place would paint otherwise than CSS paints it, as the module
 * says, or undefined where Figma, drawing it last, paints it as CSS does.
 *
 * @param icon - The icon's style.
 * @param neighbours - What the box's element holds around the icon's `<svg>`, or undefined where
 *   the capture does not say.
 * @param box - The box's style and the styles of its parts in its flow.
 * @returns The reason, or undefined.
 */
export function iconPaintRefusal(
  icon: LayerStyle,
  neighbours: IconNeighbours | undefined,
  box: IconBox
): string | undefined {
  const display = normalizeCss(box.style.resolved("display") ?? "");
  const direction = normalizeCss(box.style.resolved("flex-direction") ?? "row");
  if (display !== "flex" && display !== "inline-flex") {
    return NOT_FLEX;
  }
  if (direction !== "row" && direction !== "column") {
    return REVERSED;
  }
  if (neighbours === undefined) {
    return UNCAPTURED;
  }
  const cancels = direction === "column" ? cancelsGap(box.style) : undefined;
  if (cancels !== undefined && box.flow.slice(1).some(cancels)) {
    return FLUSH;
  }
  const unordered = (value: string | undefined) => value !== undefined && normalizeCss(value) !== "0";
  if (neighbours.items.some((item) => unordered(item("order")))) {
    return REORDERED;
  }
  const levelled = (value: string | undefined) => value !== undefined && normalizeCss(value) !== "auto";
  const everyBox = [...neighbours.before, ...neighbours.after];
  if (levelled(icon.resolved("z-index")) || everyBox.some((each) => levelled(each("z-index")))) {
    return LEVELLED;
  }
  const later = neighbours.after.map(stackingOf);
  return later.includes("own-layer") ? COVERED : later.includes("unknown") ? UNKNOWN : undefined;
}
