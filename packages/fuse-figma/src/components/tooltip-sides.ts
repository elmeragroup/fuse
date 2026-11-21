/**
 * The sides of its trigger a Tooltip's popup opens on in the kit, free of imports for the client
 * bundle, which `tooltip-kit.ts` names as an axis and `compare/tooltip-cell.ts` renders. Base UI's
 * `inline-start` and `inline-end` compute as `left` and `right` on a left-to-right page, so they take
 * no cells of their own.
 */
import type { Cell } from "./component-spec.ts";

/** The physical sides, in the order the sets' cells list them. */
export const TOOLTIP_SIDES = ["top", "bottom", "left", "right"] as const;

/** A side the kit draws the popup on. */
export type TooltipSide = (typeof TOOLTIP_SIDES)[number];

/**
 * The side a Tooltip cell names.
 *
 * @param cell - A cell of a Tooltip set, whose `side` axis lists {@link TOOLTIP_SIDES}.
 * @returns The cell's side.
 * @throws When the cell names no such side, which a set's axes rule out.
 */
export function tooltipSideOf(cell: Cell): TooltipSide {
  const side = TOOLTIP_SIDES.find((each) => each === cell.side);
  if (side === undefined) {
    throw new Error(`A Tooltip cell names the side ${String(cell.side)}, which no Tooltip set lists.`);
  }
  return side;
}

/** The pixels Base UI leaves between the popup and its trigger: `Tooltip.Content`'s default `sideOffset`. */
export const TOOLTIP_SIDE_OFFSET = 4;
