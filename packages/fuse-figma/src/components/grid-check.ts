/**
 * The kit check's rules for a Figma grid. A box whose direction is GRID, and only such a box, holds a
 * grid. A FLEX track sits on no axis the grid hugs, which the typings' `GridTrackSize` calls invalid,
 * and which a real file drew at the grid's old width (PG3). A grid frame aligns MIN on both axes,
 * since Figma throws `must be 'MIN' when layoutMode is 'GRID'` for any other (PG10).
 * The plugin places a grid's layers `ROW_AUTO_FLOW`, which the typings define as CSS's
 * `grid-auto-flow: row`: each layer in flow, in layer order, takes the next cell row by row. So the
 * grid's cells name its layers in flow in that order, row by row, and fit inside its tracks. The
 * plugin bundles this module, so it imports no Figma typings and no Node module.
 */
import { outOfLayout } from "./kit-spec.ts";
import type { BoxSpec, GridSpec } from "./kit-spec.ts";

/** Why a grid's cells differ from the cells its layers in flow take row by row, or undefined. */
function cellFault(grid: GridSpec, inFlow: readonly string[]): string | undefined {
  const columns = grid.columns.length;
  if (inFlow.length > columns * grid.rows.length) {
    return `holds ${inFlow.length} layers in flow, more than its ${grid.rows.length} × ${columns} cells`;
  }
  if (grid.cells.length !== inFlow.length) {
    return `names ${grid.cells.length} cells for its ${inFlow.length} layers in flow`;
  }
  const fault = inFlow.findIndex((key, index) => {
    const cell = grid.cells[index];
    return cell?.key !== key || cell.row !== Math.floor(index / columns) || cell.column !== index % columns;
  });
  return fault === -1
    ? undefined
    : `puts ${grid.cells[fault]?.key ?? "nothing"} where its layer ${inFlow[fault] ?? ""} takes the next cell row by row, as Figma's ROW_AUTO_FLOW places it`;
}

/**
 * Why a box's grid contradicts the box or itself, or undefined where it draws.
 *
 * @param box - The box.
 * @returns The fault, as a clause that follows the box's name.
 */
export function gridFault(box: BoxSpec): string | undefined {
  const { grid } = box;
  if ((box.direction === "GRID") !== (grid !== undefined)) {
    return box.direction === "GRID"
      ? "lays out as a grid but holds no tracks"
      : `lays out ${box.direction} but holds grid tracks`;
  }
  if (grid === undefined) {
    return undefined;
  }
  if (grid.columns.length === 0 || grid.rows.length === 0) {
    return "is a grid with no tracks";
  }
  if (box.primaryAlign !== "MIN" || box.counterAlign !== "MIN") {
    return `is a grid that aligns ${box.primaryAlign} and ${box.counterAlign}, where Figma takes only MIN`;
  }
  const flexOn = (axis: "horizontal" | "vertical") =>
    box.sizing[axis].kind === "hug" &&
    (axis === "horizontal" ? grid.columns : grid.rows).some((track) => track.kind === "flex");
  if (flexOn("horizontal") || flexOn("vertical")) {
    return "hugs an axis that a FLEX track shares out, which Figma calls invalid";
  }
  return cellFault(
    grid,
    box.children.flatMap((child) => (outOfLayout(child) ? [] : [child.key]))
  );
}
