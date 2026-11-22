/**
 * The anchored placement rule: where Base UI's positioner puts a popup beside its anchor, which the
 * composite draws as a row or a column, how wide the anchor is against the composite's column, and
 * what stands for `--anchor-width` in a cell. The module also guards that rule's `minimum` width,
 * stopping a cell whose hugging anchor is wider than the popup's `min-width`.
 * `capture-cell-cascade.ts` composes the root from the rule, and `components/component-builder.ts`
 * chooses each cell's anchor width from the span.
 */

import { KitUnmappable } from "../components/build-errors.ts";
import { evaluatePercentage } from "../components/css-values.ts";
import type { CapturedCell, CapturedDeclaration, CapturedRoot } from "./capture-format.ts";

/**
 * What stands for Base UI's `--anchor-width` in a cell:
 *
 * - `length`, the anchor's width as the build maps it, such as `100%` where the anchor spans the
 *   composite's column, as Select (open)'s filling trigger does, or the anchor set's fixed width.
 * - `minimum`, for an anchor that hugs its content, a width the spec does not hold: the popup draws
 *   at its own `min-width`, the least Base UI makes it, which `checkHuggingAnchor` guards.
 * - `unresolved`, for an anchor that takes the column's width by its declarations but that the
 *   capture did not measure at the column's width, as {@link AnchorSpan}'s `limited` says, so the
 *   property stays unset and the popup's width unmapped.
 */
export type AnchorWidth =
  | { readonly _tag: "length"; readonly css: string }
  | { readonly _tag: "minimum" }
  | { readonly _tag: "unresolved" };

/**
 * How wide an anchored composite's anchor is against the composite's column, which decides what
 * `--anchor-width` stands for:
 *
 * - `column`, the capture measured the anchor's border box as wide as its host in every mode
 *   (`spansHost`), and the host as wide as the composite's column, which the popup fills beside it.
 * - `limited`, the anchor's declarations take the column's width, as a block-level anchor of an
 *   auto width or a `width: 100%` one does, or the capture measured it spanning a host of another
 *   width, but no measurement shows the column's width: a `w-full max-w-60` trigger in a 384px
 *   column is 240px wide, a `content-box` one with side padding is wider than the column, and one
 *   in a padded host is narrower.
 * - `own`, its width is its own, from its content or its set's length.
 */
export type AnchorSpan = "column" | "limited" | "own";

/**
 * How wide an anchored composite's anchor is against the composite's column, as {@link AnchorSpan}
 * says.
 *
 * @param placement - The composite's placement, as {@link anchoredPlacement} reads its cell.
 * @param column - The width of the composite's column in CSS pixels, undefined where the cell sits
 *   in no host width.
 * @returns The anchor's span.
 */
export function anchorSpan(placement: AnchoredPlacement, column: number | undefined): AnchorSpan {
  const spans = placement.anchor.root.measured?.spansHost;
  if (spans !== undefined && column !== undefined && Math.abs(spans - column) <= 1 / 64) {
    return "column";
  }
  return spans !== undefined || placement.anchorTakesColumn ? "limited" : "own";
}

/**
 * An anchored composite's roots in the order the composite draws them, the root's layout, and its
 * anchor.
 */
type AnchoredPlacement = {
  readonly roots: readonly CapturedRoot[];
  readonly anchor: CapturedRoot;
  /**
   * Whether the placement rule stretches the anchor across a `top` or `bottom` composite's column:
   * a block-level anchor of an auto width fills the host it renders in (CSS 2.1 §10.3.3), which a
   * column draws as a stretch. The anchor's own limits still apply to the stretched box.
   */
  readonly anchorFills: boolean;
  /**
   * Whether the anchor's declarations take the column's width: it fills it as `anchorFills` says,
   * or its `width` is `100%`. Its limits, padding and host may still move it off the column's
   * width, which {@link anchorSpan} reads from the capture's measurement.
   */
  readonly anchorTakesColumn: boolean;
  readonly declarations: readonly { readonly property: string; readonly value: string }[];
};

/** The flex alignment of Base UI's `data-align`. */
const ALIGN: ReadonlyMap<string, string> = new Map([
  ["start", "flex-start"],
  ["center", "center"],
  ["end", "flex-end"],
]);

/**
 * The one rule that draws an anchored composite: Base UI's positioner puts the popup on the side
 * its `data-side` names, `sideOffset` pixels from the anchor, aligned to it as its `data-align`
 * names. The composite is a column for `top` and `bottom` and a row for `left` and `right`, with the
 * popup first on `top` and `left`, its gap the offset, and its counter alignment the popup's. An
 * anchor that is block-level with an auto width fills the composite across, as it fills the host it
 * renders in (CSS 2.1 §10.3.3); any other anchor sits as the popup aligns.
 *
 * @param cell - The cell, which measures the anchor and the popup in either order.
 * @param sideOffset - The popup's offset from the anchor, in pixels.
 * @param declarations - The capture's declarations, which the roots' indexes name.
 * @returns The roots in drawn order and the root's layout.
 * @throws `KitUnmappable` where the cell does not measure one popup that names its side and
 *   alignment beside one anchor.
 */
export function anchoredPlacement(
  cell: CapturedCell,
  sideOffset: number,
  declarations: readonly CapturedDeclaration[]
): AnchoredPlacement {
  const popups = cell.roots.filter(({ root }) => root.attributes["data-side"] !== undefined);
  const anchors = cell.roots.filter(({ root }) => root.attributes["data-side"] === undefined);
  const [popup] = popups;
  const [anchor] = anchors;
  const side = popup?.root.attributes["data-side"] ?? "";
  const align = ALIGN.get(popup?.root.attributes["data-align"] ?? "");
  if (
    popup === undefined ||
    anchor === undefined ||
    popups.length > 1 ||
    anchors.length > 1 ||
    align === undefined
  ) {
    throw new KitUnmappable({
      message: `${cell.key} measures no popup with Base UI's data-side and data-align beside one anchor`,
    });
  }
  const across = side === "left" || side === "right";
  if (!across && side !== "top" && side !== "bottom") {
    throw new KitUnmappable({
      message: `${cell.key}'s popup sits on the side ${side}, which Base UI does not name`,
    });
  }
  const winner = (longhand: string): string =>
    anchor.root.declarations
      .map((index) => declarations[index])
      .findLast((each) => each?.longhands.includes(longhand))
      ?.value.trim() ?? "";
  const blockLevel = /^(block|flex|grid|flow-root|table)$/.test(winner("display"));
  const autoWidth = winner("width") === "" || winner("width") === "auto";
  const anchorFills = !across && blockLevel && autoWidth;
  return {
    roots: side === "top" || side === "left" ? [popup, anchor] : [anchor, popup],
    anchor,
    anchorFills,
    anchorTakesColumn: anchorFills || (!across && evaluatePercentage(winner("width")) === 1),
    declarations: [
      { property: "display", value: "flex" },
      { property: "flex-direction", value: across ? "row" : "column" },
      { property: "align-items", value: align },
      { property: "gap", value: `${String(sideOffset)}px` },
    ],
  };
}

/**
 * The guard of the hugging-anchor rule. Where the anchor's width is not in the spec, as a trigger that
 * hugs its text, the popup draws at its own `min-width`, which is right only while the anchor is no
 * wider: Base UI makes the popup `max(anchor, minimum)`. The capture marks a popup whose anchor is
 * wider, and such a cell of a popup whose `width` reads `--anchor-width` stops the build, naming the
 * popup and its `min-width`. A popup sized otherwise, as Popover's `w-72`, does not take the anchor's
 * width, so its anchor may be any width.
 *
 * @throws `KitUnmappable` where a hugging anchor is wider than the popup's `min-width`.
 */
export function checkHuggingAnchor(
  cell: CapturedCell,
  placement: AnchoredPlacement,
  anchorWidth: AnchorWidth,
  declarations: readonly CapturedDeclaration[]
): void {
  const popup = placement.roots.find((each) => each !== placement.anchor)?.root;
  // Only a popup whose width reads the anchor's takes it, as Select's `w-(--anchor-width)` does.
  const sized = popup?.declarations
    .map((index) => declarations[index])
    .some(
      (declaration) =>
        declaration?.longhands.includes("width") === true && declaration.value.includes("--anchor-width")
    );
  if (anchorWidth._tag !== "minimum" || sized !== true || popup?.measured?.anchorWiderThanMinimum !== true) {
    return;
  }
  const minimum = popup.declarations
    .map((index) => declarations[index])
    .findLast((declaration) => declaration?.longhands.includes("min-width") === true)?.value;
  throw new KitUnmappable({
    message: `${cell.key}: the browser widens the ${popup.attributes["data-slot"] ?? "popup"} to its anchor, which hugs its text past the popup's min-width, ${minimum ?? "unset"}, and the kit draws the popup at that min-width; give the anchor a width the spec holds, or shorten the sample's text`,
  });
}
