/**
 * Where a grid cell's tooltip opens, so it never covers the neighbours a pointer moves to next. A
 * cell in the first column opens its tooltip to the left, a cell in the last column to the right,
 * and an inner cell, or the cell of a one-column grid, on top. Base UI still flips a side that has
 * no room, such as at the viewport's edge.
 */

/** The side of its trigger a grid cell's tooltip opens on. */
export type CellSide = "left" | "top" | "right";

/** The horizontal extent of a box, as `getBoundingClientRect` gives it. */
export type HorizontalExtent = { readonly left: number; readonly right: number };

/** Layout rounding: a cell this close to the grid's edge sits in the edge column. */
const EDGE_TOLERANCE = 1;

/**
 * The side a cell's tooltip opens on, from the cell's place in its grid's columns. The column is
 * read from layout, not counted, so the rule holds for any responsive column count.
 *
 * @param cell - The cell's horizontal extent.
 * @param grid - The grid's horizontal extent, its content box.
 * @returns `left` for the first column, `right` for the last, and `top` for an inner column or a
 *   grid of one column.
 */
export function cellSide(cell: HorizontalExtent, grid: HorizontalExtent): CellSide {
  const first = cell.left - grid.left <= EDGE_TOLERANCE;
  const last = grid.right - cell.right <= EDGE_TOLERANCE;
  if (first === last) {
    return "top";
  }
  return first ? "left" : "right";
}

/**
 * The side for the cell of `trigger`: its `[data-tooltip-cell]` within its `[data-tooltip-grid]`.
 *
 * @param trigger - A trigger inside a tooltip grid cell.
 * @returns The side, or `top` for a trigger outside a tooltip grid.
 */
export function triggerSide(trigger: Element): CellSide {
  const cell = trigger.closest("[data-tooltip-cell]");
  if (cell === null) {
    return "top";
  }
  const grid = cell.closest("[data-tooltip-grid]");
  return grid === null ? "top" : cellSide(cell.getBoundingClientRect(), grid.getBoundingClientRect());
}
