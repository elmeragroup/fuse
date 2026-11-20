/**
 * A block whose `100%` width spans a parent that stacks blocks and hugs its width. CSS shrinks such a
 * parent to fit its widest child, the percentage counting as `auto` meanwhile (CSS Sizing 3 §5.2.1),
 * and the block then spans the parent:
 *
 * - alone, the block is as wide as its own content, which a hug draws ({@link spansHuggingParent});
 * - beside other blocks, it is as wide as its own content or their widest width, whichever is wider,
 *   which a hug with that width as its minimum draws, where the capture measured that width as one
 *   length in every mode ({@link spannedWidth}).
 *
 * `box-sizing.ts` asks while it reads the block's width.
 */
import { evaluateLength, evaluatePercentage, normalizeCss } from "./css-values";
import type { LayerStyle } from "./layer-style";
import type { PercentBasis } from "./sizing-value";

/** Why a `100%` width hugs in a parent that hugs it. */
export const SPANS_HUGGING_PARENT =
  "100% of a parent that hugs the box, its only layer, resolves to the box's own width, since the parent shrinks to fit the box's content (CSS Sizing 3 §5.2.1), which a hug draws";

/**
 * Whether a box's `100%` width is its own content width: it is the only block of a parent that
 * stacks blocks and hugs its width, which CSS shrinks to fit the box's content (CSS 2.1 §10.3.7), the
 * percentage counting as `auto` while it does (CSS Sizing 3 §5.2.1), and the box's border box spans
 * that width. So the box has no
 * horizontal margin, and its padding and border sit inside its width, under `border-box` or at
 * zero, as the Navigation menu popup's `size-full` viewport spans the popup that hugs its list.
 */
export function spansHuggingParent(reader: LayerStyle, percent: PercentBasis): boolean {
  if (percent.kind !== "hugging" || !percent.only) {
    return false;
  }
  const zero = (property: string): boolean => evaluateLength(reader.resolved(property) ?? "0") === 0;
  const borderBox = normalizeCss(reader.resolved("box-sizing") ?? "content-box") === "border-box";
  return (
    ["margin-left", "margin-right"].every(zero) &&
    (borderBox || ["padding-left", "padding-right", "border-left-width", "border-right-width"].every(zero))
  );
}

/**
 * Whether a box's `100%` width hugs: it spans a hugging parent alone, as {@link spansHuggingParent}
 * says, or beside other blocks, where {@link spannedWidth} gave it a least width.
 */
export function spansParent(reader: LayerStyle, percent: PercentBasis, spanned: number | undefined): boolean {
  return spanned !== undefined || spansHuggingParent(reader, percent);
}

/** Why a `100%` width hugs with a minimum in a parent that fits its content beside other blocks. */
export function spansBesideBlocks(width: number): string {
  return `100% of a parent that fits its content resolves to the box's own width or the ${String(width)}px the parent's other blocks take in every mode, as the capture measured, whichever is wider, since the parent shrinks to fit its widest child (CSS Sizing 3 §5.2.1), which a hug with a ${String(width)}px minimum draws`;
}

/**
 * The least width of a box whose `100%` width spans a parent that fits its content beside other
 * blocks, or undefined where the box is no such block. Where the capture measured the other
 * children's widest max-content width as one length in every mode (`spansBeside`), the box is as
 * wide as its own content or that length, whichever is wider, which a hugging frame with that
 * `minWidth` draws: on 2026-11-19 a hugging row with a 252px minimum stayed 252 wide around narrower
 * content and grew to hold wider content, on an instance too and through a density switch (CAL2).
 * The box sets no width limit of its own, no horizontal margin, and keeps its padding and border
 * inside its width, as {@link spansHuggingParent} requires of the one block. Nothing but its blocks
 * may set the parent's width, no `min-width` or `max-width` of its own and no room around it that
 * could bind, as `hugsUncapped` in `box-sizing.ts` says, since those make the parent wider or
 * narrower than its widest block.
 *
 * @param reader - The box's style.
 * @param percent - What the box's percentage width resolves against.
 * @param beside - The width the capture measured beside the box, or undefined.
 * @returns The box's least width, in pixels, or undefined.
 */
export function spannedWidth(
  reader: LayerStyle,
  percent: PercentBasis,
  beside: number | undefined
): number | undefined {
  if (beside === undefined || percent.kind !== "hugging" || percent.only || !percent.uncapped) {
    return undefined;
  }
  const spans =
    evaluatePercentage(reader.resolved("width") ?? "") === 1 &&
    !reader.has("min-width") &&
    !reader.has("max-width") &&
    spansHuggingParent(reader, { ...percent, only: true });
  return spans ? beside : undefined;
}
