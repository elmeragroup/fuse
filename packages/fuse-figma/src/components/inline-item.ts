/**
 * The `display: inline` of an item in a flex row, as DateInput's segments in their field box. A flex
 * container blockifies the display of each of its in-flow children (CSS Display 3 §2.7, CSS Flexbox 1
 * §4), so an `inline` item lays out as a block-level flex item, and one that holds only its own text
 * is a block box that sets that text in lines. The row lays the items out along its one line in
 * source order where it neither wraps nor reverses, and no `order` moves an item, which the capture
 * measured as `inlineRow` in every mode, after the mode's faces loaded. The item then draws as the
 * layer it is in the row's horizontal auto layout, a frame that hugs its text.
 *
 * Anything else stays unmapped: an `inline` box in a block container, which sets its line boxes by
 * its font's metrics and not its own height, a row the capture did not measure on one line, and an
 * item that holds anything but its own text.
 */
import { normalizeCss } from "./css-values";
import type { Feed, LayerStyle } from "./layer-style";

/** Why an `inline` item of a measured flex row draws as a block box that sets its own text. */
const BLOCKIFIED =
  "a flex item, which the row blockifies (CSS Display 3 §2.7) into a block box that sets its own text in lines; the capture measured the row's items on its one line in source order in every mode";

/**
 * Read a box's `display: inline` where it is an item of a flex row the capture measured on one line,
 * holding only its own text, as the module doc says.
 *
 * @param reader - The box's style.
 * @param item - Whether the capture measured the box as an `inlineRow` item, and whether the box
 *   holds only its own text.
 * @param lays - The layout feeds the display picks.
 * @returns Undefined where the box's display is not `inline`, which the read leaves alone; else
 *   whether it mapped, as a block box that sets its own text in lines.
 */
export function readInlineItem(
  reader: LayerStyle,
  item: { readonly inlineRow: boolean; readonly ownText: boolean },
  lays: Feed
): boolean | undefined {
  if (normalizeCss(reader.raw("display") ?? "") !== "inline") {
    return undefined;
  }
  const mapped = item.inlineRow && item.ownText;
  reader.read(
    "display",
    (value) => (mapped ? value : undefined),
    () => ({ outcome: "literal", detail: BLOCKIFIED }),
    lays
  );
  return mapped;
}
