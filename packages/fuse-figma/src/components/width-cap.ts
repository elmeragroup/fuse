/**
 * The cap on the width of what a box holds: the box's own `max-width` and `min-width`, the cap the
 * boxes around it set, the share a row's other layers and gaps take, and whether a box hugs its
 * width with nothing bounding it. `box-room.ts` puts the cap in each part's room, and
 * `label-sizing.ts` caps a label by it.
 */

import { bordersOn, literalPixels } from "./box-insets";
import type { Holder } from "./box-room";
import { evaluatePercentage, normalizeCss } from "./css-values";

/**
 * The widest a box that hugs its width grows in CSS before the text it holds wraps: the content
 * width that the nearest boxes around it that hug their width up to a `max-width` leave, in pixels.
 * `unread` where one of those widths, or a padding or border between, is no literal length, and
 * `none` where no such box caps it.
 */
export type WidthCap =
  | { readonly kind: "none" }
  | { readonly kind: "pixels"; readonly value: number }
  | { readonly kind: "unread" };

/** No cap on a box's width. */
export const NO_CAP: WidthCap = { kind: "none" };

/** A cap the build cannot read in pixels. */
export const UNREAD_CAP: WidthCap = { kind: "unread" };

/**
 * The cap on the width of one layer a box holds, a part or the box's own text. A box that hugs its
 * width is as wide as what it holds, up to its `max-width` and the cap the boxes around it set, and
 * no narrower than its `min-width` (CSS 2.1 §10.4), so what it holds wraps at that width less the
 * box's padding and border (CSS Sizing 3 §5.1). In a row the other layers and the gaps between them
 * take their share of it (CSS Flexbox 1 §9.7), and a share the build cannot read leaves the cap
 * `unread`. A box whose width is fixed or fills sets the width of what it holds instead, so no cap
 * passes through it.
 *
 * @param holder - The box.
 * @param index - The layer's place in the box's flow, as `holder.layers` lists it.
 * @returns The cap in pixels, `unread` where a length it needs is no literal, or `none`.
 */
export function widthCapInside(holder: Holder, index: number): WidthCap {
  const content = contentCap(holder);
  if (content.kind !== "pixels" || holder.layout.direction !== "HORIZONTAL") {
    return content;
  }
  const room = lessShares(holder, index, content.value);
  return room === undefined ? UNREAD_CAP : { kind: "pixels", value: room };
}

/**
 * A row's length less the shares of every layer but one and the gaps between them (CSS Flexbox 1
 * §9.7), in pixels.
 *
 * @param holder - The row.
 * @param index - The one layer's place in the row's flow.
 * @param length - The row's content length.
 * @returns The length left, or undefined where a share or the gap is no literal, or a `column-gap`
 *   is set.
 */
export function lessShares(holder: Holder, index: number, length: number): number | undefined {
  const others = holder.layers.filter((_layer, place) => place !== index).map(({ share }) => share);
  if (others.length === 0) {
    return length;
  }
  const gap = holder.style.has("column-gap") ? undefined : literalPixels(holder.style, "gap");
  let room = length - (gap ?? 0) * others.length;
  for (const share of others) {
    if (share.kind !== "pixels" || gap === undefined) {
      return undefined;
    }
    room -= share.value;
  }
  return room;
}

/**
 * The `display` values whose box lays what it holds out in a context the kit models as hugging it:
 * unset, which takes an inline or a block box from the element, flow layout, and a flex box.
 */
const FLOW_DISPLAYS: ReadonlySet<string> = new Set([
  "",
  "inline",
  "block",
  "inline-block",
  "flow-root",
  "list-item",
  "flex",
  "inline-flex",
]);

/**
 * Whether a box hugs its width with nothing bounding the width CSS makes available to what it holds.
 *
 * - Its room is unbounded, as `Room.unbounded` in `box-room.ts` says.
 * - Its hug is one CSS gives it, as `widthKnown` says, and no `width` that does not map, such as
 *   `w-min`, which can make it narrower than what it holds.
 * - It sets no `max-width` but one of `100%` or more, which never binds there, since every box around
 *   it hugs what it holds.
 * - It lays what it holds out in a context the kit models as hugging it, flow or flex, as
 *   {@link FLOW_DISPLAYS} lists. A grid sizes each item against its track (CSS Grid 1 §6.2), which
 *   the kit does not read, and no other context is modeled.
 *
 * Such a box lays what it holds out at its max-content width (CSS Sizing 3 §5.1), so its row never
 * runs out of room, a text in it sets no line narrower than a word, and each layer it holds has
 * unbounded room too.
 *
 * @param holder - The box.
 * @returns True where the box hugs and nothing bounds it.
 */
export function hugsUncapped(holder: Holder): boolean {
  const maximum = holder.style.resolved("max-width");
  const unlimited =
    maximum === undefined || normalizeCss(maximum) === "none" || (evaluatePercentage(maximum) ?? 0) >= 1;
  return (
    holder.sizing.horizontal.kind === "hug" &&
    holder.widthKnown &&
    holder.unbounded &&
    unlimited &&
    FLOW_DISPLAYS.has(normalizeCss(holder.style.raw("display") ?? ""))
  );
}

/**
 * The cap on a box's content width: its own limits, resolved as CSS resolves them, and the cap the
 * boxes around it set, less its padding and border.
 */
function contentCap(holder: Holder): WidthCap {
  if (holder.sizing.horizontal.kind !== "hug") {
    return NO_CAP;
  }
  const { minWidth, maxWidth } = holder.limits;
  const own: WidthCap =
    maxWidth === undefined
      ? NO_CAP
      : maxWidth.kind === "literal"
        ? { kind: "pixels", value: maxWidth.value }
        : UNREAD_CAP;
  const outer = narrower(own, holder.widthCap);
  if (outer.kind !== "pixels") {
    return outer;
  }
  if (minWidth !== undefined && minWidth.kind !== "literal") {
    return UNREAD_CAP;
  }
  // The minimum wins over the maximum and the cap (CSS 2.1 §10.4).
  const border = Math.max(outer.value, minWidth?.value ?? 0);
  const insets = [
    ...["padding-left", "padding-right"].map((property) => literalPixels(holder.style, property)),
    bordersOn(holder.style, "horizontal"),
  ];
  return insets.some((inset) => inset === undefined)
    ? UNREAD_CAP
    : { kind: "pixels", value: insets.reduce<number>((rest, inset) => rest - (inset ?? 0), border) };
}

/** The narrower of two caps. Either one unread makes the narrower unread. */
function narrower(left: WidthCap, right: WidthCap): WidthCap {
  if (left.kind === "unread" || right.kind === "unread") {
    return UNREAD_CAP;
  }
  if (left.kind === "none") {
    return right;
  }
  return right.kind === "none" ? left : { kind: "pixels", value: Math.min(left.value, right.value) };
}
