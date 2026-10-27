import type { LayerStyle } from "./cascade";
/**
 * The parts the kit draws in no layer because CSS gives them no room and nothing to paint.
 *
 * A part the kit draws in no layer in a cell where none of its parts shows. CSS lays out a block that holds no in-flow
 * children, has no padding, border or length along the axis its parent stacks on, and no margin
 * there, at 0 along that axis (CSS 2.1 §10.6.3), and a box with no background, border or shadow
 * paints nothing. Figma keeps an auto-layout frame with no children at its last length instead of
 * hugging it to 0 (PE4), so the kit leaves such a part out of the cell, as the Combobox popup's list
 * draws nothing while no row matches. A part that paints, pads, sets a length or a margin, or sits in
 * a parent that spaces its children with a gap, stays drawn.
 *
 * A part that leaves no trace, a frame or an instance, draws in no layer either: at `opacity: 0` it paints nothing of itself or
 * what it holds (CSS Color 4 §3.2), and a top margin of minus its height leaves its margin box 0 tall
 * (CSS 2.1 §8.3, §10.6), so it takes no room in a column with no gap, as the collapsed Sidebar rail's
 * group label (`h-8 -mt-8 opacity-0`) fades out and pulls the rows up.
 */
import type { Cell, PartDefinition } from "./component-spec";
import { evaluateLength, evaluateNumber } from "./css-values";

/** Why an empty part draws in no layer. */
export const EMPTY_PART =
  "the part holds nothing in this cell, paints nothing and pads nothing down its column, so CSS draws it 0 tall, while Figma keeps an auto-layout frame with no children at its last height (PE4)";

/** Why a part that leaves no trace draws in no layer. */
export const NO_TRACE =
  "the part paints nothing at opacity 0, and its top margin takes back its height, so it takes no room in its column";

/** The properties whose value paints a box: its background, its border and its shadows. */
const PAINTS = [
  "background-color",
  "background-image",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "box-shadow",
  "outline-width",
] as const;

/** The properties that give a box a length down a column, each of which must be unset or 0. */
const COLUMN_LENGTHS = [
  "height",
  "min-height",
  "padding-top",
  "padding-bottom",
  "margin-top",
  "margin-bottom",
] as const;

/**
 * Whether a part that holds parts or a label holds no layer in a cell: none of its parts, and no label
 * or icon, shows there, as `Command.Empty` holds its message only while no row matches. A part that
 * holds neither in its definition is a box the definition draws by its own lengths, as a dot is, and
 * stays drawn.
 *
 * @param part - The part's definition.
 * @param cell - The cell.
 * @returns True where nothing below the part shows.
 */
function holdsNothing(part: PartDefinition, cell: Cell): boolean {
  const parts = part.parts ?? [];
  return (
    (parts.length > 0 || part.label !== undefined) &&
    parts.every((child) => !child.shownIn(cell)) &&
    (part.label === undefined || !part.label.shownIn(cell)) &&
    part.iconsFor(cell).length === 0
  );
}

/** Whether a resolved length is unset or 0. */
function isZero(value: string | undefined): boolean {
  return value === undefined || value === "auto" || evaluateLength(value) === 0;
}

/**
 * Whether a parent stacks its parts down a column with no gap between them: a block, or a flex
 * column with no row gap, which `gap` sets too.
 */
function stacksWithoutGap(parent: LayerStyle): boolean {
  const display = parent.resolved("display") ?? "block";
  if (display === "block") {
    return true;
  }
  const direction = parent.resolved("flex-direction") ?? "row";
  return (
    display === "flex" &&
    direction === "column" &&
    isZero(parent.resolved("row-gap")) &&
    isZero(parent.resolved("gap"))
  );
}

/** Whether a box's own declarations paint nothing. */
function paintsNothing(style: LayerStyle): boolean {
  return PAINTS.every((property) => {
    const value = style.resolved(property);
    switch (property) {
      case "background-color":
        return value === undefined || value === "transparent";
      case "background-image":
        return value === undefined || value === "none";
      case "box-shadow":
        return value === undefined || value === "none";
      default:
        return isZero(value);
    }
  });
}

/**
 * Whether a part draws in no layer in a cell, as the module comment says.
 *
 * @param part - The part's definition.
 * @param style - The part's style in the cell.
 * @param parent - The style of the box that holds it.
 * @param cell - The cell.
 * @returns True for an empty part CSS draws 0 tall that paints nothing.
 */
export function vanishes(part: PartDefinition, style: LayerStyle, parent: LayerStyle, cell: Cell): boolean {
  return (
    holdsNothing(part, cell) &&
    stacksWithoutGap(parent) &&
    paintsNothing(style) &&
    COLUMN_LENGTHS.every((property) => isZero(style.resolved(property)))
  );
}

/**
 * Whether a part leaves no trace, as the module comment says: it is fully transparent, its top
 * margin is minus its literal height and its bottom margin 0, and its parent stacks it down a column
 * with no gap.
 *
 * @param style - The part's style in the cell.
 * @param parent - The style of the box that holds it.
 * @returns True for a part that takes no room and paints nothing.
 */
export function leavesNoTrace(style: LayerStyle, parent: LayerStyle): boolean {
  const height = evaluateLength(style.resolved("height") ?? "auto");
  const opacity = evaluateNumber(style.resolved("opacity") ?? "1");
  return (
    opacity === 0 &&
    height !== undefined &&
    height > 0 &&
    evaluateLength(style.resolved("margin-top") ?? "0px") === -height &&
    isZero(style.resolved("margin-bottom")) &&
    stacksWithoutGap(parent)
  );
}
