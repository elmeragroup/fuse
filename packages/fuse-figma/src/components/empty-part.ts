import type { LayerStyle } from "./cascade";
/**
 * A part the kit draws in no layer in a cell where none of its parts shows. CSS lays out a block that holds no in-flow
 * children, has no padding, border or length along the axis its parent stacks on, and no margin
 * there, at 0 along that axis (CSS 2.1 §10.6.3), and a box with no background, border or shadow
 * paints nothing. Figma keeps an auto-layout frame with no children at its last length instead of
 * hugging it to 0 (PE4), so the kit leaves such a part out of the cell, as the Combobox popup's list
 * draws nothing while no row matches. A part that paints, pads, sets a length or a margin, or sits in
 * a parent that spaces its children with a gap, stays drawn.
 */
import type { Cell, PartDefinition } from "./component-spec";
import { evaluateLength } from "./css-values";

/** Why an empty part draws in no layer. */
export const EMPTY_PART =
  "the part holds nothing in this cell, paints nothing and pads nothing down its column, so CSS draws it 0 tall, while Figma keeps an auto-layout frame with no children at its last height (PE4)";

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
 * Whether a part that holds parts holds no layer in a cell: none of its parts, and no label or icon,
 * shows there. A part that holds no parts in its definition is a box the definition draws by its own
 * lengths, as a dot is, and stays drawn.
 *
 * @param part - The part's definition.
 * @param cell - The cell.
 * @returns True where nothing below the part shows.
 */
function holdsNothing(part: PartDefinition, cell: Cell): boolean {
  const parts = part.parts ?? [];
  return (
    parts.length > 0 &&
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
 * column with no row gap.
 */
function stacksWithoutGap(parent: LayerStyle): boolean {
  const display = parent.resolved("display") ?? "block";
  if (display === "block") {
    return true;
  }
  const direction = parent.resolved("flex-direction") ?? "row";
  return display === "flex" && direction === "column" && isZero(parent.resolved("row-gap"));
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
