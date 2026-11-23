/**
 * Where a label sets its lines across its box: the `text-align` it sets or inherits, read under the
 * `direction` its lines run in, or the placement a native control gives its text. `label-layout.ts`
 * reads the label's alignment here, and `label-sizing.ts` reads where a filling label would set its
 * lines.
 */

import type { LabelDefinition } from "./component-spec";
import { normalizeCss } from "./css-values";
import { TOP_LEFT } from "./kit-spec";
import type { TextAlignSpec } from "./kit-spec";
import type { LayerStyle } from "./layer-style";

/**
 * Where a native control sets its text within the text's box, which no class says, as an `<input>`
 * centers its value down its box and a `<textarea>` starts its text at the top.
 */
export type TextPlacement = {
  readonly horizontal: "start" | "center" | "end";
  readonly vertical: "top" | "center" | "bottom";
  /**
   * How the control sets its text in lines, which it does itself whatever the box's `display` says.
   * `single` keeps the text on one line across the content box, as an `<input>` sets its value,
   * whatever `white-space` says, so the label fills the box's width and ends in an ellipsis after one
   * line. `wrap` wraps the text at the content box's width, as a `<textarea>` wraps its value, so the
   * label fills the width with its height following its lines.
   */
  readonly lines: "single" | "wrap";
};

/** A label, with the placement a form control gives its text where its box is one. */
export type PlacedLabel = LabelDefinition & { readonly placement?: TextPlacement };

/**
 * Where `text-align` sets a label's lines, by the value Tailwind compiles, under each `direction`.
 * `start` and `end` name the edges the line's direction starts and ends at, and `left` and `right`
 * name the same edges under either (CSS Text 3 §6.1).
 */
const TEXT_ALIGNS = new Map<string, Readonly<Record<LineDirection, Across>>>([
  ["left", { ltr: "LEFT", rtl: "LEFT" }],
  ["start", { ltr: "LEFT", rtl: "RIGHT" }],
  ["center", { ltr: "CENTER", rtl: "CENTER" }],
  ["right", { ltr: "RIGHT", rtl: "RIGHT" }],
  ["end", { ltr: "RIGHT", rtl: "LEFT" }],
  // Chromium's default style sheet centers a caption's text so, which a `revert` rolls back to.
  ["-webkit-center", { ltr: "CENTER", rtl: "CENTER" }],
]);

/**
 * Where a box's `text-align` sets its lines, or undefined where no Figma alignment reads it.
 * Chromium's default style sheet gives a `<th>` `-internal-center`, which centers its text where its
 * parent's `text-align` is the initial `start` (HTML, Rendering §15.3.8) and otherwise computes to
 * the parent's value (`th-center.chromium.test.ts`), so it reads as centered only under a parent
 * the kit draws at `start`.
 */
function linesOf(style: LayerStyle, value: string, direction: LineDirection): Across | undefined {
  const align = normalizeCss(value);
  if (align === "-internal-center") {
    const parent = style.parent();
    return parent !== undefined && normalizeCss(parent.resolved("text-align") ?? "start") === "start"
      ? "CENTER"
      : undefined;
  }
  return TEXT_ALIGNS.get(align)?.[direction];
}

/** The direction a label's lines run in, which `direction` sets and a box passes down. */
type LineDirection = "ltr" | "rtl";

/**
 * The direction a label's lines run in. It decides only where `start` and `end` put them, so the
 * `direction` row stays unmapped: a right-to-left box also orders its layers from the right, which
 * the build does not draw.
 */
function lineDirection(style: LayerStyle): LineDirection {
  return normalizeCss(style.resolved("direction") ?? "") === "rtl" ? "rtl" : "ltr";
}

/** The text alignment across each horizontal placement a definition names takes. */
const PLACED_ACROSS = { start: "LEFT", center: "CENTER", end: "RIGHT" } as const;

/**
 * Read where a label sets its lines in its box. A `text-align` the box sets or inherits sets them
 * across. Otherwise the definition's placement does, for a label that fills its box's width. The
 * label hugs its height, so its lines start at the top of its own box. CSS sets a box's text from
 * the top at its `start`, the left unless the lines run right to left, which a label without either
 * keeps.
 *
 * @param placement - The placement across that a filling label takes, or undefined for none.
 */
export function readTextAlign(
  style: LayerStyle,
  placement: TextPlacement | undefined,
  path: readonly string[]
): TextAlignSpec {
  const direction = lineDirection(style);
  const across = style.read(
    "text-align",
    (value) => linesOf(style, value, direction),
    (align) => ({ outcome: "literal", detail: `the label sets its lines ${LINES_WHERE[align]}` }),
    style.feed("align", path)
  );
  return { horizontal: across ?? unsetAcross(direction, placement), vertical: TOP_LEFT.vertical };
}

/** Where a label that fills its box would set its lines, as {@link readTextAlign} reads it, without a read. */
export function linesAcross(style: LayerStyle, placement: TextPlacement | undefined): Across {
  const direction = lineDirection(style);
  const css = linesOf(style, style.resolved("text-align") ?? "", direction);
  return css ?? unsetAcross(direction, placement);
}

/** Where a label sets its lines with no `text-align` to read: the definition's placement, or `start`. */
function unsetAcross(direction: LineDirection, placement: TextPlacement | undefined): Across {
  return placement === undefined
    ? direction === "rtl"
      ? "RIGHT"
      : "LEFT"
    : PLACED_ACROSS[placement.horizontal];
}

/** A place across a box, named as text alignment names it. */
export type Across = TextAlignSpec["horizontal"];

/** How a text's alignment of its lines reads in a coverage detail. */
export const LINES_WHERE = { LEFT: "at the left", CENTER: "in the center", RIGHT: "at the right" } as const;
